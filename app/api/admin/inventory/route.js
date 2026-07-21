import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncInventoryStock } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const typeF = searchParams.get('type') || ''; // 'Consumable' | 'Non-Consumable'


  try {
    // 1. Fetch amenities and products catalog
    let sqlA = `
      SELECT 'Amenity' as sourceTable, a.amenityID as itemID, a.name, a.price, a.basePrice, a.sellingPrice, ac.name as category, a.minStock, a.itemType, a.unit, a.description
      FROM amenities a 
      JOIN amenities_category ac ON ac.amenityCategoryID = a.amenityCategoryID
      WHERE a.isArchived = 0
    `;

    let sqlP = `
      SELECT 'Product' as sourceTable, p.productID as itemID, p.name, p.price, p.basePrice, p.sellingPrice, pc.name as category, p.minStock, p.itemType, p.unit, p.description
      FROM products p 
      JOIN product_category pc ON pc.productCategoryID = p.productCategoryID
      WHERE p.isArchived = 0 AND pc.name != 'Cooked Meals'
    `;

    const amenities = await dbQuery(sqlA);
    const products = await dbQuery(sqlP);
    let allCatalog = [...amenities, ...products];

    // Sort by name
    allCatalog.sort((a, b) => a.name.localeCompare(b.name));

    // 2. Fetch all active inventory batches
    const batches = await dbQuery(`
      SELECT ib.*, COALESCE(a.name, p.name) as itemName
      FROM inventory_batch ib
      LEFT JOIN amenities a ON ib.itemType = 'Amenity' AND a.amenityID = ib.itemID
      LEFT JOIN products p ON ib.itemType = 'Product' AND p.productID = ib.itemID
      ORDER BY ib.dateReceived DESC, ib.batchID DESC
    `);

    // 3. Fetch active borrow logs
    const borrowLogs = await dbQuery(`
      SELECT bt.*, COALESCE(a.name, p.name) as itemName, r.roomNumber
      FROM borrow_transaction bt
      LEFT JOIN amenities a ON bt.itemType = 'Amenity' AND a.amenityID = bt.itemID
      LEFT JOIN products p ON bt.itemType = 'Product' AND p.productID = bt.itemID
      LEFT JOIN room r ON r.roomID = bt.roomID
      ORDER BY bt.borrowDateTime DESC
    `);

    // 4. Fetch disposals list
    const disposalLogs = await dbQuery(`
      SELECT id.*, COALESCE(a.name, p.name) as itemName, ib.batchNumber, u.email as userEmail
      FROM inventory_disposal id
      LEFT JOIN amenities a ON id.itemType = 'Amenity' AND a.amenityID = id.itemID
      LEFT JOIN products p ON id.itemType = 'Product' AND p.productID = id.itemID
      LEFT JOIN inventory_batch ib ON ib.batchID = id.batchID
      LEFT JOIN user u ON u.userID = id.userID
      ORDER BY id.disposalDateTime DESC
    `);

    // 5. Fetch recent stock movements
    const movements = await dbQuery(`
      SELECT im.*, COALESCE(a.name, p.name) as itemName, ib.batchNumber, u.email as userEmail
      FROM inventory_movement im
      LEFT JOIN amenities a ON im.itemType = 'Amenity' AND a.amenityID = im.itemID
      LEFT JOIN products p ON im.itemType = 'Product' AND p.productID = im.itemID
      LEFT JOIN inventory_batch ib ON ib.batchID = im.batchID
      LEFT JOIN user u ON u.userID = im.userID
      ORDER BY im.movementDateTime DESC, im.movementID DESC
      LIMIT 100
    `);

    // Compute local PHT todayStr
    const localNow = new Date();
    const offset = 8 * 60; // PHT offset is +480 minutes
    const localTime = new Date(localNow.getTime() + (offset + localNow.getTimezoneOffset()) * 60 * 1000);
    const todayStr = localTime.toISOString().substring(0, 10);

    const getFormatDate = (d) => {
      if (!d) return '';
      try {
        return new Date(d).toISOString().substring(0, 10);
      } catch (e) {
        return '';
      }
    };

    // 6. Compute dynamic stock quantities per catalog item
    const itemsWithStock = allCatalog.map(item => {
      // Find batches for this item
      const itemBatches = batches.filter(b => b.itemType === item.sourceTable && b.itemID === item.itemID);
      const totalQuantity = itemBatches.reduce((sum, b) => sum + b.quantity, 0);
      
      // EXCLUDE expired batches from available (usable) stock
      const usableQuantity = itemBatches
        .filter(b => !b.expirationDate || getFormatDate(b.expirationDate) >= todayStr)
        .reduce((sum, b) => sum + b.remainingQuantity, 0);

      // Borrowed quantity
      const itemBorrows = borrowLogs.filter(b => b.itemType === item.sourceTable && b.itemID === item.itemID && b.status === 'Borrowed');
      const borrowedQty = itemBorrows.reduce((sum, b) => sum + b.quantity, 0);

      // Disposed quantity
      const itemDisposals = disposalLogs.filter(d => d.itemType === item.sourceTable && d.itemID === item.itemID);
      const disposedQty = itemDisposals.reduce((sum, d) => sum + d.quantity, 0);

      // Dynamic stock breakdown
      return {
        ...item,
        totalQty: totalQuantity,
        availableQty: usableQuantity,
        borrowedQty: item.itemType === 'Non-Consumable' ? borrowedQty : 0,
        disposedQty,
        batches: itemBatches
      };
    });

    // 7. Compute overall Dashboard KPIs (count per item, not per unit, for items with stock available)
    const totalConsumables = itemsWithStock.filter(i => i.itemType === 'Consumable' && i.availableQty > 0).length;
    const totalNonConsumables = itemsWithStock.filter(i => i.itemType === 'Non-Consumable' && i.availableQty > 0).length;
    const totalStock = itemsWithStock.filter(i => i.availableQty > 0).length;

    const lowStockCount = itemsWithStock.filter(i => i.availableQty <= i.minStock).length;

    const expiredCount = batches.filter(b => b.expirationDate && getFormatDate(b.expirationDate) < todayStr && b.remainingQuantity > 0).length;

    const totalDisposed = disposalLogs.reduce((sum, d) => sum + d.quantity, 0);
    const totalBorrowed = borrowLogs.filter(b => b.status === 'Borrowed').reduce((sum, b) => sum + b.quantity, 0);
    const totalDamaged = disposalLogs.filter(d => d.reason === 'Damaged').reduce((sum, d) => sum + d.quantity, 0);
    const totalLost = disposalLogs.filter(d => d.reason === 'Lost').reduce((sum, d) => sum + d.quantity, 0);

    // Near expiration (within 30 days)
    const thirtyDaysLater = new Date(localTime);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const thirtyDaysLaterStr = thirtyDaysLater.toISOString().substring(0, 10);
    const nearExpirationCount = batches.filter(b => b.expirationDate && getFormatDate(b.expirationDate) >= todayStr && getFormatDate(b.expirationDate) <= thirtyDaysLaterStr && b.remainingQuantity > 0).length;

    const stats = {
      totalConsumables,
      totalNonConsumables,
      totalStock,
      lowStockCount,
      expiredCount,
      totalDisposed,
      totalBorrowed,
      totalDamaged,
      totalLost,
      nearExpirationCount
    };

    return NextResponse.json({
      items: itemsWithStock,
      batches,
      borrowLogs,
      disposalLogs,
      movements,
      stats
    });
  } catch (error) {
    console.error("Failed to fetch inventory data:", error);
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

    if (action === 'dispose') {
      const { batchID, itemType, itemID, quantity, reason, remarks } = body;
      const qty = parseInt(quantity);
      if (qty <= 0) {
        return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
      }

      // Check batch if consumable
      let batch = null;
      if (batchID) {
        const batchRes = await dbQuery("SELECT * FROM inventory_batch WHERE batchID = ?", [parseInt(batchID)]);
        if (batchRes.length === 0) {
          return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
        }
        batch = batchRes[0];
        if (batch.remainingQuantity < qty) {
          return NextResponse.json({ error: `Cannot dispose ${qty} units. Batch only has ${batch.remainingQuantity} remaining.` }, { status: 400 });
        }
      }

      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        if (batchID) {
          const newRemaining = batch.remainingQuantity - qty;
          const newStatus = newRemaining === 0 ? 'Disposed' : batch.status;
          await conn.execute(
            "UPDATE inventory_batch SET remainingQuantity = ?, status = ? WHERE batchID = ?",
            [newRemaining, newStatus, batch.batchID]
          );
        }

        // Insert disposal log
        await conn.execute(
          `INSERT INTO inventory_disposal (batchID, itemType, itemID, quantity, reason, remarks, userID)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [batchID || null, itemType, parseInt(itemID), qty, reason, remarks || '', session.userID]
        );

        // Insert movement log
        await conn.execute(
          `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks, batchID)
           VALUES (?, ?, ?, ?, 'Disposal', ?, ?, ?)`,
          [itemType, parseInt(itemID), -qty, session.userID, batchID ? `BAT-${batchID}` : 'MANUAL', remarks || `Disposal due to ${reason}`, batchID || null]
        );

        // Also update legacy quantity in catalog as a fallback
        if (itemType === 'Amenity') {
          await conn.execute("UPDATE amenities SET quantity = GREATEST(0, quantity - ?) WHERE amenityID = ?", [qty, parseInt(itemID)]);
        } else {
          await conn.execute("UPDATE products SET quantity = GREATEST(0, quantity - ?) WHERE productID = ?", [qty, parseInt(itemID)]);
        }

        await conn.commit();
        await syncInventoryStock();
        return NextResponse.json({ success: true, message: 'Inventory disposal recorded successfully.' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    if (action === 'stock_out') {
      const { batchID, itemType, itemID, quantity, reason, remarks } = body;
      const qty = parseInt(quantity);
      if (qty <= 0) {
        return NextResponse.json({ error: 'Quantity must be greater than zero.' }, { status: 400 });
      }

      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        if (batchID) {
          const [batchRes] = await conn.execute("SELECT * FROM inventory_batch WHERE batchID = ?", [parseInt(batchID)]);
          if (batchRes.length === 0) {
            return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
          }
          const batch = batchRes[0];
          if (batch.remainingQuantity < qty) {
            return NextResponse.json({ error: `Insufficient stock in batch. Available: ${batch.remainingQuantity}, Requested: ${qty}` }, { status: 400 });
          }

          const newRemaining = batch.remainingQuantity - qty;
          const newStatus = newRemaining === 0 ? 'Consumed' : batch.status;
          await conn.execute(
            "UPDATE inventory_batch SET remainingQuantity = ?, status = ? WHERE batchID = ?",
            [newRemaining, newStatus, batch.batchID]
          );

          await conn.execute(
            `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks, batchID)
             VALUES (?, ?, ?, ?, 'Stock Out', 'MANUAL', ?, ?)`,
            [itemType, parseInt(itemID), -qty, session.userID, remarks || `Manual Stock Out: ${reason}`, batch.batchID]
          );
        } else {
          const [batches] = await conn.execute(
            `SELECT * FROM inventory_batch 
             WHERE itemType = ? AND itemID = ? AND remainingQuantity > 0 
             ORDER BY COALESCE(expirationDate, '9999-12-31') ASC, dateReceived ASC`,
            [itemType, parseInt(itemID)]
          );

          const totalAvailable = batches.reduce((sum, b) => sum + b.remainingQuantity, 0);
          if (totalAvailable < qty) {
            return NextResponse.json({ error: `Insufficient stock available. Available: ${totalAvailable}, Requested: ${qty}` }, { status: 400 });
          }

          let needed = qty;
          for (const batch of batches) {
            if (needed <= 0) break;
            const take = Math.min(batch.remainingQuantity, needed);
            
            const newRemaining = batch.remainingQuantity - take;
            const newStatus = newRemaining === 0 ? 'Consumed' : batch.status;
            await conn.execute(
              "UPDATE inventory_batch SET remainingQuantity = ?, status = ? WHERE batchID = ?",
              [newRemaining, newStatus, batch.batchID]
            );

            await conn.execute(
              `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks, batchID)
               VALUES (?, ?, ?, ?, 'Stock Out', 'MANUAL', ?, ?)`,
              [itemType, parseInt(itemID), -take, session.userID, remarks || `Manual Stock Out: ${reason}`, batch.batchID]
            );

            needed -= take;
          }
        }

        if (itemType === 'Amenity') {
          await conn.execute("UPDATE amenities SET quantity = GREATEST(0, quantity - ?) WHERE amenityID = ?", [qty, parseInt(itemID)]);
        } else {
          await conn.execute("UPDATE products SET quantity = GREATEST(0, quantity - ?) WHERE productID = ?", [qty, parseInt(itemID)]);
        }

        await conn.commit();
        await syncInventoryStock();
        return NextResponse.json({ success: true, message: 'Stock out movement recorded successfully.' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    if (action === 'borrow') {
      const { itemType, itemID, quantity, borrowedBy, bookingID, roomID, expectedReturnDate, remarks } = body;
      const qty = parseInt(quantity);
      if (qty <= 0) {
        return NextResponse.json({ error: 'Quantity must be greater than zero.' }, { status: 400 });
      }

      // Check total available stock for this non-consumable
      const batches = await dbQuery(
        "SELECT * FROM inventory_batch WHERE itemType = ? AND itemID = ? AND remainingQuantity > 0 ORDER BY dateReceived ASC",
        [itemType, parseInt(itemID)]
      );
      const totalAvailable = batches.reduce((sum, b) => sum + b.remainingQuantity, 0);
      if (totalAvailable < qty) {
        return NextResponse.json({ error: `Not enough stock available. Requested: ${qty}, Available: ${totalAvailable}` }, { status: 400 });
      }

      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        // FIFO batch consumption
        let needed = qty;
        for (const batch of batches) {
          if (needed <= 0) break;
          const take = Math.min(batch.remainingQuantity, needed);
          await conn.execute(
            "UPDATE inventory_batch SET remainingQuantity = remainingQuantity - ? WHERE batchID = ?",
            [take, batch.batchID]
          );
          needed -= take;
        }

        // Insert borrow transaction
        const [borrowResult] = await conn.execute(
          `INSERT INTO borrow_transaction (itemType, itemID, quantity, borrowedBy, bookingID, roomID, expectedReturnDate, status, remarks, userID)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Borrowed', ?, ?)`,
          [
            itemType,
            parseInt(itemID),
            qty,
            borrowedBy.trim(),
            bookingID ? parseInt(bookingID) : null,
            roomID ? parseInt(roomID) : null,
            expectedReturnDate || null,
            remarks || '',
            session.userID
          ]
        );
        const borrowID = borrowResult.insertId;

        // Log movement
        await conn.execute(
          `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks)
           VALUES (?, ?, ?, ?, 'Borrow', ?, ?)`,
          [itemType, parseInt(itemID), -qty, session.userID, `BOR-${borrowID}`, `Borrowed by ${borrowedBy}`]
        );

        // Also update legacy quantity in catalog as a fallback
        if (itemType === 'Amenity') {
          await conn.execute("UPDATE amenities SET quantity = GREATEST(0, quantity - ?) WHERE amenityID = ?", [qty, parseInt(itemID)]);
        } else {
          await conn.execute("UPDATE products SET quantity = GREATEST(0, quantity - ?) WHERE productID = ?", [qty, parseInt(itemID)]);
        }

        await conn.commit();
        await syncInventoryStock();
        return NextResponse.json({ success: true, message: `Borrow transaction registered as BOR-${borrowID}.` });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    if (action === 'return') {
      const { borrowID, quantityReturned, conditionUponReturn, status, remarks } = body;
      const qtyRet = parseInt(quantityReturned);
      
      const borrowRes = await dbQuery("SELECT * FROM borrow_transaction WHERE borrowID = ?", [parseInt(borrowID)]);
      if (borrowRes.length === 0) {
        return NextResponse.json({ error: 'Borrow transaction not found' }, { status: 404 });
      }
      const borrow = borrowRes[0];
      if (qtyRet <= 0 || qtyRet > borrow.quantity) {
        return NextResponse.json({ error: `Invalid return quantity. Must be between 1 and ${borrow.quantity}.` }, { status: 400 });
      }

      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        // Update borrow transaction status
        const isFullReturn = qtyRet === borrow.quantity;
        const newStatus = isFullReturn ? status : 'Partially Returned';
        
        const localNow = new Date();
        const pad = (num) => String(num).padStart(2, '0');
        const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

        await conn.execute(
          `UPDATE borrow_transaction 
           SET actualReturnDate = ?, status = ?, conditionUponReturn = ?, remarks = CONCAT(remarks, '\\n', ?)
           WHERE borrowID = ?`,
          [nowStr, newStatus, conditionUponReturn || '', remarks || '', borrow.borrowID]
        );

        // Log return movement
        await conn.execute(
          `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks)
           VALUES (?, ?, ?, ?, 'Return', ?, ?)`,
          [
            borrow.itemType,
            borrow.itemID,
            qtyRet,
            session.userID,
            `BOR-${borrow.borrowID}`,
            `Returned by borrower (Condition: ${conditionUponReturn})`
          ]
        );

        if (status === 'Returned') {
          // Add back to inventory batches
          const [batches] = await conn.execute(
            "SELECT batchID FROM inventory_batch WHERE itemType = ? AND itemID = ? ORDER BY dateReceived DESC LIMIT 1",
            [borrow.itemType, borrow.itemID]
          );
          if (batches.length > 0) {
            await conn.execute(
              "UPDATE inventory_batch SET remainingQuantity = remainingQuantity + ? WHERE batchID = ?",
              [qtyRet, batches[0].batchID]
            );
          }
          
          // Also update legacy quantity in catalog as a fallback
          if (borrow.itemType === 'Amenity') {
            await conn.execute("UPDATE amenities SET quantity = quantity + ? WHERE amenityID = ?", [qtyRet, borrow.itemID]);
          } else {
            await conn.execute("UPDATE products SET quantity = quantity + ? WHERE productID = ?", [qtyRet, borrow.itemID]);
          }
        } else {
          // If status is 'Damaged' or 'Lost', register it as disposal permanently!
          await conn.execute(
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

          await conn.execute(
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

        await conn.commit();
        await syncInventoryStock();
        return NextResponse.json({ success: true, message: 'Return recorded successfully.' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    if (action === 'update_expiry') {
      const { batchID, expirationDate } = body;
      const cleanDate = expirationDate ? expirationDate : null;

      await dbQuery(
        "UPDATE inventory_batch SET expirationDate = ? WHERE batchID = ?",
        [cleanDate, parseInt(batchID)]
      );

      if (cleanDate) {
        const isExpired = new Date(cleanDate) < new Date();
        const newStatus = isExpired ? 'Expired' : 'Active';
        await dbQuery(
          "UPDATE inventory_batch SET status = ? WHERE batchID = ? AND remainingQuantity > 0 AND status != 'Disposed'",
          [newStatus, parseInt(batchID)]
        );
      } else {
        await dbQuery(
          "UPDATE inventory_batch SET status = 'Active' WHERE batchID = ? AND remainingQuantity > 0 AND status != 'Disposed'",
          [parseInt(batchID)]
        );
      }

      await syncInventoryStock();
      return NextResponse.json({ success: true, message: 'Batch expiration date updated successfully.' });
    }

    if (action === 'update_min_stock') {
      const { itemType, itemID, minStock } = body;
      const cleanMinStock = parseInt(minStock);
      if (isNaN(cleanMinStock) || cleanMinStock < 0) {
        return NextResponse.json({ error: 'Minimum Stock Level must be a non-negative number.' }, { status: 400 });
      }

      if (itemType === 'Product') {
        await dbQuery("UPDATE products SET minStock = ? WHERE productID = ?", [cleanMinStock, parseInt(itemID)]);
      } else if (itemType === 'Amenity') {
        await dbQuery("UPDATE amenities SET minStock = ? WHERE amenityID = ?", [cleanMinStock, parseInt(itemID)]);
      } else {
        return NextResponse.json({ error: 'Invalid item category.' }, { status: 400 });
      }

      await syncInventoryStock();
      return NextResponse.json({ success: true, message: 'Minimum stock level updated successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process inventory action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
