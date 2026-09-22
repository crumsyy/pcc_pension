import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncRoomStatuses, getBookingBalance, getBookingBalanceDetails, ensureTestModeSchema, ensurePaymentSchema, ensureBookingBillingSchema, logBillingAudit, completeBookingAndFreeRoom, syncNormalizedBillingLineItems } from '@/lib/db';
import { sendBookingConfirmationEmail } from '@/lib/mailer';

export async function GET(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get('discountsOnly') === 'true') {
    try {
      const discounts = await dbQuery("SELECT discountID, name, percentage FROM discounts WHERE isArchived = 0 ORDER BY name ASC");
      return NextResponse.json({ discounts });
    } catch (error) {
      return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
    }
  }

  await syncRoomStatuses();
  await ensureBookingBillingSchema();

  try {
    const [bookings, guests, rooms, guestsDetails, discounts, paymentMethods, activeBookings, activeReservations] = await Promise.all([
      dbQuery(`
        SELECT b.bookingID, DATE_FORMAT(b.checkInDateTime, '%Y-%m-%dT%H:%i:%s') as checkInDateTime, DATE_FORMAT(b.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime,
               CASE
                 WHEN b.status IN ('Pending Check-in', 'Pending', 'Confirmed', 'Booked') AND NOW() >= b.checkInDateTime AND DATE(b.checkInDateTime) = CURDATE() THEN 'Overdue Check-In'
                 WHEN b.status IN ('Pending Check-in', 'Pending', 'Confirmed', 'Booked') AND DATE(b.checkInDateTime) < CURDATE() THEN 'No Show'
                 ELSE b.status
               END as status,
               b.reservationID, b.guestID, b.roomID, b.cancelRemarks,
               b.finalBalance, b.checkoutRequestedAt, b.roomVerifiedAt, b.finalBillingUpdatedAt, b.paymentCompletedAt,
               g.userID, g.firstName, g.middleName, g.lastName, g.contact, g.email, g.gender, g.dateOfBirth,
                rm.roomNumber, rm.occupancyLimit, COALESCE(rt.type, 'Standard Room') as roomType, rm.image
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        JOIN room rm ON rm.roomID = b.roomID
        LEFT JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE rm.isArchived = 0
        ORDER BY b.checkInDateTime DESC
      `),
      dbQuery("SELECT guestID, userID, firstName, lastName, contact, email, DATE_FORMAT(dateOfBirth, '%Y-%m-%d') as dateOfBirth, gender FROM guest WHERE userID IS NOT NULL ORDER BY lastName, firstName"),
      dbQuery(`
        SELECT r.roomID, r.roomNumber, r.status, r.occupancyLimit, r.image, COALESCE(rt.type, 'Standard Room') as roomType,
               r.breakfastRate,
               COALESCE(
                 (
                   SELECT rr2.rate 
                   FROM room_rate rr2 
                   WHERE rr2.roomTypeID = r.roomTypeID AND rr2.floorID = r.floorID AND rr2.breakfastID = 2 
                   LIMIT 1
                 ), 1400.00
               ) as rateWithBreakfast,
               COALESCE(
                 (
                   SELECT rr1.rate 
                   FROM room_rate rr1 
                   WHERE rr1.roomTypeID = r.roomTypeID AND rr1.floorID = r.floorID AND rr1.breakfastID = 1 
                   LIMIT 1
                 ), 1200.00
               ) as rateWithoutBreakfast,
               COALESCE(
                 (
                   SELECT rr1.rate 
                   FROM room_rate rr1 
                   WHERE rr1.roomTypeID = r.roomTypeID AND rr1.floorID = r.floorID AND rr1.breakfastID = 1 
                   LIMIT 1
                 ), 1200.00
               ) as rate
        FROM room r 
        LEFT JOIN room_type rt ON rt.roomTypeID = r.roomTypeID 
        WHERE r.isArchived = 0 
        ORDER BY r.roomNumber
      `),
      dbQuery(`
        SELECT bg.*, d.name as discountName, d.percentage as discountPercentage
        FROM booking_guest_details bg
        LEFT JOIN discounts d ON d.discountID = bg.discountID
      `),
      dbQuery("SELECT discountID, name, percentage FROM discounts WHERE isArchived = 0 ORDER BY name ASC"),
      dbQuery("SELECT paymentMethodID, paymentMethod FROM payment_method"),
      dbQuery(`
        SELECT bookingID, roomID, checkInDateTime, checkOutDateTime, status, 'booking' as type
        FROM booking
        WHERE status NOT IN ('Cancelled', 'Checked Out', 'No Show')
          AND checkOutDateTime >= CURDATE()
      `),
      dbQuery(`
        SELECT reservationID, roomID, reservationDateTime as checkInDateTime,
               COALESCE(checkOutDateTime, DATE_ADD(reservationDateTime, INTERVAL 1 DAY)) as checkOutDateTime,
               status, 'reservation' as type, isCourtesyHold
        FROM reservation
        WHERE status NOT IN ('Cancelled', 'Checked Out', 'No Show', 'Released')
          AND (
            reservationDateTime >= CURDATE()
            OR (status = 'Courtesy Hold' AND (holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(holdExpiryDateTime, INTERVAL 30 MINUTE)))
          )
      `)
    ]);

    const roomSchedules = [...(activeBookings || []), ...(activeReservations || [])];

    const bookingsWithGuests = await Promise.all(bookings.map(async b => {
      const remainingBalance = await getBookingBalance(b.bookingID);
      const incidentals = await dbQuery(
        "SELECT chargeID, description, amount, DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i') as createdAt FROM incidental_charge WHERE bookingID = ? ORDER BY chargeID ASC",
        [b.bookingID]
      );
      return {
        ...b,
        remainingBalance,
        incidentals: incidentals || [],
        registeredGuests: guestsDetails.filter(gd => gd.bookingID === b.bookingID)
      };
    }));

    return NextResponse.json({ bookings: bookingsWithGuests, guests, rooms, discounts, paymentMethods, roomSchedules });
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
        let guestEmail = null;
        if (!body.guestID || body.isWalkIn) {
          const { firstName, lastName, contact, email, gender, dateOfBirth } = body;
          if (!firstName || !firstName.trim() || !lastName || !lastName.trim()) {
            return NextResponse.json({ error: 'First name and Last name are required.' }, { status: 400 });
          }
          if (!email || !email.trim()) {
            return NextResponse.json({ error: 'Guest email address is required for all bookings.' }, { status: 400 });
          }
          const cleanEmail = email.trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
          }
          if (dateOfBirth) {
            const dobObj = new Date(dateOfBirth + 'T00:00:00');
            const todayZero = new Date();
            todayZero.setHours(0, 0, 0, 0);
            if (dobObj >= todayZero) {
              return NextResponse.json({ error: 'Date of birth cannot be today or in the future.' }, { status: 400 });
            }
          }
          const cleanContact = (contact || '').trim();

          // Check if guest already exists by email or contact
          const [existingGuests] = await conn.execute(
            "SELECT guestID, userID, email FROM guest WHERE (email IS NOT NULL AND LOWER(email) = ?) OR (contact = ? AND contact != '') ORDER BY (userID IS NOT NULL) DESC, guestID DESC LIMIT 1",
            [cleanEmail, cleanContact]
          );

          if (existingGuests && existingGuests.length > 0) {
            guestID = existingGuests[0].guestID;
            guestEmail = cleanEmail;
            if (!existingGuests[0].userID) {
              await conn.execute(
                "UPDATE guest SET firstName = COALESCE(NULLIF(?, ''), firstName), lastName = COALESCE(NULLIF(?, ''), lastName), contact = COALESCE(NULLIF(?, ''), contact), dateOfBirth = COALESCE(NULLIF(?, ''), dateOfBirth), email = ? WHERE guestID = ?",
                [firstName.trim(), lastName.trim(), cleanContact, dateOfBirth || null, cleanEmail, guestID]
              );
            }
          } else {
            const [insertGuestRes] = await conn.execute(
              "INSERT INTO guest (firstName, lastName, contact, email, gender, dateOfBirth, userID) VALUES (?, ?, ?, ?, ?, ?, NULL)",
              [firstName.trim(), lastName.trim(), cleanContact, cleanEmail, gender || null, dateOfBirth || null]
            );
            guestID = insertGuestRes.insertId;
            guestEmail = cleanEmail;
          }
        } else {
          guestID = parseInt(body.guestID);
          const [existingGuestRows] = await conn.execute("SELECT email, firstName, lastName FROM guest WHERE guestID = ?", [guestID]);
          guestEmail = (body.email || existingGuestRows[0]?.email || '').trim().toLowerCase();
          if (!guestEmail) {
            return NextResponse.json({ error: 'Guest email address is required for all bookings.' }, { status: 400 });
          }
          if (body.email && body.email.trim()) {
            await conn.execute("UPDATE guest SET email = ? WHERE guestID = ?", [guestEmail, guestID]);
          }
        }

        const roomID = parseInt(body.roomID);
        const checkInDateTime = body.checkInDateTime;
        const checkOutDateTime = body.checkOutDateTime;
        const status = body.status === 'Active Stay' || body.checkInNow ? 'Active Stay' : (body.status || 'Pending');
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

        // Calculate required down payment based on room stay charges strictly (excluding extra guest fees)
        await ensureBookingBillingSchema();

        const inDateStr = (checkInDateTime || '').split(' ')[0] || (checkInDateTime || '').split('T')[0];
        const outDateStr = (checkOutDateTime || '').split(' ')[0] || (checkOutDateTime || '').split('T')[0];
        const inDateD = new Date(inDateStr + 'T00:00:00');
        const outDateD = new Date(outDateStr + 'T00:00:00');
        const diffDays = Math.max(1, Math.round(Math.abs(outDateD - inDateD) / (1000 * 60 * 60 * 24)));

        const breakfastOption = body.breakfastOption === 'with' ? 'with' : 'without';
        const breakfastID = breakfastOption === 'with' ? 2 : 1;

        const [roomData] = await conn.execute(
          "SELECT r.floorID, r.roomTypeID, r.occupancyLimit, rr.rate FROM room r LEFT JOIN room_rate rr ON rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID AND rr.breakfastID = ? WHERE r.roomID = ?",
          [breakfastID, roomID]
        );
        let roomRate = 0;
        if (roomData.length > 0 && roomData[0].rate != null) {
          roomRate = parseFloat(roomData[0].rate);
        } else {
          const [defData] = await conn.execute(
            "SELECT rr.rate FROM room r JOIN room_rate rr ON rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID WHERE r.roomID = ? ORDER BY rr.rate ASC LIMIT 1",
            [roomID]
          );
          roomRate = defData.length > 0 && defData[0].rate != null ? parseFloat(defData[0].rate) : 0;
        }

        const rawRoomCharge = roomRate * diffDays;
        let roomDiscountAmount = 0;
        if (guests.length > 0) {
          const sharePerGuest = rawRoomCharge / guests.length;
          for (const g of guests) {
            if (g.discountID) {
              const [discRes] = await conn.execute("SELECT percentage FROM discounts WHERE discountID = ?", [g.discountID]);
              if (discRes.length > 0) {
                const pct = parseFloat(discRes[0].percentage || 0);
                roomDiscountAmount += sharePerGuest * (pct / 100);
              }
            }
          }
        }
        const finalRoomCharge = Math.max(0, Math.round((rawRoomCharge - roomDiscountAmount) * 100) / 100);

        // Down payment applies STRICTLY to room stay charges; extra guest fees are EXCLUDED
        const dpPercentageNum = (parseFloat(body.downPaymentPercentage) || 50) / 100;
        const dpPercentageInt = parseInt(body.downPaymentPercentage) || 50;
        const requiredDp = Math.round((finalRoomCharge * dpPercentageNum) * 100) / 100;

        if (downPaymentAmount < requiredDp - 0.05) {
          return NextResponse.json({ 
            error: `Payment received (₱${downPaymentAmount.toFixed(2)}) cannot be below the selected ${dpPercentageInt}% requirement of ₱${requiredDp.toFixed(2)} on room stay charges.` 
          }, { status: 400 });
        }

        const initialBalance = Math.max(0, Math.round((finalRoomCharge - downPaymentAmount) * 100) / 100);

        // Validation for GCash down payment: If paymentMethod = GCash and payment status != Settled, block booking save
        if (parseInt(paymentMethodID) === 2 && body.paymentStatus !== 'Settled' && !body.isGcashSettled) {
          await conn.rollback();
          return NextResponse.json({ error: "Cannot proceed: GCash payment not settled." }, { status: 400 });
        }

        // Check for duplicate booking for same guest, same room, and same check-in date
        const [dupCheck] = await conn.execute(
          `SELECT bookingID, status FROM booking 
           WHERE guestID = ? AND roomID = ? 
             AND status NOT IN ('Cancelled', 'Checked Out', 'No Show')
             AND DATE(checkInDateTime) = DATE(?)`,
          [guestID, roomID, checkInDateTime]
        );
        if (dupCheck.length > 0) {
          return NextResponse.json({
            error: `A booking already exists for this guest in this room on ${inDateOnlyStr}. Duplicate booking blocked.`
          }, { status: 409 });
        }

        const convReservationID = body.reservationID ? parseInt(body.reservationID) : null;

        // Auto-cancel any competing active reservations for this room overlapping the stay
        const [compRes] = await conn.execute(
          `SELECT reservationID, guestID FROM reservation 
           WHERE roomID = ? AND status IN ('Pending', 'Confirmed')
             ${convReservationID ? 'AND reservationID != ' + convReservationID : ''}
             AND reservationDateTime < ? AND COALESCE(checkOutDateTime, DATE_ADD(reservationDateTime, INTERVAL 1 DAY)) > ?`,
          [roomID, checkOutDateTime, checkInDateTime]
        );
        for (const c of compRes) {
          await conn.execute(
            `UPDATE reservation SET status = 'Cancelled', specialRequests = CONCAT(COALESCE(specialRequests, ''), ' [Auto-cancelled: Room booked for conflicting dates]') WHERE reservationID = ?`,
            [c.reservationID]
          );
        }

        // Timestamp resolution based on useCurrentTime
        let finalCheckInDateTime = checkInDateTime;
        let bookingStatus = status;
        if (body.useCurrentTime === true || body.useCurrentTimeIn === true || status === 'Checked In') {
          const localNow = new Date();
          const pad = (num) => String(num).padStart(2, '0');
          finalCheckInDateTime = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;
          bookingStatus = 'Checked In';
        }
        let finalCheckOutDateTime = checkOutDateTime;
        if (body.useCurrentTimeOut === true) {
          const localNow = new Date();
          const pad = (num) => String(num).padStart(2, '0');
          finalCheckOutDateTime = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;
        }

        const totalGuestsCount = guests.length > 0 ? guests.length : 1;
        // Insert booking with roomRate, roomCharge, downPaymentAmount, downPaymentPercentage, remainingBalance, breakfastOption, breakfastID, guestCount
        const [insertBookingRes] = await conn.execute(
          `INSERT INTO booking(checkInDateTime, checkOutDateTime, status, reservationID, guestID, roomID, roomRate, roomCharge, downPaymentAmount, downPaymentPercentage, remainingBalance, breakfastOption, breakfastID, guestCount)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [finalCheckInDateTime, finalCheckOutDateTime, bookingStatus, convReservationID, guestID, roomID, roomRate, finalRoomCharge, downPaymentAmount, dpPercentageInt, initialBalance, breakfastOption, breakfastID, totalGuestsCount]
        );
        const bookingID = insertBookingRes.insertId;

        // If converted from a reservation, update its status to Booked
        if (convReservationID) {
          await conn.execute("UPDATE reservation SET status = 'Booked' WHERE reservationID = ?", [convReservationID]);
        }

        // Update room status upon booking creation (Occupied if Active Stay / Checked In, Reserved if Pending)
        const roomStatus = (bookingStatus === 'Active Stay' || bookingStatus === 'Checked In') ? 'Occupied' : 'Reserved';
        await conn.execute("UPDATE room SET status = ? WHERE roomID = ?", [roomStatus, roomID]);

        if (roomStatus === 'Occupied') {
          await conn.execute("UPDATE orders SET orderStatus = 'Preparing' WHERE (bookingID = ? OR guestID = ?) AND orderStatus = 'Pending Delivery'", [bookingID, guestID]);
        }

        // If early check-in fee applies, record into incidental_charge
        let earlyFeeToRecord = parseFloat(body.earlyFee) || 0;
        let earlyHoursToRecord = parseInt(body.earlyHours) || 0;
        if (!earlyFeeToRecord && (body.useCurrentTimeIn || bookingStatus === 'Checked In')) {
          const now = new Date();
          const pad = (n) => String(n).padStart(2, '0');
          const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
          if (inDateStr === todayStr && now.getHours() < 14) {
            const exactRemainingMinutes = (14 * 60) - (now.getHours() * 60 + now.getMinutes());
            if (exactRemainingMinutes > 0) {
              earlyHoursToRecord = Math.max(1, Math.ceil(exactRemainingMinutes / 60));
              earlyFeeToRecord = earlyHoursToRecord * 50;
            }
          }
        }
        if (earlyFeeToRecord > 0) {
          const feeDesc = `Early Check-In Fee (${earlyHoursToRecord} hr(s) @ ₱50.00/hr before 2:00 PM)`;
          await conn.execute(
            "INSERT INTO incidental_charge (bookingID, description, amount) VALUES (?, ?, ?)",
            [bookingID, feeDesc, earlyFeeToRecord]
          );
        }

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

        // Ensure payment schema
        await ensurePaymentSchema();

        // Record Down Payment with 'Settled' status and referenceNumber
        const refNumber = body.referenceNumber || (parseInt(paymentMethodID) === 2 ? `GCASH-BK-${bookingID}` : `CASH-${Date.now().toString().slice(-6)}`);
        const [paymentInsert] = await conn.execute(
          `INSERT INTO payment (amount, cashReceived, \`change\`, changeAmount, billingID, guestID, staffID, paymentMethodID, discountID, promotionID, testMode, status, referenceNumber) 
           VALUES (?, ?, 0, 0.00, ?, ?, ?, ?, NULL, NULL, 1, 'Settled', ?)`,
          [downPaymentAmount, downPaymentAmount, billingID, guestID, staffID, paymentMethodID, refNumber]
        );
        const paymentID = paymentInsert.insertId;

        // Insert Transaction log
        await conn.execute(
          "INSERT INTO transactions (transactionDateTime, billingID, paymentID, testMode) VALUES (?, ?, ?, 1)",
          [nowStr, billingID, paymentID]
        );

        // Log to billing_audit
        await logBillingAudit(conn, {
          billingID,
          bookingID,
          transactionType: 'Down Payment',
          status: 'Settled',
          amount: downPaymentAmount,
          balanceBefore: finalRoomCharge,
          balanceAfter: initialBalance,
          userID: session?.userID || null,
          userName: session?.fullName || 'Receptionist',
          userRole: session?.role || 'Receptionist',
          description: `Down payment recorded upon booking creation (${status}) - ${dpPercentageInt}% on Room Charges`,
          referenceNumber: refNumber
        });

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

        await syncNormalizedBillingLineItems(conn, billingID, bookingID);
        await conn.commit();

        // Dispatch Booking Confirmation Email with authoritative DB balance
        try {
          const [roomInfo] = await conn.execute(
            "SELECT rm.roomNumber, COALESCE(rt.type, 'Standard Room') as roomType FROM room rm LEFT JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID WHERE rm.roomID = ?",
            [roomID]
          );
          const [gInfo] = await conn.execute("SELECT firstName, lastName FROM guest WHERE guestID = ?", [guestID]);
          const guestFullName = gInfo.length > 0 ? `${gInfo[0].firstName} ${gInfo[0].lastName}` : 'Valued Guest';

          const [syncBill] = await conn.execute(
            "SELECT remainingBalance, downPaymentAmount FROM billing WHERE billingID = ?",
            [billingID]
          );
          const finalRemBalance = syncBill && syncBill[0]?.remainingBalance != null
            ? parseFloat(syncBill[0].remainingBalance)
            : Math.max(0, totalAmount - downPaymentAmount);
          const finalDownPayment = syncBill && syncBill[0]?.downPaymentAmount != null
            ? parseFloat(syncBill[0].downPaymentAmount)
            : downPaymentAmount;

          sendBookingConfirmationEmail(guestEmail, guestFullName, {
            bookingID,
            roomNumber: roomInfo[0]?.roomNumber || '',
            roomType: roomInfo[0]?.roomType || 'Standard',
            status,
            checkInDateTime,
            checkOutDateTime,
            downPaymentAmount: finalDownPayment,
            remainingBalance: finalRemBalance,
            paymentMethod: parseInt(paymentMethodID) === 2 ? 'GCash' : 'Cash',
            referenceNumber: refNumber
          }).catch(() => {});
        } catch (mailErr) {
          console.error("Failed to send booking confirmation email:", mailErr);
        }

        return NextResponse.json({ success: true, message: 'Booking created successfully with down payment.' });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    if (action === 'update_booking') {
      const bookingID = parseInt(body.bookingID);
      const checkInDateTime = body.checkInDateTime;
      const checkOutDateTime = body.checkOutDateTime;
      const numGuestsCount = parseInt(body.numGuestsCount) || 1;

      if (!bookingID) {
        return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });
      }

      // Retrieve old booking details
      const oldRes = await dbQuery(`
        SELECT b.bookingID, b.status, b.checkInDateTime, b.checkOutDateTime, b.roomID, r.occupancyLimit
        FROM booking b
        LEFT JOIN room r ON b.roomID = r.roomID
        WHERE b.bookingID = ?
      `, [bookingID]);

      if (oldRes.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }

      const oldBooking = oldRes[0];
      const maxOccupancy = parseInt(oldBooking.roomBasePax || oldBooking.occupancyLimit) || 4;

      // Calculate stay nights (minimum 1 night)
      const inD = new Date(checkInDateTime.replace(' ', 'T'));
      const outD = new Date(checkOutDateTime.replace(' ', 'T'));

      if (inD.getTime() < new Date().getTime() - 60000) {
        return NextResponse.json({ error: 'Reservation or booking has already passed.' }, { status: 400 });
      }

      let nights = 0;
      if (outD > inD) {
        nights = Math.round(Math.abs(outD - inD) / (1000 * 60 * 60 * 24));
      }
      nights = Math.max(1, nights);

      // Extra guest fee calculation (₱100/night per extra guest)
      const excessGuestsCount = Math.max(0, numGuestsCount - maxOccupancy);
      const extraGuestFee = excessGuestsCount * 100 * nights;

      const pool = await getDbConnection();
      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        // Update booking checkIn/Out timestamps and room/guest if specified
        const newRoomID = body.roomID ? parseInt(body.roomID) : oldBooking.roomID;
        const newGuestID = body.guestID ? parseInt(body.guestID) : oldBooking.guestID;
        await conn.execute(
          "UPDATE booking SET checkInDateTime = ?, checkOutDateTime = ?, roomID = ?, guestID = ? WHERE bookingID = ?",
          [checkInDateTime, checkOutDateTime, newRoomID, newGuestID, bookingID]
        );

        // Update guest information if provided
        if (body.guestForm && newGuestID) {
          const { firstName, lastName, contact, email, gender, dateOfBirth } = body.guestForm;
          const dobVal = dateOfBirth ? (dateOfBirth.includes('/') ? dateOfBirth.split('/').reverse().join('-') : dateOfBirth) : null;
          await conn.execute(
            "UPDATE guest SET firstName = COALESCE(?, firstName), lastName = COALESCE(?, lastName), contact = COALESCE(?, contact), email = COALESCE(?, email), gender = COALESCE(?, gender), dateOfBirth = COALESCE(?, dateOfBirth) WHERE guestID = ?",
            [firstName || null, lastName || null, contact || null, email || null, gender || null, dobVal || null, newGuestID]
          );
        }

        // Update registered guests & discounts if provided
        if (Array.isArray(body.guests) && body.guests.length > 0) {
          await conn.execute("DELETE FROM booking_guest_details WHERE bookingID = ?", [bookingID]);
          for (const g of body.guests) {
            if (g.fullName && g.fullName.trim()) {
              await conn.execute(
                "INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber) VALUES (?, ?, ?, ?, ?)",
                [bookingID, g.fullName.trim(), parseInt(g.age) || 30, g.discountID || null, g.discountIdNumber?.trim() || null]
              );
            }
          }
        }

        // Record fee in incidental_charge if extra guest fee exists
        if (extraGuestFee > 0) {
          const feeDesc = `Extra Capacity Charge (${excessGuestsCount} Extra Pax @ ₱100.00/night x ${nights} Night(s))`;
          
          const existingInc = await conn.execute(
            "SELECT chargeID FROM incidental_charge WHERE bookingID = ? AND description LIKE '%Extra Capacity Charge%'",
            [bookingID]
          );

          if (existingInc[0].length > 0) {
            await conn.execute(
              "UPDATE incidental_charge SET amount = ?, description = ? WHERE chargeID = ?",
              [extraGuestFee, feeDesc, existingInc[0][0].chargeID]
            );
          } else {
            await conn.execute(
              "INSERT INTO incidental_charge (bookingID, description, amount) VALUES (?, ?, ?)",
              [bookingID, feeDesc, extraGuestFee]
            );
          }
        }

        // Record Audit Log in notification table
        const staffID = session.userID || 'Staff';
        const nowFormatted = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const auditMsg = `Booking #BK${String(bookingID).padStart(5, '0')} updated by Staff ID #${staffID} at ${nowFormatted}. Status: ${oldBooking.status}. Schedule: [${oldBooking.checkInDateTime} -> ${checkInDateTime}], [${oldBooking.checkOutDateTime} -> ${checkOutDateTime}]. Guest Count: ${numGuestsCount}.`;

        await conn.execute(
          "INSERT INTO notification (userID, title, message, isRead) VALUES (?, 'Booking Rebooked / Updated', ?, 0)",
          [session.userID || 1, auditMsg]
        );

        await conn.commit();
        return NextResponse.json({
          success: true,
          message: extraGuestFee > 0
            ? `Booking updated successfully. ₱${extraGuestFee.toFixed(2)} Extra Guest Fee added to incidental charges.`
            : 'Booking updated successfully.'
        });
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

      // Get Philippine Time (UTC+8)
      const manilaFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const parts = manilaFormatter.formatToParts(new Date());
      const p = {};
      parts.forEach(({ type, value }) => { p[type] = value; });
      const manilaDateStr = `${p.year}-${p.month}-${p.day}`;
      const manilaHour = parseInt(p.hour, 10);
      const manilaMinute = parseInt(p.minute, 10);

      let earlyHours = 0;
      let earlyFee = 0;

      // Early check-in applies strictly on the scheduled check-in date before 2:00 PM (14:00)
      if (manilaDateStr === scheduledCheckInDate && manilaHour < 14) {
        // Difference from standard 2:00 PM (14:00) check-in time
        const exactRemainingMinutes = (14 * 60) - (manilaHour * 60 + manilaMinute);
        earlyHours = Math.max(1, Math.ceil(exactRemainingMinutes / 60));
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

      const nowStr = `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;

      // If early check-in confirmed, record fee in incidental charges
      if (confirmEarlyCheckIn && earlyFee > 0) {
        const feeDesc = `Early Check-In Fee (${earlyHours} hr(s) @ ₱50.00/hr before 2:00 PM)`;
        await dbQuery(
          "INSERT INTO incidental_charge (bookingID, description, amount) VALUES (?, ?, ?)",
          [bookingID, feeDesc, earlyFee]
        );
      }

      await dbQuery("UPDATE booking SET status = 'Active Stay', checkInDateTime = ? WHERE bookingID = ?", [nowStr, bookingID]);
      await dbQuery("UPDATE room SET status = 'Occupied' WHERE roomID = ?", [roomID]);
      // Note: Reservation lifecycle concluded at 'Booked'. It is not modified here.
      // Auto-transition Pending Delivery orders to active (Preparing)
      await dbQuery("UPDATE orders SET orderStatus = 'Preparing' WHERE bookingID = ? AND orderStatus = 'Pending Delivery'", [bookingID]);

      return NextResponse.json({
        success: true,
        message: earlyFee > 0 ? `Guest checked in early successfully. ₱${earlyFee.toFixed(2)} Early Check-In Fee added to bill.` : 'Guest checked in successfully.',
        earlyFee,
        earlyHours
      });
    }

    if (action === 'verify_room') {
      const bookingID = parseInt(body.bookingID);
      const inspectionNotes = body.notes?.trim() || '';

      if (!bookingID) {
        return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });
      }

      const res = await dbQuery("SELECT b.roomID, b.guestID, rm.roomNumber FROM booking b JOIN room rm ON rm.roomID = b.roomID WHERE b.bookingID = ?", [bookingID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }

      const { guestID, roomNumber } = res[0];

      await ensureBookingBillingSchema();
      await dbQuery(
        "UPDATE booking SET status = 'Pending Bill', roomVerifiedAt = NOW() WHERE bookingID = ?",
        [bookingID]
      );

      // Notify guest in real-time
      const guestRes = await dbQuery("SELECT userID FROM guest WHERE guestID = ?", [guestID]);
      if (guestRes.length > 0 && guestRes[0].userID) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Room Inspection Verified', ?)",
          [
            guestRes[0].userID,
            `Room ${roomNumber} has been inspected and verified by staff. Front desk is now finalizing your billing statement.`
          ]
        );
      }

      return NextResponse.json({
        success: true,
        message: `Room ${roomNumber} verified successfully. Bill is now pending finalization.`,
        bookingStatus: 'Pending Bill'
      });
    }

    if (action === 'finalize_bill' || action === 'update_final_billing') {
      const bookingID = parseInt(body.bookingID);
      const incidentals = body.incidentals || []; // array of { description, amount }

      if (!bookingID) {
        return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });
      }

      const res = await dbQuery("SELECT b.roomID, b.guestID, rm.roomNumber FROM booking b JOIN room rm ON rm.roomID = b.roomID WHERE b.bookingID = ?", [bookingID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }
      const { guestID, roomNumber } = res[0];

      await ensureBookingBillingSchema();

      // Add any incidentals provided (minibar, damages, extra towels, etc.)
      if (Array.isArray(incidentals)) {
        for (const inc of incidentals) {
          if (inc.description && parseFloat(inc.amount) > 0) {
            await dbQuery(
              "INSERT INTO incidental_charge (bookingID, description, amount, createdAt) VALUES (?, ?, ?, NOW())",
              [bookingID, inc.description.trim(), parseFloat(inc.amount)]
            );
          }
        }
      }

      // Single incidental convenience payload
      if (body.singleIncidental?.description && parseFloat(body.singleIncidental?.amount) > 0) {
        await dbQuery(
          "INSERT INTO incidental_charge (bookingID, description, amount, createdAt) VALUES (?, ?, ?, NOW())",
          [bookingID, body.singleIncidental.description.trim(), parseFloat(body.singleIncidental.amount)]
        );
      }

      // Compute final accurate balance and billing details
      const balanceDetails = await getBookingBalanceDetails(bookingID);
      const balance = balanceDetails?.balance ?? 0;
      const subtotal = balanceDetails?.subtotal ?? balance;
      const downPaymentPaid = balanceDetails?.chargesSummary?.downPaymentPaid ?? 0;

      await dbQuery(
        "UPDATE booking SET status = 'Bill Finalized', finalBalance = ?, remainingBalance = ?, finalBillingUpdatedAt = NOW(), billFinalizedAt = NOW() WHERE bookingID = ?",
        [balance, balance, bookingID]
      );

      const [billingRows] = await dbQuery("SELECT billingID FROM billing WHERE bookingID = ? ORDER BY billingID DESC LIMIT 1", [bookingID]);
      const billingID = billingRows?.billingID || null;

      if (billingID) {
        await dbQuery(
          "UPDATE billing SET balance = ?, remainingBalance = ?, totalAmount = ?, downPaymentAmount = ? WHERE billingID = ?",
          [balance, balance, subtotal, downPaymentPaid, billingID]
        );
        await syncNormalizedBillingLineItems(null, billingID, bookingID);
      }

      // Notify guest in real-time
      const guestRes = await dbQuery("SELECT userID FROM guest WHERE guestID = ?", [guestID]);
      if (guestRes.length > 0 && guestRes[0].userID) {
        const msg = balance > 0
          ? `Your bill for Room ${roomNumber} has been finalized (₱${balance.toFixed(2)}). You can now proceed to pay online from your portal or settle at the front desk.`
          : `Your bill for Room ${roomNumber} is finalized and settled (₱0.00 balance). You are ready for checkout!`;
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'Bill Finalized — Ready for Payment', ?)",
          [guestRes[0].userID, msg]
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Bill is now finalized for payment. Guest can proceed to payment.',
        finalBalance: balance,
        bookingStatus: 'Bill Finalized'
      });
    }

    if (action === 'checkout') {
      const bookingID = parseInt(body.bookingID);
      const confirmEarlyCheckOut = !!body.confirmEarlyCheckOut;
      
      const res = await dbQuery("SELECT roomID, checkOutDateTime, status FROM booking WHERE bookingID = ?", [bookingID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }
      const { roomID, checkOutDateTime, status } = res[0];

      const localNow = new Date();
      const scheduledCheckOut = new Date(String(checkOutDateTime).replace(' ', 'T'));

      if (localNow < scheduledCheckOut && !confirmEarlyCheckOut && status !== 'Payment Completed') {
        return NextResponse.json({
          requiresEarlyCheckOutConfirmation: true,
          message: "Are you sure you want to checkout even if it's still not the checkout time yet."
        });
      }

      // Strict Guard: Only set room available once payment or transaction completed
      const currentBalance = await getBookingBalance(bookingID);
      if (currentBalance > 0.05) {
        return NextResponse.json({
          error: `Cannot complete checkout. Outstanding balance of ₱${currentBalance.toFixed(2)} must be fully settled first.`
        }, { status: 400 });
      }

      const checkoutRes = await completeBookingAndFreeRoom(bookingID);
      if (checkoutRes.error) {
        return NextResponse.json({ error: checkoutRes.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Guest checked out successfully.',
        bookingStatus: 'Completed',
        roomStatus: 'Available'
      });
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
      await syncRoomStatuses(true);

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
