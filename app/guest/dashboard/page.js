import { redirect } from "next/navigation";
import { requireSessionRole } from "@/lib/session";
import { dbQuery, syncRoomStatuses, getBookingBalanceDetails, getBookingBalance } from "@/lib/db";
import GuestDashboardClient from "./GuestDashboardClient";

export const unstable_instant = false;

export default async function GuestDashboard() {
  // Check auth and role
  const auth = await requireSessionRole("Guest");
  if (auth.redirect) {
    redirect(auth.redirect);
  }

  const { session } = auth;

  try {
    await syncRoomStatuses();

    // 1. Fetch guest profile
    let guests = await dbQuery(
      "SELECT g.*, u.email, u.createdAt FROM guest g JOIN user u ON u.userID = g.userID WHERE g.userID = ?",
      [session.userID]
    );
    
    // Auto-provision guest profile if record is missing for this authenticated user
    if (guests.length === 0) {
      const [firstName, ...lastNameParts] = (session.fullName || session.firstName || 'Guest').split(' ');
      const lastName = lastNameParts.join(' ') || session.lastName || '';
      try {
        const insertRes = await dbQuery(
          "INSERT INTO guest (firstName, lastName, email, contact, gender, city, province, userID) VALUES (?, ?, ?, 'N/A', NULL, 'N/A', 'N/A', ?)",
          [firstName || 'Guest', lastName, session.email || '', session.userID]
        );
        guests = await dbQuery(
          "SELECT g.*, u.email, u.createdAt FROM guest g JOIN user u ON u.userID = g.userID WHERE g.guestID = ?",
          [insertRes.insertId]
        );
      } catch (provErr) {
        console.error("Auto-provision guest profile error:", provErr);
      }
    }

    if (guests.length === 0) {
      redirect("/auth/login?error=" + encodeURIComponent("Profile details not found. Please log in again."));
    }
    const guest = guests[0];

    // 2. Fetch reservations, bookings, and all active rooms in parallel
    const [reservations, rawBookings, allRooms, roomSchedules] = await Promise.all([
      dbQuery(
        `SELECT r.reservationID, r.reservationDateTime, r.checkOutDateTime,
                r.isCourtesyHold, r.holdDurationHours, r.holdExpiryDateTime,
                r.guestCount, r.specialRequests, r.breakfastOption,
                r.roomID, r.status,
                rm.roomNumber, rm.floorID, rt.type as roomType, fl.name as floor,
                COALESCE(rr.rate, 1500) as rate
         FROM reservation r
         JOIN room rm ON rm.roomID = r.roomID
         JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
         JOIN floor fl ON fl.floorID = rm.floorID
         LEFT JOIN room_rate rr ON rr.roomTypeID = rm.roomTypeID 
                               AND rr.floorID = rm.floorID 
                               AND rr.breakfastID = (CASE WHEN r.breakfastOption LIKE '%with%' AND r.breakfastOption NOT LIKE '%without%' THEN 2 ELSE 1 END)
         WHERE r.guestID = ?
         ORDER BY r.reservationDateTime DESC`,
        [guest.guestID]
      ),
      dbQuery(
        `SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
                b.reservationID, b.roomID, b.roomRate, b.breakfastOption, b.breakfastID,
                COALESCE(b.remainingBalance, b.finalBalance, 0) as remainingBalance,
                COALESCE(b.roomCharge, 0) as roomCharge,
                COALESCE(b.downPaymentAmount, 0) as downPaymentAmount,
                rm.roomNumber, rm.floorID, rt.type as roomType, rt.roomTypeID,
                COALESCE(rr.rate, b.roomRate, 1500) as rate
         FROM booking b
         JOIN room rm ON rm.roomID = b.roomID
         JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
         LEFT JOIN room_rate rr ON rr.roomTypeID = rm.roomTypeID 
                               AND rr.floorID = rm.floorID 
                               AND rr.breakfastID = COALESCE(b.breakfastID, CASE WHEN b.breakfastOption LIKE '%with%' AND b.breakfastOption NOT LIKE '%without%' THEN 2 ELSE 1 END)
         WHERE b.guestID = ?
         ORDER BY b.checkInDateTime DESC`,
        [guest.guestID]
      ),
      dbQuery(
        `SELECT r.roomID, r.roomNumber, r.floorID, r.status, r.occupancyLimit, r.image, r.description,
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
         ORDER BY r.floorID ASC, r.roomNumber ASC`
      ),
      dbQuery(`
        SELECT bookingID, roomID, checkInDateTime, checkOutDateTime, status, 'booking' as type
        FROM booking
        WHERE status NOT IN ('Cancelled', 'Checked Out', 'No Show')
          AND checkOutDateTime >= CURDATE()
        UNION ALL
        SELECT reservationID as bookingID, roomID, reservationDateTime as checkInDateTime,
               COALESCE(checkOutDateTime, DATE_ADD(reservationDateTime, INTERVAL 1 DAY)) as checkOutDateTime,
               status, 'reservation' as type
        FROM reservation
        WHERE status NOT IN ('Cancelled', 'Checked Out', 'No Show')
          AND reservationDateTime >= CURDATE()
      `)
    ]);

    // Calculate live detailed balance only once for the primary active stay booking to ensure instant page load
    const activeBookingRaw = rawBookings.find(b => ['Checked In', 'Active Stay', 'Late Checkout', 'Pending Room Verification', 'Room Verified', 'Bill Finalized'].includes(b.status)) 
      || rawBookings.find(b => ['Confirmed', 'Pending', 'Booked', 'Pending Check-in'].includes(b.status));
    let activeBill = null;

    if (activeBookingRaw) {
      activeBill = await getBookingBalanceDetails(activeBookingRaw.bookingID);
    }

    const bookings = rawBookings.map(b => {
      if (activeBill && b.bookingID === activeBill.bookingID) {
        return {
          ...b,
          remainingBalance: activeBill.remainingBalance !== undefined ? activeBill.remainingBalance : (parseFloat(b.remainingBalance) || 0),
          incidentals: activeBill.incidentals || []
        };
      }
      return {
        ...b,
        remainingBalance: parseFloat(b.remainingBalance) || 0,
        incidentals: []
      };
    });

    // Safely serialize all props to prevent Next.js Server Component Date/Decimal serialization errors
    return (
      <GuestDashboardClient
        initialGuest={JSON.parse(JSON.stringify(guest))}
        initialReservations={JSON.parse(JSON.stringify(reservations || []))}
        initialBookings={JSON.parse(JSON.stringify(bookings || []))}
        initialActiveBill={activeBill ? JSON.parse(JSON.stringify(activeBill)) : null}
        initialAllRooms={JSON.parse(JSON.stringify(allRooms || []))}
        initialRoomSchedules={JSON.parse(JSON.stringify(roomSchedules || []))}
      />
    );
  } catch (error) {
    if (error?.digest?.startsWith('NEXT_REDIRECT') || error?.message === 'NEXT_REDIRECT') {
      throw error;
    }
    console.error("Error rendering guest dashboard:", error);
    // Fallback safe load so guest dashboard never crashes
    const fallbackGuest = {
      firstName: session.firstName || 'Guest',
      lastName: session.lastName || '',
      email: session.email || '',
      contact: 'N/A',
      gender: 'N/A',
      city: 'N/A',
      province: 'N/A',
      createdAt: new Date().toISOString()
    };

    return (
      <GuestDashboardClient
        initialGuest={fallbackGuest}
        initialReservations={[]}
        initialBookings={[]}
        initialActiveBill={null}
        initialAllRooms={[]}
        initialRoomSchedules={[]}
      />
    );
  }
}
