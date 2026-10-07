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
    // 1. Auto-generate Inventory Alerts (No Stock <= 0, Low Inventory <= minStock) for Staff
    if (isStaff) {
      try {
        // Retroactively update existing 0-unit notifications that were mistakenly labeled 'Low Inventory Alert'
        await dbQuery(`
          UPDATE notification
          SET title = 'No Stock Alert',
              message = REPLACE(message, 'Low Inventory Alert:', 'No Stock Alert:')
          WHERE title = 'Low Inventory Alert' 
            AND (message LIKE '%dropped to 0 units%' OR message LIKE '% 0 units%')
        `).catch(() => {});

        const [lowProducts, lowAmenities] = await Promise.all([
          dbQuery(`
            SELECT p.productID as id, p.name, p.quantity, COALESCE(p.minStock, 5) as threshold
            FROM products p
            JOIN product_category pc ON pc.productCategoryID = p.productCategoryID
            WHERE p.isArchived = 0 AND pc.name != 'Cooked Meals' AND p.quantity <= COALESCE(p.minStock, 5)
          `),
          dbQuery(`
            SELECT a.amenityID as id, a.name, a.quantity, COALESCE(a.minStock, 5) as threshold
            FROM amenities a
            WHERE a.isArchived = 0 AND a.quantity <= COALESCE(a.minStock, 5)
          `)
        ]);

        const allLowItems = [
          ...lowProducts.map(p => ({ name: p.name, quantity: p.quantity, threshold: p.threshold })),
          ...lowAmenities.map(a => ({ name: a.name, quantity: a.quantity, threshold: a.threshold }))
        ];

        for (const item of allLowItems) {
          const isZero = (item.quantity ?? 0) <= 0;
          const title = isZero ? 'No Stock Alert' : 'Low Inventory Alert';
          const alertMsg = isZero
            ? `No Stock Alert: ${item.name} is completely out of stock (0 units remaining). Please replenish inventory immediately.`
            : `Low Inventory Alert: ${item.name} stock has dropped to ${item.quantity} units (Threshold: ${item.threshold} units).`;

          const alreadyNotified = await dbQuery(
            "SELECT notificationID FROM notification WHERE userID = ? AND message = ?",
            [userID, alertMsg]
          );
          if (alreadyNotified.length === 0) {
            await dbQuery(
              "INSERT INTO notification (userID, title, message) VALUES (?, ?, ?)",
              [userID, title, alertMsg]
            );
          }
        }
      } catch (invErr) {
        console.error("Inventory notification check failed:", invErr);
      }
    }

    // 2. Auto-generate Pre-Check-in (3h), Pre-Check-out (2h), and Exceeded Check-out Alerts for Front Desk Receptionists (Admin does not receive booking operations)
    try {
      const staffUsers = await dbQuery("SELECT userID FROM user WHERE roleID = 2 AND status = 'Active'");
      const staffUserIDs = staffUsers.map(a => a.userID);

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
        // Staff Notification (Receptionist & Admin)
        const staffMsg = `Upcoming Check-in: Booking #${b.bookingID} (${b.firstName} ${b.lastName}) check-in time is approaching within 3 hours.`;
        for (const sID of staffUserIDs) {
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
        // Staff Notification (Receptionist & Admin)
        const staffMsg = `Upcoming Check-out: Booking #${b.bookingID} (${b.firstName} ${b.lastName}) is approaching scheduled check-out within 2 hours.`;
        for (const sID of staffUserIDs) {
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
        // Staff Notification (Receptionist & Admin)
        const staffMsg = `Exceeded Check-out: Booking #${b.bookingID} (${b.firstName} ${b.lastName}) has exceeded checkout time. ₱100/hr late fee applies.`;
        for (const sID of staffUserIDs) {
          const alreadyNotified = await dbQuery("SELECT notificationID FROM notification WHERE userID = ? AND message = ?", [sID, staffMsg]);
          if (alreadyNotified.length === 0) {
            await dbQuery("INSERT INTO notification (userID, title, message) VALUES (?, 'Exceeded Check-Out Alert', ?)", [sID, staffMsg]);
          }
        }
      }
    } catch (reminderErr) {
      console.error("Staff auto-reminder generation failed:", reminderErr);
    }

    // Fetch latest notifications for current User
    let sql = "SELECT * FROM notification WHERE userID = ?";
    if (session.role === 'Guest') {
      // Payment receipts and staff online payment alerts are strictly for Admin and Receptionist
      sql += " AND title NOT LIKE '%Payment Received%' AND title NOT LIKE '%New GCash%'";
    } else if (session.role === 'Administrator') {
      // Administrator strictly receives inventory low stock and payments received notifications (no inquiries, reservations, or bookings)
      sql += ` AND (
        title LIKE '%Payment%' 
        OR title LIKE '%GCash%' 
        OR title LIKE '%Inventory%' 
        OR title LIKE '%Stock%' 
        OR title LIKE '%Password%' 
        OR title LIKE '%Security%'
      )
      AND title NOT LIKE '%Inquiry%' 
      AND title NOT LIKE '%Reservation%' 
      AND title NOT LIKE '%Courtesy Hold%' 
      AND title NOT LIKE '%Pre-Check%' 
      AND title NOT LIKE '%Exceeded Check%' 
      AND (title NOT LIKE '%Booking%' OR title LIKE '%Payment%') 
      AND title NOT LIKE '%Inspection%'`;
    }
    sql += " ORDER BY createdAt DESC LIMIT 30";

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
    const notifId = notificationID || body.id;

    // Ensure readAt column exists
    await dbQuery("ALTER TABLE notification ADD COLUMN IF NOT EXISTS readAt DATETIME DEFAULT NULL").catch(() => {});

    // Single notification mark-as-read
    if (notifId && notifId !== 'all' && action !== 'mark_all_read') {
      await dbQuery(
        "UPDATE notification SET isRead = 1, readAt = CURRENT_TIMESTAMP WHERE userID = ? AND (notificationID = ? OR ? = 'all')",
        [userID, notifId, notifId]
      );
      return NextResponse.json({ 
        success: true, 
        message: 'Notification marked as read.', 
        updatedIDs: [parseInt(notifId, 10) || notifId] 
      });
    }

    // Mark all notifications as read (explicit action, notifId === 'all', or default without specific notificationID)
    if (action === 'mark_all_read' || notifId === 'all' || !notifId) {
      const unreadRows = await dbQuery("SELECT notificationID FROM notification WHERE userID = ? AND isRead = 0", [userID]);
      const updatedIDs = unreadRows.map(r => r.notificationID);
      await dbQuery(
        "UPDATE notification SET isRead = 1, readAt = CURRENT_TIMESTAMP WHERE userID = ?",
        [userID]
      );
      return NextResponse.json({ 
        success: true, 
        message: 'All notifications marked as read.', 
        updatedIDs 
      });
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

export async function PATCH(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return handleUpdateNotifications(request, session);
}
