import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Room counts by status
    const roomStatsRaw = await dbQuery("SELECT status, COUNT(*) as cnt FROM room GROUP BY status");
    const roomStats = roomStatsRaw.reduce((acc, row) => {
      acc[row.status] = row.cnt;
      return acc;
    }, {});

    const totalRoomsRes = await dbQuery("SELECT COUNT(*) as count FROM room");
    const totalRooms = totalRoomsRes[0]?.count || 0;

    // 2. Revenue summaries
    const todayRevenueRes = await dbQuery(`
      SELECT COALESCE(SUM(p.amount), 0) as amount 
      FROM payment p
      JOIN transactions t ON t.paymentID = p.paymentID
      WHERE DATE(t.transactionDateTime) = CURDATE()
    `);
    const todayRevenue = parseFloat(todayRevenueRes[0]?.amount || 0);

    const monthRevenueRes = await dbQuery(`
      SELECT COALESCE(SUM(p.amount), 0) as amount 
      FROM payment p
      JOIN transactions t ON t.paymentID = p.paymentID
      WHERE MONTH(t.transactionDateTime) = MONTH(NOW())
        AND YEAR(t.transactionDateTime) = YEAR(NOW())
    `);
    const monthRevenue = parseFloat(monthRevenueRes[0]?.amount || 0);

    // 3. Activity counts
    const todayCheckInRes = await dbQuery(`
      SELECT COUNT(*) as count 
      FROM booking 
      WHERE DATE(checkInDateTime) = CURDATE() 
        AND status IN ('Confirmed', 'Pending')
    `);
    const todayCheckIn = todayCheckInRes[0]?.count || 0;

    const todayCheckOutRes = await dbQuery(`
      SELECT COUNT(*) as count 
      FROM booking 
      WHERE DATE(checkOutDateTime) = CURDATE() 
        AND status = 'Checked In'
    `);
    const todayCheckOut = todayCheckOutRes[0]?.count || 0;

    // 4. Low stock alert count
    const lowStockCountRes = await dbQuery(`
      SELECT COUNT(*) as count FROM (
        SELECT amenityID FROM amenities WHERE quantity <= 5
        UNION ALL
        SELECT productID FROM products WHERE quantity <= 5
      ) low
    `);
    const lowStockCount = lowStockCountRes[0]?.count || 0;

    // 5. Pending reservations count
    const pendingResRes = await dbQuery("SELECT COUNT(*) as count FROM reservation WHERE status = 'Pending'");
    const pendingResCount = pendingResRes[0]?.count || 0;

    // 6. Room status board grid
    const rooms = await dbQuery(`
      SELECT rm.roomNumber, rm.status, rt.type as roomType, fl.name as floor
      FROM room rm
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      JOIN floor fl ON fl.floorID = rm.floorID
      ORDER BY fl.name, rm.roomNumber
    `);

    // 7. Recent reservations list (last 6)
    const recentRes = await dbQuery(`
      SELECT r.reservationID, r.reservationDateTime, r.status,
             g.firstName, g.lastName, rm.roomNumber, rt.type
      FROM reservation r
      JOIN guest g ON g.guestID = r.guestID
      JOIN room rm ON rm.roomID = r.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      ORDER BY r.reservationDateTime DESC 
      LIMIT 6
    `);

    // 8. Recent bookings list (last 6)
    const recentBookings = await dbQuery(`
      SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
             g.firstName, g.lastName, rm.roomNumber, rt.type
      FROM booking b
      JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      ORDER BY b.checkInDateTime DESC 
      LIMIT 6
    `);

    return NextResponse.json({
      roomStats,
      totalRooms,
      todayRevenue,
      monthRevenue,
      todayCheckIn,
      todayCheckOut,
      lowStockCount,
      pendingResCount,
      rooms,
      recentRes,
      recentBookings
    });

  } catch (error) {
    console.error("Failed to generate dashboard statistics:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
