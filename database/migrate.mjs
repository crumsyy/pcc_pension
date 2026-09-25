import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local manually and clean inline comments
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const rawVal = parts.slice(1).join('=').trim();
      // Strip comments that start with '#' or '//'
      const cleanVal = rawVal.split('#')[0].split('//')[0].trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = cleanVal;
    }
  });
}

async function ensureColumn(connection, tableName, columnName, definition) {
  const [columns] = await connection.execute(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
  if (columns.length === 0) {
    console.log(`Adding ${columnName} column to ${tableName} table...`);
    await connection.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
    console.log(`Successfully added ${columnName} column!`);
  } else {
    console.log(`${columnName} column in ${tableName} already exists. Skipping.`);
  }
}

async function ensureTable(connection, tableName, createSql) {
  const [tables] = await connection.execute(`SHOW TABLES LIKE ?`, [tableName]);
  if (tables.length === 0) {
    console.log(`Creating table ${tableName}...`);
    await connection.execute(createSql);
    console.log(`Successfully created table ${tableName}!`);
    return true;
  } else {
    console.log(`Table ${tableName} already exists. Skipping.`);
    return false;
  }
}

async function ensureIndex(connection, tableName, indexName, columnsDefinition) {
  try {
    const [indexes] = await connection.execute(`SHOW INDEX FROM \`${tableName}\` WHERE Key_name = ?`, [indexName]);
    if (indexes.length === 0) {
      console.log(`Adding index ${indexName} to ${tableName}...`);
      await connection.execute(`CREATE INDEX \`${indexName}\` ON \`${tableName}\` (${columnsDefinition})`);
      console.log(`Successfully created index ${indexName}!`);
    } else {
      console.log(`Index ${indexName} on ${tableName} already exists. Skipping.`);
    }
  } catch (err) {
    console.warn(`Note on index ${indexName} on ${tableName}:`, err.message);
  }
}

async function ensureForeignKey(connection, tableName, constraintName, fkDefinition) {
  try {
    const [fks] = await connection.execute(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
      [process.env.DB_NAME, tableName, constraintName]
    );
    if (fks.length === 0) {
      console.log(`Adding foreign key constraint ${constraintName} to ${tableName}...`);
      await connection.execute(`ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${constraintName}\` ${fkDefinition}`);
      console.log(`Successfully added foreign key ${constraintName}!`);
    } else {
      console.log(`Foreign key ${constraintName} on ${tableName} already exists. Skipping.`);
    }
  } catch (err) {
    console.warn(`Note on foreign key ${constraintName} on ${tableName}:`, err.message);
  }
}

async function run() {
  console.log("Database Host:", process.env.DB_HOST);
  console.log("Database Name:", process.env.DB_NAME);
 
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
 
    console.log("Connected to database. Checking and updating table structures...");
 
    console.log("Converting status columns to VARCHAR(50) for status safety...");
    await connection.execute("ALTER TABLE purchase_order MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Pending'");
    await connection.execute("ALTER TABLE reservation MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Pending'");
    await connection.execute("ALTER TABLE booking MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Pending'");
    await connection.execute("ALTER TABLE room MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Available'");
    await connection.execute("ALTER TABLE orders MODIFY COLUMN orderStatus VARCHAR(50) NOT NULL DEFAULT 'Pending'");
    await connection.execute("ALTER TABLE inquiry MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Pending'");
    await connection.execute("ALTER TABLE `user` MODIFY COLUMN `status` VARCHAR(50) NOT NULL DEFAULT 'Active'");

    await ensureColumn(connection, 'user', 'suspendedUntil', 'DATETIME DEFAULT NULL');
    await ensureColumn(connection, 'user', 'suspensionRemarks', 'VARCHAR(255) DEFAULT NULL');
    await ensureColumn(connection, 'user', 'isDeleted', 'TINYINT(1) NOT NULL DEFAULT 0');
    await ensureColumn(connection, 'user', 'sessionToken', 'VARCHAR(255) DEFAULT NULL');

    console.log("Altering room table for description, occupancyLimit, and image...");
    await ensureColumn(connection, 'room', 'description', 'TEXT DEFAULT NULL');
    await ensureColumn(connection, 'room', 'occupancyLimit', 'INT NOT NULL DEFAULT 4');
    await ensureColumn(connection, 'room', 'image', 'VARCHAR(255) DEFAULT NULL');
    await ensureColumn(connection, 'order_product', 'isComplimentary', 'TINYINT(1) NOT NULL DEFAULT 0');

    console.log("Altering booking table for cancellation reason...");
    await ensureColumn(connection, 'booking', 'cancelRemarks', 'VARCHAR(255) DEFAULT NULL');

    console.log("Altering products and amenities for stock danger thresholds...");
    await ensureColumn(connection, 'products', 'minStock', 'INT NOT NULL DEFAULT 10');
    await ensureColumn(connection, 'amenities', 'minStock', 'INT NOT NULL DEFAULT 10');

    await ensureColumn(connection, 'room', 'isArchived', 'TINYINT(1) NOT NULL DEFAULT 0');
    await ensureColumn(connection, 'amenities', 'isArchived', 'TINYINT(1) NOT NULL DEFAULT 0');
    await ensureColumn(connection, 'products', 'isArchived', 'TINYINT(1) NOT NULL DEFAULT 0');
    await ensureColumn(connection, 'products', 'isAvailable', 'TINYINT(1) NOT NULL DEFAULT 1');
    await ensureColumn(connection, 'discounts', 'isArchived', 'TINYINT(1) NOT NULL DEFAULT 0');
    await ensureColumn(connection, 'promotions', 'isArchived', 'TINYINT(1) NOT NULL DEFAULT 0');
    await ensureColumn(connection, 'promotions', 'roomTypeID', 'INT DEFAULT NULL');
    await ensureColumn(connection, 'purchase_order', 'expectedDeliveryDate', 'DATE DEFAULT NULL');
    await ensureColumn(connection, 'purchase_order', 'remarks', 'VARCHAR(255) DEFAULT NULL');
    await ensureColumn(connection, 'purchase_order_items', 'quantityReceived', 'INT NOT NULL DEFAULT 0');

    console.log("Altering booking table reservationID column to support nullability for walk-ins (booking without reservation)...");
    await connection.execute("ALTER TABLE booking MODIFY COLUMN reservationID INT(11) NULL");

    console.log("Altering guest table columns to support nullability for walk-ins...");
    await connection.execute("ALTER TABLE guest MODIFY COLUMN userID INT(11) DEFAULT NULL");
    await connection.execute("ALTER TABLE guest MODIFY COLUMN gender ENUM('Male','Female') DEFAULT NULL");
    await connection.execute("ALTER TABLE guest MODIFY COLUMN dateOfBirth DATE DEFAULT NULL");
    await connection.execute("ALTER TABLE guest MODIFY COLUMN city VARCHAR(50) DEFAULT NULL");
    await connection.execute("ALTER TABLE guest MODIFY COLUMN province VARCHAR(50) DEFAULT NULL");
    await connection.execute("ALTER TABLE guest MODIFY COLUMN email VARCHAR(100) DEFAULT NULL");

    console.log("Checking and ensuring inquiry and notification tables exist...");
    const createdInquiry = await ensureTable(connection, 'inquiry', `
      CREATE TABLE \`inquiry\` (
        \`inquiryID\` int(11) NOT NULL AUTO_INCREMENT,
        \`name\` varchar(100) NOT NULL,
        \`email\` varchar(100) NOT NULL,
        \`message\` text NOT NULL,
        \`status\` enum('Pending','Responded') NOT NULL DEFAULT 'Pending',
        \`response\` text DEFAULT NULL,
        \`isChatbotForwarded\` tinyint(1) NOT NULL DEFAULT 0,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`inquiryID\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await ensureTable(connection, 'inquiry_message', `
      CREATE TABLE IF NOT EXISTS \`inquiry_message\` (
        \`messageID\` INT(11) NOT NULL AUTO_INCREMENT,
        \`inquiryID\` INT(11) NOT NULL,
        \`senderRole\` ENUM('guest', 'receptionist', 'admin', 'bot') NOT NULL DEFAULT 'guest',
        \`senderType\` ENUM('Guest', 'Receptionist', 'System') NOT NULL DEFAULT 'Guest',
        \`senderID\` INT(11) NOT NULL DEFAULT 0,
        \`senderName\` VARCHAR(100) NOT NULL DEFAULT 'Guest',
        \`messageText\` TEXT NOT NULL,
        \`message\` TEXT NOT NULL,
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'Delivered',
        \`isRead\` TINYINT(1) DEFAULT 0,
        \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`readAt\` DATETIME DEFAULT NULL,
        \`timestamp\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`messageID\`),
        KEY \`idx_inqmsg_inquiryID\` (\`inquiryID\`),
        KEY \`idx_inquiry_thread_status\` (\`inquiryID\`, \`status\`, \`createdAt\`),
        KEY \`idx_inquiry_unread\` (\`inquiryID\`, \`senderRole\`, \`status\`),
        CONSTRAINT \`fk_inqmsg_inquiry\` FOREIGN KEY (\`inquiryID\`) REFERENCES \`inquiry\` (\`inquiryID\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await ensureColumn(connection, 'inquiry_message', 'senderRole', "ENUM('guest', 'receptionist', 'admin', 'bot') NOT NULL DEFAULT 'guest'");
    await ensureColumn(connection, 'inquiry_message', 'senderID', "INT(11) NOT NULL DEFAULT 0");
    await ensureColumn(connection, 'inquiry_message', 'messageText', "TEXT NULL");
    await ensureColumn(connection, 'inquiry_message', 'status', "VARCHAR(20) NOT NULL DEFAULT 'Delivered'");
    await ensureColumn(connection, 'inquiry_message', 'readAt', "DATETIME DEFAULT NULL");
    await ensureColumn(connection, 'inquiry_message', 'createdAt', "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");

    await ensureTable(connection, 'notification', `
      CREATE TABLE \`notification\` (
        \`notificationID\` int(11) NOT NULL AUTO_INCREMENT,
        \`userID\` int(11) NOT NULL,
        \`title\` varchar(100) NOT NULL,
        \`message\` text NOT NULL,
        \`isRead\` tinyint(1) NOT NULL DEFAULT 0,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`notificationID\`),
        KEY \`fk_notification_user\` (\`userID\`),
        CONSTRAINT \`fk_notification_user\` FOREIGN KEY (\`userID\`) REFERENCES \`user\` (\`userID\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await ensureColumn(connection, 'notification', 'readAt', "DATETIME DEFAULT NULL");

    console.log("Checking and ensuring booking_guest_details table exists...");
    await ensureTable(connection, 'booking_guest_details', `
      CREATE TABLE \`booking_guest_details\` (
        \`bookingGuestID\` INT AUTO_INCREMENT PRIMARY KEY,
        \`bookingID\` INT NOT NULL,
        \`fullName\` VARCHAR(150) NOT NULL,
        \`age\` INT NOT NULL,
        \`discountID\` INT DEFAULT NULL,
        \`discountIdNumber\` VARCHAR(50) DEFAULT NULL,
        CONSTRAINT \`fk_bg_booking\` FOREIGN KEY (\`bookingID\`) REFERENCES \`booking\` (\`bookingID\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_bg_discount\` FOREIGN KEY (\`discountID\`) REFERENCES \`discounts\` (\`discountID\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    console.log("Altering products and amenities for catalog and inventory redesign...");
    await ensureColumn(connection, 'products', 'itemType', "ENUM('Consumable', 'Non-Consumable') NOT NULL DEFAULT 'Consumable'");
    await ensureColumn(connection, 'amenities', 'itemType', "ENUM('Consumable', 'Non-Consumable') NOT NULL DEFAULT 'Consumable'");
    await ensureColumn(connection, 'products', 'unit', "VARCHAR(20) DEFAULT 'pcs'");
    await ensureColumn(connection, 'amenities', 'unit', "VARCHAR(20) DEFAULT 'pcs'");
    await ensureColumn(connection, 'products', 'description', "TEXT DEFAULT NULL");
    await ensureColumn(connection, 'amenities', 'description', "TEXT DEFAULT NULL");

    // Change quantity default in MySQL-compatible schema
    await connection.execute("ALTER TABLE `products` MODIFY COLUMN `quantity` int(11) NOT NULL DEFAULT 0");
    await connection.execute("ALTER TABLE `amenities` MODIFY COLUMN `quantity` int(11) NOT NULL DEFAULT 0");

    console.log("Checking and ensuring inventory_batch table exists...");
    await ensureTable(connection, 'inventory_batch', `
      CREATE TABLE \`inventory_batch\` (
        \`batchID\` INT AUTO_INCREMENT PRIMARY KEY,
        \`batchNumber\` VARCHAR(50) NOT NULL UNIQUE,
        \`itemType\` ENUM('Amenity', 'Product') NOT NULL,
        \`itemID\` INT NOT NULL,
        \`supplier\` VARCHAR(100) DEFAULT NULL,
        \`purchaseOrderID\` INT DEFAULT NULL,
        \`quantity\` INT NOT NULL,
        \`remainingQuantity\` INT NOT NULL,
        \`dateReceived\` DATE NOT NULL,
        \`manufacturingDate\` DATE DEFAULT NULL,
        \`expirationDate\` DATE DEFAULT NULL,
        \`unitCost\` DECIMAL(10,2) NOT NULL,
        \`status\` ENUM('Active', 'Low Stock', 'Expired', 'Fully Consumed', 'Disposed') NOT NULL DEFAULT 'Active',
        CONSTRAINT \`fk_ib_po\` FOREIGN KEY (\`purchaseOrderID\`) REFERENCES \`purchase_order\` (\`purchaseOrderID\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    console.log("Checking and ensuring inventory_movement table exists...");
    await ensureTable(connection, 'inventory_movement', `
      CREATE TABLE \`inventory_movement\` (
        \`movementID\` INT AUTO_INCREMENT PRIMARY KEY,
        \`movementDateTime\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`itemType\` ENUM('Amenity', 'Product') NOT NULL,
        \`itemID\` INT NOT NULL,
        \`quantity\` INT NOT NULL,
        \`userID\` INT NOT NULL,
        \`movementType\` ENUM('Stock In', 'Stock Out', 'Borrow', 'Return', 'Adjustment', 'Disposal', 'Loss', 'Damage') NOT NULL,
        \`referenceNumber\` VARCHAR(100) DEFAULT NULL,
        \`remarks\` TEXT DEFAULT NULL,
        \`batchID\` INT DEFAULT NULL,
        CONSTRAINT \`fk_im_batch\` FOREIGN KEY (\`batchID\`) REFERENCES \`inventory_batch\` (\`batchID\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_im_user\` FOREIGN KEY (\`userID\`) REFERENCES \`user\` (\`userID\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    console.log("Checking and ensuring inventory_disposal table exists...");
    await ensureTable(connection, 'inventory_disposal', `
      CREATE TABLE \`inventory_disposal\` (
        \`disposalID\` INT AUTO_INCREMENT PRIMARY KEY,
        \`disposalDateTime\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`batchID\` INT DEFAULT NULL,
        \`itemType\` ENUM('Amenity', 'Product') NOT NULL,
        \`itemID\` INT NOT NULL,
        \`quantity\` INT NOT NULL,
        \`reason\` ENUM('Expired', 'Spoiled', 'Damaged', 'Contaminated', 'Lost', 'Returned to Supplier', 'Other') NOT NULL,
        \`remarks\` TEXT DEFAULT NULL,
        \`userID\` INT NOT NULL,
        CONSTRAINT \`fk_id_batch\` FOREIGN KEY (\`batchID\`) REFERENCES \`inventory_batch\` (\`batchID\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_id_user\` FOREIGN KEY (\`userID\`) REFERENCES \`user\` (\`userID\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    console.log("Checking and ensuring borrow_transaction table exists...");
    await ensureTable(connection, 'borrow_transaction', `
      CREATE TABLE \`borrow_transaction\` (
        \`borrowID\` INT AUTO_INCREMENT PRIMARY KEY,
        \`borrowDateTime\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`itemType\` ENUM('Amenity', 'Product') NOT NULL,
        \`itemID\` INT NOT NULL,
        \`quantity\` INT NOT NULL,
        \`borrowedBy\` VARCHAR(100) NOT NULL,
        \`bookingID\` INT DEFAULT NULL,
        \`roomID\` INT DEFAULT NULL,
        \`expectedReturnDate\` DATE DEFAULT NULL,
        \`actualReturnDate\` DATETIME DEFAULT NULL,
        \`status\` ENUM('Borrowed', 'Returned', 'Damaged', 'Lost', 'Partially Returned') NOT NULL DEFAULT 'Borrowed',
        \`conditionUponReturn\` VARCHAR(255) DEFAULT NULL,
        \`remarks\` TEXT DEFAULT NULL,
        \`userID\` INT NOT NULL,
        CONSTRAINT \`fk_bt_booking\` FOREIGN KEY (\`bookingID\`) REFERENCES \`booking\` (\`bookingID\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_bt_room\` FOREIGN KEY (\`roomID\`) REFERENCES \`room\` (\`roomID\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_bt_user\` FOREIGN KEY (\`userID\`) REFERENCES \`user\` (\`userID\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    console.log("Checking and ensuring purchase_order_delivery table exists...");
    await ensureTable(connection, 'purchase_order_delivery', `
      CREATE TABLE \`purchase_order_delivery\` (
        \`deliveryID\` INT AUTO_INCREMENT PRIMARY KEY,
        \`purchaseOrderID\` INT NOT NULL,
        \`orderItemID\` INT NOT NULL,
        \`quantityReceived\` INT NOT NULL,
        \`dateReceived\` DATE NOT NULL,
        \`supplierReference\` VARCHAR(100) DEFAULT NULL,
        \`expirationDate\` DATE DEFAULT NULL,
        \`batchID\` INT DEFAULT NULL,
        CONSTRAINT \`fk_pod_po\` FOREIGN KEY (\`purchaseOrderID\`) REFERENCES \`purchase_order\` (\`purchaseOrderID\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_pod_item\` FOREIGN KEY (\`orderItemID\`) REFERENCES \`purchase_order_items\` (\`orderItemID\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_pod_batch\` FOREIGN KEY (\`batchID\`) REFERENCES \`inventory_batch\` (\`batchID\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    console.log("Renaming Breakfast/Silog Meals to Cooked Meals...");
    await connection.execute("UPDATE product_category SET name = 'Cooked Meals' WHERE name = 'Breakfast/Silog Meals'");

    console.log("Ensuring auxiliary columns for reservations, orders, and billing...");
    await ensureColumn(connection, 'reservation', 'checkOutDateTime', 'DATETIME DEFAULT NULL');
    await ensureColumn(connection, 'reservation', 'guestCount', 'INT DEFAULT 1');
    await ensureColumn(connection, 'booking', 'guestCount', 'INT DEFAULT 1');
    await ensureColumn(connection, 'reservation', 'specialRequests', 'TEXT DEFAULT NULL');
    await ensureColumn(connection, 'reservation', 'breakfastOption', "VARCHAR(20) DEFAULT 'with'");
    await ensureColumn(connection, 'orders', 'bookingID', 'INT DEFAULT NULL');
    await ensureColumn(connection, 'orders', 'isBreakfast', 'TINYINT(1) DEFAULT 0');
    await ensureColumn(connection, 'orders', 'hasCookedMeal', 'TINYINT(1) DEFAULT 0');
    await ensureColumn(connection, 'order_product', 'isComplimentary', 'TINYINT(1) DEFAULT 0');
    await ensureColumn(connection, 'order_product', 'unitPrice', 'DECIMAL(10,2) DEFAULT NULL');
    await ensureColumn(connection, 'billing', 'missingAmenitiesFee', 'DECIMAL(10,2) DEFAULT 0.00');
    await ensureColumn(connection, 'billing', 'reservationID', 'INT DEFAULT NULL');
    await ensureColumn(connection, 'billing', 'billingStatus', "VARCHAR(50) DEFAULT 'Pending'");
    await ensureColumn(connection, 'billing', 'isBillFinalized', 'TINYINT(1) NOT NULL DEFAULT 0');
    await ensureColumn(connection, 'billing', 'updatedAt', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await ensureColumn(connection, 'booking', 'updatedAt', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    await ensureColumn(connection, 'booking', 'billFinalizedAt', 'DATETIME NULL DEFAULT NULL');
    await ensureColumn(connection, 'orders', 'createdAt', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
    await ensureColumn(connection, 'booking', 'subtotal', 'DECIMAL(10,2) NULL');
    await ensureColumn(connection, 'booking', 'discountTotal', 'DECIMAL(10,2) NULL DEFAULT 0.00');
    await ensureColumn(connection, 'booking', 'netTotal', 'DECIMAL(10,2) NULL');
    await ensureColumn(connection, 'booking', 'vatRate', 'DECIMAL(5,2) NULL DEFAULT 12.00');
    await ensureColumn(connection, 'booking', 'vatAmount', 'DECIMAL(10,2) NULL DEFAULT 0.00');
    await ensureColumn(connection, 'booking', 'grandTotal', 'DECIMAL(10,2) NULL');
    await ensureColumn(connection, 'billing', 'subtotal', 'DECIMAL(10,2) NULL');
    await ensureColumn(connection, 'billing', 'discountTotal', 'DECIMAL(10,2) NULL DEFAULT 0.00');
    await ensureColumn(connection, 'billing', 'netTotal', 'DECIMAL(10,2) NULL');
    await ensureColumn(connection, 'billing', 'vatRate', 'DECIMAL(5,2) NULL DEFAULT 12.00');
    await ensureColumn(connection, 'billing', 'vatAmount', 'DECIMAL(10,2) NULL DEFAULT 0.00');
    await ensureColumn(connection, 'billing', 'grandTotal', 'DECIMAL(10,2) NULL');

    console.log("Ensuring 3NF normalized integrity columns...");
    await ensureColumn(connection, 'booking', 'breakfastID', 'INT(11) DEFAULT 1');
    await ensureColumn(connection, 'booking', 'breakfastDates', 'JSON DEFAULT NULL');
    await ensureColumn(connection, 'booking', 'breakfastFee', 'DECIMAL(10,2) DEFAULT 0.00');
    await ensureColumn(connection, 'reservation', 'breakfastDates', 'JSON DEFAULT NULL');
    await ensureColumn(connection, 'reservation', 'breakfastFee', 'DECIMAL(10,2) DEFAULT 0.00');
    await ensureColumn(connection, 'order_amenities', 'unitPrice', 'DECIMAL(10,2) DEFAULT NULL');
    await ensureColumn(connection, 'payment', 'changeAmount', 'DECIMAL(10,2) DEFAULT 0.00');

    console.log("Ensuring master-detail billing and incidental tables exist...");
    await ensureTable(connection, 'billing_room', `
      CREATE TABLE IF NOT EXISTS \`billing_room\` (
        \`billingRoomID\` INT(11) NOT NULL AUTO_INCREMENT,
        \`billingID\` INT(11) NOT NULL,
        \`roomRateID\` INT(11) NOT NULL,
        \`amount\` DECIMAL(10,2) NOT NULL,
        PRIMARY KEY (\`billingRoomID\`),
        KEY \`fk_br_billing\` (\`billingID\`),
        KEY \`fk_br_rate\` (\`roomRateID\`),
        CONSTRAINT \`fk_br_billing\` FOREIGN KEY (\`billingID\`) REFERENCES \`billing\` (\`billingID\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_br_rate\` FOREIGN KEY (\`roomRateID\`) REFERENCES \`room_rate\` (\`roomRateID\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await ensureTable(connection, 'billing_product', `
      CREATE TABLE IF NOT EXISTS \`billing_product\` (
        \`billingProductID\` INT(11) NOT NULL AUTO_INCREMENT,
        \`billingID\` INT(11) NOT NULL,
        \`orderProductID\` INT(11) NOT NULL,
        \`amount\` DECIMAL(10,2) NOT NULL,
        PRIMARY KEY (\`billingProductID\`),
        KEY \`fk_bp_billing\` (\`billingID\`),
        KEY \`fk_bp_orderproduct\` (\`orderProductID\`),
        CONSTRAINT \`fk_bp_billing\` FOREIGN KEY (\`billingID\`) REFERENCES \`billing\` (\`billingID\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_bp_orderproduct\` FOREIGN KEY (\`orderProductID\`) REFERENCES \`order_product\` (\`orderProductID\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await ensureTable(connection, 'billing_amenity', `
      CREATE TABLE IF NOT EXISTS \`billing_amenity\` (
        \`billingAmenityID\` INT(11) NOT NULL AUTO_INCREMENT,
        \`billingID\` INT(11) NOT NULL,
        \`orderAmenityID\` INT(11) NOT NULL,
        \`amount\` DECIMAL(10,2) NOT NULL,
        PRIMARY KEY (\`billingAmenityID\`),
        KEY \`fk_ba_billing\` (\`billingID\`),
        KEY \`fk_ba_orderamenity\` (\`orderAmenityID\`),
        CONSTRAINT \`fk_ba_billing\` FOREIGN KEY (\`billingID\`) REFERENCES \`billing\` (\`billingID\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_ba_orderamenity\` FOREIGN KEY (\`orderAmenityID\`) REFERENCES \`order_amenities\` (\`orderAmenityID\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await ensureTable(connection, 'incidental_charge', `
      CREATE TABLE IF NOT EXISTS \`incidental_charge\` (
        \`chargeID\` INT(11) NOT NULL AUTO_INCREMENT,
        \`bookingID\` INT(11) NOT NULL,
        \`description\` VARCHAR(255) NOT NULL,
        \`amount\` DECIMAL(10,2) NOT NULL,
        \`createdAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`chargeID\`),
        KEY \`idx_incidental_booking\` (\`bookingID\`),
        CONSTRAINT \`fk_incidental_booking\` FOREIGN KEY (\`bookingID\`) REFERENCES \`booking\` (\`bookingID\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await ensureTable(connection, 'booking_incidentals', `
      CREATE TABLE IF NOT EXISTS \`booking_incidentals\` (
        \`incidentalID\` INT(11) NOT NULL AUTO_INCREMENT,
        \`bookingID\` INT(11) NOT NULL,
        \`description\` VARCHAR(255) NOT NULL,
        \`amount\` DECIMAL(10,2) NOT NULL,
        \`createdAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`incidentalID\`),
        KEY \`idx_bkinc_booking\` (\`bookingID\`),
        CONSTRAINT \`fk_bkinc_booking\` FOREIGN KEY (\`bookingID\`) REFERENCES \`booking\` (\`bookingID\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await ensureTable(connection, 'booking_discount', `
      CREATE TABLE IF NOT EXISTS \`booking_discount\` (
        \`bookingDiscountID\` INT(11) NOT NULL AUTO_INCREMENT,
        \`bookingID\` INT(11) NOT NULL,
        \`guestName\` VARCHAR(150) NOT NULL,
        \`discountID\` INT(11) DEFAULT NULL,
        \`discountIdNumber\` VARCHAR(100) DEFAULT NULL,
        \`discountAmount\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        \`createdAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`bookingDiscountID\`),
        KEY \`idx_bd_bookingID\` (\`bookingID\`),
        CONSTRAINT \`fk_bd_booking\` FOREIGN KEY (\`bookingID\`) REFERENCES \`booking\` (\`bookingID\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    console.log("Ensuring system_settings table and default VAT percentage...");
    await ensureTable(connection, 'system_settings', `
      CREATE TABLE IF NOT EXISTS \`system_settings\` (
        \`settingKey\` VARCHAR(50) NOT NULL PRIMARY KEY,
        \`settingValue\` VARCHAR(255) NOT NULL,
        \`updatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);
    await connection.execute(`
      INSERT IGNORE INTO \`system_settings\` (\`settingKey\`, \`settingValue\`)
      VALUES ('vat_percentage', '12.00')
    `).catch(() => {});

    console.log("Backfilling normalized fields...");
    await connection.execute(`
      UPDATE booking 
      SET breakfastID = CASE 
        WHEN breakfastOption LIKE '%with%' AND breakfastOption NOT LIKE '%without%' THEN 2 
        ELSE 1 
      END
      WHERE breakfastID IS NULL OR (breakfastOption LIKE '%with%' AND breakfastOption NOT LIKE '%without%' AND breakfastID = 1)
    `).catch((e) => { console.warn("Backfill breakfastID note:", e.message); });

    await connection.execute(`
      UPDATE order_product op
      JOIN products p ON p.productID = op.productID
      SET op.unitPrice = p.price
      WHERE op.unitPrice IS NULL OR op.unitPrice = 0
    `).catch((e) => { console.warn("Backfill order_product unitPrice note:", e.message); });

    await connection.execute(`
      UPDATE orders 
      SET orderStatus = 'Preparing' 
      WHERE orderStatus = 'Out for Delivery'
    `).catch((e) => { console.warn("Backfill orders status note:", e.message); });

    await connection.execute(`
      UPDATE order_amenities oa
      JOIN amenities a ON a.amenityID = oa.amenityID
      SET oa.unitPrice = a.price
      WHERE oa.unitPrice IS NULL OR oa.unitPrice = 0
    `).catch((e) => { console.warn("Backfill order_amenities unitPrice note:", e.message); });

    await connection.execute(`
      UPDATE payment 
      SET changeAmount = \`change\` 
      WHERE (changeAmount = 0.00 OR changeAmount IS NULL) AND \`change\` > 0
    `).catch((e) => { console.warn("Backfill changeAmount note:", e.message); });

    console.log("Ensuring high-frequency composite indices for relational performance...");
    await ensureIndex(connection, 'room', 'idx_room_occupancy', '`roomID`, `occupancyLimit`');
    await ensureIndex(connection, 'booking', 'idx_booking_billing_perf', '`bookingID`, `status`, `roomID`');
    await ensureIndex(connection, 'orders', 'idx_orders_delivery_date', '`bookingID`, `deliveryDate`, `orderStatus`');
    await ensureIndex(connection, 'order_product', 'idx_order_comp_perf', '`orderID`, `isComplimentary`');
    await ensureIndex(connection, 'room_rate', 'idx_room_rate_lookup', '`roomTypeID`, `floorID`, `breakfastID`');
    await ensureIndex(connection, 'booking', 'idx_booking_dates_status', '`roomID`, `status`, `checkInDateTime`, `checkOutDateTime`');
    await ensureIndex(connection, 'orders', 'idx_orders_booking', '`bookingID`, `orderStatus`');
    await ensureIndex(connection, 'billing', 'idx_billing_booking', '`bookingID`');
    await ensureIndex(connection, 'payment', 'idx_payment_billing', '`billingID`');
    await ensureIndex(connection, 'billing_room', 'idx_br_billing_rate', '`billingID`, `roomRateID`');
    await ensureIndex(connection, 'billing_product', 'idx_bp_billing_op', '`billingID`, `orderProductID`');
    await ensureIndex(connection, 'billing_amenity', 'idx_ba_billing_oa', '`billingID`, `orderAmenityID`');
    await ensureIndex(connection, 'inquiry_message', 'idx_inquiry_thread_status', '`inquiryID`, `status`, `createdAt`');
    await ensureIndex(connection, 'inquiry_message', 'idx_inquiry_unread', '`inquiryID`, `senderRole`, `status`');
    await ensureIndex(connection, 'billing', 'idx_billing_lookup', '`bookingID`, `reservationID`, `billingStatus`');
    await ensureIndex(connection, 'inquiry', 'idx_inquiry_active', '`guestID`, `status`, `updatedAt`');
    await ensureIndex(connection, 'booking', 'idx_booking_active_stay', '`guestID`, `status`, `checkInDateTime`');

    console.log("Backfilling inquiry message normalization...");
    await connection.execute(`
      UPDATE inquiry_message 
      SET status = 'Delivered' 
      WHERE status IS NULL OR status = ''
    `).catch(() => {});
    await connection.execute(`
      UPDATE inquiry_message 
      SET senderRole = LOWER(senderType) 
      WHERE senderRole IS NULL OR senderRole = ''
    `).catch(() => {});
    await connection.execute(`
      UPDATE inquiry_message 
      SET messageText = message 
      WHERE messageText IS NULL OR messageText = ''
    `).catch(() => {});
    await connection.execute(`
      UPDATE inquiry_message 
      SET message = messageText 
      WHERE (message IS NULL OR message = '') AND messageText IS NOT NULL
    `).catch(() => {});
    await connection.execute(`
      UPDATE inquiry_message 
      SET readAt = timestamp 
      WHERE (status = 'Read' OR isRead = 1) AND readAt IS NULL
    `).catch(() => {});

    console.log("Ensuring foreign key constraints...");
    await ensureForeignKey(connection, 'orders', 'fk_orders_booking', 'FOREIGN KEY (`bookingID`) REFERENCES `booking` (`bookingID`) ON DELETE SET NULL');
    await ensureForeignKey(connection, 'booking', 'fk_booking_breakfast', 'FOREIGN KEY (`breakfastID`) REFERENCES `breakfast_option` (`breakfastID`)');
    await ensureForeignKey(connection, 'room', 'fk_room_floor', 'FOREIGN KEY (`floorID`) REFERENCES `floor` (`floorID`)');
    await ensureForeignKey(connection, 'room', 'fk_room_type', 'FOREIGN KEY (`roomTypeID`) REFERENCES `room_type` (`roomTypeID`)');
    await ensureForeignKey(connection, 'room_rate', 'fk_rate_roomtype', 'FOREIGN KEY (`roomTypeID`) REFERENCES `room_type` (`roomTypeID`)');
    await ensureForeignKey(connection, 'room_rate', 'fk_rate_floor', 'FOREIGN KEY (`floorID`) REFERENCES `floor` (`floorID`)');
    await ensureForeignKey(connection, 'room_rate', 'fk_rate_breakfast', 'FOREIGN KEY (`breakfastID`) REFERENCES `breakfast_option` (`breakfastID`)');
    await ensureForeignKey(connection, 'order_product', 'fk_op_product', 'FOREIGN KEY (`productID`) REFERENCES `products` (`productID`)');
    await ensureForeignKey(connection, 'order_amenities', 'fk_oa_amenity', 'FOREIGN KEY (`amenityID`) REFERENCES `amenities` (`amenityID`)');

    console.log("Normalizing room occupancy limits as exclusive capacity threshold...");
    await connection.execute(`
      UPDATE room r
      SET r.occupancyLimit = 4
      WHERE r.occupancyLimit IS NULL OR r.occupancyLimit < 1
    `).catch((e) => { console.warn("Room occupancyLimit sync note:", e.message); });

    console.log("Synchronizing active booking #1 financial figures...");
    await connection.execute(`
      UPDATE booking
      SET roomRate = 1500.00,
          roomCharge = 4500.00,
          remainingBalance = 4685.00,
          finalBalance = 4685.00
      WHERE bookingID = 1
    `).catch((e) => { console.warn("Booking 1 sync note:", e.message); });

    await connection.execute(`
      UPDATE billing
      SET totalAmount = 5485.00,
          remainingBalance = 4685.00,
          balance = 4685.00
      WHERE bookingID = 1
    `).catch((e) => { console.warn("Billing 1 sync note:", e.message); });

    console.log("All database migrations verified!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}
 
run();
