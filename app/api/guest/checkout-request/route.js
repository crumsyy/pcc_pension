import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, ensureBookingBillingSchema } from '@/lib/db';

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const bookingID = parseInt(body.bookingID);

    if (!bookingID || isNaN(bookingID)) {
      return NextResponse.json({ error: 'Valid Booking ID is required.' }, { status: 400 });
    }

    let guestCondition = '';
    const params = [bookingID];

    if (session.role === 'Guest') {
      const guests = await dbQuery("SELECT guestID, firstName, lastName FROM guest WHERE userID = ?", [session.userID]);
      if (guests.length === 0) {
        return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
      }
      guestCondition = ' AND b.guestID = ?';
      params.push(guests[0].guestID);
    }

    await ensureBookingBillingSchema();

    const [booking] = await dbQuery(
      `SELECT b.bookingID, b.status, b.roomID, b.guestID, rm.roomNumber, g.firstName, g.lastName, g.userID
       FROM booking b
       JOIN room rm ON rm.roomID = b.roomID
       JOIN guest g ON g.guestID = b.guestID
       WHERE b.bookingID = ? ${guestCondition}`,
      params
    );

    if (!booking) {
      return NextResponse.json({ error: 'Booking record not found or access denied.' }, { status: 404 });
    }

    const currentStatus = booking.status;
    const eligibleStatuses = ['Active Stay', 'Checked In', 'Pending Room Verification', 'Pending Checkout'];
    if (!eligibleStatuses.includes(currentStatus)) {
      if (currentStatus === 'Checkout Requested') {
        return NextResponse.json({
          success: true,
          bookingStatus: 'Checkout Requested',
          message: 'Checkout request is already pending. Receptionist will finalize your bill.'
        });
      }
      return NextResponse.json({
        error: `Cannot request checkout for booking with status '${currentStatus}'.`
      }, { status: 400 });
    }

    // Atomically update status to 'Checkout Requested'
    await dbQuery(
      "UPDATE booking SET status = 'Checkout Requested', checkoutRequestedAt = NOW() WHERE bookingID = ?",
      [bookingID]
    );

    // Notify front desk staff (Admin does not receive checkout requests)
    try {
      const staffList = await dbQuery("SELECT userID FROM user WHERE roleID = 2 AND status = 'Active'");
      for (const s of staffList) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Checkout Requested', ?)",
          [
            s.userID,
            `Guest ${booking.firstName} ${booking.lastName} (Room ${booking.roomNumber}, Booking #${bookingID}) has requested checkout. Please review charges and finalize the bill.`
          ]
        );
      }

      // Notify guest
      if (booking.userID) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Checkout Request Sent', ?)",
          [
            booking.userID,
            `Checkout request sent for Room ${booking.roomNumber}. The receptionist has been notified and will finalize your bill shortly.`
          ]
        );
      }
    } catch (notifErr) {
      console.error('Failed to dispatch checkout notifications:', notifErr);
    }

    return NextResponse.json({
      success: true,
      bookingStatus: 'Checkout Requested',
      message: 'Checkout request sent. Receptionist will finalize your bill.'
    });
  } catch (error) {
    console.error('Checkout request API error:', error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
