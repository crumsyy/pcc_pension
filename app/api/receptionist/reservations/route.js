import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [reservations, guests, rooms] = await Promise.all([
      dbQuery(`
        SELECT r.reservationID, r.reservationDateTime, r.status, r.guestID, r.roomID,
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
      dbQuery("SELECT guestID, firstName, lastName, contact FROM guest ORDER BY lastName, firstName"),
      dbQuery(`
        SELECT r.roomID, r.roomNumber, r.status, rt.type as roomType 
        FROM room r 
        JOIN room_type rt ON rt.roomTypeID = r.roomTypeID 
        WHERE r.isArchived = 0 
        ORDER BY r.roomNumber
      `)
    ]);

    return NextResponse.json({ reservations, guests, rooms });
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
      // Update room status
      await dbQuery("UPDATE room SET status = 'Reserved' WHERE roomID = ?", [roomID]);

      return NextResponse.json({ success: true, message: 'Reservation created successfully.' });
    }

    if (action === 'confirm') {
      const reservationID = parseInt(body.reservationID);
      const res = await dbQuery("SELECT * FROM reservation WHERE reservationID = ?", [reservationID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
      }
      const { guestID, roomID, reservationDateTime } = res[0];

      const pool = await getDbConnection();
      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        // 1. Update reservation status to Confirmed
        await conn.execute("UPDATE reservation SET status = 'Confirmed' WHERE reservationID = ?", [reservationID]);

        // 2. Insert booking
        // Default stay check-in/out:
        // checkInDateTime = reservationDateTime
        // checkOutDateTime = reservationDateTime + 1 day, at 12:00:00
        const checkInDate = new Date(reservationDateTime);
        const checkOutDate = new Date(checkInDate);
        checkOutDate.setDate(checkOutDate.getDate() + 1);
        checkOutDate.setHours(12, 0, 0, 0);

        const pad = (num) => String(num).padStart(2, '0');
        const checkInStr = `${checkInDate.getFullYear()}-${pad(checkInDate.getMonth() + 1)}-${pad(checkInDate.getDate())} ${pad(checkInDate.getHours())}:${pad(checkInDate.getMinutes())}:${pad(checkInDate.getSeconds())}`;
        const checkOutStr = `${checkOutDate.getFullYear()}-${pad(checkOutDate.getMonth() + 1)}-${pad(checkOutDate.getDate())} 12:00:00`;

        const [insertBookingRes] = await conn.execute(
          "INSERT INTO booking(checkInDateTime, checkOutDateTime, status, reservationID, guestID, roomID) VALUES(?, ?, 'Confirmed', ?, ?, ?)",
          [checkInStr, checkOutStr, reservationID, guestID, roomID]
        );
        const bookingID = insertBookingRes.insertId;

        // 3. Seed default guest details
        const [guestInfo] = await conn.execute("SELECT firstName, lastName FROM guest WHERE guestID = ?", [guestID]);
        const defaultName = guestInfo.length > 0 ? `${guestInfo[0].firstName} ${guestInfo[0].lastName}` : 'Primary Guest';
        await conn.execute(
          "INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber) VALUES (?, ?, 30, NULL, NULL)",
          [bookingID, defaultName]
        );

        // 4. Update Room status
        await conn.execute("UPDATE room SET status = 'Reserved' WHERE roomID = ?", [roomID]);

        await conn.commit();
        return NextResponse.json({ success: true, message: 'Reservation confirmed and auto-converted to a confirmed booking.' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    if (action === 'cancel') {
      const reservationID = parseInt(body.reservationID);
      const res = await dbQuery("SELECT roomID FROM reservation WHERE reservationID = ?", [reservationID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
      }
      const roomID = res[0].roomID;

      await dbQuery("UPDATE reservation SET status = 'Canceled' WHERE reservationID = ?", [reservationID]);
      await dbQuery("UPDATE room SET status = 'Available' WHERE roomID = ?", [roomID]);

      return NextResponse.json({ success: true, message: 'Reservation canceled.' });
    }

    if (action === 'convert_to_booking') {
      const reservationID = parseInt(body.reservationID);
      const checkInDateTime = body.checkInDateTime;
      const checkOutDateTime = body.checkOutDateTime;
      const status = body.status || 'Confirmed';

      const res = await dbQuery("SELECT * FROM reservation WHERE reservationID = ?", [reservationID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
      }
      const { guestID, roomID } = res[0];

      // Create Booking
      const insertBookingRes = await dbQuery(
        "INSERT INTO booking(checkInDateTime, checkOutDateTime, status, reservationID, guestID, roomID) VALUES(?, ?, ?, ?, ?, ?)",
        [checkInDateTime, checkOutDateTime, status, reservationID, guestID, roomID]
      );
      const bookingID = insertBookingRes.insertId;

      // Seed default guest details
      const guestInfo = await dbQuery("SELECT firstName, lastName FROM guest WHERE guestID = ?", [guestID]);
      const defaultName = guestInfo.length > 0 ? `${guestInfo[0].firstName} ${guestInfo[0].lastName}` : 'Primary Guest';
      await dbQuery(
        "INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber) VALUES (?, ?, 30, NULL, NULL)",
        [bookingID, defaultName]
      );

      // Update Reservation
      await dbQuery("UPDATE reservation SET status = 'Confirmed' WHERE reservationID = ?", [reservationID]);

      // Update Room
      const roomStatus = status === 'Checked In' ? 'Occupied' : 'Reserved';
      await dbQuery("UPDATE room SET status = ? WHERE roomID = ?", [roomStatus, roomID]);

      return NextResponse.json({ success: true, message: 'Reservation converted to booking successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process reservation action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
