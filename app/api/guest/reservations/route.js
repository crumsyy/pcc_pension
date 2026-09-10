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
      SELECT r.reservationID, r.reservationDateTime, r.checkOutDateTime,
             r.isCourtesyHold, r.holdDurationHours, r.holdExpiryDateTime,
             r.warning12SentAt, r.warning6SentAt, r.releasedAt,
             r.guestCount, r.specialRequests,
             CASE 
               WHEN r.status = 'Courtesy Hold' AND (r.holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(r.holdExpiryDateTime, INTERVAL 30 MINUTE)) THEN 'Courtesy Hold'
               WHEN r.status = 'Courtesy Hold' AND NOW() > DATE_ADD(r.holdExpiryDateTime, INTERVAL 30 MINUTE) THEN 'Released'
               WHEN r.status IN ('Confirmed', 'Pending', 'Booked') AND NOW() >= r.reservationDateTime AND NOW() <= DATE_ADD(r.reservationDateTime, INTERVAL 1 HOUR) THEN 'Overdue Check-In'
               WHEN r.status IN ('Confirmed', 'Pending', 'Booked') AND (r.reservationDateTime < DATE_SUB(NOW(), INTERVAL 1 HOUR) OR (r.checkOutDateTime IS NOT NULL AND NOW() > r.checkOutDateTime)) THEN 'No Show'
               ELSE r.status
             END as status,
             r.roomID,
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
      SELECT r.roomID, r.roomNumber, r.floorID, r.status, r.occupancyLimit, r.image, r.description,
             r.breakfastRate,
             COALESCE(rt.type, 'Standard Room') as roomType,
             COALESCE(fl.name, 'Ground Floor') as floorName,
             (
               SELECT COALESCE(MIN(rr.rate), 1500)
               FROM room_rate rr
               WHERE rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID
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
      WHERE status NOT IN ('Cancelled', 'Checked Out', 'No Show', 'Released')
        AND (
          reservationDateTime >= CURDATE()
          OR (status = 'Courtesy Hold' AND (holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(holdExpiryDateTime, INTERVAL 30 MINUTE)))
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

      // Notify receptionists
      const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
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

    // All reservations are Courtesy Holds (fixed 48h duration + 30m grace period)
    const isCourtesyHold = true;
    const holdDurationHours = 48;
    const holdExpiryDateObj = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const holdExpiryDateTime = `${holdExpiryDateObj.getFullYear()}-${pad(holdExpiryDateObj.getMonth() + 1)}-${pad(holdExpiryDateObj.getDate())} ${pad(holdExpiryDateObj.getHours())}:${pad(holdExpiryDateObj.getMinutes())}:${pad(holdExpiryDateObj.getSeconds())}`;
    const resStatus = 'Courtesy Hold';

    // Rule 1C: Duplicate Reservation / Hold Validation
    const dupRes = await dbQuery(`
      SELECT reservationID FROM reservation 
      WHERE guestID = ? AND roomID = ? 
        AND (
          status IN ('Pending', 'Confirmed', 'Booked')
          OR (status = 'Courtesy Hold' AND (holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(holdExpiryDateTime, INTERVAL 30 MINUTE)))
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
    const checkInD = new Date(checkInDate + 'T14:00:00');
    let checkOutD;
    if (checkOutDate) {
      checkOutD = new Date(checkOutDate + 'T12:00:00');
    } else {
      checkOutD = new Date(checkInD.getTime() + 24 * 60 * 60 * 1000);
      checkOutD.setHours(12, 0, 0, 0);
    }
    const checkOutDateTimeFormatted = checkOutDate ? `${checkOutDate} 12:00:00` : null;
    const reqCheckOutSql = `${checkOutD.getFullYear()}-${pad(checkOutD.getMonth() + 1)}-${pad(checkOutD.getDate())} 12:00:00`;
    const reservationDateTime = `${checkInDate} 14:00:00`;

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
          (status IN ('Pending', 'Confirmed', 'Booked') AND reservationDateTime < ? AND COALESCE(checkOutDateTime, DATE_ADD(reservationDateTime, INTERVAL 1 DAY)) > ?)
          OR
          (status = 'Courtesy Hold' AND (holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(holdExpiryDateTime, INTERVAL 30 MINUTE)) AND reservationDateTime < ? AND COALESCE(checkOutDateTime, DATE_ADD(reservationDateTime, INTERVAL 1 DAY)) > ?)
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

    // Zero billing record generated for courtesy holds / confirmed booking records
    const insertRes = await dbQuery(
      `INSERT INTO reservation (
        reservationDateTime, checkOutDateTime, guestCount, specialRequests, status,
        guestID, roomID, isCourtesyHold, holdDurationHours, holdExpiryDateTime, guestEmail
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        guest.email || null
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

    // Notify active receptionists
    const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
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
      message: `Courtesy hold for Room ${roomInfo.roomNumber} placed successfully! Room is held for 48 hours.`,
      reservationID: insertRes.insertId,
      summary: {
        reservationID: insertRes.insertId,
        roomNumber: roomInfo.roomNumber,
        roomType: roomInfo.roomType,
        checkInDate,
        checkOutDate: checkOutDate || 'Standard 12:00 PM',
        specialRequests: specialRequests || 'None',
        numGuests: numGuests || 1,
        status: resStatus,
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
