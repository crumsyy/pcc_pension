import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncInventoryStock, getBookingBalance, logBillingAudit, ensureOrdersSchema, ensureProfilePictureSchema } from '@/lib/db';

// In-memory catalog cache with 60s TTL
let catalogCache = null;
let catalogCacheTime = 0;
const CATALOG_CACHE_TTL = 60000;

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeHistory = searchParams.get('history') === 'true';

  try {
    await ensureOrdersSchema();
    await ensureProfilePictureSchema();

    const now = Date.now();
    let activeProducts, cookedMeals, amenities;

    if (catalogCache && (now - catalogCacheTime < CATALOG_CACHE_TTL)) {
      activeProducts = catalogCache.products;
      cookedMeals = catalogCache.cookedMeals;
      amenities = catalogCache.amenities;
    } else {
      const [productsRaw, amenitiesRaw] = await Promise.all([
        dbQuery(`
          SELECT p.productID, p.name, p.price, p.productCategoryID, p.image,
                 CASE WHEN p.productCategoryID = 3 THEN 9999 ELSE COALESCE(p.quantity, 0) END as availableQty
          FROM products p
          WHERE p.isArchived = 0 AND p.isAvailable = 1
          ORDER BY p.name ASC
        `),
        dbQuery(`
          SELECT a.amenityID, a.name, a.price, a.image, COALESCE(a.quantity, 0) as availableQty
          FROM amenities a
          WHERE a.isArchived = 0
          ORDER BY a.name ASC
        `)
      ]);

      activeProducts = productsRaw.filter(p => p.productCategoryID !== 3);
      cookedMeals = productsRaw.filter(p => p.productCategoryID === 3);
      amenities = amenitiesRaw;

      catalogCache = { products: activeProducts, cookedMeals, amenities };
      catalogCacheTime = now;
    }

    // Fetch guest profile & order history safely
    let guest = null;
    try {
      const guests = await dbQuery("SELECT guestID, firstName, lastName, userID, profilePicture FROM guest WHERE userID = ?", [session.userID]);
      if (guests.length > 0) {
        guest = guests[0];
      }
    } catch (e) {
      const guests = await dbQuery("SELECT guestID, firstName, lastName, userID FROM guest WHERE userID = ?", [session.userID]);
      if (guests.length > 0) {
        guest = guests[0];
      }
    }

    if (guest && !guest.profilePicture) {
      try {
        const userRows = await dbQuery("SELECT profilePicture FROM user WHERE userID = ?", [session.userID]);
        if (userRows.length > 0 && userRows[0].profilePicture) {
          guest.profilePicture = userRows[0].profilePicture;
        }
      } catch (e) {
        // Safe fallback if column does not exist on user table
      }
    }

    const guestID = guest ? guest.guestID : 0;

    let orders = [];
    // Fetch full order history so guest orders persist across navigation
    if (guestID > 0) {
      const ordersRaw = await dbQuery(`
        SELECT o.orderID, o.guestID, o.bookingID, o.orderDateTime, o.orderStatus, o.deliveryTime, o.deliveryDate,
               COALESCE(o.deliveryType, CASE WHEN o.deliveryTime IS NOT NULL THEN 'scheduled' ELSE 'immediate' END) as deliveryType,
               COALESCE(r.roomNumber, 'N/A') as roomNumber
        FROM orders o
        LEFT JOIN booking b ON b.bookingID = o.bookingID
        LEFT JOIN room r ON r.roomID = b.roomID
        WHERE o.guestID = ?
        ORDER BY o.orderDateTime DESC
        LIMIT 50
      `, [guestID]);

      if (ordersRaw.length > 0) {
        const [orderProducts, orderAmenities] = await Promise.all([
          dbQuery(`
            SELECT op.orderID, op.quantity, op.isComplimentary,
                   COALESCE(op.deliveryType, 'immediate') as deliveryType,
                   COALESCE(op.itemStatus, 'Placed') as itemStatus,
                   p.productID as itemID, p.name, p.price, 'Product' as type
            FROM order_product op
            JOIN products p ON p.productID = op.productID
            WHERE op.orderID IN (SELECT orderID FROM orders WHERE guestID = ?)
          `, [guestID]),
          dbQuery(`
            SELECT oa.orderID, oa.quantity,
                   COALESCE(oa.deliveryType, 'immediate') as deliveryType,
                   COALESCE(oa.itemStatus, 'Placed') as itemStatus,
                   a.amenityID as itemID, a.name, a.price, 'Amenity' as type
            FROM order_amenities oa
            JOIN amenities a ON a.amenityID = oa.amenityID
            WHERE oa.orderID IN (SELECT orderID FROM orders WHERE guestID = ?)
          `, [guestID])
        ]);

        orders = ordersRaw.map(o => {
          const p = orderProducts.filter(op => op.orderID === o.orderID);
          const a = orderAmenities.filter(oa => oa.orderID === o.orderID);
          return {
            ...o,
            items: [...p, ...a]
          };
        });
      }
    }

    return NextResponse.json({
      success: true,
      guest,
      products: activeProducts,
      cookedMeals,
      amenities,
      orders
    });
  } catch (error) {
    console.error("Failed to fetch guest order catalog:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    await ensureOrdersSchema();
    const body = await request.json();
    const { items } = body; // Array of { itemID, type: 'Product'|'Amenity', quantity, name }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required to place an order.' }, { status: 400 });
    }

    const guests = await dbQuery("SELECT guestID, firstName, lastName FROM guest WHERE userID = ?", [session.userID]);
    if (guests.length === 0) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }
    const guest = guests[0];

    // Find active checked-in or confirmed booking for this guest
    const bookings = await dbQuery(
      "SELECT bookingID, roomID FROM booking WHERE guestID = ? AND status IN ('Checked In', 'Late Checkout', 'Confirmed') ORDER BY checkInDateTime DESC LIMIT 1",
      [guest.guestID]
    );

    if (bookings.length === 0) {
      return NextResponse.json({ error: 'Active booking not found. Orders must be linked to an active booking stay.' }, { status: 400 });
    }

    const booking = bookings[0];

    // Check if order contains cooked meals (productCategoryID === 3) or bundled scheduled items
    let containsCookedMeal = false;
    let hasScheduledItems = false;
    for (const item of items) {
      if (item.type === 'Product') {
        const pCheck = await dbQuery("SELECT productCategoryID FROM products WHERE productID = ?", [parseInt(item.itemID)]);
        if (pCheck.length > 0 && pCheck[0].productCategoryID === 3) {
          containsCookedMeal = true;
          // Cooked breakfast meals MUST always be scheduled
          item.deliveryType = 'scheduled';
        } else {
          // Products: honor checkbox selection (default immediate)
          item.deliveryType = item.deliveryType === 'scheduled' ? 'scheduled' : 'immediate';
        }
      } else {
        // Amenities: honor checkbox selection (default immediate)
        item.deliveryType = item.deliveryType === 'scheduled' ? 'scheduled' : 'immediate';
      }
      if (item.deliveryType === 'scheduled') {
        hasScheduledItems = true;
      }
    }

    // Validate deliveryTime and deliveryDate for scheduled breakfast items
    const manilaDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayManila = manilaDateFormatter.format(new Date()); // YYYY-MM-DD
    const deliveryDate = body.deliveryDate ? String(body.deliveryDate).trim() : (hasScheduledItems ? todayManila : null);

    if (hasScheduledItems) {
      if (!body.deliveryTime) {
        return NextResponse.json({
          error: "Please select a scheduled breakfast delivery time (between 6:00 AM and 10:30 AM) for your scheduled items."
        }, { status: 400 });
      }
      const allowedTimes = ['06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM', '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM'];
      if (!allowedTimes.includes(body.deliveryTime)) {
        return NextResponse.json({
          error: "Breakfast delivery time must be scheduled between 6:00 AM and 10:30 AM."
        }, { status: 400 });
      }

      if (deliveryDate < todayManila) {
        return NextResponse.json({
          error: "Scheduled delivery date cannot be in the past. Please select today or a future date."
        }, { status: 400 });
      }

      // Check if delivery time is in the past ONLY if delivery date is today
      if (deliveryDate === todayManila) {
        const manilaFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Manila',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const parts = manilaFormatter.formatToParts(new Date());
        const p = {};
        parts.forEach(({ type, value }) => { p[type] = value; });
        const currentManilaMinutes = parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10);

        const [timePart, meridiem] = body.deliveryTime.split(' ');
        const [hrStr, minStr] = timePart.split(':');
        let dHour = parseInt(hrStr, 10);
        if (meridiem === 'PM' && dHour !== 12) dHour += 12;
        if (meridiem === 'AM' && dHour === 12) dHour = 0;
        const deliveryMinutes = dHour * 60 + parseInt(minStr, 10);

        if (deliveryMinutes <= currentManilaMinutes) {
          return NextResponse.json({
            error: `Cannot schedule delivery for ${body.deliveryTime} as that time has already passed today. Please select an upcoming delivery time slot or choose a future date.`
          }, { status: 400 });
        }
      }
    }

    const db = await getDbConnection();
    const connection = await db.getConnection();

    const localNow = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

    try {
      await connection.beginTransaction();

      // Concurrency lock on booking
      await connection.execute(
        "SELECT bookingID, status FROM booking WHERE bookingID = ? FOR UPDATE",
        [booking.bookingID]
      );
      const balanceBefore = await getBookingBalance(booking.bookingID);

      // Prevent duplicate order creation within 10 seconds for the same guest
      const [recentOrderCheck] = await connection.execute(
        "SELECT orderID FROM orders WHERE guestID = ? AND orderDateTime >= DATE_SUB(NOW(), INTERVAL 10 SECOND) LIMIT 1",
        [guest.guestID]
      );
      if (recentOrderCheck.length > 0) {
        await connection.commit();
        return NextResponse.json({
          success: true,
          orderID: recentOrderCheck[0].orderID,
          message: "Order already submitted."
        });
      }

      // Separate items into Immediate vs Scheduled groups
      const immediateItems = items.filter(it => (it.deliveryType || 'immediate') !== 'scheduled');
      const scheduledItems = items.filter(it => it.deliveryType === 'scheduled');

      const orderGroups = [];
      if (immediateItems.length > 0) {
        orderGroups.push({
          deliveryType: 'immediate',
          orderStatus: 'Pending',
          deliveryTime: null,
          deliveryDate: null,
          items: immediateItems
        });
      }
      if (scheduledItems.length > 0) {
        orderGroups.push({
          deliveryType: 'scheduled',
          orderStatus: 'Scheduled',
          deliveryTime: body.deliveryTime || '07:30 AM',
          deliveryDate: deliveryDate || nowStr.split(' ')[0],
          items: scheduledItems
        });
      }

      let grandTotalOrderAmount = 0;
      const createdOrderIDs = [];
      const allOrderSummaries = [];

      const [billRows] = await connection.execute("SELECT billingID FROM billing WHERE bookingID = ?", [booking.bookingID]);
      const billingID = billRows[0]?.billingID || null;

      for (const group of orderGroups) {
        const groupHasCookedMeal = group.items.some(it => it.type === 'Product' && (it.isCookedMeal || it.productCategoryID === 3));
        const [orderRes] = await connection.execute(
          "INSERT INTO orders (orderDateTime, orderStatus, guestID, bookingID, hasCookedMeal, deliveryTime, deliveryDate, deliveryType) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [nowStr, group.orderStatus, guest.guestID, booking.bookingID, groupHasCookedMeal ? 1 : 0, group.deliveryTime, group.deliveryDate, group.deliveryType]
        );
        const orderID = orderRes.insertId;
        createdOrderIDs.push(orderID);

        let groupTotal = 0;
        const groupSummaryList = [];

        for (const item of group.items) {
          const itemID = parseInt(item.itemID);
          const qty = parseInt(item.quantity);
          const itemType = item.type; // 'Product' or 'Amenity'
          const itemDelType = group.deliveryType;
          const initialItemStatus = group.deliveryType === 'scheduled' ? 'Scheduled' : 'Placed';

          if (!itemID || isNaN(qty) || qty <= 0) continue;

          if (itemType === 'Product') {
            const [pRes] = await connection.execute("SELECT name, price, productCategoryID FROM products WHERE productID = ?", [itemID]);
            if (pRes.length > 0) {
              const p = pRes[0];
              const price = parseFloat(p.price);
              groupTotal += price * qty;
              groupSummaryList.push(`${qty}x ${p.name}`);

              await connection.execute(
                "INSERT INTO order_product (quantity, orderID, productID, deliveryType, itemStatus) VALUES (?, ?, ?, ?, ?)",
                [qty, orderID, itemID, itemDelType, initialItemStatus]
              );

              // FIFO Inventory deduction if not cooked meal (productCategoryID !== 3)
              if (p.productCategoryID !== 3) {
                const [batches] = await connection.execute(
                  `SELECT batchID, remainingQuantity FROM inventory_batch
                   WHERE itemType = 'Product' AND itemID = ? AND status IN ('Active', 'Low Stock') AND remainingQuantity > 0
                   ORDER BY createdAt ASC`,
                  [itemID]
                );

                let needed = qty;
                for (const b of batches) {
                  if (needed <= 0) break;
                  const deduct = Math.min(b.remainingQuantity, needed);
                  const newRem = b.remainingQuantity - deduct;
                  needed -= deduct;

                  await connection.execute(
                    "UPDATE inventory_batch SET remainingQuantity = ?, status = ? WHERE batchID = ?",
                    [newRem, newRem === 0 ? 'Consumed' : 'Active', b.batchID]
                  );

                  // Insert movement log
                  await connection.execute(
                    `INSERT INTO inventory_movement (movementType, quantity, referenceID, notes, itemType, itemID, createdAt)
                     VALUES ('OUT', ?, ?, 'Order through Chat/Guest Portal', 'Product', ?, ?)`,
                    [deduct, orderID, itemID, nowStr]
                  );
                }
              }
            }
          } else if (itemType === 'Amenity') {
            const [aRes] = await connection.execute("SELECT name, price FROM amenities WHERE amenityID = ?", [itemID]);
            if (aRes.length > 0) {
              const a = aRes[0];
              const price = parseFloat(a.price);
              groupTotal += price * qty;
              groupSummaryList.push(`${qty}x ${a.name}`);

              await connection.execute(
                "INSERT INTO order_amenities (quantity, orderID, amenityID, deliveryType, itemStatus) VALUES (?, ?, ?, ?, ?)",
                [qty, orderID, itemID, itemDelType, initialItemStatus]
              );

              // FIFO Inventory deduction for amenities
              const [batches] = await connection.execute(
                `SELECT batchID, remainingQuantity FROM inventory_batch
                 WHERE itemType = 'Amenity' AND itemID = ? AND status IN ('Active', 'Low Stock') AND remainingQuantity > 0
                 ORDER BY createdAt ASC`,
                [itemID]
              );

              let needed = qty;
              for (const b of batches) {
                if (needed <= 0) break;
                const deduct = Math.min(b.remainingQuantity, needed);
                const newRem = b.remainingQuantity - deduct;
                needed -= deduct;

                await connection.execute(
                  "UPDATE inventory_batch SET remainingQuantity = ?, status = ? WHERE batchID = ?",
                  [newRem, newRem === 0 ? 'Consumed' : 'Active', b.batchID]
                );

                await connection.execute(
                  `INSERT INTO inventory_movement (movementType, quantity, referenceID, notes, itemType, itemID, createdAt)
                   VALUES ('OUT', ?, ?, 'Amenity Order through Chat/Guest Portal', 'Amenity', ?, ?)`,
                  [deduct, orderID, itemID, nowStr]
                );
              }
            }
          }
        }

        grandTotalOrderAmount += groupTotal;
        allOrderSummaries.push(`Order #${orderID} (${group.deliveryType === 'scheduled' ? `Scheduled • ${group.deliveryTime}` : 'Immediate'}): ${groupSummaryList.join(', ')}`);
      }

      const balanceAfter = Math.round((balanceBefore + grandTotalOrderAmount) * 100) / 100;

      await logBillingAudit(connection, {
        billingID,
        bookingID: booking.bookingID,
        transactionType: 'Order',
        amount: grandTotalOrderAmount,
        balanceBefore,
        balanceAfter,
        userID: session.userID,
        userName: `${guest.firstName} ${guest.lastName}`,
        userRole: 'Guest',
        description: allOrderSummaries.join(' | '),
        referenceNumber: `ORD-${createdOrderIDs.join('-')}`
      });

      await connection.commit();
      catalogCache = null; // Invalidate cache so quantities update immediately

      // Trigger sync inventory quantities
      syncInventoryStock();

      // Notify Guest
      await dbQuery(
        "INSERT INTO notification (userID, title, message) VALUES (?, 'Order Placed Successfully', ?)",
        [session.userID, `Your order #${orderID} (${orderSummaryList.join(', ')}) total ₱${totalOrderAmount.toFixed(2)} has been placed!`]
      );

      // Notify Receptionists
      const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
      for (const r of staffToNotify) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'New Guest Room Order', ?)",
          [r.userID, `Guest ${guest.firstName} ${guest.lastName} placed Order #${orderID}: ${orderSummaryList.join(', ')} (₱${totalOrderAmount.toFixed(2)}).`]
        );
      }

      // Invalidate catalog cache so next fetch gets updated stock immediately
      catalogCacheTime = 0;

      return NextResponse.json({
        success: true,
        message: `Order #${orderID} placed successfully! Total: ₱${totalOrderAmount.toFixed(2)}`,
        orderID,
        totalAmount: totalOrderAmount,
        summary: orderSummaryList.join(', ')
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Failed to process guest chat order:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
