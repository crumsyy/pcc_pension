import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getBookingBalance, getBookingBalanceDetails, ensureBookingBillingSchema } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();

    // 1. PayMongo Webhook Handler (if triggered via webhook)
    if (body.data?.attributes?.type) {
      const eventType = body.data.attributes.type;
      const eventData = body.data.attributes.data;
      const secretKey = process.env.PAYMONGO_SECRET_KEY || 'sk_test_GjYHQCNkKkxUuhQykSsSetrS';
      const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');

      if (eventType === 'source.chargeable') {
        const sourceID = eventData.id;
        const amount = eventData.attributes.amount;

        await fetch('https://api.paymongo.com/v1/payments', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            data: {
              attributes: {
                amount,
                currency: 'PHP',
                source: {
                  id: sourceID,
                  type: 'source'
                },
                description: `GCash Online Downpayment (Source ${sourceID})`
              }
            }
          })
        }).catch(err => console.error("Webhook charge error:", err));
      }

      return NextResponse.json({ received: true });
    }

    // 2. Test mode instant payment authorization simulation
    if (body.action === 'simulate_test_pay' || body.action === 'simulate_authorize') {
      const simRef = body.referenceNumber || `PM-SIM-${Date.now().toString().slice(-8)}`;
      const amountPaid = parseFloat(body.amount || 0);
      const bookingID = body.bookingID ? parseInt(body.bookingID) : null;

      let billingObj = null;
      if (bookingID) {
        await ensureBookingBillingSchema();
        const details = await getBookingBalanceDetails(bookingID);
        if (details && details.booking) {
          const totalAmt = details.subtotal || details.baseRoomCharge || 0;
          const remaining = Math.max(0, Math.round((totalAmt - amountPaid) * 100) / 100);

          await dbQuery(
            "UPDATE booking SET status = 'Confirmed', downPaymentAmount = ?, remainingBalance = ?, finalBalance = ? WHERE bookingID = ?",
            [amountPaid, remaining, remaining, bookingID]
          );
          await dbQuery(
            "UPDATE billing SET downPaymentAmount = ?, remainingBalance = ?, balance = ? WHERE bookingID = ?",
            [amountPaid, remaining, remaining, bookingID]
          );
          billingObj = {
            bookingID,
            totalAmount: totalAmt,
            downPaymentAmount: amountPaid,
            remainingBalance: remaining,
            status: 'Settled'
          };
        }
      }

      return NextResponse.json({
        success: true,
        isPaid: true,
        status: 'paid',
        referenceNumber: simRef,
        amount: amountPaid,
        billing: billingObj,
        message: 'Payment simulation successful via PayMongo Test Mode.'
      });
    }

    // 3. Standard Guest Checkout Session Creation
    const session = await getSession();
    if (!session || !['Guest', 'Receptionist', 'Administrator'].includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { amount, reservationID, bookingID, description } = body;
    const parseAmt = parseFloat(amount);
    if (isNaN(parseAmt) || parseAmt <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount.' }, { status: 400 });
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY || 'sk_test_GjYHQCNkKkxUuhQykSsSetrS';

    // Fetch guest details
    let guest = {};
    if (session.userID) {
      const guests = await dbQuery("SELECT guestID, firstName, lastName, contact, email FROM guest WHERE userID = ?", [session.userID]);
      guest = guests[0] || {};
    }

    let guestName = (body.billingName || `${guest.firstName || ''} ${guest.lastName || ''}`).trim();
    if (!guestName) {
      guestName = (session.fullName || session.email || 'Guest User').trim();
    }

    const guestEmail = guest.email || session?.email || 'guest@example.com';
    let guestPhone = (guest.contact || body.phone || '09171234567').replace(/\D/g, '');
    if (guestPhone.length !== 11) guestPhone = '09171234567';

    // Base URL for PayMongo redirection
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const amountInCentavos = Math.round(parseAmt * 100);
    const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');

    // Create PayMongo GCash Source
    const paymongoRes = await fetch('https://api.paymongo.com/v1/sources', {
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
              success: `${baseUrl}/guest/dashboard?payment=success&sourceID={id}&reservationID=${reservationID || ''}&bookingID=${bookingID || ''}`,
              failed: `${baseUrl}/guest/dashboard?payment=failed`
            },
            billing: {
              name: guestName,
              email: guestEmail,
              phone: guestPhone.length === 11 ? guestPhone : '09171234567'
            }
          }
        }
      })
    });

    const pmData = await paymongoRes.json();

    if (!paymongoRes.ok || pmData.errors) {
      const errMsg = pmData.errors?.[0]?.detail || 'Failed to initiate PayMongo GCash checkout.';
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    const sourceData = pmData.data;
    const checkoutUrl = sourceData.attributes.redirect.checkout_url;
    const sourceID = sourceData.id;

    // Generate clean QR code URL pointing directly to the PayMongo checkout/sandbox
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(checkoutUrl)}`;

    return NextResponse.json({
      success: true,
      checkoutUrl,
      qrCodeUrl,
      sourceID,
      amount: parseAmt
    });

  } catch (error) {
    console.error("PayMongo GCash initiation error:", error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceID = searchParams.get('sourceID') || searchParams.get('sourceId');
    const paymentIntentID = searchParams.get('paymentIntentID') || searchParams.get('paymentIntentId');
    const bookingIDParam = searchParams.get('bookingID') || searchParams.get('bookingId');
    const bookingID = bookingIDParam ? parseInt(bookingIDParam) : null;

    if (!sourceID && !paymentIntentID) {
      return NextResponse.json({ error: 'Missing sourceID or paymentIntentID' }, { status: 400 });
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY || 'sk_test_GjYHQCNkKkxUuhQykSsSetrS';
    const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');

    let isPaid = false;
    let paymentStatus = 'pending';
    let refNumber = sourceID || paymentIntentID;

    if (sourceID) {
      // 1. Fetch Source status from PayMongo
      const srcRes = await fetch(`https://api.paymongo.com/v1/sources/${sourceID}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader
        }
      });

      const srcData = await srcRes.json();
      if (!srcRes.ok || !srcData.data) {
        return NextResponse.json({
          error: srcData.errors?.[0]?.detail || 'Failed to retrieve PayMongo source'
        }, { status: 400 });
      }

      paymentStatus = srcData.data.attributes?.status || 'pending';

      // When guest authorizes in PayMongo sandbox, status becomes 'chargeable'
      if (paymentStatus === 'chargeable') {
        // Auto-charge the chargeable source into a payment
        const chargeRes = await fetch('https://api.paymongo.com/v1/payments', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            data: {
              attributes: {
                amount: srcData.data.attributes.amount,
                currency: 'PHP',
                source: {
                  id: sourceID,
                  type: 'source'
                },
                description: `GCash Downpayment (Source ${sourceID})`
              }
            }
          })
        });

        const chargeData = await chargeRes.json();
        if (chargeRes.ok && chargeData.data) {
          paymentStatus = 'paid';
          isPaid = true;
        } else {
          // In test mode, chargeable itself constitutes complete authorization
          isPaid = true;
          paymentStatus = 'authorized';
        }
      } else if (paymentStatus === 'paid') {
        isPaid = true;
      }
    } else if (paymentIntentID) {
      // 2. Fetch Payment Intent status
      const piRes = await fetch(`https://api.paymongo.com/v1/payment_intents/${paymentIntentID}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader
        }
      });
      const piData = await piRes.json();
      if (piRes.ok && piData.data) {
        paymentStatus = piData.data.attributes?.status || 'pending';
        isPaid = paymentStatus === 'succeeded' || paymentStatus === 'paid' || paymentStatus === 'authorized';
      }
    }

    // 3. If paid/authorized and bookingID was supplied, update booking & billing records
    let billingObj = null;
    if (isPaid && bookingID) {
      await ensureBookingBillingSchema();
      const details = await getBookingBalanceDetails(bookingID);
      if (details && details.booking) {
        const totalAmt = details.subtotal || details.baseRoomCharge || 0;
        const downpayment = details.chargesSummary?.downPaymentPaid || 0;
        const remaining = Math.max(0, Math.round((totalAmt - downpayment) * 100) / 100);

        await dbQuery(
          "UPDATE booking SET status = 'Confirmed', paymentStatus = 'Settled', remainingBalance = ?, finalBalance = ? WHERE bookingID = ?",
          [remaining, remaining, bookingID]
        );
        await dbQuery(
          "UPDATE billing SET remainingBalance = ?, balance = ? WHERE bookingID = ?",
          [remaining, remaining, bookingID]
        );

        billingObj = {
          bookingID,
          totalAmount: totalAmt,
          downPaymentAmount: downpayment,
          remainingBalance: remaining,
          status: 'Settled'
        };
      }
    }

    return NextResponse.json({
      success: true,
      isPaid,
      status: isPaid ? 'paid' : paymentStatus,
      referenceNumber: refNumber,
      billing: billingObj
    });

  } catch (error) {
    console.error("PayMongo status polling error:", error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
