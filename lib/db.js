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
      connectTimeout: 5000, // 5 seconds connect timeout
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
    const conn = await getDbConnection();
    await conn.execute(`
      UPDATE room r
      LEFT JOIN (
        SELECT roomID, 
               CASE 
                 WHEN SUM(CASE WHEN status = 'Checked In' THEN 1 ELSE 0 END) > 0 THEN 'Occupied'
                 WHEN SUM(CASE WHEN status = 'Pending Check-in' THEN 1 ELSE 0 END) > 0 THEN 'Reserved'
                 ELSE 'Available'
               END as calcStatus
        FROM booking
        WHERE status IN ('Checked In', 'Pending Check-in')
        GROUP BY roomID
      ) b ON r.roomID = b.roomID
      SET r.status = COALESCE(b.calcStatus, 'Available')
      WHERE r.isArchived = 0 AND r.status != 'Under Maintenance' AND r.status != COALESCE(b.calcStatus, 'Available')
    `);
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

export async function ensureInquirySchema() {
  try {
    const conn = await getDbConnection();
    // 1. Add contactNumber column to inquiry if missing
    const [inqCols] = await conn.execute("SHOW COLUMNS FROM inquiry LIKE 'contactNumber'");
    if (inqCols.length === 0) {
      await conn.execute("ALTER TABLE inquiry ADD COLUMN contactNumber VARCHAR(50) NULL AFTER email");
    }

    // 1b. Add deliveryTime column to orders if missing
    const [delCols] = await conn.execute("SHOW COLUMNS FROM orders LIKE 'deliveryTime'");
    if (delCols.length === 0) {
      await conn.execute("ALTER TABLE orders ADD COLUMN deliveryTime VARCHAR(50) NULL AFTER orderStatus");
    }

    // 2. Add unreadGuest and unreadReceptionist columns if missing
    const [unreadG] = await conn.execute("SHOW COLUMNS FROM inquiry LIKE 'unreadGuest'");
    if (unreadG.length === 0) {
      await conn.execute("ALTER TABLE inquiry ADD COLUMN unreadGuest INT DEFAULT 0, ADD COLUMN unreadReceptionist INT DEFAULT 0");
    }

    // 3. Modify status column to support 'Pending', 'Responded', 'Closed'
    await conn.execute("ALTER TABLE inquiry MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Pending'");

    // 4. Create inquiry_message table if not exists
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS inquiry_message (
        messageID INT AUTO_INCREMENT PRIMARY KEY,
        inquiryID INT NOT NULL,
        senderType ENUM('Guest', 'Receptionist', 'System') NOT NULL,
        senderName VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        isRead TINYINT(1) DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (inquiryID)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Migrate legacy message/response in inquiry table to inquiry_message table if inquiry_message is empty
    const [msgCheck] = await conn.execute("SELECT messageID FROM inquiry_message LIMIT 1");
    if (msgCheck.length === 0) {
      const [existingInquiries] = await conn.execute("SELECT inquiryID, name, message, response, createdAt FROM inquiry");
      for (const inq of existingInquiries) {
        if (inq.message) {
          await conn.execute(
            "INSERT INTO inquiry_message (inquiryID, senderType, senderName, message, isRead, timestamp) VALUES (?, 'Guest', ?, ?, 1, ?)",
            [inq.inquiryID, inq.name || 'Guest', inq.message, inq.createdAt]
          );
        }
        if (inq.response) {
          await conn.execute(
            "INSERT INTO inquiry_message (inquiryID, senderType, senderName, message, isRead, timestamp) VALUES (?, 'Receptionist', 'Front Desk', ?, 1, ?)",
            [inq.inquiryID, inq.response, inq.createdAt]
          );
        }
      }
    }
  } catch (error) {
    console.error("Failed to ensure inquiry schema:", error);
  }
}

export async function getBookingBalance(bookingID) {
  try {
    const bookingRes = await dbQuery(`
      SELECT b.bookingID, DATE_FORMAT(b.checkInDateTime, '%Y-%m-%d %H:%i:%s') as checkInDateTime, DATE_FORMAT(b.checkOutDateTime, '%Y-%m-%d %H:%i:%s') as checkOutDateTime, b.status, b.guestID, b.roomID,
             rm.roomNumber, rm.floorID, rm.occupancyLimit, rt.type as roomType, rt.roomTypeID,
             g.firstName, g.lastName
      FROM booking b
      JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE b.bookingID = ?
    `, [bookingID]);

    if (bookingRes.length === 0) return 0;
    const booking = bookingRes[0];

    const rateRes = await dbQuery(
      "SELECT rate FROM room_rate WHERE roomTypeID = ? AND floorID = ? AND breakfastID = 1",
      [booking.roomTypeID, booking.floorID]
    );
    const rate = rateRes[0]?.rate || 0;

    const checkIn = new Date(booking.checkInDateTime);
    const checkOut = new Date(booking.checkOutDateTime);
    const diffTime = Math.abs(checkOut - checkIn);
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const roomCharge = rate * nights;

    const guestsList = await dbQuery(`
      SELECT bg.*, 
             COALESCE(d.percentage, p.percentage) as discountPercentage
      FROM booking_guest_details bg
      LEFT JOIN discounts d ON d.discountID = bg.discountID
      LEFT JOIN promotions p ON p.promotionID = bg.promotionID
      WHERE bg.bookingID = ?
    `, [bookingID]);

    let finalGuestsList = [...guestsList];
    if (finalGuestsList.length === 0) {
      finalGuestsList = [{ discountPercentage: 0 }];
    }

    const totalGuestsCount = finalGuestsList.length;
    const maxOccupancy = parseInt(booking.occupancyLimit) || 2;
    const extraGuests = Math.max(0, totalGuestsCount - maxOccupancy);
    const extraGuestFee = extraGuests * 200 * nights;

    const sharePerGuest = roomCharge / totalGuestsCount;
    
    let totalDiscount = 0;
    for (const g of finalGuestsList) {
      const discountPercentage = g.discountPercentage ? parseInt(g.discountPercentage) : 0;
      totalDiscount += sharePerGuest * (discountPercentage / 100);
    }
    const finalRoomCharge = roomCharge - totalDiscount;

    let earlyCheckInFee = 0;
    const standardCheckInTime = new Date(checkIn);
    standardCheckInTime.setHours(14, 0, 0, 0);
    if (checkIn < standardCheckInTime && checkIn.toDateString() === standardCheckInTime.toDateString()) {
      const earlyHours = Math.ceil((standardCheckInTime - checkIn) / (1000 * 60 * 60));
      if (earlyHours > 0) earlyCheckInFee = earlyHours * 50;
    }

    let lateCheckOutFee = 0;
    const standardCheckOutTime = new Date(checkOut);
    standardCheckOutTime.setHours(12, 0, 0, 0);
    const endCheckoutTime = booking.status === 'Checked In' ? new Date() : new Date(booking.checkOutDateTime);
    if (endCheckoutTime > standardCheckOutTime) {
      const lateHours = Math.ceil((endCheckoutTime - standardCheckOutTime) / (1000 * 60 * 60));
      if (lateHours > 0) lateCheckOutFee = lateHours * 100;
    }

    const cleanCheckInDate = (booking.checkInDateTime || '').replace('T', ' ');

    const products = await dbQuery(`
      SELECT SUM(op.quantity * p.price) as total
      FROM order_product op
      JOIN products p ON p.productID = op.productID
      JOIN orders o ON o.orderID = op.orderID
      WHERE o.guestID = ? 
        AND o.orderDateTime >= DATE_SUB(?, INTERVAL 12 HOUR) 
        AND o.orderStatus != 'Canceled'
        AND o.orderID NOT IN (SELECT orderID FROM billing WHERE orderID IS NOT NULL)
    `, [booking.guestID, cleanCheckInDate]);
    const productTotal = parseFloat(products[0]?.total || 0);

    const amenities = await dbQuery(`
      SELECT SUM(oa.quantity * a.price) as total
      FROM order_amenities oa
      JOIN amenities a ON a.amenityID = oa.amenityID
      JOIN orders o ON o.orderID = oa.orderID
      WHERE o.guestID = ? 
        AND o.orderDateTime >= DATE_SUB(?, INTERVAL 12 HOUR) 
        AND o.orderStatus != 'Canceled'
        AND o.orderID NOT IN (SELECT orderID FROM billing WHERE orderID IS NOT NULL)
    `, [booking.guestID, cleanCheckInDate]);
    const amenityTotal = parseFloat(amenities[0]?.total || 0);

    const incidentals = await dbQuery(
      "SELECT SUM(amount) as total FROM incidental_charge WHERE bookingID = ?",
      [bookingID]
    );
    const incidentalTotal = parseFloat(incidentals[0]?.total || 0);

    const subtotal = finalRoomCharge + extraGuestFee + earlyCheckInFee + lateCheckOutFee + productTotal + amenityTotal + incidentalTotal;

    const billingRes = await dbQuery("SELECT billingID FROM billing WHERE bookingID = ?", [bookingID]);
    let paidTotal = 0;
    if (billingRes.length > 0) {
      const billingID = billingRes[0].billingID;
      const payments = await dbQuery("SELECT SUM(amount) as total FROM payment WHERE billingID = ?", [billingID]);
      paidTotal = parseFloat(payments[0]?.total || 0);
    }

    return subtotal - paidTotal;
  } catch (error) {
    console.error("Error in getBookingBalance:", error);
    return 0;
  }
}
