import fs from 'fs';
import path from 'path';

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
} catch (e) {}

import { getDbConnection } from '../lib/db.js';

async function inspectTables() {
  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    const [tables] = await conn.execute('SHOW TABLES');
    console.log('--- ALL TABLES IN DATABASE ---');
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      const [countRes] = await conn.execute(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
      console.log(`Table: ${tableName.padEnd(25)} | Count: ${countRes[0].cnt}`);
    }
  } catch (err) {
    console.error('Error inspecting tables:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

inspectTables();
