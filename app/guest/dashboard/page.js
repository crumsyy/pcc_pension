import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSessionRole } from "@/lib/session";
import { dbQuery, syncRoomStatuses, getBookingBalanceDetails } from "@/lib/db";
import GuestDashboardClient from "./GuestDashboardClient";
import GuestDashboardLoading from "./loading";

export const unstable_instant = {
  prefetch: 'static',
  unstable_disableValidation: true,
};

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
      "SELECT g.*, u.email, u.createdAt FROM guest g LEFT JOIN user u ON u.userID = g.userID WHERE g.userID = ?",
      [session.userID]
    );
    
    let guest = guests[0];

    // Check by session.guestID if not matched by session.userID
    if (!guest && session.guestID) {
      const guestsByID = await dbQuery(
        "SELECT g.*, u.email, u.createdAt FROM guest g LEFT JOIN user u ON u.userID = g.userID WHERE g.guestID = ?",
        [session.guestID]
      );
      if (guestsByID.length > 0) {
        guest = guestsByID[0];
        if (!guest.userID) {
          await dbQuery("UPDATE guest SET userID = ? WHERE guestID = ?", [session.userID, guest.guestID]).catch(() => {});
          guest.userID = session.userID;
        }
      }
    }

    // Auto-heal missing guest profile if not directly linked
    if (!guest) {
      if (session.email) {
        const existingByEmail = await dbQuery(
          "SELECT * FROM guest WHERE LOWER(email) = LOWER(?) LIMIT 1",
          [session.email]
        );
        if (existingByEmail.length > 0) {
          await dbQuery("UPDATE guest SET userID = ? WHERE guestID = ?", [session.userID, existingByEmail[0].guestID]);
          guest = { ...existingByEmail[0], email: session.email, userID: session.userID, createdAt: new Date().toISOString() };
        }
      }

      // If still no guest record, auto-provision one so the guest portal always loads smoothly
      if (!guest) {
        const [firstName, ...lastNameParts] = (session.fullName || session.firstName || 'Guest').split(' ');
        const lastName = lastNameParts.join(' ') || session.lastName || '';
        try {
          const ins = await dbQuery(
            "INSERT INTO guest (firstName, lastName, email, contact, gender, city, province, userID) VALUES (?, ?, ?, 'N/A', NULL, 'N/A', 'N/A', ?)",
            [firstName || 'Guest', lastName, session.email || '', session.userID]
          );
          guest = {
            guestID: ins.insertId,
            userID: session.userID,
            firstName: firstName || 'Guest',
            lastName,
            email: session.email || '',
            contact: 'N/A',
            gender: null,
            city: 'N/A',
            province: 'N/A',
            profilePicture: null,
            createdAt: new Date().toISOString()
          };
        } catch (insErr) {
          console.error("Auto-provision guest insert error:", insErr);
          guest = {
            guestID: session.guestID || session.userID,
            userID: session.userID,
            firstName: firstName || 'Guest',
            lastName,
            email: session.email || '',
            contact: 'N/A',
            gender: null,
            city: 'N/A',
            province: 'N/A',
            profilePicture: null,
            createdAt: new Date().toISOString()
          };
        }
      }
    }

    const currentGuestID = guest?.guestID || session.guestID || 0;

    // 2. Fetch reservations, bookings, and all active rooms in parallel
    const [reservations, rawBookings, allRooms, roomSchedules] = await Promise.all([
      dbQuery(
        `SELECT r.reservationID, r.reservationDateTime, r.status,
                r.holdExpiryDateTime, r.isCourtesyHold,
                rm.roomNumber, rt.type as roomType, fl.name as floor
         FROM reservation r
         LEFT JOIN room rm ON rm.roomID = r.roomID
         LEFT JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
         LEFT JOIN floor fl ON fl.floorID = rm.floorID
         WHERE r.guestID = ?
         ORDER BY r.reservationDateTime DESC`,
        [currentGuestID]
      ),
      dbQuery(
        `SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
                rm.roomNumber, rt.type as roomType
         FROM booking b
         LEFT JOIN room rm ON rm.roomID = b.roomID
         LEFT JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
         WHERE b.guestID = ?
         ORDER BY b.checkInDateTime DESC`,
        [currentGuestID]
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
    const activeBookingRaw = rawBookings.find(b => b.status === "Checked In" || b.status === "Late Checkout") || rawBookings.find(b => ['Confirmed', 'Pending', 'Booked', 'Pending Check-in'].includes(b.status));
    let activeBill = null;

    if (activeBookingRaw) {
      activeBill = await getBookingBalanceDetails(activeBookingRaw.bookingID);
    }

    const billBookingID = activeBill?.bookingID || activeBill?.booking?.bookingID;
    const bookings = rawBookings.map(b => {
      if (billBookingID && b.bookingID === billBookingID) {
        return {
          ...b,
          remainingBalance: activeBill.remainingBalance || 0,
          incidentals: activeBill.incidentals || []
        };
      }
      return {
        ...b,
        remainingBalance: 0,
        incidentals: []
      };
    });

    const [firstName, ...lastNameParts] = (session.fullName || session.firstName || 'Guest').split(' ');
    const fallbackGuest = {
      userID: session.userID,
      guestID: session.guestID || session.userID,
      firstName: firstName || 'Guest',
      lastName: lastNameParts.join(' ') || session.lastName || '',
      email: session.email || '',
      contact: 'N/A',
      gender: null,
      city: 'N/A',
      province: 'N/A',
      profilePicture: null,
      createdAt: new Date().toISOString()
    };

    const safeGuest = guest || fallbackGuest;

    // Safely serialize all props to prevent Next.js Server Component Date/Decimal serialization errors
    return (
      <Suspense fallback={<GuestDashboardLoading />}>
        <GuestDashboardClient
          initialGuest={JSON.parse(JSON.stringify(safeGuest))}
          initialReservations={JSON.parse(JSON.stringify(reservations || []))}
          initialBookings={JSON.parse(JSON.stringify(bookings || []))}
          initialActiveBill={activeBill ? JSON.parse(JSON.stringify(activeBill)) : null}
          initialAllRooms={JSON.parse(JSON.stringify(allRooms || []))}
          initialRoomSchedules={JSON.parse(JSON.stringify(roomSchedules || []))}
        />
      </Suspense>
    );
  } catch (error) {
    // If Next.js redirect was triggered, re-throw it so the framework can handle navigation
    if (error?.digest?.startsWith('NEXT_REDIRECT') || error?.message === 'NEXT_REDIRECT') {
      throw error;
    }
    console.error("Error rendering guest dashboard:", error);
    const [firstName, ...lastNameParts] = (session?.fullName || session?.firstName || 'Guest').split(' ');
    const fallbackGuest = {
      userID: session?.userID || 0,
      guestID: session?.guestID || session?.userID || 0,
      firstName: firstName || 'Guest',
      lastName: lastNameParts.join(' ') || session?.lastName || '',
      email: session?.email || '',
      contact: 'N/A',
      gender: null,
      city: 'N/A',
      province: 'N/A',
      profilePicture: null,
      createdAt: new Date().toISOString()
    };

    return (
      <Suspense fallback={<GuestDashboardLoading />}>
        <GuestDashboardClient
          initialGuest={fallbackGuest}
          initialReservations={[]}
          initialBookings={[]}
          initialActiveBill={null}
          initialAllRooms={[]}
          initialRoomSchedules={[]}
        />
      </Suspense>
    );
  }
}
