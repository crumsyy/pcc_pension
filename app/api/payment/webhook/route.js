import { NextResponse } from 'next/server';
import { getDbConnection, getBookingBalanceDetails, syncNormalizedBillingLineItems, ensureBookingBillingSchema, ensurePaymentSchema, logBillingAudit } from '@/lib/db';
import { verifyPayMongoSignature, getPayMongoAuthHeader } from '@/lib/paymongo';

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('paymongo-signature') || '';

    // 1. Webhook Signature Verification
    const isValidSignature = verifyPayMongoSignature(rawBody, signatureHeader);
    if (!isValidSignature) {
      console.warn("PayMongo Webhook: Invalid signature rejected.");
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const event = payload?.data;
    if (!event) {
      return NextResponse.json({ error: 'Missing event data.' }, { status: 400 });
    }

    const eventType = event.attributes?.type;
    const eventData = event.attributes?.data;

    console.log(`[PayMongo Webhook] Event received: ${eventType} | ID: ${eventData?.id}`);

    await ensureBookingBillingSchema();
    await ensurePaymentSchema();

    let paymentID = null;
    let externalRef = null;
    let amountInPesos = 0;
    let targetBookingID = null;
    let sourceID = null;

    // Handle source.chargeable: GCash Payment Authorized by Guest
    if (eventType === 'source.chargeable' && eventData) {
      sourceID = eventData.id;
      const amountInCentavos = eventData.attributes?.amount || 0;
      amountInPesos = amountInCentavos / 100;

      // Find bookingID mapped to this source in billing_audit
      const db = await getDbConnection();
      const [auditRows] = await db.execute(
        "SELECT bookingID FROM billing_audit WHERE referenceNumber = ? ORDER BY auditID DESC LIMIT 1",
        [sourceID]
      );
      if (auditRows.length > 0) {
        targetBookingID = auditRows[0].bookingID;
      }

      // Charge the source via PayMongo Payments API
      const authHeader = getPayMongoAuthHeader();
      const chargeRes = await fetch('https://api.paymongo.com/v1/payments', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          data: {
            attributes: {
              amount: amountInCentavos,
              currency: 'PHP',
              source: {
                id: sourceID,
                type: 'source'
              },
              description: `Booking #BK${targetBookingID || ''} GCash Payment (${sourceID})`,
              metadata: {
                bookingID: targetBookingID ? String(targetBookingID) : '',
                sourceID: sourceID
              }
            }
          }
        })
      });

      const chargeData = await chargeRes.json();
      if (!chargeRes.ok || !chargeData.data) {
        console.error("PayMongo Charge Source Error:", chargeData);
        return NextResponse.json({ error: 'Failed to charge PayMongo source.' }, { status: 500 });
      }

      paymentID = chargeData.data.id;
      externalRef = paymentID;
    }

    // Handle payment.paid: Payment successfully captured
    if (eventType === 'payment.paid' && eventData) {
      paymentID = eventData.id;
      externalRef = paymentID;
      const amountInCentavos = eventData.attributes?.amount || 0;
      amountInPesos = amountInCentavos / 100;
      const description = eventData.attributes?.description || '';
      const metadata = eventData.attributes?.metadata || {};

      // Resolve bookingID from metadata, description, or source ID lookup
      if (metadata.bookingID) {
        targetBookingID = parseInt(metadata.bookingID, 10);
      } else {
        const match = description.match(/BK(\d+)/i) || description.match(/Booking #(\d+)/i);
        if (match) {
          targetBookingID = parseInt(match[1], 10);
        }
      }

      // If still not resolved, try resolving via source in billing_audit
      const srcId = eventData.attributes?.source?.id;
      if (!targetBookingID && srcId) {
        sourceID = srcId;
        const db = await getDbConnection();
        const [auditRows] = await db.execute(
          "SELECT bookingID FROM billing_audit WHERE referenceNumber = ? ORDER BY auditID DESC LIMIT 1",
          [srcId]
        );
        if (auditRows.length > 0) {
          targetBookingID = auditRows[0].bookingID;
        }
      }
    }

    // If neither event type or no targetBookingID identified, acknowledge receipt
    if (!paymentID && !targetBookingID) {
      return NextResponse.json({ received: true, ignored: true });
    }

    // Atomic Database Transaction
    const db = await getDbConnection();
    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Idempotency Guard: Check billing_audit for existing referenceNumber
      const refToCheck = externalRef || paymentID || sourceID;
      const [existingAudit] = await conn.execute(
        "SELECT auditID FROM billing_audit WHERE referenceNumber = ? AND status = 'Settled' LIMIT 1",
        [refToCheck]
      );
      if (existingAudit.length > 0) {
        console.log(`[PayMongo Webhook] Transaction already settled for ref: ${refToCheck}. Skipping.`);
        await conn.commit();
        conn.release();
        return NextResponse.json({ received: true, alreadyProcessed: true });
      }

      // 2. Lock & Retrieve Booking Record
      const [bookingRows] = await conn.execute(
        "SELECT bookingID, guestID, roomID, status, remainingBalance, totalAmount FROM booking WHERE bookingID = ? FOR UPDATE",
        [targetBookingID]
      );

      if (bookingRows.length === 0) {
        console.warn(`[PayMongo Webhook] Booking #${targetBookingID} not found.`);
        await conn.rollback();
        conn.release();
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }

      const booking = bookingRows[0];
      const guestID = booking.guestID;

      // 3. Resolve or Create Billing Record
      let billingID = null;
      let totalBillAmount = parseFloat(booking.totalAmount || 0);
      let currentPaidAmount = 0;
      let currentBalance = 0;

      const [billingRows] = await conn.execute(
        "SELECT billingID, totalAmount, paidAmount, balance FROM billing WHERE bookingID = ? LIMIT 1 FOR UPDATE",
        [targetBookingID]
      );

      if (billingRows.length > 0) {
        billingID = billingRows[0].billingID;
        totalBillAmount = parseFloat(billingRows[0].totalAmount || totalBillAmount);
        currentPaidAmount = parseFloat(billingRows[0].paidAmount || 0);
        currentBalance = parseFloat(billingRows[0].balance || 0);
      } else {
        // Create initial billing record
        const balanceDetails = await getBookingBalanceDetails(targetBookingID).catch(() => null);
        totalBillAmount = balanceDetails ? parseFloat(balanceDetails.subtotal || 0) : totalBillAmount;
        currentBalance = totalBillAmount;

        const [insertBilling] = await conn.execute(
          "INSERT INTO billing (bookingID, totalAmount, paidAmount, balance, status) VALUES (?, ?, 0, ?, 'Active')",
          [targetBookingID, totalBillAmount, totalBillAmount]
        );
        billingID = insertBilling.insertId;
      }

      const newPaidAmount = currentPaidAmount + amountInPesos;
      const newRemainingBalance = Math.max(0, totalBillAmount - newPaidAmount);

      // a. Update booking: Set status = 'Confirmed', sync remainingBalance
      await conn.execute(
        `UPDATE booking 
         SET status = CASE 
                        WHEN status IN ('Pending', 'Pending Down Payment', 'Pending Check-in') THEN 'Confirmed'
                        WHEN status = 'Active Stay' THEN 'Active Stay'
                        ELSE 'Confirmed'
                      END,
             remainingBalance = ?,
             paymentCompletedAt = CASE WHEN ? <= 0 THEN NOW() ELSE paymentCompletedAt END
         WHERE bookingID = ?`,
        [newRemainingBalance, newRemainingBalance, targetBookingID]
      );

      // Update billing record
      await conn.execute(
        "UPDATE billing SET paidAmount = ?, balance = ? WHERE billingID = ?",
        [newPaidAmount, newRemainingBalance, billingID]
      );

      // c. Insert into payment
      const paymentMethodID = 2; // GCash
      const [insertPay] = await conn.execute(
        `INSERT INTO payment 
          (amount, cashReceived, changeAmount, billingID, guestID, staffID, paymentMethodID, referenceNumber, status, paymentDate) 
         VALUES (?, ?, 0.00, ?, ?, NULL, ?, ?, 'Settled', NOW())`,
        [amountInPesos, amountInPesos, billingID, guestID, paymentMethodID, refToCheck]
      );
      const newPaymentID = insertPay.insertId;

      // d. Insert into transaction (Table 129)
      try {
        await conn.execute(
          "INSERT INTO transactions (transactionDateTime, billingID, paymentID, testMode) VALUES (NOW(), ?, ?, 0)",
          [billingID, newPaymentID]
        );
      } catch (tErr) {
        // Fallback for singular `transaction` table if named differently
        await conn.execute(
          "INSERT INTO `transaction` (transactionDateTime, billingID, paymentID, testMode) VALUES (NOW(), ?, ?, 0)",
          [billingID, newPaymentID]
        ).catch(() => {});
      }

      // e. 3NF Line Items Sync (billing_room, billing_product, billing_amenity)
      await syncNormalizedBillingLineItems(conn, billingID, targetBookingID).catch(syncErr => {
        console.warn("syncNormalizedBillingLineItems warning:", syncErr.message);
      });

      // f. Insert audit log into billing_audit
      await conn.execute(
        `INSERT INTO billing_audit 
          (billingID, bookingID, transactionType, amount, balanceBefore, balanceAfter, userID, userName, userRole, description, referenceNumber, status, createdAt) 
         VALUES (?, ?, 'PAYMENT_RECEIVED', ?, ?, ?, NULL, 'PayMongo Live Webhook', 'System', ?, ?, 'Settled', NOW())`,
        [
          billingID,
          targetBookingID,
          amountInPesos,
          currentBalance,
          newRemainingBalance,
          `PayMongo Live GCash payment settled (₱${amountInPesos.toFixed(2)})`,
          refToCheck
        ]
      );

      // Auto-notify Administrators & Receptionists
      const [staffList] = await conn.execute("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
      for (const st of staffList) {
        await conn.execute(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Live GCash Payment Received', ?)",
          [st.userID, `Live GCash Payment of ₱${amountInPesos.toFixed(2)} received for Booking #${targetBookingID} (Ref: ${refToCheck}).`]
        ).catch(() => {});
      }

      await conn.commit();
      conn.release();

      console.log(`[PayMongo Webhook] Payment successfully persisted: Booking #${targetBookingID} | Ref: ${refToCheck}`);
      return NextResponse.json({ received: true, success: true, bookingID: targetBookingID, paymentID: newPaymentID });

    } catch (txErr) {
      await conn.rollback();
      conn.release();
      console.error("[PayMongo Webhook] Transaction failed:", txErr);
      return NextResponse.json({ error: 'Transaction failed: ' + txErr.message }, { status: 500 });
    }

  } catch (error) {
    console.error("[PayMongo Webhook] Internal server error:", error);
    return NextResponse.json({ error: 'Internal Server Error: ' + error.message }, { status: 500 });
  }
}
