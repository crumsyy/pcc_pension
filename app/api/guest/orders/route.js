import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncInventoryStock } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
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

    return NextResponse.json({
      success: true,
      products: activeProducts,
      cookedMeals,
      amenities
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
      "SELECT bookingID, roomID FROM booking WHERE guestID = ? AND status IN ('Checked In', 'Confirmed') ORDER BY checkInDateTime DESC LIMIT 1",
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

    // Validate deliveryTime for cooked meals (must be between 6:30 AM and 10:30 AM)
    if (containsCookedMeal && body.deliveryTime) {
      const allowedTimes = ['06:30 AM', '07:00 AM', '07:30 AM', '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM'];
      if (!allowedTimes.includes(body.deliveryTime)) {
        return NextResponse.json({
          error: "Breakfast delivery time must be scheduled between 6:30 AM and 10:30 AM."
        }, { status: 400 });
      }
    }

    const db = await getDbConnection();
    const connection = await db.getConnection();

    const localNow = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

    try {
      await connection.beginTransaction();

      const deliveryTime = body.deliveryTime || null;
      // Create Order
      const [orderRes] = await connection.execute(
        "INSERT INTO orders (orderDateTime, orderStatus, guestID, hasCookedMeal, deliveryTime) VALUES (?, 'Pending', ?, ?, ?)",
        [nowStr, guest.guestID, containsCookedMeal ? 1 : 0, deliveryTime]
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
