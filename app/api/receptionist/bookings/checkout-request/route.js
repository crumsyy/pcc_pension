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

    if (!bookingID) {
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
    if (currentStatus !== 'Checked In' && currentStatus !== 'Active Stay') {
      return NextResponse.json({
        error: `Cannot request checkout from status '${currentStatus}'. Only active stays can request checkout.`
      }, { status: 400 });
    }

    await ensureBookingBillingSchema();

    await dbQuery(
      "UPDATE booking SET status = 'Pending Room Verification', checkoutRequestedAt = NOW() WHERE bookingID = ?",
      [bookingID]
    );

    // Notify receptionists & administrators
    try {
      const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
      for (const r of staffToNotify) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Guest Checkout Requested', ?)",
          [
            r.userID,
            `Guest ${booking.firstName} ${booking.lastName} in Room ${booking.roomNumber} (Booking #${bookingID}) has requested checkout. Room inspection and incidental fee verification required.`
          ]
        );
      }

      // Notify guest
      if (booking.userID) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Checkout Requested — Inspection in Progress', ?)",
          [
            booking.userID,
            `Your checkout request for Room ${booking.roomNumber} has been received. Our staff will inspect your room and update your final billing statement shortly.`
          ]
        );
      }
    } catch (notifErr) {
      console.error("Failed to send checkout notification:", notifErr);
    }

    return NextResponse.json({
      success: true,
      bookingStatus: 'Pending Room Verification',
      message: 'Checkout request submitted. Front desk has been notified to verify your room condition.'
    });
  } catch (error) {
    console.error("Checkout request error:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
