import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncInventoryStock, getBookingBalance, logBillingAudit, ensureOrdersSchema, ensureProfilePictureSchema, syncNormalizedBillingLineItems } from '@/lib/db';

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

    let activeBooking = null;
    if (guestID > 0) {
      const activeBookings = await dbQuery(`
        SELECT b.bookingID, b.status as bookingStatus, b.roomID, b.breakfastID, b.breakfastOption,
               res.breakfastOption as resBreakfastOption,
               r.roomNumber, r.status as roomStatus
        FROM booking b
        LEFT JOIN reservation res ON res.reservationID = b.reservationID
        LEFT JOIN room r ON r.roomID = b.roomID
        WHERE b.guestID = ? AND b.status NOT IN ('Cancelled', 'Checked Out', 'No Show')
        ORDER BY b.bookingID DESC
        LIMIT 1
      `, [guestID]);
      if (activeBookings.length > 0) {
        activeBooking = activeBookings[0];

        const roomHasBreakfast = (
          (activeBooking.breakfastOption && activeBooking.breakfastOption.toLowerCase().includes('with') && !activeBooking.breakfastOption.toLowerCase().includes('without')) ||
          (activeBooking.resBreakfastOption && activeBooking.resBreakfastOption.toLowerCase().includes('with') && !activeBooking.resBreakfastOption.toLowerCase().includes('without')) ||
          parseInt(activeBooking.breakfastID) === 2
        );

        // Calculate nights of stay
        const inStr = (activeBooking.checkInDateTime || '').split(' ')[0] || (activeBooking.checkInDateTime || '').split('T')[0];
        const outStr = (activeBooking.checkOutDateTime || '').split(' ')[0] || (activeBooking.checkOutDateTime || '').split('T')[0];
        const checkInD = new Date(inStr + 'T00:00:00');
        const checkOutD = new Date(outStr + 'T00:00:00');
        let nights = 1;
        if (!isNaN(checkInD.getTime()) && !isNaN(checkOutD.getTime()) && checkOutD > checkInD) {
          nights = Math.max(1, Math.round((checkOutD.getTime() - checkInD.getTime()) / (1000 * 60 * 60 * 24)));
        }

        const maxStayAllowance = roomHasBreakfast ? (2 * nights) : 0;

        const [compUsedRows] = await dbQuery(
          `SELECT COALESCE(SUM(op.quantity), 0) as compCount 
           FROM order_product op 
           JOIN orders o ON o.orderID = op.orderID 
           WHERE o.bookingID = ? AND op.isComplimentary = 1 AND o.orderStatus != 'Canceled'`,
          [activeBooking.bookingID]
        ).catch(() => [[]]);
        const complimentaryBreakfastUsed = parseInt(compUsedRows && compUsedRows[0]?.compCount || 0);
        const remainingStayAllowance = Math.max(0, maxStayAllowance - complimentaryBreakfastUsed);

        // Query daily usage breakdown
        const dailyRows = await dbQuery(
          `SELECT DATE_FORMAT(COALESCE(o.deliveryDate, o.orderDateTime), '%Y-%m-%d') as deliveryDate,
                  COALESCE(SUM(op.quantity), 0) as dailyCount
           FROM order_product op
           JOIN orders o ON o.orderID = op.orderID
           WHERE o.bookingID = ? AND op.isComplimentary = 1 AND o.orderStatus != 'Canceled'
           GROUP BY DATE_FORMAT(COALESCE(o.deliveryDate, o.orderDateTime), '%Y-%m-%d')`,
          [activeBooking.bookingID]
        ).catch(() => []);

        const dailyUsedCompMap = {};
        if (Array.isArray(dailyRows)) {
          dailyRows.forEach(r => {
            if (r.deliveryDate) {
              dailyUsedCompMap[r.deliveryDate] = parseInt(r.dailyCount || 0, 10);
            }
          });
        }

        activeBooking = {
          ...activeBooking,
          nights,
          roomHasBreakfast,
          stayComplimentaryAllowance: maxStayAllowance,
          complimentaryBreakfastUsed,
          remainingStayAllowance,
          dailyUsedCompMap,
          complimentaryBreakfastAvailable: remainingStayAllowance
        };
      }
    }

    return NextResponse.json({
      success: true,
      guest,
      activeBooking,
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

    const bookings = await dbQuery(`
      SELECT b.bookingID, b.roomID, b.status as bookingStatus, b.breakfastOption, b.breakfastID,
             res.breakfastOption as resBreakfastOption,
             r.status as roomStatus, r.roomTypeID, r.floorID
      FROM booking b
      LEFT JOIN reservation res ON res.reservationID = b.reservationID
      LEFT JOIN room r ON r.roomID = b.roomID
      WHERE b.guestID = ? AND b.status NOT IN ('Cancelled', 'Checked Out', 'No Show')
      ORDER BY b.bookingID DESC
      LIMIT 1
    `, [guest.guestID]);

    const activeStayStatuses = [
      'Checked In',
      'Active Stay',
      'Confirmed',
      'Booked',
      'Checkout Requested',
      'Pending Room Verification',
      'Pending Checkout',
      'Room Verified',
      'Final Billing Updated',
      'Bill Finalized',
      'Late Checkout'
    ];
    if (bookings.length === 0 || !activeStayStatuses.includes(bookings[0].bookingStatus)) {
      return NextResponse.json({
        error: "Orders can only be placed once you have an active stay or confirmed booking."
      }, { status: 403 });
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

      // Complimentary Breakfast Entitlement: Up to 2 free cooked meals per calendar delivery date, stay cap = 2 * nights
      const inStr = (booking.checkInDateTime || '').split(' ')[0] || (booking.checkInDateTime || '').split('T')[0];
      const outStr = (booking.checkOutDateTime || '').split(' ')[0] || (booking.checkOutDateTime || '').split('T')[0];
      const checkInD = new Date(inStr + 'T00:00:00');
      const checkOutD = new Date(outStr + 'T00:00:00');
      let nights = 1;
      if (!isNaN(checkInD.getTime()) && !isNaN(checkOutD.getTime()) && checkOutD > checkInD) {
        nights = Math.max(1, Math.round((checkOutD.getTime() - checkInD.getTime()) / (1000 * 60 * 60 * 24)));
      }

      const roomHasBreakfast = (
        (booking.breakfastOption && booking.breakfastOption.toLowerCase().includes('with') && !booking.breakfastOption.toLowerCase().includes('without')) ||
        (booking.resBreakfastOption && booking.resBreakfastOption.toLowerCase().includes('with') && !booking.resBreakfastOption.toLowerCase().includes('without')) ||
        parseInt(booking.breakfastID) === 2
      );

      const maxStayAllowance = roomHasBreakfast ? (2 * nights) : 0;

      // Query free meals already consumed across the ENTIRE stay with FOR UPDATE
      const [stayCompRows] = await connection.execute(
        `SELECT COALESCE(SUM(op.quantity), 0) AS totalStayUsedComp
         FROM order_product op
         JOIN orders o ON o.orderID = op.orderID
         WHERE o.bookingID = ? 
           AND op.isComplimentary = 1 
           AND o.orderStatus NOT IN ('Canceled')
         FOR UPDATE`,
        [booking.bookingID]
      );
      let totalStayUsedComp = parseInt(stayCompRows[0]?.totalStayUsedComp || 0, 10);
      let remainingStayAllowance = Math.max(0, maxStayAllowance - totalStayUsedComp);

      // Target delivery date for scheduled cooked meals
      const targetDeliveryDate = deliveryDate || nowStr.split(' ')[0];

      // Query free meals already consumed for this specific targetDeliveryDate with FOR UPDATE
      const [dailyCompRows] = await connection.execute(
        `SELECT COALESCE(SUM(op.quantity), 0) AS dailyUsedComp
         FROM order_product op
         JOIN orders o ON o.orderID = op.orderID
         WHERE o.bookingID = ? 
           AND DATE(o.deliveryDate) = DATE(?)
           AND op.isComplimentary = 1 
           AND o.orderStatus NOT IN ('Canceled')
         FOR UPDATE`,
        [booking.bookingID, targetDeliveryDate]
      );
      let dailyUsedComp = parseInt(dailyCompRows[0]?.dailyUsedComp || 0, 10);
      let remainingDailyAllowance = Math.max(0, 2 - dailyUsedComp);
      let availableFreeForOrder = Math.min(remainingStayAllowance, remainingDailyAllowance);

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

              if (p.productCategoryID === 3) {
                let compQty = 0;
                if (roomHasBreakfast && availableFreeForOrder > 0) {
                  compQty = Math.min(qty, availableFreeForOrder);
                  availableFreeForOrder -= compQty;
                  remainingStayAllowance -= compQty;
                  remainingDailyAllowance -= compQty;
                }
                const paidQty = qty - compQty;

                if (compQty > 0) {
                  groupSummaryList.push(`${compQty}x ${p.name} (Complimentary)`);
                  await connection.execute(
                    "INSERT INTO order_product (quantity, orderID, productID, isComplimentary, unitPrice, deliveryType, itemStatus) VALUES (?, ?, ?, 1, 0.00, ?, ?)",
                    [compQty, orderID, itemID, itemDelType, initialItemStatus]
                  );
                }
                if (paidQty > 0) {
                  groupTotal += price * paidQty;
                  groupSummaryList.push(`${paidQty}x ${p.name}`);
                  await connection.execute(
                    "INSERT INTO order_product (quantity, orderID, productID, isComplimentary, unitPrice, deliveryType, itemStatus) VALUES (?, ?, ?, 0, ?, ?, ?)",
                    [paidQty, orderID, itemID, price, itemDelType, initialItemStatus]
                  );
                }
              } else {
                groupTotal += price * qty;
                groupSummaryList.push(`${qty}x ${p.name}`);

                await connection.execute(
                  "INSERT INTO order_product (quantity, orderID, productID, isComplimentary, unitPrice, deliveryType, itemStatus) VALUES (?, ?, ?, 0, ?, ?, ?)",
                  [qty, orderID, itemID, price, itemDelType, initialItemStatus]
                );
              }

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
                "INSERT INTO order_amenities (quantity, orderID, amenityID, unitPrice, deliveryType, itemStatus) VALUES (?, ?, ?, ?, ?, ?)",
                [qty, orderID, itemID, price, itemDelType, initialItemStatus]
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

      // Synchronize stay billing line items and master balance immediately
      if (billingID) {
        await syncNormalizedBillingLineItems(connection, billingID, booking.bookingID);
      }

      await connection.commit();
      catalogCache = null; // Invalidate cache so quantities update immediately

      // Trigger sync inventory quantities
      syncInventoryStock();

      const primaryOrderID = createdOrderIDs[0] || 0;
      const summaryText = allOrderSummaries.join(' | ');

      // Notify Guest
      await dbQuery(
        "INSERT INTO notification (userID, title, message) VALUES (?, 'Order Placed Successfully', ?)",
        [session.userID, `Your order #${primaryOrderID} (${summaryText}) total ₱${grandTotalOrderAmount.toFixed(2)} has been placed!`]
      );

      // Notify Receptionists
      const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
      for (const r of staffToNotify) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'New Guest Room Order', ?)",
          [r.userID, `Guest ${guest.firstName} ${guest.lastName} placed Order #${primaryOrderID}: ${summaryText} (₱${grandTotalOrderAmount.toFixed(2)}).`]
        );
      }

      // Invalidate catalog cache so next fetch gets updated stock immediately
      catalogCacheTime = 0;

      return NextResponse.json({
        success: true,
        message: `Order #${primaryOrderID} placed successfully! Total: ₱${grandTotalOrderAmount.toFixed(2)}`,
        orderID: primaryOrderID,
        orderIDs: createdOrderIDs,
        totalAmount: grandTotalOrderAmount,
        summary: summaryText
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

export async function PATCH(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    await ensureOrdersSchema();
    const body = await request.json();
    const { orderID, items, deliveryDate, deliveryTime } = body;

    if (!orderID) {
      return NextResponse.json({ error: 'orderID is required.' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Order items are required.' }, { status: 400 });
    }

    const guests = await dbQuery("SELECT guestID, firstName, lastName FROM guest WHERE userID = ?", [session.userID]);
    if (guests.length === 0) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }
    const guest = guests[0];

    // Verify order exists and belongs to this guest
    const ordersFound = await dbQuery(
      "SELECT orderID, guestID, bookingID, orderStatus, deliveryType, deliveryTime, deliveryDate FROM orders WHERE orderID = ? AND guestID = ?",
      [parseInt(orderID, 10), guest.guestID]
    );

    if (ordersFound.length === 0) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const currentOrder = ordersFound[0];
    const currentStatus = (currentOrder.orderStatus || '').toLowerCase();

    // Check if order status permits modifications (only before preparation begins)
    const nonModifiable = ['preparing', 'served', 'completed', 'delivered', 'canceled', 'cancelled'];
    if (nonModifiable.some(s => currentStatus.includes(s))) {
      return NextResponse.json({
        error: `Order #${orderID} is already ${currentOrder.orderStatus} and can no longer be modified.`
      }, { status: 400 });
    }

    // Connect to db and start transaction
    const db = await getDbConnection();
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      let hasCookedMeals = false;

      for (const it of items) {
        const itemID = parseInt(it.itemID, 10);
        const itemType = it.type; // 'Product' or 'Amenity'
        let reqDelType = it.deliveryType === 'scheduled' ? 'scheduled' : 'immediate';

        if (itemType === 'Product') {
          // Check if cooked meal (productCategoryID === 3)
          const [pRows] = await connection.execute("SELECT productCategoryID FROM products WHERE productID = ?", [itemID]);
          if (pRows.length > 0 && pRows[0].productCategoryID === 3) {
            // ENFORCE: Cooked meals are strictly locked to scheduled
            reqDelType = 'scheduled';
            hasCookedMeals = true;
          }

          // Update order_product
          await connection.execute(
            "UPDATE order_product SET deliveryType = ?, itemStatus = ? WHERE orderID = ? AND productID = ?",
            [reqDelType, reqDelType === 'scheduled' ? 'Scheduled' : 'Placed', orderID, itemID]
          );
        } else if (itemType === 'Amenity') {
          // Update order_amenities
          await connection.execute(
            "UPDATE order_amenities SET deliveryType = ?, itemStatus = ? WHERE orderID = ? AND amenityID = ?",
            [reqDelType, reqDelType === 'scheduled' ? 'Scheduled' : 'Placed', orderID, itemID]
          );
        }
      }

      // Check all existing items in database for this order to ensure consistency
      const [allOP] = await connection.execute(
        `SELECT op.deliveryType, p.productCategoryID FROM order_product op
         JOIN products p ON p.productID = op.productID
         WHERE op.orderID = ?`,
        [orderID]
      );
      const [allOA] = await connection.execute(
        `SELECT deliveryType FROM order_amenities WHERE orderID = ?`,
        [orderID]
      );

      const anyScheduledInDB = allOP.some(p => p.deliveryType === 'scheduled') || allOA.some(a => a.deliveryType === 'scheduled');
      const anyCookedMealInDB = allOP.some(p => p.productCategoryID === 3);

      const finalDeliveryType = anyScheduledInDB ? 'scheduled' : 'immediate';

      let finalDeliveryDate = null;
      let finalDeliveryTime = null;

      if (finalDeliveryType === 'scheduled') {
        const manilaDateFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const todayManila = manilaDateFormatter.format(new Date());

        finalDeliveryDate = deliveryDate ? String(deliveryDate).trim() : (currentOrder.deliveryDate || todayManila);
        finalDeliveryTime = deliveryTime || currentOrder.deliveryTime || '07:30 AM';

        const allowedTimes = ['06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM', '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM'];
        if (!allowedTimes.includes(finalDeliveryTime)) {
          await connection.rollback();
          return NextResponse.json({
            error: "Breakfast delivery time must be scheduled between 6:00 AM and 10:30 AM."
          }, { status: 400 });
        }

        if (finalDeliveryDate < todayManila) {
          await connection.rollback();
          return NextResponse.json({
            error: "Scheduled delivery date cannot be in the past."
          }, { status: 400 });
        }
      }

      // Update orders table
      // If order was Pending Delivery (awaiting check-in), preserve that status; otherwise if scheduled -> Scheduled, else Pending
      let nextOrderStatus = currentOrder.orderStatus;
      if (currentOrder.orderStatus !== 'Pending Delivery') {
        nextOrderStatus = finalDeliveryType === 'scheduled' ? 'Scheduled' : 'Pending';
      }

      await connection.execute(
        `UPDATE orders
         SET deliveryType = ?,
             hasCookedMeal = ?,
             deliveryDate = ?,
             deliveryTime = ?,
             orderStatus = ?
         WHERE orderID = ?`,
        [
          finalDeliveryType,
          anyCookedMealInDB ? 1 : 0,
          finalDeliveryDate,
          finalDeliveryTime,
          nextOrderStatus,
          orderID
        ]
      );

      // Re-synchronize stay billing line items
      const [guestBill] = await connection.execute("SELECT billingID FROM billing WHERE bookingID = ? ORDER BY billingID DESC LIMIT 1", [currentOrder.bookingID]);
      if (guestBill.length > 0) {
        await syncNormalizedBillingLineItems(connection, guestBill[0].billingID, currentOrder.bookingID);
      }

      await connection.commit();

      // Log notification for staff
      try {
        const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
        for (const r of staffToNotify) {
          await dbQuery(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Order Delivery Mode Updated', ?)",
            [r.userID, `Guest ${guest.firstName} ${guest.lastName} updated delivery mode for Order #${orderID} to ${finalDeliveryType.toUpperCase()}${finalDeliveryType === 'scheduled' ? ` (${finalDeliveryTime})` : ''}.`]
          );
        }
      } catch (ne) {
        console.error("Failed to notify staff:", ne);
      }

      return NextResponse.json({
        success: true,
        message: 'Order delivery preferences updated successfully.',
        orderID,
        deliveryType: finalDeliveryType,
        deliveryDate: finalDeliveryDate,
        deliveryTime: finalDeliveryTime
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Failed to update guest order delivery mode:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
