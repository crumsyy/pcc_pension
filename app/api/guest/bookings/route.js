import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncRoomStatuses, getBookingBalance, getBookingBalanceDetails, ensureBookingBillingSchema, normalizeBookingStatus } from '@/lib/db';
import { sendBookingConfirmationEmail } from '@/lib/mailer';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    await syncRoomStatuses();
    await ensureBookingBillingSchema();

    const guests = await dbQuery("SELECT guestID FROM guest WHERE userID = ?", [session.userID]);
    if (guests.length === 0) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }
    const guestID = guests[0].guestID;

    // Fetch all bookings for this guest
    const bookings = await dbQuery(`
      SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime,
             CASE
               WHEN b.status IN ('Pending Check-in', 'Pending', 'Confirmed', 'Booked') AND NOW() >= b.checkInDateTime AND NOW() <= DATE_ADD(b.checkInDateTime, INTERVAL 1 HOUR) THEN 'Overdue Check-In'
               WHEN b.status IN ('Pending Check-in', 'Pending', 'Confirmed', 'Booked') AND b.checkInDateTime < DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 'No Show'
               ELSE b.status
             END as status,
             b.reservationID, b.roomID, b.cancelRemarks,
             b.finalBalance, b.checkoutRequestedAt, b.roomVerifiedAt, b.finalBillingUpdatedAt, b.paymentCompletedAt,
             rm.roomNumber, rm.floorID, rt.type as roomType, rt.roomTypeID, COALESCE(rr.rate, 1500) as rate
      FROM booking b
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      LEFT JOIN room_rate rr ON rr.roomTypeID = rm.roomTypeID AND rr.floorID = rm.floorID AND rr.breakfastID = 1
      WHERE b.guestID = ?
      ORDER BY b.checkInDateTime DESC
    `, [guestID]);

    const bookingsWithDetails = await Promise.all(bookings.map(async b => {
      const remainingBalance = await getBookingBalance(b.bookingID);
      const registeredGuests = await dbQuery(`
        SELECT bg.*, d.name as discountName, d.percentage as discountPercentage
        FROM booking_guest_details bg
        LEFT JOIN discounts d ON d.discountID = bg.discountID
        WHERE bg.bookingID = ?
      `, [b.bookingID]);
      const incidentals = await dbQuery(`
        SELECT chargeID, description, amount, DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i') as createdAt
        FROM incidental_charge
        WHERE bookingID = ?
        ORDER BY chargeID ASC
      `, [b.bookingID]);
      const billingDetails = await getBookingBalanceDetails(b.bookingID).catch(() => null);
      return {
        ...b,
        status: normalizeBookingStatus(b.status),
        rawStatus: b.status,
        remainingBalance,
        registeredGuests,
        incidentals: incidentals || [],
        billingDetails: billingDetails || null
      };
    }));

    return NextResponse.json({ success: true, bookings: bookingsWithDetails });
  } catch (error) {
    console.error("Failed to fetch guest bookings:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    await ensureBookingBillingSchema();
    const body = await request.json();
    const { action } = body;

    const guests = await dbQuery("SELECT guestID, firstName, lastName, contact, email FROM guest WHERE userID = ?", [session.userID]);
    if (guests.length === 0) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }
    const guest = guests[0];

    if (action === 'pay') {
      const bookingID = parseInt(body.bookingID);
      if (!bookingID) {
        return NextResponse.json({ error: 'Valid Booking ID is required.' }, { status: 400 });
      }

      const [booking] = await dbQuery(
        "SELECT bookingID, status, guestID FROM booking WHERE bookingID = ? AND guestID = ?",
        [bookingID, guest.guestID]
      );
      if (!booking) {
        return NextResponse.json({ error: 'Booking record not found or access denied.' }, { status: 404 });
      }

      const normalized = normalizeBookingStatus(booking.status);
      // Allow payments for down payments (Pending Down Payment, Reservation Confirmed, Pending Check-in, etc.)
      // Restrict only when status is Checked-In (active stay) and bill is not yet ready
      if (normalized === 'Checked-In') {
        return NextResponse.json({ error: "Payment is only allowed once the bill is ready." }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Booking is verified and eligible for payment.',
        bookingStatus: normalized
      });
    }

    if (action === 'request_checkout') {
      const bookingID = parseInt(body.bookingID);
      if (!bookingID) {
        return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });
      }

      const [booking] = await dbQuery(
        `SELECT b.bookingID, b.status, b.roomID, rm.roomNumber 
         FROM booking b 
         JOIN room rm ON rm.roomID = b.roomID 
         WHERE b.bookingID = ? AND b.guestID = ?`,
        [bookingID, guest.guestID]
      );

      if (!booking) {
        return NextResponse.json({ error: 'Booking record not found.' }, { status: 404 });
      }

      const currentStatus = booking.status;
      if (normalizeBookingStatus(currentStatus) !== 'Checked-In') {
        return NextResponse.json({ 
          error: `Cannot request checkout from current status '${currentStatus}'. Only checked-in active stays can request checkout.` 
        }, { status: 400 });
      }

      await ensureBookingBillingSchema();
      await dbQuery(
        "UPDATE booking SET status = 'Pending Room Verification', checkoutRequestedAt = NOW() WHERE bookingID = ?",
        [bookingID]
      );

      // Notify receptionists & administrators
      const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
      for (const r of staffToNotify) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Guest Checkout Requested', ?)",
          [r.userID, `Guest ${guest.firstName} ${guest.lastName} in Room ${booking.roomNumber} (Booking #${bookingID}) has requested checkout. Room inspection and incidental fee verification required.`]
        );
      }

      // Notify guest
      await dbQuery(
        "INSERT INTO notification (userID, title, message) VALUES (?, 'Checkout Requested — Inspection in Progress', ?)",
        [session.userID, `Your checkout request for Room ${booking.roomNumber} has been received. Our team will inspect your room and update your final billing statement shortly.`]
      );

      return NextResponse.json({
        success: true,
        message: 'Checkout request submitted. Front desk has been notified to verify your room and finalize your billing.',
        bookingStatus: 'Pending Room Verification'
      });
    }

    if (action === 'cancel') {
      const bookingID = parseInt(body.bookingID);
      const reason = body.reason?.trim() || 'Canceled by guest online';

      if (!bookingID) {
        return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });
      }

      const [booking] = await dbQuery("SELECT status, roomID FROM booking WHERE bookingID = ? AND guestID = ?", [bookingID, guest.guestID]);
      if (!booking) {
        return NextResponse.json({ error: 'Booking record not found.' }, { status: 404 });
      }

      if (booking.status === 'Checked In' || booking.status === 'Checked Out') {
        return NextResponse.json({ error: 'Checked-in or Checked-out bookings cannot be canceled.' }, { status: 400 });
      }

      await dbQuery(
        "UPDATE booking SET status = 'Cancelled', cancelRemarks = ? WHERE bookingID = ?",
        [reason, bookingID]
      );

      // Release room status back to Available if it was Reserved
      await dbQuery("UPDATE room SET status = 'Available' WHERE roomID = ? AND status = 'Reserved'", [booking.roomID]);

      // Notify receptionists
      const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
      for (const r of staffToNotify) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Booking Canceled by Guest', ?)",
          [r.userID, `Booking #${bookingID} for ${guest.firstName} ${guest.lastName} was canceled by the guest.`]
        );
      }

      return NextResponse.json({ success: true, message: 'Booking canceled successfully.' });
    }

    if (action === 'create') {
      const { roomID, checkInDate, checkOutDate, reservationID } = body;
      const registeredGuests = body.registeredGuests || [
        { fullName: `${guest.firstName} ${guest.lastName}`, age: 30, discountID: null, discountIdNumber: null }
      ];

      if (!roomID || !checkInDate || !checkOutDate) {
        return NextResponse.json({ error: 'Room selection, Check-In, and Check-Out dates are required.' }, { status: 400 });
      }

      // GCash Down Payment Settlement Validation
      if ((body.paymentMethod === 'GCash' || parseInt(body.paymentMethodID) === 2) && body.paymentStatus !== 'Settled' && !body.isGcashSettled && !body.referenceNumber) {
        return NextResponse.json({ error: "Cannot proceed: GCash payment not settled." }, { status: 400 });
      }

      const checkInDateTime = `${checkInDate} 14:00:00`;
      const checkOutDateTime = `${checkOutDate} 12:00:00`;

      const db = await getDbConnection();
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        // 0. Concurrency row-level lock on room to serialize concurrent bookings and prevent race conditions
        await connection.execute("SELECT roomID, status FROM room WHERE roomID = ? FOR UPDATE", [roomID]);

        // If converting from reservation, verify and lock reservation row
        const convResID = reservationID ? parseInt(reservationID) : null;
        if (convResID) {
          const [resLock] = await connection.execute(
            "SELECT reservationID, status, guestID FROM reservation WHERE reservationID = ? FOR UPDATE",
            [convResID]
          );
          if (resLock.length === 0) {
            await connection.rollback();
            connection.release();
            return NextResponse.json({ error: "Reservation record not found." }, { status: 404 });
          }
          if (resLock[0].status === 'Booked') {
            await connection.rollback();
            connection.release();
            return NextResponse.json({
              error: "This reservation has already been converted into a booking."
            }, { status: 409 });
          }
        }

        // Check for duplicate booking for same guest, same room, and same check-in date
        const [dupCheck] = await connection.execute(
          `SELECT bookingID, status FROM booking 
           WHERE guestID = ? AND roomID = ? 
             AND status NOT IN ('Cancelled', 'Checked Out', 'No Show')
             AND DATE(checkInDateTime) = DATE(?)`,
          [guest.guestID, roomID, checkInDateTime]
        );
        if (dupCheck.length > 0) {
          await connection.rollback();
          connection.release();
          return NextResponse.json({
            error: "You already have an active booking for this room on the selected check-in date. Duplicate booking blocked."
          }, { status: 409 });
        }

        // 1. Conflict Detection: Verify room is not already booked for overlapping dates
        const [conflictingBookings] = await connection.execute(`
          SELECT bookingID
          FROM booking
          WHERE roomID = ?
            AND status NOT IN ('Cancelled', 'Checked Out', 'No Show')
            AND checkInDateTime < ?
            AND checkOutDateTime > ?
        `, [roomID, checkOutDateTime, checkInDateTime]);

        if (conflictingBookings.length > 0) {
          await connection.rollback();
          connection.release();
          return NextResponse.json({
            error: "This room is already booked by another guest for the selected dates."
          }, { status: 409 });
        }

        // 2. Conflict Handling: Auto-cancel overlapping active reservations for this room
        const convResID = reservationID ? parseInt(reservationID) : null;
        const [competingReservations] = await connection.execute(`
          SELECT r.reservationID, r.reservationDateTime, r.checkOutDateTime, r.guestID,
                 g.userID, g.firstName, g.lastName,
                 rm.roomNumber
          FROM reservation r
          JOIN room rm ON rm.roomID = r.roomID
          JOIN guest g ON g.guestID = r.guestID
          WHERE r.roomID = ?
            AND r.status IN ('Pending', 'Confirmed')
            AND (? IS NULL OR r.reservationID != ?)
            AND r.reservationDateTime < ?
            AND COALESCE(r.checkOutDateTime, DATE_ADD(r.reservationDateTime, INTERVAL 1 DAY)) > ?
        `, [roomID, convResID, convResID, checkOutDateTime, checkInDateTime]);

        for (const compRes of competingReservations) {
          await connection.execute(`
            UPDATE reservation
            SET status = 'Cancelled',
                specialRequests = CONCAT(COALESCE(specialRequests, ''), ' [Auto-cancelled: Room booked for conflicting dates]')
            WHERE reservationID = ?
          `, [compRes.reservationID]);
        }

        // Resolve breakfast option and guest counts from body or reservation
        let breakfastOption = body.breakfastOption || null;
        let resGuestCount = null;
        if (convResID) {
          const [rRows] = await connection.execute(
            "SELECT breakfastOption, guestCount FROM reservation WHERE reservationID = ?",
            [convResID]
          );
          if (rRows.length > 0) {
            if (!breakfastOption && rRows[0].breakfastOption) {
              breakfastOption = rRows[0].breakfastOption;
            }
            resGuestCount = rRows[0].guestCount;
          }
        }
        if (!breakfastOption) breakfastOption = 'without';
        const breakfastID = breakfastOption === 'with' ? 2 : 1;

        // Calculate down payment amounts and breakdown
        const downPaymentPercentage = parseInt(body.downPaymentPercentage || body.paymentOption || 50, 10);
        const downPaymentRate = downPaymentPercentage / 100;

        const [rateRows] = await connection.execute(`
          SELECT rr.rate
          FROM room r
          JOIN room_rate rr ON rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID AND rr.breakfastID = ?
          WHERE r.roomID = ?
          LIMIT 1
        `, [breakfastID, roomID]);

        const dbRate = rateRows[0]?.rate ? parseFloat(rateRows[0].rate) : 1500;
        const roomPrice = parseFloat(body.roomRate || body.pricePerNight || body.rate || dbRate);
        const dIn = new Date(checkInDate);
        const dOut = new Date(checkOutDate);
        const nights = Math.max(1, Math.round((dOut - dIn) / (1000 * 60 * 60 * 24)));

        // Extra guests fee calculation
        const [roomDataRows] = await connection.execute("SELECT occupancyLimit FROM room WHERE roomID = ?", [roomID]);
        const basePax = parseInt(roomDataRows[0]?.occupancyLimit || 4);
        const totalPax = parseInt(body.numGuests || body.guestCount || resGuestCount || (registeredGuests?.length || 1));
        const extraGuests = Math.max(0, totalPax - basePax);
        const extraGuestFee = extraGuests * 100 * nights;

        const computedTotal = (roomPrice * nights) + extraGuestFee;
        const totalAmount = parseFloat(body.totalAmount) || computedTotal;
        const downPaymentAmount = parseFloat(body.downPaymentAmount) || Math.round(totalAmount * downPaymentRate * 100) / 100;
        const remainingBalance = parseFloat(body.remainingBalance) !== undefined && !isNaN(parseFloat(body.remainingBalance))
          ? parseFloat(body.remainingBalance)
          : Math.max(0, Math.round((totalAmount - downPaymentAmount) * 100) / 100);

        let finalCheckInDateTime = checkInDateTime;
        if (body.useCurrentTime === true || body.useCurrentTimeIn === true) {
          const localNow = new Date();
          const pad = (num) => String(num).padStart(2, '0');
          finalCheckInDateTime = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;
        }
        let finalCheckOutDateTime = checkOutDateTime;
        if (body.useCurrentTimeOut === true) {
          const localNow = new Date();
          const pad = (num) => String(num).padStart(2, '0');
          finalCheckOutDateTime = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;
        }

        const isCheckedInNow = Boolean(body.useCurrentTime === true || body.useCurrentTimeIn === true);
        const bookingStatus = isCheckedInNow ? 'Active Stay' : 'Pending';
        const roomStatus = isCheckedInNow ? 'Occupied' : 'Reserved';

        // 3. Insert booking record with appropriate status and breakfastOption
        const [bookingRes] = await connection.execute(
          `INSERT INTO booking (checkInDateTime, checkOutDateTime, status, reservationID, guestID, roomID, roomRate, roomCharge, downPaymentAmount, downPaymentPercentage, remainingBalance, finalBalance, breakfastOption)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [finalCheckInDateTime, finalCheckOutDateTime, bookingStatus, convResID, guest.guestID, roomID, roomPrice, totalAmount, downPaymentAmount, downPaymentPercentage, remainingBalance, remainingBalance, breakfastOption]
        );
        const bookingID = bookingRes.insertId;

        // Update room status
        await connection.execute("UPDATE room SET status = ? WHERE roomID = ?", [roomStatus, roomID]);

        // If converted from a reservation, update that reservation status to 'Booked'
        if (convResID) {
          await connection.execute("UPDATE reservation SET status = 'Booked' WHERE reservationID = ?", [convResID]);
        }

        // Insert registered guests and fill up to totalPax
        const guestEntries = [...registeredGuests];
        while (guestEntries.length < totalPax) {
          guestEntries.push({
            fullName: `Guest ${guestEntries.length + 1}`,
            age: 30,
            discountID: null,
            discountIdNumber: null
          });
        }

        for (const g of guestEntries) {
          if (g.fullName && g.fullName.trim()) {
            await connection.execute(
              `INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber)
               VALUES (?, ?, ?, ?, ?)`,
              [bookingID, g.fullName.trim(), parseInt(g.age) || 30, g.discountID ? parseInt(g.discountID) : null, g.discountIdNumber || null]
            );
          }
        }

        // Record Early Check-In Fee if applicable
        const earlyFeeToRecord = parseFloat(body.earlyFee) || 0;
        const earlyHoursToRecord = parseInt(body.earlyHours) || 0;
        if (earlyFeeToRecord > 0) {
          const feeDesc = `Early Check-In Fee (${earlyHoursToRecord} hr(s) @ ₱50.00/hr before 2:00 PM)`;
          await connection.execute(
            "INSERT INTO incidental_charge (bookingID, description, amount) VALUES (?, ?, ?)",
            [bookingID, feeDesc, earlyFeeToRecord]
          );
        }

        // Update room status upon payment to Occupied
        await connection.execute("UPDATE room SET status = 'Occupied' WHERE roomID = ?", [roomID]);

        // Create billing record with down payment details and remaining balance
        await connection.execute(
          `INSERT INTO billing (billingDateTime, guestID, bookingID, totalAmount, downPaymentAmount, downPaymentPercentage, remainingBalance, balance) 
           VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?)`,
          [guest.guestID, bookingID, totalAmount, downPaymentAmount, downPaymentPercentage, remainingBalance, remainingBalance]
        );

        const [roomInfo] = await connection.execute(
          "SELECT rm.roomNumber, rt.type as roomType FROM room rm JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID WHERE rm.roomID = ?",
          [roomID]
        );

        await connection.commit();

        // Fast background notification batching & detached email dispatch
        (async () => {
          try {
            const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
            const notifValues = [];

            for (const r of staffToNotify) {
              notifValues.push([r.userID, 'New Guest Booking Request', `Guest ${guest.firstName} ${guest.lastName} created Booking #${bookingID} for ${checkInDate}.`]);
            }

            for (const compRes of competingReservations) {
              if (compRes.userID) {
                notifValues.push([compRes.userID, 'Reservation Cancelled Due to Conflict', `Your reservation request for Room ${compRes.roomNumber} on ${String(compRes.reservationDateTime).substring(0, 10)} was automatically cancelled because the room was booked for those dates.`]);
              }
              for (const r of staffToNotify) {
                notifValues.push([r.userID, 'Reservation Auto-Cancelled (Booking Conflict)', `Reservation #${compRes.reservationID} for Room ${compRes.roomNumber} (${compRes.firstName} ${compRes.lastName}) was automatically cancelled due to a confirmed booking conflict.`]);
              }
            }

            notifValues.push([session.userID, 'Booking Confirmed', `Your online booking #${bookingID} has been created and confirmed!`]);

            if (notifValues.length > 0) {
              const placeholders = notifValues.map(() => '(?, ?, ?)').join(', ');
              const flatValues = notifValues.flat();
              await dbQuery(`INSERT INTO notification (userID, title, message) VALUES ${placeholders}`, flatValues);
            }

            // Dispatch Booking Confirmation Email detached
            sendBookingConfirmationEmail(guest.email, `${guest.firstName} ${guest.lastName}`, {
              bookingID,
              roomNumber: roomInfo[0]?.roomNumber || '',
              roomType: roomInfo[0]?.roomType || 'Standard',
              status: bookingStatus,
              checkInDateTime: finalCheckInDateTime,
              checkOutDateTime: finalCheckOutDateTime,
              downPaymentAmount,
              remainingBalance,
              paymentMethod: 'GCash',
              referenceNumber: body.referenceNumber || null
            }).catch((mErr) => {
              console.error("Failed to send guest booking confirmation email:", mErr);
            });
          } catch (bgErr) {
            console.error("Background notification batching error:", bgErr);
          }
        })();

        return NextResponse.json({
          success: true,
          status: 'Confirmed',
          message: 'Booking confirmed successfully.',
          bookingID
        });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process guest booking:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
