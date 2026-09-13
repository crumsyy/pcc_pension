import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, getBookingBalanceDetails, getBookingBalance, logBillingAudit } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let bookingID = parseInt(searchParams.get('bookingID'));

  // If Guest and no bookingID provided, resolve their active or most recent booking
  if (session.role === 'Guest') {
    const guestRes = await dbQuery("SELECT guestID FROM guest WHERE userID = ?", [session.userID]);
    if (guestRes.length === 0) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }
    const guestID = guestRes[0].guestID;

    if (!bookingID) {
      const activeRes = await dbQuery(
        "SELECT bookingID FROM booking WHERE guestID = ? AND status IN ('Checked In', 'Late Checkout', 'Confirmed', 'Pending') ORDER BY checkInDateTime DESC LIMIT 1",
        [guestID]
      );
      if (activeRes.length > 0) {
        bookingID = activeRes[0].bookingID;
      } else {
        const latestRes = await dbQuery(
          "SELECT bookingID FROM booking WHERE guestID = ? ORDER BY checkInDateTime DESC LIMIT 1",
          [guestID]
        );
        if (latestRes.length > 0) {
          bookingID = latestRes[0].bookingID;
        }
      }
    } else {
      // Verify ownership
      const ownerCheck = await dbQuery("SELECT guestID FROM booking WHERE bookingID = ?", [bookingID]);
      if (ownerCheck.length === 0 || ownerCheck[0].guestID !== guestID) {
        return NextResponse.json({ error: 'Access denied to this booking record.' }, { status: 403 });
      }
    }
  } else if (session.role !== 'Receptionist' && session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (!bookingID) {
    return NextResponse.json({ error: 'Missing or unresolvable booking ID.' }, { status: 400 });
  }

  try {
    const details = await getBookingBalanceDetails(bookingID);
    if (!details || !details.booking) {
      return NextResponse.json({ error: 'Booking record not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      bookingID,
      billingID: details.billingID,
      booking: details.booking,
      chargesBreakdown: {
        room: {
          rate: details.rate,
          nights: details.nights,
          baseRoomCharge: details.baseRoomCharge,
          roomChargeWithExtraPax: details.roomCharge,
          finalRoomCharge: details.finalRoomCharge
        },
        additionalFees: {
          extraGuestsCount: details.extraGuests,
          extraGuestFee: details.extraGuestFee,
          earlyCheckInFee: details.earlyCheckInFee,
          lateCheckOutFee: details.lateCheckOutFee,
          lateHours: details.lateHours,
          lateCheckOutRule: details.lateCheckOutRule,
          total: details.totalAdditionalFees
        },
        incidentalFees: {
          charges: details.incidentalCharges,
          total: details.regularIncidentalTotal
        },
        orders: {
          products: details.productCharges,
          amenities: details.amenityCharges,
          productTotal: details.productTotal,
          amenityTotal: details.amenityTotal,
          total: details.ordersTotal
        },
        discounts: {
          guests: details.finalGuestsList,
          total: details.totalDiscount
        }
      },
      balancing: {
        subtotal: details.subtotal,
        paidTotal: details.paidTotal,
        remainingBalance: details.balance
      },
      payments: details.paymentsList || [],
      auditLogs: details.auditLogs || [],
      chargesSummary: details.chargesSummary
    });
  } catch (err) {
    console.error("Failed to fetch billing details:", err);
    return NextResponse.json({ error: 'Server error: ' + err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;
    const bookingID = parseInt(body.bookingID);

    if (!bookingID) {
      return NextResponse.json({ error: 'Missing booking ID.' }, { status: 400 });
    }

    // If Guest, ensure booking ownership
    if (session.role === 'Guest') {
      const guestRes = await dbQuery("SELECT guestID FROM guest WHERE userID = ?", [session.userID]);
      const ownerCheck = await dbQuery("SELECT guestID FROM booking WHERE bookingID = ?", [bookingID]);
      if (ownerCheck.length === 0 || guestRes.length === 0 || ownerCheck[0].guestID !== guestRes[0].guestID) {
        return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
      }
    }

    if (action === 'recalculate' || action === 'sync') {
      const details = await getBookingBalanceDetails(bookingID);
      return NextResponse.json({
        success: true,
        balancing: {
          subtotal: details.subtotal,
          paidTotal: details.paidTotal,
          remainingBalance: details.balance
        },
        chargesSummary: details.chargesSummary
      });
    }

    // Incidental fees and discounts require Receptionist/Admin
    if ((action === 'add_incidental' || action === 'apply_discount') && session.role !== 'Receptionist' && session.role !== 'Administrator') {
      return NextResponse.json({ error: 'Unauthorized action.' }, { status: 403 });
    }

    const pool = await getDbConnection();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Row-level lock to prevent concurrent race conditions
      const [bookingRows] = await conn.execute(
        "SELECT bookingID, status, guestID FROM booking WHERE bookingID = ? FOR UPDATE",
        [bookingID]
      );
      if (bookingRows.length === 0) {
        await conn.rollback();
        return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      }

      const [billingRows] = await conn.execute(
        "SELECT billingID FROM billing WHERE bookingID = ? FOR UPDATE",
        [bookingID]
      );
      let billingID = billingRows[0]?.billingID || null;
      if (!billingID) {
        const [bkGuest] = await conn.execute("SELECT guestID FROM booking WHERE bookingID = ?", [bookingID]);
        const bGuestID = bkGuest[0]?.guestID || null;
        const [insB] = await conn.execute(
          "INSERT INTO billing (billingDateTime, guestID, bookingID) VALUES (NOW(), ?, ?)",
          [bGuestID, bookingID]
        );
        billingID = insB.insertId;
      }

      if (action === 'add_incidental') {
        const description = body.description?.trim();
        const amount = parseFloat(body.amount);

        if (!description || isNaN(amount) || amount <= 0) {
          await conn.rollback();
          return NextResponse.json({ error: 'Valid description and positive amount required.' }, { status: 400 });
        }

        const balanceBefore = await getBookingBalance(bookingID);

        await conn.execute(
          "INSERT INTO incidental_charge (bookingID, description, amount, createdAt) VALUES (?, ?, ?, NOW())",
          [bookingID, description, amount]
        );

        const balanceAfter = Math.round((balanceBefore + amount) * 100) / 100;

        await logBillingAudit(conn, {
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

        await conn.commit();
        const updatedDetails = await getBookingBalanceDetails(bookingID);

        return NextResponse.json({
          success: true,
          message: 'Incidental charge added successfully.',
          balancing: {
            subtotal: updatedDetails.subtotal,
            paidTotal: updatedDetails.paidTotal,
            remainingBalance: updatedDetails.balance
          },
          chargesSummary: updatedDetails.chargesSummary
        });
      }

      if (action === 'apply_discount') {
        const { discountID, beneficiaryName, discountIdNumber } = body;
        if (!discountID || !beneficiaryName?.trim() || !discountIdNumber?.trim()) {
          await conn.rollback();
          return NextResponse.json({ error: 'Discount type, beneficiary name, and ID card number are required.' }, { status: 400 });
        }

        const balanceBefore = await getBookingBalance(bookingID);

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

        const [existing] = await conn.execute("SELECT bookingGuestID FROM booking_guest_details WHERE bookingID = ? LIMIT 1", [bookingID]);
        if (existing.length > 0) {
          await conn.execute(
            "UPDATE booking_guest_details SET fullName = ?, discountID = ?, promotionID = ?, discountIdNumber = ? WHERE bookingGuestID = ?",
            [beneficiaryName.trim(), dbDiscountID, dbPromotionID, discountIdNumber.trim(), existing[0].bookingGuestID]
          );
        } else {
          await conn.execute(
            "INSERT INTO booking_guest_details (bookingID, fullName, discountID, promotionID, discountIdNumber) VALUES (?, ?, ?, ?, ?)",
            [bookingID, beneficiaryName.trim(), dbDiscountID, dbPromotionID, discountIdNumber.trim()]
          );
        }

        await conn.commit();
        const updatedDetails = await getBookingBalanceDetails(bookingID);
        const balanceAfter = updatedDetails.balance;
        const discountSaved = Math.max(0, Math.round((balanceBefore - balanceAfter) * 100) / 100);

        await logBillingAudit(pool, {
          billingID,
          bookingID,
          transactionType: 'Discount Applied',
          amount: discountSaved,
          balanceBefore,
          balanceAfter,
          userID: session.userID,
          userName: session.email || 'Receptionist',
          userRole: session.role,
          description: `Applied discount for ${beneficiaryName.trim()} (ID: ${discountIdNumber.trim()}). Total discount: ₱${discountSaved.toFixed(2)}`
        });

        return NextResponse.json({
          success: true,
          message: 'Discount applied and logged successfully.',
          balancing: {
            subtotal: updatedDetails.subtotal,
            paidTotal: updatedDetails.paidTotal,
            remainingBalance: updatedDetails.balance
          },
          chargesSummary: updatedDetails.chargesSummary
        });
      }

      if (action === 'complete_checkout' || action === 'checkout') {
        const balance = await getBookingBalance(bookingID);
        if (balance > 0.05) {
          await conn.rollback();
          return NextResponse.json({
            error: `Cannot complete check-out. Outstanding balance of ₱${balance.toFixed(2)} must be settled before checkout.`
          }, { status: 400 });
        }

        await conn.commit();
        const checkoutRes = await completeBookingAndFreeRoom(bookingID);
        if (checkoutRes.error) {
          return NextResponse.json({ error: checkoutRes.error }, { status: 400 });
        }

        await logBillingAudit(pool, {
          billingID,
          bookingID,
          transactionType: 'Checkout Settlement',
          amount: 0,
          balanceBefore: balance,
          balanceAfter: 0,
          userID: session.userID,
          userName: session.email || (session.role === 'Guest' ? 'Guest' : 'Receptionist'),
          userRole: session.role,
          description: `Guest check-out completed and room freed to Available.`
        });

        return NextResponse.json({
          success: true,
          message: 'Guest check-out completed successfully. The room is now Available.',
          roomStatus: 'Available',
          bookingStatus: 'Completed'
        });
      }

      if (action === 'validate_checkout') {
        const balance = await getBookingBalance(bookingID);
        const canCheckout = balance <= 0.05;
        await conn.rollback();
        return NextResponse.json({
          success: true,
          canCheckout,
          remainingBalance: balance,
          message: canCheckout
            ? 'Account is settled. Ready for checkout.'
            : `Outstanding balance of ₱${balance.toFixed(2)} must be settled before checkout.`
        });
      }

      await conn.rollback();
      return NextResponse.json({ error: 'Invalid billing action.' }, { status: 400 });
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("Failed to process billing operation:", err);
    return NextResponse.json({ error: 'Operation failed: ' + err.message }, { status: 500 });
  }
}
