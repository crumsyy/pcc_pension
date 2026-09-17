import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, getBookingBalanceDetails, getBookingBalance, syncInventoryStock, logBillingAudit } from '@/lib/db';

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
    const details = await getBookingBalanceDetails(bookingID);
    if (!details || !details.booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    const booking = details.booking;
    if (booking.status === 'Pending Check-in' || booking.status === 'Pending' || booking.status === 'Cancelled' || booking.status === 'Canceled') {
      return NextResponse.json({ error: 'Billing is only available for guests who have checked in or checked out.' }, { status: 400 });
    }

    const cleanCheckInDate = (booking.checkInDateTime || '').replace('T', ' ');

    const [borrowItems, nonConsumableList, activeDiscounts, activePromos] = await Promise.all([
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
      dbQuery("SELECT discountID, name, percentage FROM discounts WHERE isArchived = 0 ORDER BY name"),
      dbQuery("SELECT promotionID, name, percentage FROM promotions WHERE isArchived = 0 AND (startDate <= CURDATE() AND endDate >= CURDATE()) ORDER BY name")
    ]);

    const nonConsumableAmenities = nonConsumableList.map(a => {
      const matchIncidental = details.incidentalCharges.find(ic => 
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
        nights: details.nights,
        rate: details.rate,
        originalRoomCharge: details.roomCharge,
        roomCharge: details.finalRoomCharge
      },
      productCharges: details.productCharges,
      cookedMealCharges: details.cookedMealCharges || [],
      storeProductCharges: details.storeProductCharges || [],
      amenityCharges: details.amenityCharges,
      nonConsumableAmenities,
      incidentalCharges: details.incidentalCharges,
      borrowItems,
      borrowedItems: borrowItems,
      chargesSummary: {
        room: details.finalRoomCharge,
        originalRoomCharge: details.roomCharge,
        roomRate: details.rate,
        nights: details.nights,
        breakfastOption: details.chargesSummary?.breakfastOption || 'without',
        totalDiscount: details.totalDiscount,
        sharePerGuest: details.sharePerGuest,
        totalGuests: details.totalGuestsCount,
        downPaymentPaid: details.chargesSummary?.downPaymentPaid || 0,
        downPaymentPercentage: details.chargesSummary?.downPaymentPercentage || 0,
        roomBalance: details.chargesSummary?.roomBalance || 0,
        extraGuests: details.chargesSummary?.extraGuests || 0,
        extraGuestFee: details.chargesSummary?.extraGuestFee || 0,
        extraGuestFeeTag: details.chargesSummary?.extraGuestFeeTag || 'Final Billing Only',
        earlyCheckIn: details.earlyCheckInFee,
        lateCheckOut: details.lateCheckOutFee,
        products: details.productTotal,
        amenities: details.amenityTotal,
        cookedMeals: details.chargesSummary?.cookedMeals || 0,
        incidentals: details.incidentalTotal,
        total: details.subtotal,
        paid: details.paidTotal,
        balance: details.balance,
        remainingBalance: details.chargesSummary?.remainingBalance !== undefined ? details.chargesSummary.remainingBalance : details.balance,
        finalCheckoutBalance: details.chargesSummary?.finalCheckoutBalance || details.balance
      },
      guestsList: details.finalGuestsList,
      billingID: details.billingID,
      discounts
    });

    if (details.billingID) {
      await dbQuery(
        "UPDATE billing SET totalAmount = ?, downPaymentAmount = ?, remainingBalance = ?, balance = ? WHERE billingID = ?",
        [details.subtotal, details.chargesSummary?.downPaymentPaid || 0, details.balance, details.balance, details.billingID]
      ).catch(() => {});
      await dbQuery(
        "UPDATE booking SET remainingBalance = ?, finalBalance = ? WHERE bookingID = ?",
        [details.balance, details.balance, bookingID]
      ).catch(() => {});
    }

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

    if (action === 'checkout') {
      const bookingID = parseInt(body.bookingID);
      if (!bookingID) {
        return NextResponse.json({ error: 'Missing booking ID for checkout.' }, { status: 400 });
      }

      const balance = await getBookingBalance(bookingID);
      if (balance > 0.05) {
        return NextResponse.json({
          error: `Cannot complete checkout. Outstanding balance of ₱${balance.toFixed(2)} must be settled first.`
        }, { status: 400 });
      }

      const pool = await getDbConnection();
      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        const localNow = new Date();
        const pad = (num) => String(num).padStart(2, '0');
        const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

        const [bookingData] = await conn.execute(
          "SELECT b.roomID, b.guestID, g.firstName, g.lastName, g.userID as guestUserID FROM booking b JOIN guest g ON g.guestID = b.guestID WHERE b.bookingID = ?",
          [bookingID]
        );

        if (bookingData.length === 0) {
          return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
        }

        const roomID = bookingData[0].roomID;
        const guestUserID = bookingData[0].guestUserID;
        const guestName = `${bookingData[0].firstName} ${bookingData[0].lastName}`;

        await conn.execute(
          "UPDATE booking SET status = 'Checked Out', checkOutDateTime = ? WHERE bookingID = ?",
          [nowStr, bookingID]
        );

        await conn.execute(
          "UPDATE room SET status = 'Available' WHERE roomID = ?",
          [roomID]
        );

        // Auto-return remaining borrowed amenities
        const [borrows] = await conn.execute(
          "SELECT * FROM borrow_transaction WHERE bookingID = ? AND status = 'Borrowed'",
          [bookingID]
        );
        for (const borrow of borrows) {
          await conn.execute(
            `UPDATE borrow_transaction 
             SET status = 'Returned', conditionUponReturn = 'Good', actualReturnDate = ?, remarks = 'Auto-returned upon checkout' 
             WHERE borrowID = ?`,
            [nowStr, borrow.borrowID]
          );

          const [batches] = await conn.execute(
            "SELECT batchID FROM inventory_batch WHERE itemType = ? AND itemID = ? ORDER BY dateReceived DESC LIMIT 1",
            [borrow.itemType, borrow.itemID]
          );
          const batchID = batches[0]?.batchID || null;
          if (batchID) {
            await conn.execute(
              "UPDATE inventory_batch SET remainingQuantity = remainingQuantity + ? WHERE batchID = ?",
              [borrow.quantity, batchID]
            );
          }

          if (borrow.itemType === 'Amenity') {
            await conn.execute("UPDATE amenities SET quantity = quantity + ? WHERE amenityID = ?", [borrow.quantity, borrow.itemID]);
          } else {
            await conn.execute("UPDATE products SET quantity = quantity + ? WHERE productID = ?", [borrow.quantity, borrow.itemID]);
          }
        }

        const [billingRows] = await conn.execute("SELECT billingID FROM billing WHERE bookingID = ?", [bookingID]);
        const billingID = billingRows[0]?.billingID || null;

        await logBillingAudit(conn, {
          billingID,
          bookingID,
          transactionType: 'Checkout Settlement',
          amount: 0,
          balanceBefore: balance,
          balanceAfter: 0,
          userID: session.userID,
          userName: session.email || 'Receptionist',
          userRole: session.role,
          description: `Guest check-out completed and room freed to Available.`
        });

        await conn.commit();
        await syncInventoryStock();

        // Send notifications
        if (guestUserID) {
          await dbQuery(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Checkout Completed', ?)",
            [guestUserID, `Your stay for Booking #${bookingID} has been successfully checked out. Thank you for staying with PCC Pension House!`]
          );
        }

        const staffList = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
        for (const s of staffList) {
          await dbQuery(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Guest Checked Out', ?)",
            [s.userID, `Booking #${bookingID} for ${guestName} has been checked out and Room has been marked Available.`]
          );
        }

        return NextResponse.json({ success: true, message: 'Guest successfully checked out and room marked as Available.' });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    if (action === 'add_incidental') {
      const bookingID = parseInt(body.bookingID);
      const description = body.description?.trim();
      const amount = Math.round(parseFloat(body.amount || 0) * 100) / 100;

      if (!bookingID || !description || isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Missing or invalid fields for incidental charge.' }, { status: 400 });
      }

      const balanceBefore = await getBookingBalance(bookingID);

      await dbQuery(
        "INSERT INTO incidental_charge (bookingID, description, amount, createdAt) VALUES (?, ?, ?, NOW())",
        [bookingID, description, amount]
      );

      const balanceAfter = Math.round((balanceBefore + amount) * 100) / 100;
      const billingRes = await dbQuery("SELECT billingID FROM billing WHERE bookingID = ? LIMIT 1", [bookingID]);
      const billingID = billingRes[0]?.billingID || null;

      await logBillingAudit(null, {
        billingID,
        bookingID,
        transactionType: 'Incidental Fee',
        amount,
        balanceBefore,
        balanceAfter,
        userID: session.userID,
        userName: session.email || 'Receptionist',
        userRole: session.role,
        description: `Incidental Charge: ${description}`
      });

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

      const balanceBefore = await getBookingBalance(bookingID);

      await dbQuery(
        "INSERT INTO booking_guest_details (bookingID, fullName, age, discountID, discountIdNumber) VALUES (?, ?, ?, ?, ?)",
        [bookingID, fullName, age, discountID, discountIdNumber]
      );

      const balanceAfter = await getBookingBalance(bookingID);
      const diffAmount = Math.max(0, Math.round((balanceAfter - balanceBefore) * 100) / 100);

      const billingRes = await dbQuery("SELECT billingID FROM billing WHERE bookingID = ? LIMIT 1", [bookingID]);
      const billingID = billingRes[0]?.billingID || null;

      await logBillingAudit(null, {
        billingID,
        bookingID,
        transactionType: 'Additional Fee',
        amount: diffAmount,
        balanceBefore,
        balanceAfter,
        userID: session.userID,
        userName: session.email || 'Receptionist',
        userRole: session.role,
        description: `Extra Guest Added: ${fullName} (Additional capacity fee: ₱${diffAmount.toFixed(2)})`
      });

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

    if (action === 'delete_incidental') {
      const chargeID = parseInt(body.chargeID);
      if (!chargeID) {
        return NextResponse.json({ error: 'Charge ID is required.' }, { status: 400 });
      }
      await dbQuery("DELETE FROM incidental_charge WHERE chargeID = ?", [chargeID]);
      return NextResponse.json({ success: true, message: 'Incidental charge deleted successfully.' });
    }

    if (action === 'apply_manual_discount') {
      const bookingID = parseInt(body.bookingID);
      const { discountID, beneficiaryName, discountIdNumber } = body;

      if (!bookingID) {
        return NextResponse.json({ error: 'Missing booking ID.' }, { status: 400 });
      }
      if (!discountID) {
        return NextResponse.json({ error: 'Please select a discount type.' }, { status: 400 });
      }
      if (!beneficiaryName || !beneficiaryName.trim()) {
        return NextResponse.json({ error: 'Beneficiary name is required for verification.' }, { status: 400 });
      }
      if (!discountIdNumber || !discountIdNumber.trim()) {
        return NextResponse.json({ error: 'ID card number is required for verification.' }, { status: 400 });
      }

      let dbDiscountID = null;
      let dbPromotionID = null;
      const rawDiscountID = String(discountID);
      if (rawDiscountID.startsWith('disc-')) {
        dbDiscountID = parseInt(rawDiscountID.replace('disc-', ''));
      } else if (rawDiscountID.startsWith('promo-')) {
        dbPromotionID = parseInt(rawDiscountID.replace('promo-', ''));
      } else {
        dbDiscountID = parseInt(rawDiscountID);
      }

      const balanceBefore = await getBookingBalance(bookingID);

      // Find or create booking_guest_details record
      const existing = await dbQuery("SELECT bookingGuestID FROM booking_guest_details WHERE bookingID = ?", [bookingID]);
      if (existing.length > 0) {
        await dbQuery(
          "UPDATE booking_guest_details SET fullName = ?, discountID = ?, promotionID = ?, discountIdNumber = ? WHERE bookingGuestID = ?",
          [beneficiaryName.trim(), dbDiscountID, dbPromotionID, discountIdNumber.trim(), existing[0].bookingGuestID]
        );
      } else {
        await dbQuery(
          "INSERT INTO booking_guest_details (bookingID, fullName, discountID, promotionID, discountIdNumber) VALUES (?, ?, ?, ?, ?)",
          [bookingID, beneficiaryName.trim(), dbDiscountID, dbPromotionID, discountIdNumber.trim()]
        );
      }

      const balanceAfter = await getBookingBalance(bookingID);
      const discountSaved = Math.max(0, Math.round((balanceBefore - balanceAfter) * 100) / 100);
      const billingRes = await dbQuery("SELECT billingID FROM billing WHERE bookingID = ? LIMIT 1", [bookingID]);
      const billingID = billingRes[0]?.billingID || null;

      await logBillingAudit(null, {
        billingID,
        bookingID,
        transactionType: 'Discount Applied',
        amount: discountSaved,
        balanceBefore,
        balanceAfter,
        userID: session.userID,
        userName: session.email || 'Receptionist',
        userRole: session.role,
        description: `Applied discount for ${beneficiaryName.trim()} (ID: ${discountIdNumber.trim()}). Savings: ₱${discountSaved.toFixed(2)}`
      });

      return NextResponse.json({ success: true, message: 'Discount applied to billing successfully.' });
    }

    if (action === 'remove_discount') {
      const bookingID = parseInt(body.bookingID);
      if (!bookingID) return NextResponse.json({ error: 'Missing booking ID.' }, { status: 400 });
      await dbQuery("UPDATE booking_guest_details SET discountID = NULL, promotionID = NULL, discountIdNumber = NULL WHERE bookingID = ?", [bookingID]);
      return NextResponse.json({ success: true, message: 'Discount removed.' });
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
