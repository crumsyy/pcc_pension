import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusF = searchParams.get('status') || '';

  try {
    let sql = `
      SELECT po.*, COUNT(poi.orderItemID) as itemCount 
      FROM purchase_order po 
      LEFT JOIN purchase_order_items poi ON poi.purchaseOrderID = po.purchaseOrderID 
      WHERE 1=1
    `;
    const params = [];
    if (statusF) {
      sql += " AND po.status = ?";
      params.push(statusF);
    }
    sql += " GROUP BY po.purchaseOrderID ORDER BY po.orderDate DESC";

    const orders = await dbQuery(sql, params);

    // Fetch items for each PO to avoid separate detail queries
    const allItems = await dbQuery("SELECT * FROM purchase_order_items");
    
    // Nest items inside each PO
    const ordersWithItems = orders.map(po => {
      const items = allItems.filter(item => item.purchaseOrderID === po.purchaseOrderID);
      const total = items.reduce((sum, item) => sum + (parseFloat(item.unitPrice) * parseInt(item.quantity)), 0);
      return {
        ...po,
        items,
        total
      };
    });

    return NextResponse.json({ orders: ordersWithItems });
  } catch (error) {
    console.error("Failed to fetch purchase orders:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    const pool = await getDbConnection();

    if (action === 'create_po') {
      const { items } = body; // Array of { itemName, itemType, quantity, unitPrice }
      if (!items || items.length === 0) {
        return NextResponse.json({ error: 'No items provided' }, { status: 400 });
      }

      // Fetch logged-in user staffID
      const staffRes = await dbQuery("SELECT staffID FROM staff WHERE userID = ?", [session.userID]);
      const staffID = staffRes.length > 0 ? staffRes[0].staffID : null;

      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        // Create PO
        const [poResult] = await conn.execute(
          "INSERT INTO purchase_order(orderDate, status, staffID) VALUES(?, 'Pending', ?)",
          [new Date().toISOString().substring(0, 10), staffID]
        );
        const poID = poResult.insertId;

        // Insert items
        for (const item of items) {
          if (!item.itemName || !item.itemName.trim()) continue;
          await conn.execute(
            "INSERT INTO purchase_order_items(itemName, itemType, quantity, unitPrice, purchaseOrderID) VALUES(?, ?, ?, ?, ?)",
            [item.itemName.trim(), item.itemType, parseInt(item.quantity), parseFloat(item.unitPrice), poID]
          );
        }

        await conn.commit();
        return NextResponse.json({ success: true, message: `Purchase Order #${poID} created successfully.` });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    if (action === 'update_status') {
      const { poID, status } = body;
      await dbQuery("UPDATE purchase_order SET status = ? WHERE purchaseOrderID = ?", [status, parseInt(poID)]);
      return NextResponse.json({ success: true, message: `Purchase Order status updated to ${status}.` });
    }

    if (action === 'stock_in') {
      const { poID, received } = body; // received: object of { [orderItemID]: quantity }
      
      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        // Fetch PO items to resolve actual names and types
        const [poItems] = await conn.execute(
          "SELECT * FROM purchase_order_items WHERE purchaseOrderID = ?",
          [parseInt(poID)]
        );

        for (const item of poItems) {
          const qty = parseInt(received[item.orderItemID] || 0);
          if (qty <= 0) continue;

          // Find correct ID by name match (Self-healing bug fix)
          if (item.itemType === 'Amenity') {
            const [amenityRes] = await conn.execute(
              "SELECT amenityID FROM amenities WHERE name = ?",
              [item.itemName]
            );
            if (amenityRes.length > 0) {
              const amenityID = amenityRes[0].amenityID;
              // Add to inventory movement
              await conn.execute(
                "INSERT INTO inventory(stockInDate, quantityReceived, purchaseOrderID, amenityID, productID) VALUES(?, ?, ?, ?, NULL)",
                [new Date().toISOString().substring(0, 10), qty, parseInt(poID), amenityID]
              );
              // Update amenities stock
              await conn.execute(
                "UPDATE amenities SET quantity = quantity + ? WHERE amenityID = ?",
                [qty, amenityID]
              );
            }
          } else {
            const [productRes] = await conn.execute(
              "SELECT productID FROM products WHERE name = ?",
              [item.itemName]
            );
            if (productRes.length > 0) {
              const productID = productRes[0].productID;
              // Add to inventory movement
              await conn.execute(
                "INSERT INTO inventory(stockInDate, quantityReceived, purchaseOrderID, amenityID, productID) VALUES(?, ?, ?, NULL, ?)",
                [new Date().toISOString().substring(0, 10), qty, parseInt(poID), productID]
              );
              // Update products stock
              await conn.execute(
                "UPDATE products SET quantity = quantity + ? WHERE productID = ?",
                [qty, productID]
              );
            }
          }
        }

        // Set status to Completed
        await conn.execute(
          "UPDATE purchase_order SET status = 'Completed' WHERE purchaseOrderID = ?",
          [parseInt(poID)]
        );

        await conn.commit();
        return NextResponse.json({ success: true, message: 'Stock-in recorded and inventory updated successfully.' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process purchase order action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
