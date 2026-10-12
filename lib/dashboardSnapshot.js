import mysql from 'mysql2/promise';
import { dbQuery } from './db';

// Dashboard snapshot: all receptionist-dashboard reads in ONE DB roundtrip.
//
// Production functions run next to the DB (sin1), but every roundtrip still
// costs latency + pool time, so the 9 dashboard queries ship as a single
// multi-statement batch over a dedicated read-only connection. The SQL is
// fully static (no user input), and any batch failure falls back to the
// legacy parallel path below. Results carry a short TTL matching the
// client's 15s poll interval, so background refreshes are near-instant
// with no staleness beyond one poll cycle.

const SNAPSHOT_TTL_MS = 15000;

const BOOKING_COUNTS_SQL = `
      SELECT
        SUM(status IN ('Occupied', 'Late Checkout', 'Pending Room Verification', 'Room Verified', 'Bill Finalized', 'Final Billing Updated', 'Paid', 'Payment Completed')) AS activeStays,
        SUM(checkOutDateTime >= CURDATE() AND checkOutDateTime < DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND status IN ('Checked Out', 'Completed')) AS todayCheckouts
      FROM booking
    `;
const ROOM_COUNTS_SQL = `
      SELECT
        SUM(status = 'Occupied') AS occupied,
        SUM(status = 'Available') AS available,
        SUM(status = 'Under Maintenance') AS maintenance
      FROM room WHERE isArchived = 0
    `;
const PENDING_RES_COUNT_SQL = `
      SELECT COUNT(*) as count FROM reservation
      WHERE status IN ('Pending', 'Confirmed', 'Courtesy Hold', 'Overdue Check-In')
        AND status NOT IN ('Cancelled', 'Canceled', 'Released', 'Expired', 'No Show', 'Booked', 'Completed')
        AND NOT EXISTS (SELECT 1 FROM booking b WHERE b.reservationID = reservation.reservationID)
        AND (
          status != 'Courtesy Hold'
          OR (holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(holdExpiryDateTime, INTERVAL 30 MINUTE))
        )
    `;
const CHECK_INS_SQL = `
      SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
             COALESCE(g.firstName, 'Guest') as firstName, COALESCE(g.lastName, '') as lastName, g.contact,
             rm.roomNumber, rt.type as roomType
      FROM booking b
      LEFT JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE b.status IN ('Occupied', 'Late Checkout', 'Pending Room Verification', 'Room Verified', 'Bill Finalized', 'Final Billing Updated', 'Paid', 'Payment Completed')
        AND b.status NOT IN ('Completed', 'Checked Out', 'Cancelled', 'No Show')
      ORDER BY rm.roomNumber ASC
      LIMIT 10
    `;
const PENDING_RES_SQL = `
      SELECT r.reservationID, r.reservationDateTime, r.status, r.isCourtesyHold, r.holdExpiryDateTime,
             COALESCE(g.firstName, 'Walk-in') as firstName, COALESCE(g.lastName, 'Guest') as lastName, g.contact,
             rm.roomNumber, rt.type as roomType
      FROM reservation r
      LEFT JOIN guest g ON g.guestID = r.guestID
      JOIN room rm ON rm.roomID = r.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE r.status IN ('Pending', 'Confirmed', 'Courtesy Hold', 'Overdue Check-In')
        AND r.status NOT IN ('Cancelled', 'Canceled', 'Released', 'Expired', 'No Show', 'Booked', 'Completed')
        AND NOT EXISTS (SELECT 1 FROM booking b WHERE b.reservationID = r.reservationID)
        AND (
          r.status != 'Courtesy Hold'
          OR (r.holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(r.holdExpiryDateTime, INTERVAL 30 MINUTE))
        )
      ORDER BY r.reservationDateTime ASC
      LIMIT 10
    `;
const ROOMS_SQL = `
      SELECT rm.roomID, rm.roomNumber, rm.status, rt.type as roomType, fl.name as floor
      FROM room rm
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      JOIN floor fl ON fl.floorID = rm.floorID
      WHERE rm.isArchived = 0
      ORDER BY fl.name, rm.roomNumber
    `;
const CONFIRMED_SQL = `
      SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
             COALESCE(g.firstName, 'Guest') as firstName, COALESCE(g.lastName, '') as lastName, g.contact,
             rm.roomNumber, rt.type as roomType
      FROM booking b
      LEFT JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE b.status IN ('Booked')
        AND b.status NOT IN ('Completed', 'Checked Out', 'Cancelled', 'No Show')
      ORDER BY b.checkInDateTime ASC
      LIMIT 10
    `;
const INQUIRIES_SQL = `
      SELECT inquiryID, name as guestName, email, message as subject, status, DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i') as createdAt
      FROM inquiry
      ORDER BY createdAt DESC
      LIMIT 6
    `;
const ORDERS_SQL = `
      SELECT o.orderID, o.orderStatus, DATE_FORMAT(o.orderDateTime, '%Y-%m-%d %H:%i') as orderDateTime,
             g.firstName, g.lastName, rm.roomNumber
      FROM orders o
      JOIN guest g ON g.guestID = o.guestID
      LEFT JOIN booking b ON b.guestID = g.guestID AND b.status IN ('Occupied', 'Late Checkout', 'Pending Room Verification', 'Room Verified', 'Bill Finalized')
      LEFT JOIN room rm ON rm.roomID = b.roomID
      ORDER BY o.orderDateTime DESC
      LIMIT 6
    `;

const BATCH_SQL = [
  BOOKING_COUNTS_SQL,
  ROOM_COUNTS_SQL,
  PENDING_RES_COUNT_SQL,
  CHECK_INS_SQL,
  PENDING_RES_SQL,
  ROOMS_SQL,
  CONFIRMED_SQL,
  INQUIRIES_SQL,
  ORDERS_SQL
].join(';\n');

let snapshotPool = null;
let cachedSnapshot = null;
let cachedAt = 0;

function getSnapshotPool() {
  if (!snapshotPool) {
    snapshotPool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 3,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 5000,
      multipleStatements: true,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
  }
  return snapshotPool;
}

async function fetchSnapshotLegacy() {
  const [
    bookingCounts,
    roomCounts,
    pendingResRes,
    checkInsList,
    pendingResList,
    rooms,
    confirmedBookingsList,
    guestInquiriesList,
    guestOrdersList
  ] = await Promise.all([
    dbQuery(BOOKING_COUNTS_SQL),
    dbQuery(ROOM_COUNTS_SQL),
    dbQuery(PENDING_RES_COUNT_SQL),
    dbQuery(CHECK_INS_SQL),
    dbQuery(PENDING_RES_SQL),
    dbQuery(ROOMS_SQL),
    dbQuery(CONFIRMED_SQL),
    dbQuery(INQUIRIES_SQL).catch(() => []),
    dbQuery(ORDERS_SQL).catch(() => [])
  ]);
  return {
    bookingCounts,
    roomCounts,
    pendingResRes,
    checkInsList,
    pendingResList,
    rooms,
    confirmedBookingsList,
    guestInquiriesList,
    guestOrdersList
  };
}

export async function fetchDashboardSnapshot() {
  const now = Date.now();
  if (cachedSnapshot && now - cachedAt < SNAPSHOT_TTL_MS) {
    return cachedSnapshot;
  }
  try {
    const pool = getSnapshotPool();
    const [sets] = await pool.query(BATCH_SQL);
    const rows = Array.isArray(sets[0]) ? sets : [sets];
    const snapshot = {
      bookingCounts: rows[0] || [],
      roomCounts: rows[1] || [],
      pendingResRes: rows[2] || [],
      checkInsList: rows[3] || [],
      pendingResList: rows[4] || [],
      rooms: rows[5] || [],
      confirmedBookingsList: rows[6] || [],
      guestInquiriesList: rows[7] || [],
      guestOrdersList: rows[8] || []
    };
    cachedSnapshot = snapshot;
    cachedAt = now;
    return snapshot;
  } catch (err) {
    console.warn('[dashboard] snapshot batch failed, falling back to parallel queries:', err.message);
    const snapshot = await fetchSnapshotLegacy();
    cachedSnapshot = snapshot;
    cachedAt = now;
    return snapshot;
  }
}
