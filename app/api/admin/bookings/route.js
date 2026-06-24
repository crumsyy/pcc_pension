import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const statusF = searchParams.get('status') || '';
  const dateF = searchParams.get('date') || '';

  try {
    let sql = `
      SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
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
    if (statusF) {
      sql += " AND b.status = ?";
      params.push(statusF);
    }
    if (dateF) {
      sql += " AND DATE(b.checkInDateTime) = ?";
      params.push(dateF);
    }

    sql += " ORDER BY b.checkInDateTime DESC";

    const bookings = await dbQuery(sql, params);

    // Get count breakdown by status
    const rawCounts = await dbQuery("SELECT status, COUNT(*) as cnt FROM booking GROUP BY status");
    const counts = rawCounts.reduce((acc, row) => {
      acc[row.status] = row.cnt;
      return acc;
    }, {});

    return NextResponse.json({ bookings, counts });
  } catch (error) {
    console.error("Failed to fetch bookings:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
