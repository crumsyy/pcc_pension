import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncRoomStatuses, logBillingAudit, syncNormalizedBillingLineItems, ensureBookingBreakfastSchema } from '@/lib/db';
import { sendCourtesyHoldCreatedEmail, sendBookingConfirmationEmail } from '@/lib/mailer';
import { getStayNights } from '@/lib/dateUtils';
import { validateReservationDate } from '@/lib/validation';
import { calculateBillingTotals } from '@/lib/billingCalculator';

function checkReservationLeadTime(checkInDateStr) {
  if (!checkInDateStr) return { valid: true };
  if (!validateReservationDate(checkInDateStr)) {
    return {
      valid: false,
      message: "Reservation date must be at least 2 days ahead."
    };
  }
  return { valid: true };
}

async function checkActiveReservationOrBooking(guestID, currentReservationID = null) {
  let resSql = "SELECT reservationID FROM reservation WHERE guestID = ? AND status IN ('Pending', 'Confirmed', 'Booked')";
  const resParams = [guestID];
  if (currentReservationID) {
    resSql += " AND reservationID != ?";
    resParams.push(currentReservationID);
  }
  // Allow guests/receptionists to reserve multiple rooms for the same guest
  return { valid: true };
}

async function checkDuplicateRoomReservation(guestID, roomID, currentReservationID = null) {
  let sql = `SELECT reservationID FROM reservation 
             WHERE guestID = ? AND roomID = ? 
               AND (
                 status IN ('Pending', 'Confirmed', 'Booked')
                 OR (status = 'Courtesy Hold' AND (holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(holdExpiryDateTime, INTERVAL 30 MINUTE)))
               )`;
  const params = [guestID, roomID];
  if (currentReservationID) {
    sql += " AND reservationID != ?";
    params.push(currentReservationID);
  }
  const duplicates = await dbQuery(sql, params);
  if (duplicates.length > 0) {
    return {
      valid: false,
      message: "You already have an active reservation or courtesy hold for this room."
    };
  }
  return { valid: true };
}

async function resolveReservationConflicts(conn, confirmedRoomID, confirmedReservationID) {
  const [conflicts] = await conn.execute(
    "SELECT r.reservationID, r.guestID, g.userID, rm.roomNumber FROM reservation r JOIN guest g ON g.guestID = r.guestID JOIN room rm ON rm.roomID = r.roomID WHERE r.roomID = ? AND r.reservationID != ? AND r.status IN ('Pending', 'Confirmed', 'Booked', 'Courtesy Hold')",
    [confirmedRoomID, confirmedReservationID]
  );

  for (const c of conflicts) {
    await conn.execute("UPDATE reservation SET status = 'Cancelled' WHERE reservationID = ?", [c.reservationID]);

    if (c.userID) {
      await conn.execute(
        "INSERT INTO notification (userID, title, message) VALUES (?, 'Reservation Cancelled', ?)",
        [
          c.userID,
          "Unfortunately, your reserved room has already been confirmed by another guest. Your reservation has been automatically cancelled. Please choose another available room."
        ]
      );
    }

    const [staffList] = await conn.execute("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
    for (const s of staffList) {
      await conn.execute(
        "INSERT INTO notification (userID, title, message) VALUES (?, 'Reservation Conflict Cancelled', ?)",
        [
          s.userID,
          `Reservation #${c.reservationID} for Room ${c.roomNumber} was automatically cancelled due to booking confirmation by another guest.`
        ]
      );
    }
  }
}

export async function GET(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await syncRoomStatuses();

  try {
    const [reservations, guests, rooms, paymentMethods, discounts, activeBookings, activeReservations] = await Promise.all([
      dbQuery(`
        SELECT r.reservationID, DATE_FORMAT(r.reservationDateTime, '%Y-%m-%dT%H:%i:%s') as reservationDateTime,
               DATE_FORMAT(r.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime,
               r.isCourtesyHold, r.holdDurationHours,
               DATE_FORMAT(r.holdExpiryDateTime, '%Y-%m-%dT%H:%i:%s') as holdExpiryDateTime,
               r.warning12SentAt, r.warning6SentAt, r.releasedAt,
               COALESCE(r.guestCount, 1) as guestCount, r.specialRequests,
               COALESCE(r.breakfastOption, 'with') as breakfastOption,
                CASE 
                  WHEN r.status IN ('On Hold', 'Courtesy Hold') AND (r.holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(r.holdExpiryDateTime, INTERVAL 30 MINUTE)) THEN 'On Hold'
                  WHEN r.status IN ('On Hold', 'Courtesy Hold') AND NOW() > DATE_ADD(r.holdExpiryDateTime, INTERVAL 30 MINUTE) THEN 'Cancelled'
                  WHEN r.status IN ('Confirmed', 'Booked') OR b.bookingID IS NOT NULL THEN 'Booked'
                  WHEN r.status IN ('Cancelled', 'Canceled', 'Released') THEN 'Cancelled'
                  ELSE 'Reserved'
                END as status,
                r.guestID, r.roomID,
                g.firstName, g.lastName, g.contact, COALESCE(r.guestEmail, g.email) as email,
                DATE_FORMAT(g.dateOfBirth, '%Y-%m-%d') as dateOfBirth, g.gender,
                rm.roomNumber, COALESCE(rt.type, 'Standard Room') as roomType, rm.image,
                COALESCE(rr1.rate, 1400.00) as rateWithBreakfast, COALESCE(rr2.rate, 1200.00) as rateWithoutBreakfast,
                COALESCE(rr_opt.rate, rr2.rate, 1200.00) as rate,
                b.bookingID, b.status as bookingStatus
        FROM reservation r
        JOIN guest g ON g.guestID = r.guestID
        JOIN room rm ON rm.roomID = r.roomID
        LEFT JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        LEFT JOIN room_rate rr_opt ON rr_opt.roomTypeID = rm.roomTypeID AND rr_opt.floorID = rm.floorID AND rr_opt.breakfastID = (CASE WHEN r.breakfastOption LIKE '%with%' AND r.breakfastOption NOT LIKE '%without%' THEN 2 ELSE 1 END)
        LEFT JOIN room_rate rr1 ON rr1.roomTypeID = rm.roomTypeID AND rr1.floorID = rm.floorID AND rr1.breakfastID = 2
        LEFT JOIN room_rate rr2 ON rr2.roomTypeID = rm.roomTypeID AND rr2.floorID = rm.floorID AND rr2.breakfastID = 1
        LEFT JOIN booking b ON b.reservationID = r.reservationID
        WHERE rm.isArchived = 0
        ORDER BY r.reservationDateTime DESC
      `),
      dbQuery("SELECT guestID, userID, firstName, lastName, contact, email, DATE_FORMAT(dateOfBirth, '%Y-%m-%d') as dateOfBirth, gender FROM guest WHERE userID IS NOT NULL ORDER BY lastName, firstName"),
      dbQuery(`
        SELECT r.roomID, r.roomNumber, r.status, COALESCE(rt.type, 'Standard Room') as roomType, r.occupancyLimit, r.image,
               r.breakfastRate,
               COALESCE(rr1.rate, 1400.00) as rateWithBreakfast,
               COALESCE(rr2.rate, 1200.00) as rateWithoutBreakfast,
               COALESCE(rr2.rate, rr1.rate, 1200.00) as rate
        FROM room r 
        LEFT JOIN room_type rt ON rt.roomTypeID = r.roomTypeID 
        LEFT JOIN room_rate rr1 ON rr1.roomTypeID = r.roomTypeID AND rr1.floorID = r.floorID AND rr1.breakfastID = 2
        LEFT JOIN room_rate rr2 ON rr2.roomTypeID = r.roomTypeID AND rr2.floorID = r.floorID AND rr2.breakfastID = 1
        WHERE r.isArchived = 0 
        ORDER BY r.roomNumber
      `),
      dbQuery("SELECT paymentMethodID, paymentMethod FROM payment_method"),
      dbQuery("SELECT discountID, name, percentage FROM discounts WHERE isArchived = 0 ORDER BY name"),
      dbQuery(`
        SELECT bookingID, roomID, checkInDateTime, checkOutDateTime, status, 'booking' as type
        FROM booking
        WHERE status NOT IN ('Cancelled', 'Checked Out', 'No Show')
          AND checkOutDateTime >= CURDATE()
      `),
      dbQuery(`
        SELECT reservationID, roomID, reservationDateTime as checkInDateTime,
               COALESCE(checkOutDateTime, DATE_ADD(reservationDateTime, INTERVAL 1 DAY)) as checkOutDateTime,
               status, 'reservation' as type, isCourtesyHold
        FROM reservation
        WHERE status NOT IN ('Cancelled', 'Checked Out', 'No Show', 'Released')
          AND (
            reservationDateTime >= CURDATE()
            OR (status = 'Courtesy Hold' AND (holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(holdExpiryDateTime, INTERVAL 30 MINUTE)))
          )
      `)
    ]);

    const roomSchedules = [...(activeBookings || []), ...(activeReservations || [])];

    const syncedReservations = reservations.map(r => {
      if (r.bookingStatus && r.bookingStatus !== 'Pending Check-in' && r.bookingStatus !== 'Pending') {
        return { ...r, status: r.bookingStatus };
      }
      return r;
    });

    return NextResponse.json({ reservations: syncedReservations, guests, rooms, paymentMethods, discounts, roomSchedules });
  } catch (error) {
    console.error("Failed to fetch reservations data:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      let guestID;
      let guestEmail = null;
      const isCourtesyHold = true;
      const holdDurationHours = 48;

      if (!body.guestID || body.isWalkIn) {
        const { firstName, lastName, contact, email, gender, dateOfBirth } = body;
        if (!firstName || !firstName.trim() || !lastName || !lastName.trim()) {
          return NextResponse.json({ error: 'First name and Last name are required.' }, { status: 400 });
        }
        if (!email || !email.trim()) {
          return NextResponse.json({ error: 'Guest email address is required for all reservations.' }, { status: 400 });
        }
        const cleanEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
        }
        const cleanContact = (contact || '').trim();

        // Prevent duplicate guest creation: check if guest already exists by email or contact
        const existingGuests = await dbQuery(
          "SELECT guestID, userID, email FROM guest WHERE LOWER(email) = ? OR (contact = ? AND contact != '') ORDER BY (userID IS NOT NULL) DESC, guestID DESC LIMIT 1",
          [cleanEmail, cleanContact]
        );

        if (existingGuests.length > 0) {
          guestID = existingGuests[0].guestID;
          guestEmail = cleanEmail;
          if (!existingGuests[0].userID) {
            await dbQuery(
              "UPDATE guest SET firstName = COALESCE(NULLIF(?, ''), firstName), lastName = COALESCE(NULLIF(?, ''), lastName), contact = COALESCE(NULLIF(?, ''), contact), dateOfBirth = COALESCE(NULLIF(?, ''), dateOfBirth), email = ? WHERE guestID = ?",
              [firstName.trim(), lastName.trim(), cleanContact, dateOfBirth || null, cleanEmail, guestID]
            );
          }
        } else {
          const insertRes = await dbQuery(
            "INSERT INTO guest (firstName, lastName, contact, email, gender, dateOfBirth, userID) VALUES (?, ?, ?, ?, ?, ?, NULL)",
            [firstName.trim(), lastName.trim(), cleanContact, cleanEmail, gender || null, dateOfBirth || null]
          );
          guestID = insertRes.insertId;
          guestEmail = cleanEmail;
        }
      } else {
        guestID = parseInt(body.guestID);
        guestEmail = (body.email || '').trim().toLowerCase() || null;
        if (!guestEmail) {
          const guestRows = await dbQuery("SELECT email FROM guest WHERE guestID = ?", [guestID]);
          if (guestRows.length > 0 && guestRows[0].email) {
            guestEmail = guestRows[0].email;
          }
        }
        if (!guestEmail || !guestEmail.trim()) {
          return NextResponse.json({ error: 'Guest email address is required.' }, { status: 400 });
        }
      }

      const roomID = parseInt(body.roomID);
      const reservationDateTime = body.reservationDateTime;
      const checkOutDateTime = body.checkOutDateTime || null;
      const guestCount = parseInt(body.guestCount || 1);
      const specialRequests = body.specialRequests || null;
      const breakfastOption = body.breakfastOption || 'with';

      if (!guestID || !roomID || !reservationDateTime) {
        return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
      }

      if (checkOutDateTime) {
        const inD = new Date(reservationDateTime.replace(' ', 'T'));
        const outD = new Date(checkOutDateTime.replace(' ', 'T'));
        if (!isNaN(inD.getTime()) && !isNaN(outD.getTime()) && outD <= inD) {
          return NextResponse.json({ error: 'Check-in date/time and Check-out date/time cannot be the same. Check-out must be strictly after Check-in.' }, { status: 400 });
        }
      }

      // Rule 1A: Reservation Lead Time (At least 2 days before check-in)
      const leadCheck = checkReservationLeadTime(reservationDateTime);
      if (!leadCheck.valid) {
        return NextResponse.json({ error: leadCheck.message }, { status: 400 });
      }

      // Rule 1B: One Active Reservation or Booking Per Guest
      const activeCheck = await checkActiveReservationOrBooking(guestID);
      if (!activeCheck.valid) {
        return NextResponse.json({ error: activeCheck.message }, { status: 400 });
      }

      // Rule 1C: Duplicate Reservation Validation
      const dupCheck = await checkDuplicateRoomReservation(guestID, roomID);
      if (!dupCheck.valid) {
        return NextResponse.json({ error: dupCheck.message }, { status: 400 });
      }

      const pad = (n) => String(n).padStart(2, '0');
      const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const holdExpiryDateTime = `${expiry.getFullYear()}-${pad(expiry.getMonth() + 1)}-${pad(expiry.getDate())} ${pad(expiry.getHours())}:${pad(expiry.getMinutes())}:${pad(expiry.getSeconds())}`;
      const initialStatus = 'Courtesy Hold';

      // Conflict check against overlapping active bookings or reservations
      const reqIn = reservationDateTime;
      const reqOut = checkOutDateTime || new Date(new Date(reservationDateTime.replace(' ', 'T')).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

      const conflictingBookings = await dbQuery(`
        SELECT bookingID FROM booking
        WHERE roomID = ?
          AND status NOT IN ('Cancelled', 'Checked Out', 'No Show')
          AND checkInDateTime < ?
          AND checkOutDateTime > ?
      `, [roomID, reqOut, reqIn]);

      if (conflictingBookings.length > 0) {
        return NextResponse.json({
          error: "This room is already booked for the selected dates."
        }, { status: 409 });
      }

      const conflictingReservations = await dbQuery(`
        SELECT reservationID FROM reservation
        WHERE roomID = ?
          AND (
            (status IN ('Pending', 'Confirmed', 'Booked') AND reservationDateTime < ? AND COALESCE(checkOutDateTime, DATE_ADD(reservationDateTime, INTERVAL 1 DAY)) > ?)
            OR
            (status = 'Courtesy Hold' AND (holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(holdExpiryDateTime, INTERVAL 30 MINUTE)) AND reservationDateTime < ? AND COALESCE(checkOutDateTime, DATE_ADD(reservationDateTime, INTERVAL 1 DAY)) > ?)
          )
      `, [roomID, reqOut, reqIn, reqOut, reqIn]);

      if (conflictingReservations.length > 0) {
        return NextResponse.json({
          error: "This room already has an active reservation or courtesy hold for the selected dates."
        }, { status: 409 });
      }

      await ensureBookingBreakfastSchema();
      const inDateStr = (reservationDateTime || '').split(' ')[0] || (reservationDateTime || '').split('T')[0];
      const outDateStr = (checkOutDateTime || '').split(' ')[0] || (checkOutDateTime || '').split('T')[0];
      const stayNights = inDateStr && outDateStr ? getStayNights(inDateStr, outDateStr) : [];

      let selectedBreakfastDates = body.breakfastDates || body.selectedBreakfastDates;
      if (!Array.isArray(selectedBreakfastDates)) {
        if (breakfastOption === 'with') {
          selectedBreakfastDates = stayNights.map(n => n.dateStr);
        } else {
          selectedBreakfastDates = [];
        }
      }
      const validBreakfastDates = selectedBreakfastDates.filter(d =>
        stayNights.some(n => n.dateStr === d)
      );

      let breakfastFee = parseFloat(body.breakfastFee || 0);
      if (breakfastOption === 'custom' && validBreakfastDates.length > 0 && breakfastFee <= 0) {
        breakfastFee = validBreakfastDates.length * 250;
      }

      const insertRes = await dbQuery(
        `INSERT INTO reservation(
          reservationDateTime, checkOutDateTime, guestCount, specialRequests, breakfastOption,
          status, guestID, roomID, isCourtesyHold, holdDurationHours, holdExpiryDateTime, guestEmail,
          breakfastDates, breakfastFee
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reservationDateTime, checkOutDateTime, guestCount, specialRequests, breakfastOption,
          initialStatus, guestID, roomID, 1, 48, holdExpiryDateTime, guestEmail,
          JSON.stringify(validBreakfastDates), breakfastFee
        ]
      );

      await dbQuery("UPDATE room SET status = 'Reserved' WHERE roomID = ?", [roomID]);

      // Dispatch Courtesy Hold Confirmation Email
      try {
        const roomData = await dbQuery("SELECT rm.roomNumber, COALESCE(rt.type, 'Standard Room') as roomType FROM room rm LEFT JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID WHERE rm.roomID = ?", [roomID]);
        const guestName = `${body.firstName || ''} ${body.lastName || ''}`.trim() || 'Valued Guest';
        sendCourtesyHoldCreatedEmail(guestEmail, guestName, {
          reservationID: insertRes.insertId,
          roomNumber: roomData[0]?.roomNumber || '',
          roomType: roomData[0]?.roomType || 'Standard',
          reservationDateTime,
          checkOutDateTime,
          holdExpiryStr: expiry.toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
          breakfastOption
        }).catch(() => {});
      } catch (eMailErr) {
        console.error("Failed to trigger courtesy hold email:", eMailErr);
      }

      return NextResponse.json({
        success: true,
        message: 'Courtesy hold created successfully for 48 hours.'
      });
    }

    if (action === 'update') {
      const reservationID = parseInt(body.reservationID);
      const roomID = parseInt(body.roomID);
      const reservationDateTime = body.reservationDateTime;
      const checkOutDateTime = body.checkOutDateTime || null;
      const guestCount = parseInt(body.guestCount || 1);
      const specialRequests = body.specialRequests || null;
      const breakfastOption = body.breakfastOption || 'with';

      if (!reservationID || !roomID || !reservationDateTime) {
        return NextResponse.json({ error: 'Missing required fields for update.' }, { status: 400 });
      }

      const existing = await dbQuery("SELECT guestID FROM reservation WHERE reservationID = ?", [reservationID]);
      if (existing.length === 0) {
        return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
      }
      const guestID = existing[0].guestID;

      // Rule 1A: Lead time check
      const leadCheck = checkReservationLeadTime(reservationDateTime);
      if (!leadCheck.valid) {
        return NextResponse.json({ error: leadCheck.message }, { status: 400 });
      }

      // Rule 1C: Duplicate room reservation
      const dupCheck = await checkDuplicateRoomReservation(guestID, roomID, reservationID);
      if (!dupCheck.valid) {
        return NextResponse.json({ error: dupCheck.message }, { status: 400 });
      }

      await dbQuery(
        "UPDATE reservation SET roomID = ?, reservationDateTime = ?, checkOutDateTime = ?, guestCount = ?, specialRequests = ?, breakfastOption = ? WHERE reservationID = ?",
        [roomID, reservationDateTime, checkOutDateTime, guestCount, specialRequests, breakfastOption, reservationID]
      );

      return NextResponse.json({ success: true, message: 'Reservation updated successfully.' });
    }

    if (action === 'confirm' || action === 'convert_to_booking') {
      const reservationID = parseInt(body.reservationID);
      const checkInDateTime = body.checkInDateTime;
      const checkOutDateTime = body.checkOutDateTime;
      const downPaymentAmount = parseFloat(body.downPaymentAmount || 0);
      const cashReceived = parseFloat(body.cashReceived || downPaymentAmount);
      const change = parseFloat(body.change || 0);
      const paymentMethodID = parseInt(body.paymentMethodID || 1);

      if (!checkInDateTime || !checkOutDateTime || isNaN(downPaymentAmount) || downPaymentAmount <= 0) {
        return NextResponse.json({ error: 'Valid stay dates and down payment are required to convert reservation.' }, { status: 400 });
      }

      // GCash Down Payment Settlement Validation
      if (paymentMethodID === 2 && body.paymentStatus !== 'Settled' && !body.isGcashSettled) {
        return NextResponse.json({ error: "Cannot proceed: GCash payment not settled." }, { status: 400 });
      }

      const inD = new Date(checkInDateTime.replace(' ', 'T'));
      const outD = new Date(checkOutDateTime.replace(' ', 'T'));
      if (!isNaN(inD.getTime()) && !isNaN(outD.getTime()) && outD <= inD) {
        return NextResponse.json({ error: 'Check-in date/time and Check-out date/time cannot be the same. Check-out must be strictly after Check-in.' }, { status: 400 });
      }

      const res = await dbQuery("SELECT * FROM reservation WHERE reservationID = ?", [reservationID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
      }

      if (['Released', 'Canceled', 'Cancelled', 'Expired', 'No Show'].includes(res[0].status)) {
        return NextResponse.json({ error: `Cannot convert reservation: status is ${res[0].status}.` }, { status: 400 });
      }

      if (res[0].isCourtesyHold && res[0].holdExpiryDateTime) {
        const expiryWithGrace = new Date(new Date(res[0].holdExpiryDateTime).getTime() + 30 * 60 * 1000);
        if (new Date() > expiryWithGrace) {
          return NextResponse.json({ error: 'Cannot convert reservation: the 48-hour courtesy hold has expired.' }, { status: 400 });
        }
      }

      const { guestID, roomID } = res[0];

      const pool = await getDbConnection();
      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        // Enforce Guest Email for Conversion
        const [existingGuestRows] = await conn.execute("SELECT email, firstName, lastName FROM guest WHERE guestID = ?", [guestID]);
        const currentGuest = existingGuestRows[0] || {};
        const updatedEmail = (body.email || res[0].guestEmail || currentGuest.email || '').trim().toLowerCase();

        if (!updatedEmail) {
          await conn.rollback();
          conn.release();
          return NextResponse.json({ error: 'Guest email address is required to convert reservation to booking.' }, { status: 400 });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updatedEmail)) {
          await conn.rollback();
          conn.release();
          return NextResponse.json({ error: 'Please enter a valid guest email address.' }, { status: 400 });
        }

        // Update email on guest and reservation records
        await conn.execute("UPDATE guest SET email = ? WHERE guestID = ?", [updatedEmail, guestID]);
        await conn.execute("UPDATE reservation SET guestEmail = ? WHERE reservationID = ?", [updatedEmail, reservationID]);

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

        const checkInNow = Boolean(body.checkInNow);
        const bookingStatus = checkInNow ? 'Active Stay' : 'Pending';
        const roomStatus = checkInNow ? 'Occupied' : 'Reserved';
        const finalCheckInDateTime = checkInNow ? nowStr : checkInDateTime;

        // 1. Update reservation status to Booked
        await conn.execute("UPDATE reservation SET status = 'Booked' WHERE reservationID = ?", [reservationID]);

        // Calculate nights
        const inDateStr = (finalCheckInDateTime || '').split(' ')[0] || (finalCheckInDateTime || '').split('T')[0];
        const outDateStr = (checkOutDateTime || '').split(' ')[0] || (checkOutDateTime || '').split('T')[0];
        const inDateObj = new Date(inDateStr + 'T00:00:00');
        const outDateObj = new Date(outDateStr + 'T00:00:00');
        let nights = 1;
        if (!isNaN(inDateObj.getTime()) && !isNaN(outDateObj.getTime()) && outDateObj > inDateObj) {
          nights = Math.max(1, Math.round((outDateObj.getTime() - inDateObj.getTime()) / (1000 * 60 * 60 * 24)));
        }

        // Room Rate & Capacity Resolution
        let parsedDates = [];
        try {
          parsedDates = typeof res[0].breakfastDates === 'string'
            ? JSON.parse(res[0].breakfastDates || '[]')
            : (Array.isArray(res[0].breakfastDates) ? res[0].breakfastDates : []);
        } catch (e) {
          parsedDates = [];
        }

        const hasCustomBreakfastDates = parsedDates.length > 0;
        const isWithBk = (res[0].breakfastOption || 'with') === 'with';
        const breakfastID = hasCustomBreakfastDates ? 1 : (isWithBk ? 2 : 1);
        const [rateRows] = await conn.execute(`
          SELECT rr.rate, rm.roomNumber, rm.occupancyLimit, rm.roomTypeID, rm.floorID
          FROM room rm
          LEFT JOIN room_rate rr ON rr.roomTypeID = rm.roomTypeID AND rr.floorID = rm.floorID AND rr.breakfastID = ?
          WHERE rm.roomID = ?
          LIMIT 1
        `, [breakfastID, roomID]);

        let roomRate = 0;
        let roomCapacity = 4;
        if (rateRows && rateRows.length > 0) {
          roomRate = parseFloat(rateRows[0].rate) || 0;
          roomCapacity = Math.max(1, parseInt(rateRows[0].occupancyLimit || 4, 10));
        }
        if (!roomRate) {
          const [fallbackRate] = await conn.execute("SELECT rate FROM room_rate WHERE breakfastID = ? LIMIT 1", [breakfastID]);
          roomRate = parseFloat(fallbackRate[0]?.rate) || 0;
        }

        const totalGuestsCount = Math.max(1, parseInt(body.guestCount || res[0].guestCount || 1, 10));
        const extraPax = Math.max(0, totalGuestsCount - roomCapacity);
        const extraGuestFee = extraPax * 100 * nights;

        let calculatedBreakfastFee = parseFloat(res[0].breakfastFee || 0);
        if (hasCustomBreakfastDates && calculatedBreakfastFee <= 0) {
          calculatedBreakfastFee = parsedDates.length * 250;
        }

        // Process guest individual discounts
        const reqDiscountedGuests = Array.isArray(body.discountedGuests) ? body.discountedGuests : [];
        let formattedDiscounts = [];

        if (reqDiscountedGuests.length > 0) {
          const [dbDiscounts] = await conn.execute("SELECT discountID, name, percentage FROM discounts WHERE isArchived = 0 ORDER BY name ASC");
          formattedDiscounts = reqDiscountedGuests
            .filter(g => g.discountID)
            .map(g => {
              const disc = dbDiscounts.find(d => String(d.discountID) === String(g.discountID));
              return {
                guestName: g.guestName || `${currentGuest.firstName || ''} ${currentGuest.lastName || ''}`.trim() || 'Primary Guest',
                discountID: g.discountID,
                discountIdNumber: g.discountIdNumber || null,
                rate: disc ? (parseFloat(disc.percentage) / 100) : 0,
                discountType: disc?.name || 'Special Discount'
              };
            });
        }

        const dpPercentageInt = Math.max(1, Math.min(100, parseInt(body.downPaymentPercentage || (downPaymentAmount ? Math.round((downPaymentAmount / (((roomRate * nights) + calculatedBreakfastFee) || 1)) * 100) : 50), 10) || 50));

        const billingCalc = calculateBillingTotals({
          roomRate,
          nights,
          guestCount: totalGuestsCount,
          guestDiscounts: formattedDiscounts,
          extraGuestFee,
          breakfastFee: calculatedBreakfastFee,
          downPaymentPercentage: dpPercentageInt
        });

        const grossSubtotal = billingCalc.grossSubtotal;
        const discountTotal = billingCalc.totalPerCapitaDiscount;
        const netTotal = billingCalc.netTotal;
        const vatRate = 0;
        const vatAmount = 0;
        const grandTotal = billingCalc.netTotal;
        const finalDownPaymentAmount = downPaymentAmount > 0 ? downPaymentAmount : billingCalc.requiredDownpayment;
        const initialBalance = Math.max(0, Math.round((netTotal - finalDownPaymentAmount) * 100) / 100);

        // 2. Insert booking with calculated financial invariants
        const [insertBookingRes] = await conn.execute(
          `INSERT INTO booking(
            checkInDateTime, checkOutDateTime, status, reservationID, guestID, roomID,
            roomRate, roomCharge, subtotal, discountTotal, netTotal, vatRate, vatAmount,
            grandTotal, totalAmount, downPaymentAmount, downPaymentPercentage, remainingBalance,
            breakfastOption, guestCount, breakfastDates, breakfastFee
          ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            finalCheckInDateTime, checkOutDateTime, bookingStatus, reservationID, guestID, roomID,
            roomRate, billingCalc.grossRoomSubtotal, grossSubtotal, discountTotal, netTotal, vatRate, vatAmount,
            grandTotal, grandTotal, finalDownPaymentAmount, dpPercentageInt, initialBalance,
            res[0].breakfastOption || 'with', totalGuestsCount, res[0].breakfastDates || null, calculatedBreakfastFee
          ]
        );
        const bookingID = insertBookingRes.insertId;

        // 3. Seed guest details & itemized discounts
        const [guestInfo] = await conn.execute("SELECT firstName, lastName FROM guest WHERE guestID = ?", [guestID]);
        const defaultName = guestInfo.length > 0 ? `${guestInfo[0].firstName} ${guestInfo[0].lastName}` : 'Primary Guest';

        if (reqDiscountedGuests.length > 0) {
          for (const g of reqDiscountedGuests) {
            const gName = (g.guestName || '').trim() || defaultName;
            await conn.execute(
              "INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber) VALUES (?, ?, 30, ?, ?)",
              [bookingID, gName, g.discountID || null, g.discountIdNumber?.trim() || null]
            );
          }
        } else {
          await conn.execute(
            "INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber) VALUES (?, ?, 30, NULL, NULL)",
            [bookingID, defaultName]
          );
        }

        if (billingCalc.itemizedDiscounts && billingCalc.itemizedDiscounts.length > 0) {
          for (const d of billingCalc.itemizedDiscounts) {
            await conn.execute(
              "INSERT INTO booking_discount (bookingID, guestName, discountID, discountIdNumber, discountAmount) VALUES (?, ?, ?, ?, ?)",
              [bookingID, d.guestName, d.discountID, d.discountIdNumber, d.discountAmount]
            );
          }
        }

        // 4. Create Billing Record with synchronized invariant totals
        const [billingInsert] = await conn.execute(
          `INSERT INTO billing (
            billingDateTime, guestID, bookingID, orderID,
            subtotal, discountTotal, netTotal, vatRate, vatAmount,
            grandTotal, totalAmount, downPaymentAmount, downPaymentPercentage,
            remainingBalance, balance
          ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            nowStr, guestID, bookingID,
            grossSubtotal, discountTotal, netTotal, vatRate, vatAmount,
            grandTotal, grandTotal, finalDownPaymentAmount, dpPercentageInt,
            initialBalance, initialBalance
          ]
        );
        const billingID = billingInsert.insertId;

        // 5. Get staffID using session userID
        const [staffRes] = await conn.execute("SELECT staffID FROM staff WHERE userID = ?", [session.userID]);
        const staffID = staffRes[0]?.staffID || null;

        // 6. Record Down Payment with 'Settled' status & referenceNumber
        const refNumber = body.referenceNumber || (paymentMethodID === 2 ? `GCASH-RES-${reservationID}` : `CASH-${Date.now().toString().slice(-6)}`);
        const [paymentInsert] = await conn.execute(
          `INSERT INTO payment (amount, cashReceived, \`change\`, billingID, guestID, staffID, paymentMethodID, discountID, promotionID, testMode, status, referenceNumber) 
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1, 'Settled', ?)`,
          [downPaymentAmount, cashReceived, change, billingID, guestID, staffID, paymentMethodID, refNumber]
        );
        const paymentID = paymentInsert.insertId;

        // 7. Insert Transaction log
        await conn.execute(
          "INSERT INTO transactions (transactionDateTime, billingID, paymentID, testMode) VALUES (?, ?, ?, 1)",
          [nowStr, billingID, paymentID]
        );

        // 8. Update Room status ('Occupied' if Book and Check-In Now, else 'Reserved')
        await conn.execute("UPDATE room SET status = ? WHERE roomID = ?", [roomStatus, roomID]);

        // 9. Requirement 7: Resolution of Reservation Conflicts
        await resolveReservationConflicts(conn, roomID, reservationID);

        // 10. Log to billing_audit
        await logBillingAudit(conn, {
          billingID,
          bookingID,
          transactionType: 'Down Payment',
          status: 'Settled',
          amount: downPaymentAmount,
          balanceBefore: 0,
          balanceAfter: 0,
          userID: session?.userID || null,
          userName: session?.fullName || 'Receptionist',
          userRole: session?.role || 'Receptionist',
          description: `Down payment recorded upon reservation conversion (${checkInNow ? 'Checked In Immediately' : 'Pending Check-in'})`,
          referenceNumber: refNumber
        });

        await syncNormalizedBillingLineItems(conn, billingID, bookingID);
        await conn.commit();

        // Dispatch Booking Confirmation Email with authoritative DB balance
        try {
          const [roomInfo] = await conn.execute(
            "SELECT rm.roomNumber, COALESCE(rt.type, 'Standard Room') as roomType FROM room rm LEFT JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID WHERE rm.roomID = ?",
            [roomID]
          );
          const guestFullName = `${currentGuest.firstName || ''} ${currentGuest.lastName || ''}`.trim() || 'Valued Guest';

          const [syncBill] = await conn.execute(
            "SELECT remainingBalance, downPaymentAmount FROM billing WHERE billingID = ?",
            [billingID]
          );
          const finalRemBalance = syncBill && syncBill[0]?.remainingBalance != null
            ? parseFloat(syncBill[0].remainingBalance)
            : Math.max(0, parseFloat(body.remainingBalance || 0));
          const finalDownPayment = syncBill && syncBill[0]?.downPaymentAmount != null
            ? parseFloat(syncBill[0].downPaymentAmount)
            : downPaymentAmount;

          sendBookingConfirmationEmail(updatedEmail, guestFullName, {
            bookingID,
            roomNumber: roomInfo[0]?.roomNumber || '',
            roomType: roomInfo[0]?.roomType || 'Standard',
            status: bookingStatus,
            checkInDateTime: finalCheckInDateTime,
            checkOutDateTime,
            downPaymentAmount: finalDownPayment,
            remainingBalance: finalRemBalance,
            paymentMethod: parseInt(paymentMethodID) === 2 ? 'GCash' : 'Cash',
            referenceNumber: refNumber
          }).catch(() => {});
        } catch (mailErr) {
          console.error("Failed to send booking confirmation email:", mailErr);
        }

        return NextResponse.json({
          success: true,
          message: checkInNow ? 'Reservation confirmed and guest checked in successfully.' : 'Reservation successfully converted to Booking.',
          bookingID,
          billingID,
          paymentID,
          bookingStatus,
          roomStatus
        });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    if (action === 'cancel') {
      const reservationID = parseInt(body.reservationID);
      const res = await dbQuery("SELECT r.*, g.userID, g.firstName, g.lastName FROM reservation r LEFT JOIN guest g ON g.guestID = r.guestID WHERE r.reservationID = ?", [reservationID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
      }
      const targetRes = res[0];

      await dbQuery("UPDATE reservation SET status = 'Cancelled' WHERE reservationID = ?", [reservationID]);
      await syncRoomStatuses(true);

      // 1. Send Guest Notification
      if (targetRes.userID) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Reservation Cancelled', ?)",
          [targetRes.userID, `Your Reservation #${reservationID} for Room ${targetRes.roomID} has been cancelled by Front Desk.`]
        );
      }

      // 2. Audit Log for Receptionist/Admin Panel
      const staffUsers = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
      for (const s of staffUsers) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Reservation Cancelled Audit', ?)",
          [s.userID, `Front Desk staff cancelled Reservation #${reservationID} for Guest ${targetRes.firstName || 'Walk-in'} ${targetRes.lastName || 'Guest'}.`]
        );
      }

      return NextResponse.json({ success: true, message: 'Reservation cancelled successfully.' });
    }

    if (action === 'release_hold') {
      const reservationID = parseInt(body.reservationID);
      const res = await dbQuery("SELECT r.*, g.userID, g.firstName, g.lastName FROM reservation r LEFT JOIN guest g ON g.guestID = r.guestID WHERE r.reservationID = ?", [reservationID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
      }
      const targetRes = res[0];

      await dbQuery("UPDATE reservation SET status = 'Cancelled', releasedAt = NOW() WHERE reservationID = ?", [reservationID]);
      await syncRoomStatuses(true);

      if (targetRes.userID) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Courtesy Hold Released', ?)",
          [targetRes.userID, `Your courtesy hold on Room #${targetRes.roomID} has been released.`]
        );
      }

      const staffUsers = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
      for (const s of staffUsers) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Courtesy Hold Released', ?)",
          [s.userID, `Front Desk staff released Courtesy Hold #${reservationID} for Guest ${targetRes.firstName || 'Walk-in'} ${targetRes.lastName || 'Guest'}. Room #${targetRes.roomID} is now available.`]
        );
      }

      return NextResponse.json({ success: true, message: 'Courtesy hold released successfully. Room is now available.' });
    }

    if (action === 'overrideStatus' || action === 'reinstate') {
      const reservationID = parseInt(body.reservationID);
      const newStatus = body.status || 'Confirmed';
      if (!reservationID) {
        return NextResponse.json({ error: 'Reservation ID is required.' }, { status: 400 });
      }

      await dbQuery("UPDATE reservation SET status = ? WHERE reservationID = ?", [newStatus, reservationID]);
      await syncRoomStatuses(true);

      return NextResponse.json({ success: true, message: `Reservation status updated to ${newStatus}.` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process reservation action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const clonedRequest = request.clone();
  try {
    const body = await clonedRequest.json();
    if (!body.action) {
      body.action = 'convert_to_booking';
    }
    const modifiedRequest = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(body)
    });
    return POST(modifiedRequest);
  } catch (e) {
    return POST(request);
  }
}
