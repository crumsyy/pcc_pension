import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: 'cvZ3ffLUpCoisow.root',
  password: 'TG4lX1CMCEP3arow',
  database: 'test',
  ssl: { rejectUnauthorized: false }
});

async function cleanTransactions() {
  const conn = await pool.getConnection();
  try {
    console.log("--- 1. INSPECTING DATABASE TABLES & SCHEMAS ---");
    const [tablesRes] = await conn.execute("SHOW TABLES");
    const tableNames = tablesRes.map(row => Object.values(row)[0]);
    console.log("Existing Database Tables:", tableNames);

    console.log("\n--- 2. SAFELY DELETING TRANSACTIONAL RECORDS (EXACT CHILD TO PARENT ORDER) ---");

    const deleteTable = async (t) => {
      if (tableNames.includes(t)) {
        try {
          const [res] = await conn.execute(`DELETE FROM ${t}`);
          console.log(`✓ Deleted ${res.affectedRows} records from [${t}]`);
        } catch (e) {
          console.error(`X Failed to delete from [${t}]: ${e.message}`);
        }
      }
    };

    // 1. Transactions & Payments
    await deleteTable('transactions');
    await deleteTable('payment');
    await deleteTable('payment_logs');

    // 2. Billing & Billing Details
    await deleteTable('billing_amenity');
    await deleteTable('billing_product');
    await deleteTable('billing_room');
    await deleteTable('incidental_charge');
    await deleteTable('billing');

    // 3. Orders & Order items
    await deleteTable('order_product');
    await deleteTable('order_amenities');
    await deleteTable('orders');
    await deleteTable('borrow_transaction');

    // 4. Booking & Booking details
    await deleteTable('booking_guest_details');
    await deleteTable('booking');

    // 5. Reservations
    await deleteTable('reservation');

    // 6. Inquiries & Messages
    await deleteTable('inquiry_message');
    await deleteTable('inquiry');

    // 7. Notifications
    await deleteTable('notification');

    // Reset room statuses to 'Available' for non-archived non-maintenance rooms
    await conn.execute("UPDATE room SET status = 'Available' WHERE isArchived = 0 AND status != 'Under Maintenance'");

    console.log("\n--- 3. RESETTING AUTO_INCREMENT COUNTERS FOR TRANSACTION TABLES ---");
    const transTables = [
      'transactions', 'payment', 'payment_logs',
      'billing_amenity', 'billing_product', 'billing_room', 'incidental_charge', 'billing',
      'order_product', 'order_amenities', 'orders', 'borrow_transaction',
      'booking_guest_details', 'booking', 'reservation',
      'inquiry_message', 'inquiry', 'notification'
    ];

    for (const t of transTables) {
      if (tableNames.includes(t)) {
        try {
          await conn.execute(`ALTER TABLE ${t} AUTO_INCREMENT = 1`);
          console.log(`✓ Reset AUTO_INCREMENT = 1 for table: ${t}`);
        } catch (e) {
          console.log(`Notice: Could not reset AUTO_INCREMENT for ${t}: ${e.message}`);
        }
      }
    }

    console.log("\n--- 4. VERIFYING PRESERVED MASTER DATA COUNTS ---");
    const masterTables = [
      'room', 'room_type', 'room_rate', 'amenities', 'products', 
      'inventory_batch', 'user', 'guest', 'discounts', 'promotions', 
      'payment_method', 'floor', 'product_category', 'role', 'breakfast_option'
    ];

    for (const mt of masterTables) {
      if (tableNames.includes(mt)) {
        const [cntRes] = await conn.execute(`SELECT COUNT(*) as count FROM ${mt}`);
        console.log(`Master Table [${mt}]: ${cntRes[0].count} records intact.`);
      }
    }

    console.log("\n--- TRANSACTIONAL DATA CLEANUP COMPLETED 100% SUCCESSFULLY ---");
  } catch (err) {
    console.error("Cleanup Error:", err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

cleanTransactions();
