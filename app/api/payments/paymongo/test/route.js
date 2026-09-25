import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDbConnection, dbQuery, ensurePaymentSchema, logBillingAudit, getBookingBalance } from '@/lib/db';

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    await ensurePaymentSchema();
    const body = await request.json();

    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required.' }, { status: 400 });
    }

    const bookingID = body.bookingID ? parseInt(body.bookingID) : null;
    let guestID = body.guestID ? parseInt(body.guestID) : null;
    const paymentMethodID = parseInt(body.paymentMethodID || 2); // Default to 2 (GCash/Online)
    const referenceNumber = (body.referenceNumber && String(body.referenceNumber).trim()) || `PM-AUTH-${Date.now().toString().slice(-8)}`;
    const transactionType = body.transactionType || 'PayMongo Test Payment';

    let billingID = body.billingID ? parseInt(body.billingID) : null;
    let staffID = null;

    if (session.role === 'Receptionist' || session.role === 'Administrator') {
      const staffRows = await dbQuery("SELECT staffID FROM staff WHERE userID = ?", [session.userID]);
      if (staffRows && staffRows.length > 0) {
        staffID = staffRows[0].staffID;
      }
    } else if (session.role === 'Guest' && !guestID) {
      const guestRows = await dbQuery("SELECT guestID FROM guest WHERE userID = ?", [session.userID]);
      if (guestRows && guestRows.length > 0) {
        guestID = guestRows[0].guestID;
      }
    }

    let balanceBefore = 0;
    if (bookingID) {
      const bookingRows = await dbQuery("SELECT bookingID, guestID, status FROM booking WHERE bookingID = ?", [bookingID]);
      if (bookingRows && bookingRows.length > 0) {
        if (!guestID) guestID = bookingRows[0].guestID;
        balanceBefore = await getBookingBalance(bookingID);

        if (!billingID) {
          const billingRows = await dbQuery("SELECT billingID FROM billing WHERE bookingID = ? ORDER BY billingID DESC LIMIT 1", [bookingID]);
          if (billingRows && billingRows.length > 0) {
            billingID = billingRows[0].billingID;
          }
        }
      }
    }

    const manilaParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(new Date());
    const getPart = (type) => manilaParts.find(p => p.type === type)?.value || '00';
    const nowStr = `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;

    const pool = await getDbConnection();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // If no existing billing record exists for the booking, create one
      if (bookingID && !billingID) {
        const [billRes] = await conn.execute(
          "INSERT INTO billing (billingDateTime, guestID, bookingID, orderID) VALUES (?, ?, ?, NULL)",
          [nowStr, guestID, bookingID]
        );
        billingID = billRes.insertId;
      }

      // Record payment with status = 'Settled' and testMode = 1
      const [payRes] = await conn.execute(
        `INSERT INTO payment (amount, cashReceived, \`change\`, billingID, guestID, staffID, paymentMethodID, discountID, promotionID, testMode, status, referenceNumber)
         VALUES (?, ?, 0, ?, ?, ?, ?, NULL, NULL, 1, 'Settled', ?)`,
        [amount, amount, billingID, guestID, staffID, paymentMethodID, referenceNumber]
      );
      const paymentID = payRes.insertId;

      // Insert transaction entry
      await conn.execute(
        "INSERT INTO transactions (transactionDateTime, billingID, paymentID, testMode) VALUES (?, ?, ?, 1)",
        [nowStr, billingID, paymentID]
      );

      // Calculate balance after
      const balanceAfter = bookingID ? Math.max(0, balanceBefore - amount) : 0;
      if (bookingID && balanceAfter <= 0.05) {
        await conn.execute("UPDATE payment SET isFullyPaid = 1 WHERE paymentID = ?", [paymentID]);
        await conn.execute("UPDATE booking SET status = 'Payment Completed', paymentCompletedAt = NOW() WHERE bookingID = ?", [bookingID]);
      }

      // Log to billing_audit
      await logBillingAudit(conn, {
        billingID: billingID || 0,
        bookingID: bookingID || 0,
        transactionType,
        status: 'Settled',
        amount,
        balanceBefore,
        balanceAfter,
        userID: session.userID || null,
        userName: session.fullName || session.userName || 'Authorized User',
        userRole: session.role || 'System',
        description: `PayMongo Test Mode Payment authorization verified & settled (Ref: ${referenceNumber})`,
        referenceNumber
      });

      await conn.commit();

      return NextResponse.json({
        success: true,
        paymentID,
        billingID,
        bookingID,
        referenceNumber,
        amount,
        status: 'Settled',
        balanceBefore,
        balanceAfter,
        authorizationCode: `AUTH-${referenceNumber}`,
        timestamp: nowStr,
        message: 'PayMongo test mode payment authorized and settled successfully.'
      });
    } catch (txnError) {
      await conn.rollback();
      throw txnError;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("Error processing PayMongo test mode payment:", err);
    return NextResponse.json({ error: err.message || 'Failed to authorize test payment.' }, { status: 500 });
  }
}
