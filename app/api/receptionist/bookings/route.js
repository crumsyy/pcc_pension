import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncRoomStatuses, getBookingBalance, getBookingBalanceDetails, ensureTestModeSchema, ensurePaymentSchema, ensureBookingBillingSchema, ensureBookingBreakfastSchema, logBillingAudit, completeBookingAndFreeRoom, syncNormalizedBillingLineItems, getSystemVatRate } from '@/lib/db';
import { calculateBillingTotals } from '@/lib/billingCalculator';
import { sendBookingConfirmationEmail } from '@/lib/mailer';
import { getStayNights, getManilaNow } from '@/lib/dateUtils';

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
               b.roomRate, b.roomCharge, b.subtotal, b.discountTotal, b.netTotal, b.vatRate, b.vatAmount, b.grandTotal, b.totalAmount, b.downPaymentAmount, b.downPaymentPercentage, b.remainingBalance, b.breakfastOption, b.guestCount, b.breakfastDates, b.breakfastFee,
               g.userID, g.firstName, g.middleName, g.lastName, g.contact, g.email, g.gender, g.dateOfBirth,
                rm.roomNumber, rm.occupancyLimit, COALESCE(rt.type, 'Standard Room') as roomType, rm.image
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        JOIN room rm ON rm.roomID = b.roomID
        LEFT JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE rm.isArchived = 0
        ORDER BY b.bookingID DESC
      `),
      dbQuery("SELECT guestID, userID, firstName, middleName, lastName, contact, email, DATE_FORMAT(dateOfBirth, '%Y-%m-%d') as dateOfBirth, gender FROM guest WHERE userID IS NOT NULL ORDER BY lastName, firstName"),
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
      const balanceDetails = await getBookingBalanceDetails(b.bookingID).catch(() => null);
      const remainingBalance = balanceDetails ? balanceDetails.balance : await getBookingBalance(b.bookingID);
      const paidTotal = balanceDetails?.paidTotal ?? 0;
      const downPaymentPaid = balanceDetails?.downPaymentPaid ?? balanceDetails?.chargesSummary?.downPaymentPaid ?? (b.downPaymentAmount ? parseFloat(b.downPaymentAmount) : 0);
      const isDownPaymentPaid = (downPaymentPaid > 0) || (paidTotal > 0) || (parseFloat(b.downPaymentAmount || 0) > 0 && ['Payment Completed', 'Confirmed', 'Checked In'].includes(b.status));
      const incidentals = await dbQuery(
        "SELECT chargeID, description, amount, DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i') as createdAt FROM incidental_charge WHERE bookingID = ? ORDER BY chargeID ASC",
        [b.bookingID]
      );
      return {
        ...b,
        remainingBalance,
        paidTotal,
        downPaymentPaid,
        isDownPaymentPaid,
        chargesSummary: balanceDetails?.chargesSummary || null,
        paymentsList: balanceDetails?.paymentsList || [],
        grossSubtotal: balanceDetails?.grossSubtotal ?? balanceDetails?.subtotal ?? (parseFloat(b.subtotal || b.roomCharge || 0)),
        subtotal: balanceDetails?.grossSubtotal ?? balanceDetails?.subtotal ?? (parseFloat(b.subtotal || b.roomCharge || 0)),
        discountTotal: balanceDetails?.discountTotal ?? (parseFloat(b.discountTotal || 0)),
        netTotal: balanceDetails?.netTotal ?? (parseFloat(b.netTotal || 0)),
        vatRate: 0.00,
        vatAmount: 0.00,
        grandTotal: balanceDetails?.netTotal ?? (parseFloat(b.netTotal || b.grandTotal || b.totalAmount || 0)),
        totalAmount: balanceDetails?.netTotal ?? (parseFloat(b.netTotal || b.grandTotal || b.totalAmount || 0)),
        requiredDownpayment: balanceDetails?.requiredDownpayment ?? 0,
        incidentals: incidentals || [],
        registeredGuests: guestsDetails.filter(gd => gd.bookingID === b.bookingID)
      };
    }));

    return NextResponse.json({ bookings: bookingsWithGuests, guests, rooms, discounts, paymentMethods, roomSchedules, vatPercentage: 0.00 });
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
        const downPaymentAmount = parseFloat(body.downPaymentAmount || 0) || 0;
        const dpPercentageInt = parseInt(body.downPaymentPercentage || 50) || 50;
        
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
          const { firstName, middleName, lastName, contact, email, gender, dateOfBirth } = body;
          if (!firstName || !firstName.trim() || !lastName || !lastName.trim()) {
            return NextResponse.json({ error: 'First name and Last name are required.' }, { status: 400 });
          }
          if (/\d/.test(firstName) || /\d/.test(lastName) || (middleName && /\d/.test(middleName))) {
            return NextResponse.json({ error: 'First name, middle name, and last name must not contain numbers.' }, { status: 400 });
          }
          let cleanEmail = null;
          if (email && email.trim()) {
            cleanEmail = email.trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
              return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
            }
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
          const cleanMiddle = (middleName || '').trim() || null;

          // Check if guest already exists by email or contact
          let existingGuests = [];
          if (cleanEmail || cleanContact) {
            const [rows] = await conn.execute(
              "SELECT guestID, userID, email FROM guest WHERE (email IS NOT NULL AND LOWER(email) = ? AND ? IS NOT NULL) OR (contact = ? AND contact != '') ORDER BY (userID IS NOT NULL) DESC, guestID DESC LIMIT 1",
              [cleanEmail, cleanEmail, cleanContact]
            );
            existingGuests = rows;
          }

          if (existingGuests && existingGuests.length > 0) {
            guestID = existingGuests[0].guestID;
            guestEmail = cleanEmail || existingGuests[0].email || null;
            if (!existingGuests[0].userID) {
              await conn.execute(
                "UPDATE guest SET firstName = COALESCE(NULLIF(?, ''), firstName), middleName = COALESCE(?, middleName), lastName = COALESCE(NULLIF(?, ''), lastName), contact = COALESCE(NULLIF(?, ''), contact), dateOfBirth = COALESCE(NULLIF(?, ''), dateOfBirth), email = COALESCE(?, email) WHERE guestID = ?",
                [firstName.trim(), cleanMiddle, lastName.trim(), cleanContact, dateOfBirth || null, cleanEmail, guestID]
              );
            }
          } else {
            const [insertGuestRes] = await conn.execute(
              "INSERT INTO guest (firstName, middleName, lastName, contact, email, gender, dateOfBirth, userID) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)",
              [firstName.trim(), cleanMiddle, lastName.trim(), cleanContact, cleanEmail, gender || null, dateOfBirth || null]
            );
            guestID = insertGuestRes.insertId;
            guestEmail = cleanEmail;
          }
        } else {
          guestID = parseInt(body.guestID);
          const [existingGuestRows] = await conn.execute("SELECT email, firstName, lastName FROM guest WHERE guestID = ?", [guestID]);
          guestEmail = (body.email || existingGuestRows[0]?.email || '').trim().toLowerCase() || null;
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
        await ensureBookingBreakfastSchema(conn);

        const inDateStr = (checkInDateTime || '').split(' ')[0] || (checkInDateTime || '').split('T')[0];
        const outDateStr = (checkOutDateTime || '').split(' ')[0] || (checkOutDateTime || '').split('T')[0];
        const inDateD = new Date(inDateStr + 'T00:00:00');
        const outDateD = new Date(outDateStr + 'T00:00:00');
        const diffDays = Math.max(1, Math.round(Math.abs(outDateD - inDateD) / (1000 * 60 * 60 * 24)));

        const stayNights = getStayNights(inDateStr, outDateStr);

        let breakfastOption = body.breakfastOption === 'with' ? 'with' : (body.breakfastOption === 'custom' ? 'custom' : 'without');
        let selectedBreakfastDates = body.breakfastDates || body.selectedBreakfastDates;

        if (!Array.isArray(selectedBreakfastDates)) {
          if (breakfastOption === 'with') {
            selectedBreakfastDates = stayNights.map(n => n.dateStr);
          } else {
            selectedBreakfastDates = [];
          }
        }

        const validBreakfastDates = selectedBreakfastDates.filter(d =>
          stayNights.some(n => n.dateStr === d)
        );

        if (breakfastOption === 'custom') {
          // retain custom option
        } else if (validBreakfastDates.length > 0) {
          breakfastOption = 'with';
        } else if (!breakfastOption) {
          breakfastOption = 'without';
        }

        const hasCustomBreakfast = breakfastOption === 'custom';
        const breakfastID = (breakfastOption === 'with' && !hasCustomBreakfast) ? 2 : 1;

        const [roomData] = await conn.execute(
          "SELECT r.floorID, r.roomTypeID, r.occupancyLimit, r.breakfastRate, rr.rate FROM room r LEFT JOIN room_rate rr ON rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID AND rr.breakfastID = 1 WHERE r.roomID = ?",
          [roomID]
        );
        let baseRoomRate = 0;
        if (roomData.length > 0 && roomData[0].rate != null) {
          baseRoomRate = parseFloat(roomData[0].rate);
        } else {
          const [defData] = await conn.execute(
            "SELECT rr.rate FROM room r JOIN room_rate rr ON rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID WHERE r.roomID = ? ORDER BY rr.rate ASC LIMIT 1",
            [roomID]
          );
          baseRoomRate = defData.length > 0 && defData[0].rate != null ? parseFloat(defData[0].rate) : 0;
        }

        // Determine perGuestBreakfastRate
        let perGuestBreakfastRate = 250;
        if (body.breakfastRate !== undefined && body.breakfastRate !== null && !isNaN(parseFloat(body.breakfastRate))) {
          perGuestBreakfastRate = parseFloat(body.breakfastRate);
        } else if (roomData[0]?.breakfastRate !== null && roomData[0]?.breakfastRate !== undefined) {
          perGuestBreakfastRate = parseFloat(roomData[0].breakfastRate);
        } else {
          const [diffRows] = await conn.execute(
            "SELECT (rr2.rate - rr1.rate) as diff FROM room r JOIN room_rate rr1 ON rr1.roomTypeID = r.roomTypeID AND rr1.floorID = r.floorID AND rr1.breakfastID = 1 JOIN room_rate rr2 ON rr2.roomTypeID = r.roomTypeID AND rr2.floorID = r.floorID AND rr2.breakfastID = 2 WHERE r.roomID = ? LIMIT 1",
            [roomID]
          );
          if (diffRows && diffRows[0]?.diff > 0) {
            perGuestBreakfastRate = parseFloat(diffRows[0].diff);
          }
        }

        const totalGuestsCount = guests.length > 0 ? guests.length : 1;
        const roomBasePax = Math.max(1, parseInt(roomData[0]?.occupancyLimit || 4, 10));
        const extraPax = Math.max(0, totalGuestsCount - roomBasePax);
        const extraGuestFee = Math.round(extraPax * 100 * diffDays * 100) / 100;

        let breakfastTotal = 0;
        if (breakfastOption === 'with') {
          breakfastTotal = Math.round(perGuestBreakfastRate * diffDays * 100) / 100;
        } else if (breakfastOption === 'custom') {
          breakfastTotal = Math.round(perGuestBreakfastRate * validBreakfastDates.length * 100) / 100;
        } else {
          breakfastTotal = 0;
        }

        const rawRoomCharge = baseRoomRate * diffDays;

        const dpPercentageInt = parseInt(body.downPaymentPercentage || 50) || 50;
        const billingCalc = calculateBillingTotals({
          roomRate: baseRoomRate,
          nights: diffDays,
          guestCount: totalGuestsCount,
          guestDiscounts: [], // Initial booking creation starts with 0 discount; discounts are applied in Receptionist Billing
          extraGuestFee,
          breakfastFee: breakfastTotal,
          earlyFee: parseFloat(body.earlyFee) || 0,
          lateFee: parseFloat(body.lateFee) || 0,
          downPaymentPercentage: dpPercentageInt
        });

        const roomDiscountAmount = 0;
        const itemizedDiscounts = [];
        const finalRoomCharge = billingCalc.netRoomStayCharge;
        const grossSubtotal = billingCalc.grossSubtotal;
        const discountTotal = 0;
        const netTotal = billingCalc.netTotal;
        const grandTotal = billingCalc.netTotal;
        const vatRate = 0.00;
        const vatAmount = 0.00;
        const requiredDp = billingCalc.requiredDownpayment;

        if (downPaymentAmount < requiredDp - 0.05) {
          return NextResponse.json({ 
            error: `Payment received (₱${downPaymentAmount.toFixed(2)}) cannot be below the selected ${dpPercentageInt}% requirement of ₱${requiredDp.toFixed(2)} on total charges.` 
          }, { status: 400 });
        }

        const initialBalance = Math.max(0, Math.round((netTotal - downPaymentAmount) * 100) / 100);

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
          if (checkInDateTime && String(checkInDateTime).trim().length >= 16) {
            const cleanTs = String(checkInDateTime).trim().replace('T', ' ');
            finalCheckInDateTime = cleanTs.length === 16 ? `${cleanTs}:00` : cleanTs;
          } else {
            const manila = getManilaNow();
            finalCheckInDateTime = manila.dateTimeStr;
          }
          bookingStatus = 'Checked In';
        }
        let finalCheckOutDateTime = checkOutDateTime;
        if (body.useCurrentTimeOut === true) {
          const manila = getManilaNow();
          finalCheckOutDateTime = manila.dateTimeStr;
        }

        // Insert booking with roomRate, roomCharge, subtotal, discountTotal, netTotal, vatRate, vatAmount, grandTotal, totalAmount, downPaymentAmount, downPaymentPercentage, remainingBalance, breakfastOption, breakfastID, guestCount, breakfastDates, breakfastFee
        const [insertBookingRes] = await conn.execute(
          `INSERT INTO booking(checkInDateTime, checkOutDateTime, status, reservationID, guestID, roomID, roomRate, roomCharge, subtotal, discountTotal, netTotal, vatRate, vatAmount, grandTotal, totalAmount, downPaymentAmount, downPaymentPercentage, remainingBalance, breakfastOption, breakfastID, guestCount, breakfastDates, breakfastFee)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
           [finalCheckInDateTime, finalCheckOutDateTime, bookingStatus, convReservationID, guestID, roomID, 
            baseRoomRate || 0, finalRoomCharge || 0, grossSubtotal || 0, discountTotal || 0, netTotal || 0,
            vatRate || 0, vatAmount || 0, grandTotal || 0, grandTotal || 0, downPaymentAmount,
            dpPercentageInt, initialBalance || 0, breakfastOption, breakfastID || null, totalGuestsCount || 0, 
            JSON.stringify(validBreakfastDates), breakfastTotal || 0]
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
          let checkInHour = null;
          let checkInMinute = null;
          let checkInDate = inDateStr;
          if (finalCheckInDateTime && finalCheckInDateTime.includes(' ')) {
            const [dPart, tPart] = finalCheckInDateTime.split(' ');
            checkInDate = dPart;
            const [h, m] = tPart.split(':');
            checkInHour = parseInt(h, 10);
            checkInMinute = parseInt(m, 10);
          } else {
            const manila = getManilaNow();
            checkInDate = manila.dateStr;
            checkInHour = manila.hour;
            checkInMinute = manila.minute;
          }
          if (inDateStr === checkInDate && checkInHour !== null && checkInHour < 14) {
            const exactRemainingMinutes = (14 * 60) - (checkInHour * 60 + (checkInMinute || 0));
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

        // Insert registered guests details (with discountID NULL until verified in Billing)
        if (guests.length > 0) {
          for (const g of guests) {
            await conn.execute(
              "INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber) VALUES (?, ?, ?, NULL, ?)",
              [bookingID, g.fullName.trim(), parseInt(g.age) || 30, g.discountIdNumber?.trim() || null]
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

        // Ensure no phantom discounts in booking_guest_details or booking_discount for this newly created booking
        await conn.execute("DELETE FROM booking_discount WHERE bookingID = ?", [bookingID]);
        await conn.execute(
          "UPDATE booking_guest_details SET discountID = NULL, promotionID = NULL, discountIdNumber = NULL WHERE bookingID = ? AND (discountID IS NULL OR discountID <= 0)",
          [bookingID]
        );

        // Create Billing Record (Initial booking starts with 0 discount until verified and applied via Receptionist Billing)
        const localNow = new Date();
        const pad = (num) => String(num).padStart(2, '0');
        const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;
        const [billingInsert] = await conn.execute(
          "INSERT INTO billing (billingDateTime, guestID, bookingID, orderID, subtotal, discountTotal, netTotal, vatRate, vatAmount, grandTotal, totalAmount, downPaymentAmount, downPaymentPercentage, remainingBalance, balance) VALUES (?, ?, ?, NULL, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [nowStr, guestID, bookingID, grossSubtotal, grossSubtotal, vatRate, vatAmount, grossSubtotal, grossSubtotal, downPaymentAmount, dpPercentageInt, initialBalance, initialBalance]
        );
        const billingID = billingInsert.insertId;

        // Get staffID using session userID
        const [staffRes] = await conn.execute("SELECT staffID FROM staff WHERE userID = ?", [session.userID]);
        const staffID = staffRes[0]?.staffID || null;
        
        // Record Down Payment with 'Settled' status and referenceNumber
        const refNumber = body.referenceNumber || (paymentMethodID === 2 ? `GCASH-BK-${bookingID}` : `CASH-${Date.now().toString().slice(-6)}`);

        
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
          balanceBefore: finalRoomCharge || 0,
          balanceAfter: initialBalance || 0,
          userID: session?.userID || null,
          userName: session?.fullName || 'Receptionist',
          userRole: session?.role || 'Receptionist',
          description: `Down payment recorded upon booking creation - ${dpPercentageInt}% on Room Charges`,
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

          if (guestEmail) {
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
          }
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

      if (['Pending Check-in', 'Pending', 'Confirmed', 'Booked'].includes(oldBooking.status) && inD.getTime() < new Date().getTime() - 60000) {
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
        let updateBookingSql = "UPDATE booking SET checkInDateTime = ?, checkOutDateTime = ?, roomID = ?, guestID = ?";
        let updateBookingParams = [checkInDateTime, checkOutDateTime, newRoomID, newGuestID];
        if (body.breakfastOption !== undefined) {
          updateBookingSql += ", breakfastOption = ?";
          updateBookingParams.push(body.breakfastOption);
        }
        if (body.breakfastDates !== undefined) {
          updateBookingSql += ", breakfastDates = ?";
          updateBookingParams.push(
            typeof body.breakfastDates === 'string'
              ? body.breakfastDates
              : (body.breakfastDates ? JSON.stringify(body.breakfastDates) : null)
          );
        }
        updateBookingSql += " WHERE bookingID = ?";
        updateBookingParams.push(bookingID);
        await conn.execute(updateBookingSql, updateBookingParams);

        // Update guest information if provided
        if (body.guestForm && newGuestID) {
          const { firstName, middleName, lastName, contact, email, gender, dateOfBirth } = body.guestForm;
          const dobVal = dateOfBirth ? (dateOfBirth.includes('/') ? dateOfBirth.split('/').reverse().join('-') : dateOfBirth) : null;
          await conn.execute(
            "UPDATE guest SET firstName = COALESCE(?, firstName), middleName = COALESCE(?, middleName), lastName = COALESCE(?, lastName), contact = COALESCE(?, contact), email = COALESCE(?, email), gender = COALESCE(?, gender), dateOfBirth = COALESCE(?, dateOfBirth) WHERE guestID = ?",
            [firstName || null, (middleName || '').trim() || null, lastName || null, contact || null, email || null, gender || null, dobVal || null, newGuestID]
          );
        }

        // Record Down Payment if provided and not yet paid
        let downPaymentRecorded = false;
        let recordedPaymentAmount = 0;
        if (body.recordDownPayment && parseFloat(body.downPaymentAmount) > 0) {
          const [existingPayments] = await conn.execute(
            "SELECT p.paymentID FROM payment p JOIN billing b ON b.billingID = p.billingID WHERE b.bookingID = ?",
            [bookingID]
          );

          if (!existingPayments || existingPayments.length === 0) {
            let [billRows] = await conn.execute("SELECT billingID FROM billing WHERE bookingID = ? LIMIT 1", [bookingID]);
            let billingID = billRows[0]?.billingID;
            const localNow = new Date();
            const pad = (num) => String(num).padStart(2, '0');
            const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

            if (!billingID) {
              const [bIns] = await conn.execute(
                "INSERT INTO billing (billingDateTime, guestID, bookingID, orderID) VALUES (?, ?, ?, NULL)",
                [nowStr, newGuestID, bookingID]
              );
              billingID = bIns.insertId;
            }

            const dpAmount = parseFloat(body.downPaymentAmount);
            const dpPercentage = parseInt(body.downPaymentPercentage) || 50;
            const payMethodID = parseInt(body.paymentMethodID) || 1;
            const refNum = body.referenceNumber || (payMethodID === 2 ? `GCASH-BK-${bookingID}` : `CASH-${Date.now().toString().slice(-6)}`);
            const [staffRes] = await conn.execute("SELECT staffID FROM staff WHERE userID = ?", [session.userID]);
            const staffID = staffRes[0]?.staffID || null;

            const [paymentInsert] = await conn.execute(
              `INSERT INTO payment (amount, cashReceived, \`change\`, changeAmount, billingID, guestID, staffID, paymentMethodID, discountID, promotionID, testMode, status, referenceNumber) 
               VALUES (?, ?, 0, 0.00, ?, ?, ?, ?, NULL, NULL, 1, 'Settled', ?)`,
              [dpAmount, dpAmount, billingID, newGuestID, staffID, payMethodID, refNum]
            );
            const paymentID = paymentInsert.insertId;

            await conn.execute(
              "INSERT INTO transactions (transactionDateTime, billingID, paymentID, testMode) VALUES (?, ?, ?, 1)",
              [nowStr, billingID, paymentID]
            );

            await conn.execute(
              "UPDATE booking SET downPaymentAmount = ?, downPaymentPercentage = ? WHERE bookingID = ?",
              [dpAmount, dpPercentage, bookingID]
            );

            await logBillingAudit(conn, {
              billingID,
              bookingID,
              transactionType: 'Down Payment',
              status: 'Settled',
              amount: dpAmount,
              balanceBefore: 0,
              balanceAfter: 0,
              userID: session?.userID || null,
              userName: session?.fullName || 'Receptionist',
              userRole: session?.role || 'Receptionist',
              description: `Down payment recorded during booking update - ${dpPercentage}% on Room Charges`,
              referenceNumber: refNum
            });

            downPaymentRecorded = true;
            recordedPaymentAmount = dpAmount;
          }
        }

        // Update registered guests if provided
        if (Array.isArray(body.guests) && body.guests.length > 0) {
          await conn.execute("DELETE FROM booking_guest_details WHERE bookingID = ?", [bookingID]);

          for (const g of body.guests) {
            if (g.fullName && g.fullName.trim()) {
              const gName = g.fullName.trim();
              const discIdNum = g.discountIdNumber?.trim() || null;
              await conn.execute(
                "INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber) VALUES (?, ?, ?, NULL, ?)",
                [bookingID, gName, parseInt(g.age) || 30, discIdNum]
              );
            }
          }
          await conn.execute(
            "UPDATE booking_guest_details SET discountID = NULL, promotionID = NULL, discountIdNumber = NULL WHERE bookingID = ? AND (discountID IS NULL OR discountID <= 0)",
            [bookingID]
          );
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

        const [bRows] = await conn.execute("SELECT billingID FROM billing WHERE bookingID = ? ORDER BY billingID DESC LIMIT 1", [bookingID]);
        const finalBillingID = bRows[0]?.billingID || null;
        await conn.commit();
        if (finalBillingID) {
          await syncNormalizedBillingLineItems(null, finalBillingID, bookingID);
        } else {
          await getBookingBalanceDetails(bookingID);
        }
        return NextResponse.json({
          success: true,
          downPaymentRecorded,
          recordedPaymentAmount,
          message: downPaymentRecorded
            ? `Booking updated and down payment of ₱${recordedPaymentAmount.toFixed(2)} recorded successfully.`
            : (extraGuestFee > 0
                ? `Booking updated successfully. ₱${extraGuestFee.toFixed(2)} Extra Guest Fee added to incidental charges.`
                : 'Booking updated successfully.')
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
          const cleanDiscID = (g.discountID && g.discountID !== 'none' && g.discountID !== 'N/A' && g.discountID !== 'null' && String(g.discountID).trim() !== '' && g.discountID !== 0 && g.discountID !== '0') ? g.discountID : null;
          const cleanDiscNum = cleanDiscID ? (g.discountIdNumber?.trim() || null) : null;
          await conn.execute(
            "INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber) VALUES (?, ?, ?, ?, ?)",
            [bookingID, g.fullName.trim(), parseInt(g.age) || 30, cleanDiscID, cleanDiscNum]
          );
        }

        await conn.execute(
          "UPDATE booking_guest_details SET discountID = NULL, promotionID = NULL, discountIdNumber = NULL WHERE bookingID = ? AND (discountID IS NULL OR discountID <= 0)",
          [bookingID]
        );

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
      const confirmEarlyCheckIn = !!body.confirmEarlyCheckIn || !!body.confirmAdvanceCheckIn;
      
      const res = await dbQuery("SELECT roomID, DATE_FORMAT(checkInDateTime, '%Y-%m-%d') as scheduledCheckInDate, checkInDateTime FROM booking WHERE bookingID = ?", [bookingID]);
      if (res.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }
      const { roomID, scheduledCheckInDate } = res[0];

      // Retrieve room base rate and room number
      const [rateData] = await dbQuery(`
        SELECT COALESCE(
          (SELECT rr.rate FROM room_rate rr WHERE rr.roomTypeID = rm.roomTypeID AND rr.floorID = rm.floorID AND rr.breakfastID = 1 LIMIT 1),
          1200.00
        ) as roomBaseRate, rm.roomNumber
        FROM room rm
        WHERE rm.roomID = ? LIMIT 1
      `, [roomID]);
      const roomBaseRate = parseFloat(rateData?.roomBaseRate || 1200.00);
      const roomNumber = rateData?.roomNumber || 'N/A';

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

      let advanceNights = 0;
      let additionalRoomCharge = 0;
      let earlyHours = 0;
      let earlyFee = 0;

      // 1. Advance Check-In: guest checks in 1 or more days ahead of scheduled check-in date
      if (manilaDateStr < scheduledCheckInDate) {
        const scheduledDateObj = new Date(scheduledCheckInDate + 'T00:00:00');
        const currentDateObj = new Date(manilaDateStr + 'T00:00:00');
        advanceNights = Math.max(1, Math.ceil((scheduledDateObj - currentDateObj) / (1000 * 60 * 60 * 24)));
        additionalRoomCharge = advanceNights * roomBaseRate;

        // Check if arrival hour is before standard 2:00 PM check-in time
        if (manilaHour < 14) {
          const exactRemainingMinutes = (14 * 60) - (manilaHour * 60 + manilaMinute);
          earlyHours = Math.max(1, Math.ceil(exactRemainingMinutes / 60));
          earlyFee = earlyHours * 50;
        }

        if (!confirmEarlyCheckIn) {
          return NextResponse.json({
            requiresAdvanceCheckInConfirmation: true,
            advanceNights,
            roomBaseRate,
            additionalRoomCharge,
            earlyHours,
            earlyFee,
            roomNumber,
            title: 'Advance & Early Check-In Notice',
            message: `This guest is checking in ${advanceNights} day(s) ahead of schedule. Room ${roomNumber} is available. Checking in today will add ${advanceNights} additional night charge(s) (₱${additionalRoomCharge.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) and early check-in fees to the bill.`
          });
        }
      } else if (manilaDateStr === scheduledCheckInDate && manilaHour < 14) {
        // Standard same-day early check-in before 2:00 PM
        const exactRemainingMinutes = (14 * 60) - (manilaHour * 60 + manilaMinute);
        earlyHours = Math.max(1, Math.ceil(exactRemainingMinutes / 60));
        earlyFee = earlyHours * 50;

        if (!confirmEarlyCheckIn) {
          return NextResponse.json({
            requiresEarlyCheckInConfirmation: true,
            earlyHours,
            earlyFee,
            roomNumber,
            message: `This guest is checking in early (scheduled for ${scheduledCheckInDate} at 2:00 PM). Standard check-in is 2:00 PM. An early check-in fee of ₱${earlyFee.toFixed(2)} (${earlyHours} hour(s) @ ₱50/hr) will be automatically added to the bill.`
          });
        }
      }

      const nowStr = `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;

      // If advance check-in confirmed, record additional night charges in incidental charges / ledger
      if (confirmEarlyCheckIn && advanceNights > 0 && additionalRoomCharge > 0) {
        const advanceDesc = `Advance Check-In Additional Night Charge (${advanceNights} night(s) @ ₱${roomBaseRate.toFixed(2)})`;
        await dbQuery(
          "INSERT INTO incidental_charge (bookingID, description, amount) VALUES (?, ?, ?)",
          [bookingID, advanceDesc, additionalRoomCharge]
        );
      }

      // If early check-in fee applies, record fee in incidental charges
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

      const successParts = [];
      if (advanceNights > 0) successParts.push(`${advanceNights} advance night(s) added (₱${additionalRoomCharge.toFixed(2)})`);
      if (earlyFee > 0) successParts.push(`₱${earlyFee.toFixed(2)} early check-in fee added`);

      return NextResponse.json({
        success: true,
        message: successParts.length > 0 
          ? `Guest checked in successfully. ${successParts.join(' and ')} to bill.` 
          : 'Guest checked in successfully.',
        advanceNights,
        additionalRoomCharge,
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

