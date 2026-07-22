import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, getBookingBalance } from '@/lib/db';

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { bookingID, paymentPercentage, referenceNumber, amountToPay } = body;

    const parsedBookingID = parseInt(bookingID);
    const parsedAmount = parseFloat(amountToPay);

    if (!parsedBookingID || isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Valid Booking ID and amount are required.' }, { status: 400 });
    }

    if (!referenceNumber || !referenceNumber.trim()) {
      return NextResponse.json({ error: 'GCash Reference Number is required.' }, { status: 400 });
    }

    const guests = await dbQuery("SELECT guestID, firstName, lastName FROM guest WHERE userID = ?", [session.userID]);
    if (guests.length === 0) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }
    const guest = guests[0];

    // Find billing record for this booking
    let billingRes = await dbQuery("SELECT billingID FROM billing WHERE bookingID = ?", [parsedBookingID]);
    let billingID;
    if (billingRes.length === 0) {
      const insBilling = await dbQuery("INSERT INTO billing (billingDate, status, bookingID) VALUES (NOW(), 'Unpaid', ?)", [parsedBookingID]);
      billingID = insBilling.insertId;
    } else {
      billingID = billingRes[0].billingID;
    }

    // Get GCash payment method ID (usually ID 2 for Online/GCash)
    const pmRes = await dbQuery("SELECT paymentMethodID FROM payment_method WHERE LOWER(paymentMethod) LIKE '%gcash%' OR LOWER(paymentMethod) LIKE '%online%' LIMIT 1");
    const paymentMethodID = pmRes[0]?.paymentMethodID || 2;

    const localNow = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

    // Record payment
    const paymentInsert = await dbQuery(
      `INSERT INTO payment (amount, paymentDate, isFullyPaid, billingID, paymentMethodID)
       VALUES (?, ?, 0, ?, ?)`,
      [parsedAmount, nowStr, billingID, paymentMethodID]
    );

    const remainingBalance = await getBookingBalance(parsedBookingID);

    // Update billing status
    if (remainingBalance <= 0) {
      await dbQuery("UPDATE billing SET status = 'Paid' WHERE billingID = ?", [billingID]);
      await dbQuery("UPDATE payment SET isFullyPaid = 1 WHERE paymentID = ?", [paymentInsert.insertId]);
    } else {
      await dbQuery("UPDATE billing SET status = 'Partial' WHERE billingID = ?", [billingID]);
    }

    // Notify guest
    await dbQuery(
      "INSERT INTO notification (userID, title, message) VALUES (?, 'GCash Payment Received', ?)",
      [session.userID, `GCash payment of ₱${parsedAmount.toFixed(2)} for Booking #${parsedBookingID} recorded. Ref #${referenceNumber.trim()}.`]
    );

    // Notify active receptionists
    const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
    for (const r of staffToNotify) {
      await dbQuery(
        "INSERT INTO notification (userID, title, message) VALUES (?, 'New GCash Online Payment', ?)",
        [r.userID, `GCash payment of ₱${parsedAmount.toFixed(2)} received from ${guest.firstName} ${guest.lastName} (Ref #${referenceNumber.trim()}).`]
      );
    }

    // Return receipt payload for printing / downloading
    return NextResponse.json({
      success: true,
      message: 'GCash payment recorded and verified successfully!',
      receipt: {
        paymentID: paymentInsert.insertId,
        bookingID: parsedBookingID,
        guestName: `${guest.firstName} ${guest.lastName}`,
        paymentMethod: 'GCash Online',
        referenceNumber: referenceNumber.trim(),
        paymentPercentage: paymentPercentage || (remainingBalance <= 0 ? '100%' : 'Downpayment'),
        amountPaid: parsedAmount,
        remainingBalance: Math.max(0, remainingBalance),
        timestamp: nowStr
      }
    });
  } catch (error) {
    console.error("Failed to process guest GCash payment:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
