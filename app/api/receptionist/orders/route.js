import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch all orders with guest information
    const ordersRaw = await dbQuery(`
      SELECT o.*, g.firstName, g.lastName, r.roomNumber 
      FROM orders o
      JOIN guest g ON g.guestID = o.guestID
      LEFT JOIN booking b ON b.guestID = g.guestID AND b.status = 'Checked In'
      LEFT JOIN room r ON r.roomID = b.roomID
      ORDER BY o.orderDateTime DESC
    `);

    // 2. Fetch order items (products and amenities)
    const [orderProducts, orderAmenities] = await Promise.all([
      dbQuery(`
        SELECT op.orderID, op.quantity, p.productID as itemID, p.name, p.price, 'Product' as type
        FROM order_product op
        JOIN products p ON p.productID = op.productID
      `),
      dbQuery(`
        SELECT oa.orderID, oa.quantity, a.amenityID as itemID, a.name, a.price, 'Amenity' as type
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
    // Dynamic stock quantities resolved directly from active inventory batches
    const [products, amenities, activeBookings] = await Promise.all([
      dbQuery(`
        SELECT p.productID, p.name, p.price, COALESCE(SUM(ib.remainingQuantity), 0) as quantity 
        FROM products p 
        LEFT JOIN inventory_batch ib ON ib.itemType = 'Product' AND ib.itemID = p.productID AND ib.status IN ('Active', 'Low Stock', 'Expired')
        WHERE p.isArchived = 0 AND p.isAvailable = 1
        GROUP BY p.productID
        ORDER BY p.name
      `),
      dbQuery(`
        SELECT a.amenityID, a.name, a.price, COALESCE(SUM(ib.remainingQuantity), 0) as quantity 
        FROM amenities a 
        LEFT JOIN inventory_batch ib ON ib.itemType = 'Amenity' AND ib.itemID = a.amenityID AND ib.status IN ('Active', 'Low Stock', 'Expired')
        WHERE a.isArchived = 0
        GROUP BY a.amenityID
        ORDER BY a.name
      `),
      dbQuery(`
        SELECT b.bookingID, b.guestID, g.firstName, g.lastName, rm.roomNumber 
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        JOIN room rm ON rm.roomID = b.roomID
        WHERE b.status = 'Checked In'
      `)
    ]);

    return NextResponse.json({ success: true, orders, products, amenities, activeBookings });
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

  try {
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

        // 1. Create order record
        const [orderResult] = await connection.execute(
          "INSERT INTO orders (orderStatus, orderDateTime, guestID) VALUES ('Preparing', NOW(), ?)",
          [guestID]
        );
        const orderID = orderResult.insertId;

        // 2. Insert items and update stock using FIFO batches
        for (const item of items) {
          const itemID = parseInt(item.itemID);
          const quantity = parseInt(item.quantity);
          if (!itemID || quantity <= 0) continue;

          // Fetch active batches for this item (ordered by FIFO: expiration date first, then received date)
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

          // Check if item is Consumable or Non-Consumable
          let itemClassType = 'Consumable';
          if (item.type === 'Product') {
            const [pRes] = await connection.execute("SELECT itemType FROM products WHERE productID = ?", [itemID]);
            if (pRes.length > 0) itemClassType = pRes[0].itemType;
          } else {
            const [aRes] = await connection.execute("SELECT itemType FROM amenities WHERE amenityID = ?", [itemID]);
            if (aRes.length > 0) itemClassType = aRes[0].itemType;
          }

          // FIFO batch deduction
          let needed = quantity;
          for (const batch of batches) {
            if (needed <= 0) break;
            const take = Math.min(batch.remainingQuantity, needed);
            
            await connection.execute(
              "UPDATE inventory_batch SET remainingQuantity = remainingQuantity - ? WHERE batchID = ?",
              [take, batch.batchID]
            );

            // Log movement for this batch (movement type is Borrow for Non-Consumables)
            const mType = itemClassType === 'Non-Consumable' ? 'Borrow' : 'Stock Out';
            await connection.execute(
              `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks, batchID)
               VALUES (?, ?, ?, ?, ?, ?, 'Guest Order placed', ?)`,
              [item.type, itemID, -take, session.userID, mType, `ORD-${orderID}`, batch.batchID]
            );

            needed -= take;
          }

          // Register borrow transaction if it's a Non-Consumable item
          if (itemClassType === 'Non-Consumable') {
            // Find active booking for the guest to link bookingID/roomID
            const [bookingRes] = await connection.execute(
              `SELECT b.bookingID, b.roomID, g.firstName, g.lastName 
               FROM booking b 
               JOIN guest g ON g.guestID = b.guestID 
               WHERE g.guestID = ? AND b.status = 'Checked In' 
               LIMIT 1`,
              [guestID]
            );

            let bookingID = null;
            let roomID = null;
            let borrowedBy = 'Walk-in Guest';
            
            if (bookingRes.length > 0) {
              bookingID = bookingRes[0].bookingID;
              roomID = bookingRes[0].roomID;
              borrowedBy = `${bookingRes[0].firstName} ${bookingRes[0].lastName}`.trim();
            } else {
              const [guestRes] = await connection.execute("SELECT firstName, lastName FROM guest WHERE guestID = ?", [guestID]);
              if (guestRes.length > 0) {
                borrowedBy = `${guestRes[0].firstName} ${guestRes[0].lastName}`.trim();
              }
            }

            await connection.execute(
              `INSERT INTO borrow_transaction (itemType, itemID, quantity, borrowedBy, bookingID, roomID, status, userID, remarks)
               VALUES (?, ?, ?, ?, ?, ?, 'Borrowed', ?, ?)`,
              [
                item.type,
                itemID,
                quantity,
                borrowedBy,
                bookingID,
                roomID,
                session.userID,
                `Borrowed via Guest Order ORD-${orderID}`
              ]
            );
          }

          // Insert order item record
          if (item.type === 'Product') {
            await connection.execute("INSERT INTO order_product(quantity, orderID, productID) VALUES(?, ?, ?)", [quantity, orderID, itemID]);
            // Legacy fallback update
            await connection.execute("UPDATE products SET quantity = GREATEST(0, quantity - ?) WHERE productID = ?", [quantity, itemID]);
          } else {
            await connection.execute("INSERT INTO order_amenities(quantity, orderID, amenityID) VALUES(?, ?, ?)", [quantity, orderID, itemID]);
            // Legacy fallback update
            await connection.execute("UPDATE amenities SET quantity = GREATEST(0, quantity - ?) WHERE amenityID = ?", [quantity, itemID]);
          }
        }

        await connection.commit();
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

        // If canceling, restore stock
        if (newStatus === 'Canceled') {
          // Fetch current status
          const [statusRes] = await connection.execute("SELECT orderStatus FROM orders WHERE orderID = ?", [orderID]);
          if (statusRes.length > 0 && statusRes[0].orderStatus !== 'Canceled') {
            // Restore products stock
            const [prodItems] = await connection.execute("SELECT productID, quantity FROM order_product WHERE orderID = ?", [orderID]);
            for (const item of prodItems) {
              // Find latest batch to refund stock to
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

              // Log return movement
              await connection.execute(
                `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks, batchID)
                 VALUES ('Product', ?, ?, ?, 'Return', ?, 'Order canceled - Stock refunded', ?)`,
                [item.productID, item.quantity, session.userID, `ORD-${orderID}`, batchID]
              );

              // Auto-return borrow transaction if non-consumable
              await connection.execute(
                `UPDATE borrow_transaction 
                 SET status = 'Returned', actualReturnDate = NOW(), remarks = 'Order canceled - Auto-returned' 
                 WHERE itemType = 'Product' AND itemID = ? AND remarks LIKE ? AND status = 'Borrowed'`,
                [item.productID, `%ORD-${orderID}%`]
              );

              // Legacy fallback update
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

              // Log return movement
              await connection.execute(
                `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks, batchID)
                 VALUES ('Amenity', ?, ?, ?, 'Return', ?, 'Order canceled - Stock refunded', ?)`,
                [item.amenityID, item.quantity, session.userID, `ORD-${orderID}`, batchID]
              );

              // Auto-return borrow transaction if non-consumable
              await connection.execute(
                `UPDATE borrow_transaction 
                 SET status = 'Returned', actualReturnDate = NOW(), remarks = 'Order canceled - Auto-returned' 
                 WHERE itemType = 'Amenity' AND itemID = ? AND remarks LIKE ? AND status = 'Borrowed'`,
                [item.amenityID, `%ORD-${orderID}%`]
              );

              // Legacy fallback update
              await connection.execute("UPDATE amenities SET quantity = quantity + ? WHERE amenityID = ?", [item.quantity, item.amenityID]);
            }
          }
        }

        await connection.execute("UPDATE orders SET orderStatus = ? WHERE orderID = ?", [newStatus, orderID]);

        await connection.commit();
        return NextResponse.json({ success: true, message: `Order status updated to ${newStatus}.` });
      } catch (err) {
        await connection.rollback();
        throw err;
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
