import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 4000,
  user: process.env.DB_USER || 'cvZ3ffLUpCoisow.root',
  password: process.env.DB_PASSWORD || 'TG4lX1CMCEP3arow',
  database: process.env.DB_NAME || 'test',
  ssl: { rejectUnauthorized: false }
});

async function executeFullReset() {
  const conn = await pool.getConnection();
  try {
    console.log("=== 1. FETCHING EXISTING TABLES & PRE-RESET STATUS ===");
    const [tablesRes] = await conn.execute("SHOW TABLES");
    const tableNames = tablesRes.map(row => Object.values(row)[0]);
    console.log("Found Tables:", tableNames);

    console.log("\n=== 2. WIPING TRANSACTIONAL RECORDS (CHILD TO PARENT) ===");

    const deleteTable = async (t) => {
      if (tableNames.includes(t)) {
        try {
          const [res] = await conn.execute(`DELETE FROM ${t}`);
          console.log(`✓ Cleared [${t}]: ${res.affectedRows} records removed.`);
        } catch (e) {
          console.error(`X Error clearing [${t}]: ${e.message}`);
        }
      }
    };

    // 1. Transactions & Payments
    await deleteTable('transactions');
    await deleteTable('payment');
    await deleteTable('payment_logs');

    // 2. Billing & Incidentals
    await deleteTable('billing_amenity');
    await deleteTable('billing_product');
    await deleteTable('billing_room');
    await deleteTable('incidental_charge');
    await deleteTable('billing');

    // 3. Food/Amenity Orders
    await deleteTable('order_product');
    await deleteTable('order_amenities');
    await deleteTable('orders');
    await deleteTable('borrow_transaction');

    // 4. Booking & Guests Details
    await deleteTable('booking_guest_details');
    await deleteTable('booking');

    // 5. Reservations
    await deleteTable('reservation');

    // 6. Inquiries & Notifications
    await deleteTable('inquiry_message');
    await deleteTable('inquiry');
    await deleteTable('notification');

    console.log("\n=== 3. PRESERVING 3 DESIGNATED TEST ACCOUNTS (GUEST, ADMIN, RECEPTIONIST) ===");
    
    // Inspect current users
    const [users] = await conn.execute("SELECT userID, email, roleID FROM user");
    console.log("Current Users in DB:", users);

    // Identify userIDs for 1 Admin, 1 Receptionist, 1 Guest
    let adminUser = users.find(u => u.roleID === 1);
    let recepUser = users.find(u => u.roleID === 2);
    let guestUser = users.find(u => u.roleID === 3);

    const keepUserIDs = [adminUser?.userID, recepUser?.userID, guestUser?.userID].filter(Boolean);
    console.log("Preserving User IDs:", keepUserIDs);

    if (keepUserIDs.length > 0) {
      const placeholders = keepUserIDs.map(() => '?').join(',');
      const [delGuest] = await conn.execute(`DELETE FROM guest WHERE userID NOT IN (${placeholders})`, keepUserIDs);
      console.log(`✓ Cleaned non-test guest profiles: ${delGuest.affectedRows} removed.`);

      const [delStaff] = await conn.execute(`DELETE FROM staff WHERE userID NOT IN (${placeholders})`, keepUserIDs);
      console.log(`✓ Cleaned non-test staff profiles: ${delStaff.affectedRows} removed.`);

      const [delUser] = await conn.execute(`DELETE FROM user WHERE userID NOT IN (${placeholders})`, keepUserIDs);
      console.log(`✓ Cleaned non-test user accounts: ${delUser.affectedRows} removed.`);
    }

    console.log("\n=== 4. RESETTING ROOM STATUSES ===");
    await conn.execute("UPDATE room SET status = 'Available' WHERE isArchived = 0 AND status != 'Under Maintenance'");
    console.log("✓ Reset non-maintenance room statuses to 'Available'.");

    console.log("\n=== 5. RESETTING AUTO_INCREMENT COUNTERS ===");
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
          console.log(`✓ Reset AUTO_INCREMENT = 1 for [${t}]`);
        } catch (e) {
          // ignore
        }
      }
    }

    console.log("\n=== 6. VERIFYING MASTER TABLES & INTENDED ACCOUNTS ===");
    const masterTables = [
      'room', 'room_type', 'room_rate', 'amenities', 'products',
      'inventory_batch', 'purchase_orders', 'discounts', 'promotions',
      'payment_method', 'floor', 'product_category', 'role'
    ];

    for (const mt of masterTables) {
      if (tableNames.includes(mt)) {
        const [res] = await conn.execute(`SELECT COUNT(*) as count FROM ${mt}`);
        console.log(`Master Table [${mt}]: ${res[0].count} records intact.`);
      }
    }

    const [finalUsers] = await conn.execute(`
      SELECT u.userID, u.email, u.roleID, g.firstName, g.lastName 
      FROM user u 
      LEFT JOIN guest g ON g.userID = u.userID
    `);
    console.log("\nRemaining Preserved Accounts:", finalUsers);

    console.log("\n🎉 RESET COMPLETED SUCCESSFULLY 100%!");
  } catch (err) {
    console.error("Reset Error:", err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

executeFullReset();
