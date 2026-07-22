import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncRoomStatuses, getBookingBalance } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get('discountsOnly') === 'true') {
    try {
      const discounts = await dbQuery("SELECT discountID, name, percentage FROM discounts WHERE eligibilityTypeID = 1 AND isArchived = 0");
      return NextResponse.json({ discounts });
    } catch (error) {
      return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
    }
  }

  await syncRoomStatuses();

  try {
    const [bookings, guests, rooms, guestsDetails, discounts, paymentMethods] = await Promise.all([
      dbQuery(`
        SELECT b.bookingID, DATE_FORMAT(b.checkInDateTime, '%Y-%m-%dT%H:%i:%s') as checkInDateTime, DATE_FORMAT(b.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime, b.status, b.reservationID, b.guestID, b.roomID, b.cancelRemarks,
               g.firstName, g.middleName, g.lastName, g.contact, g.email, g.gender, g.dateOfBirth,
               rm.roomNumber, rt.type as roomType
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        JOIN room rm ON rm.roomID = b.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE rm.isArchived = 0
        ORDER BY b.checkInDateTime DESC
      `),
      dbQuery("SELECT guestID, firstName, lastName, contact, dateOfBirth FROM guest WHERE userID IS NOT NULL ORDER BY lastName, firstName"),
      dbQuery(`
        SELECT r.roomID, r.roomNumber, r.status, r.occupancyLimit, rt.type as roomType,
               COALESCE(rr_with.rate, rr_default.rate, 1500) as rateWithBreakfast,
               COALESCE(rr_without.rate, rr_with.rate - 200, 1300) as rateWithoutBreakfast,
               COALESCE(rr_with.rate, rr_default.rate, 1500) as rate
        FROM room r 
        JOIN room_type rt ON rt.roomTypeID = r.roomTypeID 
        LEFT JOIN room_rate rr_with ON rr_with.roomTypeID = r.roomTypeID AND rr_with.floorID = r.floorID AND rr_with.breakfastID = 2
        LEFT JOIN room_rate rr_without ON rr_without.roomTypeID = r.roomTypeID AND rr_without.floorID = r.floorID AND rr_without.breakfastID = 1
        LEFT JOIN room_rate rr_default ON rr_default.roomTypeID = r.roomTypeID AND rr_default.floorID = r.floorID
        WHERE r.isArchived = 0 
        GROUP BY r.roomID
        ORDER BY r.roomNumber
      `),
      dbQuery(`
        SELECT bg.*, d.name as discountName, d.percentage as discountPercentage
        FROM booking_guest_details bg
        LEFT JOIN discounts d ON d.discountID = bg.discountID
      `),
      dbQuery("SELECT discountID, name, percentage FROM discounts WHERE eligibilityTypeID = 1 AND isArchived = 0"),
      dbQuery("SELECT paymentMethodID, paymentMethod FROM payment_method")
    ]);

    const bookingsWithGuests = await Promise.all(bookings.map(async b => {
      const remainingBalance = await getBookingBalance(b.bookingID);
      return {
        ...b,
        remainingBalance,
        registeredGuests: guestsDetails.filter(gd => gd.bookingID === b.bookingID)
      };
    }));

    return NextResponse.json({ bookings: bookingsWithGuests, guests, rooms, discounts, paymentMethods });
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
          const { firstName, lastName, contact, email, gender, dateOfBirth } = body;
          if (!firstName || !firstName.trim() || !lastName || !lastName.trim()) {
            return NextResponse.json({ error: 'First name and Last name are required for walk-in guests.' }, { status: 400 });
          }
          const [insertGuestRes] = await conn.execute(
            "INSERT INTO guest (firstName, lastName, contact, email, gender, dateOfBirth, userID) VALUES (?, ?, ?, ?, ?, ?, NULL)",
            [firstName.trim(), lastName.trim(), (contact || '').trim(), (email || '').trim() || null, gender || null, dateOfBirth || null]
          );
          guestID = insertGuestRes.insertId;
        } else {
          guestID = parseInt(body.guestID);
        }

        const roomID = parseInt(body.roomID);
        const checkInDateTime = body.checkInDateTime;
        const checkOutDateTime = body.checkOutDateTime;
        const status = body.status || 'Pending Check-in';
        const downPaymentAmount = parseFloat(body.downPaymentAmount || 0);
        const paymentMethodID = parseInt(body.paymentMethodID || 1);

        if (!guestID || !roomID || !checkInDateTime || !checkOutDateTime || isNaN(downPaymentAmount) || downPaymentAmount <= 0) {
          return NextResponse.json({ error: 'Missing required fields or down payment details.' }, { status: 400 });
        }

        // Calculate required down payment based on selected percentage (25%, 50%, 100%)
        const [roomData] = await conn.execute(
          "SELECT r.floorID, r.roomTypeID, r.occupancyLimit, rr.rate FROM room r LEFT JOIN room_rate rr ON rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID AND rr.breakfastID = 1 WHERE r.roomID = ?",
          [roomID]
        );
        const roomRate = roomData.length > 0 ? parseFloat(roomData[0].rate || 0) : 0;
        const maxOccupancy = roomData.length > 0 ? (parseInt(roomData[0].occupancyLimit) || 2) : 2;
        const checkInD = new Date(checkInDateTime);
        const checkOutD = new Date(checkOutDateTime);
        const diffDays = Math.max(1, Math.ceil(Math.abs(checkOutD - checkInD) / (1000 * 60 * 60 * 24)));

        const totalGuestCount = Math.max(1, guests.length);
        const extraGuestsCount = Math.max(0, totalGuestCount - maxOccupancy);
        const extraGuestFee = extraGuestsCount * 200 * diffDays;
        const subtotalRoomCharge = (roomRate * diffDays) + extraGuestFee;

        const dpPercentageNum = (parseFloat(body.downPaymentPercentage) || 25) / 100;
        const requiredDp = subtotalRoomCharge * dpPercentageNum;

        if (downPaymentAmount < requiredDp - 0.01) {
          return NextResponse.json({ 
            error: `Received down payment amount (₱${downPaymentAmount.toFixed(2)}) cannot be below the selected down payment requirement of ₱${requiredDp.toFixed(2)} (${(dpPercentageNum * 100).toFixed(0)}%).` 
          }, { status: 400 });
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
              [bookingID, g.fullName.trim(), parseInt(g.age) || 30, g.discountID || null, g.discountIdNumber?.trim() || null]
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

        // Create Billing Record
        const localNow = new Date();
        const pad = (num) => String(num).padStart(2, '0');
        const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;
        const [billingInsert] = await conn.execute(
          "INSERT INTO billing (billingDateTime, guestID, bookingID, orderID) VALUES (?, ?, ?, NULL)",
          [nowStr, guestID, bookingID]
        );
        const billingID = billingInsert.insertId;

        // Get staffID using session userID
        const [staffRes] = await conn.execute("SELECT staffID FROM staff WHERE userID = ?", [session.userID]);
        const staffID = staffRes[0]?.staffID || null;

        // Record Down Payment
        const [paymentInsert] = await conn.execute(
          `INSERT INTO payment (amount, cashReceived, \`change\`, billingID, guestID, staffID, paymentMethodID, discountID, promotionID) 
           VALUES (?, ?, 0, ?, ?, ?, ?, NULL, NULL)`,
          [downPaymentAmount, downPaymentAmount, billingID, guestID, staffID, paymentMethodID]
        );
        const paymentID = paymentInsert.insertId;

        // Insert Transaction log
        await conn.execute(
          "INSERT INTO transactions (transactionDateTime, billingID, paymentID) VALUES (?, ?, ?)",
          [nowStr, billingID, paymentID]
        );

        await conn.commit();
        return NextResponse.json({ success: true, message: 'Booking created successfully with down payment.' });
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

      const localNow = new Date();
      const pad = (num) => String(num).padStart(2, '0');
      const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

      await dbQuery("UPDATE booking SET status = 'Checked In', checkInDateTime = ? WHERE bookingID = ?", [nowStr, bookingID]);
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

      const localNow = new Date();
      const pad = (num) => String(num).padStart(2, '0');
      const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

      await dbQuery("UPDATE booking SET status = 'Checked Out', checkOutDateTime = ? WHERE bookingID = ?", [nowStr, bookingID]);
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

      await dbQuery("UPDATE booking SET status = 'Cancelled', cancelRemarks = ? WHERE bookingID = ?", [cancelRemarks, bookingID]);
      await dbQuery("UPDATE room SET status = 'Available' WHERE roomID = ?", [roomID]);

      return NextResponse.json({ success: true, message: 'Booking canceled successfully.' });
    }

    if (action === 'noshow') {
      const bookingID = parseInt(body.bookingID);
      const res = await dbQuery("SELECT roomID FROM booking WHERE bookingID = ?", [bookingID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }
      const roomID = res[0].roomID;

      await dbQuery("UPDATE booking SET status = 'No Show' WHERE bookingID = ?", [bookingID]);
      await dbQuery("UPDATE room SET status = 'Available' WHERE roomID = ?", [roomID]);

      return NextResponse.json({ success: true, message: 'Booking marked as No Show.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process booking action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
