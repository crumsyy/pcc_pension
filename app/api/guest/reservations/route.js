import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, syncRoomStatuses } from '@/lib/db';

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
      SELECT r.reservationID, r.reservationDateTime, r.status, r.roomID,
             rm.roomNumber, rm.floorID, rt.type as roomType, fl.name as floor,
             COALESCE(rr.rate, 1500) as rate
      FROM reservation r
      JOIN room rm ON rm.roomID = r.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      JOIN floor fl ON fl.floorID = rm.floorID
      LEFT JOIN room_rate rr ON rr.roomTypeID = rm.roomTypeID AND rr.floorID = rm.floorID AND rr.breakfastID = 1
      WHERE r.guestID = ?
      ORDER BY r.reservationDateTime DESC
    `, [guestID]) : [];

    // Fetch ALL active rooms in pension house created by admin
    const allRooms = await dbQuery(`
      SELECT r.roomID, r.roomNumber, r.floorID, r.status, r.occupancyLimit,
             COALESCE(rt.type, 'Standard Room') as roomType,
             COALESCE(fl.name, 'Ground Floor') as floorName,
             (
               SELECT COALESCE(MIN(rr.rate), 1500)
               FROM room_rate rr
               WHERE rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID
             ) as rate
      FROM room r
      LEFT JOIN room_type rt ON rt.roomTypeID = r.roomTypeID
      LEFT JOIN floor fl ON fl.floorID = r.floorID
      WHERE r.isArchived = 0
      ORDER BY r.floorID ASC, r.roomNumber ASC
    `);

    const availableRooms = allRooms.filter(r => r.status === 'Available');

    return NextResponse.json({ success: true, reservations, allRooms, availableRooms });
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

    const guests = await dbQuery("SELECT guestID, firstName, lastName FROM guest WHERE userID = ?", [session.userID]);
    if (guests.length === 0) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }
    const guest = guests[0];

    if (action === 'cancel') {
      const reservationID = parseInt(body.reservationID);
      if (!reservationID) {
        return NextResponse.json({ error: 'Reservation ID is required.' }, { status: 400 });
      }

      await dbQuery(
        "UPDATE reservation SET status = 'Cancelled' WHERE reservationID = ? AND guestID = ?",
        [reservationID, guest.guestID]
      );

      // Notify receptionists
      const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
      for (const r of staffToNotify) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Reservation Canceled', ?)",
          [r.userID, `Guest ${guest.firstName} ${guest.lastName} has canceled Reservation #${reservationID}.`]
        );
      }

      return NextResponse.json({ success: true, message: 'Reservation request canceled successfully.' });
    }

    // Default action: Create reservation
    const { roomID, checkInDate, checkOutDate, specialRequests, numGuests } = body; // checkInDate is YYYY-MM-DD

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

    // Rule 1A: Reservation Date Restrictions (Today up to 2 days ahead maximum allowed)
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const maxDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const maxDateStr = `${maxDate.getFullYear()}-${pad(maxDate.getMonth() + 1)}-${pad(maxDate.getDate())}`;

    if (checkInDate < todayStr) {
      return NextResponse.json({
        error: "Reservation or booking has already passed."
      }, { status: 400 });
    }

    if (checkInDate > maxDateStr) {
      return NextResponse.json({
        error: "Reservations can only be made for Today, Tomorrow, or the Next Day (up to 2 days ahead maximum)."
      }, { status: 400 });
    }

    // Allow guests to reserve multiple rooms (Rule 1B restriction removed)

    // Rule 1C: Duplicate Reservation Validation
    const dupRes = await dbQuery(
      "SELECT reservationID FROM reservation WHERE guestID = ? AND roomID = ? AND status IN ('Pending', 'Confirmed')",
      [guest.guestID, roomID]
    );
    if (dupRes.length > 0) {
      return NextResponse.json({
        error: "You already have an active reservation for this room."
      }, { status: 400 });
    }

    const roomRes = await dbQuery(
      "SELECT r.roomNumber, rt.type as roomType FROM room r JOIN room_type rt ON rt.roomTypeID = r.roomTypeID WHERE r.roomID = ?",
      [roomID]
    );
    const roomInfo = roomRes[0] || { roomNumber: 'N/A', roomType: 'Room' };

    const reservationDateTime = `${checkInDate} 14:00:00`;
    const checkOutDateTimeFormatted = checkOutDate ? `${checkOutDate} 12:00:00` : null;

    const insertRes = await dbQuery(
      "INSERT INTO reservation (reservationDateTime, checkOutDateTime, guestCount, specialRequests, status, guestID, roomID) VALUES (?, ?, ?, ?, 'Pending', ?, ?)",
      [reservationDateTime, checkOutDateTimeFormatted, parseInt(numGuests || 1), specialRequests || null, guest.guestID, roomID]
    );

    // Add user notification
    await dbQuery(
      "INSERT INTO notification (userID, title, message) VALUES (?, 'Reservation Submitted', ?)",
      [
        session.userID,
        `Your reservation request for Room ${roomInfo.roomNumber} (${roomInfo.roomType}) on ${checkInDate} has been submitted. Front Desk will review it shortly.`
      ]
    );

    // Notify active receptionists
    const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
    for (const r of staffToNotify) {
      await dbQuery(
        "INSERT INTO notification (userID, title, message) VALUES (?, 'New Guest Reservation', ?)",
        [r.userID, `Guest ${guest.firstName} ${guest.lastName} submitted a new reservation for Room ${roomInfo.roomNumber}.`]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Reservation request for Room ${roomInfo.roomNumber} submitted successfully!`,
      reservationID: insertRes.insertId,
      summary: {
        reservationID: insertRes.insertId,
        roomNumber: roomInfo.roomNumber,
        roomType: roomInfo.roomType,
        checkInDate,
        checkOutDate: checkOutDate || 'Standard 12:00 PM',
        specialRequests: specialRequests || 'None',
        numGuests: numGuests || 1,
        status: 'Pending'
      }
    });
  } catch (error) {
    console.error("Failed to process guest reservation:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
