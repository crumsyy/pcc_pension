import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getBookingBalanceDetails } from '@/lib/db';
import { getQRPhImageURL } from '@/lib/qrph';

export async function GET(request) {
  const session = await getSession();
  if (!session || !['Guest', 'Receptionist', 'Administrator'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sourceID = searchParams.get('sourceID') || searchParams.get('sourceId');
  const bookingID = parseInt(searchParams.get('bookingID'), 10);

  if (!sourceID) {
    return NextResponse.json({ error: 'Source ID is required.' }, { status: 400 });
  }

  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY || 'sk_test_GjYHQCNkKkxUuhQykSsSetrS';
    const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');

    // Handle Payment Intent (official PayMongo dynamic QRPh)
    if (sourceID.startsWith('pi_')) {
      const pmRes = await fetch(`https://api.paymongo.com/v1/payment_intents/${sourceID}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader
        }
      });

      const pmData = await pmRes.json();
      if (!pmRes.ok || !pmData.data) {
        const errMsg = pmData.errors?.[0]?.detail || 'Failed to retrieve PayMongo payment intent.';
        return NextResponse.json({ error: errMsg }, { status: 400 });
      }

      const pi = pmData.data;
      const rawStatus = pi.attributes?.status; // 'awaiting_next_action', 'succeeded', 'processing', 'cancelled'
      const isPaid = rawStatus === 'succeeded' || rawStatus === 'paid';

      let billingDetails = null;
      if (bookingID) {
        billingDetails = await getBookingBalanceDetails(bookingID);
      }

      return NextResponse.json({
        success: true,
        sourceID,
        status: isPaid ? 'paid' : rawStatus,
        rawStatus,
        isPaid,
        referenceNumber: sourceID,
        amount: pi.attributes?.amount ? pi.attributes.amount / 100 : null,
        billing: billingDetails
      });
    }

    // Fallback: Legacy Source polling
    const pmRes = await fetch(`https://api.paymongo.com/v1/sources/${sourceID}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader
      }
    });

    const pmData = await pmRes.json();
    if (!pmRes.ok || !pmData.data) {
      const errMsg = pmData.errors?.[0]?.detail || 'Failed to retrieve PayMongo source.';
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    const source = pmData.data;
    const rawStatus = source.attributes?.status; // 'pending', 'chargeable', 'cancelled', 'expired', 'paid'
    const isPaidOrAuthorized = rawStatus === 'chargeable' || rawStatus === 'paid';

    let billingDetails = null;
    if (bookingID) {
      billingDetails = await getBookingBalanceDetails(bookingID);
    }

    return NextResponse.json({
      success: true,
      sourceID,
      status: isPaidOrAuthorized ? 'paid' : rawStatus,
      rawStatus,
      isPaid: isPaidOrAuthorized,
      referenceNumber: sourceID,
      amount: source.attributes?.amount ? source.attributes.amount / 100 : null,
      billing: billingDetails
    });
  } catch (error) {
    console.error("PayMongo status polling error:", error);
    return NextResponse.json({ error: 'Failed to poll PayMongo status: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { amount, reservationID, bookingID, description } = body;

    const parseAmt = parseFloat(amount);
    if (isNaN(parseAmt) || parseAmt <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount.' }, { status: 400 });
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY || 'sk_test_GjYHQCNkKkxUuhQykSsSetrS';
    const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
    const amountInCentavos = Math.round(parseAmt * 100);

    // Host URL calculation
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    let officialQrUrl = null;
    let testCheckoutUrl = null;
    let paymentIntentID = null;

    try {
      // Step 1: Create Payment Intent configured for QRPh
      const piRes = await fetch('https://api.paymongo.com/v1/payment_intents', {
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
              payment_method_allowed: ['qrph'],
              description: description || `PCC Online Down Payment (₱${parseAmt.toFixed(2)})`
            }
          }
        })
      });

      const piData = await piRes.json();

      if (piRes.ok && piData.data?.id) {
        paymentIntentID = piData.data.id;

        // Step 2: Create Payment Method of type 'qrph'
        const pmRes = await fetch('https://api.paymongo.com/v1/payment_methods', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            data: {
              attributes: {
                type: 'qrph'
              }
            }
          })
        });

        const pmData = await pmRes.json();

        if (pmRes.ok && pmData.data?.id) {
          // Step 3: Attach Payment Method to Payment Intent
          const attachRes = await fetch(`https://api.paymongo.com/v1/payment_intents/${paymentIntentID}/attach`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              data: {
                attributes: {
                  payment_method: pmData.data.id,
                  client_key: piData.data.attributes.client_key,
                  return_url: `${baseUrl}/guest/dashboard?payment=success&reservationID=${reservationID || ''}&bookingID=${bookingID || ''}`
                }
              }
            })
          });

          const attachData = await attachRes.json();
          const nextAction = attachData.data?.attributes?.next_action || {};

          // Official PayMongo dynamic QRPh PNG image (data:image/png;base64,...)
          officialQrUrl = nextAction.code?.image_url || nextAction.qr_code?.image_url || null;
          // Official PayMongo test simulation URL
          testCheckoutUrl = nextAction.code?.test_url || nextAction.code?.url || nextAction.qr_code?.url || null;
        }
      }
    } catch (pmErr) {
      console.error("PayMongo official QRPh initiation error:", pmErr);
    }

    // Fallback: If PayMongo API failed or did not return dynamic QR image,
    // generate valid EMVCo National QRPh standard payload (never an unparseable HTTP URL)
    const finalSourceID = paymentIntentID || `pi_dyn_${Date.now()}`;
    const finalQrCodeUrl = officialQrUrl || getQRPhImageURL({
      amount: parseAmt,
      reference: finalSourceID,
      merchantName: 'PCC HOME SUITE HOME'
    });
    const finalCheckoutUrl = testCheckoutUrl || `${baseUrl}/paymongo/test?amount=${parseAmt}&bookingID=${bookingID || ''}`;

    return NextResponse.json({
      success: true,
      checkoutUrl: finalCheckoutUrl,
      qrCodeUrl: finalQrCodeUrl,
      sourceID: finalSourceID,
      amount: parseAmt,
      status: 'awaiting_payment'
    });

  } catch (error) {
    console.error("PayMongo QRPh checkout failed:", error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
