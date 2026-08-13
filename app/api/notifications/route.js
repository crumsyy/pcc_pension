import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Staff notification access (Administrator & Receptionist)
  if (session.role !== 'Administrator' && session.role !== 'Receptionist') {
    return NextResponse.json({ success: true, notifications: [] });
  }

  const userID = session.userID;

  try {
    // 1. Auto-generate Low Inventory Alerts (quantity <= reorderLevel) for Staff
    try {
      const lowStockItems = await dbQuery(`
        SELECT i.inventoryID, p.name as productName, i.quantity, COALESCE(i.reorderLevel, 5) as reorderLevel
        FROM inventory i
        JOIN products p ON p.productID = i.productID
        WHERE i.quantity <= COALESCE(i.reorderLevel, 5) AND i.isArchived = 0
      `);

      for (const item of lowStockItems) {
        const alertMsg = `Low Inventory Alert: ${item.productName} stock has dropped to ${item.quantity} units (Threshold: ${item.reorderLevel} units).`;
        const alreadyNotified = await dbQuery(
          "SELECT notificationID FROM notification WHERE userID = ? AND message = ?",
          [userID, alertMsg]
        );
        if (alreadyNotified.length === 0) {
          await dbQuery(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Low Inventory Alert', ?)",
            [userID, alertMsg]
          );
        }
      }
    } catch (invErr) {
      console.error("Low inventory notification check failed:", invErr);
    }

    // 2. Auto-generate Check-in (24h) and Check-out (1h / Overdue) Alerts for Staff (Admin & Receptionist)
    try {
      const staffUsers = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
      const staffUserIDs = staffUsers.map(a => a.userID);

      // Bookings scheduled for Check-in within next 24 hours
      const upcomingCheckIns = await dbQuery(`
        SELECT b.bookingID, b.guestID, g.firstName, g.lastName
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        WHERE b.status IN ('Confirmed', 'Pending Check-in', 'Pending')
          AND b.checkInDateTime BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 24 HOUR)
      `);

      for (const b of upcomingCheckIns) {
        const staffMsg = `Upcoming Check-in: Booking #${b.bookingID} for ${b.firstName} ${b.lastName} is scheduled within 24 hours.`;
        for (const sID of staffUserIDs) {
          const alreadyNotified = await dbQuery(
            "SELECT notificationID FROM notification WHERE userID = ? AND message = ?",
            [sID, staffMsg]
          );
          if (alreadyNotified.length === 0) {
            await dbQuery(
              "INSERT INTO notification (userID, title, message) VALUES (?, 'Upcoming Check-in Alert', ?)",
              [sID, staffMsg]
            );
          }
        }
      }

      // Bookings scheduled for Check-out within next 1 hour
      const upcomingCheckOuts = await dbQuery(`
        SELECT b.bookingID, b.guestID, g.firstName, g.lastName
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        WHERE b.status = 'Checked In'
          AND b.checkOutDateTime BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 HOUR)
      `);

      for (const b of upcomingCheckOuts) {
        const staffMsg = `Check-out Reminder: Booking #${b.bookingID} for ${b.firstName} ${b.lastName} is scheduled for check-out in 1 hour.`;
        for (const sID of staffUserIDs) {
          const alreadyNotified = await dbQuery(
            "SELECT notificationID FROM notification WHERE userID = ? AND message = ?",
            [sID, staffMsg]
          );
          if (alreadyNotified.length === 0) {
            await dbQuery(
              "INSERT INTO notification (userID, title, message) VALUES (?, 'Check-out Reminder', ?)",
              [sID, staffMsg]
            );
          }
        }
      }
    } catch (reminderErr) {
      console.error("Staff auto-reminder generation failed:", reminderErr);
    }

    // Fetch latest 15 notifications for current User
    const notifications = await dbQuery(
      "SELECT * FROM notification WHERE userID = ? ORDER BY createdAt DESC LIMIT 15",
      [userID]
    );

    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return NextResponse.json({ success: true, notifications: [] });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userID = session.userID;

  try {
    const body = await request.json();
    const { action, notificationID } = body;

    if (action === 'mark_all_read') {
      await dbQuery("UPDATE notification SET isRead = 1 WHERE userID = ?", [userID]);
      return NextResponse.json({ success: true, message: 'All notifications marked as read.' });
    }

    if (action === 'mark_read') {
      await dbQuery("UPDATE notification SET isRead = 1 WHERE notificationID = ? AND userID = ?", [notificationID, userID]);
      return NextResponse.json({ success: true, message: 'Notification marked as read.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Update notifications error:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
