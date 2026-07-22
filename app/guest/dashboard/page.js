import { redirect } from "next/navigation";
import { requireSessionRole } from "@/lib/session";
import { dbQuery, syncRoomStatuses } from "@/lib/db";
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
    const [reservations, bookings, allRooms] = await Promise.all([
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
        `SELECT r.roomID, r.roomNumber, r.floorID, r.status, r.occupancyLimit, r.isAircon, r.hasHotShower,
                COALESCE(rt.type, 'Standard Room') as roomType,
                COALESCE(fl.name, 'Ground Floor') as floorName,
                COALESCE(rr.rate, 1500) as rate
         FROM room r
         LEFT JOIN room_type rt ON rt.roomTypeID = r.roomTypeID
         LEFT JOIN floor fl ON fl.floorID = r.floorID
         LEFT JOIN room_rate rr ON rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID AND rr.breakfastID = 1
         WHERE r.isArchived = 0
         ORDER BY r.floorID ASC, r.roomNumber ASC`
      )
    ]);

    const activeBooking = bookings.find(b => b.status === "Checked In");
    let activeBill = null;

    if (activeBooking) {
      const bookingID = activeBooking.bookingID;
      
      // Fetch booking details
      const bookingRes = await dbQuery(`
        SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status, b.guestID, b.roomID,
               rm.roomNumber, rm.floorID, rt.type as roomType, rt.roomTypeID
        FROM booking b
        JOIN room rm ON rm.roomID = b.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE b.bookingID = ?
      `, [bookingID]);

      if (bookingRes.length > 0) {
        const booking = bookingRes[0];

        const rateRes = await dbQuery(
          "SELECT rate FROM room_rate WHERE roomTypeID = ? AND floorID = ? AND breakfastID = 1",
          [booking.roomTypeID, booking.floorID]
        );
        const rate = rateRes[0]?.rate || 0;

        const checkIn = new Date(booking.checkInDateTime);
        const checkOut = new Date(booking.checkOutDateTime);
        const diffTime = Math.abs(checkOut - checkIn);
        const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
        const roomCharge = rate * nights;

        const checkInSqlStr = checkIn.toISOString().slice(0, 19).replace('T', ' ');

        // Product charges
        const productCharges = await dbQuery(`
          SELECT op.quantity, p.name, p.price, (op.quantity * p.price) as subtotal
          FROM order_product op
          JOIN products p ON p.productID = op.productID
          JOIN orders o ON o.orderID = op.orderID
          WHERE o.guestID = ? AND o.orderDateTime >= ? AND o.orderStatus != 'Canceled'
        `, [booking.guestID, checkInSqlStr]);

        // Amenity charges
        const amenityCharges = await dbQuery(`
          SELECT oa.quantity, a.name, a.price, (oa.quantity * a.price) as subtotal
          FROM order_amenities oa
          JOIN amenities a ON a.amenityID = oa.amenityID
          JOIN orders o ON o.orderID = oa.orderID
          WHERE o.guestID = ? AND o.orderDateTime >= ? AND o.orderStatus != 'Canceled'
        `, [booking.guestID, checkInSqlStr]);

        const productTotal = productCharges.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);
        const amenityTotal = amenityCharges.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);

        // Payments
        const billingRes = await dbQuery("SELECT billingID FROM billing WHERE bookingID = ?", [bookingID]);
        let paidTotal = 0;
        if (billingRes.length > 0) {
          const payments = await dbQuery("SELECT amount FROM payment WHERE billingID = ?", [billingRes[0].billingID]);
          paidTotal = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        }

        const totalCharges = roomCharge + productTotal + amenityTotal;
        const balance = totalCharges - paidTotal;

        activeBill = {
          booking: { 
            ...booking, 
            nights, 
            rate, 
            originalRoomCharge: roomCharge,
            roomCharge 
          },
          productCharges,
          amenityCharges,
          summary: {
            room: roomCharge,
            products: productTotal,
            amenities: amenityTotal,
            total: totalCharges,
            paid: paidTotal,
            balance
          }
        };
      }
    }

    // Safely serialize all props to prevent Next.js Server Component Date/Decimal serialization errors
    return (
      <GuestDashboardClient
        initialGuest={JSON.parse(JSON.stringify(guest))}
        initialReservations={JSON.parse(JSON.stringify(reservations || []))}
        initialBookings={JSON.parse(JSON.stringify(bookings || []))}
        initialActiveBill={activeBill ? JSON.parse(JSON.stringify(activeBill)) : null}
        initialAllRooms={JSON.parse(JSON.stringify(allRooms || []))}
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
      />
    );
  }
}
