import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [bookings, guests, rooms] = await Promise.all([
      dbQuery(`
        SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status, b.reservationID, b.guestID, b.roomID, b.cancelRemarks,
               g.firstName, g.middleName, g.lastName, g.contact, g.email, g.gender,
               rm.roomNumber, rt.type as roomType
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        JOIN room rm ON rm.roomID = b.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE rm.isArchived = 0
        ORDER BY b.checkInDateTime DESC
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

    return NextResponse.json({ bookings, guests, rooms });
  } catch (error) {
    console.error("Failed to fetch bookings data:", error);
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
      const checkInDateTime = body.checkInDateTime;
      const checkOutDateTime = body.checkOutDateTime;
      const status = body.status || 'Confirmed'; // 'Confirmed', 'Checked In', 'Pending'

      if (!guestID || !roomID || !checkInDateTime || !checkOutDateTime) {
        return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
      }

      await dbQuery(
        "INSERT INTO booking(checkInDateTime, checkOutDateTime, status, reservationID, guestID, roomID) VALUES(?, ?, ?, NULL, ?, ?)",
        [checkInDateTime, checkOutDateTime, status, guestID, roomID]
      );

      // Update room status
      const roomStatus = status === 'Checked In' ? 'Occupied' : 'Reserved';
      await dbQuery("UPDATE room SET status = ? WHERE roomID = ?", [roomStatus, roomID]);

      return NextResponse.json({ success: true, message: 'Booking created successfully.' });
    }

    if (action === 'checkin') {
      const bookingID = parseInt(body.bookingID);
      
      const res = await dbQuery("SELECT roomID FROM booking WHERE bookingID = ?", [bookingID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }
      const roomID = res[0].roomID;

      await dbQuery("UPDATE booking SET status = 'Checked In', checkInDateTime = NOW() WHERE bookingID = ?", [bookingID]);
      await dbQuery("UPDATE room SET status = 'Occupied' WHERE roomID = ?", [roomID]);

      return NextResponse.json({ success: true, message: 'Guest checked in successfully.' });
    }

    if (action === 'checkout') {
      const bookingID = parseInt(body.bookingID);
      
      const res = await dbQuery("SELECT roomID FROM booking WHERE bookingID = ?", [bookingID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }
      const roomID = res[0].roomID;

      await dbQuery("UPDATE booking SET status = 'Checked Out', checkOutDateTime = NOW() WHERE bookingID = ?", [bookingID]);
      await dbQuery("UPDATE room SET status = 'Available' WHERE roomID = ?", [roomID]);

      return NextResponse.json({ success: true, message: 'Guest checked out successfully.' });
    }

    if (action === 'cancel') {
      const bookingID = parseInt(body.bookingID);
      const cancelRemarks = body.cancelRemarks?.trim() || '';
      if (!cancelRemarks) {
        return NextResponse.json({ error: 'Cancellation remarks are mandatory.' }, { status: 400 });
      }
      
      const res = await dbQuery("SELECT roomID FROM booking WHERE bookingID = ?", [bookingID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }
      const roomID = res[0].roomID;

      await dbQuery("UPDATE booking SET status = 'Canceled', cancelRemarks = ? WHERE bookingID = ?", [cancelRemarks, bookingID]);
      await dbQuery("UPDATE room SET status = 'Available' WHERE roomID = ?", [roomID]);

      return NextResponse.json({ success: true, message: 'Booking canceled successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process booking action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
