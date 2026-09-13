import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  getDbConnection,
  dbQuery,
  getBookingBalance,
  ensurePaymentSchema,
  ensureBookingBillingSchema,
  logBillingAudit
} from '@/lib/db';

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

    let currentGuestID = null;
    let guestName = session.fullName || 'Guest';

    if (session.role === 'Guest') {
      const guestRows = await dbQuery("SELECT guestID, firstName, lastName FROM guest WHERE userID = ?", [session.userID]);
      if (guestRows.length === 0) {
        return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
      }
      currentGuestID = guestRows[0].guestID;
      guestName = `${guestRows[0].firstName} ${guestRows[0].lastName}`.trim();
    }

    const pool = await getDbConnection();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      await ensurePaymentSchema();
      await ensureBookingBillingSchema();

      // Retrieve booking with lock
      const [bookingRows] = await conn.execute(
        `SELECT b.bookingID, b.guestID, b.roomID, b.status, b.remainingBalance, b.finalBalance,
                r.roomNumber, r.roomType,
                g.firstName, g.lastName, g.email, g.contact
         FROM booking b
         LEFT JOIN room r ON r.roomID = b.roomID
         LEFT JOIN guest g ON g.guestID = b.guestID
         WHERE b.bookingID = ? FOR UPDATE`,
        [bookingID]
      );

      if (bookingRows.length === 0) {
        await conn.rollback();
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }

      const booking = bookingRows[0];

      // Validate ownership
      if (session.role === 'Guest' && currentGuestID && booking.guestID !== currentGuestID) {
        await conn.rollback();
        return NextResponse.json({ error: 'Unauthorized access to this booking.' }, { status: 403 });
      }

      const assignedGuestID = booking.guestID || currentGuestID;
      if (booking.firstName) {
        guestName = `${booking.firstName} ${booking.lastName || ''}`.trim();
      }

      // Calculate amount to authorize/settle
      const balanceBefore = await getBookingBalance(bookingID);
      const amountToSettle = Math.max(0, parseFloat(body.amount) || balanceBefore || parseFloat(booking.remainingBalance) || 0);

      // Clean reference number
      const refNumber = (body.referenceNumber && String(body.referenceNumber).trim()) || `PM-AUTH-${Date.now().toString().slice(-8)}`;

      // Locate or create billing record
      const [billingRows] = await conn.execute(
        "SELECT billingID FROM billing WHERE bookingID = ? ORDER BY billingID DESC LIMIT 1 FOR UPDATE",
        [bookingID]
      );

      let billingID;
      if (billingRows.length === 0) {
        const [billRes] = await conn.execute(
          "INSERT INTO billing (billingDateTime, billingDate, guestID, bookingID, status, balance, remainingBalance, totalAmount) VALUES (NOW(), NOW(), ?, ?, 'Paid', 0.00, 0.00, ?)",
          [assignedGuestID, bookingID, amountToSettle]
        );
        billingID = billRes.insertId;
      } else {
        billingID = billingRows[0].billingID;
      }

      const localNow = new Date();
      const pad = (num) => String(num).padStart(2, '0');
      const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

      // Insert payment record
      const [paymentInsert] = await conn.execute(
        `INSERT INTO payment (amount, cashReceived, \`change\`, paymentDate, isFullyPaid, billingID, guestID, paymentMethodID, testMode, status, referenceNumber)
         VALUES (?, ?, 0, ?, 1, ?, ?, 2, 1, 'Settled', ?)`,
        [amountToSettle, amountToSettle, nowStr, billingID, assignedGuestID, refNumber]
      );
      const paymentID = paymentInsert.insertId;

      // Insert transaction entry
      await conn.execute(
        "INSERT INTO transactions (transactionDateTime, billingID, paymentID, testMode) VALUES (?, ?, ?, 1)",
        [nowStr, billingID, paymentID]
      );

      // Update booking and billing to Paid with 0 remaining balance
      await conn.execute(
        "UPDATE booking SET status = 'Paid', paymentCompletedAt = NOW(), remainingBalance = 0.00, finalBalance = 0.00 WHERE bookingID = ?",
        [bookingID]
      );

      await conn.execute(
        "UPDATE billing SET status = 'Paid', remainingBalance = 0.00, balance = 0.00 WHERE billingID = ?",
        [billingID]
      );

      // Log to audit
      await logBillingAudit(conn, {
        billingID,
        bookingID,
        transactionType: 'PayMongo GCash Payment Authorization',
        status: 'Settled',
        amount: amountToSettle,
        balanceBefore,
        balanceAfter: 0,
        userID: session.userID,
        userName: guestName,
        userRole: session.role,
        description: `PayMongo Test Mode Payment Authorized (Ref: ${refNumber})`,
        referenceNumber: refNumber
      });

      await conn.commit();

      const receipt = {
        receiptNumber: `REC-${paymentID}-${Date.now().toString().slice(-4)}`,
        paymentID,
        bookingID,
        guestName,
        roomNumber: booking.roomNumber || 'N/A',
        roomType: booking.roomType || 'Standard',
        amountPaid: amountToSettle,
        remainingBalance: 0,
        paymentMethod: 'GCash (PayMongo Test Mode)',
        referenceNumber: refNumber,
        status: 'Paid',
        timestamp: nowStr
      };

      return NextResponse.json({
        success: true,
        status: 'Paid',
        message: 'Payment Completed',
        receipt
      });
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Authorize payment error:", error);
    return NextResponse.json({ error: 'Failed to authorize payment: ' + error.message }, { status: 500 });
  }
}
