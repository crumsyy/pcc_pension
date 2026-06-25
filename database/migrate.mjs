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

    console.log("Connected to database. Checking room table structure...");

    // Check if isArchived already exists
    const [columns] = await connection.execute("SHOW COLUMNS FROM room LIKE 'isArchived'");
    if (columns.length === 0) {
      console.log("Adding isArchived column to room table...");
      await connection.execute("ALTER TABLE room ADD COLUMN isArchived TINYINT(1) NOT NULL DEFAULT 0");
      console.log("Successfully added isArchived column!");
    } else {
      console.log("isArchived column already exists. Skipping.");
    }
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
