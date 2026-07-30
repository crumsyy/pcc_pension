import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection } from '@/lib/db';

function checkReservationLeadTime(checkInDateStr) {
  if (!checkInDateStr) return { valid: true };
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(String(checkInDateStr).replace(' ', 'T'));
  if (isNaN(targetDate.getTime())) return { valid: true };
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 2) {
    return {
      valid: false,
      message: "Reservations must be made at least 2 days before your intended check-in date."
    };
  }
  return { valid: true };
}

async function checkActiveReservationOrBooking(guestID, currentReservationID = null) {
  let resSql = "SELECT reservationID FROM reservation WHERE guestID = ? AND status IN ('Pending', 'Confirmed')";
  const resParams = [guestID];
  if (currentReservationID) {
    resSql += " AND reservationID != ?";
    resParams.push(currentReservationID);
  }
  const activeRes = await dbQuery(resSql, resParams);

  const activeBooking = await dbQuery(
    "SELECT bookingID FROM booking WHERE guestID = ? AND status IN ('Pending', 'Checked In', 'Confirmed', 'Pending Check-in')",
    [guestID]
  );

  if (activeRes.length > 0 || activeBooking.length > 0) {
    return {
      valid: false,
      message: "You already have an active reservation/booking. Please modify or cancel your existing reservation before creating a new one."
    };
  }
  return { valid: true };
}

async function checkDuplicateRoomReservation(guestID, roomID, currentReservationID = null) {
  let sql = "SELECT reservationID FROM reservation WHERE guestID = ? AND roomID = ? AND status IN ('Pending', 'Confirmed')";
  const params = [guestID, roomID];
  if (currentReservationID) {
    sql += " AND reservationID != ?";
    params.push(currentReservationID);
  }
  const duplicates = await dbQuery(sql, params);
  if (duplicates.length > 0) {
    return {
      valid: false,
      message: "You already have an active reservation for this room."
    };
  }
  return { valid: true };
}

async function resolveReservationConflicts(conn, confirmedRoomID, confirmedReservationID) {
  const [conflicts] = await conn.execute(
    "SELECT r.reservationID, r.guestID, g.userID, rm.roomNumber FROM reservation r JOIN guest g ON g.guestID = r.guestID JOIN room rm ON rm.roomID = r.roomID WHERE r.roomID = ? AND r.reservationID != ? AND r.status IN ('Pending', 'Confirmed')",
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

  try {
    const [reservations, guests, rooms, paymentMethods, discounts] = await Promise.all([
      dbQuery(`
        SELECT r.reservationID, DATE_FORMAT(r.reservationDateTime, '%Y-%m-%dT%H:%i:%s') as reservationDateTime,
               DATE_FORMAT(r.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime,
               COALESCE(r.guestCount, 1) as guestCount, r.specialRequests,
               COALESCE(r.breakfastOption, 'with') as breakfastOption,
               r.status, r.guestID, r.roomID,
               g.firstName, g.lastName, g.contact, g.email,
               rm.roomNumber, rt.type as roomType,
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
        SELECT r.roomID, r.roomNumber, r.status, rt.type as roomType, r.occupancyLimit,
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

    return NextResponse.json({ reservations, guests, rooms, paymentMethods, discounts });
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

      if (body.isWalkIn) {
        const { firstName, lastName, contact, email, gender } = body;
        if (!firstName || !firstName.trim() || !lastName || !lastName.trim()) {
          return NextResponse.json({ error: 'First name and Last name are required for walk-in guests.' }, { status: 400 });
        }
        const insertRes = await dbQuery(
          "INSERT INTO guest (firstName, lastName, contact, email, gender, userID) VALUES (?, ?, ?, ?, ?, NULL)",
          [firstName.trim(), lastName.trim(), (contact || '').trim(), (email || '').trim() || null, gender || null]
        );
        guestID = insertRes.insertId;
      } else {
        guestID = parseInt(body.guestID);
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

      await dbQuery(
        "INSERT INTO reservation(reservationDateTime, checkOutDateTime, guestCount, specialRequests, breakfastOption, status, guestID, roomID) VALUES(?, ?, ?, ?, ?, 'Pending', ?, ?)",
        [reservationDateTime, checkOutDateTime, guestCount, specialRequests, breakfastOption, guestID, roomID]
      );

      return NextResponse.json({ success: true, message: 'Reservation created successfully.' });
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

      const res = await dbQuery("SELECT * FROM reservation WHERE reservationID = ?", [reservationID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
      }
      const { guestID, roomID } = res[0];

      const pool = await getDbConnection();
      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        // 1. Update reservation status to Confirmed
        await conn.execute("UPDATE reservation SET status = 'Confirmed' WHERE reservationID = ?", [reservationID]);

        // 2. Insert booking with Pending Check-in status
        const [insertBookingRes] = await conn.execute(
          "INSERT INTO booking(checkInDateTime, checkOutDateTime, status, reservationID, guestID, roomID) VALUES(?, ?, 'Pending Check-in', ?, ?, ?)",
          [checkInDateTime, checkOutDateTime, reservationID, guestID, roomID]
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
        const localNow = new Date();
        const pad = (num) => String(num).padStart(2, '0');
        const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;
        const [billingInsert] = await conn.execute(
          "INSERT INTO billing (billingDateTime, guestID, bookingID, orderID) VALUES (?, ?, ?, NULL)",
          [nowStr, guestID, bookingID]
        );
        const billingID = billingInsert.insertId;

        // 5. Get staffID using session userID
        const [staffRes] = await conn.execute("SELECT staffID FROM staff WHERE userID = ?", [session.userID]);
        const staffID = staffRes[0]?.staffID || null;

        // 6. Record Down Payment
        const [paymentInsert] = await conn.execute(
          `INSERT INTO payment (amount, cashReceived, \`change\`, billingID, guestID, staffID, paymentMethodID, discountID, promotionID) 
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
          [downPaymentAmount, cashReceived, change, billingID, guestID, staffID, paymentMethodID]
        );
        const paymentID = paymentInsert.insertId;

        // 7. Insert Transaction log
        await conn.execute(
          "INSERT INTO transactions (transactionDateTime, billingID, paymentID) VALUES (?, ?, ?)",
          [nowStr, billingID, paymentID]
        );

        // 8. Update Room status to Reserved
        await conn.execute("UPDATE room SET status = 'Reserved' WHERE roomID = ?", [roomID]);

        // 9. Requirement 7: Resolution of Reservation Conflicts
        await resolveReservationConflicts(conn, roomID, reservationID);

        await conn.commit();
        return NextResponse.json({ success: true, message: 'Reservation successfully converted to Booking.', bookingID, billingID, paymentID });
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

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process reservation action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
