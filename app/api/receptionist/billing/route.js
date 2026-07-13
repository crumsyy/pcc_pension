import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bookingID = parseInt(searchParams.get('bookingID'));

  if (!bookingID) {
    return NextResponse.json({ error: 'Missing booking ID.' }, { status: 400 });
  }

  // If Guest, ensure they own this booking
  if (session.role === 'Guest') {
    const ownerCheck = await dbQuery("SELECT guestID FROM booking WHERE bookingID = ?", [bookingID]);
    const guestRes = await dbQuery("SELECT guestID FROM guest WHERE userID = ?", [session.userID]);
    if (ownerCheck.length === 0 || guestRes.length === 0 || ownerCheck[0].guestID !== guestRes[0].guestID) {
      return NextResponse.json({ error: 'Unauthorized. Access denied.' }, { status: 403 });
    }
  } else if (session.role !== 'Receptionist' && session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch booking details
    const bookingRes = await dbQuery(`
      SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status, b.guestID, b.roomID,
             g.firstName, g.lastName, g.contact, g.email,
             rm.roomNumber, rm.floorID, rt.type as roomType, rt.roomTypeID
      FROM booking b
      JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE b.bookingID = ?
    `, [bookingID]);

    if (bookingRes.length === 0) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    const booking = bookingRes[0];

    // 2. Fetch room rate
    const rateRes = await dbQuery(
      "SELECT rate FROM room_rate WHERE roomTypeID = ? AND floorID = ? AND breakfastID = 1",
      [booking.roomTypeID, booking.floorID]
    );
    const rate = rateRes[0]?.rate || 0;

    // Calculate nights (min 1)
    const checkIn = new Date(booking.checkInDateTime);
    const checkOut = new Date(booking.checkOutDateTime);
    const diffTime = Math.abs(checkOut - checkIn);
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const roomCharge = rate * nights;

    // Fetch registered guest list for this booking
    const guestsList = await dbQuery(`
      SELECT bg.*, 
             COALESCE(d.name, p.name) as discountName, 
             COALESCE(d.percentage, p.percentage) as discountPercentage
      FROM booking_guest_details bg
      LEFT JOIN discounts d ON d.discountID = bg.discountID
      LEFT JOIN promotions p ON p.promotionID = bg.promotionID
      WHERE bg.bookingID = ?
    `, [bookingID]);

    let finalGuestsList = [...guestsList];
    if (finalGuestsList.length === 0) {
      finalGuestsList = [{
        bookingGuestID: 0,
        bookingID: bookingID,
        fullName: `${booking.firstName} ${booking.lastName}`,
        age: 30,
        discountID: null,
        promotionID: null,
        discountIdNumber: null,
        discountName: null,
        discountPercentage: 0
      }];
    }

    // Apportionment math: divide room charge equally and apply discount to senior/PWD shares
    const totalGuestsCount = finalGuestsList.length;
    const sharePerGuest = roomCharge / totalGuestsCount;
    
    finalGuestsList = finalGuestsList.map(g => {
      const discountPercentage = g.discountPercentage ? parseInt(g.discountPercentage) : 0;
      const discountAmount = sharePerGuest * (discountPercentage / 100);
      return {
        ...g,
        discountID: g.discountID ? `disc-${g.discountID}` : (g.promotionID ? `promo-${g.promotionID}` : ''),
        share: sharePerGuest,
        discount: discountAmount,
        netShare: sharePerGuest - discountAmount
      };
    });

    const totalDiscount = finalGuestsList.reduce((sum, g) => sum + g.discount, 0);
    const finalRoomCharge = roomCharge - totalDiscount;

    // Early check-in fee (₱50 per hour early before 2:00 PM)
    let earlyCheckInFee = 0;
    const standardCheckInTime = new Date(checkIn);
    standardCheckInTime.setHours(14, 0, 0, 0);
    if (checkIn < standardCheckInTime && checkIn.toDateString() === standardCheckInTime.toDateString()) {
      const earlyHours = Math.ceil((standardCheckInTime - checkIn) / (1000 * 60 * 60));
      if (earlyHours > 0) {
        earlyCheckInFee = earlyHours * 50;
      }
    }

    // Late check-out fee (₱150 per hour extended after 12:00 PM of the check-out day)
    let lateCheckOutFee = 0;
    const standardCheckOutTime = new Date(checkOut);
    standardCheckOutTime.setHours(12, 0, 0, 0);

    // If guest is currently Checked In, evaluate against current time.
    // If guest is Checked Out, evaluate against the actual checkout time recorded.
    const endCheckoutTime = booking.status === 'Checked In' ? new Date() : new Date(booking.checkOutDateTime);

    if (endCheckoutTime > standardCheckOutTime) {
      const lateHours = Math.ceil((endCheckoutTime - standardCheckOutTime) / (1000 * 60 * 60));
      if (lateHours > 0) {
        lateCheckOutFee = lateHours * 150;
      }
    }

    // 3. Fetch product orders for this stay (since check-in date)
    const productCharges = await dbQuery(`
      SELECT op.orderProductID, op.quantity, p.name, p.price, (op.quantity * p.price) as subtotal
      FROM order_product op
      JOIN products p ON p.productID = op.productID
      JOIN orders o ON o.orderID = op.orderID
      WHERE o.guestID = ? 
        AND o.orderDateTime >= DATE_SUB(?, INTERVAL 12 HOUR) 
        AND o.orderStatus != 'Canceled'
        AND o.orderID NOT IN (SELECT orderID FROM billing WHERE orderID IS NOT NULL)
    `, [booking.guestID, booking.checkInDateTime]);

    // 4. Fetch amenity orders for this stay
    const amenityCharges = await dbQuery(`
      SELECT oa.orderAmenityID, oa.quantity, a.name, a.price, (oa.quantity * a.price) as subtotal
      FROM order_amenities oa
      JOIN amenities a ON a.amenityID = oa.amenityID
      JOIN orders o ON o.orderID = oa.orderID
      WHERE o.guestID = ? 
        AND o.orderDateTime >= DATE_SUB(?, INTERVAL 12 HOUR) 
        AND o.orderStatus != 'Canceled'
        AND o.orderID NOT IN (SELECT orderID FROM billing WHERE orderID IS NOT NULL)
    `, [booking.guestID, booking.checkInDateTime]);

    const productTotal = productCharges.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
    const amenityTotal = amenityCharges.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

    // Fetch incidental charges
    const incidentalCharges = await dbQuery(
      "SELECT chargeID, description, amount, createdAt FROM incidental_charge WHERE bookingID = ?",
      [bookingID]
    );
    const incidentalTotal = incidentalCharges.reduce((sum, item) => sum + parseFloat(item.amount), 0);

    // Fetch borrow transaction items
    const borrowItems = await dbQuery(`
      SELECT bt.*, COALESCE(a.name, p.name) as itemName
      FROM borrow_transaction bt
      LEFT JOIN amenities a ON bt.itemType = 'Amenity' AND a.amenityID = bt.itemID
      LEFT JOIN products p ON bt.itemType = 'Product' AND p.productID = bt.itemID
      WHERE bt.bookingID = ?
    `, [bookingID]);

    const subtotalCharges = finalRoomCharge + earlyCheckInFee + lateCheckOutFee + productTotal + amenityTotal + incidentalTotal;

    // 5. Fetch existing billing record if any
    const billingRes = await dbQuery(
      "SELECT billingID FROM billing WHERE bookingID = ?",
      [bookingID]
    );

    let billingID = billingRes[0]?.billingID || null;
    let paidTotal = 0;

    if (billingID) {
      const payments = await dbQuery(
        "SELECT amount FROM payment WHERE billingID = ?",
        [billingID]
      );
      paidTotal = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    }

    const balance = subtotalCharges - paidTotal;

    const activeDiscounts = await dbQuery("SELECT discountID, name, percentage FROM discounts WHERE isArchived = 0 ORDER BY name");
    const activePromos = await dbQuery("SELECT promotionID, name, percentage FROM promotions WHERE isArchived = 0 AND (startDate <= CURDATE() AND endDate >= CURDATE()) ORDER BY name");

    const discounts = [
      ...activeDiscounts.map(d => ({
        discountID: `disc-${d.discountID}`,
        name: `[Discount] ${d.name}`,
        percentage: d.percentage
      })),
      ...activePromos.map(p => ({
        discountID: `promo-${p.promotionID}`,
        name: `[Promo] ${p.name}`,
        percentage: p.percentage
      }))
    ];

    return NextResponse.json({
      success: true,
      booking: {
        ...booking,
        nights,
        rate,
        originalRoomCharge: roomCharge,
        roomCharge: finalRoomCharge
      },
      productCharges,
      amenityCharges,
      incidentalCharges,
      borrowItems,
      chargesSummary: {
        room: finalRoomCharge,
        originalRoomCharge: roomCharge,
        totalDiscount: totalDiscount,
        sharePerGuest: sharePerGuest,
        totalGuests: totalGuestsCount,
        earlyCheckIn: earlyCheckInFee,
        lateCheckOut: lateCheckOutFee,
        products: productTotal,
        amenities: amenityTotal,
        incidentals: incidentalTotal,
        total: subtotalCharges,
        paid: paidTotal,
        balance: balance
      },
      guestsList: finalGuestsList,
      billingID,
      discounts
    });

  } catch (error) {
    console.error("Failed to calculate billing:", error);
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

    if (action === 'add_incidental') {
      const bookingID = parseInt(body.bookingID);
      const description = body.description?.trim();
      const amount = parseFloat(body.amount || 0);

      if (!bookingID || !description || isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Missing or invalid fields for incidental charge.' }, { status: 400 });
      }

      await dbQuery(
        "INSERT INTO incidental_charge (bookingID, description, amount) VALUES (?, ?, ?)",
        [bookingID, description, amount]
      );
      return NextResponse.json({ success: true, message: 'Incidental charge added successfully.' });
    }

    if (action === 'delete_incidental') {
      const chargeID = parseInt(body.chargeID);
      if (!chargeID) {
        return NextResponse.json({ error: 'Missing charge ID.' }, { status: 400 });
      }

      await dbQuery("DELETE FROM incidental_charge WHERE chargeID = ?", [chargeID]);
      return NextResponse.json({ success: true, message: 'Incidental charge deleted successfully.' });
    }

    // Default: Update Guest Discounts
    const bookingID = parseInt(body.bookingID);
    const guests = body.guests;
    if (!bookingID || !Array.isArray(guests)) {
      return NextResponse.json({ error: 'Missing booking ID or guests list.' }, { status: 400 });
    }

    const pool = await getDbConnection();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      for (const g of guests) {
        let dbDiscountID = null;
        let dbPromotionID = null;
        const rawDiscountID = g.discountID ? String(g.discountID) : '';

        if (rawDiscountID.startsWith('disc-')) {
          dbDiscountID = parseInt(rawDiscountID.replace('disc-', ''));
        } else if (rawDiscountID.startsWith('promo-')) {
          dbPromotionID = parseInt(rawDiscountID.replace('promo-', ''));
        }

        const discountIdNumber = g.discountIdNumber ? g.discountIdNumber.trim() : null;

        if (dbDiscountID) {
          if (!discountIdNumber) {
            return NextResponse.json({ error: `ID card number is required for guest: ${g.fullName || 'selected guest'}.` }, { status: 400 });
          }
        } else if (dbPromotionID) {
          if (!discountIdNumber) {
            return NextResponse.json({ error: `ID card number or code is required for guest: ${g.fullName || 'selected guest'} to apply this promotion.` }, { status: 400 });
          }
        }

        await conn.execute(
          `UPDATE booking_guest_details 
           SET discountID = ?, promotionID = ?, discountIdNumber = ? 
           WHERE bookingGuestID = ? AND bookingID = ?`,
          [dbDiscountID, dbPromotionID, discountIdNumber, g.bookingGuestID, bookingID]
        );
      }

      await conn.commit();
      return NextResponse.json({ success: true, message: 'Discounts updated successfully.' });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Failed to process billing POST request:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
