import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, syncRoomStatuses } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await syncRoomStatuses(false);

    const [
      totalCheckInsRes,
      totalCheckOutsRes,
      occupiedRoomsRes,
      availableRoomsRes,
      pendingResRes,
      underMaintenanceRoomsRes,
      checkInsList,
      pendingResList,
      rooms,
      confirmedBookingsList,
      guestInquiriesList,
      guestOrdersList
    ] = await Promise.all([
      dbQuery("SELECT COUNT(*) as count FROM booking WHERE status IN ('Checked In', 'Active Stay', 'Late Checkout', 'Pending Room Verification', 'Room Verified', 'Bill Finalized', 'Final Billing Updated', 'Paid', 'Payment Completed')"),
      dbQuery("SELECT COUNT(*) as count FROM booking WHERE DATE(checkOutDateTime) = CURDATE() AND status = 'Checked Out'"),
      dbQuery("SELECT COUNT(*) as count FROM room WHERE status = 'Occupied' AND isArchived = 0"),
      dbQuery("SELECT COUNT(*) as count FROM room WHERE status = 'Available' AND isArchived = 0"),
      dbQuery(`
        SELECT COUNT(*) as count FROM reservation 
        WHERE status IN ('Pending', 'Confirmed', 'Courtesy Hold', 'Overdue Check-In')
          AND status NOT IN ('Cancelled', 'Canceled', 'Released', 'Expired', 'No Show', 'Booked', 'Completed')
          AND NOT EXISTS (SELECT 1 FROM booking b WHERE b.reservationID = reservation.reservationID)
          AND (
            status != 'Courtesy Hold' 
            OR (holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(holdExpiryDateTime, INTERVAL 30 MINUTE))
          )
      `),
      dbQuery("SELECT COUNT(*) as count FROM room WHERE status = 'Under Maintenance' AND isArchived = 0"),
      dbQuery(`
        SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
               COALESCE(g.firstName, 'Guest') as firstName, COALESCE(g.lastName, '') as lastName, g.contact,
               rm.roomNumber, rt.type as roomType
        FROM booking b
        LEFT JOIN guest g ON g.guestID = b.guestID
        JOIN room rm ON rm.roomID = b.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE b.status IN ('Checked In', 'Active Stay', 'Late Checkout', 'Pending Room Verification', 'Room Verified', 'Bill Finalized', 'Final Billing Updated', 'Paid', 'Payment Completed')
          AND b.status NOT IN ('Completed', 'Checked Out', 'Cancelled', 'No Show')
        ORDER BY rm.roomNumber ASC
      `),
      dbQuery(`
        SELECT r.reservationID, r.reservationDateTime, r.status, r.isCourtesyHold, r.holdExpiryDateTime,
               COALESCE(g.firstName, 'Walk-in') as firstName, COALESCE(g.lastName, 'Guest') as lastName, g.contact,
               rm.roomNumber, rt.type as roomType
        FROM reservation r
        LEFT JOIN guest g ON g.guestID = r.guestID
        JOIN room rm ON rm.roomID = r.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE r.status IN ('Pending', 'Confirmed', 'Courtesy Hold', 'Overdue Check-In')
          AND r.status NOT IN ('Cancelled', 'Canceled', 'Released', 'Expired', 'No Show', 'Booked', 'Completed')
          AND NOT EXISTS (SELECT 1 FROM booking b WHERE b.reservationID = r.reservationID)
          AND (
            r.status != 'Courtesy Hold' 
            OR (r.holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(r.holdExpiryDateTime, INTERVAL 30 MINUTE))
          )
        ORDER BY r.reservationDateTime ASC
        LIMIT 10
      `),
      dbQuery(`
        SELECT rm.roomID, rm.roomNumber, rm.status, rt.type as roomType, fl.name as floor
        FROM room rm
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        JOIN floor fl ON fl.floorID = rm.floorID
        WHERE rm.isArchived = 0
        ORDER BY fl.name, rm.roomNumber
      `),
      dbQuery(`
        SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
               COALESCE(g.firstName, 'Guest') as firstName, COALESCE(g.lastName, '') as lastName, g.contact,
               rm.roomNumber, rt.type as roomType
        FROM booking b
        LEFT JOIN guest g ON g.guestID = b.guestID
        JOIN room rm ON rm.roomID = b.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE b.status IN ('Confirmed', 'Pending Check-in', 'Pending', 'Booked')
          AND b.status NOT IN ('Completed', 'Checked Out', 'Cancelled', 'No Show')
        ORDER BY b.checkInDateTime ASC
        LIMIT 10
      `),
      dbQuery(`
        SELECT inquiryID, name as guestName, email, message as subject, status, DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i') as createdAt
        FROM inquiry
        ORDER BY createdAt DESC
        LIMIT 6
      `).catch(() => []),
      dbQuery(`
        SELECT o.orderID, o.orderStatus, DATE_FORMAT(o.orderDateTime, '%Y-%m-%d %H:%i') as orderDateTime,
               g.firstName, g.lastName, rm.roomNumber
        FROM orders o
        JOIN guest g ON g.guestID = o.guestID
        LEFT JOIN booking b ON b.guestID = g.guestID AND b.status IN ('Checked In', 'Active Stay', 'Late Checkout', 'Pending Room Verification', 'Room Verified', 'Bill Finalized')
        LEFT JOIN room rm ON rm.roomID = b.roomID
        ORDER BY o.orderDateTime DESC
        LIMIT 6
      `).catch(() => [])
    ]);

    return NextResponse.json({
      success: true,
      totalCheckIns: totalCheckInsRes[0]?.count || 0,
      totalCheckOuts: totalCheckOutsRes[0]?.count || 0,
      occupiedRooms: occupiedRoomsRes[0]?.count || 0,
      availableRooms: availableRoomsRes[0]?.count || 0,
      pendingRes: pendingResRes[0]?.count || 0,
      underMaintenanceRooms: underMaintenanceRoomsRes[0]?.count || 0,
      checkInsList,
      pendingResList,
      rooms,
      confirmedBookingsList,
      guestInquiriesList,
      guestOrdersList
    });
  } catch (error) {
    console.error("Receptionist dashboard real-time API error:", error);
    return NextResponse.json({ error: error.message || 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
