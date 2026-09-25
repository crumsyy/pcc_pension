import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, getBookingBalanceDetails, getBookingBalance, syncInventoryStock, logBillingAudit, ensureBookingBillingSchema, syncNormalizedBillingLineItems } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureBookingBillingSchema();

  const { searchParams } = new URL(request.url);
  let bookingID = parseInt(searchParams.get('bookingID'));
  const guestID = parseInt(searchParams.get('guestID'));

  if (!bookingID && guestID) {
    try {
      const activeForGuest = await dbQuery(
        "SELECT bookingID FROM booking WHERE guestID = ? AND status NOT IN ('Cancelled', 'Canceled') ORDER BY bookingID DESC LIMIT 1",
        [guestID]
      );
      if (activeForGuest.length > 0) {
        bookingID = activeForGuest[0].bookingID;
      }
    } catch (e) {
      console.warn("Could not resolve booking from guestID:", e);
    }
  }

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
      console.warn(`[Billing API] Booking ${bookingID} not found or details.booking is null. Details:`, details?.errorMessage || 'No error details');
      return NextResponse.json({ error: details?.errorMessage ? `Billing notice: ${details.errorMessage}` : 'Booking not found.' }, { status: 404 });
    }

    const booking = details.booking;
    if (booking.status === 'Cancelled' || booking.status === 'Canceled') {
      return NextResponse.json({ error: 'This booking has been cancelled.' }, { status: 400 });
    }

    const cleanCheckInDate = (booking.checkInDateTime || '').replace('T', ' ');

    const [borrowItems, nonConsumableList, activeDiscounts, activePromos] = await Promise.all([
      dbQuery(`
        SELECT bt.*, COALESCE(a.name, p.name) as itemName
        FROM borrow_transaction bt
        LEFT JOIN amenities a ON bt.itemType = 'Amenity' AND a.amenityID = bt.itemID
        LEFT JOIN products p ON bt.itemType = 'Product' AND p.productID = bt.itemID
        WHERE bt.bookingID = ?
      `, [bookingID]).catch(() => []),
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
      `, [booking.guestID, cleanCheckInDate]).catch(() => []),
      dbQuery("SELECT discountID, name, percentage FROM discounts WHERE isArchived = 0 ORDER BY name").catch(() => []),
      dbQuery("SELECT promotionID, name, percentage FROM promotions WHERE isArchived = 0 AND (startDate <= CURDATE() AND endDate >= CURDATE()) ORDER BY name").catch(() => [])
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
      discountList: details.discountList || [],
      chargesSummary: {
        room: details.finalRoomCharge,
        originalRoomCharge: details.roomCharge,
        baseRoomCharge: details.baseRoomCharge || details.roomCharge,
        roomRate: details.rate,
        nights: details.nights,
        breakfastOption: details.chargesSummary?.breakfastOption || 'without',
        grossSubtotal: details.grossSubtotal || (details.roomCharge + (details.chargesSummary?.extraGuestFee || 0) + (details.earlyCheckInFee || 0) + (details.lateCheckOutFee || 0) + (details.productTotal || 0) + (details.amenityTotal || 0) + (details.incidentalTotal || 0)),
        discountTotal: details.discountTotal || details.totalDiscount || 0,
        netTotal: details.netTotal || details.subtotal || 0,
        vatRate: details.vatRate || details.chargesSummary?.vatRate || 12.00,
        vatAmount: details.vatAmount || details.chargesSummary?.vatAmount || 0,
        grandTotal: details.grandTotal || details.chargesSummary?.grandTotal || details.netTotal || 0,
        totalAmount: details.grandTotal || details.chargesSummary?.grandTotal || details.netTotal || 0,
        discountList: details.discountList || [],
        totalDiscount: details.discountTotal || details.totalDiscount || 0,
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
        subtotal: details.grossSubtotal || details.subtotal,
        total: details.grandTotal || details.chargesSummary?.grandTotal || details.netTotal,
        paid: details.paidTotal,
        balance: details.balance,
        remainingBalance: details.chargesSummary?.remainingBalance !== undefined ? details.chargesSummary.remainingBalance : details.balance,
        finalCheckoutBalance: details.chargesSummary?.finalCheckoutBalance || details.balance,
        stayComplimentaryAllowance: details.chargesSummary?.stayComplimentaryAllowance ?? 0,
        complimentaryBreakfastUsed: details.chargesSummary?.complimentaryBreakfastUsed ?? details.complimentaryBreakfastUsed ?? 0,
        isBillFinalized: details.chargesSummary?.isBillFinalized ?? details.isBillFinalized ?? 0,
        billingStatus: details.chargesSummary?.billingStatus || details.billingStatus || 'Pending'
      },
      vatRate: details.vatRate || details.chargesSummary?.vatRate || 12.00,
      vatAmount: details.vatAmount || details.chargesSummary?.vatAmount || 0,
      grandTotal: details.grandTotal || details.chargesSummary?.grandTotal || details.netTotal || 0,
      netTotal: details.netTotal || 0,
      grossSubtotal: details.grossSubtotal || 0,
      subtotal: details.grossSubtotal || details.subtotal || 0,
      discountTotal: details.discountTotal || 0,
      chargesBreakdown: details.chargesBreakdown || {},
      breakfastSummary: details.chargesBreakdown?.breakfastSummary || {
        complimentaryBreakfastUsed: details.complimentaryBreakfastUsed ?? 0,
        stayComplimentaryAllowance: details.chargesSummary?.stayComplimentaryAllowance ?? 0
      },
      isBillFinalized: details.chargesSummary?.isBillFinalized ?? details.isBillFinalized ?? 0,
      billingStatus: details.chargesSummary?.billingStatus || details.billingStatus || 'Pending',
      guestsList: details.finalGuestsList,
      billingID: details.billingID,
      discounts
    });

    if (details.billingID) {
      await dbQuery(
        "UPDATE billing SET subtotal = ?, discountTotal = ?, netTotal = ?, vatRate = ?, vatAmount = ?, grandTotal = ?, totalAmount = ?, downPaymentAmount = ?, remainingBalance = ?, balance = ? WHERE billingID = ?",
        [details.grossSubtotal, details.discountTotal, details.netTotal, details.vatRate, details.vatAmount, details.grandTotal, details.grandTotal, details.chargesSummary?.downPaymentPaid || 0, details.balance, details.balance, details.billingID]
      ).catch(() => {});
      await dbQuery(
        "UPDATE booking SET subtotal = ?, discountTotal = ?, netTotal = ?, vatRate = ?, vatAmount = ?, grandTotal = ?, totalAmount = ?, remainingBalance = ?, finalBalance = ? WHERE bookingID = ?",
        [details.grossSubtotal, details.discountTotal, details.netTotal, details.vatRate, details.vatAmount, details.grandTotal, details.grandTotal, details.balance, details.balance, bookingID]
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

    if (action === 'finalize_bill') {
      const bookingID = parseInt(body.bookingID);
      if (!bookingID) {
        return NextResponse.json({ error: 'Missing booking ID for bill finalization.' }, { status: 400 });
      }

      const pool = await getDbConnection();
      const conn = await pool.getConnection();

      try {
        await conn.beginTransaction();

        const [bookingData] = await conn.execute(
          "SELECT b.bookingID, b.status, b.guestID, g.userID as guestUserID, g.firstName, g.lastName FROM booking b JOIN guest g ON g.guestID = b.guestID WHERE b.bookingID = ?",
          [bookingID]
        );

        if (bookingData.length === 0) {
          await conn.rollback();
          return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
        }

        const booking = bookingData[0];
        if (booking.status === 'Cancelled' || booking.status === 'Checked Out' || booking.status === 'Completed') {
          await conn.rollback();
          return NextResponse.json({ error: `Cannot finalize bill for a ${booking.status} booking.` }, { status: 400 });
        }

        // Ensure columns exist on billing and booking table before running updates
        await conn.execute("ALTER TABLE billing ADD COLUMN isBillFinalized TINYINT(1) NOT NULL DEFAULT 0").catch(() => {});
        await conn.execute("ALTER TABLE billing ADD COLUMN updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP").catch(() => {});
        await conn.execute("ALTER TABLE booking ADD COLUMN billFinalizedAt DATETIME NULL").catch(() => {});
        await conn.execute("ALTER TABLE booking ADD COLUMN updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP").catch(() => {});

        // Update billing table
        await conn.execute(
          "UPDATE billing SET isBillFinalized = 1, billingStatus = 'Bill Finalized', updatedAt = NOW() WHERE bookingID = ?",
          [bookingID]
        );

        // Update booking table
        await conn.execute(
          "UPDATE booking SET status = 'Bill Finalized', billFinalizedAt = NOW(), updatedAt = NOW() WHERE bookingID = ?",
          [bookingID]
        );

        // Audit log
        await logBillingAudit(
          bookingID,
          'STATUS_CHANGE',
          0,
          'Bill finalized by front desk. Online payment unlocked for guest.',
          session.user?.id || session.userId || null,
          booking.status,
          'Bill Finalized'
        );

        // Notify Guest if applicable
        if (booking.guestUserID) {
          await conn.execute(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Bill Finalized', ?)",
            [
              booking.guestUserID,
              `Your final bill for Booking #${bookingID} has been reviewed and finalized by the front desk. You can now pay your remaining balance through your portal.`
            ]
          ).catch(() => {});
        }

        await conn.commit();
        return NextResponse.json({
          success: true,
          message: 'Bill has been finalized and payment is now unlocked for the guest.'
        });
      } catch (err) {
        await conn.rollback();
        console.error("Failed to finalize bill:", err);
        return NextResponse.json({ error: 'Failed to finalize bill: ' + err.message }, { status: 500 });
      } finally {
        conn.release();
      }
    }

    if (action === 'checkout' || action === 'complete_booking') {
      const bookingID = parseInt(body.bookingID);
      if (!bookingID) {
        return NextResponse.json({ error: 'Missing booking ID for completing booking.' }, { status: 400 });
      }

      const balance = await getBookingBalance(bookingID);
      if (balance > 0.05) {
        return NextResponse.json({
          error: `Cannot complete booking. Outstanding balance of ₱${balance.toFixed(2)} must be settled first.`
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
          "UPDATE booking SET status = 'Checked Out', actualCheckOut = CURRENT_TIMESTAMP, checkOutDateTime = ? WHERE bookingID = ?",
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

        if (billingID) {
          await syncNormalizedBillingLineItems(conn, billingID, bookingID);
        }

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

      if (billingID) {
        await syncNormalizedBillingLineItems(null, billingID, bookingID);
      }

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
      let bookingID = parseInt(body.bookingID);
      if (!chargeID) {
        return NextResponse.json({ error: 'Missing charge ID.' }, { status: 400 });
      }

      // 1. Look up charge details (and bookingID if not provided)
      const chargeRows = await dbQuery(
        "SELECT chargeID, bookingID, amount, description FROM incidental_charge WHERE chargeID = ?",
        [chargeID]
      );

      if (chargeRows.length === 0) {
        // Check if stored in legacy booking_incidentals
        const bkRows = await dbQuery(
          "SELECT incidentalID as chargeID, bookingID, amount, description FROM booking_incidentals WHERE incidentalID = ?",
          [chargeID]
        ).catch(() => []);
        if (bkRows.length > 0) {
          chargeRows.push(bkRows[0]);
        }
      }

      if (chargeRows.length === 0) {
        return NextResponse.json({ error: 'Incidental charge not found or already deleted.' }, { status: 404 });
      }

      const charge = chargeRows[0];
      if (!bookingID) {
        bookingID = charge.bookingID;
      }
      const chargeAmount = parseFloat(charge.amount || 0);
      const balanceBefore = await getBookingBalance(bookingID);

      // 2. Perform hard delete from both tables
      await dbQuery("DELETE FROM incidental_charge WHERE chargeID = ?", [chargeID]);
      await dbQuery("DELETE FROM booking_incidentals WHERE incidentalID = ?", [chargeID]).catch(() => {});

      // 3. Re-sync master billing ledger so remaining balance updates immediately
      const billingRes = await dbQuery(
        "SELECT billingID FROM billing WHERE bookingID = ? ORDER BY billingID DESC LIMIT 1",
        [bookingID]
      );
      const billingID = billingRes[0]?.billingID || null;

      if (billingID) {
        await syncNormalizedBillingLineItems(null, billingID, bookingID);
      }

      const balanceAfter = await getBookingBalance(bookingID);

      // 4. Record audit trail
      await logBillingAudit(null, {
        billingID,
        bookingID,
        transactionType: 'Incidental Removed',
        amount: chargeAmount,
        balanceBefore,
        balanceAfter,
        userID: session.userID,
        userName: session.email || 'Receptionist',
        userRole: session.role,
        description: `Removed Incidental Charge: ${charge.description} (₱${chargeAmount.toFixed(2)})`
      });

      return NextResponse.json({
        success: true,
        message: 'Incidental charge deleted successfully.',
        bookingID,
        chargeID,
        balanceAfter
      });
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


    if (action === 'apply_manual_discount' || action === 'apply_manual_discounts' || action === 'apply_discount') {
      const bookingID = parseInt(body.bookingID);
      if (!bookingID) {
        return NextResponse.json({ error: 'Missing booking ID.' }, { status: 400 });
      }

      let discountsList = [];
      if (Array.isArray(body.discounts) && body.discounts.length > 0) {
        discountsList = body.discounts;
      } else if (body.discountID) {
        discountsList = [{
          discountID: body.discountID,
          beneficiaryName: body.beneficiaryName,
          discountIdNumber: body.discountIdNumber
        }];
      } else {
        return NextResponse.json({ error: 'Please specify at least one discount to apply.' }, { status: 400 });
      }

      // Check booking and reservation guestCount
      const bRows = await dbQuery(
        `SELECT b.bookingID, b.guestID, COALESCE(b.guestCount, r.guestCount, 1) as guestCount 
         FROM booking b 
         LEFT JOIN reservation r ON r.reservationID = b.reservationID 
         WHERE b.bookingID = ?`,
        [bookingID]
      );
      if (!bRows || bRows.length === 0) {
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }
      const allowedGuestCount = Math.max(1, parseInt(bRows[0].guestCount || 1));

      if (discountsList.length > allowedGuestCount) {
        return NextResponse.json({
          error: `Cannot apply ${discountsList.length} discounts. Maximum eligible discounts for this stay is ${allowedGuestCount} (total room guests).`
        }, { status: 400 });
      }

      // Validate each discount
      const parsedDiscounts = [];
      const seenCards = new Set();

      for (let i = 0; i < discountsList.length; i++) {
        const item = discountsList[i];
        if (!item.discountID) {
          return NextResponse.json({ error: `Beneficiary #${i + 1}: Please select a discount type.` }, { status: 400 });
        }
        if (!item.beneficiaryName || !item.beneficiaryName.trim()) {
          return NextResponse.json({ error: `Beneficiary #${i + 1}: Full name is required for verification.` }, { status: 400 });
        }
        if (!item.discountIdNumber || !item.discountIdNumber.trim()) {
          return NextResponse.json({ error: `Beneficiary #${i + 1} (${item.beneficiaryName.trim()}): ID card number is required for verification.` }, { status: 400 });
        }

        const cardKey = item.discountIdNumber.trim().toLowerCase();
        if (seenCards.has(cardKey)) {
          return NextResponse.json({
            error: `Duplicate discount entry: ID card number '${item.discountIdNumber.trim()}' was entered more than once.`
          }, { status: 400 });
        }
        seenCards.add(cardKey);

        let dbDiscountID = null;
        let dbPromotionID = null;
        const rawDiscountID = String(item.discountID);
        if (rawDiscountID.startsWith('disc-')) {
          dbDiscountID = parseInt(rawDiscountID.replace('disc-', ''));
        } else if (rawDiscountID.startsWith('promo-')) {
          dbPromotionID = parseInt(rawDiscountID.replace('promo-', ''));
        } else {
          dbDiscountID = parseInt(rawDiscountID);
        }

        parsedDiscounts.push({
          fullName: item.beneficiaryName.trim(),
          discountID: dbDiscountID,
          promotionID: dbPromotionID,
          discountIdNumber: item.discountIdNumber.trim()
        });
      }

      // Check if the exact same discounts are already applied (idempotency guard)
      const existingDiscounts = await dbQuery(
        `SELECT fullName, discountID, promotionID, discountIdNumber 
         FROM booking_guest_details 
         WHERE bookingID = ? AND (discountID IS NOT NULL OR promotionID IS NOT NULL)`,
        [bookingID]
      );

      if (existingDiscounts && existingDiscounts.length === parsedDiscounts.length && existingDiscounts.length > 0) {
        const norm = (arr) => arr.map(d => `${d.discountID || d.promotionID}_${(d.discountIdNumber || '').toLowerCase().trim()}`).sort().join('|');
        if (norm(existingDiscounts) === norm(parsedDiscounts)) {
          return NextResponse.json({
            success: true,
            alreadyApplied: true,
            message: 'This discount configuration has already been applied to this booking.'
          });
        }
      }

      const balanceBefore = await getBookingBalance(bookingID);

      // Replace existing discount records for this booking in booking_guest_details and booking_discount
      await dbQuery("DELETE FROM booking_guest_details WHERE bookingID = ?", [bookingID]);
      await dbQuery("DELETE FROM booking_discount WHERE bookingID = ?", [bookingID]);

      const detailsBefore = await getBookingBalanceDetails(bookingID);
      const baseRoomCharge = detailsBefore?.baseRoomCharge || 0;
      const guestCount = Math.max(1, detailsBefore?.totalGuestsCount || parsedDiscounts.length);
      const sharePerGuest = baseRoomCharge / guestCount;

      for (const pd of parsedDiscounts) {
        await dbQuery(
          "INSERT INTO booking_guest_details (bookingID, fullName, discountID, promotionID, discountIdNumber, age) VALUES (?, ?, ?, ?, ?, 60)",
          [bookingID, pd.fullName, pd.discountID, pd.promotionID, pd.discountIdNumber]
        );

        let pct = 0;
        if (pd.discountID) {
          const dRow = await dbQuery("SELECT percentage FROM discounts WHERE discountID = ?", [pd.discountID]);
          pct = parseFloat(dRow[0]?.percentage || 0);
        } else if (pd.promotionID) {
          const pRow = await dbQuery("SELECT percentage FROM promotions WHERE promotionID = ?", [pd.promotionID]);
          pct = parseFloat(pRow[0]?.percentage || 0);
        }
        const discAmt = Math.round(sharePerGuest * (pct / 100) * 100) / 100;

        await dbQuery(
          "INSERT INTO booking_discount (bookingID, guestName, discountID, discountIdNumber, discountAmount) VALUES (?, ?, ?, ?, ?)",
          [bookingID, pd.fullName, pd.discountID || null, pd.discountIdNumber || 'N/A', discAmt]
        );
      }

      const billingRes = await dbQuery("SELECT billingID FROM billing WHERE bookingID = ? ORDER BY billingID DESC LIMIT 1", [bookingID]);
      const billingID = billingRes[0]?.billingID || null;
      if (billingID) {
        await syncNormalizedBillingLineItems(null, billingID, bookingID);
      }

      const balanceAfter = await getBookingBalance(bookingID);
      const discountSaved = Math.max(0, Math.round((balanceBefore - balanceAfter) * 100) / 100);

      const descList = parsedDiscounts.map(d => `${d.fullName} (${d.discountIdNumber})`).join(', ');
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
        description: `Applied discounts for ${parsedDiscounts.length} guest(s): ${descList}. Total Savings: ₱${discountSaved.toFixed(2)}`
      });

      return NextResponse.json({
        success: true,
        message: `${parsedDiscounts.length} discount(s) applied to billing successfully. Total savings: ₱${discountSaved.toFixed(2)}.`
      });
    }

    if (action === 'remove_discount' || action === 'remove_discounts') {
      const bookingID = parseInt(body.bookingID);
      if (!bookingID) return NextResponse.json({ error: 'Missing booking ID.' }, { status: 400 });
      await dbQuery("DELETE FROM booking_guest_details WHERE bookingID = ?", [bookingID]);
      await dbQuery("DELETE FROM booking_discount WHERE bookingID = ?", [bookingID]);

      const billingRes = await dbQuery("SELECT billingID FROM billing WHERE bookingID = ? ORDER BY billingID DESC LIMIT 1", [bookingID]);
      const billingID = billingRes[0]?.billingID || null;
      if (billingID) {
        await syncNormalizedBillingLineItems(null, billingID, bookingID);
      }

      return NextResponse.json({ success: true, message: 'All applied discounts removed from billing.' });
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

      // Re-sync booking_discount
      await conn.execute("DELETE FROM booking_discount WHERE bookingID = ?", [bookingID]);
      const [allGuests] = await conn.execute("SELECT * FROM booking_guest_details WHERE bookingID = ?", [bookingID]);
      const detailsBefore = await getBookingBalanceDetails(bookingID);
      const baseRoomCharge = detailsBefore?.baseRoomCharge || 0;
      const guestCount = Math.max(1, detailsBefore?.totalGuestsCount || allGuests.length);
      const sharePerGuest = baseRoomCharge / guestCount;

      for (const ag of allGuests) {
        if (ag.discountID || ag.promotionID) {
          let pct = 0;
          if (ag.discountID) {
            const [dData] = await conn.execute("SELECT percentage FROM discounts WHERE discountID = ?", [ag.discountID]);
            pct = parseFloat(dData[0]?.percentage || 0);
          } else if (ag.promotionID) {
            const [pData] = await conn.execute("SELECT percentage FROM promotions WHERE promotionID = ?", [ag.promotionID]);
            pct = parseFloat(pData[0]?.percentage || 0);
          }
          const discAmt = Math.round(sharePerGuest * (pct / 100) * 100) / 100;
          await conn.execute(
            "INSERT INTO booking_discount (bookingID, guestName, discountID, discountIdNumber, discountAmount) VALUES (?, ?, ?, ?, ?)",
            [bookingID, ag.fullName, ag.discountID || null, ag.discountIdNumber || 'N/A', discAmt]
          );
        }
      }

      const [billingRows] = await conn.execute("SELECT billingID FROM billing WHERE bookingID = ? ORDER BY billingID DESC LIMIT 1", [bookingID]);
      const billingID = billingRows[0]?.billingID || null;
      if (billingID) {
        await syncNormalizedBillingLineItems(conn, billingID, bookingID);
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
