import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [reservations, guests, rooms, paymentMethods] = await Promise.all([
      dbQuery(`
        SELECT r.reservationID, DATE_FORMAT(r.reservationDateTime, '%Y-%m-%dT%H:%i:%s') as reservationDateTime, r.status, r.guestID, r.roomID,
               g.firstName, g.lastName, g.contact,
               rm.roomNumber, rt.type as roomType,
               b.bookingID, b.status as bookingStatus
        FROM reservation r
        JOIN guest g ON g.guestID = r.guestID
        JOIN room rm ON rm.roomID = r.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        LEFT JOIN booking b ON b.reservationID = r.reservationID
        WHERE rm.isArchived = 0
        ORDER BY r.reservationDateTime DESC
      `),
      dbQuery("SELECT guestID, firstName, lastName, contact FROM guest WHERE userID IS NOT NULL ORDER BY lastName, firstName"),
      dbQuery(`
        SELECT r.roomID, r.roomNumber, r.status, rt.type as roomType, rr.rate
        FROM room r 
        JOIN room_type rt ON rt.roomTypeID = r.roomTypeID 
        LEFT JOIN room_rate rr ON rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID AND rr.breakfastID = 1
        WHERE r.isArchived = 0 
        ORDER BY r.roomNumber
      `),
      dbQuery("SELECT paymentMethodID, paymentMethod FROM payment_method")
    ]);

    return NextResponse.json({ reservations, guests, rooms, paymentMethods });
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

      if (!guestID || !roomID || !reservationDateTime) {
        return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
      }

      await dbQuery(
        "INSERT INTO reservation(reservationDateTime, status, guestID, roomID) VALUES(?, 'Pending', ?, ?)",
        [reservationDateTime, guestID, roomID]
      );

      return NextResponse.json({ success: true, message: 'Reservation created successfully.' });
    }

    if (action === 'confirm') {
      const reservationID = parseInt(body.reservationID);
      const checkInDateTime = body.checkInDateTime;
      const checkOutDateTime = body.checkOutDateTime;
      const downPaymentAmount = parseFloat(body.downPaymentAmount || 0);
      const paymentMethodID = parseInt(body.paymentMethodID || 1);

      if (!checkInDateTime || !checkOutDateTime || isNaN(downPaymentAmount) || downPaymentAmount <= 0) {
        return NextResponse.json({ error: 'Valid stay dates and down payment are required to confirm booking.' }, { status: 400 });
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
           VALUES (?, ?, 0, ?, ?, ?, ?, NULL, NULL)`,
          [downPaymentAmount, downPaymentAmount, billingID, guestID, staffID, paymentMethodID]
        );
        const paymentID = paymentInsert.insertId;

        // 7. Insert Transaction log
        await conn.execute(
          "INSERT INTO transactions (transactionDateTime, billingID, paymentID) VALUES (?, ?, ?)",
          [nowStr, billingID, paymentID]
        );

        // 8. Update Room status to Reserved
        await conn.execute("UPDATE room SET status = 'Reserved' WHERE roomID = ?", [roomID]);

        await conn.commit();
        return NextResponse.json({ success: true, message: 'Reservation confirmed, down payment received, and booking created.' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    if (action === 'cancel') {
      const reservationID = parseInt(body.reservationID);
      const res = await dbQuery("SELECT * FROM reservation WHERE reservationID = ?", [reservationID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
      }

      await dbQuery("UPDATE reservation SET status = 'Cancelled' WHERE reservationID = ?", [reservationID]);

      return NextResponse.json({ success: true, message: 'Reservation canceled.' });
    }

    if (action === 'convert_to_booking') {
      const reservationID = parseInt(body.reservationID);
      const checkInDateTime = body.checkInDateTime;
      const checkOutDateTime = body.checkOutDateTime;
      const downPaymentAmount = parseFloat(body.downPaymentAmount || 0);
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
           VALUES (?, ?, 0, ?, ?, ?, ?, NULL, NULL)`,
          [downPaymentAmount, downPaymentAmount, billingID, guestID, staffID, paymentMethodID]
        );
        const paymentID = paymentInsert.insertId;

        // 7. Insert Transaction log
        await conn.execute(
          "INSERT INTO transactions (transactionDateTime, billingID, paymentID) VALUES (?, ?, ?)",
          [nowStr, billingID, paymentID]
        );

        // 8. Update Room status to Reserved
        await conn.execute("UPDATE room SET status = 'Reserved' WHERE roomID = ?", [roomID]);

        await conn.commit();
        return NextResponse.json({ success: true, message: 'Reservation successfully converted to Booking.' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process reservation action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
