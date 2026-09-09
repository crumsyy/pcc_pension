import { getDbConnection, dbQuery } from '@/lib/db';
import { sendCourtesyHoldReminderEmail, sendCourtesyHoldReleasedEmail } from '@/lib/mailer';

/**
 * ReservationScheduler
 * Manages automated lifecycle for Courtesy Holds:
 * 1. 12-Hour & 6-Hour warning reminders (in-app notifications + email).
 * 2. 30-Minute grace period and automatic release of expired holds.
 * 3. Freeing room availability and dispatching notifications.
 */

let lastWarningCheck = 0;
let lastReleaseCheck = 0;

/**
 * Check and dispatch 12-hour and 6-hour expiry warning reminders
 */
export async function checkCourtesyHoldExpiryWarnings() {
  const now = Date.now();
  if (now - lastWarningCheck < 60000) return; // run at most once per minute
  lastWarningCheck = now;

  try {
    const conn = await getDbConnection();

    // Fetch active courtesy holds that have an expiry timestamp
    const [holds] = await conn.execute(`
      SELECT r.reservationID, r.guestID, r.roomID, r.reservationDateTime,
             r.holdExpiryDateTime, r.warning12SentAt, r.warning6SentAt,
             g.userID as guestUserID, g.firstName, g.lastName, g.email as guestEmail,
             rm.roomNumber, rt.type as roomType
      FROM reservation r
      JOIN guest g ON g.guestID = r.guestID
      JOIN room rm ON rm.roomID = r.roomID
      LEFT JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE r.status = 'Courtesy Hold'
        AND r.holdExpiryDateTime IS NOT NULL
        AND (r.warning12SentAt IS NULL OR r.warning6SentAt IS NULL)
    `);

    for (const hold of holds) {
      const expiry = new Date(hold.holdExpiryDateTime);
      const currentTime = new Date();
      const diffMs = expiry.getTime() - currentTime.getTime();
      const hoursRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));

      const checkInDate = hold.reservationDateTime ? String(hold.reservationDateTime).substring(0, 10) : '';
      const holdExpiryStr = expiry.toLocaleString('en-US', { timeZone: 'Asia/Manila' });
      const guestName = `${hold.firstName} ${hold.lastName}`.trim();

      const emailDetails = {
        reservationID: hold.reservationID,
        roomNumber: hold.roomNumber,
        roomType: hold.roomType || 'Standard Room',
        checkInDate,
        holdExpiryStr
      };

      // 12-Hour Warning Reminder
      if (hoursRemaining <= 12 && hoursRemaining > 6 && !hold.warning12SentAt) {
        await conn.execute("UPDATE reservation SET warning12SentAt = NOW() WHERE reservationID = ?", [hold.reservationID]);

        if (hold.guestUserID) {
          await conn.execute(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Courtesy Hold Expiring in 12 Hours', ?)",
            [
              hold.guestUserID,
              `Reminder: Your courtesy hold for Room ${hold.roomNumber} (Hold #${hold.reservationID}) expires in approx. 12 hours. Confirm with payment to secure your booking.`
            ]
          );
        }

        if (hold.guestEmail) {
          sendCourtesyHoldReminderEmail(hold.guestEmail, guestName, emailDetails, 12).catch(() => {});
        }
      }

      // 6-Hour Urgent Warning Reminder
      if (hoursRemaining <= 6 && diffMs > 0 && !hold.warning6SentAt) {
        await conn.execute("UPDATE reservation SET warning6SentAt = NOW() WHERE reservationID = ?", [hold.reservationID]);

        if (hold.guestUserID) {
          await conn.execute(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Urgent: Courtesy Hold Expiring in 6 Hours', ?)",
            [
              hold.guestUserID,
              `Urgent: Your courtesy hold for Room ${hold.roomNumber} (Hold #${hold.reservationID}) expires in approx. 6 hours! Please confirm with payment before it is released.`
            ]
          );
        }

        if (hold.guestEmail) {
          sendCourtesyHoldReminderEmail(hold.guestEmail, guestName, emailDetails, 6).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error("checkCourtesyHoldExpiryWarnings error:", err);
  }
}

/**
 * Check and automatically release expired courtesy holds past 30-min grace period
 */
export async function checkExpiredCourtesyHolds() {
  const now = Date.now();
  if (now - lastReleaseCheck < 30000) return; // run at most once per 30 seconds
  lastReleaseCheck = now;

  try {
    const conn = await getDbConnection();

    // Expire holds where current time is at least 30 minutes past holdExpiryDateTime
    const [expiredHolds] = await conn.execute(`
      SELECT r.reservationID, r.guestID, r.roomID, r.holdExpiryDateTime,
             g.userID as guestUserID, g.firstName, g.lastName, g.email as guestEmail,
             rm.roomNumber
      FROM reservation r
      JOIN guest g ON g.guestID = r.guestID
      JOIN room rm ON rm.roomID = r.roomID
      WHERE r.status = 'Courtesy Hold'
        AND r.holdExpiryDateTime IS NOT NULL
        AND NOW() >= DATE_ADD(r.holdExpiryDateTime, INTERVAL 30 MINUTE)
    `);

    for (const hold of expiredHolds) {
      // 1. Mark reservation as Released
      await conn.execute(
        "UPDATE reservation SET status = 'Released', releasedAt = NOW() WHERE reservationID = ?",
        [hold.reservationID]
      );

      // 2. Check if room has other active bookings or reservations
      const [activeOther] = await conn.execute(`
        SELECT 1 FROM (
          SELECT bookingID FROM booking 
          WHERE roomID = ? AND status NOT IN ('Cancelled', 'Checked Out', 'No Show')
          UNION ALL
          SELECT reservationID FROM reservation 
          WHERE roomID = ? AND status IN ('Pending', 'Confirmed', 'Courtesy Hold') AND reservationID != ?
        ) active_conflicts
      `, [hold.roomID, hold.roomID, hold.reservationID]);

      if (activeOther.length === 0) {
        await conn.execute("UPDATE room SET status = 'Available' WHERE roomID = ? AND status = 'Reserved'", [hold.roomID]);
      }

      const guestName = `${hold.firstName} ${hold.lastName}`.trim();

      // 3. Notify Guest
      if (hold.guestUserID) {
        await conn.execute(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Courtesy Hold Released', ?)",
          [
            hold.guestUserID,
            `Your courtesy hold for Room ${hold.roomNumber} (Hold #${hold.reservationID}) has expired and exceeded the 30-minute grace period. The room has been released.`
          ]
        );
      }

      if (hold.guestEmail) {
        sendCourtesyHoldReleasedEmail(hold.guestEmail, guestName, {
          reservationID: hold.reservationID,
          roomNumber: hold.roomNumber
        }).catch(() => {});
      }

      // 4. Notify Receptionists (roleID = 2)
      const [receptionists] = await conn.execute("SELECT userID FROM user WHERE roleID = 2 AND status = 'Active'");
      for (const s of receptionists) {
        await conn.execute(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Courtesy Hold Released Alert', ?)",
          [
            s.userID,
            `Courtesy hold #${hold.reservationID} for Room ${hold.roomNumber} (${guestName}) has expired and was automatically released.`
          ]
        );
      }
    }
  } catch (err) {
    console.error("checkExpiredCourtesyHolds error:", err);
  }
}
