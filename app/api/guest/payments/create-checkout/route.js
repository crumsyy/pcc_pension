import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getBookingBalanceDetails, logBillingAudit, ensureBookingBillingSchema } from '@/lib/db';
import { getBaseUrl, getPayMongoAuthHeader } from '@/lib/paymongo';

export async function POST(request) {
  const session = await getSession();
  if (!session || !['Guest', 'Receptionist', 'Administrator'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    await ensureBookingBillingSchema();
    const body = await request.json().catch(() => ({}));
    const bookingID = parseInt(body.bookingID, 10);
    const paymentType = body.paymentType === 'full' ? 'full' : 'downpayment';

    if (!bookingID || isNaN(bookingID)) {
      return NextResponse.json({ error: 'Valid bookingID is required.' }, { status: 400 });
    }

    // Zero-Trust: If user is Guest, verify booking belongs to them
    if (session.role === 'Guest') {
      const guestRows = await dbQuery("SELECT guestID FROM guest WHERE userID = ?", [session.userID]);
      if (guestRows.length === 0) {
        return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
      }
      const guestID = guestRows[0].guestID;

      const bookingCheck = await dbQuery("SELECT bookingID FROM booking WHERE bookingID = ? AND guestID = ?", [bookingID, guestID]);
      if (bookingCheck.length === 0) {
        return NextResponse.json({ error: 'Booking not found or access denied.' }, { status: 403 });
      }
    }

    // Dynamic Server-Side Calculation: Never trust client amount
    const balanceDetails = await getBookingBalanceDetails(bookingID);
    if (!balanceDetails || !balanceDetails.booking) {
      return NextResponse.json({ error: 'Booking details could not be retrieved.' }, { status: 404 });
    }

    const currentBalance = parseFloat(balanceDetails.balance || balanceDetails.remainingBalance || 0);
    if (currentBalance <= 0) {
      return NextResponse.json({ error: 'This booking has no outstanding balance to pay.' }, { status: 400 });
    }

    let serverAmount = 0;
    if (paymentType === 'downpayment') {
      // Minimum 25% of gross charges (subtotal) or storedDownPaymentAmount
      const grossCharges = parseFloat(balanceDetails.subtotal || 0);
      const storedDownPayment = parseFloat(balanceDetails.booking.storedDownPaymentAmount || 0);
      const min25Pct = Math.round((grossCharges * 0.25) * 100) / 100;
      serverAmount = Math.max(min25Pct, storedDownPayment > 0 ? storedDownPayment : min25Pct);

      // Capped by remaining balance
      if (serverAmount > currentBalance) {
        serverAmount = currentBalance;
      }
    } else {
      // Full settlement: Remaining uncollected balance
      serverAmount = currentBalance;
    }

    if (serverAmount <= 0) {
      return NextResponse.json({ error: 'Calculated payment amount must be greater than zero.' }, { status: 400 });
    }

    // Convert to integer centavos
    const amountInCentavos = Math.round(serverAmount * 100);
    const baseUrl = getBaseUrl(request);

    // Call PayMongo Sources API
    const authHeader = getPayMongoAuthHeader();
    const pmRes = await fetch('https://api.paymongo.com/v1/sources', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: amountInCentavos,
            currency: 'PHP',
            type: 'gcash',
            redirect: {
              success: `${baseUrl}/guest/dashboard?payment=success&bookingID=${bookingID}`,
              failed: `${baseUrl}/guest/dashboard?payment=failed&bookingID=${bookingID}`
            }
          }
        }
      })
    });

    const pmData = await pmRes.json();
    if (!pmRes.ok || !pmData.data) {
      const errMsg = pmData.errors?.[0]?.detail || 'Failed to create PayMongo GCash checkout source.';
      console.error("PayMongo Source creation failed:", pmData);
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    const source = pmData.data;
    const checkoutUrl = source.attributes?.redirect?.checkout_url;
    const sourceID = source.id;

    if (!checkoutUrl) {
      return NextResponse.json({ error: 'Checkout URL was not returned by payment provider.' }, { status: 502 });
    }

    // Map pending PayMongo source ID to bookingID in billing_audit
    await logBillingAudit(null, {
      billingID: balanceDetails.billingID || null,
      bookingID: bookingID,
      transactionType: 'CHECKOUT_INITIATED',
      amount: serverAmount,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance,
      userID: session.userID,
      userName: `${balanceDetails.booking.firstName || ''} ${balanceDetails.booking.lastName || ''}`.trim() || session.email,
      userRole: session.role,
      referenceNumber: sourceID,
      status: 'Pending',
      description: `PayMongo GCash checkout initiated (${paymentType}: ₱${serverAmount.toFixed(2)})`
    }).catch(err => {
      console.error("Failed to log checkout initiation audit:", err);
    });

    return NextResponse.json({
      success: true,
      checkoutUrl,
      sourceID,
      amount: serverAmount,
      paymentType,
      bookingID
    });

  } catch (error) {
    console.error("Error creating PayMongo checkout:", error);
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
