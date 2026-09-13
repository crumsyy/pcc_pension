import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, normalizeBookingStatus, getBookingBalance } from '@/lib/db';

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const bookingID = parseInt(body.bookingID);

    if (!bookingID || isNaN(bookingID)) {
      return NextResponse.json({ error: 'Valid Booking ID is required.' }, { status: 400 });
    }

    const guests = await dbQuery("SELECT guestID FROM guest WHERE userID = ?", [session.userID]);
    if (guests.length === 0) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }
    const guestID = guests[0].guestID;

    const [booking] = await dbQuery(
      "SELECT bookingID, status, guestID, roomID FROM booking WHERE bookingID = ? AND guestID = ?",
      [bookingID, guestID]
    );

    if (!booking) {
      return NextResponse.json({ error: 'Booking record not found or access denied.' }, { status: 404 });
    }

    const normalizedStatus = normalizeBookingStatus(booking.status);
    if (normalizedStatus !== 'Bill Ready') {
      return NextResponse.json(
        { error: "Payment is only allowed once the bill is ready." },
        { status: 400 }
      );
    }

    const remainingBalance = await getBookingBalance(bookingID);

    return NextResponse.json({
      success: true,
      bookingID,
      bookingStatus: 'Bill Ready',
      remainingBalance,
      message: 'Booking status verified as Bill Ready.'
    });
  } catch (error) {
    console.error("Guest payment endpoint error:", error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
