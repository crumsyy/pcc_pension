import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userID = session.userID;
  const isStaff = session.role === 'Administrator' || session.role === 'Receptionist';

  try {
    // 1. Auto-generate Low Inventory Alerts (quantity <= reorderLevel) for Staff
    if (isStaff) {
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
    }

    // 2. Auto-generate Pre-Check-in (3h), Pre-Check-out (2h), and Exceeded Check-out Alerts
    try {
      const receptionistUsers = await dbQuery("SELECT userID FROM user WHERE roleID = 2 AND status = 'Active'");
      const receptionistUserIDs = receptionistUsers.map(a => a.userID);

      // A. Pre-Check-In Notifications (within 3 hours of scheduled check-in)
      const upcomingCheckIns = await dbQuery(`
        SELECT b.bookingID, b.guestID, g.firstName, g.lastName, g.userID as guestUserID
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        WHERE b.status IN ('Confirmed', 'Pending Check-in', 'Pending')
          AND b.checkInDateTime BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 3 HOUR)
      `);

      for (const b of upcomingCheckIns) {
        // Guest Notification
        if (b.guestUserID) {
          const guestMsg = "Your check-in time is approaching. Please prepare for arrival.";
          const alreadyNotified = await dbQuery("SELECT notificationID FROM notification WHERE userID = ? AND message = ?", [b.guestUserID, guestMsg]);
          if (alreadyNotified.length === 0) {
            await dbQuery("INSERT INTO notification (userID, title, message) VALUES (?, 'Pre-Check-In Alert', ?)", [b.guestUserID, guestMsg]);
          }
        }
        // Receptionist Notification
        const staffMsg = `Upcoming Check-in: Booking #${b.bookingID} (${b.firstName} ${b.lastName}) check-in time is approaching within 3 hours.`;
        for (const sID of receptionistUserIDs) {
          const alreadyNotified = await dbQuery("SELECT notificationID FROM notification WHERE userID = ? AND message = ?", [sID, staffMsg]);
          if (alreadyNotified.length === 0) {
            await dbQuery("INSERT INTO notification (userID, title, message) VALUES (?, 'Pre-Check-In Alert', ?)", [sID, staffMsg]);
          }
        }
      }

      // B. Pre-Check-Out Notifications (within 2 hours of scheduled check-out)
      const upcomingCheckOuts = await dbQuery(`
        SELECT b.bookingID, b.guestID, g.firstName, g.lastName, g.userID as guestUserID
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        WHERE b.status = 'Checked In'
          AND b.checkOutDateTime BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 2 HOUR)
      `);

      for (const b of upcomingCheckOuts) {
        // Guest Notification
        if (b.guestUserID) {
          const guestMsg = "Your stay is almost over. Please prepare for check-out or request an extension.";
          const alreadyNotified = await dbQuery("SELECT notificationID FROM notification WHERE userID = ? AND message = ?", [b.guestUserID, guestMsg]);
          if (alreadyNotified.length === 0) {
            await dbQuery("INSERT INTO notification (userID, title, message) VALUES (?, 'Pre-Check-Out Alert', ?)", [b.guestUserID, guestMsg]);
          }
        }
        // Receptionist Notification
        const staffMsg = `Upcoming Check-out: Booking #${b.bookingID} (${b.firstName} ${b.lastName}) is approaching scheduled check-out within 2 hours.`;
        for (const sID of receptionistUserIDs) {
          const alreadyNotified = await dbQuery("SELECT notificationID FROM notification WHERE userID = ? AND message = ?", [sID, staffMsg]);
          if (alreadyNotified.length === 0) {
            await dbQuery("INSERT INTO notification (userID, title, message) VALUES (?, 'Pre-Check-Out Alert', ?)", [sID, staffMsg]);
          }
        }
      }

      // C. Exceeded Check-Out Handling (Overdue past 12:00 PM)
      const overdueCheckOuts = await dbQuery(`
        SELECT b.bookingID, b.guestID, g.firstName, g.lastName, g.userID as guestUserID
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        WHERE b.status = 'Checked In'
          AND NOW() > b.checkOutDateTime
      `);

      for (const b of overdueCheckOuts) {
        // Guest Notification
        if (b.guestUserID) {
          const guestMsg = "Check-out time exceeded! A late fee of ₱100 per hour applies until check-out is processed.";
          const alreadyNotified = await dbQuery("SELECT notificationID FROM notification WHERE userID = ? AND message = ?", [b.guestUserID, guestMsg]);
          if (alreadyNotified.length === 0) {
            await dbQuery("INSERT INTO notification (userID, title, message) VALUES (?, 'Exceeded Check-Out Alert', ?)", [b.guestUserID, guestMsg]);
          }
        }
        // Receptionist Notification
        const staffMsg = `Exceeded Check-out: Booking #${b.bookingID} (${b.firstName} ${b.lastName}) has exceeded checkout time. ₱100/hr late fee applies.`;
        for (const sID of receptionistUserIDs) {
          const alreadyNotified = await dbQuery("SELECT notificationID FROM notification WHERE userID = ? AND message = ?", [sID, staffMsg]);
          if (alreadyNotified.length === 0) {
            await dbQuery("INSERT INTO notification (userID, title, message) VALUES (?, 'Exceeded Check-Out Alert', ?)", [sID, staffMsg]);
          }
        }
      }
    } catch (reminderErr) {
      console.error("Staff auto-reminder generation failed:", reminderErr);
    }

    // Fetch latest 15 notifications for current User
    let sql = "SELECT * FROM notification WHERE userID = ?";
    if (session.role === 'Administrator') {
      sql += " AND title IN ('Low Inventory Alert', 'Payment Received', 'Down Payment Received')";
    } else if (session.role === 'Guest') {
      // Payment receipts and staff online payment alerts are strictly for Admin and Receptionist
      sql += " AND title NOT LIKE '%Payment Received%' AND title NOT LIKE '%New GCash%'";
    }
    sql += " ORDER BY createdAt DESC LIMIT 20";

    const notifications = await dbQuery(sql, [userID]);

    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return NextResponse.json({ success: true, notifications: [] });
  }
}

async function handleUpdateNotifications(request, session) {
  const userID = session.userID;

  try {
    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }

    const { action, notificationID } = body;

    // Single notification mark-as-read
    if (notificationID || action === 'mark_read') {
      const notifId = notificationID || body.id;
      if (notifId) {
        await dbQuery("UPDATE notification SET isRead = 1 WHERE notificationID = ? AND userID = ?", [notifId, userID]);
        return NextResponse.json({ success: true, message: 'Notification marked as read.' });
      }
    }

    // Mark all notifications as read (explicit action or default PUT without notificationID)
    if (action === 'mark_all_read' || !notificationID) {
      await dbQuery("UPDATE notification SET isRead = 1 WHERE userID = ?", [userID]);
      return NextResponse.json({ success: true, message: 'All notifications marked as read.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Update notifications error:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return handleUpdateNotifications(request, session);
}

export async function PUT(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return handleUpdateNotifications(request, session);
}
