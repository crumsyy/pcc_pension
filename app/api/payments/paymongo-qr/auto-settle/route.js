import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, getBookingBalance, syncInventoryStock, ensureTestModeSchema, logBillingAudit } from '@/lib/db';

export async function POST(request) {
  try {
    const session = await getSession();
    const body = await request.json();

    const bookingID = body.bookingID ? parseInt(body.bookingID) : null;
    const reservationID = body.reservationID ? parseInt(body.reservationID) : null;
    let guestID = body.guestID ? parseInt(body.guestID) : null;
    const amount = parseFloat(body.amount);
    const checkoutIfSettled = body.checkoutIfSettled ?? true;
    const paymentIntentID = body.paymentIntentID || null;

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount.' }, { status: 400 });
    }

    if (!bookingID && !reservationID) {
      return NextResponse.json({ error: 'Booking ID or Reservation ID is required.' }, { status: 400 });
    }

    // Auto-resolve guestID if missing
    if (!guestID) {
      if (bookingID) {
        const b = await dbQuery("SELECT guestID FROM booking WHERE bookingID = ?", [bookingID]);
        if (b.length > 0) guestID = b[0].guestID;
      } else if (reservationID) {
        const r = await dbQuery("SELECT guestID FROM reservation WHERE reservationID = ?", [reservationID]);
        if (r.length > 0) guestID = r[0].guestID;
      }
    }

    if (!guestID && session?.userID) {
      const g = await dbQuery("SELECT guestID FROM guest WHERE userID = ?", [session.userID]);
      if (g.length > 0) guestID = g[0].guestID;
    }

    if (!guestID) {
      return NextResponse.json({ error: 'Guest not found.' }, { status: 404 });
    }

    await ensureTestModeSchema();

    const localNow = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

    const db = await getDbConnection();
    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      let targetBookingID = bookingID;

      // Handle reservation conversion if reservationID given and no bookingID yet
      if (reservationID && !targetBookingID) {
        const [resRows] = await conn.execute(
          "SELECT r.*, rm.rate as roomRate FROM reservation r JOIN room rm ON rm.roomID = r.roomID WHERE r.reservationID = ?",
          [reservationID]
        );

        if (resRows.length > 0) {
          const resObj = resRows[0];
          const inDateStr = (resObj.reservationDateTime ? String(resObj.reservationDateTime) : nowStr).substring(0, 19).replace('T', ' ');
          const outDateStr = resObj.checkOutDateTime 
            ? String(resObj.checkOutDateTime).substring(0, 19).replace('T', ' ')
            : `${inDateStr.split(' ')[0]} 12:00:00`;

          await conn.execute("UPDATE reservation SET status = 'Confirmed' WHERE reservationID = ?", [reservationID]);

          const [bRes] = await conn.execute(
            "INSERT INTO booking (checkInDateTime, checkOutDateTime, status, reservationID, guestID, roomID) VALUES (?, ?, 'Pending Check-in', ?, ?, ?)",
            [inDateStr, outDateStr, reservationID, guestID, resObj.roomID]
          );
          targetBookingID = bRes.insertId;

          // Default guest details
          const [gInfo] = await conn.execute("SELECT firstName, lastName FROM guest WHERE guestID = ?", [guestID]);
          const guestName = gInfo.length > 0 ? `${gInfo[0].firstName} ${gInfo[0].lastName}` : 'Guest';
          await conn.execute(
            "INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber) VALUES (?, ?, 30, NULL, NULL)",
            [targetBookingID, guestName]
          );

          await conn.execute("UPDATE room SET status = 'Reserved' WHERE roomID = ?", [resObj.roomID]);
        }
      }

      // Ensure billing record
      let billingID = null;
      if (targetBookingID) {
        const [billRows] = await conn.execute("SELECT billingID FROM billing WHERE bookingID = ?", [targetBookingID]);
        if (billRows.length > 0) {
          billingID = billRows[0].billingID;
        } else {
          const [billInsert] = await conn.execute(
            "INSERT INTO billing (billingDateTime, guestID, bookingID, orderID) VALUES (?, ?, ?, NULL)",
            [nowStr, guestID, targetBookingID]
          );
          billingID = billInsert.insertId;
        }
      }

      // Staff resolution
      let staffID = null;
      if (session?.userID) {
        const [stRows] = await conn.execute("SELECT staffID FROM staff WHERE userID = ?", [session.userID]);
        if (stRows.length > 0) staffID = stRows[0].staffID;
      }

      const balanceBefore = targetBookingID ? await getBookingBalance(targetBookingID) : amount;

      // Insert GCash Payment (paymentMethodID = 2)
      const [paymentInsert] = await conn.execute(
        `INSERT INTO payment (amount, cashReceived, \`change\`, billingID, guestID, staffID, paymentMethodID, discountID, promotionID, testMode)
         VALUES (?, ?, 0, ?, ?, ?, 2, NULL, NULL, 1)`,
        [amount, amount, billingID, guestID, staffID]
      );
      const paymentID = paymentInsert.insertId;

      // Insert Transaction Log
      await conn.execute(
        "INSERT INTO transactions (transactionDateTime, billingID, paymentID, testMode) VALUES (?, ?, ?, 1)",
        [nowStr, billingID, paymentID]
      );

      // Check if this payment fully settles the stay and triggers checkout
      let checkedOut = false;
      if (targetBookingID && checkoutIfSettled) {
        const [bDetails] = await conn.execute("SELECT status, roomID FROM booking WHERE bookingID = ?", [targetBookingID]);
        if (bDetails.length > 0) {
          const currentStatus = bDetails[0].status;
          const roomID = bDetails[0].roomID;

          if (currentStatus === 'Checked In' || currentStatus === 'Late Checkout') {
            const currentBal = await getBookingBalance(targetBookingID);
            if (currentBal <= 0.05) {
              await conn.execute("UPDATE booking SET status = 'Checked Out', checkOutDateTime = ? WHERE bookingID = ?", [nowStr, targetBookingID]);
              await conn.execute("UPDATE room SET status = 'Available' WHERE roomID = ?", [roomID]);
              checkedOut = true;

              // Auto-return borrowed amenities in good condition
              const [borrows] = await conn.execute(
                "SELECT * FROM borrow_transaction WHERE bookingID = ? AND status = 'Borrowed'",
                [targetBookingID]
              );
              for (const borrow of borrows) {
                await conn.execute(
                  `UPDATE borrow_transaction 
                   SET status = 'Returned', conditionUponReturn = 'Good', actualReturnDate = ?, remarks = 'Auto-returned upon GCash check-out' 
                   WHERE borrowID = ?`,
                  [nowStr, borrow.borrowID]
                );

                const [batches] = await conn.execute(
                  "SELECT batchID FROM inventory_batch WHERE itemType = ? AND itemID = ? ORDER BY dateReceived DESC LIMIT 1",
                  [borrow.itemType, borrow.itemID]
                );
                const batchID = batches[0]?.batchID || null;
                if (batchID) {
                  await conn.execute(
                    "UPDATE inventory_batch SET remainingQuantity = remainingQuantity + ? WHERE batchID = ?",
                    [borrow.quantity, batchID]
                  );
                }

                if (borrow.itemType === 'Amenity') {
                  await conn.execute("UPDATE amenities SET quantity = quantity + ? WHERE amenityID = ?", [borrow.quantity, borrow.itemID]);
                } else {
                  await conn.execute("UPDATE products SET quantity = quantity + ? WHERE productID = ?", [borrow.quantity, borrow.itemID]);
                }
              }
            }
          }
        }
      }

      if (targetBookingID && billingID) {
        const balanceAfter = Math.max(0, Math.round((balanceBefore - amount) * 100) / 100);
        if (balanceAfter <= 0.05 || checkedOut) {
          await conn.execute("UPDATE billing SET status = 'Paid' WHERE billingID = ?", [billingID]);
          await conn.execute("UPDATE payment SET isFullyPaid = 1 WHERE paymentID = ?", [paymentID]);
        } else {
          await conn.execute("UPDATE billing SET status = 'Partial' WHERE billingID = ?", [billingID]);
        }

        await logBillingAudit(conn, {
          billingID,
          bookingID: targetBookingID,
          transactionType: checkedOut ? 'Checkout Settlement' : (balanceAfter <= 0.05 ? 'Subsequent Payment' : 'Down Payment'),
          amount,
          balanceBefore,
          balanceAfter,
          userID: session?.userID || null,
          userName: 'PayMongo QR / GCash',
          userRole: 'Guest',
          description: `PayMongo QR Auto-Settlement (${paymentIntentID || 'QR Payment'})`,
          referenceNumber: paymentIntentID || `PAY-${paymentID}`
        });
      }

      await conn.commit();
      await syncInventoryStock();

      // Notifications
      try {
        const [staffUsers] = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
        for (const s of staffUsers) {
          await dbQuery(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'GCash Payment Received', ?)",
            [s.userID, `GCash payment of ₱${amount.toFixed(2)} automatically received${targetBookingID ? ` for Booking #${targetBookingID}` : ''}.`]
          );
        }
      } catch (e) {
        console.error("Staff notification error:", e);
      }

      return NextResponse.json({
        success: true,
        message: checkedOut ? 'GCash payment recorded and stay checked out successfully.' : 'GCash payment recorded successfully.',
        bookingID: targetBookingID,
        billingID,
        paymentID,
        checkedOut
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Auto-settle GCash error:", error);
    return NextResponse.json({ error: 'Failed to record GCash payment: ' + error.message }, { status: 500 });
  }
}
