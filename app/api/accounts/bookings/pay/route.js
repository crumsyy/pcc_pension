import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, normalizeBookingStatus, getBookingBalance } from '@/lib/db';

export async function POST(request) {
  const session = await getSession();
  if (!session || !['Administrator', 'Receptionist', 'Staff'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const bookingID = parseInt(body.bookingID, 10);

    if (!bookingID || isNaN(bookingID)) {
      return NextResponse.json({ error: 'Valid Booking ID is required.' }, { status: 400 });
    }

    const [booking] = await dbQuery(
      "SELECT bookingID, status, finalBalance, remainingBalance FROM booking WHERE bookingID = ?",
      [bookingID]
    );

    if (!booking) {
      return NextResponse.json({ error: 'Booking record not found.' }, { status: 404 });
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
      message: 'Payment authorized: Booking verified as Bill Ready.'
    });
  } catch (error) {
    console.error("Accounts payment endpoint error:", error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
