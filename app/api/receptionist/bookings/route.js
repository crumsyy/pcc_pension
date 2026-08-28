import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncRoomStatuses, getBookingBalance, ensureTestModeSchema } from '@/lib/db';

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
               MAX(COALESCE(rr_with.rate, rr_default.rate, 1500)) as rateWithBreakfast,
               MAX(COALESCE(rr_without.rate, rr_with.rate - 200, 1300)) as rateWithoutBreakfast,
               MAX(COALESCE(rr_with.rate, rr_default.rate, 1500)) as rate
        FROM room r 
        JOIN room_type rt ON rt.roomTypeID = r.roomTypeID 
        LEFT JOIN room_rate rr_with ON rr_with.roomTypeID = r.roomTypeID AND rr_with.floorID = r.floorID AND rr_with.breakfastID = 2
        LEFT JOIN room_rate rr_without ON rr_without.roomTypeID = r.roomTypeID AND rr_without.floorID = r.floorID AND rr_without.breakfastID = 1
        LEFT JOIN room_rate rr_default ON rr_default.roomTypeID = r.roomTypeID AND rr_default.floorID = r.floorID
        WHERE r.isArchived = 0 
        GROUP BY r.roomID, r.roomNumber, r.status, r.occupancyLimit, rt.type
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
        let age = parseInt(g.age);
        if (isNaN(age) || age <= 0) {
          age = 30;
          g.age = 30;
        }
        if (g.discountID) {
          if (!g.discountIdNumber || !g.discountIdNumber.trim()) {
            g.discountIdNumber = 'N/A';
          }
          const discRes = await dbQuery("SELECT name FROM discounts WHERE discountID = ?", [g.discountID]);
          if (discRes.length > 0) {
            const discName = discRes[0].name.toLowerCase();
            if (discName.includes('senior') && age < 60) {
              g.age = 65; // Auto-qualify senior discount
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
          if (dateOfBirth) {
            const dobObj = new Date(dateOfBirth + 'T00:00:00');
            const todayZero = new Date();
            todayZero.setHours(0, 0, 0, 0);
            if (dobObj >= todayZero) {
              return NextResponse.json({ error: 'Date of birth cannot be today or in the future.' }, { status: 400 });
            }
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

        const checkInDVal = new Date(checkInDateTime.replace(' ', 'T'));
        const checkOutDVal = new Date(checkOutDateTime.replace(' ', 'T'));

        const todayFloor = new Date();
        todayFloor.setHours(0, 0, 0, 0);

        const inDateOnlyStr = (checkInDateTime || '').split(' ')[0] || (checkInDateTime || '').split('T')[0];
        const checkInFloor = new Date(inDateOnlyStr + 'T00:00:00');

        if (checkInFloor < todayFloor) {
          return NextResponse.json({ error: 'Check-in date cannot be a past date. Please select today or a future date.' }, { status: 400 });
        }

        if (!isNaN(checkInDVal.getTime()) && !isNaN(checkOutDVal.getTime()) && checkOutDVal <= checkInDVal) {
          return NextResponse.json({ error: 'Check-out time must be later than check-in time.' }, { status: 400 });
        }

        // Calculate required down payment based on selected percentage (30%, 50%, 100%)
        const dpPercentageNum = (parseFloat(body.downPaymentPercentage) || 50) / 100;
        const providedTotal = parseFloat(body.netTotalAmount || 0);

        let subtotalRoomCharge = providedTotal;
        if (subtotalRoomCharge <= 0) {
          const [roomData] = await conn.execute(
            "SELECT r.floorID, r.roomTypeID, r.occupancyLimit, rr.rate FROM room r LEFT JOIN room_rate rr ON rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID AND rr.breakfastID = 1 WHERE r.roomID = ?",
            [roomID]
          );
          const roomRate = roomData.length > 0 ? parseFloat(roomData[0].rate || 0) : 0;
          const maxOccupancy = roomData.length > 0 ? (parseInt(roomData[0].occupancyLimit) || 2) : 2;
          const inDateStr = (checkInDateTime || '').split(' ')[0] || (checkInDateTime || '').split('T')[0];
          const outDateStr = (checkOutDateTime || '').split(' ')[0] || (checkOutDateTime || '').split('T')[0];
          const checkInD = new Date(inDateStr + 'T00:00:00');
          const checkOutD = new Date(outDateStr + 'T00:00:00');
          const diffDays = Math.max(1, Math.round(Math.abs(checkOutD - checkInD) / (1000 * 60 * 60 * 24)));

          const totalGuestCount = Math.max(1, guests.length);
          const extraGuestsCount = Math.max(0, totalGuestCount - maxOccupancy);
          const extraGuestFee = extraGuestsCount * 100 * diffDays;
          subtotalRoomCharge = (roomRate * diffDays) + extraGuestFee;
        }

        const requiredDp = Math.round((subtotalRoomCharge * dpPercentageNum) * 100) / 100;

        if (downPaymentAmount < requiredDp - 0.05) {
          return NextResponse.json({ 
            error: `Payment received (₱${downPaymentAmount.toFixed(2)}) cannot be below the selected ${(dpPercentageNum * 100).toFixed(0)}% requirement of ₱${requiredDp.toFixed(2)}.` 
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

        // Ensure testMode column schema
        await ensureTestModeSchema();

        // Record Down Payment
        const [paymentInsert] = await conn.execute(
          `INSERT INTO payment (amount, cashReceived, \`change\`, billingID, guestID, staffID, paymentMethodID, discountID, promotionID, testMode) 
           VALUES (?, ?, 0, ?, ?, ?, ?, NULL, NULL, 1)`,
          [downPaymentAmount, downPaymentAmount, billingID, guestID, staffID, paymentMethodID]
        );
        const paymentID = paymentInsert.insertId;

        // Insert Transaction log
        await conn.execute(
          "INSERT INTO transactions (transactionDateTime, billingID, paymentID, testMode) VALUES (?, ?, ?, 1)",
          [nowStr, billingID, paymentID]
        );

        // Notify Administrators (roleID = 1) of down payment
        try {
          const [admins] = await conn.execute("SELECT userID FROM user WHERE roleID = 1 AND status = 'Active'");
          for (const adm of admins) {
            await conn.execute(
              "INSERT INTO notification (userID, title, message) VALUES (?, 'Down Payment Received Alert', ?)",
              [adm.userID, `Down payment of ₱${parseFloat(downPaymentAmount).toFixed(2)} received for Booking #${bookingID}.`]
            );
          }
        } catch (adminNotifyErr) {
          console.error("Failed to notify admin of down payment:", adminNotifyErr);
        }

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
      const confirmEarlyCheckIn = !!body.confirmEarlyCheckIn;
      
      const res = await dbQuery("SELECT roomID, DATE_FORMAT(checkInDateTime, '%Y-%m-%d') as scheduledCheckInDate, checkInDateTime FROM booking WHERE bookingID = ?", [bookingID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }
      const { roomID, scheduledCheckInDate } = res[0];

      const localNow = new Date();
      const pad = (num) => String(num).padStart(2, '0');
      const todayDateStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())}`;

      // Check if current time is before standard check-in time (2:00 PM on scheduled check-in date)
      const scheduledCheckInTime = new Date(`${scheduledCheckInDate}T14:00:00`);
      let earlyHours = 0;
      let earlyFee = 0;

      if (localNow < scheduledCheckInTime) {
        const diffMs = scheduledCheckInTime - localNow;
        earlyHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
        earlyFee = earlyHours * 50;

        if (!confirmEarlyCheckIn) {
          return NextResponse.json({
            requiresEarlyCheckInConfirmation: true,
            earlyHours,
            earlyFee,
            message: `This guest is checking in early (scheduled for ${scheduledCheckInDate} at 2:00 PM). Standard check-in is 2:00 PM. An early check-in fee of ₱${earlyFee.toFixed(2)} (${earlyHours} hour(s) @ ₱50/hr) will be automatically added to the bill.`
          });
        }
      }

      const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

      // If early check-in confirmed, record fee in incidental charges
      if (confirmEarlyCheckIn && earlyFee > 0) {
        const feeDesc = `Early Check-In Fee (${earlyHours} hr(s) @ ₱50.00/hr before 2:00 PM)`;
        await dbQuery(
          "INSERT INTO incidental_charge (bookingID, description, amount) VALUES (?, ?, ?)",
          [bookingID, feeDesc, earlyFee]
        );
      }

      await dbQuery("UPDATE booking SET status = 'Checked In', checkInDateTime = ? WHERE bookingID = ?", [nowStr, bookingID]);
      await dbQuery("UPDATE room SET status = 'Occupied' WHERE roomID = ?", [roomID]);
      await dbQuery(
        "UPDATE reservation SET status = 'Checked In' WHERE reservationID = (SELECT reservationID FROM booking WHERE bookingID = ?) OR (guestID = (SELECT guestID FROM booking WHERE bookingID = ?) AND roomID = ? AND status IN ('Pending', 'Confirmed', 'Booked'))",
        [bookingID, bookingID, roomID]
      );

      return NextResponse.json({
        success: true,
        message: earlyFee > 0 ? `Guest checked in early successfully. ₱${earlyFee.toFixed(2)} Early Check-In Fee added to bill.` : 'Guest checked in successfully.',
        earlyFee,
        earlyHours
      });
    }

    if (action === 'checkout') {
      const bookingID = parseInt(body.bookingID);
      const confirmEarlyCheckOut = !!body.confirmEarlyCheckOut;
      
      const res = await dbQuery("SELECT roomID, checkOutDateTime FROM booking WHERE bookingID = ?", [bookingID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }
      const { roomID, checkOutDateTime } = res[0];

      const localNow = new Date();
      const scheduledCheckOut = new Date(String(checkOutDateTime).replace(' ', 'T'));

      if (localNow < scheduledCheckOut && !confirmEarlyCheckOut) {
        const scheduledFormatted = scheduledCheckOut.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
        return NextResponse.json({
          requiresEarlyCheckOutConfirmation: true,
          message: `The scheduled check-out time for this guest is ${scheduledFormatted}. The guest is checking out early today. Are you sure you want to process early check-out now?`
        });
      }

      const pad = (num) => String(num).padStart(2, '0');
      const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

      await dbQuery("UPDATE booking SET status = 'Checked Out', checkOutDateTime = ? WHERE bookingID = ?", [nowStr, bookingID]);
      await dbQuery("UPDATE room SET status = 'Available' WHERE roomID = ?", [roomID]);
      await dbQuery(
        "UPDATE reservation SET status = 'Checked Out' WHERE reservationID = (SELECT reservationID FROM booking WHERE bookingID = ?) OR (guestID = (SELECT guestID FROM booking WHERE bookingID = ?) AND roomID = ? AND status IN ('Pending', 'Confirmed', 'Booked', 'Checked In'))",
        [bookingID, bookingID, roomID]
      );

      return NextResponse.json({ success: true, message: 'Guest checked out successfully.' });
    }

    if (action === 'extend_stay' || action === 'update_checkout') {
      const bookingID = parseInt(body.bookingID);
      const newCheckOutDateTime = body.newCheckOutDateTime;

      if (!bookingID || !newCheckOutDateTime) {
        return NextResponse.json({ error: 'Booking ID and new check-out date & time are required.' }, { status: 400 });
      }

      const bRes = await dbQuery("SELECT checkInDateTime, guestID, roomID FROM booking WHERE bookingID = ?", [bookingID]);
      if (bRes.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }

      const inD = new Date(String(bRes[0].checkInDateTime).replace(' ', 'T'));
      const newOutD = new Date(String(newCheckOutDateTime).replace(' ', 'T'));

      if (isNaN(newOutD.getTime()) || newOutD <= inD) {
        return NextResponse.json({ error: 'Check-out time must be later than check-in time.' }, { status: 400 });
      }

      await dbQuery("UPDATE booking SET checkOutDateTime = ? WHERE bookingID = ?", [newCheckOutDateTime, bookingID]);
      await dbQuery(
        "UPDATE reservation SET checkOutDateTime = ? WHERE reservationID = (SELECT reservationID FROM booking WHERE bookingID = ?) OR (guestID = ? AND roomID = ? AND status IN ('Confirmed', 'Booked', 'Checked In'))",
        [newCheckOutDateTime, bookingID, bRes[0].guestID, bRes[0].roomID]
      );

      return NextResponse.json({ success: true, message: 'Stay extended / Check-out date updated successfully.' });
    }

    if (action === 'cancel') {
      const bookingID = parseInt(body.bookingID);
      let cancelRemarks = body.cancelRemarks?.trim() || '';
      if (!cancelRemarks) {
        return NextResponse.json({ error: 'Cancellation remarks are mandatory.' }, { status: 400 });
      }
      
      const res = await dbQuery("SELECT roomID, status, guestID FROM booking WHERE bookingID = ?", [bookingID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }

      if (res[0].status === 'Checked Out') {
        return NextResponse.json({ error: 'Cannot cancel a booking that has already checked out.' }, { status: 400 });
      }

      const wasCheckedIn = res[0].status === 'Checked In';
      if (wasCheckedIn) {
        cancelRemarks += ' [Checked-In Stay Cancelled — Non-Refundable Policy Enforced]';
      }

      const roomID = res[0].roomID;

      await dbQuery("UPDATE booking SET status = 'Cancelled', cancelRemarks = ? WHERE bookingID = ?", [cancelRemarks, bookingID]);
      await dbQuery("UPDATE room SET status = 'Available' WHERE roomID = ?", [roomID]);
      await dbQuery(
        "UPDATE reservation SET status = 'Cancelled' WHERE reservationID = (SELECT reservationID FROM booking WHERE bookingID = ?) OR (guestID = ? AND roomID = ? AND status IN ('Pending', 'Confirmed', 'Booked', 'Checked In'))",
        [bookingID, res[0].guestID, roomID]
      );

      // Notify Guest if account exists
      const guestRes = await dbQuery("SELECT userID FROM guest WHERE guestID = ?", [res[0].guestID]);
      if (guestRes.length > 0 && guestRes[0].userID) {
        const notifyMsg = wasCheckedIn 
          ? `⚠️ Stay Cancelled: Your checked-in stay (Booking #${bookingID}) has been cancelled. As per hotel policy, payments made are non-refundable.`
          : `Notice: Booking #${bookingID} has been cancelled by front desk staff.`;
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Booking Cancellation Notice', ?)",
          [guestRes[0].userID, notifyMsg]
        );
      }

      return NextResponse.json({ 
        success: true, 
        message: wasCheckedIn 
          ? 'Checked-in stay cancelled successfully. Room is now available. (Note: Payments made are non-refundable).' 
          : 'Booking cancelled successfully.' 
      });
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
