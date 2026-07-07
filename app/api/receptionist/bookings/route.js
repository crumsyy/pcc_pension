import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [bookings, guests, rooms, guestsDetails, discounts] = await Promise.all([
      dbQuery(`
        SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status, b.reservationID, b.guestID, b.roomID, b.cancelRemarks,
               g.firstName, g.middleName, g.lastName, g.contact, g.email, g.gender,
               rm.roomNumber, rt.type as roomType
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        JOIN room rm ON rm.roomID = b.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE rm.isArchived = 0
        ORDER BY b.checkInDateTime DESC
      `),
      dbQuery("SELECT guestID, firstName, lastName, contact FROM guest ORDER BY lastName, firstName"),
      dbQuery(`
        SELECT r.roomID, r.roomNumber, r.status, rt.type as roomType 
        FROM room r 
        JOIN room_type rt ON rt.roomTypeID = r.roomTypeID 
        WHERE r.isArchived = 0 
        ORDER BY r.roomNumber
      `),
      dbQuery(`
        SELECT bg.*, d.name as discountName, d.percentage as discountPercentage
        FROM booking_guest_details bg
        LEFT JOIN discounts d ON d.discountID = bg.discountID
      `),
      dbQuery("SELECT discountID, name, percentage FROM discounts WHERE eligibilityTypeID = 1 AND isArchived = 0")
    ]);

    const bookingsWithGuests = bookings.map(b => {
      return {
        ...b,
        registeredGuests: guestsDetails.filter(gd => gd.bookingID === b.bookingID)
      };
    });

    return NextResponse.json({ bookings: bookingsWithGuests, guests, rooms, discounts });
  } catch (error) {
    console.error("Failed to fetch bookings data:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const guests = body.guests || [];
      // Validate guests list
      for (const g of guests) {
        if (!g.fullName || !g.fullName.trim()) {
          return NextResponse.json({ error: 'All registered guests must have a name.' }, { status: 400 });
        }
        const age = parseInt(g.age);
        if (isNaN(age) || age <= 0) {
          return NextResponse.json({ error: 'All registered guests must have a valid age.' }, { status: 400 });
        }
        if (g.discountID) {
          if (!g.discountIdNumber || !g.discountIdNumber.trim()) {
            return NextResponse.json({ error: `Discount ID card number is required for ${g.fullName}.` }, { status: 400 });
          }
          const discRes = await dbQuery("SELECT name FROM discounts WHERE discountID = ?", [g.discountID]);
          if (discRes.length > 0) {
            const discName = discRes[0].name.toLowerCase();
            if (discName.includes('senior') && age < 60) {
              return NextResponse.json({ error: `Guest ${g.fullName} must be at least 60 years old to qualify for the Senior Citizen discount.` }, { status: 400 });
            }
          }
        }
      }

      const pool = await getDbConnection();
      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        let guestID;
        if (body.isWalkIn) {
          const { firstName, lastName, contact, email, gender } = body;
          if (!firstName || !firstName.trim() || !lastName || !lastName.trim()) {
            return NextResponse.json({ error: 'First name and Last name are required for walk-in guests.' }, { status: 400 });
          }
          const [insertGuestRes] = await conn.execute(
            "INSERT INTO guest (firstName, lastName, contact, email, gender, userID) VALUES (?, ?, ?, ?, ?, NULL)",
            [firstName.trim(), lastName.trim(), (contact || '').trim(), (email || '').trim() || null, gender || null]
          );
          guestID = insertGuestRes.insertId;
        } else {
          guestID = parseInt(body.guestID);
        }

        const roomID = parseInt(body.roomID);
        const checkInDateTime = body.checkInDateTime;
        const checkOutDateTime = body.checkOutDateTime;
        const status = body.status || 'Confirmed';

        if (!guestID || !roomID || !checkInDateTime || !checkOutDateTime) {
          return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
        }

        // Insert booking
        const [insertBookingRes] = await conn.execute(
          "INSERT INTO booking(checkInDateTime, checkOutDateTime, status, reservationID, guestID, roomID) VALUES(?, ?, ?, NULL, ?, ?)",
          [checkInDateTime, checkOutDateTime, status, guestID, roomID]
        );
        const bookingID = insertBookingRes.insertId;

        // Update room status
        const roomStatus = status === 'Checked In' ? 'Occupied' : 'Reserved';
        await conn.execute("UPDATE room SET status = ? WHERE roomID = ?", [roomStatus, roomID]);

        // Insert registered guests details
        if (guests.length > 0) {
          for (const g of guests) {
            await conn.execute(
              "INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber) VALUES (?, ?, ?, ?, ?)",
              [bookingID, g.fullName.trim(), parseInt(g.age), g.discountID || null, g.discountIdNumber?.trim() || null]
            );
          }
        } else {
          // Fetch guest name to insert as default single guest
          const [gInfo] = await conn.execute("SELECT firstName, lastName FROM guest WHERE guestID = ?", [guestID]);
          const defaultName = gInfo.length > 0 ? `${gInfo[0].firstName} ${gInfo[0].lastName}` : 'Primary Guest';
          await conn.execute(
            "INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber) VALUES (?, ?, 30, NULL, NULL)",
            [bookingID, defaultName]
          );
        }

        await conn.commit();
        return NextResponse.json({ success: true, message: 'Booking created successfully.' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    if (action === 'update_guests') {
      const bookingID = parseInt(body.bookingID);
      const guests = body.guests || [];

      if (!bookingID) {
        return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });
      }

      // Validate guests list
      for (const g of guests) {
        if (!g.fullName || !g.fullName.trim()) {
          return NextResponse.json({ error: 'All registered guests must have a name.' }, { status: 400 });
        }
        const age = parseInt(g.age);
        if (isNaN(age) || age <= 0) {
          return NextResponse.json({ error: 'All registered guests must have a valid age.' }, { status: 400 });
        }
        if (g.discountID) {
          if (!g.discountIdNumber || !g.discountIdNumber.trim()) {
            return NextResponse.json({ error: `Discount ID card number is required for ${g.fullName}.` }, { status: 400 });
          }
          const discRes = await dbQuery("SELECT name FROM discounts WHERE discountID = ?", [g.discountID]);
          if (discRes.length > 0) {
            const discName = discRes[0].name.toLowerCase();
            if (discName.includes('senior') && age < 60) {
              return NextResponse.json({ error: `Guest ${g.fullName} must be at least 60 years old to qualify for the Senior Citizen discount.` }, { status: 400 });
            }
          }
        }
      }

      const pool = await getDbConnection();
      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        // Delete existing guests
        await conn.execute("DELETE FROM booking_guest_details WHERE bookingID = ?", [bookingID]);

        // Insert new guests
        for (const g of guests) {
          await conn.execute(
            "INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber) VALUES (?, ?, ?, ?, ?)",
            [bookingID, g.fullName.trim(), parseInt(g.age), g.discountID || null, g.discountIdNumber?.trim() || null]
          );
        }

        await conn.commit();
        return NextResponse.json({ success: true, message: 'Registered guests updated successfully.' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    if (action === 'checkin') {
      const bookingID = parseInt(body.bookingID);
      
      const res = await dbQuery("SELECT roomID FROM booking WHERE bookingID = ?", [bookingID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }
      const roomID = res[0].roomID;

      await dbQuery("UPDATE booking SET status = 'Checked In', checkInDateTime = NOW() WHERE bookingID = ?", [bookingID]);
      await dbQuery("UPDATE room SET status = 'Occupied' WHERE roomID = ?", [roomID]);

      return NextResponse.json({ success: true, message: 'Guest checked in successfully.' });
    }

    if (action === 'checkout') {
      const bookingID = parseInt(body.bookingID);
      
      const res = await dbQuery("SELECT roomID FROM booking WHERE bookingID = ?", [bookingID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }
      const roomID = res[0].roomID;

      await dbQuery("UPDATE booking SET status = 'Checked Out', checkOutDateTime = NOW() WHERE bookingID = ?", [bookingID]);
      await dbQuery("UPDATE room SET status = 'Available' WHERE roomID = ?", [roomID]);

      return NextResponse.json({ success: true, message: 'Guest checked out successfully.' });
    }

    if (action === 'cancel') {
      const bookingID = parseInt(body.bookingID);
      const cancelRemarks = body.cancelRemarks?.trim() || '';
      if (!cancelRemarks) {
        return NextResponse.json({ error: 'Cancellation remarks are mandatory.' }, { status: 400 });
      }
      
      const res = await dbQuery("SELECT roomID FROM booking WHERE bookingID = ?", [bookingID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }
      const roomID = res[0].roomID;

      await dbQuery("UPDATE booking SET status = 'Canceled', cancelRemarks = ? WHERE bookingID = ?", [cancelRemarks, bookingID]);
      await dbQuery("UPDATE room SET status = 'Available' WHERE roomID = ?", [roomID]);

      return NextResponse.json({ success: true, message: 'Booking canceled successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process booking action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
