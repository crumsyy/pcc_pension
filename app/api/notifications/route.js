import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userID = session.userID;

  try {
    // Check if the user has any notifications. If they have 0, let's insert 2 welcome notifications
    const countRes = await dbQuery("SELECT COUNT(*) as count FROM notification WHERE userID = ?", [userID]);
    const count = countRes[0]?.count || 0;

    if (count === 0) {
      if (session.role === 'Administrator') {
        await dbQuery(`
          INSERT INTO notification (userID, title, message) VALUES
          (?, 'Welcome to PCC Admin Panel', 'You have full administrative access. You can manage users, room types, rates, products, and check system reports.'),
          (?, 'Low Stock Alert Notification', 'The system will automatically notify you here when items in the inventory fall below 5 units.'),
          (?, 'Payment Received Alert', 'A payment of ₱3,500.00 was successfully received from guest Juan Dela Cruz for Booking #102.')
        `, [userID, userID, userID]);
      } else if (session.role === 'Receptionist') {
        await dbQuery(`
          INSERT INTO notification (userID, title, message) VALUES
          (?, 'Welcome to PCC Front Desk', 'Welcome back! You can check today\\'s check-ins, process reservations, and manage guest bills here.'),
          (?, 'New Registration Watch', 'When new guests register, their account requests will be updated. You can approve reservations from the dashboard.')
        `, [userID, userID]);
      } else {
        await dbQuery(`
          INSERT INTO notification (userID, title, message) VALUES
          (?, 'Welcome to PCC Home Suite Home!', 'Thank you for choosing PCC! Explore our available standard, twin, and deluxe matrimonial rooms and book your stay.'),
          (?, 'Profile Completed', 'Your guest profile is active. You can now track your reservations and check-in statuses under My Bookings.')
        `, [userID, userID]);
      }
    }

    // Auto-generate 24h Check-in and 1h Check-out Reminders
    try {
      const staffUsers = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
      const staffUserIDs = staffUsers.map(s => s.userID);

      // 1. Bookings scheduled within next 24 hours (Check-in)
      const upcomingCheckIns = await dbQuery(`
        SELECT b.bookingID, b.guestID, g.userID, g.firstName, g.lastName, b.checkInDateTime
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        WHERE b.status IN ('Confirmed', 'Pending Check-in', 'Pending')
          AND b.checkInDateTime BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 24 HOUR)
      `);

      for (const b of upcomingCheckIns) {
        const msg = "Reminder: Your booking is scheduled within the next 24 hours.";
        // Check if guest notified
        if (b.userID) {
          const alreadyNotified = await dbQuery(
            "SELECT notificationID FROM notification WHERE userID = ? AND message = ?",
            [b.userID, msg]
          );
          if (alreadyNotified.length === 0) {
            await dbQuery(
              "INSERT INTO notification (userID, title, message) VALUES (?, 'Upcoming Check-in Reminder', ?)",
              [b.userID, msg]
            );
          }
        }
        // Notify staff
        const staffMsg = `Reminder: Booking #${b.bookingID} for ${b.firstName} ${b.lastName} is scheduled within the next 24 hours.`;
        for (const sID of staffUserIDs) {
          const staffAlreadyNotified = await dbQuery(
            "SELECT notificationID FROM notification WHERE userID = ? AND message = ?",
            [sID, staffMsg]
          );
          if (staffAlreadyNotified.length === 0) {
            await dbQuery(
              "INSERT INTO notification (userID, title, message) VALUES (?, 'Upcoming Check-in Reminder', ?)",
              [sID, staffMsg]
            );
          }
        }
      }

      // 2. Bookings scheduled for Check-out within next 1 hour
      const upcomingCheckOuts = await dbQuery(`
        SELECT b.bookingID, b.guestID, g.userID, g.firstName, g.lastName, b.checkOutDateTime
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        WHERE b.status = 'Checked In'
          AND b.checkOutDateTime BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 HOUR)
      `);

      for (const b of upcomingCheckOuts) {
        const msg = "Reminder: Your scheduled check-out is in one hour.";
        if (b.userID) {
          const alreadyNotified = await dbQuery(
            "SELECT notificationID FROM notification WHERE userID = ? AND message = ?",
            [b.userID, msg]
          );
          if (alreadyNotified.length === 0) {
            await dbQuery(
              "INSERT INTO notification (userID, title, message) VALUES (?, 'Upcoming Check-out Reminder', ?)",
              [b.userID, msg]
            );
          }
        }
        const staffMsg = `Reminder: Booking #${b.bookingID} (${b.firstName} ${b.lastName}) scheduled check-out is in one hour.`;
        for (const sID of staffUserIDs) {
          const staffAlreadyNotified = await dbQuery(
            "SELECT notificationID FROM notification WHERE userID = ? AND message = ?",
            [sID, staffMsg]
          );
          if (staffAlreadyNotified.length === 0) {
            await dbQuery(
              "INSERT INTO notification (userID, title, message) VALUES (?, 'Upcoming Check-out Reminder', ?)",
              [sID, staffMsg]
            );
          }
        }
        
        // 3. Checked In bookings overdue past 12:00 PM check-out threshold (Late Check-out Fee Alerts)
        const overdueBookings = await dbQuery(`
          SELECT b.bookingID, b.guestID, g.userID, g.firstName, g.lastName, b.checkOutDateTime, rm.roomNumber, rt.rate as roomRate
          FROM booking b
          JOIN guest g ON g.guestID = b.guestID
          JOIN room rm ON rm.roomID = b.roomID
          JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
          WHERE b.status = 'Checked In'
            AND NOW() > b.checkOutDateTime
        `);

        for (const b of overdueBookings) {
          const checkOutDt = new Date(String(b.checkOutDateTime).replace(' ', 'T'));
          const standardCheckOut = new Date(checkOutDt);
          standardCheckOut.setHours(12, 0, 0, 0);

          const now = new Date();
          if (now > standardCheckOut) {
            const lateHours = Math.max(1, Math.ceil((now - standardCheckOut) / (1000 * 60 * 60)));
            const isFullNight = lateHours > 22;
            const lateFee = isFullNight ? parseFloat(b.roomRate || 0) : lateHours * 100;
            const feeDetailStr = isFullNight ? `1 full night room price (exceeded 22 hrs)` : `${lateHours} hr/s @ ₱100/hr`;

            const guestLateMsg = `⏰ Late Check-Out Alert: A late check-out fee of ₱${lateFee.toFixed(2)} (${feeDetailStr}) has been added to your stay billing for Room ${b.roomNumber}.`;
            const staffLateMsg = `⏰ Late Check-Out Alert: Guest ${b.firstName} ${b.lastName} (Room ${b.roomNumber}) has incurred a late check-out fee of ₱${lateFee.toFixed(2)} (${feeDetailStr}).`;

            if (b.userID) {
              const alreadyNotified = await dbQuery(
                "SELECT notificationID FROM notification WHERE userID = ? AND message = ?",
                [b.userID, guestLateMsg]
              );
              if (alreadyNotified.length === 0) {
                await dbQuery(
                  "INSERT INTO notification (userID, title, message) VALUES (?, 'Late Check-Out Fee Incurred', ?)",
                  [b.userID, guestLateMsg]
                );
              }
            }

            for (const sID of staffUserIDs) {
              const staffAlreadyNotified = await dbQuery(
                "SELECT notificationID FROM notification WHERE userID = ? AND message = ?",
                [sID, staffLateMsg]
              );
              if (staffAlreadyNotified.length === 0) {
                await dbQuery(
                  "INSERT INTO notification (userID, title, message) VALUES (?, 'Late Check-Out Fee Alert', ?)",
                  [sID, staffLateMsg]
                );
              }
            }
          }
        }
      }
    } catch (reminderError) {
      console.error("Auto reminder generation error:", reminderError);
    }

    // Fetch latest 10 notifications
    const notifications = await dbQuery(
      "SELECT * FROM notification WHERE userID = ? ORDER BY createdAt DESC LIMIT 10",
      [userID]
    );

    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
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
