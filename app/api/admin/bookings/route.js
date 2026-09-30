import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { dbQuery, normalizeBookingStatus, BOOKING_STATUSES } from '@/lib/db';

export async function GET(request) {
  const auth = await verifyAdmin();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const statusF = searchParams.get('status') || '';
  const dateF = searchParams.get('date') || '';

  try {
    let sql = `
      SELECT b.bookingID, DATE_FORMAT(b.checkInDateTime, '%Y-%m-%dT%H:%i:%s') as checkInDateTime, DATE_FORMAT(b.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime, b.status,
             g.firstName, g.lastName, g.contact,
             rm.roomNumber, rt.type as roomType, fl.name as floor
      FROM booking b
      JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      JOIN floor fl ON fl.floorID = rm.floorID
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      const like = `%${search}%`;
      sql += " AND (g.firstName LIKE ? OR g.lastName LIKE ? OR rm.roomNumber LIKE ?)";
      params.push(like, like, like);
    }
    if (dateF) {
      sql += " AND DATE(b.checkInDateTime) = ?";
      params.push(dateF);
    }

    sql += " ORDER BY b.checkInDateTime DESC";

    const rawBookings = await dbQuery(sql, params);

    const allNormalized = rawBookings.map(b => ({
      ...b,
      status: normalizeBookingStatus(b.status),
      rawStatus: b.status
    }));

    const bookings = statusF 
      ? allNormalized.filter(b => b.status === statusF)
      : allNormalized;

    // Get count breakdown by unified status
    const counts = {};
    BOOKING_STATUSES.forEach(st => { counts[st] = 0; });
    allNormalized.forEach(b => {
      if (counts[b.status] !== undefined) {
        counts[b.status]++;
      } else {
        counts[b.status] = 1;
      }
    });

    return NextResponse.json({ bookings, counts, statuses: BOOKING_STATUSES });
  } catch (error) {
    console.error("Failed to fetch bookings:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
