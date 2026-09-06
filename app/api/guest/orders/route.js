import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncInventoryStock, getBookingBalance, logBillingAudit, ensureOrdersSchema } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    await ensureOrdersSchema();
    const [products, amenities] = await Promise.all([
      dbQuery(`
        SELECT p.productID, p.name, p.price, p.productCategoryID,
               CASE WHEN p.productCategoryID = 3 THEN 9999 ELSE COALESCE(SUM(ib.remainingQuantity), 0) END as availableQty
        FROM products p
        LEFT JOIN inventory_batch ib ON ib.itemType = 'Product' AND ib.itemID = p.productID AND ib.status IN ('Active', 'Low Stock')
        WHERE p.isArchived = 0 AND p.isAvailable = 1
        GROUP BY p.productID
        ORDER BY p.name ASC
      `),
      dbQuery(`
        SELECT a.amenityID, a.name, a.price, COALESCE(SUM(ib.remainingQuantity), 0) as availableQty
        FROM amenities a
        LEFT JOIN inventory_batch ib ON ib.itemType = 'Amenity' AND ib.itemID = a.amenityID AND ib.status IN ('Active', 'Low Stock')
        WHERE a.isArchived = 0
        GROUP BY a.amenityID
        ORDER BY a.name ASC
      `)
    ]);

    const activeProducts = products.filter(p => p.productCategoryID !== 3);
    const cookedMeals = products.filter(p => p.productCategoryID === 3);

    // Fetch guest order history
    const guests = await dbQuery("SELECT guestID FROM guest WHERE userID = ?", [session.userID]);
    const guestID = guests.length > 0 ? guests[0].guestID : 0;

    let orders = [];
    if (guestID > 0) {
      const ordersRaw = await dbQuery(`
        SELECT o.*, 
               COALESCE(r.roomNumber, 'N/A') as roomNumber
        FROM orders o
        LEFT JOIN booking b ON b.bookingID = o.bookingID
        LEFT JOIN room r ON r.roomID = b.roomID
        WHERE o.guestID = ?
        ORDER BY o.orderDateTime DESC
      `, [guestID]);

      const [orderProducts, orderAmenities] = await Promise.all([
        dbQuery(`
          SELECT op.orderID, op.quantity, op.isComplimentary, p.productID as itemID, p.name, p.price, 'Product' as type
          FROM order_product op
          JOIN products p ON p.productID = op.productID
          WHERE op.orderID IN (SELECT orderID FROM orders WHERE guestID = ?)
        `, [guestID]),
        dbQuery(`
          SELECT oa.orderID, oa.quantity, a.amenityID as itemID, a.name, a.price, 'Amenity' as type
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

    return NextResponse.json({
      success: true,
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

    // Check if order contains cooked meals (productCategoryID === 3)
    let containsCookedMeal = false;
    for (const item of items) {
      if (item.type === 'Product') {
        const pCheck = await dbQuery("SELECT productCategoryID FROM products WHERE productID = ?", [parseInt(item.itemID)]);
        if (pCheck.length > 0 && pCheck[0].productCategoryID === 3) {
          containsCookedMeal = true;
          break;
        }
      }
    }

    // Validate deliveryTime and deliveryDate for cooked meals
    const manilaDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayManila = manilaDateFormatter.format(new Date()); // YYYY-MM-DD
    const deliveryDate = body.deliveryDate ? String(body.deliveryDate).trim() : (containsCookedMeal ? todayManila : null);

    if (containsCookedMeal) {
      if (!body.deliveryTime) {
        return NextResponse.json({
          error: "Please select a scheduled delivery time (between 6:00 AM and 10:30 AM) for cooked breakfast meals."
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

      const deliveryTime = body.deliveryTime || null;
      // Create Order
      const [orderRes] = await connection.execute(
        "INSERT INTO orders (orderDateTime, orderStatus, guestID, hasCookedMeal, deliveryTime, deliveryDate) VALUES (?, 'Pending', ?, ?, ?, ?)",
        [nowStr, guest.guestID, containsCookedMeal ? 1 : 0, deliveryTime, deliveryDate]
      );
      const orderID = orderRes.insertId;

      let totalOrderAmount = 0;
      const orderSummaryList = [];

      for (const item of items) {
        const itemID = parseInt(item.itemID);
        const qty = parseInt(item.quantity);
        const itemType = item.type; // 'Product' or 'Amenity'

        if (!itemID || isNaN(qty) || qty <= 0) continue;

        if (itemType === 'Product') {
          const [pRes] = await connection.execute("SELECT name, price, productCategoryID FROM products WHERE productID = ?", [itemID]);
          if (pRes.length > 0) {
            const p = pRes[0];
            const price = parseFloat(p.price);
            totalOrderAmount += price * qty;
            orderSummaryList.push(`${qty}x ${p.name}`);

            await connection.execute(
              "INSERT INTO order_product (quantity, orderID, productID) VALUES (?, ?, ?)",
              [qty, orderID, itemID]
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
            totalOrderAmount += price * qty;
            orderSummaryList.push(`${qty}x ${a.name}`);

            await connection.execute(
              "INSERT INTO order_amenities (quantity, orderID, amenityID) VALUES (?, ?, ?)",
              [qty, orderID, itemID]
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

      const balanceAfter = Math.round((balanceBefore + totalOrderAmount) * 100) / 100;
      const [billRows] = await connection.execute("SELECT billingID FROM billing WHERE bookingID = ?", [booking.bookingID]);
      const billingID = billRows[0]?.billingID || null;

      await logBillingAudit(connection, {
        billingID,
        bookingID: booking.bookingID,
        transactionType: 'Order',
        amount: totalOrderAmount,
        balanceBefore,
        balanceAfter,
        userID: session.userID,
        userName: `${guest.firstName} ${guest.lastName}`,
        userRole: 'Guest',
        description: `Order #${orderID}: ${orderSummaryList.join(', ')}`,
        referenceNumber: `ORD-${orderID}`
      });

      await connection.commit();

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
