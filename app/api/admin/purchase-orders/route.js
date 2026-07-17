import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncInventoryStock } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusF = searchParams.get('status') || '';
  const searchVal = searchParams.get('search') || '';
  const dateF = searchParams.get('date') || '';

  try {
    let sql = `
      SELECT po.*, COUNT(poi.orderItemID) as itemCount 
      FROM purchase_order po 
      LEFT JOIN purchase_order_items poi ON poi.purchaseOrderID = po.purchaseOrderID 
      WHERE 1=1
    `;
    const params = [];
    if (statusF) {
      if (statusF === 'Pending') {
        sql += " AND po.status IN ('Pending', 'Partially Received')";
      } else {
        sql += " AND po.status = ?";
        params.push(statusF);
      }
    }
    if (dateF) {
      sql += " AND DATE(po.orderDate) = ?";
      params.push(dateF);
    }
    if (searchVal) {
      const match = searchVal.match(/po-(\d+)/i);
      const cleanSearch = match ? match[1] : searchVal;
      const searchPattern = `%${cleanSearch}%`;
      
      sql += ` AND (
        CAST(po.purchaseOrderID AS CHAR) LIKE ? OR 
        poi.itemName LIKE ? OR 
        poi.itemType LIKE ? OR 
        po.status LIKE ? OR 
        po.remarks LIKE ?
      )`;
      params.push(searchPattern, `%${searchVal}%`, `%${searchVal}%`, `%${searchVal}%`, `%${searchVal}%`);
    }
    sql += " GROUP BY po.purchaseOrderID ORDER BY po.orderDate DESC";

    const orders = await dbQuery(sql, params);

    // Fetch items for each PO to avoid separate detail queries
    const allItems = await dbQuery("SELECT * FROM purchase_order_items");
    
    // Nest items inside each PO
    const ordersWithItems = orders.map(po => {
      const items = allItems.filter(item => item.purchaseOrderID === po.purchaseOrderID);
      const total = items.reduce((sum, item) => {
        const qty = po.status === 'Received' ? (item.quantityReceived ?? item.quantity) : item.quantity;
        return sum + (parseFloat(item.unitPrice) * parseInt(qty));
      }, 0);
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
      const { items, expectedDeliveryDate } = body; // Array of { itemName, itemType, quantity, unitPrice }
      if (!items || items.length === 0) {
        return NextResponse.json({ error: 'No items provided' }, { status: 400 });
      }

      // Duplicate protection (Module H - REQ054)
      const todayPOs = await dbQuery(`
        SELECT po.purchaseOrderID, poi.itemName, poi.itemType, poi.quantity, poi.unitPrice
        FROM purchase_order po
        JOIN purchase_order_items poi ON poi.purchaseOrderID = po.purchaseOrderID
        WHERE DATE(po.orderDate) = CURDATE() AND po.status != 'Canceled'
      `);

      const groupedToday = {};
      todayPOs.forEach(row => {
        if (!groupedToday[row.purchaseOrderID]) {
          groupedToday[row.purchaseOrderID] = [];
        }
        groupedToday[row.purchaseOrderID].push({
          itemName: row.itemName.trim(),
          itemType: row.itemType,
          quantity: parseInt(row.quantity),
          unitPrice: parseFloat(row.unitPrice)
        });
      });

      const newItems = items
        .filter(item => item.itemName && item.itemName.trim())
        .map(item => ({
          itemName: item.itemName.trim(),
          itemType: item.itemType,
          quantity: parseInt(item.quantity),
          unitPrice: parseFloat(item.unitPrice)
        }));

      const isIdentical = (arr1, arr2) => {
        if (arr1.length !== arr2.length) return false;
        const sortKey = (x) => `${x.itemName}-${x.itemType}-${x.quantity}-${x.unitPrice}`;
        const s1 = arr1.map(sortKey).sort();
        const s2 = arr2.map(sortKey).sort();
        return s1.every((val, index) => val === s2[index]);
      };

      for (const poID in groupedToday) {
        if (isIdentical(groupedToday[poID], newItems)) {
          return NextResponse.json({ error: 'Duplicate Purchase Order detected. An identical PO has already been created today.' }, { status: 400 });
        }
      }

      // Fetch logged-in user staffID
      const staffRes = await dbQuery("SELECT staffID FROM staff WHERE userID = ?", [session.userID]);
      const staffID = staffRes.length > 0 ? staffRes[0].staffID : null;

      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        // Create PO with expectedDeliveryDate (Module H - REQ049)
        const [poResult] = await conn.execute(
          "INSERT INTO purchase_order(orderDate, status, staffID, expectedDeliveryDate) VALUES(?, 'Pending', ?, ?)",
          [
            new Date().toISOString().substring(0, 10),
            staffID,
            expectedDeliveryDate || null
          ]
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
      const { poID, received, remarks } = body;
      
      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        // Fetch PO items to resolve actual names and types
        const [poItems] = await conn.execute(
          "SELECT * FROM purchase_order_items WHERE purchaseOrderID = ?",
          [parseInt(poID)]
        );

        // Validation: Ensure received quantity does not exceed remaining ordered quantity
        for (const item of poItems) {
          const itemData = received[item.orderItemID];
          if (!itemData) continue;
          const newQty = parseInt(itemData.qty || 0);
          if (newQty <= 0) continue;

          const totalReceivedSoFar = parseInt(item.quantityReceived || 0);
          if (totalReceivedSoFar + newQty > item.quantity) {
            return NextResponse.json({ 
              error: `Received quantity for "${item.itemName}" (${totalReceivedSoFar + newQty}) cannot exceed the ordered quantity of ${item.quantity}.` 
            }, { status: 400 });
          }
        }

        for (const item of poItems) {
          const itemData = received[item.orderItemID];
          if (!itemData) continue;
          const newQty = parseInt(itemData.qty || 0);
          if (newQty <= 0) continue;

          // Resolve itemID, itemType, and isConsumable
          let itemID = null;
          let isConsumable = true;
          if (item.itemType === 'Amenity') {
            const [amenityRes] = await conn.execute("SELECT amenityID, itemType FROM amenities WHERE name = ?", [item.itemName]);
            if (amenityRes.length > 0) {
              itemID = amenityRes[0].amenityID;
              isConsumable = amenityRes[0].itemType === 'Consumable';
            }
          } else {
            const [productRes] = await conn.execute("SELECT productID, itemType FROM products WHERE name = ?", [item.itemName]);
            if (productRes.length > 0) {
              itemID = productRes[0].productID;
              isConsumable = productRes[0].itemType === 'Consumable';
            }
          }

          if (!itemID) {
            return NextResponse.json({ error: `Could not link item "${item.itemName}" to the product/amenities catalog.` }, { status: 400 });
          }

          // Generate a unique batch number
          const batchNumber = `BAT-PO${poID}-I${itemID}-${Math.floor(1000 + Math.random() * 9000)}`;

          // Create inventory batch
          const expirationDate = isConsumable ? (itemData.expirationDate || null) : null;
          const unitCost = parseFloat(itemData.unitCost || item.unitPrice || 0);

          const [batchResult] = await conn.execute(
            `INSERT INTO inventory_batch (batchNumber, itemType, itemID, supplier, purchaseOrderID, quantity, remainingQuantity, dateReceived, manufacturingDate, expirationDate, unitCost, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), NULL, ?, ?, 'Active')`,
            [
              batchNumber,
              item.itemType,
              itemID,
              'N/A',
              parseInt(poID),
              newQty,
              newQty,
              expirationDate,
              unitCost
            ]
          );
          const batchID = batchResult.insertId;

          // Record delivery log
          await conn.execute(
            `INSERT INTO purchase_order_delivery (purchaseOrderID, orderItemID, quantityReceived, dateReceived, supplierReference, expirationDate, batchID)
             VALUES (?, ?, ?, CURDATE(), NULL, ?, ?)`,
            [parseInt(poID), item.orderItemID, newQty, expirationDate, batchID]
          );

          // Update purchase order item quantityReceived
          await conn.execute(
            "UPDATE purchase_order_items SET quantityReceived = quantityReceived + ? WHERE orderItemID = ?",
            [newQty, item.orderItemID]
          );

          // Insert into inventory_movement
          await conn.execute(
            `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks, batchID)
             VALUES (?, ?, ?, ?, 'Stock In', ?, ?, ?)`,
            [
              item.itemType,
              itemID,
              newQty,
              session.userID,
              `PO-${poID}`,
              remarks || `Stock-in from Purchase Order #${poID}`,
              batchID
            ]
          );

          // Update legacy quantity in product/amenities table as a fallback
          if (item.itemType === 'Amenity') {
            await conn.execute("UPDATE amenities SET quantity = quantity + ? WHERE amenityID = ?", [newQty, itemID]);
          } else {
            await conn.execute("UPDATE products SET quantity = quantity + ? WHERE productID = ?", [newQty, itemID]);
          }
        }

        // Check if PO is now fully completed or partially received
        const [updatedPoItems] = await conn.execute(
          "SELECT quantity, quantityReceived FROM purchase_order_items WHERE purchaseOrderID = ?",
          [parseInt(poID)]
        );
        const isCompleted = updatedPoItems.every(i => parseInt(i.quantityReceived) >= parseInt(i.quantity));
        const hasSomeReceived = updatedPoItems.some(i => parseInt(i.quantityReceived) > 0);

        const newStatus = isCompleted ? 'Received' : (hasSomeReceived ? 'Partially Received' : 'Pending');

        await conn.execute(
          "UPDATE purchase_order SET status = ?, remarks = ? WHERE purchaseOrderID = ?",
          [newStatus, remarks || '', parseInt(poID)]
        );

        await conn.commit();
        await syncInventoryStock();
        return NextResponse.json({ success: true, message: isCompleted ? 'Purchase order fully received and completed!' : 'Partial delivery received successfully.' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    if (action === 'generate_reorder') {
      const poID = parseInt(body.poID);

      const itemsToReorder = await dbQuery(`
        SELECT itemName, itemType, quantity, quantityReceived, unitPrice
        FROM purchase_order_items
        WHERE purchaseOrderID = ? AND quantityReceived < quantity
      `, [poID]);

      if (itemsToReorder.length === 0) {
        return NextResponse.json({ error: 'No items in this PO qualify for reorder (all quantities were fully received).' }, { status: 400 });
      }

      // Fetch logged-in user staffID
      const staffRes = await dbQuery("SELECT staffID FROM staff WHERE userID = ?", [session.userID]);
      const staffID = staffRes.length > 0 ? staffRes[0].staffID : null;

      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        // Create new PO
        const [poResult] = await conn.execute(
          "INSERT INTO purchase_order(orderDate, status, staffID) VALUES(?, 'Pending', ?)",
          [new Date().toISOString().substring(0, 10), staffID]
        );
        const newPoID = poResult.insertId;

        // Insert missing items (Module I - REQ059)
        for (const item of itemsToReorder) {
          const remainingQty = item.quantity - item.quantityReceived;
          await conn.execute(
            "INSERT INTO purchase_order_items(itemName, itemType, quantity, unitPrice, purchaseOrderID) VALUES(?, ?, ?, ?, ?)",
            [item.itemName, item.itemType, remainingQty, parseFloat(item.unitPrice), newPoID]
          );
        }

        await conn.commit();
        return NextResponse.json({ success: true, message: `Reorder request generated successfully as Purchase Order #${newPoID}.` });
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
