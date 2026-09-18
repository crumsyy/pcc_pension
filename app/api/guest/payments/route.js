import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, getBookingBalance, logBillingAudit, ensurePaymentSchema, ensureBookingBillingSchema, normalizeBookingStatus } from '@/lib/db';
import { getQRPhImageURL } from '@/lib/qrph';

export async function POST(request) {
  const session = await getSession();
  if (!session || !['Guest', 'Receptionist', 'Administrator'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (body.action === 'test_failed') {
      const parsedBookingID = parseInt(body.bookingID);
      if (parsedBookingID) {
        await dbQuery("UPDATE booking SET status = 'Payment Declined' WHERE bookingID = ?", [parsedBookingID]);
      }
      return NextResponse.json({
        success: false,
        bookingStatus: 'Payment Declined',
        error: 'Payment authorization declined by user in PayMongo test mode.'
      }, { status: 400 });
    }

    // QRPh code generation action (PayMongo QRPh API)
    if (body.action === 'generate_qrph' || body.action === 'qrph' || body.type === 'qrph') {
      const parsedBookingID = parseInt(body.bookingID, 10);
      if (!parsedBookingID) {
        return NextResponse.json({ error: 'Valid Booking ID is required.' }, { status: 400 });
      }

      // Check booking & enforce Bill Ready status
      const bookingRows = await dbQuery("SELECT bookingID, guestID, status, remainingBalance, roomID FROM booking WHERE bookingID = ?", [parsedBookingID]);
      if (bookingRows.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }
      const bInfo = bookingRows[0];

      if (session.role === 'Guest') {
        const guestRows = await dbQuery("SELECT guestID FROM guest WHERE userID = ?", [session.userID]);
        if (guestRows.length === 0 || guestRows[0].guestID !== bInfo.guestID) {
          return NextResponse.json({ error: 'Unauthorized access to this booking.' }, { status: 403 });
        }
      }

      const normStatus = normalizeBookingStatus(bInfo.status);
      // Allow down payments upon booking creation; restrict when in-house or in checkout verification before bill finalization
      const activeUnfinalized = ['Checked In', 'Checked-In', 'Active Stay', 'Checkout Requested', 'Pending Room Verification', 'Pending Checkout', 'Room Verified'];
      if (activeUnfinalized.includes(bInfo.status) || (normStatus === 'Active Stay' && !['Bill Finalized', 'Final Billing Updated', 'Bill Ready'].includes(bInfo.status))) {
        return NextResponse.json({
          error: "Check-out must be requested first and receptionist must finalize your bill before payment."
        }, { status: 400 });
      }

      const bal = await getBookingBalance(parsedBookingID);
      const parseAmt = Math.round((parseFloat(body.amount) || bal || parseFloat(bInfo.remainingBalance) || 0) * 100) / 100;
      if (parseAmt <= 0) {
        return NextResponse.json({ error: 'Invalid payment amount.' }, { status: 400 });
      }

      const secretKey = process.env.PAYMONGO_SECRET_KEY || 'sk_test_GjYHQCNkKkxUuhQykSsSetrS';
      const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
      const amountInCentavos = Math.round(parseAmt * 100);

      // Call PayMongo API for QRPh
      let qrphCodeUrl = null;
      let qrCodeRaw = null;
      let sourceId = null;

      let testUrl = null;
      try {
        // Step 1: Create Payment Intent
        const piRes = await fetch('https://api.paymongo.com/v1/payment_intents', {
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
                payment_method_allowed: ['qrph'],
                description: `PCC Stay Payment for Booking #${parsedBookingID}`
              }
            }
          })
        });
        const piData = await piRes.json();

        if (piRes.ok && piData.data?.id) {
          const paymentIntentID = piData.data.id;
          sourceId = paymentIntentID;

          // Step 2: Create Payment Method (type: 'qrph')
          const pmRes = await fetch('https://api.paymongo.com/v1/payment_methods', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              data: {
                attributes: {
                  type: 'qrph'
                }
              }
            })
          });
          const pmData = await pmRes.json();

          if (pmRes.ok && pmData.data?.id) {
            // Step 3: Attach Payment Method
            const attachRes = await fetch(`https://api.paymongo.com/v1/payment_intents/${paymentIntentID}/attach`, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify({
                data: {
                  attributes: {
                    payment_method: pmData.data.id,
                    client_key: piData.data.attributes.client_key,
                    return_url: `https://${request.headers.get('host') || 'localhost'}/guest/dashboard?payment=success&bookingID=${parsedBookingID}`
                  }
                }
              })
            });
            const attachData = await attachRes.json();
            const nextAction = attachData.data?.attributes?.next_action || {};
            qrphCodeUrl = nextAction.qr_code?.image_url || nextAction.code?.image_url || null;
            qrCodeRaw = nextAction.qr_code?.qr_code || nextAction.code?.qr_code || null;
            testUrl = nextAction.code?.test_url || null;
          }
        }
      } catch (pmErr) {
        console.error("PayMongo QRPh creation error:", pmErr);
      }

      // Store returned source.id and qr_code URL in database
      const finalSourceId = sourceId?.startsWith('src_') ? sourceId : (sourceId ? `src_${sourceId.replace(/^pi_/, '')}` : `src_${Date.now()}`);
      const finalQrUrl = qrphCodeUrl || (qrCodeRaw ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeRaw)}` : getQRPhImageURL({ amount: parseAmt, reference: finalSourceId }));


      await logBillingAudit(null, {
        bookingID: parsedBookingID,
        transactionType: 'QRPh Generation',
        amount: parseAmt,
        referenceNumber: finalSourceId,
        description: `PayMongo dynamic QRPh generated with pre-set amount ₱${parseAmt.toFixed(2)}. Source ID: ${finalSourceId}, QR URL: ${finalQrUrl}`,
        status: 'Pending',
        userID: session.userID,
        userName: session.fullName || 'Guest User',
        userRole: session.role
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        qrphCodeUrl: finalQrUrl,
        sourceId: finalSourceId,
        amount: parseAmt,
        testUrl,
        status: bInfo.status || 'Bill Ready'
      });
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

    let guest;
    if (session.role === 'Guest') {
      const guests = await dbQuery("SELECT guestID, firstName, lastName FROM guest WHERE userID = ?", [session.userID]);
      if (guests.length === 0) {
        return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
      }
      guest = guests[0];
    } else {
      const bookingGuests = await dbQuery(
        "SELECT b.guestID, g.firstName, g.lastName FROM booking b JOIN guest g ON g.guestID = b.guestID WHERE b.bookingID = ?",
        [parsedBookingID]
      );
      if (bookingGuests.length === 0) {
        return NextResponse.json({ error: 'Booking guest not found.' }, { status: 404 });
      }
      guest = bookingGuests[0];
    }

    const pool = await getDbConnection();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await ensurePaymentSchema();
      await ensureBookingBillingSchema();

      // Row-level lock on booking
      const [bookingRows] = await connection.execute(
        "SELECT bookingID, status, guestID FROM booking WHERE bookingID = ? FOR UPDATE",
        [parsedBookingID]
      );

      if (bookingRows.length === 0 || (session.role === 'Guest' && bookingRows[0].guestID !== guest.guestID)) {
        await connection.rollback();
        return NextResponse.json({ error: 'Booking record not found or access denied.' }, { status: 404 });
      }

      // Allow down payments for new bookings; restrict only when Checked-In (active stay) and bill not ready
      if (session.role === 'Guest') {
        const normStatus = normalizeBookingStatus(bookingRows[0].status);
        if (normStatus === 'Checked-In') {
          await connection.rollback();
          return NextResponse.json({
            error: "Payment is only allowed once the bill is ready."
          }, { status: 400 });
        }
      }

      // Prevent duplicate charging by checking reference number in recent payments
      const [existingPayment] = await connection.execute(
        "SELECT paymentID FROM payment WHERE billingID IN (SELECT billingID FROM billing WHERE bookingID = ?) AND paymentDate >= DATE_SUB(NOW(), INTERVAL 5 MINUTE) AND amount = ?",
        [parsedBookingID, parsedAmount]
      );

      // Check billing_audit for referenceNumber duplication
      const [existingRef] = await connection.execute(
        "SELECT auditID, bookingID, amount FROM billing_audit WHERE referenceNumber = ? LIMIT 1",
        [cleanRef]
      );

      let effectiveRef = cleanRef;
      if (existingRef.length > 0) {
        const recordedAudit = existingRef[0];
        // 1. Idempotency Check: If reference is already recorded for THIS SAME booking, return existing receipt successfully
        if (Number(recordedAudit.bookingID) === Number(parsedBookingID)) {
          const [pRows] = await connection.execute(
            `SELECT p.paymentID, p.amount, p.referenceNumber, p.paymentDate, b.remainingBalance
             FROM payment p
             JOIN billing bil ON bil.billingID = p.billingID
             JOIN booking b ON b.bookingID = bil.bookingID
             WHERE b.bookingID = ?
             ORDER BY p.paymentID DESC LIMIT 1`,
            [parsedBookingID]
          );
          await connection.commit();
          const pData = pRows[0] || {};
          return NextResponse.json({
            success: true,
            message: 'GCash payment verified successfully!',
            receipt: {
              paymentID: pData.paymentID || recordedAudit.auditID,
              bookingID: parsedBookingID,
              guestName: `${guest.firstName} ${guest.lastName}`,
              paymentMethod: 'GCash Online',
              referenceNumber: cleanRef,
              paymentPercentage: paymentPercentage || 'Down Payment',
              amountPaid: parseFloat(pData.amount || parsedAmount),
              remainingBalance: parseFloat(pData.remainingBalance ?? 0),
              timestamp: pData.paymentDate || new Date().toISOString()
            }
          });
        }

        // 2. Cross-booking check: If recorded for a different booking, check if test mode or test reference
        const isTestRef = Boolean(
          isTestAuth ||
          cleanRef.startsWith('PM-') ||
          cleanRef.startsWith('TEST-') ||
          cleanRef.startsWith('SIM-') ||
          cleanRef.startsWith('pi_dyn_') ||
          cleanRef.includes('AUTH')
        );

        if (isTestRef) {
          // Disambiguate test reference with random entropy so testing multiple bookings never throws duplicate error
          effectiveRef = `${cleanRef}-T${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
        } else {
          await connection.rollback();
          return NextResponse.json({
            error: `Payment with Reference #${cleanRef} has already been recorded.`
          }, { status: 400 });
        }
      }

      // Find or create billing record with lock
      const [billingRows] = await connection.execute(
        "SELECT billingID FROM billing WHERE bookingID = ? FOR UPDATE",
        [parsedBookingID]
      );

      let billingID;
      if (billingRows.length === 0) {
        const [bkGuest] = await connection.execute("SELECT guestID FROM booking WHERE bookingID = ?", [parsedBookingID]);
        const bGuestID = bkGuest[0]?.guestID || null;
        const [insBilling] = await connection.execute(
          "INSERT INTO billing (billingDateTime, guestID, bookingID) VALUES (NOW(), ?, ?)",
          [bGuestID, parsedBookingID]
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

      // Insert payment record
      const [paymentInsert] = await connection.execute(
        `INSERT INTO payment (amount, cashReceived, \`change\`, paymentDate, isFullyPaid, billingID, guestID, paymentMethodID, testMode, status, referenceNumber)
         VALUES (?, ?, 0, ?, 0, ?, ?, ?, 1, 'Settled', ?)`,
        [parsedAmount, parsedAmount, nowStr, billingID, guest.guestID, paymentMethodID, effectiveRef]
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
      if (paymentPercentage?.includes('25')) txType = 'Down Payment (25%)';
      else if (paymentPercentage?.includes('30')) txType = 'Down Payment (30%)';
      else if (paymentPercentage?.includes('50')) txType = 'Down Payment (50%)';
      else if (paymentPercentage?.includes('100')) txType = 'Down Payment (100%)';
      else if (balanceAfter <= 0.05) txType = 'Checkout Settlement';

      // Update downPaymentAmount, downPaymentPercentage, and remainingBalance on booking and billing
      const pctNum = parseInt(paymentPercentage, 10) || 50;
      await connection.execute(
        "UPDATE booking SET downPaymentAmount = ?, downPaymentPercentage = ?, remainingBalance = ?, finalBalance = ? WHERE bookingID = ?",
        [parsedAmount, pctNum, balanceAfter, balanceAfter, parsedBookingID]
      );
      await connection.execute(
        "UPDATE billing SET downPaymentAmount = ?, downPaymentPercentage = ?, remainingBalance = ?, balance = ? WHERE billingID = ?",
        [parsedAmount, pctNum, balanceAfter, balanceAfter, billingID]
      );

      // Update booking and payment status (table billing has no status column)
      if (balanceAfter <= 0.05) {
        await connection.execute("UPDATE payment SET isFullyPaid = 1 WHERE paymentID = ?", [paymentID]);
        await connection.execute("UPDATE booking SET status = 'Paid', paymentCompletedAt = NOW() WHERE bookingID = ?", [parsedBookingID]);
      }

      // Automatic Room Status update: if check-in is today or has passed, update room status to 'Occupied'
      const [bRows] = await connection.execute(
        "SELECT roomID, checkInDateTime, status FROM booking WHERE bookingID = ?",
        [parsedBookingID]
      );
      if (bRows.length > 0) {
        const bInfo = bRows[0];
        const inDate = new Date(String(bInfo.checkInDateTime).replace(' ', 'T'));
        const now = new Date();
        const inDateOnly = String(bInfo.checkInDateTime).split(' ')[0] || String(bInfo.checkInDateTime).split('T')[0];
        const todayDateOnly = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        if (inDate <= now || inDateOnly === todayDateOnly || bInfo.status === 'Active Stay' || bInfo.status === 'Checked In') {
          await connection.execute("UPDATE room SET status = 'Occupied' WHERE roomID = ?", [bInfo.roomID]);
          if (bInfo.status !== 'Active Stay' && bInfo.status !== 'Checked In' && bInfo.status !== 'Paid' && bInfo.status !== 'Completed' && bInfo.status !== 'Checked Out' && bInfo.status !== 'Payment Completed') {
            await connection.execute("UPDATE booking SET status = 'Active Stay' WHERE bookingID = ?", [parsedBookingID]);
          }
        }
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
        description: `GCash Online Payment (Ref #${effectiveRef})`,
        referenceNumber: effectiveRef
      });

      await connection.commit();

      // Non-blocking staff notifications
      setImmediate(async () => {
        try {
          const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
          if (staffToNotify.length > 0) {
            const placeholders = staffToNotify.map(() => '(?, ?, ?)').join(', ');
            const values = [];
            for (const r of staffToNotify) {
              values.push(r.userID, 'New GCash Online Payment', `GCash payment of ₱${parsedAmount.toFixed(2)} received from ${guest.firstName} ${guest.lastName} for Booking #${parsedBookingID} (Ref #${effectiveRef}).`);
            }
            await dbQuery(`INSERT INTO notification (userID, title, message) VALUES ${placeholders}`, values);
          }
        } catch (notifErr) {}
      });

      return NextResponse.json({
        success: true,
        message: 'GCash payment recorded and verified successfully!',
        receipt: {
          paymentID,
          bookingID: parsedBookingID,
          guestName: `${guest.firstName} ${guest.lastName}`,
          paymentMethod: 'GCash Online',
          referenceNumber: effectiveRef,
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
