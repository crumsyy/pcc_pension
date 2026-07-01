import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch orders with guest and room info
    const ordersRaw = await dbQuery(`
      SELECT o.orderID, o.orderStatus, o.orderDateTime, o.guestID,
             g.firstName, g.lastName, g.contact,
             rm.roomNumber
      FROM orders o
      JOIN guest g ON g.guestID = o.guestID
      LEFT JOIN booking b ON b.guestID = g.guestID AND b.status = 'Checked In'
      LEFT JOIN room rm ON rm.roomID = b.roomID
      ORDER BY o.orderDateTime DESC
    `);

    // 2. Fetch order items for each order
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
    const [products, amenities, activeBookings] = await Promise.all([
      dbQuery("SELECT productID, name, price, quantity FROM products WHERE isArchived = 0 AND isAvailable = 1 ORDER BY name"),
      dbQuery("SELECT amenityID, name, price, quantity FROM amenities WHERE isArchived = 0 ORDER BY name"),
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
          "INSERT INTO orders (orderStatus, orderDateTime, guestID) VALUES ('Pending', NOW(), ?)",
          [guestID]
        );
        const orderID = orderResult.insertId;

        // 2. Insert items and update stock
        for (const item of items) {
          const itemID = parseInt(item.itemID);
          const quantity = parseInt(item.quantity);
          if (!itemID || quantity <= 0) continue;

          if (item.type === 'Product') {
            // Check stock first
            const [prodRes] = await connection.execute("SELECT quantity, name FROM products WHERE productID = ?", [itemID]);
            if (prodRes.length === 0 || prodRes[0].quantity < quantity) {
              throw new Error(`Insufficient stock for product: ${prodRes[0]?.name || 'Unknown'}`);
            }
            // Insert
            await connection.execute("INSERT INTO order_product(quantity, orderID, productID) VALUES(?, ?, ?)", [quantity, orderID, itemID]);
            // Decrement stock
            await connection.execute("UPDATE products SET quantity = quantity - ? WHERE productID = ?", [quantity, itemID]);
          } else if (item.type === 'Amenity') {
            // Check stock first
            const [amenRes] = await connection.execute("SELECT quantity, name FROM amenities WHERE amenityID = ?", [itemID]);
            if (amenRes.length === 0 || amenRes[0].quantity < quantity) {
              throw new Error(`Insufficient stock for amenity: ${amenRes[0]?.name || 'Unknown'}`);
            }
            // Insert
            await connection.execute("INSERT INTO order_amenities(quantity, orderID, amenityID) VALUES(?, ?, ?)", [quantity, orderID, itemID]);
            // Decrement stock
            await connection.execute("UPDATE amenities SET quantity = quantity - ? WHERE amenityID = ?", [quantity, itemID]);
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
              await connection.execute("UPDATE products SET quantity = quantity + ? WHERE productID = ?", [item.quantity, item.productID]);
            }
            // Restore amenities stock
            const [amenItems] = await connection.execute("SELECT amenityID, quantity FROM order_amenities WHERE orderID = ?", [orderID]);
            for (const item of amenItems) {
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
