import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDbConnection, dbQuery, logBillingAudit, syncNormalizedBillingLineItems } from '@/lib/db';

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const reservationID = parseInt(body.reservationID);

    if (!reservationID || isNaN(reservationID)) {
      return NextResponse.json({ error: 'Valid reservation ID is required.' }, { status: 400 });
    }

    // 1. Resolve guest record for logged in user
    const [guestProfile] = await dbQuery("SELECT guestID, firstName, lastName FROM guest WHERE userID = ?", [session.userID]);
    if (!guestProfile) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }
    const guestID = guestProfile.guestID;

    // 2. Fetch reservation and verify ownership
    const [reservation] = await dbQuery(`
      SELECT r.*, rm.roomNumber, rm.status as currentRoomStatus, rm.isArchived
      FROM reservation r
      JOIN room rm ON rm.roomID = r.roomID
      WHERE r.reservationID = ? AND r.guestID = ?
    `, [reservationID, guestID]);

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found or access denied.' }, { status: 404 });
    }

    if (!['Pending', 'Reserved', 'Confirmed', 'Courtesy Hold', 'On Hold'].includes(reservation.status)) {
      return NextResponse.json({
        error: `Cannot convert reservation because its current status is "${reservation.status}".`
      }, { status: 400 });
    }

    if (['Courtesy Hold', 'On Hold'].includes(reservation.status) && reservation.holdExpiryDateTime) {
      const expiryWithGrace = new Date(new Date(reservation.holdExpiryDateTime).getTime() + 30 * 60 * 1000);
      if (new Date() > expiryWithGrace) {
        return NextResponse.json({
          error: 'This courtesy hold has expired and cannot be converted to a booking.'
        }, { status: 400 });
      }
    }

    if (reservation.isArchived || reservation.currentRoomStatus === 'Under Maintenance') {
      return NextResponse.json({
        error: `Room ${reservation.roomNumber} is currently unavailable for booking.`
      }, { status: 400 });
    }

    const checkInDateTime = reservation.reservationDateTime;
    const checkOutDateTime = reservation.checkOutDateTime || new Date(new Date(checkInDateTime).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    // 3. Check for conflicting active bookings on this room
    const conflictingBookings = await dbQuery(`
      SELECT bookingID, status
      FROM booking
      WHERE roomID = ?
        AND status IN ('Confirmed', 'Checked In', 'Pending Check-in', 'Late Checkout')
        AND checkInDateTime < ?
        AND checkOutDateTime > ?
      LIMIT 1
    `, [reservation.roomID, checkOutDateTime, checkInDateTime]);

    if (conflictingBookings.length > 0) {
      return NextResponse.json({
        error: `Room ${reservation.roomNumber} has a schedule conflict with an active booking for these dates.`
      }, { status: 400 });
    }

    // 4. Perform atomic conversion transaction
    const pool = await getDbConnection();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Lock room record
      await conn.execute("SELECT roomID FROM room WHERE roomID = ? FOR UPDATE", [reservation.roomID]);

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

      // A. Update reservation status to Booked
      await conn.execute(
        "UPDATE reservation SET status = 'Booked' WHERE reservationID = ?",
        [reservationID]
      );

      // Resolve breakfast tier and room rate dynamically from database
      const rawBreakfastOption = reservation.breakfastOption || 'without';
      const hasBreakfast = (rawBreakfastOption && rawBreakfastOption.toLowerCase().includes('with') && !rawBreakfastOption.toLowerCase().includes('without'));
      const breakfastID = hasBreakfast ? 2 : 1;
      const breakfastOption = hasBreakfast ? 'with' : 'without';

      const [rateRows] = await conn.execute(`
        SELECT rr.rate
        FROM room r
        JOIN room_rate rr ON rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID AND rr.breakfastID = ?
        WHERE r.roomID = ?
        LIMIT 1
      `, [breakfastID, reservation.roomID]);
      
      let roomPrice = 0;
      if (rateRows && rateRows.length > 0 && rateRows[0]?.rate != null) {
        roomPrice = parseFloat(rateRows[0].rate);
      } else {
        const [defRate] = await conn.execute(`
          SELECT rr.rate
          FROM room r
          JOIN room_rate rr ON rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID
          WHERE r.roomID = ?
          ORDER BY rr.rate ASC
          LIMIT 1
        `, [reservation.roomID]);
        roomPrice = defRate[0]?.rate ? parseFloat(defRate[0].rate) : 0;
      }

      const dIn = new Date(checkInDateTime);
      const dOut = new Date(checkOutDateTime);
      const nights = Math.max(1, Math.round((dOut - dIn) / (1000 * 60 * 60 * 24)));

      const [roomDataRows] = await conn.execute("SELECT occupancyLimit FROM room WHERE roomID = ?", [reservation.roomID]);
      const basePax = parseInt(roomDataRows[0]?.occupancyLimit || 4);
      const totalPax = parseInt(reservation.guestCount || 1);
      const extraGuests = Math.max(0, totalPax - basePax);
      const extraGuestFee = extraGuests * 100 * nights;
      const baseRoomCharge = roomPrice * nights;
      const totalCharge = baseRoomCharge + extraGuestFee;

      // B. Create pending booking record with accurate pricing, guestCount, and breakfast selection
      const [insertBookingRes] = await conn.execute(
        `INSERT INTO booking (checkInDateTime, checkOutDateTime, status, reservationID, guestID, roomID, roomRate, roomCharge, remainingBalance, finalBalance, breakfastOption, breakfastID, guestCount, breakfastDates, breakfastFee)
         VALUES (?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [checkInDateTime, checkOutDateTime, reservationID, guestID, reservation.roomID, roomPrice, baseRoomCharge, totalCharge, totalCharge, breakfastOption, breakfastID, totalPax, reservation.breakfastDates || null, reservation.breakfastFee || 0]
      );
      const bookingID = insertBookingRes.insertId;

      // C. Register guests in booking details up to totalPax
      const primaryGuestName = `${guestProfile.firstName || ''} ${guestProfile.lastName || ''}`.trim() || 'Primary Guest';
      await conn.execute(
        `INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber)
         VALUES (?, ?, 30, NULL, NULL)`,
        [bookingID, primaryGuestName]
      );

      for (let gIdx = 2; gIdx <= totalPax; gIdx++) {
        await conn.execute(
          `INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber)
           VALUES (?, ?, 30, NULL, NULL)`,
          [bookingID, `Guest ${gIdx}`]
        );
      }

      // D. Create billing record for this booking with accurate charges
      const [billingInsert] = await conn.execute(
        `INSERT INTO billing (billingDateTime, guestID, bookingID, totalAmount, remainingBalance, balance) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [nowStr, guestID, bookingID, totalCharge, totalCharge, totalCharge]
      );
      const billingID = billingInsert.insertId;

      await syncNormalizedBillingLineItems(conn, billingID, bookingID);

      // E. Update room status to Reserved
      await conn.execute(
        "UPDATE room SET status = 'Reserved' WHERE roomID = ?",
        [reservation.roomID]
      );

      // F. Auto-cancel conflicting unconfirmed reservations for this room and date range
      const [conflicts] = await conn.execute(
        `SELECT r.reservationID, r.guestID, g.userID, rm.roomNumber
         FROM reservation r
         JOIN guest g ON g.guestID = r.guestID
         JOIN room rm ON rm.roomID = r.roomID
         WHERE r.roomID = ?
           AND r.reservationID != ?
           AND r.status IN ('Pending', 'Confirmed', 'Courtesy Hold')
           AND r.reservationDateTime < ?
           AND COALESCE(r.checkOutDateTime, DATE_ADD(r.reservationDateTime, INTERVAL 1 DAY)) > ?`,
        [reservation.roomID, reservationID, checkOutDateTime, checkInDateTime]
      );

      for (const c of conflicts) {
        await conn.execute(
          "UPDATE reservation SET status = 'Cancelled' WHERE reservationID = ?",
          [c.reservationID]
        );

        if (c.userID) {
          await conn.execute(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Reservation Cancelled Due to Booking', ?)",
            [
              c.userID,
              `Your reservation #${c.reservationID} for Room ${c.roomNumber} has been automatically cancelled as the room was officially booked.`
            ]
          );
        }
      }

      // G. Notify receptionist and admin staff
      const [staffUsers] = await conn.execute(
        "SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'"
      );
      for (const staff of staffUsers) {
        await conn.execute(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Reservation Converted to Booking', ?)",
          [
            staff.userID,
            `Guest ${primaryGuestName} converted Reservation #${reservationID} into Booking #${bookingID} for Room ${reservation.roomNumber}.`
          ]
        );
      }

      // H. Log to billing audit
      await logBillingAudit(conn, {
        billingID,
        bookingID,
        transactionType: 'Reservation Converted to Booking',
        status: 'Settled',
        amount: 0,
        balanceBefore: 0,
        balanceAfter: 0,
        userID: session.userID,
        userName: primaryGuestName,
        userRole: 'Guest',
        description: `Guest converted Reservation #${reservationID} to Booking #${bookingID} for Room ${reservation.roomNumber}.`
      });

      await conn.commit();

      return NextResponse.json({
        success: true,
        bookingID,
        message: `Reservation successfully converted into Booking #${bookingID}!`
      });
    } catch (txnError) {
      await conn.rollback();
      throw txnError;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Error converting guest reservation to booking:", error);
    return NextResponse.json({ error: error.message || 'Failed to convert reservation to booking.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  return POST(request);
}
