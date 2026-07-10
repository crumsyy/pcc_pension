import mysql from 'mysql2/promise';

let pool;

export async function getDbConnection() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000, // 10 seconds
      // Useful for SSL connections to cloud databases like TiDB Serverless or Aiven
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

export async function dbQuery(sql, params = []) {
  const db = await getDbConnection();
  const [results] = await db.execute(sql, params);
  return results;
}

export async function syncRoomStatuses() {
  try {
    const rooms = await dbQuery("SELECT roomID, roomNumber, status FROM room WHERE isArchived = 0");
    const activeBookings = await dbQuery("SELECT roomID FROM booking WHERE status = 'Checked In'");
    const activeBookingRoomIDs = new Set(activeBookings.map(b => b.roomID));
    
    const confirmedBookings = await dbQuery("SELECT roomID FROM booking WHERE status = 'Confirmed'");
    const confirmedReservations = await dbQuery("SELECT roomID FROM reservation WHERE status = 'Confirmed'");
    const confirmedRoomIDs = new Set([
      ...confirmedBookings.map(b => b.roomID),
      ...confirmedReservations.map(r => r.roomID)
    ]);

    for (const room of rooms) {
      if (room.status === 'Under Maintenance') {
        continue;
      }
      
      let expectedStatus = 'Available';
      if (activeBookingRoomIDs.has(room.roomID)) {
        expectedStatus = 'Occupied';
      } else if (confirmedRoomIDs.has(room.roomID)) {
        expectedStatus = 'Reserved';
      }
      
      if (room.status !== expectedStatus) {
        console.log(`Sync: Room ${room.roomNumber} status changed from ${room.status} to ${expectedStatus}`);
        await dbQuery("UPDATE room SET status = ? WHERE roomID = ?", [expectedStatus, room.roomID]);
      }
    }
  } catch (error) {
    console.error("Failed to sync room statuses:", error);
  }
}

export async function syncInventoryStock() {
  try {
    const conn = await getDbConnection();
    // 1. Reset all quantities to 0 first (except Cooked Meals category ID = 3, which is unlimited/9999)
    await conn.execute("UPDATE products SET quantity = 0 WHERE productCategoryID != 3");
    await conn.execute("UPDATE amenities SET quantity = 0");

    // 2. Fetch sum of active, unexpired batches
    const [batches] = await conn.execute(`
      SELECT itemType, itemID, SUM(remainingQuantity) as totalQty
      FROM inventory_batch
      WHERE status = 'Active' AND (expirationDate IS NULL OR expirationDate >= CURDATE())
      GROUP BY itemType, itemID
    `);

    for (const row of batches) {
      const qty = parseInt(row.totalQty || 0);
      if (row.itemType === 'Product') {
        await conn.execute("UPDATE products SET quantity = ? WHERE productID = ? AND productCategoryID != 3", [qty, row.itemID]);
      } else if (row.itemType === 'Amenity') {
        await conn.execute("UPDATE amenities SET quantity = ? WHERE amenityID = ?", [qty, row.itemID]);
      }
    }
    console.log("Sync: Inventory stock quantities synchronized successfully.");
  } catch (error) {
    console.error("Failed to sync inventory stock quantities:", error);
  }
}
