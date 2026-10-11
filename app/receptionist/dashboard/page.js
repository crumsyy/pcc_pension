import { dbQuery } from "@/lib/db";
import { requireSessionRole } from "@/lib/session";
import ReceptionistDashboardClient from "./ReceptionistDashboardClient";

export default async function ReceptionistDashboard() {
  const DEV_TIMING = process.env.NODE_ENV !== 'production';
  if (DEV_TIMING) console.time('[dashboard] total');
  if (DEV_TIMING) console.time('[dashboard] session');
  const auth = await requireSessionRole("Receptionist");
  if (DEV_TIMING) console.timeEnd('[dashboard] session');
  // NOTE: room-status sweep intentionally NOT awaited here (cron owns it);
  // awaiting it blocked every dashboard render on sequential maintenance writes.
  const userName = auth.session?.fullName || "Receptionist";

  // Fetch initial statistics, check-ins, reservations, confirmed bookings, inquiries, orders in parallel
  if (DEV_TIMING) console.time('[dashboard] queries');
  const [
    bookingCounts,
    roomCounts,
    pendingResRes,
    checkInsList,
    pendingResList,
    rooms,
    confirmedBookingsList,
    guestInquiriesList,
    guestOrdersList
  ] = await Promise.all([
    dbQuery(`
      SELECT
        SUM(status IN ('Checked In', 'Active Stay', 'Late Checkout', 'Pending Room Verification', 'Room Verified', 'Bill Finalized', 'Final Billing Updated', 'Paid', 'Payment Completed')) AS activeStays,
        SUM(checkOutDateTime >= CURDATE() AND checkOutDateTime < DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND status IN ('Checked Out', 'Completed')) AS todayCheckouts
      FROM booking
    `),
    dbQuery(`
      SELECT
        SUM(status = 'Occupied') AS occupied,
        SUM(status = 'Available') AS available,
        SUM(status = 'Under Maintenance') AS maintenance
      FROM room WHERE isArchived = 0
    `),
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
      LIMIT 10
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

  if (DEV_TIMING) console.timeEnd('[dashboard] queries');
  const initialData = {
    userName,
    totalCheckIns: Number(bookingCounts[0]?.activeStays) || 0,
    totalCheckOuts: Number(bookingCounts[0]?.todayCheckouts) || 0,
    occupiedRooms: Number(roomCounts[0]?.occupied) || 0,
    availableRooms: Number(roomCounts[0]?.available) || 0,
    pendingRes: pendingResRes[0]?.count || 0,
    underMaintenanceRooms: Number(roomCounts[0]?.maintenance) || 0,
    checkInsList,
    pendingResList,
    rooms,
    confirmedBookingsList,
    guestInquiriesList,
    guestOrdersList
  };
  if (DEV_TIMING) console.timeEnd('[dashboard] total');

  return <ReceptionistDashboardClient initialData={initialData} />;
}
