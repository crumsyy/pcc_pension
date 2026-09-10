import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncRoomStatuses, ensurePaymentSchema, logBillingAudit } from '@/lib/db';

function checkReservationLeadTime(checkInDateStr) {
  if (!checkInDateStr) return { valid: true };
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const maxDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const maxDateStr = `${maxDate.getFullYear()}-${pad(maxDate.getMonth() + 1)}-${pad(maxDate.getDate())}`;

  const inDateStr = (checkInDateStr || '').split(' ')[0] || (checkInDateStr || '').split('T')[0];
  if (inDateStr < todayStr || inDateStr > maxDateStr) {
    return {
      valid: false,
      message: "Reservations can only be made for Today, Tomorrow, or the Next Day (up to 2 days ahead maximum)."
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
    await conn.execute("UPDATE reservation SET status = 'Canceled' WHERE reservationID = ?", [c.reservationID]);

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
    const [reservations, guests, rooms, paymentMethods, discounts] = await Promise.all([
      dbQuery(`
        SELECT r.reservationID, DATE_FORMAT(r.reservationDateTime, '%Y-%m-%dT%H:%i:%s') as reservationDateTime,
               DATE_FORMAT(r.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime,
               r.isCourtesyHold, r.holdDurationHours,
               DATE_FORMAT(r.holdExpiryDateTime, '%Y-%m-%dT%H:%i:%s') as holdExpiryDateTime,
               r.warning12SentAt, r.warning6SentAt, r.releasedAt,
               COALESCE(r.guestCount, 1) as guestCount, r.specialRequests,
               COALESCE(r.breakfastOption, 'with') as breakfastOption,
               CASE 
                 WHEN r.status = 'Courtesy Hold' AND (r.holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(r.holdExpiryDateTime, INTERVAL 30 MINUTE)) THEN 'Courtesy Hold'
                 WHEN r.status = 'Courtesy Hold' AND NOW() > DATE_ADD(r.holdExpiryDateTime, INTERVAL 30 MINUTE) THEN 'Released'
                 WHEN r.status IN ('Confirmed', 'Pending', 'Booked') AND NOW() >= r.reservationDateTime AND NOW() <= DATE_ADD(r.reservationDateTime, INTERVAL 1 HOUR) THEN 'Overdue Check-In'
                 WHEN r.status IN ('Confirmed', 'Pending', 'Booked') AND (r.reservationDateTime < DATE_SUB(NOW(), INTERVAL 1 HOUR) OR (r.checkOutDateTime IS NOT NULL AND NOW() > r.checkOutDateTime)) THEN 'No Show'
                 ELSE r.status
               END as status,
               r.guestID, r.roomID,
               g.firstName, g.lastName, g.contact, COALESCE(r.guestEmail, g.email) as email,
               rm.roomNumber, rt.type as roomType, rm.image,
               rr1.rate as rateWithBreakfast, rr2.rate as rateWithoutBreakfast,
               COALESCE(rr1.rate, rr2.rate, 0) as rate,
               b.bookingID, b.status as bookingStatus
        FROM reservation r
        JOIN guest g ON g.guestID = r.guestID
        JOIN room rm ON rm.roomID = r.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        LEFT JOIN room_rate rr1 ON rr1.roomTypeID = rm.roomTypeID AND rr1.floorID = rm.floorID AND rr1.breakfastID = 2
        LEFT JOIN room_rate rr2 ON rr2.roomTypeID = rm.roomTypeID AND rr2.floorID = rm.floorID AND rr2.breakfastID = 1
        LEFT JOIN booking b ON b.reservationID = r.reservationID
        WHERE rm.isArchived = 0
        ORDER BY r.reservationDateTime DESC
      `),
      dbQuery("SELECT guestID, firstName, lastName, contact, email FROM guest WHERE userID IS NOT NULL ORDER BY lastName, firstName"),
      dbQuery(`
        SELECT r.roomID, r.roomNumber, r.status, rt.type as roomType, r.occupancyLimit, r.image,
               rr1.rate as rateWithBreakfast,
               rr2.rate as rateWithoutBreakfast,
               COALESCE(rr1.rate, rr2.rate, 0) as rate
        FROM room r 
        JOIN room_type rt ON rt.roomTypeID = r.roomTypeID 
        LEFT JOIN room_rate rr1 ON rr1.roomTypeID = r.roomTypeID AND rr1.floorID = r.floorID AND rr1.breakfastID = 2
        LEFT JOIN room_rate rr2 ON rr2.roomTypeID = r.roomTypeID AND rr2.floorID = r.floorID AND rr2.breakfastID = 1
        WHERE r.isArchived = 0 
        ORDER BY r.roomNumber
      `),
      dbQuery("SELECT paymentMethodID, paymentMethod FROM payment_method"),
      dbQuery("SELECT discountID, name, percentage FROM discounts WHERE isArchived = 0 ORDER BY name")
    ]);

    const syncedReservations = reservations.map(r => {
      if (r.bookingStatus && r.bookingStatus !== 'Pending Check-in' && r.bookingStatus !== 'Pending') {
        return { ...r, status: r.bookingStatus };
      }
      return r;
    });

    return NextResponse.json({ reservations: syncedReservations, guests, rooms, paymentMethods, discounts });
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
      await ensurePaymentSchema();
      let guestID;
      let guestEmail = null;
      const isCourtesyHold = Boolean(body.isCourtesyHold);

      if (body.isWalkIn) {
        const { firstName, lastName, contact, email, gender } = body;
        if (!firstName || !firstName.trim() || !lastName || !lastName.trim()) {
          return NextResponse.json({ error: 'First name and Last name are required for walk-in guests.' }, { status: 400 });
        }
        if (isCourtesyHold && (!email || !email.trim())) {
          return NextResponse.json({ error: 'Email address is required for walk-in courtesy holds to receive expiry alerts.' }, { status: 400 });
        }
        const insertRes = await dbQuery(
          "INSERT INTO guest (firstName, lastName, contact, email, gender, userID) VALUES (?, ?, ?, ?, ?, NULL)",
          [firstName.trim(), lastName.trim(), (contact || '').trim(), (email || '').trim() || null, gender || null]
        );
        guestID = insertRes.insertId;
        guestEmail = (email || '').trim() || null;
      } else {
        guestID = parseInt(body.guestID);
        const guestRows = await dbQuery("SELECT email FROM guest WHERE guestID = ?", [guestID]);
        if (guestRows.length > 0 && guestRows[0].email) {
          guestEmail = guestRows[0].email;
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

      const validDurations = [24, 48, 72];
      const holdDurationHours = validDurations.includes(parseInt(body.holdDurationHours)) ? parseInt(body.holdDurationHours) : 48;
      let holdExpiryDateTime = null;
      if (isCourtesyHold) {
        const pad = (n) => String(n).padStart(2, '0');
        const expiry = new Date(Date.now() + holdDurationHours * 60 * 60 * 1000);
        holdExpiryDateTime = `${expiry.getFullYear()}-${pad(expiry.getMonth() + 1)}-${pad(expiry.getDate())} ${pad(expiry.getHours())}:${pad(expiry.getMinutes())}:${pad(expiry.getSeconds())}`;
      }
      const initialStatus = isCourtesyHold ? 'Courtesy Hold' : 'Booked';

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

      await dbQuery(
        `INSERT INTO reservation(
          reservationDateTime, checkOutDateTime, guestCount, specialRequests, breakfastOption,
          status, guestID, roomID, isCourtesyHold, holdDurationHours, holdExpiryDateTime, guestEmail
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reservationDateTime, checkOutDateTime, guestCount, specialRequests, breakfastOption,
          initialStatus, guestID, roomID, isCourtesyHold ? 1 : 0, isCourtesyHold ? holdDurationHours : null, holdExpiryDateTime, guestEmail
        ]
      );

      if (isCourtesyHold) {
        await dbQuery("UPDATE room SET status = 'Reserved' WHERE roomID = ?", [roomID]);
      }

      return NextResponse.json({
        success: true,
        message: isCourtesyHold
          ? `Courtesy hold created successfully for ${holdDurationHours} hours.`
          : 'Booking created successfully.'
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
      const { guestID, roomID } = res[0];

      const pool = await getDbConnection();
      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();
        await ensurePaymentSchema();

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
        const bookingStatus = checkInNow ? 'Checked In' : 'Pending Check-in';
        const roomStatus = checkInNow ? 'Occupied' : 'Reserved';
        const finalCheckInDateTime = checkInNow ? nowStr : checkInDateTime;

        // 1. Update reservation status to Converted to Booking
        await conn.execute("UPDATE reservation SET status = 'Converted to Booking' WHERE reservationID = ?", [reservationID]);

        // 2. Insert booking with appropriate status ('Checked In' if Book and Check-In Now, else 'Pending Check-in')
        const [insertBookingRes] = await conn.execute(
          "INSERT INTO booking(checkInDateTime, checkOutDateTime, status, reservationID, guestID, roomID) VALUES(?, ?, ?, ?, ?, ?)",
          [finalCheckInDateTime, checkOutDateTime, bookingStatus, reservationID, guestID, roomID]
        );
        const bookingID = insertBookingRes.insertId;

        // 3. Seed default guest details
        const [guestInfo] = await conn.execute("SELECT firstName, lastName FROM guest WHERE guestID = ?", [guestID]);
        const defaultName = guestInfo.length > 0 ? `${guestInfo[0].firstName} ${guestInfo[0].lastName}` : 'Primary Guest';
        await conn.execute(
          "INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber) VALUES (?, ?, 30, NULL, NULL)",
          [bookingID, defaultName]
        );

        // 4. Create Billing Record
        const [billingInsert] = await conn.execute(
          "INSERT INTO billing (billingDateTime, guestID, bookingID, orderID) VALUES (?, ?, ?, NULL)",
          [nowStr, guestID, bookingID]
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

        await conn.commit();
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
      const res = await dbQuery("SELECT r.*, g.userID, g.firstName, g.lastName FROM reservation r JOIN guest g ON g.guestID = r.guestID WHERE r.reservationID = ?", [reservationID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
      }
      const targetRes = res[0];

      await dbQuery("UPDATE reservation SET status = 'Cancelled' WHERE reservationID = ?", [reservationID]);

      // Release room status back to Available if it was Reserved
      if (targetRes.roomID) {
        await dbQuery("UPDATE room SET status = 'Available' WHERE roomID = ? AND status = 'Reserved'", [targetRes.roomID]);
      }

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
          [s.userID, `Front Desk staff cancelled Reservation #${reservationID} for Guest ${targetRes.firstName} ${targetRes.lastName}.`]
        );
      }

      return NextResponse.json({ success: true, message: 'Reservation cancelled successfully.' });
    }

    if (action === 'release_hold') {
      const reservationID = parseInt(body.reservationID);
      const res = await dbQuery("SELECT r.*, g.userID, g.firstName, g.lastName FROM reservation r JOIN guest g ON g.guestID = r.guestID WHERE r.reservationID = ?", [reservationID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
      }
      const targetRes = res[0];

      await dbQuery("UPDATE reservation SET status = 'Released', releasedAt = NOW() WHERE reservationID = ?", [reservationID]);
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
          [s.userID, `Front Desk staff released Courtesy Hold #${reservationID} for Guest ${targetRes.firstName} ${targetRes.lastName}. Room #${targetRes.roomID} is now available.`]
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
      await syncRoomStatuses();

      return NextResponse.json({ success: true, message: `Reservation status updated to ${newStatus}.` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process reservation action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
