import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const rawVal = parts.slice(1).join('=').trim();
      const cleanVal = rawVal.split('#')[0].split('//')[0].trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = cleanVal;
    }
  });
}

async function cleanReset() {
  console.log("=================================================");
  console.log(" PCC Home Suite - Transactional Clean Reset");
  console.log("=================================================");
  console.log("Host:", process.env.DB_HOST);
  console.log("Database:", process.env.DB_NAME);

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

    console.log("\nConnected to database. Beginning safe transactional reset...");

    await connection.execute("SET FOREIGN_KEY_CHECKS = 0");

    const transactionalTables = [
      'transactions',
      'payment',
      'billing_room',
      'billing_product',
      'billing_amenity',
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
      'notification'
    ];

    for (const table of transactionalTables) {
      process.stdout.write(`- Truncating table: ${table}... `);
      await connection.execute(`DELETE FROM \`${table}\``);
      await connection.execute(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
      console.log("Done. (AUTO_INCREMENT reset to 1)");
    }

    // Clean transaction-related movements while keeping initial stock-in movements
    console.log("- Cleaning transaction-related inventory movements...");
    await connection.execute(`
      DELETE FROM \`inventory_movement\` 
      WHERE \`movementType\` IN ('Borrow', 'Return') 
         OR \`referenceNumber\` LIKE 'BK%' 
         OR \`referenceNumber\` LIKE 'RES%' 
         OR \`referenceNumber\` LIKE 'ORD%' 
         OR \`referenceNumber\` LIKE 'BOR%'
    `);

    // Reset rooms to 'Available' (except rooms under maintenance)
    console.log("- Resetting Occupied/Reserved rooms to 'Available'...");
    const [roomResult] = await connection.execute(`
      UPDATE \`room\` 
      SET \`status\` = 'Available' 
      WHERE \`status\` != 'Under Maintenance'
    `);
    console.log(`  Updated ${roomResult.affectedRows} rooms.`);

    await connection.execute("SET FOREIGN_KEY_CHECKS = 1");

    console.log("\n=================================================");
    console.log(" Verification Summary:");
    console.log("=================================================");

    const verificationQueries = [
      ['Reservations', 'SELECT COUNT(*) as count FROM reservation'],
      ['Bookings', 'SELECT COUNT(*) as count FROM booking'],
      ['Billing', 'SELECT COUNT(*) as count FROM billing'],
      ['Payments', 'SELECT COUNT(*) as count FROM payment'],
      ['Orders', 'SELECT COUNT(*) as count FROM orders'],
      ['Inquiries', 'SELECT COUNT(*) as count FROM inquiry'],
      ['Notifications', 'SELECT COUNT(*) as count FROM notification'],
      ['Occupied Rooms', "SELECT COUNT(*) as count FROM room WHERE status = 'Occupied'"],
      ['Available Rooms', "SELECT COUNT(*) as count FROM room WHERE status = 'Available'"],
      ['Users Preserved', 'SELECT COUNT(*) as count FROM user'],
      ['Guests Preserved', 'SELECT COUNT(*) as count FROM guest'],
      ['Products Preserved', 'SELECT COUNT(*) as count FROM products'],
      ['Amenities Preserved', 'SELECT COUNT(*) as count FROM amenities'],
    ];

    for (const [label, sql] of verificationQueries) {
      const [rows] = await connection.execute(sql);
      console.log(`  ${label.padEnd(22)}: ${rows[0].count}`);
    }

    console.log("\n[SUCCESS] Transaction reset complete! New bookings/reservations will start from ID 1 (RV00001, BK00001, TRA00001, ORD00001).");
  } catch (err) {
    console.error("\n[ERROR] Reset failed:", err);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

cleanReset();
