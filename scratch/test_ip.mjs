import mysql from 'mysql2/promise';

async function main() {
  const ips = ['75.2.106.174', '99.83.224.222', 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com'];
  for (const host of ips) {
    console.log(`Testing ${host}...`);
    try {
      const conn = await mysql.createConnection({
        host,
        port: 4000,
        user: 'cvZ3ffLUpCoisow.root',
        password: 'TG4lX1CMCEP3arow',
        database: 'test',
        ssl: { rejectUnauthorized: false },
        connectTimeout: 4000
      });
      console.log(`✅ SUCCESS connecting to ${host}`);
      const [rows] = await conn.execute('SELECT 1 + 1 AS res');
      console.log('Result:', rows);
      await conn.end();
      return;
    } catch (err) {
      console.log(`❌ Failed ${host}: ${err.message}`);
    }
  }
}

main();
