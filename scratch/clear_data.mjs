import fs from 'fs';
import path from 'path';

// Parse .env.local manually
try {
  const envConfig = fs.readFileSync(path.resolve('.env.local'), 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const val = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (key && val) {
        process.env[key.trim()] = val;
      }
    }
  }
} catch (e) {
  console.warn('Could not load .env.local file:', e.message);
}

import { getDbConnection } from '../lib/db.js';

async function clearData() {
  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    console.log('Clearing all transactional records...');
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    const tables = [
      'transactions',
      'payment',
      'incidental_charge',
      'billing',
      'order_product',
      'order_amenities',
      'orders',
      'borrow_transaction',
      'booking_guest_details',
      'booking',
      'inquiry_message',
      'inquiry'
    ];

    for (const table of tables) {
      try {
        await conn.execute(`DELETE FROM ${table}`);
        await conn.execute(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
        console.log(`✓ Cleared table: ${table}`);
      } catch (err) {
        console.warn(`! Warning clearing ${table}:`, err.message);
      }
    }

    await conn.execute("UPDATE room SET status = 'Available' WHERE isArchived = 0 AND status != 'Under Maintenance'");
    console.log('✓ Reset all active room statuses to Available');

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🎉 SUCCESS: All transactional data cleared! Ready for fresh testing.');
  } catch (error) {
    console.error('Error clearing transactional data:', error);
  } finally {
    conn.release();
    process.exit(0);
  }
}

clearData();
