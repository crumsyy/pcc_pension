import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { dbQuery, syncRoomStatuses } from '@/lib/db';
import { RESERVATION_STATUSES, normalizeReservationStatus } from '@/lib/bookingStatuses';

export async function GET(request) {
  const auth = await verifyAdmin();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const statusF = searchParams.get('status') || '';
  const dateF = searchParams.get('date') || '';

  try {
    await syncRoomStatuses();

    let sql = `
      SELECT r.reservationID,
             DATE_FORMAT(r.reservationDateTime, '%Y-%m-%dT%H:%i:%s') as reservationDateTime,
             DATE_FORMAT(r.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime,
             r.isCourtesyHold, r.holdDurationHours,
             DATE_FORMAT(r.holdExpiryDateTime, '%Y-%m-%dT%H:%i:%s') as holdExpiryDateTime,
             COALESCE(r.guestCount, 1) as guestCount,
             COALESCE(r.breakfastOption, 'with') as breakfastOption,
             r.specialRequests,
             CASE 
               WHEN r.status IN ('On Hold', 'Courtesy Hold') AND (r.holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(r.holdExpiryDateTime, INTERVAL 30 MINUTE)) THEN 'On Hold'
               WHEN r.status IN ('On Hold', 'Courtesy Hold') AND NOW() > DATE_ADD(r.holdExpiryDateTime, INTERVAL 30 MINUTE) THEN 'Cancelled'
               WHEN r.status IN ('Confirmed', 'Booked') OR b.bookingID IS NOT NULL THEN 'Booked'
               WHEN r.status IN ('Cancelled', 'Canceled', 'Released', 'Expired', 'No Show') THEN 'Cancelled'
               ELSE 'Reserved'
             END as computedStatus,
             r.status as rawStatus,
             r.guestID, r.roomID,
             COALESCE(g.firstName, 'Guest') as firstName,
             COALESCE(g.lastName, '') as lastName,
             g.contact,
             COALESCE(r.guestEmail, g.email, '') as email,
             rm.roomNumber,
             COALESCE(rt.type, 'Standard Room') as roomType,
             fl.name as floor,
             b.bookingID,
             b.status as bookingStatus
      FROM reservation r
      JOIN guest g ON g.guestID = r.guestID
      JOIN room rm ON rm.roomID = r.roomID
      LEFT JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      LEFT JOIN floor fl ON fl.floorID = rm.floorID
      LEFT JOIN booking b ON b.reservationID = r.reservationID
      WHERE rm.isArchived = 0
    `;
    const params = [];

    if (search) {
      const like = `%${search}%`;
      sql += " AND (g.firstName LIKE ? OR g.lastName LIKE ? OR rm.roomNumber LIKE ? OR g.contact LIKE ? OR g.email LIKE ? OR r.guestEmail LIKE ? OR r.reservationID = ?)";
      params.push(like, like, like, like, like, like, search);
    }
    if (dateF) {
      sql += " AND DATE(r.reservationDateTime) = ?";
      params.push(dateF);
    }

    sql += " ORDER BY r.reservationDateTime DESC";

    const rawReservations = await dbQuery(sql, params);

    const allNormalized = rawReservations.map(r => ({
      ...r,
      status: normalizeReservationStatus(r.computedStatus || r.rawStatus),
    }));

    const reservations = statusF
      ? allNormalized.filter(r => r.status === statusF)
      : allNormalized;

    // Count breakdown by status
    const counts = { All: allNormalized.length };
    RESERVATION_STATUSES.forEach(st => { counts[st] = 0; });
    allNormalized.forEach(r => {
      if (counts[r.status] !== undefined) {
        counts[r.status]++;
      } else {
        counts[r.status] = 1;
      }
    });

    return NextResponse.json({
      reservations,
      counts,
      total: allNormalized.length
    });
  } catch (error) {
    console.error('Admin reservations API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reservations', details: error.message },
      { status: 500 }
    );
  }
}
