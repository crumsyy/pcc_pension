import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncInventoryStock, ensureOrdersSchema } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureOrdersSchema();
    // 1. Fetch all orders with guest and historical room information
    const ordersRaw = await dbQuery(`
      SELECT o.*, g.firstName, g.lastName, 
             COALESCE(r.roomNumber, r_prev.roomNumber) as roomNumber 
      FROM orders o
      JOIN guest g ON g.guestID = o.guestID
      LEFT JOIN booking b ON b.guestID = g.guestID AND b.status = 'Checked In'
      LEFT JOIN room r ON r.roomID = b.roomID
      LEFT JOIN (
        SELECT guestID, MAX(bookingID) as maxID FROM booking GROUP BY guestID
      ) b_latest ON b_latest.guestID = g.guestID
      LEFT JOIN booking b_prev ON b_prev.bookingID = b_latest.maxID
      LEFT JOIN room r_prev ON r_prev.roomID = b_prev.roomID
      ORDER BY o.orderDateTime DESC
    `);

    // 2. Fetch order items (products and amenities)
    const [orderProducts, orderAmenities] = await Promise.all([
      dbQuery(`
        SELECT op.orderID, op.quantity, p.productID as itemID, p.name, p.price, p.image, 'Product' as type
        FROM order_product op
        JOIN products p ON p.productID = op.productID
      `),
      dbQuery(`
        SELECT oa.orderID, oa.quantity, a.amenityID as itemID, a.name, a.price, a.image, 'Amenity' as type
        FROM order_amenities oa
        JOIN amenities a ON a.amenityID = oa.amenityID
      `)
    ]);

    const orders = ordersRaw.map(o => {
      const products = orderProducts.filter(op => op.orderID === o.orderID);
      const amenities = orderAmenities.filter(oa => oa.orderID === o.orderID);
      return {
        ...o,
        items: [...products, ...amenities]
      };
    });

    // 3. Fetch products, amenities and active bookings for dropdowns
    const [products, amenities, activeBookings, borrowLogs] = await Promise.all([
      dbQuery(`
        SELECT p.productID, p.name, p.price, p.image,
               CASE WHEN p.productCategoryID = 3 THEN 9999 ELSE COALESCE(SUM(ib.remainingQuantity), 0) END as quantity,
               p.productCategoryID
        FROM products p 
        LEFT JOIN inventory_batch ib ON ib.itemType = 'Product' AND ib.itemID = p.productID AND ib.status IN ('Active', 'Low Stock', 'Expired')
        WHERE p.isArchived = 0 AND p.isAvailable = 1
        GROUP BY p.productID, p.name, p.price, p.image, p.productCategoryID
        ORDER BY p.name
      `),
      dbQuery(`
        SELECT a.amenityID, a.name, a.price, a.image, COALESCE(SUM(ib.remainingQuantity), 0) as quantity 
        FROM amenities a 
        LEFT JOIN inventory_batch ib ON ib.itemType = 'Amenity' AND ib.itemID = a.amenityID AND ib.status IN ('Active', 'Low Stock', 'Expired')
        WHERE a.isArchived = 0
        GROUP BY a.amenityID, a.name, a.price, a.image
        ORDER BY a.name
      `),
      dbQuery(`
        SELECT b.bookingID, b.guestID, g.firstName, g.lastName, rm.roomNumber 
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        JOIN room rm ON rm.roomID = b.roomID
        WHERE b.status IN ('Checked In', 'Late Checkout')
      `),
      dbQuery(`
        SELECT bt.*, COALESCE(a.name, p.name) as itemName, r.roomNumber
        FROM borrow_transaction bt
        LEFT JOIN amenities a ON bt.itemType = 'Amenity' AND a.amenityID = bt.itemID
        LEFT JOIN products p ON bt.itemType = 'Product' AND p.productID = bt.itemID
        LEFT JOIN room r ON r.roomID = bt.roomID
        ORDER BY bt.borrowDateTime DESC
      `)
    ]);

    const activeProducts = products.filter(p => p.productCategoryID !== 3);
    const cookedMeals = products.filter(p => p.productCategoryID === 3);

    return NextResponse.json({ success: true, orders, products: activeProducts, cookedMeals, amenities, activeBookings, borrowLogs });
  } catch (error) {
    console.error("Failed to fetch orders data:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const localNow = new Date();
  const pad = (num) => String(num).padStart(2, '0');
  const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

  try {
    await ensureOrdersSchema();
    const body = await request.json();
    const { action } = body;

    const db = await getDbConnection();

    if (action === 'create') {
      const guestID = parseInt(body.guestID);
      const items = body.items; // array of { itemID, type, quantity }

      if (!guestID || !items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'Missing guest ID or items list.' }, { status: 400 });
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        // Check active checked-in booking for this guest
        const [bookingCheck] = await connection.execute(
          `SELECT b.bookingID, b.roomID, g.firstName, g.lastName, r.roomTypeID, r.floorID 
           FROM booking b 
           JOIN guest g ON g.guestID = b.guestID 
           JOIN room r ON r.roomID = b.roomID
           WHERE g.guestID = ? AND b.status IN ('Checked In', 'Late Checkout') 
           LIMIT 1`,
          [guestID]
        );
        if (bookingCheck.length === 0) {
          return NextResponse.json({ error: 'Only checked-in guests are allowed to place orders.' }, { status: 400 });
        }
        const activeBookingID = bookingCheck[0].bookingID;
        const activeRoomID = bookingCheck[0].roomID;
        const activeBorrowedBy = `${bookingCheck[0].firstName} ${bookingCheck[0].lastName}`.trim();

        // Prevent duplicate order creation within 10 seconds for the same guest
        const [recentOrderCheck] = await connection.execute(
          "SELECT orderID FROM orders WHERE guestID = ? AND orderDateTime >= DATE_SUB(NOW(), INTERVAL 10 SECOND) LIMIT 1",
          [guestID]
        );
        if (recentOrderCheck.length > 0) {
          await connection.commit();
          return NextResponse.json({
            success: true,
            orderID: recentOrderCheck[0].orderID,
            message: "Order placed successfully."
          });
        }

        // Check if order contains cooked breakfast meals
        let containsCookedBreakfast = false;
        for (const item of items) {
          if (item.type === 'Product') {
            const [pRes] = await connection.execute(
              "SELECT productCategoryID, name FROM products WHERE productID = ?",
              [parseInt(item.itemID)]
            );
            if (pRes.length > 0 && pRes[0].productCategoryID === 3) {
              containsCookedBreakfast = true;
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
        const deliveryDate = body.deliveryDate ? String(body.deliveryDate).trim() : (containsCookedBreakfast ? todayManila : null);

        if (containsCookedBreakfast) {
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

        // Rule 10: Complimentary Breakfast Entitlement Check
        const [compCheck] = await connection.execute(
          `SELECT COUNT(*) as compCount 
           FROM order_product op 
           JOIN orders o ON o.orderID = op.orderID 
           WHERE o.bookingID = ? AND op.isComplimentary = 1`,
          [activeBookingID]
        );
        let currentCompCount = compCheck[0]?.compCount || 0;

        // Fetch room rate to see if breakfast is included (breakfastID = 2 or rateWithBreakfast)
        const [rateCheck] = await connection.execute(
          `SELECT breakfastID FROM room_rate WHERE roomTypeID = ? AND floorID = ? AND breakfastID = 2`,
          [bookingCheck[0].roomTypeID, bookingCheck[0].floorID]
        );
        const roomHasBreakfast = rateCheck.length > 0;

        const deliveryTime = body.deliveryTime || null;
        // 1. Create order record
        const [orderResult] = await connection.execute(
          "INSERT INTO orders (orderStatus, orderDateTime, guestID, bookingID, hasCookedMeal, deliveryTime, deliveryDate) VALUES ('Preparing', ?, ?, ?, ?, ?, ?)",
          [nowStr, guestID, activeBookingID, containsCookedBreakfast ? 1 : 0, deliveryTime, deliveryDate]
        );
        const orderID = orderResult.insertId;

        // 2. Insert items and update stock using FIFO batches
        for (const item of items) {
          const itemID = parseInt(item.itemID);
          const quantity = parseInt(item.quantity);
          if (!itemID || quantity <= 0) continue;

          let isCookedMeal = false;
          if (item.type === 'Product') {
            const [pRes] = await connection.execute(
              "SELECT productCategoryID FROM products WHERE productID = ?",
              [itemID]
            );
            if (pRes.length > 0 && pRes[0].productCategoryID === 3) {
              isCookedMeal = true;
            }
          }

          if (isCookedMeal) {
            let isComplimentary = 0;
            if (roomHasBreakfast && currentCompCount < 1) {
              isComplimentary = 1;
              currentCompCount++;
            }
            await connection.execute(
              "INSERT INTO order_product(quantity, orderID, productID, isComplimentary) VALUES(?, ?, ?, ?)",
              [quantity, orderID, itemID, isComplimentary]
            );
            continue;
          }

          // Fetch active batches for this item
          const [batches] = await connection.execute(
            `SELECT * FROM inventory_batch 
             WHERE itemType = ? AND itemID = ? AND remainingQuantity > 0 
             ORDER BY COALESCE(expirationDate, '9999-12-31') ASC, dateReceived ASC`,
            [item.type, itemID]
          );

          const totalAvailable = batches.reduce((sum, b) => sum + b.remainingQuantity, 0);
          if (totalAvailable < quantity) {
            throw new Error(`Insufficient stock for ${item.type === 'Product' ? 'product' : 'amenity'}: ID ${itemID}`);
          }

          let itemClassType = 'Consumable';
          if (item.type === 'Product') {
            const [pRes] = await connection.execute("SELECT itemType FROM products WHERE productID = ?", [itemID]);
            if (pRes.length > 0) itemClassType = pRes[0].itemType;
          } else {
            const [aRes] = await connection.execute("SELECT itemType FROM amenities WHERE amenityID = ?", [itemID]);
            if (aRes.length > 0) itemClassType = aRes[0].itemType;
          }

          let needed = quantity;
          for (const batch of batches) {
            if (needed <= 0) break;
            const take = Math.min(batch.remainingQuantity, needed);
            
            await connection.execute(
              "UPDATE inventory_batch SET remainingQuantity = remainingQuantity - ? WHERE batchID = ?",
              [take, batch.batchID]
            );

            const mType = itemClassType === 'Non-Consumable' ? 'Borrow' : 'Stock Out';
            await connection.execute(
              `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks, batchID)
               VALUES (?, ?, ?, ?, ?, ?, 'Guest Order placed', ?)`,
              [item.type, itemID, -take, session.userID, mType, `ORD-${orderID}`, batch.batchID]
            );

            needed -= take;
          }

          if (itemClassType === 'Non-Consumable') {
            await connection.execute(
              `INSERT INTO borrow_transaction (itemType, itemID, quantity, borrowedBy, bookingID, roomID, status, userID, remarks)
               VALUES (?, ?, ?, ?, ?, ?, 'Borrowed', ?, ?)`,
              [
                item.type,
                itemID,
                quantity,
                activeBorrowedBy,
                activeBookingID,
                activeRoomID,
                session.userID,
                `Borrowed via Guest Order ORD-${orderID}`
              ]
            );
          }

          if (item.type === 'Product') {
            await connection.execute("INSERT INTO order_product(quantity, orderID, productID) VALUES(?, ?, ?)", [quantity, orderID, itemID]);
            await connection.execute("UPDATE products SET quantity = GREATEST(0, quantity - ?) WHERE productID = ?", [quantity, itemID]);
          } else {
            await connection.execute("INSERT INTO order_amenities(quantity, orderID, amenityID) VALUES(?, ?, ?)", [quantity, orderID, itemID]);
            await connection.execute("UPDATE amenities SET quantity = GREATEST(0, quantity - ?) WHERE amenityID = ?", [quantity, itemID]);
          }
        }

        await connection.commit();
        await syncInventoryStock();
        return NextResponse.json({ success: true, message: 'Order created successfully.', orderID });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    if (action === 'update_status') {
      const orderID = parseInt(body.orderID);
      const newStatus = body.status; // 'Pending', 'Preparing', 'Served', 'Completed', 'Canceled'

      if (!orderID || !newStatus) {
        return NextResponse.json({ error: 'Missing orderID or status.' }, { status: 400 });
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        // If canceling, check 2-minute restriction for cooked meals (Rule 8)
        if (newStatus === 'Canceled') {
          const [statusRes] = await connection.execute(
            "SELECT orderStatus, orderDateTime, TIMESTAMPDIFF(SECOND, orderDateTime, NOW()) as elapsedSec FROM orders WHERE orderID = ?",
            [orderID]
          );
          if (statusRes.length > 0 && statusRes[0].orderStatus !== 'Canceled') {
            const [cookedItems] = await connection.execute(`
              SELECT op.orderProductID 
              FROM order_product op 
              JOIN products p ON p.productID = op.productID 
              WHERE op.orderID = ? AND p.productCategoryID = 3
            `, [orderID]);

            if (cookedItems.length > 0) {
              const elapsedSec = statusRes[0].elapsedSec || 0;
              if (elapsedSec > 120) {
                return NextResponse.json({
                  error: "This order can no longer be cancelled because food preparation may already be in progress."
                }, { status: 400 });
              }
            }

            // Restore products stock
            const [prodItems] = await connection.execute("SELECT productID, quantity FROM order_product WHERE orderID = ?", [orderID]);
            for (const item of prodItems) {
              const [pRes] = await connection.execute(
                "SELECT productCategoryID FROM products WHERE productID = ?",
                [item.productID]
              );
              if (pRes.length > 0 && pRes[0].productCategoryID === 3) {
                continue;
              }

              const [batches] = await connection.execute(
                "SELECT batchID FROM inventory_batch WHERE itemType = 'Product' AND itemID = ? ORDER BY dateReceived DESC LIMIT 1",
                [item.productID]
              );
              let batchID = null;
              if (batches.length > 0) {
                batchID = batches[0].batchID;
                await connection.execute(
                  "UPDATE inventory_batch SET remainingQuantity = remainingQuantity + ? WHERE batchID = ?",
                  [item.quantity, batchID]
                );
              }

              await connection.execute(
                `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks, batchID)
                 VALUES ('Product', ?, ?, ?, 'Return', ?, 'Order canceled - Stock refunded', ?)`,
                [item.productID, item.quantity, session.userID, `ORD-${orderID}`, batchID]
              );

              await connection.execute(
                `UPDATE borrow_transaction 
                 SET status = 'Returned', actualReturnDate = ?, remarks = 'Order canceled - Auto-returned' 
                 WHERE itemType = 'Product' AND itemID = ? AND remarks LIKE ? AND status = 'Borrowed'`,
                [nowStr, item.productID, `%ORD-${orderID}%`]
              );

              await connection.execute("UPDATE products SET quantity = quantity + ? WHERE productID = ?", [item.quantity, item.productID]);
            }

            // Restore amenities stock
            const [amenItems] = await connection.execute("SELECT amenityID, quantity FROM order_amenities WHERE orderID = ?", [orderID]);
            for (const item of amenItems) {
              const [batches] = await connection.execute(
                "SELECT batchID FROM inventory_batch WHERE itemType = 'Amenity' AND itemID = ? ORDER BY dateReceived DESC LIMIT 1",
                [item.amenityID]
              );
              let batchID = null;
              if (batches.length > 0) {
                batchID = batches[0].batchID;
                await connection.execute(
                  "UPDATE inventory_batch SET remainingQuantity = remainingQuantity + ? WHERE batchID = ?",
                  [item.quantity, batchID]
                );
              }

              await connection.execute(
                `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks, batchID)
                 VALUES ('Amenity', ?, ?, ?, 'Return', ?, 'Order canceled - Stock refunded', ?)`,
                [item.amenityID, item.quantity, session.userID, `ORD-${orderID}`, batchID]
              );

              await connection.execute(
                `UPDATE borrow_transaction 
                 SET status = 'Returned', actualReturnDate = ?, remarks = 'Order canceled - Auto-returned' 
                 WHERE itemType = 'Amenity' AND itemID = ? AND remarks LIKE ? AND status = 'Borrowed'`,
                [nowStr, item.amenityID, `%ORD-${orderID}%`]
              );

              await connection.execute("UPDATE amenities SET quantity = quantity + ? WHERE amenityID = ?", [item.quantity, item.amenityID]);
            }
          }
        }

        await connection.execute("UPDATE orders SET orderStatus = ? WHERE orderID = ?", [newStatus, orderID]);
        await connection.execute("UPDATE order_product SET itemStatus = ? WHERE orderID = ?", [newStatus, orderID]).catch(() => {});
        await connection.execute("UPDATE order_amenities SET itemStatus = ? WHERE orderID = ?", [newStatus, orderID]).catch(() => {});

        await connection.commit();
        await syncInventoryStock();
        return NextResponse.json({ success: true, message: `Order status updated to ${newStatus}.` });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    if (action === 'return_borrow') {
      const { borrowID, quantityReturned, status, remarks } = body;
      const qtyRet = parseInt(quantityReturned);

      const [borrow] = await dbQuery("SELECT * FROM borrow_transaction WHERE borrowID = ?", [parseInt(borrowID)]);
      if (!borrow) {
        return NextResponse.json({ error: 'Borrow transaction not found.' }, { status: 404 });
      }
      if (borrow.status !== 'Borrowed') {
        return NextResponse.json({ error: 'This item has already been processed.' }, { status: 400 });
      }
      if (qtyRet <= 0 || qtyRet > borrow.quantity) {
        return NextResponse.json({ error: 'Invalid quantity returned.' }, { status: 400 });
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        const isPartial = qtyRet < borrow.quantity;
        const newStatus = isPartial ? 'Borrowed' : status; 
        const updatedRemarks = isPartial 
          ? `${borrow.remarks || ''} (Partially returned ${qtyRet} units)` 
          : remarks || borrow.remarks;

        if (isPartial) {
          await connection.execute(
            `UPDATE borrow_transaction 
             SET quantity = quantity - ?, remarks = ? 
             WHERE borrowID = ?`,
            [qtyRet, updatedRemarks, borrow.borrowID]
          );
          
          await connection.execute(
            `INSERT INTO borrow_transaction (itemType, itemID, quantity, borrowedBy, bookingID, roomID, status, conditionUponReturn, actualReturnDate, userID, remarks)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [borrow.itemType, borrow.itemID, qtyRet, borrow.borrowedBy, borrow.bookingID, borrow.roomID, status, status === 'Returned' ? 'Good' : status, nowStr, session.userID, `Partial Return - ${updatedRemarks}`]
          );
        } else {
          await connection.execute(
            `UPDATE borrow_transaction 
             SET status = ?, conditionUponReturn = ?, actualReturnDate = ?, remarks = ? 
             WHERE borrowID = ?`,
            [status, status === 'Returned' ? 'Good' : status, nowStr, updatedRemarks, borrow.borrowID]
          );
        }

        if (status === 'Returned') {
          const [batches] = await connection.execute(
            "SELECT batchID FROM inventory_batch WHERE itemType = ? AND itemID = ? ORDER BY dateReceived DESC LIMIT 1",
            [borrow.itemType, borrow.itemID]
          );
          let batchID = null;
          if (batches.length > 0) {
            batchID = batches[0].batchID;
            await connection.execute(
              "UPDATE inventory_batch SET remainingQuantity = remainingQuantity + ? WHERE batchID = ?",
              [qtyRet, batchID]
            );
          }

          await connection.execute(
            `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks, batchID)
             VALUES (?, ?, ?, ?, 'Return', ?, ?, ?)`,
            [borrow.itemType, borrow.itemID, qtyRet, session.userID, `BOR-${borrow.borrowID}`, `Returned to stock`, batchID]
          );

          if (borrow.itemType === 'Amenity') {
            await connection.execute("UPDATE amenities SET quantity = quantity + ? WHERE amenityID = ?", [qtyRet, borrow.itemID]);
          } else {
            await connection.execute("UPDATE products SET quantity = quantity + ? WHERE productID = ?", [qtyRet, borrow.itemID]);
          }
        } else {
          await connection.execute(
            `INSERT INTO inventory_disposal (batchID, itemType, itemID, quantity, reason, remarks, userID)
             VALUES (NULL, ?, ?, ?, ?, ?, ?)`,
            [
              borrow.itemType,
              borrow.itemID,
              qtyRet,
              status === 'Damaged' ? 'Damaged' : 'Lost',
              remarks || `From Borrow Transaction BOR-${borrow.borrowID}`,
              session.userID
            ]
          );

          await connection.execute(
            `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              borrow.itemType,
              borrow.itemID,
              -qtyRet,
              session.userID,
              status === 'Damaged' ? 'Damage' : 'Loss',
              `BOR-${borrow.borrowID}`,
              remarks || `From Borrow Transaction BOR-${borrow.borrowID}`
            ]
          );
        }

        await connection.commit();
        await syncInventoryStock();
        return NextResponse.json({ success: true, message: 'Return recorded successfully.' });
      } catch (e) {
        await connection.rollback();
        throw e;
      } finally {
        connection.release();
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process order action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
