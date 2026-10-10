import { NextResponse } from 'next/server';
import { dbQuery, syncRoomStatuses } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const checkIn = searchParams.get('checkIn');
  const checkOut = searchParams.get('checkOut');
  const roomType = searchParams.get('roomType') || 'Any room type';
  const breakfast = searchParams.get('breakfast') || 'With Breakfast';

  if (!checkIn || !checkOut) {
    return NextResponse.json({ error: 'Check-in and Check-out dates are required.' }, { status: 400 });
  }

  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  if (checkIn < todayStr) {
    return NextResponse.json({ error: 'Check-in date cannot be in the past.' }, { status: 400 });
  }

  if (checkIn === checkOut || new Date(checkOut + 'T00:00:00') <= new Date(checkIn + 'T00:00:00')) {
    return NextResponse.json({ error: 'Check-in date and Check-out date cannot be the same. Check-out date must be strictly after Check-in date.' }, { status: 400 });
  }

  await syncRoomStatuses();

  try {
    const checkInDateTime = `${checkIn} 14:00:00`;
    const checkOutDateTime = `${checkOut} 12:00:00`;
    const breakfastID = breakfast === 'With Breakfast' ? 2 : 1;

    let query = `
      SELECT r.roomID, r.roomNumber, rt.type as roomType, rt.description, rr.rate, fl.name as floor,
             r.breakfastRate, r.image, r.occupancyLimit,
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
      JOIN room_type rt ON rt.roomTypeID = r.roomTypeID
      JOIN floor fl ON fl.floorID = r.floorID
      JOIN room_rate rr ON rr.roomTypeID = rt.roomTypeID AND rr.floorID = r.floorID AND rr.breakfastID = ?
      WHERE r.isArchived = 0
        AND r.status != 'Under Maintenance'
        AND r.roomID NOT IN (
          SELECT DISTINCT b.roomID
          FROM booking b
          WHERE b.status NOT IN ('Cancelled', 'Canceled', 'Checked Out', 'Completed', 'No Show')
            AND b.checkInDateTime < ?
            AND b.checkOutDateTime > ?
        )
        AND r.roomID NOT IN (
          SELECT DISTINCT res.roomID
          FROM reservation res
          WHERE res.status IN ('Pending', 'Reserved', 'Confirmed', 'On Hold', 'Courtesy Hold')
            AND res.reservationDateTime < ?
            AND COALESCE(res.checkOutDateTime, DATE_ADD(res.reservationDateTime, INTERVAL 1 DAY)) > ?
            AND (
              res.status NOT IN ('On Hold', 'Courtesy Hold')
              OR res.holdExpiryDateTime IS NULL
              OR NOW() <= DATE_ADD(res.holdExpiryDateTime, INTERVAL 30 MINUTE)
            )
        )
    `;

    const params = [breakfastID, checkOutDateTime, checkInDateTime, checkOutDateTime, checkInDateTime];

    if (roomType !== 'Any room type') {
      query += " AND rt.type = ?";
      params.push(roomType);
    }

    query += " ORDER BY r.roomNumber";

    const rooms = await dbQuery(query, params);
    return NextResponse.json({ success: true, rooms });
  } catch (error) {
    console.error("Failed to check room availability:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
