import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncInventoryStock, getBookingBalance, completeBookingAndFreeRoom, logBillingAudit, ensurePaymentSchema, ensureBookingBillingSchema } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureBookingBillingSchema();

  try {
    const [activeBookings, discounts, paymentMethods, paymentHistory] = await Promise.all([
      dbQuery(`
        SELECT b.bookingID, b.guestID, b.roomID, b.status, DATE_FORMAT(b.checkInDateTime, '%Y-%m-%dT%H:%i:%s') as checkInDateTime, DATE_FORMAT(b.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime,
               COALESCE(b.remainingBalance, 0) as remainingBalance,
               g.userID, g.firstName, g.lastName, g.contact,
               COALESCE(rm.roomNumber, 'N/A') as roomNumber, 
               COALESCE(rt.type, 'Standard Room') as roomType
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        LEFT JOIN room rm ON rm.roomID = b.roomID
        LEFT JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE b.status IN ('Confirmed', 'Checked In', 'Active Stay', 'Late Checkout', 'Pending Room Verification', 'Room Verified', 'Bill Finalized', 'Payment Completed', 'Paid', 'Checked Out', 'Completed')
        ORDER BY rm.roomNumber
      `),
      dbQuery("SELECT discountID, name, percentage, eligibilityTypeID FROM discounts WHERE isArchived = 0"),
      dbQuery("SELECT paymentMethodID, paymentMethod FROM payment_method"),
      dbQuery(`
        SELECT p.paymentID, p.amount, p.cashReceived, p.change, p.paymentMethodID,
               COALESCE(DATE_FORMAT(t.transactionDateTime, '%Y-%m-%d %H:%i:%s'), DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')) as paymentDateTime,
               pm.paymentMethod,
               g.guestID, g.firstName, g.lastName, g.contact,
               b.billingID, b.bookingID,
               rm.roomNumber, rt.type as roomType,
               COALESCE(CONCAT(st.firstName, ' ', st.lastName), u.email, 'Front Desk Staff') as processedBy
        FROM payment p
        JOIN payment_method pm ON pm.paymentMethodID = p.paymentMethodID
        JOIN guest g ON g.guestID = p.guestID
        LEFT JOIN billing b ON b.billingID = p.billingID
        LEFT JOIN booking bk ON bk.bookingID = b.bookingID
        LEFT JOIN room rm ON rm.roomID = bk.roomID
        LEFT JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        LEFT JOIN staff st ON st.staffID = p.staffID
        LEFT JOIN user u ON u.userID = st.userID
        LEFT JOIN transactions t ON t.paymentID = p.paymentID
        ORDER BY p.paymentID DESC
        LIMIT 500
      `)
    ]);

    // Filter activeBookings: Confirmed, Active Stay, Checked In and Late Checkout guests are always selectable; Checked Out guests are only included if they have an unpaid balance > 0
    const filteredActiveBookings = activeBookings.filter(b => {
      if (['Confirmed', 'Checked In', 'Active Stay', 'Late Checkout', 'Pending Room Verification', 'Room Verified', 'Bill Finalized', 'Payment Completed', 'Paid'].includes(b.status)) {
        return true;
      }
      if (b.status === 'Checked Out' && parseFloat(b.remainingBalance || 0) > 0.05) {
        return true;
      }
      return false;
    });

    return NextResponse.json({
      success: true,
      activeBookings: filteredActiveBookings,
      allBillingStays: activeBookings,
      discounts,
      paymentMethods,
      paymentHistory
    });
  } catch (error) {
    console.error("Failed to fetch payments checkout list:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureBookingBillingSchema();

  try {
    const body = await request.json();
    const bookingID = parseInt(body.bookingID);
    const guestID = parseInt(body.guestID);
    const amount = parseFloat(body.amount);
    const cashReceived = parseFloat(body.cashReceived || 0);
    const change = parseFloat(body.change || 0);
    const paymentMethodID = parseInt(body.paymentMethodID);
    const discountID = body.discountID ? parseInt(body.discountID) : null;
    const bookingDetails = await dbQuery("SELECT status, roomID FROM booking WHERE bookingID = ?", [bookingID]);
    if (bookingDetails.length === 0) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }
    const bookingStatus = bookingDetails[0].status;

    const currentBalance = await getBookingBalance(bookingID);
    const isFullyPaid = (currentBalance - amount) <= 0.05;
    const shouldCheckout = isFullyPaid && (bookingStatus === 'Checked In' || bookingStatus === 'Late Checkout');

    if (!bookingID || !guestID || isNaN(amount) || amount < 0 || !paymentMethodID) {
      return NextResponse.json({ error: 'Missing required payment details.' }, { status: 400 });
    }

    const localNow = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

    // 1. Fetch staffID from staff table using userID
    const staffRes = await dbQuery("SELECT staffID FROM staff WHERE userID = ?", [session.userID]);
    const staffID = staffRes[0]?.staffID || null;

    const db = await getDbConnection();
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Row lock booking and billing
      const [bookingLock] = await connection.execute(
        "SELECT bookingID, status, roomID FROM booking WHERE bookingID = ? FOR UPDATE",
        [bookingID]
      );
      if (bookingLock.length === 0) {
        await connection.rollback();
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }

      // 2. Ensure billing record exists with lock
      const [billingCheck] = await connection.execute("SELECT billingID FROM billing WHERE bookingID = ? FOR UPDATE", [bookingID]);
      let billingID;

      if (billingCheck.length > 0) {
        billingID = billingCheck[0].billingID;
      } else {
        const [billingInsert] = await connection.execute(
          "INSERT INTO billing (billingDateTime, guestID, bookingID, orderID) VALUES (?, ?, ?, NULL)",
          [nowStr, guestID, bookingID]
        );
        billingID = billingInsert.insertId;
      }

      const balanceBefore = await getBookingBalance(bookingID);

      const cashVal = parseFloat(cashReceived) || amount;
      const changeVal = Math.max(0, Math.round((cashVal - amount) * 100) / 100);

      await ensurePaymentSchema();
      const refNumber = body.referenceNumber || (parseInt(paymentMethodID) === 2 ? (body.gcashRef || `GCASH-BK-${bookingID}`) : `CASH-${Date.now().toString().slice(-6)}`);

      // 3. Insert payment
      const [paymentInsert] = await connection.execute(
        `INSERT INTO payment (amount, cashReceived, \`change\`, billingID, guestID, staffID, paymentMethodID, discountID, promotionID, testMode, status, referenceNumber) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, 'Settled', ?)`,
        [amount, cashVal, changeVal, billingID, guestID, staffID, paymentMethodID, discountID, refNumber]
      );
      const paymentID = paymentInsert.insertId;

      // 4. Insert transaction log
      await connection.execute(
        "INSERT INTO transactions (transactionDateTime, billingID, paymentID, testMode) VALUES (?, ?, ?, 1)",
        [nowStr, billingID, paymentID]
      );

      const balanceAfter = Math.max(0, Math.round((balanceBefore - amount) * 100) / 100);

      // Update payment status (table billing has no status column)
      if (balanceAfter <= 0.05) {
        await connection.execute("UPDATE payment SET isFullyPaid = 1 WHERE paymentID = ?", [paymentID]);
      }

      // Log billing audit
      await logBillingAudit(connection, {
        billingID,
        bookingID,
        transactionType: shouldCheckout ? 'Checkout Settlement' : 'Subsequent Payment',
        status: 'Settled',
        amount,
        balanceBefore,
        balanceAfter,
        userID: session.userID,
        userName: session.email || 'Receptionist',
        userRole: session.role,
        description: `Front Desk Payment (Method #${paymentMethodID})${shouldCheckout ? ' - Checkout Settlement' : ''}`,
        referenceNumber: refNumber
      });

      // 5. If checkout requested or bill settled, complete booking and free room
      if (shouldCheckout) {
        // Auto-return all borrowed amenities that are still outstanding
        const [borrows] = await connection.execute(
          "SELECT * FROM borrow_transaction WHERE bookingID = ? AND status = 'Borrowed'",
          [bookingID]
        );
        for (const borrow of borrows) {
          await connection.execute(
            `UPDATE borrow_transaction 
             SET status = 'Returned', conditionUponReturn = 'Good', actualReturnDate = ?, remarks = 'Auto-returned upon check-out settlement' 
             WHERE borrowID = ?`,
            [nowStr, borrow.borrowID]
          );

          const [batches] = await connection.execute(
            "SELECT batchID FROM inventory_batch WHERE itemType = ? AND itemID = ? ORDER BY dateReceived DESC LIMIT 1",
            [borrow.itemType, borrow.itemID]
          );
          let batchID = null;
          if (batches.length > 0) {
            batchID = batches[0].batchID;
            await connection.execute(
              "UPDATE inventory_batch SET remainingQuantity = remainingQuantity + ? WHERE batchID = ?",
              [borrow.quantity, batchID]
            );
          }

          await connection.execute(
            `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks, batchID)
             VALUES (?, ?, ?, ?, 'Return', ?, 'Auto-returned upon check-out settlement', ?)`,
            [borrow.itemType, borrow.itemID, borrow.quantity, session.userID || staffID, `BOR-${borrow.borrowID}`, batchID]
          );

          if (borrow.itemType === 'Amenity') {
            await connection.execute("UPDATE amenities SET quantity = quantity + ? WHERE amenityID = ?", [borrow.quantity, borrow.itemID]);
          } else {
            await connection.execute("UPDATE products SET quantity = quantity + ? WHERE productID = ?", [borrow.quantity, borrow.itemID]);
          }
        }
      }

      await connection.commit();

      if (shouldCheckout) {
        await completeBookingAndFreeRoom(bookingID);
      } else if (bookingID) {
        // Upon payment for an active stay booking, automatically ensure room status is Occupied
        const [bInfo] = await connection.execute("SELECT roomID, status FROM booking WHERE bookingID = ?", [bookingID]);
        if (bInfo.length > 0 && bInfo[0].status !== 'Checked Out' && bInfo[0].status !== 'Cancelled') {
          await connection.execute("UPDATE room SET status = 'Occupied' WHERE roomID = ?", [bInfo[0].roomID]);
        }
      }

      await syncInventoryStock();

      // Notify Administrators (roleID = 1) of front-desk payment
      try {
        const adminUsers = await dbQuery("SELECT userID FROM user WHERE roleID = 1 AND status = 'Active'");
        for (const admin of adminUsers) {
          await dbQuery(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Payment Received Alert', ?)",
            [admin.userID, `Payment of ₱${amount.toFixed(2)} received for Booking #${bookingID} (Billing #${billingID}).`]
          );
        }
      } catch (notifyErr) {
        console.error("Failed to notify admin of payment:", notifyErr);
      }

      return NextResponse.json({ success: true, message: 'Payment recorded and checkout completed successfully.', billingID, paymentID, checkoutChecked: shouldCheckout });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("Failed to process payment:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
