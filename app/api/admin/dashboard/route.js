import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { dbQuery, syncRoomStatuses, syncInventoryStock } from '@/lib/db';

export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) return auth.response;

  await syncRoomStatuses();
  await syncInventoryStock();

  try {
    const [
      roomStatsRaw,
      totalRoomsRes,
      todayRevenueRes,
      monthRevenueRes,
      todayCheckInRes,
      todayCheckOutRes,
      lowStockCountRes,
      pendingResRes,
      rooms,
      recentRes,
      recentBookings
    ] = await Promise.all([
      dbQuery("SELECT status, COUNT(*) as cnt FROM room WHERE isArchived = 0 GROUP BY status"),
      dbQuery("SELECT COUNT(*) as count FROM room WHERE isArchived = 0"),
      dbQuery(`
        SELECT COALESCE(SUM(p.amount), 0) as amount 
        FROM payment p
        JOIN transactions t ON t.paymentID = p.paymentID
        WHERE DATE(t.transactionDateTime) = CURDATE()
          AND (p.status IS NULL OR p.status = 'Settled')
      `),
      dbQuery(`
        SELECT COALESCE(SUM(p.amount), 0) as amount 
        FROM payment p
        JOIN transactions t ON t.paymentID = p.paymentID
        WHERE MONTH(t.transactionDateTime) = MONTH(NOW())
          AND YEAR(t.transactionDateTime) = YEAR(NOW())
          AND (p.status IS NULL OR p.status = 'Settled')
      `),
      dbQuery(`
        SELECT COUNT(*) as count 
        FROM booking 
        WHERE DATE(checkInDateTime) = CURDATE() 
          AND status IN ('Confirmed', 'Pending', 'Checked In')
      `),
      dbQuery(`
        SELECT COUNT(*) as count 
        FROM booking 
        WHERE DATE(checkOutDateTime) = CURDATE() 
          AND status = 'Checked In'
      `),
      dbQuery(`
        SELECT COUNT(*) as count FROM (
          SELECT amenityID FROM amenities WHERE quantity <= minStock
          UNION ALL
          SELECT productID FROM products WHERE quantity <= minStock AND productCategoryID != 3
        ) low
      `),
      dbQuery("SELECT COUNT(*) as count FROM reservation WHERE status = 'Pending'"),
      dbQuery(`
        SELECT rm.roomNumber, rm.status, rt.type as roomType, fl.name as floor
        FROM room rm
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        JOIN floor fl ON fl.floorID = rm.floorID
        WHERE rm.isArchived = 0
        ORDER BY fl.name, rm.roomNumber
      `),
      dbQuery(`
        SELECT r.reservationID, DATE_FORMAT(r.reservationDateTime, '%Y-%m-%dT%H:%i:%s') as reservationDateTime, r.status,
               g.firstName, g.lastName, rm.roomNumber, rt.type
        FROM reservation r
        JOIN guest g ON g.guestID = r.guestID
        JOIN room rm ON rm.roomID = r.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE r.status IN ('Pending', 'Confirmed', 'Courtesy Hold', 'Reserved', 'Overdue Check-In')
          AND r.status NOT IN ('Cancelled', 'Canceled', 'Released', 'Expired', 'No Show', 'Booked', 'Completed')
          AND NOT EXISTS (SELECT 1 FROM booking b WHERE b.reservationID = r.reservationID)
        ORDER BY r.reservationDateTime ASC 
        LIMIT 6
      `),
      dbQuery(`
        SELECT b.bookingID, DATE_FORMAT(b.checkInDateTime, '%Y-%m-%dT%H:%i:%s') as checkInDateTime, DATE_FORMAT(b.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime, b.status,
               g.firstName, g.lastName, rm.roomNumber, rt.type
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        JOIN room rm ON rm.roomID = b.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE b.status IN ('Checked In', 'Active Stay', 'Late Checkout', 'Pending Room Verification', 'Room Verified', 'Bill Finalized', 'Final Billing Updated', 'Confirmed', 'Pending Check-in', 'Pending', 'Booked', 'Active')
          AND b.status NOT IN ('Completed', 'Checked Out', 'Cancelled', 'No Show')
        ORDER BY b.checkInDateTime ASC 
        LIMIT 6
      `)
    ]);

    const roomStats = roomStatsRaw.reduce((acc, row) => {
      acc[row.status] = row.cnt;
      return acc;
    }, {});

    const totalRooms = totalRoomsRes[0]?.count || 0;
    const todayRevenue = parseFloat(todayRevenueRes[0]?.amount || 0);
    const monthRevenue = parseFloat(monthRevenueRes[0]?.amount || 0);
    const todayCheckIn = todayCheckInRes[0]?.count || 0;
    const todayCheckOut = todayCheckOutRes[0]?.count || 0;
    const lowStockCount = lowStockCountRes[0]?.count || 0;
    const pendingResCount = pendingResRes[0]?.count || 0;

    return NextResponse.json({
      userName: auth.session?.fullName || 'Admin',
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
