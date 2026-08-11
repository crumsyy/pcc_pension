import mysql from 'mysql2/promise';

async function testConnection(host, port, user, password, database, ssl) {
  console.log(`Testing connection to ${host}:${port} (${database})...`);
  try {
    const conn = await mysql.createConnection({
      host,
      port: parseInt(port),
      user,
      password,
      database,
      ssl: ssl ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 5000
    });
    console.log(`✅ SUCCESS connecting to ${host}:${port}`);
    const [rows] = await conn.execute('SELECT 1 + 1 AS result');
    console.log('Query result:', rows);
    await conn.end();
    return true;
  } catch (err) {
    console.error(`❌ FAILED connecting to ${host}:${port}:`, err.message);
    return false;
  }
}

async function main() {
  // Test TiDB Cloud
  await testConnection(
    'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    '4000',
    'cvZ3ffLUpCoisow.root',
    'TG4lX1CMCEP3arow',
    'test',
    true
  );

  // Test local MySQL
  await testConnection(
    'localhost',
    '3306',
    'root',
    '',
    'pcc_pension',
    false
  );
}

main();
