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
      SELECT b.bookingID, DATE_FORMAT(b.checkInDateTime, '%Y-%m-%dT%H:%i:%s') as checkInDateTime, 
             DATE_FORMAT(b.checkInDateTime, '%Y-%m-%d %H:%i:%s') as dbCheckInDateTime,
             DATE_FORMAT(b.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime, b.status, b.guestID, b.roomID,
             g.firstName, g.lastName, g.contact, g.email,
             rm.roomNumber, rm.floorID, rm.occupancyLimit, rt.type as roomType, rt.roomTypeID
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

    if (booking.status === 'Pending Check-in' || booking.status === 'Pending' || booking.status === 'Cancelled' || booking.status === 'Canceled') {
      return NextResponse.json({ error: 'Billing is only available for guests who have checked in or checked out.' }, { status: 400 });
    }

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
    
    const maxOccupancy = parseInt(booking.occupancyLimit) || 2;
    const extraGuestsCount = Math.max(0, (booking.guestCount || 1) - maxOccupancy);
    const extraGuestFee = extraGuestsCount * 200 * nights;
    const roomCharge = (rate * nights) + extraGuestFee;

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

    // Late check-out fee (₱100 per hour extended after 12:00 PM of the check-out day)
    let lateCheckOutFee = 0;
    const standardCheckOutTime = new Date(checkOut);
    standardCheckOutTime.setHours(12, 0, 0, 0);

    // If guest is currently Checked In, evaluate against current time.
    // If guest is Checked Out, evaluate against the actual checkout time recorded.
    const endCheckoutTime = booking.status === 'Checked In' ? new Date() : new Date(booking.checkOutDateTime);

    if (endCheckoutTime > standardCheckOutTime) {
      const lateHours = Math.ceil((endCheckoutTime - standardCheckOutTime) / (1000 * 60 * 60));
      if (lateHours > 0) {
        lateCheckOutFee = lateHours * 100;
      }
    }

    const cleanCheckInDate = (booking.dbCheckInDateTime || booking.checkInDateTime || '').replace('T', ' ');

    const [
      productCharges,
      amenityCharges,
      incidentalCharges,
      borrowItems,
      nonConsumableList,
      billingRes,
      activeDiscounts,
      activePromos
    ] = await Promise.all([
      dbQuery(`
        SELECT op.orderProductID, op.quantity, p.name, p.price, (op.quantity * p.price) as subtotal
        FROM order_product op
        JOIN products p ON p.productID = op.productID
        JOIN orders o ON o.orderID = op.orderID
        WHERE o.guestID = ? 
          AND o.orderDateTime >= DATE_SUB(?, INTERVAL 12 HOUR) 
          AND o.orderStatus != 'Canceled'
          AND o.orderID NOT IN (SELECT orderID FROM billing WHERE orderID IS NOT NULL)
      `, [booking.guestID, cleanCheckInDate]),
      dbQuery(`
        SELECT oa.orderAmenityID, oa.quantity, a.name, a.price, (oa.quantity * a.price) as subtotal
        FROM order_amenities oa
        JOIN amenities a ON a.amenityID = oa.amenityID
        JOIN orders o ON o.orderID = oa.orderID
        WHERE o.guestID = ? 
          AND o.orderDateTime >= DATE_SUB(?, INTERVAL 12 HOUR) 
          AND o.orderStatus != 'Canceled'
          AND o.orderID NOT IN (SELECT orderID FROM billing WHERE orderID IS NOT NULL)
      `, [booking.guestID, cleanCheckInDate]),
      dbQuery(
        "SELECT chargeID, description, amount, createdAt FROM incidental_charge WHERE bookingID = ?",
        [bookingID]
      ),
      dbQuery(`
        SELECT bt.*, COALESCE(a.name, p.name) as itemName
        FROM borrow_transaction bt
        LEFT JOIN amenities a ON bt.itemType = 'Amenity' AND a.amenityID = bt.itemID
        LEFT JOIN products p ON bt.itemType = 'Product' AND p.productID = bt.itemID
        WHERE bt.bookingID = ?
      `, [bookingID]),
      dbQuery(`
        SELECT a.amenityID, a.name, COALESCE(a.sellingPrice, a.price, 0) as replacementCost, a.description,
               SUM(oa.quantity) as orderedQty
        FROM order_amenities oa
        JOIN amenities a ON a.amenityID = oa.amenityID
        JOIN orders o ON o.orderID = oa.orderID
        WHERE o.guestID = ? 
          AND o.orderDateTime >= DATE_SUB(?, INTERVAL 12 HOUR)
          AND o.orderStatus != 'Canceled'
          AND a.itemType = 'Non-Consumable'
          AND (a.isArchived IS NULL OR a.isArchived = 0)
        GROUP BY a.amenityID, a.name, a.sellingPrice, a.price, a.description
        ORDER BY a.name ASC
      `, [booking.guestID, cleanCheckInDate]),
      dbQuery("SELECT billingID FROM billing WHERE bookingID = ?", [bookingID]),
      dbQuery("SELECT discountID, name, percentage FROM discounts WHERE isArchived = 0 ORDER BY name"),
      dbQuery("SELECT promotionID, name, percentage FROM promotions WHERE isArchived = 0 AND (startDate <= CURDATE() AND endDate >= CURDATE()) ORDER BY name")
    ]);

    const productTotal = productCharges.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
    const amenityTotal = amenityCharges.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
    const incidentalTotal = incidentalCharges.reduce((sum, item) => sum + parseFloat(item.amount), 0);

    const nonConsumableAmenities = nonConsumableList.map(a => {
      const matchIncidental = incidentalCharges.find(ic => 
        ic.description && ic.description.toLowerCase().includes(`missing/damaged non-consumable amenity: ${a.name.toLowerCase()}`)
      );
      const isReturned = !matchIncidental;
      const unitCost = parseFloat(a.replacementCost || 0);
      let lostQty = 1;
      if (matchIncidental) {
        const matchNum = matchIncidental.description.match(/(\d+)x/);
        if (matchNum) lostQty = parseInt(matchNum[1]);
      }
      return {
        amenityID: a.amenityID,
        name: a.name,
        quantity: parseInt(a.orderedQty) || 1,
        orderedQty: parseInt(a.orderedQty) || 1,
        lostQty: matchIncidental ? lostQty : 1,
        unitCost: unitCost,
        replacementCost: matchIncidental ? parseFloat(matchIncidental.amount) : (unitCost * lostQty),
        description: a.description,
        isReturned: isReturned,
        chargeAmount: matchIncidental ? parseFloat(matchIncidental.amount) : 0,
        chargeID: matchIncidental ? matchIncidental.chargeID : null
      };
    });

    const subtotalCharges = finalRoomCharge + earlyCheckInFee + lateCheckOutFee + productTotal + amenityTotal + incidentalTotal;

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
      nonConsumableAmenities,
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

    if (action === 'add_guest') {
      const bookingID = parseInt(body.bookingID);
      const fullName = body.fullName?.trim();
      const age = parseInt(body.age || 30);
      const discountID = body.discountID ? parseInt(body.discountID) : null;
      const discountIdNumber = body.discountIdNumber?.trim() || null;

      if (!bookingID || !fullName) {
        return NextResponse.json({ error: 'Booking ID and Guest Name are required.' }, { status: 400 });
      }

      await dbQuery(
        "INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber) VALUES (?, ?, ?, ?, ?)",
        [bookingID, fullName, age, discountID, discountIdNumber]
      );
      return NextResponse.json({ success: true, message: 'Guest added to billing record successfully.' });
    }

    if (action === 'remove_guest') {
      const bookingGuestID = parseInt(body.bookingGuestID);
      if (!bookingGuestID) {
        return NextResponse.json({ error: 'Missing bookingGuestID.' }, { status: 400 });
      }

      await dbQuery("DELETE FROM booking_guest_details WHERE bookingGuestID = ?", [bookingGuestID]);
      return NextResponse.json({ success: true, message: 'Guest removed from billing record.' });
    }

    if (action === 'update_borrow_status') {
      const { borrowID, status, remarks } = body; // status: 'Returned' | 'Damaged' | 'Lost'
      const bID = parseInt(borrowID);

      const [borrow] = await dbQuery(`
        SELECT bt.*, COALESCE(a.price, p.price, 0) as price, COALESCE(a.name, p.name) as itemName
        FROM borrow_transaction bt
        LEFT JOIN amenities a ON bt.itemType = 'Amenity' AND a.amenityID = bt.itemID
        LEFT JOIN products p ON bt.itemType = 'Product' AND p.productID = bt.itemID
        WHERE bt.borrowID = ?
      `, [bID]);

      if (!borrow) {
        return NextResponse.json({ error: 'Borrow item not found.' }, { status: 404 });
      }

      await dbQuery(
        "UPDATE borrow_transaction SET status = ?, conditionUponReturn = ?, actualReturnDate = NOW(), remarks = ? WHERE borrowID = ?",
        [status, status === 'Returned' ? 'Good' : status, remarks || null, bID]
      );

      // Rule 12: If Missing or Damaged, automatically add replacement fee to incidental charges
      if (status === 'Damaged' || status === 'Lost') {
        const replacementCost = parseFloat(borrow.price || 0) * parseInt(borrow.quantity || 1);
        const desc = `Replacement Fee: Missing/Damaged ${borrow.itemName} (${borrow.quantity} pcs)`;
        
        await dbQuery(
          "INSERT INTO incidental_charge (bookingID, description, amount) VALUES (?, ?, ?)",
          [borrow.bookingID, desc, replacementCost]
        );
        return NextResponse.json({ success: true, message: 'Borrow item status updated and replacement fee billed.' });
      }

      return NextResponse.json({ success: true, message: 'Borrow item status updated.' });
    }

    if (action === 'toggle_amenity_inspection') {
      const bookingID = parseInt(body.bookingID);
      const amenityID = parseInt(body.amenityID);
      const isReturned = body.isReturned; // boolean
      const lostQuantity = Math.max(1, parseInt(body.lostQuantity || 1));

      const [amenity] = await dbQuery(
        "SELECT name, COALESCE(sellingPrice, price, 0) as replacementCost FROM amenities WHERE amenityID = ?",
        [amenityID]
      );

      if (!amenity) {
        return NextResponse.json({ error: 'Amenity not found.' }, { status: 404 });
      }

      const descPattern = `%Missing/Damaged Non-Consumable Amenity: ${amenity.name}%`;
      const descText = `${lostQuantity}x Missing/Damaged Non-Consumable Amenity: ${amenity.name}`;

      if (isReturned) {
        // Returned -> remove incidental charge if any
        await dbQuery(
          "DELETE FROM incidental_charge WHERE bookingID = ? AND description LIKE ?",
          [bookingID, descPattern]
        );
        return NextResponse.json({ success: true, message: `${amenity.name} marked as returned & in good condition.` });
      } else {
        // Unchecked -> Missing/Damaged -> add/update replacement cost as incidental charge
        const unitCost = parseFloat(amenity.replacementCost || 0);
        const cost = unitCost * lostQuantity;
        // Check if charge already exists
        const existing = await dbQuery(
          "SELECT chargeID FROM incidental_charge WHERE bookingID = ? AND description LIKE ?",
          [bookingID, descPattern]
        );
        if (existing.length > 0) {
          await dbQuery(
            "UPDATE incidental_charge SET description = ?, amount = ? WHERE chargeID = ?",
            [descText, cost, existing[0].chargeID]
          );
        } else {
          await dbQuery(
            "INSERT INTO incidental_charge (bookingID, description, amount) VALUES (?, ?, ?)",
            [bookingID, descText, cost]
          );
        }
        return NextResponse.json({ success: true, message: `${lostQuantity}x ${amenity.name} marked as missing/damaged. Replacement fee (₱${cost.toFixed(2)}) billed.` });
      }
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
