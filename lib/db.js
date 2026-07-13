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
    
    const pendingCheckinBookings = await dbQuery("SELECT roomID FROM booking WHERE status = 'Pending Check-in'");
    const reservedRoomIDs = new Set(pendingCheckinBookings.map(b => b.roomID));

    for (const room of rooms) {
      if (room.status === 'Under Maintenance') {
        continue;
      }
      
      let expectedStatus = 'Available';
      if (activeBookingRoomIDs.has(room.roomID)) {
        expectedStatus = 'Occupied';
      } else if (reservedRoomIDs.has(room.roomID)) {
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
    // 1. Bulk update products
    await conn.execute(`
      UPDATE products p
      LEFT JOIN (
        SELECT itemID, SUM(remainingQuantity) as totalQty
        FROM inventory_batch
        WHERE itemType = 'Product' AND status = 'Active' AND (expirationDate IS NULL OR expirationDate >= CURDATE())
        GROUP BY itemID
      ) b ON p.productID = b.itemID
      SET p.quantity = COALESCE(b.totalQty, 0)
      WHERE p.productCategoryID != 3
    `);

    // 2. Bulk update amenities
    await conn.execute(`
      UPDATE amenities a
      LEFT JOIN (
        SELECT itemID, SUM(remainingQuantity) as totalQty
        FROM inventory_batch
        WHERE itemType = 'Amenity' AND status = 'Active' AND (expirationDate IS NULL OR expirationDate >= CURDATE())
        GROUP BY itemID
      ) b ON a.amenityID = b.itemID
      SET a.quantity = COALESCE(b.totalQty, 0)
    `);

    console.log("Sync: Inventory stock quantities synchronized in bulk successfully.");
  } catch (error) {
    console.error("Failed to sync inventory stock quantities:", error);
  }
}
