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
 
    console.log("Altering purchase_order status column ENUM to support 'Canceled'...");
    await connection.execute("ALTER TABLE purchase_order MODIFY COLUMN status ENUM('Pending','Approved','Completed','Canceled') NOT NULL DEFAULT 'Pending'");

    console.log("Altering user table for suspension and archiving...");
    await connection.execute("ALTER TABLE `user` MODIFY COLUMN `status` ENUM('Active','Inactive','Suspended') NOT NULL DEFAULT 'Active'");
    await ensureColumn(connection, 'user', 'suspendedUntil', 'DATETIME DEFAULT NULL');
    await ensureColumn(connection, 'user', 'suspensionRemarks', 'VARCHAR(255) DEFAULT NULL');
    await ensureColumn(connection, 'user', 'isDeleted', 'TINYINT(1) NOT NULL DEFAULT 0');

    console.log("Altering room table for description...");
    await ensureColumn(connection, 'room', 'description', 'TEXT DEFAULT NULL');

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

    if (createdInquiry) {
      console.log("Seeding mock inquiries...");
      await connection.execute(`
        INSERT INTO \`inquiry\` (\`name\`, \`email\`, \`message\`, \`status\`, \`response\`, \`isChatbotForwarded\`) VALUES
        ('Maria Santos', 'maria.santos@example.com', 'Hi, do you have room rates for family rooms? We plan to stay this coming weekend.', 'Pending', NULL, 0),
        ('Alex Lim', 'alex.lim@example.com', 'Are pets allowed in the matrimonial room? I have a small dog.', 'Pending', NULL, 1),
        ('Sarah G.', 'sarahg@example.com', 'Is breakfast included in the Standard Matrimonial room? How much is the extra charge?', 'Responded', 'Yes, breakfast is optional. Standard Matrimonial rate is ₱1,200 without breakfast and ₱1,500 with breakfast.', 0)
      `);
    }

    console.log("Renaming Breakfast/Silog Meals to Cooked Meals...");
    await connection.execute("UPDATE product_category SET name = 'Cooked Meals' WHERE name = 'Breakfast/Silog Meals'");

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
