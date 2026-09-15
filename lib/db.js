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
      connectionLimit: 25,
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

let isProfilePictureSchemaChecked = false;
let isBreakfastRateSchemaChecked = false;
let isPaymentSchemaChecked = false;
let isBookingBillingSchemaChecked = false;
let isBillingAuditSchemaChecked = false;
let lastSyncRoomStatuses = 0;

export async function ensureProfilePictureSchema() {
  if (isProfilePictureSchemaChecked) return;
  try {
    const conn = await getDbConnection();
    await conn.execute("ALTER TABLE guest ADD COLUMN profilePicture VARCHAR(500) NULL").catch(() => {});
    await conn.execute("ALTER TABLE guest MODIFY COLUMN profilePicture VARCHAR(500) NULL").catch(() => {});
    await conn.execute("ALTER TABLE user ADD COLUMN profilePicture VARCHAR(500) NULL").catch(() => {});
    await conn.execute("ALTER TABLE user MODIFY COLUMN profilePicture VARCHAR(500) NULL").catch(() => {});
    isProfilePictureSchemaChecked = true;
  } catch (e) {}
}

export async function ensureBreakfastRateSchema() {
  if (isBreakfastRateSchemaChecked) return;
  try {
    const conn = await getDbConnection();
    await conn.execute("ALTER TABLE room ADD COLUMN breakfastRate DECIMAL(10,2) NULL").catch(() => {});
    isBreakfastRateSchemaChecked = true;
  } catch (e) {}
}

let isUploadedFilesSchemaChecked = false;

export async function ensureUploadedFilesSchema() {
  if (isUploadedFilesSchemaChecked) return;
  try {
    const conn = await getDbConnection();
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        subFolder VARCHAR(100) NOT NULL,
        mimeType VARCHAR(100) NOT NULL,
        fileSize INT NOT NULL,
        data LONGBLOB NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});
    isUploadedFilesSchemaChecked = true;
  } catch (e) {
    console.error("ensureUploadedFilesSchema error:", e);
  }
}

export async function saveUploadedFile({ filename, subFolder, mimeType, buffer }) {
  await ensureUploadedFilesSchema();
  const conn = await getDbConnection();
  await conn.execute(`
    INSERT INTO uploaded_files (filename, subFolder, mimeType, fileSize, data)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      subFolder = VALUES(subFolder),
      mimeType = VALUES(mimeType),
      fileSize = VALUES(fileSize),
      data = VALUES(data),
      createdAt = CURRENT_TIMESTAMP
  `, [filename, subFolder, mimeType, buffer.length, buffer]);
}

export async function getUploadedFile(filename) {
  await ensureUploadedFilesSchema();
  const conn = await getDbConnection();
  const [rows] = await conn.execute(
    \`SELECT filename, subFolder, mimeType, fileSize, data FROM uploaded_files WHERE filename = ? LIMIT 1\`,
    [filename]
  );
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

export async function ensurePaymentSchema() {
  if (isPaymentSchemaChecked) return;
  try {
    const conn = await getDbConnection();
    await conn.execute("ALTER TABLE transactions ADD COLUMN testMode TINYINT(1) NOT NULL DEFAULT 1").catch(() => {});
    await conn.execute("ALTER TABLE payment ADD COLUMN testMode TINYINT(1) NOT NULL DEFAULT 1").catch(() => {});
    await conn.execute("ALTER TABLE payment ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Settled'").catch(() => {});
    await conn.execute("ALTER TABLE payment ADD COLUMN referenceNumber VARCHAR(100) NULL").catch(() => {});
    await conn.execute("ALTER TABLE payment ADD COLUMN paymentDate DATETIME NULL").catch(() => {});
    await conn.execute("ALTER TABLE payment ADD COLUMN isFullyPaid TINYINT(1) NOT NULL DEFAULT 0").catch(() => {});
    await conn.execute(`
      CREATE OR REPLACE VIEW PaymentHistory AS 
      SELECT p.paymentID, p.amount, p.cashReceived, p.change, p.paymentDate, p.billingID, p.guestID, p.staffID, p.paymentMethodID, p.status, p.referenceNumber, p.testMode,
             t.transactionID, t.transactionDateTime, bil.bookingID
      FROM payment p
      LEFT JOIN transactions t ON t.paymentID = p.paymentID
      LEFT JOIN billing bil ON bil.billingID = p.billingID
    `).catch(() => {});
    isPaymentSchemaChecked = true;
  } catch (e) {}
}

export async function recordPaymentHistory(conn, {
  amount,
  cashReceived = 0,
  change = 0,
  billingID,
  guestID,
  staffID = null,
  paymentMethodID = 2,
  status = 'Settled',
  referenceNumber = null,
  testMode = 1
}) {
  await ensurePaymentSchema();
  const localNow = new Date();
  const pad = (num) => String(num).padStart(2, '0');
  const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

  const [paymentInsert] = await conn.execute(
    `INSERT INTO payment (amount, cashReceived, \`change\`, billingID, guestID, staffID, paymentMethodID, discountID, promotionID, testMode, status, referenceNumber, paymentDate)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
    [amount, cashReceived || amount, change, billingID, guestID, staffID, paymentMethodID, testMode, status, referenceNumber, nowStr]
  );
  const paymentID = paymentInsert.insertId;

  // Insert Transaction record to sync with AdminReports
  await conn.execute(
    "INSERT INTO transactions (transactionDateTime, billingID, paymentID, testMode) VALUES (?, ?, ?, ?)",
    [nowStr, billingID, paymentID, testMode]
  );

  return paymentID;
}

export async function ensureBookingBillingSchema() {
  if (isBookingBillingSchemaChecked) return;
  try {
    const conn = await getDbConnection();
    await conn.execute("ALTER TABLE booking MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Pending'").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN roomRate DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN roomCharge DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN totalAmount DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN downPaymentAmount DECIMAL(10,2) NULL DEFAULT 0.00").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN downPaymentPercentage INT NULL DEFAULT 50").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN remainingBalance DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN finalBalance DECIMAL(10,2) NULL DEFAULT 0.00").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN checkoutRequestedAt DATETIME NULL").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN billFinalizedAt DATETIME NULL").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN roomVerifiedAt DATETIME NULL").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN finalBillingUpdatedAt DATETIME NULL").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN paymentCompletedAt DATETIME NULL").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN breakfastOption VARCHAR(20) NULL DEFAULT 'without'").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN balance DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN totalAmount DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN downPaymentAmount DECIMAL(10,2) NULL DEFAULT 0.00").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN downPaymentPercentage INT NULL DEFAULT 50").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN remainingBalance DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE reservation MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Pending'").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN isCourtesyHold TINYINT(1) DEFAULT 0").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN holdDurationHours INT NULL").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN holdExpiryDateTime DATETIME NULL").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN warning12SentAt DATETIME NULL").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN warning6SentAt DATETIME NULL").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN releasedAt DATETIME NULL").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN guestEmail VARCHAR(150) NULL").catch(() => {});
    await conn.execute("ALTER TABLE guest ADD COLUMN email VARCHAR(255) NULL").catch(() => {});
    isBookingBillingSchemaChecked = true;
  } catch (e) {}
}

export * from './bookingStatuses.js';

export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export async function getGuestById(guestID) {
  const rows = await dbQuery(
    "SELECT guestID, userID, firstName, lastName, contact, email, gender, DATE_FORMAT(dateOfBirth, '%Y-%m-%d') as dateOfBirth FROM guest WHERE guestID = ?",
    [guestID]
  );
  return rows[0] || null;
}

export async function ensureTestModeSchema() {
  return ensurePaymentSchema();
}

export async function ensureBillingAuditSchema() {
  if (isBillingAuditSchemaChecked) return;
  try {
    const conn = await getDbConnection();
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS billing_audit (
        auditID INT AUTO_INCREMENT PRIMARY KEY,
        billingID INT NULL,
        bookingID INT NOT NULL,
        transactionType VARCHAR(50) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        balanceBefore DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        balanceAfter DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        userID INT NULL,
        userName VARCHAR(150) NULL,
        userRole VARCHAR(50) NULL,
        description TEXT NULL,
        referenceNumber VARCHAR(100) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Settled',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bookingID (bookingID),
        INDEX idx_billingID (billingID),
        INDEX idx_createdAt (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});
    await conn.execute("ALTER TABLE billing_audit ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Settled'").catch(() => {});
    isBillingAuditSchemaChecked = true;
  } catch (e) {
    console.error("Error ensuring billing audit schema:", e);
  }
}

export async function logBillingAudit(connOrDb, {
  billingID = null,
  bookingID,
  transactionType,
  amount = 0,
  balanceBefore = 0,
  balanceAfter = 0,
  userID = null,
  userName = null,
  userRole = null,
  description = null,
  referenceNumber = null,
  status = 'Settled'
}) {
  try {
    await ensureBillingAuditSchema();
    const executor = connOrDb || (await getDbConnection());
    await executor.execute(
      `INSERT INTO billing_audit 
        (billingID, bookingID, transactionType, amount, balanceBefore, balanceAfter, userID, userName, userRole, description, referenceNumber, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        billingID || null,
        bookingID,
        transactionType,
        parseFloat(amount || 0),
        parseFloat(balanceBefore || 0),
        parseFloat(balanceAfter || 0),
        userID || null,
        userName || null,
        userRole || null,
        description || null,
        referenceNumber || null,
        status || 'Settled'
      ]
    );
  } catch (err) {
    console.error("Failed to log billing audit:", err);
  }
}

export async function syncRoomStatuses(force = false) {
  const now = Date.now();
  if (!force && now - lastSyncRoomStatuses < 30000) {
    return;
  }
  lastSyncRoomStatuses = now;
  try {
    const conn = await getDbConnection();

    // 1. Auto-update unarrived bookings past scheduled check-in + 1-hour grace period to 'No Show'
    try {
      const [noShowBookings] = await conn.execute(`
        SELECT b.bookingID, b.guestID, g.userID as guestUserID, g.firstName, g.lastName, b.checkInDateTime, b.roomID
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        WHERE b.status IN ('Pending Check-in', 'Confirmed', 'Pending', 'Booked')
          AND b.checkInDateTime < DATE_SUB(NOW(), INTERVAL 1 HOUR)
      `);

      for (const b of noShowBookings) {
        await conn.execute("UPDATE booking SET status = 'No Show' WHERE bookingID = ?", [b.bookingID]);
        
        // Notify Guest
        if (b.guestUserID) {
          await conn.execute(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Booking Marked as No Show', ?)",
            [b.guestUserID, `Booking #${b.bookingID} was marked as No Show due to missed arrival after exceeding the 1-hour grace period. Please contact Front Desk if you need assistance.`]
          );
        }

        // Notify Receptionists only (roleID = 2, excluding Admins roleID = 1)
        const [receptionists] = await conn.execute("SELECT userID FROM user WHERE roleID = 2 AND status = 'Active'");
        for (const s of receptionists) {
          await conn.execute(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'No Show Alert', ?)",
            [s.userID, `Booking #${b.bookingID} for ${b.firstName} ${b.lastName} has been marked as No Show after exceeding the 1-hour grace period.`]
          );
        }
      }
    } catch (eNoShowErr) {
      console.error("Auto No-Show update failed:", eNoShowErr);
    }

    // 1b. Auto-update unarrived reservations past scheduled check-in + 1-hour grace period to 'No Show'
    try {
      const [noShowReservations] = await conn.execute(`
        SELECT r.reservationID, r.guestID, r.roomID, r.reservationDateTime, r.checkOutDateTime,
               g.userID as guestUserID, g.firstName, g.lastName, rm.roomNumber
        FROM reservation r
        JOIN guest g ON g.guestID = r.guestID
        JOIN room rm ON rm.roomID = r.roomID
        WHERE r.status IN ('Confirmed', 'Pending')
          AND r.reservationID NOT IN (SELECT reservationID FROM booking WHERE reservationID IS NOT NULL AND status IN ('Checked In', 'Late Checkout', 'Completed'))
          AND (r.reservationDateTime < DATE_SUB(NOW(), INTERVAL 1 HOUR) OR NOW() > r.checkOutDateTime)
      `);

      for (const r of noShowReservations) {
        await conn.execute("UPDATE reservation SET status = 'No Show' WHERE reservationID = ?", [r.reservationID]);

        // Notify Guest
        if (r.guestUserID) {
          await conn.execute(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Reservation Marked as No Show', ?)",
            [
              r.guestUserID,
              `Your reservation #${r.reservationID} for Room ${r.roomNumber} has been marked as No Show after exceeding the 1-hour grace period. Room hold has been released.`
            ]
          );
        }

        // Notify Receptionists only (roleID = 2, excluding Admins roleID = 1)
        const [receptionists] = await conn.execute("SELECT userID FROM user WHERE roleID = 2 AND status = 'Active'");
        for (const s of receptionists) {
          await conn.execute(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Reservation No Show Alert', ?)",
            [
              s.userID,
              `Reservation #${r.reservationID} for Room ${r.roomNumber} (${r.firstName} ${r.lastName}) has been marked as No Show after exceeding the 1-hour grace period. Room is released back to Available.`
            ]
          );
        }
      }
    } catch (eResNoShowErr) {
      console.error("Auto Reservation No-Show update failed:", eResNoShowErr);
    }

    // 1c. Auto-check Courtesy Hold expiry warnings and 30-min grace period releases
    try {
      const { checkExpiredCourtesyHolds, checkCourtesyHoldExpiryWarnings } = await import('./ReservationScheduler');
      await checkExpiredCourtesyHolds();
      await checkCourtesyHoldExpiryWarnings();
    } catch (schedErr) {
      console.error("Scheduler courtesy hold check failed:", schedErr);
    }

    // 2. Auto-update Checked-In Bookings past checkout time to 'Late Checkout'
    try {
      const [lateCheckoutBookings] = await conn.execute(`
        SELECT b.bookingID, b.guestID, g.userID as guestUserID, g.firstName, g.lastName, b.checkOutDateTime
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        WHERE b.status = 'Checked In'
          AND NOW() > b.checkOutDateTime
      `);

      for (const b of lateCheckoutBookings) {
        await conn.execute("UPDATE booking SET status = 'Late Checkout' WHERE bookingID = ?", [b.bookingID]);

        if (b.guestUserID) {
          await conn.execute(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Late Check-out Notice', ?)",
            [b.guestUserID, `Your scheduled checkout time for Booking #${b.bookingID} has passed. Late checkout fee (₱100.00/hr past 12:00 PM) applies until stay checkout is completed.`]
          );
        }
      }
    } catch (eLateCheckoutErr) {
      console.error("Auto Late Checkout update failed:", eLateCheckoutErr);
    }

    // 3. Update room statuses dynamically:
    // Occupied if any Checked In or Late Checkout booking exists; Reserved if active Pending Check-in booking OR Confirmed/Overdue/Courtesy Hold reservation exists; Available otherwise
    await conn.execute(`
      UPDATE room r
      LEFT JOIN (
        SELECT roomID, 
               CASE 
                 WHEN SUM(CASE WHEN status IN ('Checked In', 'Late Checkout') THEN 1 ELSE 0 END) > 0 THEN 'Occupied'
                 WHEN SUM(CASE WHEN status IN ('Pending Check-in', 'Overdue Check-In', 'Confirmed', 'Pending', 'Booked') AND checkOutDateTime >= CURDATE() AND checkInDateTime <= DATE_ADD(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) > 0 THEN 'Reserved'
                 ELSE NULL
               END as calcStatus
        FROM booking
        WHERE status NOT IN ('Cancelled', 'Checked Out', 'No Show')
        GROUP BY roomID
      ) b ON r.roomID = b.roomID
      LEFT JOIN (
        SELECT roomID, COUNT(*) as activeResCount
        FROM reservation
        WHERE status NOT IN ('Cancelled', 'Canceled', 'Released', 'Expired', 'No Show')
          AND (
            (status IN ('Confirmed', 'Pending', 'Overdue Check-In') AND COALESCE(checkOutDateTime, DATE_ADD(reservationDateTime, INTERVAL 1 DAY)) >= CURDATE())
            OR (status = 'Courtesy Hold' AND (holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(holdExpiryDateTime, INTERVAL 30 MINUTE)))
          )
        GROUP BY roomID
      ) res ON r.roomID = res.roomID
      SET r.status = CASE 
        WHEN b.calcStatus = 'Occupied' THEN 'Occupied'
        WHEN b.calcStatus = 'Reserved' OR COALESCE(res.activeResCount, 0) > 0 THEN 'Reserved'
        ELSE 'Available'
      END
      WHERE r.isArchived = 0 AND r.status != 'Under Maintenance'
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

let isInquirySchemaChecked = false;
let isOrdersSchemaChecked = false;

let isCatalogImageSchemaChecked = false;

export async function ensureCatalogImageSchema() {
  if (isCatalogImageSchemaChecked) return;
  try {
    const conn = await getDbConnection();
    const [pCols] = await conn.execute("SHOW COLUMNS FROM products LIKE 'image'");
    if (pCols.length === 0) {
      await conn.execute("ALTER TABLE products ADD COLUMN image VARCHAR(500) NULL AFTER description").catch(() => {});
    }
    const [aCols] = await conn.execute("SHOW COLUMNS FROM amenities LIKE 'image'");
    if (aCols.length === 0) {
      await conn.execute("ALTER TABLE amenities ADD COLUMN image VARCHAR(500) NULL AFTER description").catch(() => {});
    }
    isCatalogImageSchemaChecked = true;
  } catch (e) {
    console.error("Error ensuring catalog image schema:", e);
  }
}

export async function ensureOrdersSchema() {
  if (isOrdersSchemaChecked) return;
  try {
    await ensureCatalogImageSchema();
    await ensureBreakfastRateSchema();
    const conn = await getDbConnection();
    const [delCols] = await conn.execute("SHOW COLUMNS FROM orders LIKE 'deliveryTime'");
    if (delCols.length === 0) {
      await conn.execute("ALTER TABLE orders ADD COLUMN deliveryTime VARCHAR(50) NULL AFTER orderStatus").catch(() => {});
    }
    const [delDateCols] = await conn.execute("SHOW COLUMNS FROM orders LIKE 'deliveryDate'");
    if (delDateCols.length === 0) {
      await conn.execute("ALTER TABLE orders ADD COLUMN deliveryDate VARCHAR(50) NULL AFTER deliveryTime").catch(() => {});
    }
    const [delTypeCols] = await conn.execute("SHOW COLUMNS FROM orders LIKE 'deliveryType'");
    if (delTypeCols.length === 0) {
      await conn.execute("ALTER TABLE orders ADD COLUMN deliveryType VARCHAR(20) NOT NULL DEFAULT 'immediate' AFTER orderStatus").catch(() => {});
    }
    const [opDelTypeCols] = await conn.execute("SHOW COLUMNS FROM order_product LIKE 'deliveryType'");
    if (opDelTypeCols.length === 0) {
      await conn.execute("ALTER TABLE order_product ADD COLUMN deliveryType VARCHAR(20) NOT NULL DEFAULT 'immediate', ADD COLUMN itemStatus VARCHAR(50) NOT NULL DEFAULT 'Placed'").catch(() => {});
    }
    const [oaDelTypeCols] = await conn.execute("SHOW COLUMNS FROM order_amenities LIKE 'deliveryType'");
    if (oaDelTypeCols.length === 0) {
      await conn.execute("ALTER TABLE order_amenities ADD COLUMN deliveryType VARCHAR(20) NOT NULL DEFAULT 'immediate', ADD COLUMN itemStatus VARCHAR(50) NOT NULL DEFAULT 'Placed'").catch(() => {});
    }
    try {
      const [oiTable] = await conn.execute("SHOW TABLES LIKE 'order_items'");
      if (oiTable.length > 0) {
        const [oiDelType] = await conn.execute("SHOW COLUMNS FROM order_items LIKE 'deliveryType'");
        if (oiDelType.length === 0) {
          await conn.execute("ALTER TABLE order_items ADD COLUMN deliveryType VARCHAR(20) NOT NULL DEFAULT 'immediate'").catch(() => {});
        }
      }
    } catch (e) {}
    // Performance indexes for faster catalog lookup and history fetching
    await conn.execute("ALTER TABLE orders ADD INDEX idx_orders_guest (guestID, orderDateTime)").catch(() => {});
    await conn.execute("ALTER TABLE orders ADD INDEX idx_orders_booking (bookingID)").catch(() => {});
    await conn.execute("ALTER TABLE inventory_batch ADD INDEX idx_ib_lookup (itemType, itemID, status)").catch(() => {});
    isOrdersSchemaChecked = true;
  } catch (e) {
    console.error("Error ensuring orders schema:", e);
  }
}

export async function ensureInquirySchema() {
  if (isInquirySchemaChecked) return;
  try {
    const conn = await getDbConnection();
    await ensureOrdersSchema();

    // 1. Add contactNumber column to inquiry if missing
    const [inqCols] = await conn.execute("SHOW COLUMNS FROM inquiry LIKE 'contactNumber'");
    if (inqCols.length === 0) {
      await conn.execute("ALTER TABLE inquiry ADD COLUMN contactNumber VARCHAR(50) NULL AFTER email");
    }

    // 1c. Add guestID and subject columns to inquiry if missing
    const [gIdCols] = await conn.execute("SHOW COLUMNS FROM inquiry LIKE 'guestID'");
    if (gIdCols.length === 0) {
      await conn.execute("ALTER TABLE inquiry ADD COLUMN guestID INT NULL AFTER inquiryID");
    }
    const [subCols] = await conn.execute("SHOW COLUMNS FROM inquiry LIKE 'subject'");
    if (subCols.length === 0) {
      await conn.execute("ALTER TABLE inquiry ADD COLUMN subject VARCHAR(255) NULL AFTER contactNumber");
    }

    // 2. Add unreadGuest and unreadReceptionist columns if missing
    const [unreadG] = await conn.execute("SHOW COLUMNS FROM inquiry LIKE 'unreadGuest'");
    if (unreadG.length === 0) {
      await conn.execute("ALTER TABLE inquiry ADD COLUMN unreadGuest INT DEFAULT 0, ADD COLUMN unreadReceptionist INT DEFAULT 0");
    }

    // 3. Modify status column to support 'Pending', 'Responded', 'Closed'
    await conn.execute("ALTER TABLE inquiry MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Pending'");
    await conn.execute("ALTER TABLE reservation MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Pending'").catch(() => {});

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
    isInquirySchemaChecked = true;
  } catch (error) {
    console.error("Failed to ensure inquiry schema:", error);
  }
}

export function computeLateCheckOutFee(checkOutDateTime, actualOrCurrentTime = new Date(), roomRate = 0) {
  if (!checkOutDateTime) return { fee: 0, hours: 0 };
  const scheduledCheckOut = new Date(String(checkOutDateTime).replace(' ', 'T'));
  if (isNaN(scheduledCheckOut.getTime())) return { fee: 0, hours: 0 };

  const endTime = actualOrCurrentTime instanceof Date 
    ? actualOrCurrentTime 
    : new Date(String(actualOrCurrentTime).replace(' ', 'T'));
    
  if (isNaN(endTime.getTime()) || endTime <= scheduledCheckOut) {
    return { fee: 0, hours: 0 };
  }

  const diffMs = endTime.getTime() - scheduledCheckOut.getTime();
  const totalLateHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));

  let fee = 0;
  if (totalLateHours <= 22) {
    fee = totalLateHours * 100; // ₱100.00 per hour
  } else {
    const fullDays = Math.floor(totalLateHours / 24);
    const remainderHours = totalLateHours % 24;
    const rate = parseFloat(roomRate) || 1500;
    if (fullDays > 0) {
      fee = (fullDays * rate) + (remainderHours > 0 ? (remainderHours <= 22 ? remainderHours * 100 : rate) : 0);
    } else {
      fee = rate;
    }
  }

  return { fee: Math.round(fee * 100) / 100, hours: totalLateHours };
}

export async function getBookingBalanceDetails(bookingID) {
  try {
    await ensureBookingBillingSchema();
    const bookingRes = await dbQuery(`
      SELECT b.bookingID, DATE_FORMAT(b.checkInDateTime, '%Y-%m-%d %H:%i:%s') as checkInDateTime, 
             DATE_FORMAT(b.checkOutDateTime, '%Y-%m-%d %H:%i:%s') as checkOutDateTime, 
             b.status, b.guestID, b.roomID, b.reservationID,
             COALESCE(b.roomRate, NULL) as storedRoomRate,
             COALESCE(b.roomCharge, NULL) as storedRoomCharge,
             COALESCE(b.downPaymentAmount, 0) as storedDownPaymentAmount,
             COALESCE(b.downPaymentPercentage, 50) as storedDownPaymentPercentage,
             COALESCE(b.remainingBalance, NULL) as storedRemainingBalance,
             COALESCE(b.breakfastOption, NULL) as storedBreakfastOption,
             rm.roomNumber, rm.floorID, rm.occupancyLimit, rt.type as roomType, rt.roomTypeID,
             g.firstName, g.lastName, g.contact, g.email
      FROM booking b
      JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE b.bookingID = ?
    `, [bookingID]);

    if (bookingRes.length === 0) {
      return {
        booking: null,
        subtotal: 0,
        paidTotal: 0,
        balance: 0
      };
    }

    const booking = bookingRes[0];

    // Calendar nights calculation (deterministic calendar difference)
    const inDateStr = (booking.checkInDateTime || '').split(' ')[0] || (booking.checkInDateTime || '').split('T')[0];
    const outDateStr = (booking.checkOutDateTime || '').split(' ')[0] || (booking.checkOutDateTime || '').split('T')[0];
    const checkInD = new Date(inDateStr + 'T00:00:00');
    const checkOutD = new Date(outDateStr + 'T00:00:00');
    let nights = 1;
    if (!isNaN(checkInD.getTime()) && !isNaN(checkOutD.getTime()) && checkOutD > checkInD) {
      nights = Math.max(1, Math.round((checkOutD.getTime() - checkInD.getTime()) / (1000 * 60 * 60 * 24)));
    }

    // Resolve breakfast option: stored on booking, or from reservation, or default 'without'
    let breakfastOption = booking.storedBreakfastOption || null;
    let reservationData = null;
    if (booking.reservationID) {
      const resData = await dbQuery("SELECT breakfastOption, guestCount FROM reservation WHERE reservationID = ?", [booking.reservationID]);
      if (resData.length > 0) {
        reservationData = resData[0];
        if (!breakfastOption && reservationData.breakfastOption) {
          breakfastOption = reservationData.breakfastOption;
        }
      }
    }
    if (!breakfastOption) breakfastOption = 'without';
    const hasPackageBreakfast = breakfastOption === 'with';

    // Resolve room rate: match exact breakfast tier from room_rate
    const breakfastID = hasPackageBreakfast ? 2 : 1;
    const rateRes = await dbQuery(
      "SELECT rate FROM room_rate WHERE roomTypeID = ? AND floorID = ? AND breakfastID = ?",
      [booking.roomTypeID, booking.floorID, breakfastID]
    );
    let expectedRate = rateRes.length > 0 && rateRes[0]?.rate ? parseFloat(rateRes[0].rate) : null;
    if (!expectedRate) {
      const [defRate] = await dbQuery(
        "SELECT rate FROM room_rate WHERE roomTypeID = ? AND floorID = ? LIMIT 1",
        [booking.roomTypeID, booking.floorID]
      );
      expectedRate = defRate?.rate ? parseFloat(defRate.rate) : 1500;
    }

    let rate = expectedRate;
    if (booking.storedRoomRate) {
      const stored = parseFloat(booking.storedRoomRate);
      if (stored > 0 && Math.abs(stored - expectedRate) < 50) {
        rate = stored;
      }
    }

    const baseRoomCharge = rate * nights;

    const guestsList = await dbQuery(`
      SELECT bg.*, 
             COALESCE(d.name, p.name) as discountName,
             COALESCE(d.percentage, p.percentage, 0) as discountPercentage
      FROM booking_guest_details bg
      LEFT JOIN discounts d ON d.discountID = bg.discountID
      LEFT JOIN promotions p ON p.promotionID = bg.promotionID
      WHERE bg.bookingID = ?
    `, [bookingID]);

    let finalGuestsList = guestsList.length > 0 ? [...guestsList] : [{
      bookingGuestID: 0,
      bookingID,
      fullName: `${booking.firstName} ${booking.lastName}`,
      age: 30,
      discountID: null,
      promotionID: null,
      discountIdNumber: null,
      discountName: null,
      discountPercentage: 0
    }];

    const maxOccupancy = parseInt(booking.roomBasePax || booking.occupancyLimit) || 4;
    let totalGuestsCount = finalGuestsList.length;
    if (reservationData?.guestCount && parseInt(reservationData.guestCount) > totalGuestsCount) {
      totalGuestsCount = parseInt(reservationData.guestCount);
    }
    const extraGuests = Math.max(0, totalGuestsCount - maxOccupancy);
    let extraGuestFee = extraGuests * 100 * nights;

    // Preserve extra guest fees if stored in roomCharge
    if (booking.storedRoomCharge && parseFloat(booking.storedRoomCharge) > baseRoomCharge) {
      const chargeDiff = Math.round((parseFloat(booking.storedRoomCharge) - baseRoomCharge) * 100) / 100;
      if (chargeDiff > extraGuestFee) {
        extraGuestFee = chargeDiff;
      }
    }

    // Room stay charges only (extra guest fee is excluded from room stay down payment & tagged Final Billing Only)
    const sharePerGuest = baseRoomCharge / Math.max(1, totalGuestsCount);
    let totalDiscount = 0;

    finalGuestsList = finalGuestsList.map(g => {
      const discountPercentage = g.discountPercentage ? parseFloat(g.discountPercentage) : 0;
      const discountAmount = sharePerGuest * (discountPercentage / 100);
      totalDiscount += discountAmount;
      return {
        ...g,
        share: sharePerGuest,
        discount: discountAmount,
        netShare: sharePerGuest - discountAmount
      };
    });

    const finalRoomCharge = Math.max(0, baseRoomCharge - totalDiscount);

    const cleanCheckInDate = (booking.checkInDateTime || '').replace('T', ' ');

    const [productChargesRaw, amenityCharges, incidentalCharges, billingRes] = await Promise.all([
      dbQuery(`
        SELECT op.orderProductID, op.quantity, p.name, p.productCategoryID,
               CASE WHEN op.isComplimentary = 1 THEN 0 ELSE COALESCE(op.unitPrice, p.price) END as price, 
               CASE WHEN op.isComplimentary = 1 THEN 0 ELSE (op.quantity * COALESCE(op.unitPrice, p.price)) END as subtotal
        FROM order_product op
        JOIN products p ON p.productID = op.productID
        JOIN orders o ON o.orderID = op.orderID
        WHERE (o.bookingID = ? OR (o.guestID = ? AND o.orderDateTime >= DATE_SUB(?, INTERVAL 12 HOUR)))
          AND o.orderStatus NOT IN ('Canceled')
          AND o.orderID NOT IN (SELECT orderID FROM billing WHERE orderID IS NOT NULL)
      `, [bookingID, booking.guestID, cleanCheckInDate]),
      dbQuery(`
        SELECT oa.orderAmenityID, oa.quantity, a.name, a.price, (oa.quantity * a.price) as subtotal
        FROM order_amenities oa
        JOIN amenities a ON a.amenityID = oa.amenityID
        JOIN orders o ON o.orderID = oa.orderID
        WHERE (o.bookingID = ? OR (o.guestID = ? AND o.orderDateTime >= DATE_SUB(?, INTERVAL 12 HOUR)))
          AND o.orderStatus NOT IN ('Canceled')
          AND o.orderID NOT IN (SELECT orderID FROM billing WHERE orderID IS NOT NULL)
      `, [bookingID, booking.guestID, cleanCheckInDate]),
      dbQuery(
        "SELECT chargeID, description, amount, createdAt FROM incidental_charge WHERE bookingID = ?",
        [bookingID]
      ),
      dbQuery("SELECT billingID FROM billing WHERE bookingID = ? ORDER BY billingID DESC LIMIT 1", [bookingID])
    ]);

    // Exclude free breakfast meals if included in room package
    const productCharges = productChargesRaw.map(item => {
      if (hasPackageBreakfast && (item.productCategoryID === 3 || (item.name && item.name.toLowerCase().includes('breakfast')))) {
        return {
          ...item,
          price: 0,
          subtotal: 0,
          isFreeBreakfast: true,
          notes: 'Included in Room Package'
        };
      }
      return item;
    });

    const productTotal = Math.round(productCharges.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0) * 100) / 100;
    const amenityTotal = Math.round(amenityCharges.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0) * 100) / 100;
    const ordersTotal = Math.round((productTotal + amenityTotal) * 100) / 100;

    // Check if Early Check-In is recorded in incidental charges
    const earlyCheckInIncidental = incidentalCharges.find(ic =>
      ic.description && ic.description.toLowerCase().includes('early check-in')
    );
    let earlyCheckInFee = earlyCheckInIncidental ? parseFloat(earlyCheckInIncidental.amount) : 0;

    // Filter incidentalTotal to exclude extra capacity charge if already accounted in roomCharge and early check-in
    const filteredIncidentals = incidentalCharges.filter(ic => 
      !(ic.description && ic.description.toLowerCase().includes('extra capacity charge')) &&
      !(ic.description && ic.description.toLowerCase().includes('early check-in'))
    );
    const regularIncidentalTotal = Math.round(filteredIncidentals.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) * 100) / 100;
    const totalIncidentalsWithEarly = Math.round((regularIncidentalTotal + earlyCheckInFee) * 100) / 100;

    // Hourly Late Check-out Fee (₱100/hr for 1-22 hrs, full day rate if >22 hrs)
    const endCheckoutTime = (booking.status === 'Checked In' || booking.status === 'Late Checkout')
      ? new Date() 
      : new Date(booking.checkOutDateTime);

    const { fee: lateCheckOutFee, hours: lateHours } = computeLateCheckOutFee(
      booking.checkOutDateTime,
      endCheckoutTime,
      rate
    );

    const totalAdditionalFees = Math.round((extraGuestFee + earlyCheckInFee + lateCheckOutFee) * 100) / 100;

    const billingID = billingRes[0]?.billingID || null;
    let paidTotal = 0;
    let paymentsList = [];

    if (billingID) {
      await ensurePaymentSchema();
      paymentsList = await dbQuery(
        `SELECT p.paymentID, p.amount,
                COALESCE(DATE_FORMAT(t.transactionDateTime, '%Y-%m-%d %H:%i:%s'), '') as paymentDate,
                COALESCE(p.isFullyPaid, 0) as isFullyPaid,
                pm.paymentMethod, p.cashReceived, p.\`change\`,
                COALESCE(p.testMode, 0) as testMode
         FROM payment p
         LEFT JOIN transactions t ON t.paymentID = p.paymentID
         LEFT JOIN payment_method pm ON pm.paymentMethodID = p.paymentMethodID
         WHERE p.billingID = ?
         ORDER BY p.paymentID ASC`,
        [billingID]
      );
      paidTotal = Math.round(paymentsList.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) * 100) / 100;
    }

    // Down payment paid: first recorded payment or stored downPaymentAmount if verified
    let downPaymentPaid = 0;
    let downPaymentPercentage = booking.storedDownPaymentPercentage || 50;
    if (paymentsList.length > 0) {
      downPaymentPaid = parseFloat(paymentsList[0].amount || 0);
    } else if (booking.storedDownPaymentAmount && ['Payment Completed', 'Confirmed', 'Checked In'].includes(booking.status)) {
      downPaymentPaid = parseFloat(booking.storedDownPaymentAmount);
      paidTotal = Math.max(paidTotal, downPaymentPaid);
    }

    // Room remaining balance: finalRoomCharge minus downPayment
    const roomBalance = Math.max(0, Math.round((finalRoomCharge - downPaymentPaid) * 100) / 100);

    // Any subsequent payments made beyond the initial down payment
    const subsequentPayments = Math.max(0, Math.round((paidTotal - downPaymentPaid) * 100) / 100);

    // Subtotal = Base room charge + extra guest fee + incidentals + orders - totalDiscount
    const subtotal = Math.max(0, Math.round((baseRoomCharge + extraGuestFee + regularIncidentalTotal + earlyCheckInFee + lateCheckOutFee + ordersTotal - totalDiscount) * 100) / 100);

    // Total balance = (Remaining room balance + Extra guest fees + Products/amenities/meals + Incidentals - subsequentPayments)
    // Exactly matches subtotal minus paidTotal
    let balance = Math.max(
      0,
      Math.round((subtotal - paidTotal) * 100) / 100
    );

    // Final checkout balance equals active balance
    const finalCheckoutBalance = balance;

    // Clear remaining balance to ₱0.00 upon checkout or completion
    if (booking.status === 'Checked Out' || booking.status === 'Completed' || booking.status === 'Cancelled') {
      balance = 0;
    }

    // Persist computed remaining balance and downpayment to billing and booking records
    if (billingID) {
      try {
        await dbQuery(
          "UPDATE billing SET totalAmount = ?, downPaymentAmount = ?, remainingBalance = ?, balance = ? WHERE billingID = ?",
          [subtotal, downPaymentPaid, balance, balance, billingID]
        );
        await dbQuery(
          "UPDATE booking SET remainingBalance = ?, finalBalance = ? WHERE bookingID = ?",
          [balance, balance, bookingID]
        );
      } catch (syncErr) {
        // non-blocking sync
      }
    }

    let auditLogs = [];
    try {
      auditLogs = await dbQuery(
        `SELECT auditID, billingID, bookingID, transactionType, amount,
                balanceBefore, balanceAfter, userID, userName, userRole,
                description, referenceNumber,
                DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') as createdAt
         FROM billing_audit
         WHERE bookingID = ?
         ORDER BY createdAt DESC, auditID DESC
         LIMIT 100`,
        [bookingID]
      );
    } catch (e) {}

    const chargesSummary = {
      room: finalRoomCharge,
      baseRoomCharge,
      roomRate: rate,
      nights,
      breakfastOption,
      originalRoomCharge: baseRoomCharge,
      totalDiscount,
      sharePerGuest,
      totalGuests: totalGuestsCount,
      downPaymentPaid,
      downPaymentPercentage,
      roomBalance,
      extraGuests,
      extraGuestFee,
      extraGuestFeeTag: 'Final Billing Only',
      earlyCheckIn: earlyCheckInFee,
      lateCheckOut: lateCheckOutFee,
      lateHours,
      lateCheckOutRule: '1-22 hrs: ₱100/hr | >22 hrs: Full room rate',
      totalAdditionalFees,
      products: productTotal,
      amenities: amenityTotal,
      orders: ordersTotal,
      incidentals: regularIncidentalTotal,
      totalIncidentalsWithEarly,
      total: subtotal,
      subtotal,
      paid: paidTotal,
      balance,
      finalCheckoutBalance,
      remainingBalance: balance
    };

    return {
      booking,
      nights,
      rate,
      baseRoomCharge,
      extraGuests,
      extraGuestFee,
      roomCharge: baseRoomCharge,
      totalGuestsCount,
      sharePerGuest,
      finalGuestsList,
      totalDiscount,
      finalRoomCharge,
      earlyCheckInFee,
      lateCheckOutFee,
      lateHours,
      lateCheckOutRule: '1-22 hrs: ₱100/hr | >22 hrs: Full room rate',
      totalAdditionalFees,
      productTotal,
      amenityTotal,
      ordersTotal,
      incidentalTotal: regularIncidentalTotal,
      regularIncidentalTotal,
      totalIncidentalsWithEarly,
      productCharges,
      amenityCharges,
      incidentalCharges: filteredIncidentals,
      allIncidentalCharges: incidentalCharges,
      subtotal,
      paidTotal,
      balance,
      remainingBalance: balance,
      billingID,
      paymentsList,
      auditLogs,
      chargesSummary
    };
  } catch (error) {
    console.error("Error in getBookingBalanceDetails:", error);
    return {
      booking: null,
      subtotal: 0,
      paidTotal: 0,
      balance: 0,
      remainingBalance: 0,
      chargesSummary: {
        room: 0,
        total: 0,
        paid: 0,
        balance: 0,
        remainingBalance: 0
      }
    };
  }
}

export async function getBookingBalance(bookingID) {
  const details = await getBookingBalanceDetails(bookingID);
  return details.balance || 0;
}

export async function completeBookingAndFreeRoom(bookingID, options = {}) {
  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [bookingRows] = await conn.execute(
      "SELECT bookingID, roomID, status, guestID FROM booking WHERE bookingID = ? FOR UPDATE",
      [bookingID]
    );

    if (bookingRows.length === 0) {
      await conn.rollback();
      return { error: 'Booking not found.' };
    }

    const b = bookingRows[0];

    // Idempotency: If already completed, commit and return current state
    if (b.status === 'Completed') {
      await conn.commit();
      return { success: true, bookingID, status: 'Completed', roomStatus: 'Available', alreadyCompleted: true };
    }

    const localNow = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

    // 1. Update booking status to 'Completed'
    await conn.execute(
      "UPDATE booking SET status = 'Completed', checkOutDateTime = ? WHERE bookingID = ?",
      [nowStr, bookingID]
    );

    // 2. Free room to 'Available'
    if (b.roomID) {
      await conn.execute(
        "UPDATE room SET status = 'Available' WHERE roomID = ? AND (isArchived IS NULL OR isArchived = 0)",
        [b.roomID]
      );
    }

    // Note: Reservation lifecycle concluded at 'Booked'. It is not updated to 'Completed'.

    // 3. Auto-return active borrowed amenities
    await conn.execute(
      "UPDATE borrow_transaction SET status = 'Returned', conditionUponReturn = 'Good', actualReturnDate = ?, remarks = 'Auto-returned upon check-out completion' WHERE bookingID = ? AND status = 'Borrowed'",
      [nowStr, bookingID]
    );

    await conn.commit();
    return { success: true, bookingID, status: 'Completed', roomStatus: 'Available' };
  } catch (err) {
    await conn.rollback();
    console.error("Error in completeBookingAndFreeRoom:", err);
    throw err;
  } finally {
    conn.release();
  }
}

export async function ensureSystemAuditSchema() {
  try {
    const conn = await getDbConnection();
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS system_audit (
        systemAuditID INT AUTO_INCREMENT PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        details JSON NULL,
        userID INT NULL,
        userName VARCHAR(150) NULL,
        userRole VARCHAR(50) NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_action (action),
        INDEX idx_createdAt (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});
  } catch (e) {
    console.error("Error ensuring system audit schema:", e);
  }
}

export async function logSystemAudit({ action, details, userID = null, userName = null, userRole = null }) {
  try {
    await ensureSystemAuditSchema();
    const conn = await getDbConnection();
    const detailsVal = typeof details === 'object' ? JSON.stringify(details) : details;
    await conn.execute(
      `INSERT INTO system_audit (action, details, userID, userName, userRole, createdAt) VALUES (?, ?, ?, ?, ?, NOW())`,
      [action, detailsVal, userID, userName, userRole]
    );
  } catch (err) {
    console.error("Failed to log system audit:", err);
  }
}

export async function resetGuestTransactions({ userID = null, userName = null, userRole = null } = {}) {
  await ensureBillingAuditSchema();
  await ensureSystemAuditSchema();

  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    await conn.execute("SET FOREIGN_KEY_CHECKS = 0");
    await conn.beginTransaction();

    const transactionalTables = [
      'transactions',
      'payment',
      'payment_logs',
      'billing_room',
      'billing_product',
      'billing_amenity',
      'incidental_charge',
      'billing',
      'order_product',
      'order_amenities',
      'orders',
      'borrow_transaction',
      'booking_guest_details',
      'booking',
      'reservation',
      'inquiry_message',
      'inquiry',
      'notification',
      'billing_audit'
    ];

    const clearedCounts = {};
    let totalCleared = 0;

    for (const table of transactionalTables) {
      try {
        const [cntRows] = await conn.execute(`SELECT COUNT(*) as count FROM \`${table}\``);
        const count = cntRows[0]?.count || 0;
        clearedCounts[table] = count;
        totalCleared += count;

        // Ultra-fast TRUNCATE with fallback to DELETE FROM + AUTO_INCREMENT = 1
        try {
          await conn.execute(`TRUNCATE TABLE \`${table}\``);
        } catch (truncErr) {
          await conn.execute(`DELETE FROM \`${table}\``);
          await conn.execute(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`).catch(() => {});
        }
      } catch (tableErr) {
        clearedCounts[table] = 0;
      }
    }

    // Clear transaction-related inventory movements
    try {
      await conn.execute(`
        DELETE FROM \`inventory_movement\` 
        WHERE \`movementType\` IN ('Borrow', 'Return') 
           OR \`referenceNumber\` LIKE 'BK%' 
           OR \`referenceNumber\` LIKE 'RES%' 
           OR \`referenceNumber\` LIKE 'ORD%' 
           OR \`referenceNumber\` LIKE 'BOR%'
      `);
    } catch (e) {}

    // Reset room statuses to 'Available' (except Under Maintenance)
    let roomsResetCount = 0;
    try {
      const [roomUpdate] = await conn.execute(`
        UPDATE \`room\` 
        SET \`status\` = 'Available' 
        WHERE \`status\` != 'Under Maintenance'
      `);
      roomsResetCount = roomUpdate.affectedRows || 0;
    } catch (e) {}

    await conn.commit();
    await conn.execute("SET FOREIGN_KEY_CHECKS = 1");

    // Insert persistent system notification for all receptionists (roleID = 2)
    try {
      const [recepUsers] = await conn.execute(
        "SELECT userID FROM user WHERE roleID = 2 AND status = 'Active'"
      );
      if (Array.isArray(recepUsers) && recepUsers.length > 0) {
        for (const u of recepUsers) {
          await conn.execute(
            `INSERT INTO notification (userID, title, message, isRead, createdAt) 
             VALUES (?, 'System Transactions Reset', 'An Administrator has reset all transaction records for testing. Active bookings, reservations, and orders have been cleared.', 0, NOW())`,
            [u.userID]
          );
        }
      }
    } catch (notifErr) {
      console.error("Error inserting receptionist reset notifications:", notifErr);
    }

    // Structured JSON audit logging for system_audit
    const auditPayload = {
      message: 'Admin Reset Transactions executed – Guest transactions cleared.',
      clearedCounts,
      totalCleared,
      roomsResetToAvailable: roomsResetCount,
      executedBy: userName || 'Administrator',
      executedRole: userRole || 'Administrator',
      timestamp: new Date().toISOString()
    };

    await logSystemAudit({
      action: 'Reset Transactions',
      details: auditPayload,
      userID,
      userName,
      userRole
    });

    // Logging to billing_audit
    await logBillingAudit(conn, {
      bookingID: 0,
      transactionType: 'System Reset',
      amount: 0,
      balanceBefore: 0,
      balanceAfter: 0,
      userID,
      userName,
      userRole,
      description: 'Admin Reset Transactions executed – Guest transactions cleared.'
    });

    // Verification of master data preserved
    let preservedUsers = 0, preservedRooms = 0, preservedProducts = 0, preservedAmenities = 0;
    try {
      const [uRows] = await conn.execute("SELECT COUNT(*) as count FROM user");
      preservedUsers = uRows[0]?.count || 0;
      const [rRows] = await conn.execute("SELECT COUNT(*) as count FROM room WHERE status = 'Available'");
      preservedRooms = rRows[0]?.count || 0;
      const [pRows] = await conn.execute("SELECT COUNT(*) as count FROM products");
      preservedProducts = pRows[0]?.count || 0;
      const [aRows] = await conn.execute("SELECT COUNT(*) as count FROM amenities");
      preservedAmenities = aRows[0]?.count || 0;
    } catch (e) {}

    return {
      success: true,
      message: 'All Admin and Guest transaction records have been cleanly reset.',
      clearedRecords: clearedCounts,
      totalCleared,
      roomsResetToAvailable: roomsResetCount,
      masterDataPreserved: {
        users: preservedUsers,
        availableRooms: preservedRooms,
        products: preservedProducts,
        amenities: preservedAmenities
      },
      nextIDs: {
        reservationID: 'RV00001 (id: 1)',
        bookingID: 'BK00001 (id: 1)',
        transactionID: 'TRA00001 (id: 1)',
        orderID: 'ORD00001 (id: 1)'
      }
    };
  } catch (err) {
    await conn.rollback().catch(() => {});
    await conn.execute("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
    console.error("Error in resetGuestTransactions:", err);
    throw err;
  } finally {
    conn.release();
  }
}


