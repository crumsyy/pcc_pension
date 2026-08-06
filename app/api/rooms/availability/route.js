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

  if (checkIn === checkOut || new Date(checkOut + 'T00:00:00') <= new Date(checkIn + 'T00:00:00')) {
    return NextResponse.json({ error: 'Check-in date and Check-out date cannot be the same. Check-out date must be strictly after Check-in date.' }, { status: 400 });
  }

  await syncRoomStatuses();

  try {
    const checkInDateTime = `${checkIn} 14:00:00`;
    const checkOutDateTime = `${checkOut} 12:00:00`;
    const breakfastID = breakfast === 'With Breakfast' ? 2 : 1;

    let query = `
      SELECT r.roomID, r.roomNumber, rt.type as roomType, rt.description, rr.rate, fl.name as floor
      FROM room r
      JOIN room_type rt ON rt.roomTypeID = r.roomTypeID
      JOIN floor fl ON fl.floorID = r.floorID
      JOIN room_rate rr ON rr.roomTypeID = rt.roomTypeID AND rr.floorID = r.floorID AND rr.breakfastID = ?
      WHERE r.isArchived = 0
        AND r.status != 'Under Maintenance'
        AND r.roomID NOT IN (
          SELECT DISTINCT b.roomID
          FROM booking b
          WHERE b.status NOT IN ('Cancelled', 'Checked Out', 'No Show')
            AND b.checkInDateTime < ?
            AND b.checkOutDateTime > ?
        )
    `;

    const params = [breakfastID, checkOutDateTime, checkInDateTime];

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
