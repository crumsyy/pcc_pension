import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncRoomStatuses, getBookingBalance } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    await syncRoomStatuses();

    const guests = await dbQuery("SELECT guestID FROM guest WHERE userID = ?", [session.userID]);
    if (guests.length === 0) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }
    const guestID = guests[0].guestID;

    // Fetch all bookings for this guest
    const bookings = await dbQuery(`
      SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status, b.reservationID, b.roomID, b.cancelRemarks,
             rm.roomNumber, rm.floorID, rt.type as roomType, rt.roomTypeID, COALESCE(rr.rate, 1500) as rate
      FROM booking b
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      LEFT JOIN room_rate rr ON rr.roomTypeID = rm.roomTypeID AND rr.floorID = rm.floorID AND rr.breakfastID = 1
      WHERE b.guestID = ?
      ORDER BY b.checkInDateTime DESC
    `, [guestID]);

    const bookingsWithDetails = await Promise.all(bookings.map(async b => {
      const remainingBalance = await getBookingBalance(b.bookingID);
      const registeredGuests = await dbQuery(`
        SELECT bg.*, d.name as discountName, d.percentage as discountPercentage
        FROM booking_guest_details bg
        LEFT JOIN discounts d ON d.discountID = bg.discountID
        WHERE bg.bookingID = ?
      `, [b.bookingID]);
      return {
        ...b,
        remainingBalance,
        registeredGuests
      };
    }));

    return NextResponse.json({ success: true, bookings: bookingsWithDetails });
  } catch (error) {
    console.error("Failed to fetch guest bookings:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    const guests = await dbQuery("SELECT guestID, firstName, lastName, contact, email FROM guest WHERE userID = ?", [session.userID]);
    if (guests.length === 0) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }
    const guest = guests[0];

    if (action === 'cancel') {
      const bookingID = parseInt(body.bookingID);
      const reason = body.reason?.trim() || 'Canceled by guest online';

      if (!bookingID) {
        return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });
      }

      const [booking] = await dbQuery("SELECT status, roomID FROM booking WHERE bookingID = ? AND guestID = ?", [bookingID, guest.guestID]);
      if (!booking) {
        return NextResponse.json({ error: 'Booking record not found.' }, { status: 404 });
      }

      if (booking.status === 'Checked In' || booking.status === 'Checked Out') {
        return NextResponse.json({ error: 'Checked-in or Checked-out bookings cannot be canceled.' }, { status: 400 });
      }

      await dbQuery(
        "UPDATE booking SET status = 'Cancelled', cancelRemarks = ? WHERE bookingID = ?",
        [reason, bookingID]
      );

      // Release room status back to Available if it was Reserved
      await dbQuery("UPDATE room SET status = 'Available' WHERE roomID = ? AND status = 'Reserved'", [booking.roomID]);

      // Notify receptionists
      const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
      for (const r of staffToNotify) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Booking Canceled by Guest', ?)",
          [r.userID, `Booking #${bookingID} for ${guest.firstName} ${guest.lastName} was canceled by the guest.`]
        );
      }

      return NextResponse.json({ success: true, message: 'Booking canceled successfully.' });
    }

    if (action === 'create') {
      const { roomID, checkInDate, checkOutDate, reservationID } = body;
      const registeredGuests = body.registeredGuests || [
        { fullName: `${guest.firstName} ${guest.lastName}`, age: 30, discountID: null, discountIdNumber: null }
      ];

      if (!roomID || !checkInDate || !checkOutDate) {
        return NextResponse.json({ error: 'Room selection, Check-In, and Check-Out dates are required.' }, { status: 400 });
      }

      const checkInDateTime = `${checkInDate} 14:00:00`;
      const checkOutDateTime = `${checkOutDate} 12:00:00`;

      const db = await getDbConnection();
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        // Insert booking record with 'Confirmed' status
        const [bookingRes] = await connection.execute(
          `INSERT INTO booking (checkInDateTime, checkOutDateTime, status, reservationID, guestID, roomID)
           VALUES (?, ?, 'Confirmed', ?, ?, ?)`,
          [checkInDateTime, checkOutDateTime, reservationID ? parseInt(reservationID) : null, guest.guestID, roomID]
        );
        const bookingID = bookingRes.insertId;

        // If converted from a reservation, update reservation status to Confirmed
        if (reservationID) {
          await connection.execute("UPDATE reservation SET status = 'Confirmed' WHERE reservationID = ?", [parseInt(reservationID)]);
        }

        // Insert registered guests
        for (const g of registeredGuests) {
          if (g.fullName && g.fullName.trim()) {
            await connection.execute(
              `INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber)
               VALUES (?, ?, ?, ?, ?)`,
              [bookingID, g.fullName.trim(), parseInt(g.age) || 30, g.discountID ? parseInt(g.discountID) : null, g.discountIdNumber || null]
            );
          }
        }

        // Update room status to Reserved
        await connection.execute("UPDATE room SET status = 'Reserved' WHERE roomID = ?", [roomID]);

        // Create billing record if missing
        await connection.execute(
          "INSERT INTO billing (billingDate, status, bookingID) VALUES (NOW(), 'Unpaid', ?)",
          [bookingID]
        );

        await connection.commit();

        // Notify staff
        const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
        for (const r of staffToNotify) {
          await dbQuery(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'New Guest Booking Request', ?)",
            [r.userID, `Guest ${guest.firstName} ${guest.lastName} created Booking #${bookingID} for ${checkInDate}.`]
          );
        }

        // Add guest notification
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Booking Confirmed', ?)",
          [session.userID, `Your online booking #${bookingID} has been created and confirmed!`]
        );

        return NextResponse.json({
          success: true,
          message: 'Booking request created successfully!',
          bookingID
        });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process guest booking:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
