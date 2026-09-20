import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getBookingBalanceDetails, normalizeBookingStatus } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || !['Guest', 'Receptionist', 'Administrator'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bookingID = parseInt(searchParams.get('bookingID'), 10);

  if (!bookingID || isNaN(bookingID)) {
    return NextResponse.json({ error: 'Valid bookingID is required.' }, { status: 400 });
  }

  try {
    const bookingRows = await dbQuery(`
      SELECT b.bookingID, b.status, b.guestID, b.roomID, b.roomRate,
             b.downPaymentAmount, b.downPaymentPercentage, b.remainingBalance,
             rm.roomNumber, rt.type as roomType,
             g.firstName, g.lastName, g.email, g.contact
      FROM booking b
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      JOIN guest g ON g.guestID = b.guestID
      WHERE b.bookingID = ?
      LIMIT 1
    `, [bookingID]);

    if (bookingRows.length === 0) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    const booking = bookingRows[0];

    // Authorization: If guest, verify ownership
    if (session.role === 'Guest') {
      const guestRows = await dbQuery("SELECT guestID FROM guest WHERE userID = ?", [session.userID]);
      if (guestRows.length === 0 || guestRows[0].guestID !== booking.guestID) {
        return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
      }
    }

    // Fetch dynamic balance details and latest payment
    const balanceDetails = await getBookingBalanceDetails(bookingID).catch(() => null);
    const payments = await dbQuery(`
      SELECT p.paymentID, p.amount, p.referenceNumber, p.paymentDate,
             pm.paymentMethod
      FROM payment p
      JOIN payment_method pm ON pm.paymentMethodID = p.paymentMethodID
      WHERE p.billingID = (SELECT billingID FROM billing WHERE bookingID = ? LIMIT 1)
         OR p.referenceNumber IN (
            SELECT referenceNumber FROM billing_audit WHERE bookingID = ? AND referenceNumber IS NOT NULL
         )
      ORDER BY p.paymentID DESC
      LIMIT 1
    `, [bookingID, bookingID]);

    const latestPayment = payments.length > 0 ? payments[0] : null;
    const normalized = normalizeBookingStatus(booking.status);
    const remBalance = balanceDetails ? parseFloat(balanceDetails.balance || 0) : parseFloat(booking.remainingBalance || 0);

    const isConfirmed = normalized === 'Confirmed' ||
                        booking.status === 'Confirmed' ||
                        booking.status === 'Pending Check-in' ||
                        (latestPayment !== null && remBalance >= 0);

    let receiptData = null;
    if (latestPayment || isConfirmed) {
      const amtPaid = latestPayment ? parseFloat(latestPayment.amount) : parseFloat(booking.downPaymentAmount || balanceDetails?.paidTotal || 0);
      receiptData = {
        receiptNumber: latestPayment ? `REC-${latestPayment.paymentID}` : `REC-${booking.bookingID}`,
        paymentID: latestPayment ? latestPayment.paymentID : booking.bookingID,
        bookingID: booking.bookingID,
        guestName: `${booking.firstName || ''} ${booking.lastName || ''}`.trim() || 'Valued Guest',
        roomNumber: booking.roomNumber,
        roomType: booking.roomType,
        paymentMethod: latestPayment?.paymentMethod || 'GCash (PayMongo)',
        referenceNumber: latestPayment?.referenceNumber || 'PM-SETTLED',
        paymentPercentage: remBalance <= 0 ? '100% Final Settlement' : `${booking.downPaymentPercentage || 50}% Down Payment`,
        amountPaid: amtPaid,
        remainingBalance: remBalance,
        timestamp: latestPayment?.paymentDate || new Date().toISOString()
      };
    }

    return NextResponse.json({
      success: true,
      bookingID: booking.bookingID,
      status: booking.status,
      normalizedStatus: normalized,
      isConfirmed,
      remainingBalance: remBalance,
      latestPayment,
      receipt: receiptData
    });
  } catch (error) {
    console.error("Error polling booking status:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
