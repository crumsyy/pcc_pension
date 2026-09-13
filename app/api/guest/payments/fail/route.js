import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, ensureBookingBillingSchema } from '@/lib/db';

export async function POST(request) {
  const session = await getSession();
  if (!session || !['Guest', 'Receptionist', 'Administrator'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const bookingID = parseInt(body.bookingID, 10);
    if (!bookingID || isNaN(bookingID)) {
      return NextResponse.json({ error: 'Valid bookingID is required.' }, { status: 400 });
    }

    await ensureBookingBillingSchema();

    // Check ownership if session is Guest
    if (session.role === 'Guest') {
      const guestRows = await dbQuery("SELECT guestID FROM guest WHERE userID = ?", [session.userID]);
      if (guestRows.length === 0) {
        return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
      }
      const bookingRows = await dbQuery("SELECT guestID FROM booking WHERE bookingID = ?", [bookingID]);
      if (bookingRows.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }
      if (bookingRows[0].guestID !== guestRows[0].guestID) {
        return NextResponse.json({ error: 'Unauthorized access to this booking.' }, { status: 403 });
      }
    }

    // Update booking status to Payment Declined
    await dbQuery("UPDATE booking SET status = 'Payment Declined' WHERE bookingID = ?", [bookingID]);

    return NextResponse.json({
      success: false,
      status: 'Declined',
      message: 'Payment Declined, Try Again'
    });
  } catch (error) {
    console.error("Fail payment error:", error);
    return NextResponse.json({ error: 'Failed to process payment failure: ' + error.message }, { status: 500 });
  }
}
