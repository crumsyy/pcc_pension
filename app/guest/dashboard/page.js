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
    const guests = await dbQuery(
      "SELECT g.*, u.email, u.createdAt FROM guest g JOIN user u ON u.userID = g.userID WHERE g.userID = ?",
      [session.userID]
    );
    
    if (guests.length === 0) {
      redirect("/auth/login?error=" + encodeURIComponent("Profile details not found. Please log in again."));
    }
    const guest = guests[0];

    // 2. Fetch reservations, bookings, and all active rooms in parallel
    const [reservations, rawBookings, allRooms, roomSchedules] = await Promise.all([
      dbQuery(
        `SELECT r.reservationID, r.reservationDateTime, r.status,
                rm.roomNumber, rt.type as roomType, fl.name as floor
         FROM reservation r
         JOIN room rm ON rm.roomID = r.roomID
         JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
         JOIN floor fl ON fl.floorID = rm.floorID
         WHERE r.guestID = ?
         ORDER BY r.reservationDateTime DESC`,
        [guest.guestID]
      ),
      dbQuery(
        `SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
                rm.roomNumber, rt.type as roomType
         FROM booking b
         JOIN room rm ON rm.roomID = b.roomID
         JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
         WHERE b.guestID = ?
         ORDER BY b.checkInDateTime DESC`,
        [guest.guestID]
      ),
      dbQuery(
        `SELECT r.roomID, r.roomNumber, r.floorID, r.status, r.occupancyLimit,
                COALESCE(rt.type, 'Standard Room') as roomType,
                COALESCE(fl.name, 'Ground Floor') as floorName,
                (
                  SELECT COALESCE(MIN(rr.rate), 1500)
                  FROM room_rate rr
                  WHERE rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID
                ) as rate
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

    // Attach accurate live remaining balances to bookings
    const bookings = await Promise.all(rawBookings.map(async b => {
      const remainingBalance = await getBookingBalance(b.bookingID);
      const incidentals = await dbQuery("SELECT chargeID, description, amount FROM incidental_charge WHERE bookingID = ?", [b.bookingID]);
      return {
        ...b,
        remainingBalance,
        incidentals: incidentals || []
      };
    }));

    const activeBooking = bookings.find(b => b.status === "Checked In" || b.status === "Late Checkout") || bookings.find(b => b.status === "Confirmed" || b.status === "Pending");
    let activeBill = null;

    if (activeBooking) {
      activeBill = await getBookingBalanceDetails(activeBooking.bookingID);
    }

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
