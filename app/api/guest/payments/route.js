import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, getBookingBalance, logBillingAudit, ensurePaymentSchema } from '@/lib/db';

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (body.action === 'test_failed') {
      return NextResponse.json({
        success: false,
        error: 'Payment authorization declined by user in PayMongo test mode.'
      }, { status: 400 });
    }

    const isTestAuth = body.action === 'test_authenticate';
    const parsedBookingID = parseInt(body.bookingID);
    let parsedAmount = Math.round(parseFloat(body.amountToPay || body.amount || 0) * 100) / 100;

    if (isTestAuth && (isNaN(parsedAmount) || parsedAmount <= 0) && parsedBookingID) {
      parsedAmount = await getBookingBalance(parsedBookingID);
    }

    if (!parsedBookingID || isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Valid Booking ID and amount are required.' }, { status: 400 });
    }

    const cleanRef = (body.referenceNumber && String(body.referenceNumber).trim()) || (isTestAuth ? `PM-AUTH-${Date.now().toString().slice(-8)}` : '');
    if (!cleanRef) {
      return NextResponse.json({ error: 'Payment Reference Number is required.' }, { status: 400 });
    }

    const { paymentPercentage } = body;

    const guests = await dbQuery("SELECT guestID, firstName, lastName FROM guest WHERE userID = ?", [session.userID]);
    if (guests.length === 0) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }
    const guest = guests[0];

    const pool = await getDbConnection();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Row-level lock on booking
      const [bookingRows] = await connection.execute(
        "SELECT bookingID, status, guestID FROM booking WHERE bookingID = ? AND guestID = ? FOR UPDATE",
        [parsedBookingID, guest.guestID]
      );

      if (bookingRows.length === 0) {
        await connection.rollback();
        return NextResponse.json({ error: 'Booking record not found or access denied.' }, { status: 404 });
      }

      // Prevent duplicate charging by checking reference number in recent payments
      const [existingPayment] = await connection.execute(
        "SELECT paymentID FROM payment WHERE billingID IN (SELECT billingID FROM billing WHERE bookingID = ?) AND paymentDate >= DATE_SUB(NOW(), INTERVAL 5 MINUTE) AND amount = ?",
        [parsedBookingID, parsedAmount]
      );
      // Also check transactions or billing_audit for referenceNumber duplication
      const [existingRef] = await connection.execute(
        "SELECT auditID FROM billing_audit WHERE referenceNumber = ? LIMIT 1",
        [cleanRef]
      );
      if (existingRef.length > 0) {
        await connection.rollback();
        return NextResponse.json({
          error: `Payment with Reference #${cleanRef} has already been recorded.`
        }, { status: 400 });
      }

      // Find or create billing record with lock
      const [billingRows] = await connection.execute(
        "SELECT billingID FROM billing WHERE bookingID = ? FOR UPDATE",
        [parsedBookingID]
      );

      let billingID;
      if (billingRows.length === 0) {
        const [insBilling] = await connection.execute(
          "INSERT INTO billing (billingDate, status, bookingID) VALUES (NOW(), 'Unpaid', ?)",
          [parsedBookingID]
        );
        billingID = insBilling.insertId;
      } else {
        billingID = billingRows[0].billingID;
      }

      const balanceBefore = await getBookingBalance(parsedBookingID);

      // Get GCash payment method ID
      const [pmRows] = await connection.execute(
        "SELECT paymentMethodID FROM payment_method WHERE LOWER(paymentMethod) LIKE '%gcash%' OR LOWER(paymentMethod) LIKE '%online%' LIMIT 1"
      );
      const paymentMethodID = pmRows[0]?.paymentMethodID || 2;

      const localNow = new Date();
      const pad = (num) => String(num).padStart(2, '0');
      const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

      await ensurePaymentSchema();

      // Insert payment record
      const [paymentInsert] = await connection.execute(
        `INSERT INTO payment (amount, cashReceived, \`change\`, paymentDate, isFullyPaid, billingID, guestID, paymentMethodID, testMode, status, referenceNumber)
         VALUES (?, ?, 0, ?, 0, ?, ?, ?, 1, 'Settled', ?)`,
        [parsedAmount, parsedAmount, nowStr, billingID, guest.guestID, paymentMethodID, cleanRef]
      );
      const paymentID = paymentInsert.insertId;

      // Insert transaction record
      await connection.execute(
        "INSERT INTO transactions (transactionDateTime, billingID, paymentID, testMode) VALUES (?, ?, ?, 1)",
        [nowStr, billingID, paymentID]
      );

      const balanceAfter = Math.max(0, Math.round((balanceBefore - parsedAmount) * 100) / 100);

      // Determine transaction type
      let txType = 'Subsequent Payment';
      if (paymentPercentage?.includes('30')) txType = 'Down Payment (30%)';
      else if (paymentPercentage?.includes('50')) txType = 'Down Payment (50%)';
      else if (paymentPercentage?.includes('100')) txType = 'Down Payment (100%)';
      else if (balanceAfter <= 0.05) txType = 'Checkout Settlement';

      // Update billing status
      if (balanceAfter <= 0.05) {
        await connection.execute("UPDATE billing SET status = 'Paid' WHERE billingID = ?", [billingID]);
        await connection.execute("UPDATE payment SET isFullyPaid = 1 WHERE paymentID = ?", [paymentID]);
        await connection.execute("UPDATE booking SET status = 'Payment Completed', paymentCompletedAt = NOW() WHERE bookingID = ?", [parsedBookingID]);
      } else {
        await connection.execute("UPDATE billing SET status = 'Partial' WHERE billingID = ?", [billingID]);
      }

      // Log into billing_audit
      await logBillingAudit(connection, {
        billingID,
        bookingID: parsedBookingID,
        transactionType: txType,
        status: 'Settled',
        amount: parsedAmount,
        balanceBefore,
        balanceAfter,
        userID: session.userID,
        userName: `${guest.firstName} ${guest.lastName}`,
        userRole: 'Guest',
        description: `GCash Online Payment (Ref #${cleanRef})`,
        referenceNumber: cleanRef
      });

      await connection.commit();

      // Notifications
      try {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'GCash Payment Received', ?)",
          [session.userID, `GCash payment of ₱${parsedAmount.toFixed(2)} for Booking #${parsedBookingID} recorded. Ref #${cleanRef}.`]
        );

        const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
        for (const r of staffToNotify) {
          await dbQuery(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'New GCash Online Payment', ?)",
            [r.userID, `GCash payment of ₱${parsedAmount.toFixed(2)} received from ${guest.firstName} ${guest.lastName} for Booking #${parsedBookingID} (Ref #${cleanRef}).`]
          );
        }
      } catch (notifErr) {}

      return NextResponse.json({
        success: true,
        message: 'GCash payment recorded and verified successfully!',
        receipt: {
          paymentID,
          bookingID: parsedBookingID,
          guestName: `${guest.firstName} ${guest.lastName}`,
          paymentMethod: 'GCash Online',
          referenceNumber: cleanRef,
          paymentPercentage: paymentPercentage || (balanceAfter <= 0 ? '100%' : 'Partial'),
          amountPaid: parsedAmount,
          remainingBalance: balanceAfter,
          timestamp: nowStr
        }
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Failed to process guest GCash payment:", error);
    return NextResponse.json({ error: 'Payment processing error: ' + error.message }, { status: 500 });
  }
}
