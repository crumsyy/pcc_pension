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
let isUserSessionSchemaChecked = false;

export async function ensureUserSessionSchema() {
  if (isUserSessionSchemaChecked) return;
  try {
    const conn = await getDbConnection();
    await conn.execute("ALTER TABLE `user` ADD COLUMN `sessionToken` VARCHAR(255) DEFAULT NULL").catch(() => {});
    isUserSessionSchemaChecked = true;
  } catch (e) {}
}

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

let isBookingBreakfastSchemaChecked = false;

export async function ensureBookingBreakfastSchema(connection) {
  if (isBookingBreakfastSchemaChecked && !connection) return;
  try {
    const conn = connection || (await getDbConnection());
    const [columns] = await conn.query(
      "SHOW COLUMNS FROM `booking` LIKE 'breakfastDates'"
    );
    if (columns.length === 0) {
      await conn.query(
        "ALTER TABLE `booking` ADD COLUMN `breakfastDates` JSON DEFAULT NULL"
      );
      console.log("✅ Auto-Repair: Added 'breakfastDates' column to 'booking' table.");
    }
    const [feeCols] = await conn.query(
      "SHOW COLUMNS FROM `booking` LIKE 'breakfastFee'"
    );
    if (feeCols.length === 0) {
      await conn.query(
        "ALTER TABLE `booking` ADD COLUMN `breakfastFee` DECIMAL(10,2) DEFAULT 0.00"
      );
      console.log("✅ Auto-Repair: Added 'breakfastFee' column to 'booking' table.");
    }
    const [resCols] = await conn.query(
      "SHOW COLUMNS FROM `reservation` LIKE 'breakfastDates'"
    );
    if (resCols.length === 0) {
      await conn.query(
        "ALTER TABLE `reservation` ADD COLUMN `breakfastDates` JSON DEFAULT NULL"
      );
      console.log("✅ Auto-Repair: Added 'breakfastDates' column to 'reservation' table.");
    }
    const [resFeeCols] = await conn.query(
      "SHOW COLUMNS FROM `reservation` LIKE 'breakfastFee'"
    );
    if (resFeeCols.length === 0) {
      await conn.query(
        "ALTER TABLE `reservation` ADD COLUMN `breakfastFee` DECIMAL(10,2) DEFAULT 0.00"
      );
      console.log("✅ Auto-Repair: Added 'breakfastFee' column to 'reservation' table.");
    }
    isBookingBreakfastSchemaChecked = true;
  } catch (error) {
    console.warn("⚠️ Non-fatal DB Migration Check Warning:", error.message);
  }
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
    "SELECT filename, subFolder, mimeType, fileSize, data FROM uploaded_files WHERE filename = ? LIMIT 1",
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
    await conn.execute("ALTER TABLE payment ADD COLUMN changeAmount DECIMAL(10,2) DEFAULT 0.00").catch(() => {});
    await conn.execute("UPDATE payment SET changeAmount = `change` WHERE (changeAmount = 0.00 OR changeAmount IS NULL) AND `change` > 0").catch(() => {});
    await conn.execute(`
      CREATE OR REPLACE VIEW PaymentHistory AS 
      SELECT p.paymentID, p.amount, p.cashReceived, p.change, COALESCE(p.changeAmount, p.change, 0) as changeAmount, p.paymentDate, p.billingID, p.guestID, p.staffID, p.paymentMethodID, p.status, p.referenceNumber, p.testMode,
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
  changeAmount = 0,
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

  const resolvedChange = changeAmount || change || 0;
  const [paymentInsert] = await conn.execute(
    `INSERT INTO payment (amount, cashReceived, \`change\`, changeAmount, billingID, guestID, staffID, paymentMethodID, discountID, promotionID, testMode, status, referenceNumber, paymentDate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`,
    [amount, cashReceived || amount, resolvedChange, resolvedChange, billingID, guestID, staffID, paymentMethodID, testMode, status, referenceNumber, nowStr]
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
    await ensureBookingBreakfastSchema(conn);
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
    await conn.execute("ALTER TABLE booking ADD COLUMN actualCheckOut DATETIME NULL").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN breakfastOption VARCHAR(20) NULL DEFAULT 'without'").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN breakfastID INT(11) DEFAULT 1").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN subtotal DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN discountTotal DECIMAL(10,2) NULL DEFAULT 0.00").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN netTotal DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN vatRate DECIMAL(5,2) NULL DEFAULT 0.00").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN vatAmount DECIMAL(10,2) NULL DEFAULT 0.00").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN grandTotal DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN guestCount INT DEFAULT 1").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD COLUMN updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN subtotal DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN discountTotal DECIMAL(10,2) NULL DEFAULT 0.00").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN netTotal DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN vatRate DECIMAL(5,2) NULL DEFAULT 0.00").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN vatAmount DECIMAL(10,2) NULL DEFAULT 0.00").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN grandTotal DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN balance DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN totalAmount DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN downPaymentAmount DECIMAL(10,2) NULL DEFAULT 0.00").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN downPaymentPercentage INT NULL DEFAULT 50").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN remainingBalance DECIMAL(10,2) NULL").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN missingAmenitiesFee DECIMAL(10,2) DEFAULT 0.00").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN reservationID INT NULL DEFAULT NULL").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN billingStatus VARCHAR(50) NULL DEFAULT 'Pending'").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN isBillFinalized TINYINT(1) NOT NULL DEFAULT 0").catch(() => {});
    await conn.execute("ALTER TABLE billing ADD COLUMN updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP").catch(() => {});
    await conn.execute("ALTER TABLE reservation MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Pending'").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN guestCount INT DEFAULT 1").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN breakfastOption VARCHAR(20) DEFAULT 'with'").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN checkOutDateTime DATETIME DEFAULT NULL").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN specialRequests TEXT DEFAULT NULL").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN isCourtesyHold TINYINT(1) DEFAULT 0").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN holdDurationHours INT NULL").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN holdExpiryDateTime DATETIME NULL").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN warning12SentAt DATETIME NULL").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN warning6SentAt DATETIME NULL").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN releasedAt DATETIME NULL").catch(() => {});
    await conn.execute("ALTER TABLE reservation ADD COLUMN guestEmail VARCHAR(150) NULL").catch(() => {});
    await conn.execute("ALTER TABLE guest ADD COLUMN email VARCHAR(255) NULL").catch(() => {});
    await conn.execute("ALTER TABLE room ADD COLUMN occupancyLimit INT DEFAULT 4").catch(() => {});
    await conn.execute("ALTER TABLE room_type ADD COLUMN maxOccupancy INT DEFAULT 4").catch(() => {});
    await conn.execute("ALTER TABLE room_type ADD COLUMN capacity INT DEFAULT 4").catch(() => {});
    await conn.execute("ALTER TABLE orders ADD COLUMN bookingID INT DEFAULT NULL").catch(() => {});
    await conn.execute("ALTER TABLE orders ADD COLUMN isBreakfast TINYINT(1) DEFAULT 0").catch(() => {});
    await conn.execute("ALTER TABLE orders ADD COLUMN hasCookedMeal TINYINT(1) DEFAULT 0").catch(() => {});
    await conn.execute("ALTER TABLE order_product ADD COLUMN isComplimentary TINYINT(1) DEFAULT 0").catch(() => {});
    await conn.execute("ALTER TABLE order_product ADD COLUMN unitPrice DECIMAL(10,2) DEFAULT NULL").catch(() => {});
    await conn.execute("ALTER TABLE order_amenities ADD COLUMN unitPrice DECIMAL(10,2) DEFAULT NULL").catch(() => {});
    await conn.execute("ALTER TABLE payment ADD COLUMN changeAmount DECIMAL(10,2) DEFAULT 0.00").catch(() => {});

    // Safe Backfills
    await conn.execute(`
      UPDATE booking 
      SET breakfastID = CASE 
        WHEN breakfastOption LIKE '%with%' AND breakfastOption NOT LIKE '%without%' THEN 2 
        ELSE 1 
      END
      WHERE breakfastID IS NULL OR breakfastID = 1
    `).catch(() => {});
    await conn.execute(`
      UPDATE order_amenities oa
      JOIN amenities a ON a.amenityID = oa.amenityID
      SET oa.unitPrice = a.price
      WHERE oa.unitPrice IS NULL
    `).catch(() => {});
    await conn.execute(`
      UPDATE payment 
      SET changeAmount = \`change\` 
      WHERE (changeAmount = 0.00 OR changeAmount IS NULL) AND \`change\` > 0
    `).catch(() => {});

    // Ensure unitPrice is populated on order_product from products catalog
    await conn.execute(`
      UPDATE order_product op
      JOIN products p ON p.productID = op.productID
      SET op.unitPrice = p.price
      WHERE op.unitPrice IS NULL OR op.unitPrice = 0.00
    `).catch(() => {});

    // Safe breakfast package consistency backfill for bookings without breakfast
    await conn.execute(`
      UPDATE order_product op
      JOIN orders o ON o.orderID = op.orderID
      JOIN booking b ON b.bookingID = o.bookingID
      SET op.isComplimentary = 0
      WHERE (b.breakfastOption LIKE '%without%' OR b.breakfastID = 1) AND op.isComplimentary = 1
    `).catch(() => {});

    // Ensure High-Frequency Composite Indices
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_room_occupancy ON room (roomID, occupancyLimit)").catch(() => {});
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_booking_billing_perf ON booking (bookingID, status, roomID)").catch(() => {});
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders (bookingID, deliveryDate, orderStatus)").catch(() => {});
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_order_comp_perf ON order_product (orderID, isComplimentary)").catch(() => {});
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_room_rate_lookup ON room_rate (roomTypeID, floorID, breakfastID)").catch(() => {});
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_booking_dates_status ON booking (roomID, status, checkInDateTime, checkOutDateTime)").catch(() => {});
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_booking ON orders (bookingID, orderStatus)").catch(() => {});
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_billing_booking ON billing (bookingID)").catch(() => {});
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_payment_billing ON payment (billingID)").catch(() => {});
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_billing_lookup ON billing (bookingID, reservationID, billingStatus)").catch(() => {});
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_booking_active_stay ON booking (guestID, status, checkInDateTime)").catch(() => {});
    await conn.execute("UPDATE room SET occupancyLimit = 4 WHERE occupancyLimit IS NULL OR occupancyLimit < 1").catch(() => {});

    // Ensure Foreign Key Constraints
    await conn.execute("ALTER TABLE orders ADD CONSTRAINT fk_orders_booking FOREIGN KEY (bookingID) REFERENCES booking (bookingID) ON DELETE SET NULL").catch(() => {});
    await conn.execute("ALTER TABLE booking ADD CONSTRAINT fk_booking_breakfast FOREIGN KEY (breakfastID) REFERENCES breakfast_option (breakfastID)").catch(() => {});

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS incidental_charge (
        chargeID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        bookingID INT NOT NULL,
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_incidental_booking (bookingID)
      )
    `).catch(() => {});
    await conn.execute("CREATE INDEX idx_incidental_booking ON incidental_charge (bookingID)").catch(() => {});

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS booking_incidentals (
        incidentalID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        bookingID INT NOT NULL,
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bkinc_bookingID (bookingID)
      )
    `).catch(() => {});
    await conn.execute("CREATE INDEX idx_bkinc_bookingID ON booking_incidentals (bookingID)").catch(() => {});
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS booking_guest_details (
        bookingGuestID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        bookingID INT NOT NULL,
        fullName VARCHAR(150) NOT NULL,
        age INT DEFAULT 30,
        discountID INT DEFAULT NULL,
        promotionID INT DEFAULT NULL,
        discountIdNumber VARCHAR(100) DEFAULT NULL
      )
    `).catch(() => {});
    await conn.execute("ALTER TABLE booking_guest_details ADD COLUMN promotionID INT DEFAULT NULL").catch(() => {});
    await conn.execute("ALTER TABLE booking_guest_details ADD COLUMN discountIdNumber VARCHAR(100) DEFAULT NULL").catch(() => {});
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS booking_discount (
        bookingDiscountID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        bookingID INT NOT NULL,
        guestName VARCHAR(150) NOT NULL,
        discountID INT DEFAULT NULL,
        discountIdNumber VARCHAR(100) DEFAULT NULL,
        discountAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bd_bookingID (bookingID)
      )
    `).catch(() => {});

    // Room integrity: Ensure all active rooms have valid roomTypeID and floorID
    await conn.execute("UPDATE room SET roomTypeID = 1 WHERE (roomTypeID IS NULL OR roomTypeID = 0) AND isArchived = 0").catch(() => {});
    await conn.execute("UPDATE room SET floorID = 1 WHERE (floorID IS NULL OR floorID = 0) AND roomNumber LIKE '1%' AND isArchived = 0").catch(() => {});
    await conn.execute("UPDATE room SET floorID = 2 WHERE (floorID IS NULL OR floorID = 0) AND roomNumber LIKE '2%' AND isArchived = 0").catch(() => {});
    await conn.execute("UPDATE room SET floorID = 1 WHERE (floorID IS NULL OR floorID = 0) AND isArchived = 0").catch(() => {});

    // Ensure baseline room_rate rows exist for all room types and floors
    await conn.execute(`
      INSERT INTO room_rate (rate, roomTypeID, floorID, breakfastID)
      SELECT 1200.00, r.roomTypeID, r.floorID, 1
      FROM (SELECT DISTINCT roomTypeID, floorID FROM room WHERE isArchived = 0) r
      LEFT JOIN room_rate rr ON rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID AND rr.breakfastID = 1
      WHERE rr.roomRateID IS NULL AND r.roomTypeID IS NOT NULL AND r.floorID IS NOT NULL
    `).catch(() => {});

    await conn.execute(`
      INSERT INTO room_rate (rate, roomTypeID, floorID, breakfastID)
      SELECT 1400.00, r.roomTypeID, r.floorID, 2
      FROM (SELECT DISTINCT roomTypeID, floorID FROM room WHERE isArchived = 0) r
      LEFT JOIN room_rate rr ON rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID AND rr.breakfastID = 2
      WHERE rr.roomRateID IS NULL AND r.roomTypeID IS NOT NULL AND r.floorID IS NOT NULL
    `).catch(() => {});

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        settingKey VARCHAR(50) NOT NULL PRIMARY KEY,
        settingValue VARCHAR(255) NOT NULL,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `).catch(() => {});
    await conn.execute(`
      INSERT IGNORE INTO system_settings (settingKey, settingValue)
      VALUES ('vat_percentage', '12.00')
    `).catch(() => {});

    isBookingBillingSchemaChecked = true;
  } catch (e) {}
}

export * from './bookingStatuses.js';

export async function getSystemVatRate() {
  return 0.00;
}

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
                 WHEN SUM(CASE WHEN status IN ('Checked In', 'Active Stay', 'Late Checkout', 'Pending Room Verification', 'Pending Checkout', 'Checkout Requested', 'Room Verified', 'Pending Bill', 'Bill Finalized', 'Final Billing Updated', 'Paid', 'Payment Completed') THEN 1 ELSE 0 END) > 0 THEN 'Occupied'
                 WHEN SUM(CASE WHEN status IN ('Pending Check-in', 'Overdue Check-In', 'Confirmed', 'Pending', 'Booked') AND checkOutDateTime >= CURDATE() AND checkInDateTime <= DATE_ADD(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) > 0 THEN 'Reserved'
                 ELSE NULL
               END as calcStatus
        FROM booking
        WHERE status NOT IN ('Cancelled', 'Checked Out', 'No Show', 'Completed')
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
    const [createdCols] = await conn.execute("SHOW COLUMNS FROM orders LIKE 'createdAt'");
    if (createdCols.length === 0) {
      await conn.execute("ALTER TABLE orders ADD COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER orderDateTime").catch(() => {});
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

    // Ensure updatedAt column exists on inquiry
    const [updCols] = await conn.execute("SHOW COLUMNS FROM inquiry LIKE 'updatedAt'");
    if (updCols.length === 0) {
      await conn.execute("ALTER TABLE inquiry ADD COLUMN updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    }

    // 3. Modify status column to support 'Pending', 'Responded', 'Closed'
    await conn.execute("ALTER TABLE inquiry MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Pending'");
    await conn.execute("ALTER TABLE reservation MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Pending'").catch(() => {});
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_inquiry_active ON inquiry (guestID, status, updatedAt)").catch(() => {});

    // 4. Create inquiry_message table if not exists with normalized schema
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS inquiry_message (
        messageID INT AUTO_INCREMENT PRIMARY KEY,
        inquiryID INT NOT NULL,
        senderRole ENUM('guest', 'receptionist', 'admin', 'bot') NOT NULL DEFAULT 'guest',
        senderType ENUM('Guest', 'Receptionist', 'System') NOT NULL DEFAULT 'Guest',
        senderID INT NOT NULL DEFAULT 0,
        senderName VARCHAR(100) NOT NULL DEFAULT 'Guest',
        messageText TEXT NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Delivered',
        isRead TINYINT(1) DEFAULT 0,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        readAt DATETIME DEFAULT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (inquiryID)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure columns exist on inquiry_message if created previously
    const [statusCols] = await conn.execute("SHOW COLUMNS FROM inquiry_message LIKE 'status'");
    if (statusCols.length === 0) {
      await conn.execute("ALTER TABLE inquiry_message ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Delivered'");
    }
    const [senderRoleCols] = await conn.execute("SHOW COLUMNS FROM inquiry_message LIKE 'senderRole'");
    if (senderRoleCols.length === 0) {
      await conn.execute("ALTER TABLE inquiry_message ADD COLUMN senderRole ENUM('guest', 'receptionist', 'admin', 'bot') NOT NULL DEFAULT 'guest'");
    }
    const [senderIDCols] = await conn.execute("SHOW COLUMNS FROM inquiry_message LIKE 'senderID'");
    if (senderIDCols.length === 0) {
      await conn.execute("ALTER TABLE inquiry_message ADD COLUMN senderID INT NOT NULL DEFAULT 0");
    }
    const [msgTextCols] = await conn.execute("SHOW COLUMNS FROM inquiry_message LIKE 'messageText'");
    if (msgTextCols.length === 0) {
      await conn.execute("ALTER TABLE inquiry_message ADD COLUMN messageText TEXT NULL");
    }
    const [readAtCols] = await conn.execute("SHOW COLUMNS FROM inquiry_message LIKE 'readAt'");
    if (readAtCols.length === 0) {
      await conn.execute("ALTER TABLE inquiry_message ADD COLUMN readAt DATETIME DEFAULT NULL");
    }
    const [createdAtCols] = await conn.execute("SHOW COLUMNS FROM inquiry_message LIKE 'createdAt'");
    if (createdAtCols.length === 0) {
      await conn.execute("ALTER TABLE inquiry_message ADD COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
    }

    // Composite indices for fast unread counts and conversation threads
    await conn.execute("CREATE INDEX idx_inquiry_thread_status ON inquiry_message (inquiryID, status, createdAt)").catch(() => {});
    await conn.execute("CREATE INDEX idx_inquiry_unread ON inquiry_message (inquiryID, senderRole, status)").catch(() => {});

    // Non-destructive backfills
    await conn.execute("UPDATE inquiry_message SET status = 'Delivered' WHERE status IS NULL OR status = ''").catch(() => {});
    await conn.execute("UPDATE inquiry_message SET senderRole = LOWER(senderType) WHERE senderRole IS NULL OR senderRole = ''").catch(() => {});
    await conn.execute("UPDATE inquiry_message SET messageText = message WHERE messageText IS NULL OR messageText = ''").catch(() => {});
    await conn.execute("UPDATE inquiry_message SET message = messageText WHERE (message IS NULL OR message = '') AND messageText IS NOT NULL").catch(() => {});
    await conn.execute("UPDATE inquiry_message SET readAt = timestamp WHERE (status = 'Read' OR isRead = 1) AND readAt IS NULL").catch(() => {});

    // 5. Migrate legacy message/response in inquiry table to inquiry_message table if inquiry_message is empty
    const [msgCheck] = await conn.execute("SELECT messageID FROM inquiry_message LIMIT 1");
    if (msgCheck.length === 0) {
      const [existingInquiries] = await conn.execute("SELECT inquiryID, name, message, response, createdAt FROM inquiry");
      for (const inq of existingInquiries) {
        if (inq.message) {
          await conn.execute(
            "INSERT INTO inquiry_message (inquiryID, senderRole, senderType, senderName, messageText, message, status, isRead, createdAt, timestamp) VALUES (?, 'guest', 'Guest', ?, ?, ?, 'Delivered', 1, ?, ?)",
            [inq.inquiryID, inq.name || 'Guest', inq.message, inq.message, inq.createdAt, inq.createdAt]
          );
        }
        if (inq.response) {
          await conn.execute(
            "INSERT INTO inquiry_message (inquiryID, senderRole, senderType, senderName, messageText, message, status, isRead, createdAt, timestamp) VALUES (?, 'receptionist', 'Receptionist', 'Front Desk', ?, ?, 'Delivered', 1, ?, ?)",
            [inq.inquiryID, inq.response, inq.response, inq.createdAt, inq.createdAt]
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

export function calculateRequiredDownPayment(roomRate, nights, downPaymentPercentage = 50) {
  const baseRoomCharge = Math.round((parseFloat(roomRate) || 0) * Math.max(1, parseInt(nights) || 1) * 100) / 100;
  const ratio = (parseInt(downPaymentPercentage, 10) || 50) / 100;
  return Math.round(baseRoomCharge * ratio * 100) / 100;
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
             COALESCE(b.vatRate, NULL) as storedVatRate,
             COALESCE(b.vatAmount, NULL) as storedVatAmount,
             COALESCE(b.grandTotal, NULL) as storedGrandTotal,
             COALESCE(b.breakfastOption, NULL) as storedBreakfastOption,
             (CASE 
                WHEN b.breakfastOption LIKE '%with%' AND b.breakfastOption NOT LIKE '%without%' THEN 2 
                WHEN b.breakfastID = 2 THEN 2 
                WHEN res.breakfastOption LIKE '%with%' AND res.breakfastOption NOT LIKE '%without%' THEN 2 
                ELSE 1 
              END) as breakfastID,
             COALESCE(b.guestCount, res.guestCount, 1) as totalGuestsCount,
             COALESCE(res.guestCount, b.guestCount, 1) as resGuestCount,
             COALESCE(res.breakfastOption, b.breakfastOption, 'without') as resBreakfastOption,
             b.breakfastDates,
             COALESCE(b.breakfastFee, 0) as storedBreakfastFee,
             res.breakfastDates as resBreakfastDates,
             COALESCE(rm.roomNumber, 'N/A') as roomNumber, 
             rm.floorID, 
             COALESCE(rm.occupancyLimit, 4) as occupancyLimit,
             COALESCE(rm.occupancyLimit, 4) as maxOccupancy,
             COALESCE(rm.occupancyLimit, 4) as roomBasePax,
             COALESCE(rt.type, 'Standard Room') as roomType, 
             COALESCE(rt.roomTypeID, rm.roomTypeID, 1) as roomTypeID,
             COALESCE(g.firstName, 'Guest') as firstName, 
             COALESCE(g.lastName, CONCAT('#', b.guestID)) as lastName, 
             g.contact, g.email,
             rr.roomRateID,
             rr.rate as catalogRoomRate
      FROM booking b
      LEFT JOIN reservation res ON res.reservationID = b.reservationID
      LEFT JOIN guest g ON g.guestID = b.guestID
      LEFT JOIN room rm ON rm.roomID = b.roomID
      LEFT JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      LEFT JOIN breakfast_option bo ON bo.breakfastID = (CASE 
        WHEN b.breakfastOption LIKE '%with%' AND b.breakfastOption NOT LIKE '%without%' THEN 2 
        WHEN b.breakfastID = 2 THEN 2 
        WHEN res.breakfastOption LIKE '%with%' AND res.breakfastOption NOT LIKE '%without%' THEN 2 
        ELSE 1 
      END)
      LEFT JOIN room_rate rr ON rr.roomTypeID = rm.roomTypeID 
                            AND rr.floorID = rm.floorID 
                            AND rr.breakfastID = bo.breakfastID
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

    // Defensive parsing of night-by-night breakfast selection
    let parsedBreakfastDates = [];
    try {
      const rawDates = booking.breakfastDates || booking.resBreakfastDates;
      parsedBreakfastDates = typeof rawDates === 'string'
        ? JSON.parse(rawDates || '[]')
        : (Array.isArray(rawDates) ? rawDates : []);
    } catch (e) {
      parsedBreakfastDates = [];
    }
    booking.breakfastDates = parsedBreakfastDates;
    booking.breakfastFee = parseFloat(booking.storedBreakfastFee || 0);

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
    let rawOption = booking.storedBreakfastOption || booking.resBreakfastOption || '';
    const hasPackageBreakfast = (parsedBreakfastDates.length > 0) || parseInt(booking.breakfastID) === 2 || 
      (rawOption && rawOption.toLowerCase().includes('with') && !rawOption.toLowerCase().includes('without'));
    const breakfastID = hasPackageBreakfast ? 2 : 1;
    const breakfastOption = hasPackageBreakfast ? 'with' : 'without';

    // Fetch rate, guests/discounts, order products, amenities, incidentals, billing, orders, and booking_discount in parallel
    const [rateRes, guestsList, productChargesRaw, amenityCharges, incidentalCharges, billingRes, rawOrdersList, bookingDiscountsList] = await Promise.all([
      dbQuery(
        "SELECT rate, roomRateID FROM room_rate WHERE roomTypeID = ? AND floorID = ? AND breakfastID = ?",
        [booking.roomTypeID, booking.floorID, breakfastID]
      ).catch(() => []),
      dbQuery(`
        SELECT bg.*, 
               COALESCE(d.name, p.name) as discountName,
               COALESCE(d.percentage, p.percentage, 0) as discountPercentage
        FROM booking_guest_details bg
        LEFT JOIN discounts d ON d.discountID = bg.discountID
        LEFT JOIN promotions p ON p.promotionID = bg.promotionID
        WHERE bg.bookingID = ?
      `, [bookingID]).catch(() => []),
      dbQuery(`
        SELECT op.orderProductID, op.orderID, op.quantity, p.name, p.productCategoryID,
               op.isComplimentary,
               COALESCE(op.unitPrice, p.price) as price, 
               CASE WHEN op.isComplimentary = 1 THEN 0 ELSE (op.quantity * COALESCE(op.unitPrice, p.price)) END as subtotal,
               COALESCE(o.deliveryDate, DATE_FORMAT(o.orderDateTime, '%Y-%m-%d')) as deliveryDate,
               o.deliveryTime, o.deliveryType, o.orderDateTime
        FROM order_product op
        JOIN products p ON p.productID = op.productID
        JOIN orders o ON o.orderID = op.orderID
        WHERE o.bookingID = ?
          AND o.orderStatus NOT IN ('Canceled')
        ORDER BY COALESCE(o.deliveryDate, DATE_FORMAT(o.orderDateTime, '%Y-%m-%d')) ASC, o.orderDateTime ASC, op.orderProductID ASC
      `, [bookingID]).catch(() => []),
      dbQuery(`
        SELECT oa.orderAmenityID, oa.orderID, oa.quantity, a.name, 
               COALESCE(oa.unitPrice, a.price) as price, 
               (oa.quantity * COALESCE(oa.unitPrice, a.price)) as subtotal,
               COALESCE(o.deliveryDate, DATE_FORMAT(o.orderDateTime, '%Y-%m-%d')) as deliveryDate,
               o.deliveryTime, o.deliveryType, o.orderDateTime
        FROM order_amenities oa
        JOIN amenities a ON a.amenityID = oa.amenityID
        JOIN orders o ON o.orderID = oa.orderID
        WHERE o.bookingID = ?
          AND o.orderStatus NOT IN ('Canceled')
      `, [bookingID]).catch(() => []),
      dbQuery(
        "SELECT chargeID, description, amount, createdAt FROM incidental_charge WHERE bookingID = ?",
        [bookingID]
      ).catch(() => []),
      dbQuery("SELECT billingID, COALESCE(isBillFinalized, 0) as isBillFinalized, billingStatus FROM billing WHERE bookingID = ? ORDER BY billingID DESC LIMIT 1", [bookingID]).catch(() => []),
      dbQuery(`
        SELECT o.orderID, o.orderDateTime, o.orderStatus, o.deliveryDate, o.deliveryTime, o.deliveryType,
               COALESCE(o.totalAmount, 0) as totalAmount
        FROM orders o
        WHERE o.bookingID = ?
          AND o.orderStatus NOT IN ('Canceled')
        ORDER BY o.orderDateTime ASC, o.orderID ASC
      `, [bookingID]).catch(() => []),
      dbQuery(`
        SELECT bd.*, COALESCE(d.name, 'Special Discount') as discountName, COALESCE(d.percentage, 0) as discountPercentage
        FROM booking_discount bd
        LEFT JOIN discounts d ON d.discountID = bd.discountID
        WHERE bd.bookingID = ?
      `, [bookingID]).catch(() => [])
    ]);

    let rate = (rateRes.length > 0 && rateRes[0]?.rate != null) 
      ? parseFloat(rateRes[0].rate) 
      : (booking.catalogRoomRate ? parseFloat(booking.catalogRoomRate) : null);
    let roomRateID = (rateRes.length > 0 && rateRes[0]?.roomRateID) 
      ? rateRes[0].roomRateID 
      : booking.roomRateID;

    if (!rate) {
      // Dynamic fallback strictly from room_rate catalog matching roomType, floor and breakfastID
      const [defRate] = await dbQuery(
        "SELECT rate, roomRateID FROM room_rate WHERE roomTypeID = ? AND floorID = ? AND breakfastID = ? LIMIT 1",
        [booking.roomTypeID, booking.floorID, breakfastID]
      ).catch(() => []);
      rate = defRate?.rate ? parseFloat(defRate.rate) : 0;
      roomRateID = defRate?.roomRateID || null;
    }

    const baseRoomCharge = Math.round(rate * nights * 100) / 100;

    // Determine guest count directly from booking/reservation
    let totalGuestsCount = parseInt(booking.totalGuestsCount || booking.resGuestCount) || 1;
    if (totalGuestsCount < 1) totalGuestsCount = 1;

    // Room capacity limit: room.occupancyLimit is the SINGLE SOURCE OF TRUTH
    const roomCapacity = Math.max(1, parseInt(booking.occupancyLimit || 4, 10));
    const extraPax = Math.max(0, totalGuestsCount - roomCapacity);
    const extraGuests = extraPax;
    const extraGuestFee = Math.round(extraPax * 100 * nights * 100) / 100;

    // Proportionate share per guest for multi-beneficiary discount calculations
    const sharePerGuest = baseRoomCharge / Math.max(1, totalGuestsCount);
    let totalDiscount = 0;
    let discountList = [];

    if (bookingDiscountsList && bookingDiscountsList.length > 0) {
      discountList = bookingDiscountsList.map(bd => {
        let discAmt = parseFloat(bd.discountAmount || 0);
        if (discAmt <= 0 && parseFloat(bd.discountPercentage || 0) > 0) {
          discAmt = Math.round(sharePerGuest * (parseFloat(bd.discountPercentage) / 100) * 100) / 100;
        }
        totalDiscount += discAmt;
        return {
          bookingDiscountID: bd.bookingDiscountID,
          bookingID,
          guestName: bd.guestName,
          fullName: bd.guestName,
          discountID: bd.discountID,
          discountIdNumber: bd.discountIdNumber,
          discountAmount: discAmt,
          discountName: bd.discountName || 'Special Discount',
          discountPercentage: parseFloat(bd.discountPercentage || 0)
        };
      });
    } else {
      const qualifyingGuests = (guestsList || []).filter(g => g.discountID || g.promotionID);
      discountList = qualifyingGuests.map(g => {
        const discountPercentage = g.discountPercentage ? parseFloat(g.discountPercentage) : 0;
        const discountAmount = Math.round(sharePerGuest * (discountPercentage / 100) * 100) / 100;
        totalDiscount += discountAmount;
        return {
          bookingDiscountID: 0,
          bookingID,
          guestName: g.fullName,
          fullName: g.fullName,
          discountID: g.discountID || null,
          promotionID: g.promotionID || null,
          discountIdNumber: g.discountIdNumber || null,
          discountAmount,
          discountName: g.discountName || 'Special Discount',
          discountPercentage
        };
      });

      if (discountList.length > 0) {
        // Auto-synchronize missing booking_discount rows in background
        (async () => {
          try {
            for (const d of discountList) {
              await dbQuery(
                "INSERT INTO booking_discount (bookingID, guestName, discountID, discountIdNumber, discountAmount) VALUES (?, ?, ?, ?, ?)",
                [bookingID, d.guestName, d.discountID || null, d.discountIdNumber || null, d.discountAmount]
              );
            }
          } catch (e) {}
        })();
      }
    }

    const finalGuestsList = (guestsList.length > 0 ? guestsList : [{
      bookingGuestID: 0,
      bookingID,
      fullName: `${booking.firstName} ${booking.lastName}`,
      age: 30,
      discountID: null,
      promotionID: null,
      discountIdNumber: null,
      discountName: null,
      discountPercentage: 0
    }]).map(g => {
      const matchedDisc = discountList.find(d => 
        (d.guestName && g.fullName && d.guestName.toLowerCase() === g.fullName.toLowerCase()) || 
        (d.discountIdNumber && g.discountIdNumber && d.discountIdNumber === g.discountIdNumber)
      );
      const discountPercentage = matchedDisc ? matchedDisc.discountPercentage : (g.discountPercentage ? parseFloat(g.discountPercentage) : 0);
      const discountAmount = matchedDisc ? matchedDisc.discountAmount : (Math.round(sharePerGuest * (discountPercentage / 100) * 100) / 100);
      return {
        ...g,
        share: sharePerGuest,
        discount: discountAmount,
        netShare: Math.max(0, sharePerGuest - discountAmount)
      };
    });

    totalDiscount = Math.round(totalDiscount * 100) / 100;
    const finalRoomCharge = Math.max(0, Math.round((baseRoomCharge - totalDiscount) * 100) / 100);

    // Daily complimentary breakfast calendar quota: 2 free meals per day of stay (stay cap: 2 * nights or 2 * selected mornings)
    const maxStayAllowance = (parsedBreakfastDates.length > 0)
      ? (2 * parsedBreakfastDates.length)
      : (hasPackageBreakfast ? (2 * nights) : 0);
    let totalStayComplimentaryUsed = 0;
    const dailyCompUsedMap = {};

    const cookedMealCharges = [];
    const storeProductCharges = [];
    const productCharges = [];

    productChargesRaw.forEach(item => {
      const isCookedMeal = (item.productCategoryID === 3 || (item.name && item.name.toLowerCase().includes('breakfast')));
      const unitPrice = parseFloat(item.price || 0);
      const totalQty = parseInt(item.quantity) || 1;
      const itemDeliveryDate = item.deliveryDate || inDateStr;
      const isDateCoveredByBreakfast = parsedBreakfastDates.length > 0 ? parsedBreakfastDates.includes(itemDeliveryDate) : true;

      if (isCookedMeal) {
        if (!hasPackageBreakfast || maxStayAllowance <= 0 || !isDateCoveredByBreakfast) {
          // Room does not have breakfast package or this date is not covered - all cooked meals are charged
          const paidItem = {
            ...item,
            quantity: totalQty,
            price: unitPrice,
            subtotal: Math.round(totalQty * unitPrice * 100) / 100,
            isFreeBreakfast: false,
            isCookedMeal: true,
            deliveryDate: itemDeliveryDate,
            notes: ''
          };
          cookedMealCharges.push(paidItem);
          productCharges.push(paidItem);
        } else {
          // Room has breakfast package:
          // Daily cap = max 2 complimentary meals per calendar delivery date
          // Stay cap = 2 * nights
          const usedOnDate = dailyCompUsedMap[itemDeliveryDate] || 0;
          const remainingDailyAllowance = Math.max(0, 2 - usedOnDate);
          const remainingStayAllowance = Math.max(0, maxStayAllowance - totalStayComplimentaryUsed);
          const allowableFreeForDate = Math.min(remainingDailyAllowance, remainingStayAllowance);

          const explicitComp = item.isComplimentary != null ? (Number(item.isComplimentary) === 1) : null;
          const wantsFree = explicitComp !== null ? explicitComp : (allowableFreeForDate > 0);

          if (wantsFree && allowableFreeForDate > 0) {
            const freeQty = Math.min(totalQty, allowableFreeForDate);
            const paidQty = totalQty - freeQty;
            totalStayComplimentaryUsed += freeQty;
            dailyCompUsedMap[itemDeliveryDate] = usedOnDate + freeQty;

            if (freeQty > 0) {
              const freeItem = {
                ...item,
                quantity: freeQty,
                price: 0,
                unitPrice: 0,
                subtotal: 0,
                isFreeBreakfast: true,
                isComplimentary: 1,
                isCookedMeal: true,
                deliveryDate: itemDeliveryDate,
                notes: 'Included with Room Package (Complimentary)'
              };
              cookedMealCharges.push(freeItem);
              productCharges.push(freeItem);
            }

            if (paidQty > 0) {
              const paidItem = {
                ...item,
                quantity: paidQty,
                price: unitPrice,
                unitPrice: unitPrice,
                subtotal: Math.round(paidQty * unitPrice * 100) / 100,
                isFreeBreakfast: false,
                isComplimentary: 0,
                isCookedMeal: true,
                deliveryDate: itemDeliveryDate,
                notes: freeQty > 0 ? 'Daily quota exceeded (charged at menu price)' : ''
              };
              cookedMealCharges.push(paidItem);
              productCharges.push(paidItem);
            }
          } else {
            // Already reached 2 free meals on this delivery date or stay cap reached
            const paidItem = {
              ...item,
              quantity: totalQty,
              price: unitPrice,
              unitPrice: unitPrice,
              subtotal: Math.round(totalQty * unitPrice * 100) / 100,
              isFreeBreakfast: false,
              isComplimentary: 0,
              isCookedMeal: true,
              deliveryDate: itemDeliveryDate,
              notes: remainingDailyAllowance <= 0 ? 'Daily complimentary quota (2/day) reached' : ''
            };
            cookedMealCharges.push(paidItem);
            productCharges.push(paidItem);
          }
        }
      } else {
        // Minibar / Store product
        const storeItem = {
          ...item,
          quantity: totalQty,
          price: unitPrice,
          unitPrice: unitPrice,
          subtotal: Math.round(totalQty * unitPrice * 100) / 100,
          isFreeBreakfast: false,
          isComplimentary: 0,
          isCookedMeal: false,
          deliveryDate: itemDeliveryDate,
          notes: ''
        };
        storeProductCharges.push(storeItem);
        productCharges.push(storeItem);
      }
    });

    const cookedMealsTotal = Math.round(cookedMealCharges.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0) * 100) / 100;
    const storeProductsTotal = Math.round(storeProductCharges.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0) * 100) / 100;
    const productTotal = Math.round((cookedMealsTotal + storeProductsTotal) * 100) / 100;
    const amenityTotal = Math.round(amenityCharges.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0) * 100) / 100;
    const ordersTotal = Math.round((cookedMealsTotal + storeProductsTotal + amenityTotal) * 100) / 100;

    // Build unified ordersSummary grouped by distinct orders (meals, snacks/beverages, and amenities)
    const ordersMap = new Map();

    (rawOrdersList || []).forEach(o => {
      ordersMap.set(o.orderID, {
        orderID: o.orderID,
        orderDateTime: o.orderDateTime,
        deliveryDate: o.deliveryDate,
        deliveryTime: o.deliveryTime,
        deliveryType: o.deliveryType || 'immediate',
        orderStatus: o.orderStatus,
        totalAmount: 0,
        items: []
      });
    });

    cookedMealCharges.forEach(item => {
      const oId = item.orderID || 0;
      if (!ordersMap.has(oId)) {
        ordersMap.set(oId, {
          orderID: oId,
          orderDateTime: item.orderDateTime || null,
          deliveryDate: item.deliveryDate,
          deliveryTime: item.deliveryTime || null,
          deliveryType: item.deliveryType || 'scheduled',
          orderStatus: 'Delivered',
          totalAmount: 0,
          items: []
        });
      }
      const ord = ordersMap.get(oId);
      ord.items.push(item);
      ord.totalAmount = Math.round((ord.totalAmount + (parseFloat(item.subtotal) || 0)) * 100) / 100;
    });

    storeProductCharges.forEach(item => {
      const oId = item.orderID || 0;
      if (!ordersMap.has(oId)) {
        ordersMap.set(oId, {
          orderID: oId,
          orderDateTime: item.orderDateTime || null,
          deliveryDate: item.deliveryDate,
          deliveryTime: item.deliveryTime || null,
          deliveryType: item.deliveryType || 'immediate',
          orderStatus: 'Delivered',
          totalAmount: 0,
          items: []
        });
      }
      const ord = ordersMap.get(oId);
      ord.items.push(item);
      ord.totalAmount = Math.round((ord.totalAmount + (parseFloat(item.subtotal) || 0)) * 100) / 100;
    });

    amenityCharges.forEach(item => {
      const oId = item.orderID || 0;
      if (!ordersMap.has(oId)) {
        ordersMap.set(oId, {
          orderID: oId,
          orderDateTime: item.orderDateTime || null,
          deliveryDate: item.deliveryDate,
          deliveryTime: item.deliveryTime || null,
          deliveryType: item.deliveryType || 'immediate',
          orderStatus: 'Delivered',
          totalAmount: 0,
          items: []
        });
      }
      const ord = ordersMap.get(oId);
      ord.items.push(item);
      ord.totalAmount = Math.round((ord.totalAmount + (parseFloat(item.subtotal) || 0)) * 100) / 100;
    });

    const ordersList = Array.from(ordersMap.values()).filter(o => o.items.length > 0 || (o.totalAmount > 0));
    const totalOrderAmount = ordersList.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    const ordersSummary = {
      totalAmount: totalOrderAmount,
      itemsCount: ordersList.length,
      orders: ordersList
    };

    // Check if Early Check-In is recorded in incidental charges
    const earlyCheckInIncidental = incidentalCharges.find(ic =>
      ic.description && ic.description.toLowerCase().includes('early check-in')
    );
    let earlyCheckInFee = earlyCheckInIncidental ? parseFloat(earlyCheckInIncidental.amount) : 0;

    // Filter incidentalTotal to exclude extra capacity charge and advance check-in if already accounted in roomCharge and early check-in
    const filteredIncidentals = incidentalCharges.filter(ic => 
      !(ic.description && ic.description.toLowerCase().includes('extra capacity charge')) &&
      !(ic.description && ic.description.toLowerCase().includes('early check-in')) &&
      !(ic.description && ic.description.toLowerCase().includes('advance check-in'))
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
      paymentsList = await dbQuery(
        `SELECT p.paymentID, p.amount,
                COALESCE(DATE_FORMAT(t.transactionDateTime, '%Y-%m-%d %H:%i:%s'), '') as paymentDate,
                COALESCE(p.isFullyPaid, 0) as isFullyPaid,
                pm.paymentMethod, p.cashReceived, p.\`change\`,
                COALESCE(p.changeAmount, p.\`change\`, 0) as changeAmount,
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

    // Gross Subtotal (S) = Base room charge + extra guest fee + incidentals + orders + breakfast fee
    const grossSubtotal = Math.round((baseRoomCharge + extraGuestFee + regularIncidentalTotal + earlyCheckInFee + lateCheckOutFee + ordersTotal + (parseFloat(booking.breakfastFee) || 0)) * 100) / 100;
    const discountTotal = totalDiscount;

    // Net Total Subtotal (N) = Gross Subtotal - Total Discount
    const netTotal = Math.max(0, Math.round((grossSubtotal - discountTotal) * 100) / 100);

    // Value-Added Tax (V) = 0.00
    const vatRate = 0.00;
    const vatAmount = 0.00;

    // Grand Total Amount Due (G) = Net Total (G = N)
    const grandTotal = netTotal;

    // Required Downpayment (DP) = Net Total * downPaymentPercentage
    const requiredDownpayment = Math.round((netTotal * (downPaymentPercentage / 100)) * 100) / 100;

    // Remaining Balance (B) = Net Total - Total Payments Settled
    let balance = Math.max(
      0,
      Math.round((netTotal - paidTotal) * 100) / 100
    );

    // Final checkout balance equals active balance
    const finalCheckoutBalance = balance;

    // Clear remaining balance to ₱0.00 upon checkout or completion
    if (booking.status === 'Checked Out' || booking.status === 'Completed' || booking.status === 'Cancelled') {
      balance = 0;
    }

    // Persist computed remaining balance, grandTotal, vatAmount, vatRate, netTotal, subtotal, and downpayment to billing and booking records
    if (billingID) {
      try {
        await dbQuery(
          "UPDATE billing SET subtotal = ?, discountTotal = ?, netTotal = ?, vatRate = 0.00, vatAmount = 0.00, grandTotal = ?, totalAmount = ?, downPaymentAmount = ?, remainingBalance = ?, balance = ? WHERE billingID = ?",
          [grossSubtotal, discountTotal, netTotal, grandTotal, grandTotal, downPaymentPaid, balance, balance, billingID]
        );
        await dbQuery(
          "UPDATE booking SET subtotal = ?, discountTotal = ?, netTotal = ?, vatRate = 0.00, vatAmount = 0.00, grandTotal = ?, totalAmount = ?, remainingBalance = ?, finalBalance = ? WHERE bookingID = ?",
          [grossSubtotal, discountTotal, netTotal, grandTotal, grandTotal, balance, balance, bookingID]
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

    const complimentaryBreakfastUsed = totalStayComplimentaryUsed ?? 0;
    const isBillFinalized = (
      booking.status === 'Bill Finalized' ||
      billingRes[0]?.isBillFinalized === 1 ||
      billingRes[0]?.billingStatus === 'Bill Finalized'
    ) ? 1 : 0;
    const billingStatus = billingRes[0]?.billingStatus || (isBillFinalized ? 'Bill Finalized' : 'Pending');

    const chargesSummary = {
      room: finalRoomCharge,
      baseRoomCharge,
      roomRate: rate,
      nights,
      breakfastOption,
      breakfastDates: parsedBreakfastDates,
      breakfastFee: booking.breakfastFee || 0,
      originalRoomCharge: baseRoomCharge,
      totalDiscount,
      sharePerGuest,
      totalGuests: totalGuestsCount,
      downPaymentPaid,
      downPaymentPercentage,
      roomBalance,
      extraGuests: extraPax,
      extraPax,
      extraGuestFee,
      capacity: roomCapacity,
      occupancyLimit: roomCapacity,
      extraGuestFeeTag: 'Final Billing Only',
      earlyCheckIn: earlyCheckInFee,
      lateCheckOut: lateCheckOutFee,
      lateHours,
      lateCheckOutRule: '1-22 hrs: ₱100/hr | >22 hrs: Full room rate',
      totalAdditionalFees,
      maxFreeBreakfasts: maxStayAllowance,
      stayComplimentaryAllowance: maxStayAllowance,
      complimentaryBreakfastsApplied: complimentaryBreakfastUsed,
      complimentaryBreakfastUsed,
      dailyCompUsedMap,
      products: productTotal,
      cookedMeals: cookedMealsTotal,
      cookedMealsTotal,
      storeProducts: storeProductCharges,
      storeProductsTotal,
      amenities: amenityTotal,
      orders: ordersTotal,
      incidentals: regularIncidentalTotal,
      totalIncidentalsWithEarly,
      grossSubtotal,
      subtotal: grossSubtotal,
      discountTotal,
      totalDiscount: discountTotal,
      netTotal,
      vatRate,
      vatAmount,
      grandTotal,
      totalAmount: grandTotal,
      requiredDownpayment,
      total: grandTotal,
      paid: paidTotal,
      balance,
      finalCheckoutBalance,
      remainingBalance: balance,
      discountList,
      isBillFinalized,
      billingStatus
    };

    const chargesBreakdown = {
      isBillFinalized: isBillFinalized === 1,
      billingStatus,
      room: {
        roomNumber: booking.roomNumber,
        roomType: booking.roomType,
        rate,
        nights,
        baseCharge: baseRoomCharge,
        baseRoomCharge,
        capacity: roomCapacity,
        occupancyLimit: roomCapacity,
        extraPax,
        extraPaxFeePerNight: 100,
        extraGuestFee,
        totalRoomCharge: baseRoomCharge + extraGuestFee,
        finalRoomCharge,
        roomCharge: baseRoomCharge
      },
      additionalFees: {
        extraGuestsCount: extraPax,
        extraGuestFee,
        earlyCheckInFee,
        lateCheckOutFee,
        lateHours,
        lateCheckOutRule: '1-22 hrs: ₱100/hr | >22 hrs: Full room rate',
        total: totalAdditionalFees
      },
      orders: {
        products: storeProductCharges,
        cookedMeals: cookedMealCharges,
        storeProducts: storeProductCharges,
        amenities: amenityCharges,
        total: ordersTotal,
        summary: ordersSummary
      },
      ordersSummary,
      incidentalFees: {
        charges: filteredIncidentals,
        total: regularIncidentalTotal
      },
      discounts: {
        beneficiaries: discountList,
        total: discountTotal
      },
      breakfastSummary: {
        hasPackageBreakfast,
        breakfastDates: parsedBreakfastDates,
        breakfastFee: booking.breakfastFee || 0,
        maxStayAllowance,
        stayComplimentaryAllowance: maxStayAllowance,
        complimentaryBreakfastUsed,
        complimentaryBreakfastsApplied: complimentaryBreakfastUsed,
        dailyCompUsedMap: dailyCompUsedMap || {}
      }
    };

    return {
      booking,
      nights,
      rate,
      baseRoomCharge,
      grossSubtotal,
      discountTotal,
      netTotal,
      vatRate,
      vatAmount,
      grandTotal,
      discountList,
      discountsList: discountList,
      requiredDownpayment,
      subtotal: grossSubtotal,
      totalDiscount: discountTotal,
      totalAmount: grandTotal,
      extraGuests,
      extraGuestFee,
      roomCharge: baseRoomCharge,
      totalGuestsCount,
      sharePerGuest,
      finalGuestsList,
      guestsList: finalGuestsList,
      finalRoomCharge,
      earlyCheckInFee,
      lateCheckOutFee,
      lateHours,
      lateCheckOutRule: '1-22 hrs: ₱100/hr | >22 hrs: Full room rate',
      totalAdditionalFees,
      complimentaryBreakfastsApplied: complimentaryBreakfastUsed,
      complimentaryBreakfastUsed,
      productTotal,
      cookedMealsTotal,
      storeProductsTotal,
      amenityTotal,
      ordersTotal,
      ordersSummary,
      ordersList,
      incidentalTotal: regularIncidentalTotal,
      regularIncidentalTotal,
      totalIncidentalsWithEarly,
      productCharges,
      cookedMealCharges,
      storeProductCharges,
      amenityCharges,
      incidentalCharges: filteredIncidentals,
      allIncidentalCharges: incidentalCharges,
      paidTotal,
      downPaymentPaid,
      balance,
      remainingBalance: balance,
      billingID,
      isBillFinalized,
      billingStatus,
      paymentsList,
      auditLogs,
      chargesSummary: {
        ...chargesSummary,
        ordersSummary,
        orders: ordersTotal
      },
      chargesBreakdown
    };
  } catch (error) {
    console.error(`Error in getBookingBalanceDetails for bookingID ${bookingID}:`, error);
    return {
      booking: null,
      errorMessage: error?.message || 'Error calculating balance details',
      grossSubtotal: 0,
      discountTotal: 0,
      netTotal: 0,
      discountList: [],
      discountsList: [],
      requiredDownpayment: 0,
      subtotal: 0,
      totalDiscount: 0,
      totalAmount: 0,
      paidTotal: 0,
      balance: 0,
      remainingBalance: 0,
      chargesSummary: {
        room: 0,
        grossSubtotal: 0,
        discountTotal: 0,
        netTotal: 0,
        total: 0,
        subtotal: 0,
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

export async function syncNormalizedBillingLineItems(connOrBillingID, billingOrBookingID, optionalBookingID) {
  let connOrPool = null;
  let billingID = null;
  let bookingID = null;

  if (optionalBookingID !== undefined) {
    connOrPool = connOrBillingID;
    billingID = billingOrBookingID;
    bookingID = optionalBookingID;
  } else {
    billingID = connOrBillingID;
    bookingID = billingOrBookingID;
  }

  if (!billingID || !bookingID) return;
  const isConn = connOrPool && typeof connOrPool.execute === 'function';
  const executeQuery = async (sql, params) => {
    if (isConn) {
      return connOrPool.execute(sql, params);
    }
    const pool = await getDbConnection();
    return pool.execute(sql, params);
  };

  try {
    // 1. Sync billing_room
    const [bookingRows] = await executeQuery(`
      SELECT b.bookingID, b.roomID, b.breakfastID, b.breakfastOption,
             rm.roomTypeID, rm.floorID,
             rr.roomRateID, rr.rate
      FROM booking b
      JOIN room rm ON rm.roomID = b.roomID
      LEFT JOIN breakfast_option bo ON bo.breakfastID = (CASE 
        WHEN b.breakfastOption LIKE '%with%' AND b.breakfastOption NOT LIKE '%without%' THEN 2 
        WHEN b.breakfastID = 2 THEN 2 
        ELSE 1 
      END)
      LEFT JOIN room_rate rr ON rr.roomTypeID = rm.roomTypeID AND rr.floorID = rm.floorID AND rr.breakfastID = bo.breakfastID
      WHERE b.bookingID = ?
      LIMIT 1
    `, [bookingID]);

    if (bookingRows && bookingRows.length > 0) {
      let roomRateID = bookingRows[0].roomRateID;
      const bRow = bookingRows[0];
      const resBreakfastID = (bRow.breakfastOption && bRow.breakfastOption.toLowerCase().includes('with') && !bRow.breakfastOption.toLowerCase().includes('without')) || parseInt(bRow.breakfastID) === 2 ? 2 : 1;

      if (!roomRateID && bRow.roomTypeID && bRow.floorID) {
        const [defRate] = await executeQuery(
          "SELECT roomRateID FROM room_rate WHERE roomTypeID = ? AND floorID = ? AND breakfastID = ? LIMIT 1",
          [bRow.roomTypeID, bRow.floorID, resBreakfastID]
        );
        roomRateID = defRate[0]?.roomRateID || null;
      }

      if (roomRateID) {
        const [existingBr] = await executeQuery(
          "SELECT billingRoomID FROM billing_room WHERE billingID = ? AND roomRateID = ? LIMIT 1",
          [billingID, roomRateID]
        );
        const balanceDetails = await getBookingBalanceDetails(bookingID);
        const roomAmount = balanceDetails?.finalRoomCharge ?? balanceDetails?.baseRoomCharge ?? 0;
        const unitPrice = balanceDetails?.rate ?? 0;
        const extraFee = balanceDetails?.extraGuestFee ?? 0;

        const [brCols] = await executeQuery("SHOW COLUMNS FROM billing_room LIKE 'unitPrice'");
        const hasUnitPrice = brCols && brCols.length > 0;

        if (!existingBr || existingBr.length === 0) {
          if (hasUnitPrice) {
            await executeQuery(
              "INSERT INTO billing_room (billingID, roomRateID, amount, unitPrice, extraGuestFee) VALUES (?, ?, ?, ?, ?)",
              [billingID, roomRateID, roomAmount, unitPrice, extraFee]
            );
          } else {
            await executeQuery(
              "INSERT INTO billing_room (billingID, roomRateID, amount) VALUES (?, ?, ?)",
              [billingID, roomRateID, roomAmount]
            );
          }
        } else {
          if (hasUnitPrice) {
            await executeQuery(
              "UPDATE billing_room SET amount = ?, unitPrice = ?, extraGuestFee = ? WHERE billingRoomID = ?",
              [roomAmount, unitPrice, extraFee, existingBr[0].billingRoomID]
            );
          } else {
            await executeQuery(
              "UPDATE billing_room SET amount = ? WHERE billingRoomID = ?",
              [roomAmount, existingBr[0].billingRoomID]
            );
          }
        }
      }
    }

    // 2. Sync billing_product
    const [orderProducts] = await executeQuery(`
      SELECT op.orderProductID,
             CASE WHEN op.isComplimentary = 1 THEN 0.00 ELSE (op.quantity * COALESCE(op.unitPrice, p.price)) END as amount
      FROM order_product op
      JOIN orders o ON o.orderID = op.orderID
      JOIN products p ON p.productID = op.productID
      WHERE o.bookingID = ? AND o.orderStatus NOT IN ('Canceled')
    `, [bookingID]);

    if (orderProducts && orderProducts.length > 0) {
      for (const op of orderProducts) {
        const [existingBp] = await executeQuery(
          "SELECT billingProductID FROM billing_product WHERE billingID = ? AND orderProductID = ? LIMIT 1",
          [billingID, op.orderProductID]
        );
        if (!existingBp || existingBp.length === 0) {
          await executeQuery(
            "INSERT INTO billing_product (billingID, orderProductID, amount) VALUES (?, ?, ?)",
            [billingID, op.orderProductID, op.amount]
          );
        } else {
          await executeQuery(
            "UPDATE billing_product SET amount = ? WHERE billingProductID = ?",
            [op.amount, existingBp[0].billingProductID]
          );
        }
      }
    }

    // 3. Sync billing_amenity
    const [orderAmenities] = await executeQuery(`
      SELECT oa.orderAmenityID,
             (oa.quantity * COALESCE(oa.unitPrice, a.price)) as amount
      FROM order_amenities oa
      JOIN orders o ON o.orderID = oa.orderID
      JOIN amenities a ON a.amenityID = oa.amenityID
      WHERE o.bookingID = ? AND o.orderStatus NOT IN ('Canceled')
    `, [bookingID]);

    if (orderAmenities && orderAmenities.length > 0) {
      for (const oa of orderAmenities) {
        const [existingBa] = await executeQuery(
          "SELECT billingAmenityID FROM billing_amenity WHERE billingID = ? AND orderAmenityID = ? LIMIT 1",
          [billingID, oa.orderAmenityID]
        );
        if (!existingBa || existingBa.length === 0) {
          await executeQuery(
            "INSERT INTO billing_amenity (billingID, orderAmenityID, amount) VALUES (?, ?, ?)",
            [billingID, oa.orderAmenityID, oa.amount]
          );
        } else {
          await executeQuery(
            "UPDATE billing_amenity SET amount = ? WHERE billingAmenityID = ?",
            [oa.amount, existingBa[0].billingAmenityID]
          );
        }
      }
    }

    // 4. Update master billing & booking tables
    const balanceDetails = await getBookingBalanceDetails(bookingID);
    if (balanceDetails) {
      await executeQuery(
        "UPDATE billing SET subtotal = ?, discountTotal = ?, netTotal = ?, vatRate = ?, vatAmount = ?, grandTotal = ?, totalAmount = ?, downPaymentAmount = ?, remainingBalance = ?, balance = ? WHERE billingID = ?",
        [balanceDetails.grossSubtotal, balanceDetails.discountTotal, balanceDetails.netTotal, balanceDetails.vatRate, balanceDetails.vatAmount, balanceDetails.grandTotal, balanceDetails.grandTotal, balanceDetails.chargesSummary?.downPaymentPaid || 0, balanceDetails.balance, balanceDetails.balance, billingID]
      );
      await executeQuery(
        "UPDATE booking SET subtotal = ?, discountTotal = ?, netTotal = ?, vatRate = ?, vatAmount = ?, grandTotal = ?, totalAmount = ?, remainingBalance = ?, finalBalance = ? WHERE bookingID = ?",
        [balanceDetails.grossSubtotal, balanceDetails.discountTotal, balanceDetails.netTotal, balanceDetails.vatRate, balanceDetails.vatAmount, balanceDetails.grandTotal, balanceDetails.grandTotal, balanceDetails.balance, balanceDetails.balance, bookingID]
      );
    }
  } catch (err) {
    console.error(`Error in syncNormalizedBillingLineItems for billingID ${billingID}:`, err);
  }
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

    // Strict Guard: Only set room available once payment or transaction is completed
    const currentBalance = await getBookingBalance(bookingID);
    if (currentBalance > 0.05) {
      await conn.rollback();
      return {
        error: `Cannot complete check-out or release room. Outstanding balance of ₱${currentBalance.toFixed(2)} must be fully settled first.`
      };
    }

    const localNow = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

    // 1. Update booking status to 'Checked Out' and record actualCheckOut
    await conn.execute(
      "UPDATE booking SET status = 'Checked Out', actualCheckOut = CURRENT_TIMESTAMP, checkOutDateTime = ? WHERE bookingID = ?",
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

    // 4. Synchronize normalized master and child billing tables inside transaction
    const [billingRows] = await conn.execute(
      "SELECT billingID FROM billing WHERE bookingID = ? ORDER BY billingID DESC LIMIT 1",
      [bookingID]
    );
    const billingID = billingRows[0]?.billingID || null;
    if (billingID) {
      await syncNormalizedBillingLineItems(conn, billingID, bookingID);
    }

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


