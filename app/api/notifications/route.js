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
