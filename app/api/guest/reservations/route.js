import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncRoomStatuses, logBillingAudit, syncNormalizedBillingLineItems, ensureBookingBreakfastSchema } from '@/lib/db';
import { validateReservationDate } from '@/lib/validation';
import { getStayNights } from '@/lib/dateUtils';

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    await syncRoomStatuses();

    const guests = await dbQuery("SELECT guestID FROM guest WHERE userID = ?", [session.userID]);
    const guestID = guests.length > 0 ? guests[0].guestID : 0;

    // Fetch guest reservations if guest profile exists
    const reservations = guestID > 0 ? await dbQuery(`
      SELECT r.reservationID, r.reservationDateTime, r.checkOutDateTime,
             r.isCourtesyHold, r.holdDurationHours, r.holdExpiryDateTime,
             r.warning12SentAt, r.warning6SentAt, r.releasedAt,
             r.guestCount, r.specialRequests, r.breakfastOption, r.breakfastDates, r.breakfastFee,
             CASE 
               WHEN r.status IN ('On Hold', 'Courtesy Hold') AND (r.holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(r.holdExpiryDateTime, INTERVAL 30 MINUTE)) THEN 'On Hold'
               WHEN r.status IN ('On Hold', 'Courtesy Hold') AND NOW() > DATE_ADD(r.holdExpiryDateTime, INTERVAL 30 MINUTE) THEN 'Cancelled'
               WHEN r.status IN ('Confirmed', 'Booked') THEN 'Booked'
               WHEN r.status IN ('Cancelled', 'Canceled', 'Released') THEN 'Cancelled'
               ELSE 'Reserved'
             END as status,
             r.roomID,
             rm.roomNumber, rm.floorID, rt.type as roomType, fl.name as floor,
             rr.rate as rate
      FROM reservation r
      JOIN room rm ON rm.roomID = r.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      JOIN floor fl ON fl.floorID = rm.floorID
      LEFT JOIN room_rate rr ON rr.roomTypeID = rm.roomTypeID 
                            AND rr.floorID = rm.floorID 
                            AND rr.breakfastID = (CASE WHEN r.breakfastOption LIKE '%with%' AND r.breakfastOption NOT LIKE '%without%' THEN 2 ELSE 1 END)
      WHERE r.guestID = ?
      ORDER BY r.reservationDateTime DESC
    `, [guestID]) : [];

    // Fetch ALL active rooms in pension house created by admin
    const allRooms = await dbQuery(`
      SELECT r.roomID, r.roomNumber, r.floorID, r.status, r.occupancyLimit, r.image, r.description,
             r.breakfastRate,
             COALESCE(rt.type, 'Standard Room') as roomType,
             COALESCE(fl.name, 'Ground Floor') as floorName,
             (
               SELECT rr1.rate
               FROM room_rate rr1
               WHERE rr1.roomTypeID = r.roomTypeID AND rr1.floorID = r.floorID AND rr1.breakfastID = 1
               LIMIT 1
             ) as rate,
             (
               SELECT rr1.rate
               FROM room_rate rr1
               WHERE rr1.roomTypeID = r.roomTypeID AND rr1.floorID = r.floorID AND rr1.breakfastID = 1
               LIMIT 1
             ) as rateWithoutBreakfast,
             (
               SELECT rr2.rate
               FROM room_rate rr2
               WHERE rr2.roomTypeID = r.roomTypeID AND rr2.floorID = r.floorID AND rr2.breakfastID = 2
               LIMIT 1
             ) as rateWithBreakfast
      FROM room r
      LEFT JOIN room_type rt ON rt.roomTypeID = r.roomTypeID
      LEFT JOIN floor fl ON fl.floorID = r.floorID
      WHERE r.isArchived = 0
      ORDER BY r.floorID ASC, r.roomNumber ASC
    `);

    const availableRooms = allRooms.filter(r => r.status === 'Available');

    // Fetch all active room schedules (bookings & reservations) to allow client-side conflict avoidance & slot grey-out
    const activeBookings = await dbQuery(`
      SELECT bookingID, roomID, checkInDateTime, checkOutDateTime, status, 'booking' as type
      FROM booking
      WHERE status NOT IN ('Cancelled', 'Checked Out', 'No Show')
        AND checkOutDateTime >= CURDATE()
    `);

    const activeReservations = await dbQuery(`
      SELECT reservationID, roomID, reservationDateTime as checkInDateTime,
             COALESCE(checkOutDateTime, DATE_ADD(reservationDateTime, INTERVAL 1 DAY)) as checkOutDateTime,
             status, 'reservation' as type, isCourtesyHold
      FROM reservation
      WHERE status NOT IN ('Cancelled', 'Canceled', 'Checked Out', 'No Show', 'Released')
        AND (
          reservationDateTime >= CURDATE()
          OR (status IN ('On Hold', 'Courtesy Hold') AND (holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(holdExpiryDateTime, INTERVAL 30 MINUTE)))
        )
    `);

    const roomSchedules = [...activeBookings, ...activeReservations];

    return NextResponse.json({ success: true, reservations, allRooms, availableRooms, roomSchedules });
  } catch (error) {
    console.error("Failed to fetch guest reservations:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    const guests = await dbQuery("SELECT guestID, firstName, lastName, email FROM guest WHERE userID = ?", [session.userID]);
    if (guests.length === 0) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }
    const guest = guests[0];

    if (action === 'cancel') {
      const reservationID = parseInt(body.reservationID);
      if (!reservationID) {
        return NextResponse.json({ error: 'Reservation ID is required.' }, { status: 400 });
      }

      const resList = await dbQuery("SELECT * FROM reservation WHERE reservationID = ? AND guestID = ?", [reservationID, guest.guestID]);
      if (resList.length === 0) {
        return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
      }
      const targetRes = resList[0];

      await dbQuery(
        "UPDATE reservation SET status = 'Cancelled' WHERE reservationID = ? AND guestID = ?",
        [reservationID, guest.guestID]
      );

      await syncRoomStatuses(true);

      const isHold = targetRes.status === 'Courtesy Hold';
      const cancelTitle = isHold ? 'Courtesy Hold Cancelled' : 'Reservation Canceled';
      const cancelMsg = isHold
        ? `Guest ${guest.firstName} ${guest.lastName} has cancelled the courtesy hold on Room #${targetRes.roomID}.`
        : `Guest ${guest.firstName} ${guest.lastName} has canceled Reservation #${reservationID}.`;

      // Notify receptionists (Admin does not receive reservations)
      const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID = 2 AND status = 'Active'");
      for (const r of staffToNotify) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, ?, ?)",
          [r.userID, cancelTitle, cancelMsg]
        );
      }

      return NextResponse.json({
        success: true,
        message: isHold ? 'Courtesy hold cancelled successfully.' : 'Reservation request canceled successfully.'
      });
    }

    // Default action: Create reservation
    const { roomID, checkInDate, checkOutDate, specialRequests, numGuests } = body; // checkInDate is YYYY-MM-DD
    let breakfastOption = body.breakfastOption || null;

    if (!roomID || !checkInDate) {
      return NextResponse.json({ error: 'Room selection and Check-in date are required.' }, { status: 400 });
    }

    if (checkOutDate) {
      const checkInD = new Date(checkInDate + 'T14:00:00');
      const checkOutD = new Date(checkOutDate + 'T12:00:00');
      if (checkInD < new Date()) {
        return NextResponse.json({
          error: "Reservation or booking has already passed."
        }, { status: 400 });
      }
      if (checkOutD <= checkInD) {
        return NextResponse.json({
          error: "Check-out time must be later than check-in time."
        }, { status: 400 });
      }
    }

    // Rule 1A: Reservation Date Restrictions (Check-in must be at least 2 days ahead)
    if (!validateReservationDate(checkInDate)) {
      return NextResponse.json({
        error: "Reservation date must be at least 2 days ahead."
      }, { status: 400 });
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');

    // All reservations are Courtesy Holds (fixed 48h duration + 30m grace period)
    const isCourtesyHold = true;
    const holdDurationHours = 48;
    const holdExpiryDateObj = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const holdExpiryDateTime = `${holdExpiryDateObj.getFullYear()}-${pad(holdExpiryDateObj.getMonth() + 1)}-${pad(holdExpiryDateObj.getDate())} ${pad(holdExpiryDateObj.getHours())}:${pad(holdExpiryDateObj.getMinutes())}:${pad(holdExpiryDateObj.getSeconds())}`;
    const resStatus = 'On Hold';

    // Rule 1C: Duplicate Reservation / Hold Validation
    const dupRes = await dbQuery(`
      SELECT reservationID FROM reservation 
      WHERE guestID = ? AND roomID = ? 
        AND (
          status IN ('Pending', 'Reserved', 'Confirmed', 'Booked')
          OR (status IN ('On Hold', 'Courtesy Hold') AND (holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(holdExpiryDateTime, INTERVAL 30 MINUTE)))
        )
    `, [guest.guestID, roomID]);

    if (dupRes.length > 0) {
      return NextResponse.json({
        error: isCourtesyHold
          ? "You already have an active reservation or courtesy hold for this room."
          : "You already have an active booking for this room."
      }, { status: 400 });
    }

    // Conflict Detection: check overlapping active bookings or reservations
    const inTimeOnly = (body.useCurrentTime || body.useCurrentTimeIn)
      ? `${pad(now.getHours())}:${pad(now.getMinutes())}:00`
      : (body.checkInTime ? (body.checkInTime.length === 5 ? `${body.checkInTime}:00` : body.checkInTime) : '14:00:00');
    const outTimeOnly = (body.useCurrentTimeOut)
      ? `${pad(now.getHours())}:${pad(now.getMinutes())}:00`
      : (body.checkOutTime ? (body.checkOutTime.length === 5 ? `${body.checkOutTime}:00` : body.checkOutTime) : '12:00:00');

    const checkInD = new Date(`${checkInDate}T${inTimeOnly}`);
    let checkOutD;
    if (checkOutDate) {
      checkOutD = new Date(`${checkOutDate}T${outTimeOnly}`);
    } else {
      checkOutD = new Date(checkInD.getTime() + 24 * 60 * 60 * 1000);
      checkOutD.setHours(12, 0, 0, 0);
    }
    const checkOutDateTimeFormatted = checkOutDate ? `${checkOutDate} ${outTimeOnly}` : null;
    const reqCheckOutSql = `${checkOutD.getFullYear()}-${pad(checkOutD.getMonth() + 1)}-${pad(checkOutD.getDate())} ${outTimeOnly}`;
    const reservationDateTime = `${checkInDate} ${inTimeOnly}`;

    const conflictingBookings = await dbQuery(`
      SELECT bookingID, checkInDateTime, checkOutDateTime
      FROM booking
      WHERE roomID = ?
        AND status NOT IN ('Cancelled', 'Checked Out', 'No Show')
        AND checkInDateTime < ?
        AND checkOutDateTime > ?
    `, [roomID, reqCheckOutSql, reservationDateTime]);

    if (conflictingBookings.length > 0) {
      return NextResponse.json({
        error: "This room is already booked for the selected dates. Please choose another date or room."
      }, { status: 409 });
    }

    const conflictingReservations = await dbQuery(`
      SELECT reservationID, reservationDateTime, checkOutDateTime, status
      FROM reservation
      WHERE roomID = ?
        AND (
          (status IN ('Pending', 'Reserved', 'Confirmed', 'Booked') AND reservationDateTime < ? AND COALESCE(checkOutDateTime, DATE_ADD(reservationDateTime, INTERVAL 1 DAY)) > ?)
          OR
          (status IN ('On Hold', 'Courtesy Hold') AND (holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(holdExpiryDateTime, INTERVAL 30 MINUTE)) AND reservationDateTime < ? AND COALESCE(checkOutDateTime, DATE_ADD(reservationDateTime, INTERVAL 1 DAY)) > ?)
        )
    `, [roomID, reqCheckOutSql, reservationDateTime, reqCheckOutSql, reservationDateTime]);

    if (conflictingReservations.length > 0) {
      return NextResponse.json({
        error: "This room already has an active reservation or courtesy hold for the selected dates. Please choose another date or room."
      }, { status: 409 });
    }

    const roomRes = await dbQuery(
      "SELECT r.roomNumber, rt.type as roomType FROM room r JOIN room_type rt ON rt.roomTypeID = r.roomTypeID WHERE r.roomID = ?",
      [roomID]
    );
    const roomInfo = roomRes[0] || { roomNumber: 'N/A', roomType: 'Room' };

    const stayNights = getStayNights(reservationDateTime.split(' ')[0], checkOutDateTimeFormatted.split(' ')[0]);
    const DEFAULT_BREAKFAST_RATE = 250;
    const [roomBreakfastRow] = await dbQuery(`
      SELECT r.breakfastRate,
        (SELECT (rr2.rate - rr1.rate)
         FROM room_rate rr1
         JOIN room_rate rr2 ON rr2.roomTypeID = r.roomTypeID AND rr2.floorID = r.floorID AND rr2.breakfastID = 2
         WHERE rr1.roomTypeID = r.roomTypeID AND rr1.floorID = r.floorID AND rr1.breakfastID = 1
         LIMIT 1) as rateDiff
      FROM room r
      WHERE r.roomID = ?
    `, [roomID]);

    let resolvedBfastRate = DEFAULT_BREAKFAST_RATE;
    if (body.breakfastRate !== undefined && body.breakfastRate !== null && !isNaN(parseFloat(body.breakfastRate))) {
      resolvedBfastRate = parseFloat(body.breakfastRate);
    } else if (roomBreakfastRow?.breakfastRate !== null && roomBreakfastRow?.breakfastRate !== undefined) {
      resolvedBfastRate = parseFloat(roomBreakfastRow.breakfastRate);
    } else if (roomBreakfastRow?.rateDiff !== null && roomBreakfastRow?.rateDiff !== undefined && parseFloat(roomBreakfastRow.rateDiff) > 0) {
      resolvedBfastRate = parseFloat(roomBreakfastRow.rateDiff);
    }

    let selectedBreakfastDates = body.selectedBreakfastDates;
    const includeBreakfast = Boolean(body.includeBreakfast);

    // Backward compatibility fallback
    if (!Array.isArray(selectedBreakfastDates)) {
      if (includeBreakfast || breakfastOption === 'with') {
        selectedBreakfastDates = stayNights.map(n => n.dateStr);
        breakfastOption = 'with';
      } else {
        selectedBreakfastDates = [];
      }
    }

    const validBreakfastDates = selectedBreakfastDates.filter(d =>
      stayNights.some(n => n.dateStr === d)
    );

    if (validBreakfastDates.length > 0) {
      breakfastOption = 'with';
    } else if (!breakfastOption) {
      breakfastOption = 'without';
    }
    const breakfastTotal = validBreakfastDates.length * resolvedBfastRate;

    // Zero billing record generated for courtesy holds / confirmed booking records
    const insertRes = await dbQuery(
      `INSERT INTO reservation (
        reservationDateTime, checkOutDateTime, guestCount, specialRequests, status,
        guestID, roomID, isCourtesyHold, holdDurationHours, holdExpiryDateTime, guestEmail, breakfastOption, breakfastDates, breakfastFee
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reservationDateTime,
        checkOutDateTimeFormatted,
        parseInt(numGuests || 1),
        specialRequests || null,
        resStatus,
        guest.guestID,
        roomID,
        isCourtesyHold ? 1 : 0,
        isCourtesyHold ? holdDurationHours : null,
        holdExpiryDateTime,
        guest.email || null,
        breakfastOption,
        JSON.stringify(validBreakfastDates),
        breakfastTotal
      ]
    );

    // If Courtesy Hold: set room status to 'Reserved' immediately
    await dbQuery("UPDATE room SET status = 'Reserved' WHERE roomID = ?", [roomID]);

    // Add user notification
    const holdExpiryStr = holdExpiryDateObj ? holdExpiryDateObj.toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : '';
    await dbQuery(
      "INSERT INTO notification (userID, title, message) VALUES (?, 'Courtesy Hold Placed', ?)",
      [
        session.userID,
        `Your courtesy hold on Room ${roomInfo.roomNumber} (${roomInfo.roomType}) is active for 48 hours until ${holdExpiryStr}. Please confirm with payment before it expires.`
      ]
    );

    // Notify active receptionists (Admin does not receive reservations)
    const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID = 2 AND status = 'Active'");
    for (const r of staffToNotify) {
      await dbQuery(
        "INSERT INTO notification (userID, title, message) VALUES (?, 'New Courtesy Hold', ?)",
        [
          r.userID,
          `Guest ${guest.firstName} ${guest.lastName} placed a 48-hour Courtesy Hold on Room ${roomInfo.roomNumber}.`
        ]
      );
    }

    return NextResponse.json({
      success: true,
      status: 'Courtesy Hold',
      message: 'Reservation placed on courtesy hold.',
      reservationID: insertRes.insertId,
      summary: {
        reservationID: insertRes.insertId,
        roomNumber: roomInfo.roomNumber,
        roomType: roomInfo.roomType,
        checkInDate,
        checkOutDate: checkOutDate || 'Standard 12:00 PM',
        specialRequests: specialRequests || 'None',
        numGuests: numGuests || 1,
        breakfastOption: breakfastOption || 'with',
        status: 'Courtesy Hold',
        isCourtesyHold: true,
        holdDurationHours: 48,
        holdExpiryDateTime
      }
    });
  } catch (error) {
    console.error("Failed to process guest reservation:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const reservationID = parseInt(body.reservationID || body.id);

    if (!reservationID || isNaN(reservationID)) {
      return NextResponse.json({ error: 'Valid reservation ID is required.' }, { status: 400 });
    }

    const [guestProfile] = await dbQuery("SELECT guestID, firstName, lastName FROM guest WHERE userID = ?", [session.userID]);
    if (!guestProfile) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }
    const guestID = guestProfile.guestID;

    const [reservation] = await dbQuery(`
      SELECT r.*, rm.roomNumber, rm.status as currentRoomStatus, rm.isArchived, rm.occupancyLimit,
             rr1.rate as rateWithoutBreakfast,
             rr2.rate as rateWithBreakfast
      FROM reservation r
      JOIN room rm ON rm.roomID = r.roomID
      LEFT JOIN room_rate rr1 ON rr1.roomTypeID = rm.roomTypeID AND rr1.floorID = rm.floorID AND rr1.breakfastID = 1
      LEFT JOIN room_rate rr2 ON rr2.roomTypeID = rm.roomTypeID AND rr2.floorID = rm.floorID AND rr2.breakfastID = 2
      WHERE r.reservationID = ? AND r.guestID = ?
    `, [reservationID, guestID]);

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found or access denied.' }, { status: 404 });
    }

    if (!['Pending', 'Confirmed', 'Courtesy Hold'].includes(reservation.status)) {
      return NextResponse.json({
        error: `Cannot convert reservation because its current status is "${reservation.status}".`
      }, { status: 400 });
    }

    if (reservation.status === 'Courtesy Hold' && reservation.holdExpiryDateTime) {
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

    const checkInDateTime = body.checkInDateTime || reservation.reservationDateTime;
    const checkOutDateTime = body.checkOutDateTime || reservation.checkOutDateTime || new Date(new Date(checkInDateTime).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    // Conflict detection
    const conflictingBookings = await dbQuery(`
      SELECT bookingID, status
      FROM booking
      WHERE roomID = ?
        AND status NOT IN ('Cancelled', 'Canceled', 'Checked Out', 'No Show', 'Completed')
        AND checkInDateTime < ?
        AND checkOutDateTime > ?
      LIMIT 1
    `, [reservation.roomID, checkOutDateTime, checkInDateTime]);

    if (conflictingBookings.length > 0) {
      return NextResponse.json({
        error: `Room ${reservation.roomNumber} has a schedule conflict with an active booking for these dates.`
      }, { status: 400 });
    }

    // Rate, nights & extra guest fee
    const dIn = new Date(checkInDateTime.replace(' ', 'T'));
    const dOut = new Date(checkOutDateTime.replace(' ', 'T'));
    const nights = Math.max(1, Math.round((dOut - dIn) / (1000 * 60 * 60 * 24)));
    const isWithBreakfast = (body.breakfastOption || reservation.breakfastOption || 'with') === 'with';
    const breakfastOption = isWithBreakfast ? 'With Breakfast' : 'Without Breakfast';
    const breakfastID = isWithBreakfast ? 2 : 1;
    const roomRate = isWithBreakfast ? parseFloat(reservation.rateWithBreakfast || 0) : parseFloat(reservation.rateWithoutBreakfast || 0);
    const roomBasePax = Math.max(1, parseInt(reservation.occupancyLimit || 4, 10));
    const totalGuests = parseInt(body.numGuests || reservation.guestCount || 1);
    const extraGuests = Math.max(0, totalGuests - roomBasePax);
    const baseRoomCharge = Math.round(roomRate * nights * 100) / 100;
    const totalAmount = baseRoomCharge + extraGuestFee;
    const downPaymentPercentage = parseInt(body.downPaymentPercentage || 50, 10);
    const downPaymentAmount = Math.round(baseRoomCharge * (downPaymentPercentage / 100) * 100) / 100;
    const remainingBalance = Math.max(0, Math.round((totalAmount - downPaymentAmount) * 100) / 100);

    const pool = await getDbConnection();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Update reservation status to 'Booked'
      await conn.execute(
        "UPDATE reservation SET status = 'Booked' WHERE reservationID = ?",
        [reservationID]
      );

      // 2. Create pending booking record linked to reservationID
      const [insertBookingRes] = await conn.execute(
        `INSERT INTO booking (checkInDateTime, checkOutDateTime, status, reservationID, guestID, roomID, roomRate, roomCharge, downPaymentAmount, downPaymentPercentage, remainingBalance, finalBalance, breakfastOption, breakfastID, guestCount)
         VALUES (?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [checkInDateTime, checkOutDateTime, reservationID, guestID, reservation.roomID, roomRate, totalAmount, downPaymentAmount, downPaymentPercentage, remainingBalance, remainingBalance, breakfastOption, breakfastID, totalGuests]
      );
      const bookingID = insertBookingRes.insertId;

      // 3. Register primary guest
      const primaryGuestName = `${guestProfile.firstName || ''} ${guestProfile.lastName || ''}`.trim() || 'Primary Guest';
      await conn.execute(
        `INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber)
         VALUES (?, ?, 30, NULL, NULL)`,
        [bookingID, primaryGuestName]
      );

      // 4. Create billing record
      const [billingInsert] = await conn.execute(
        `INSERT INTO billing (billingDateTime, guestID, bookingID, totalAmount, downPaymentAmount, downPaymentPercentage, remainingBalance, balance)
         VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?)`,
        [guestID, bookingID, totalAmount, downPaymentAmount, downPaymentPercentage, remainingBalance, remainingBalance]
      );
      const billingID = billingInsert.insertId;

      await syncNormalizedBillingLineItems(bookingID, billingID, conn);

      // 5. If payment info provided (GCash reference), record payment
      const paymentRef = body.referenceNumber || `GCASH-CONV-${reservationID}`;
      const [paymentInsert] = await conn.execute(
        `INSERT INTO payment (amount, cashReceived, \`change\`, billingID, guestID, staffID, paymentMethodID, status, referenceNumber, testMode)
         VALUES (?, ?, 0, ?, ?, NULL, 2, 'Settled', ?, 1)`,
        [downPaymentAmount, downPaymentAmount, billingID, guestID, paymentRef]
      );
      const paymentID = paymentInsert.insertId;

      await conn.execute(
        "INSERT INTO transactions (transactionDateTime, billingID, paymentID, testMode) VALUES (NOW(), ?, ?, 1)",
        [billingID, paymentID]
      );

      // 6. Update room status to Reserved
      await conn.execute(
        "UPDATE room SET status = 'Reserved' WHERE roomID = ?",
        [reservation.roomID]
      );

      // 7. Auto-cancel conflicting unconfirmed reservations
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
      }

      await conn.commit();

      return NextResponse.json({
        success: true,
        bookingID,
        message: `Reservation #${reservationID} successfully converted into Booking #${bookingID}!`
      });
    } catch (txnError) {
      await conn.rollback();
      throw txnError;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Error converting reservation in PATCH:", error);
    return NextResponse.json({ error: error.message || 'Failed to convert reservation to booking.' }, { status: 500 });
  }
}
