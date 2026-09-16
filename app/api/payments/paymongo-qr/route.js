import { NextResponse } from 'next/server';
import { getQRPhImageURL } from '@/lib/qrph';

export async function POST(request) {
  let parseAmt = 0;
  let fallbackRef = `PCC-${Date.now().toString().slice(-6)}`;
  try {
    const body = await request.json();
    const { amount, description, action, refNumber } = body;
    if (refNumber) fallbackRef = String(refNumber);

    // Simulate payment in PayMongo test mode
    if (action === 'simulate_test_pay') {
      const simRef = body.refNumber || `TEST-${Date.now()}`;
      const amountPaid = parseFloat(body.amount) || 0;
      return NextResponse.json({
        success: true,
        simulated: true,
        testMode: true,
        referenceNumber: simRef,
        amount: amountPaid,
        message: 'Payment simulation successful via PayMongo Test Mode.'
      });
    }

    parseAmt = parseFloat(amount) || 0;
    if (parseAmt <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount.' }, { status: 400 });
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY || 'sk_test_GjYHQCNkKkxUuhQykSsSetrS';

    const amountInCentavos = Math.round(parseAmt * 100);
    const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');

    // Step 1: Create PayMongo Payment Intent
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
            payment_method_allowed: ['gcash', 'qrph'],
            description: description || 'PCC Suite Room Downpayment (GCash Test Mode)'
          }
        }
      })
    });

    const piData = await piRes.json();
    if (!piRes.ok || !piData.data?.id) {
      console.warn("PayMongo Intent creation non-OK, using QRPh fallback:", piData);
      const fallbackUrl = getQRPhImageURL({
        amount: parseAmt,
        reference: fallbackRef,
        merchantName: 'PCC HOME SUITE HOME'
      });
      return NextResponse.json({
        success: true,
        paymongoQrUrl: fallbackUrl,
        paymongoQrRaw: null,
        paymentIntentID: `pi_test_${Date.now()}`,
        amount: parseAmt,
        isTestMode: true,
        isFallback: true
      });
    }

    const paymentIntentID = piData.data.id;
    const clientKey = piData.data.attributes.client_key;

    // Step 2: Create PayMongo Payment Method for QRPh
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
            type: 'qrph',
            billing: {
              name: body.billingName || 'PCC Guest User',
              email: body.billingEmail || 'guest@example.com',
              phone: '09171234567'
            }
          }
        }
      })
    });

    const pmData = await pmRes.json();
    if (!pmRes.ok || !pmData.data?.id) {
      console.warn("PayMongo Method creation non-OK, using QRPh fallback:", pmData);
      const fallbackUrl = getQRPhImageURL({
        amount: parseAmt,
        reference: fallbackRef,
        merchantName: 'PCC HOME SUITE HOME'
      });
      return NextResponse.json({
        success: true,
        paymongoQrUrl: fallbackUrl,
        paymongoQrRaw: null,
        paymentIntentID,
        amount: parseAmt,
        isTestMode: true,
        isFallback: true
      });
    }

    const paymentMethodID = pmData.data.id;

    // Step 3: Attach Payment Method to Payment Intent
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';

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
            payment_method: paymentMethodID,
            client_key: clientKey,
            return_url: `${protocol}://${host}/guest/dashboard?payment=success`
          }
        }
      })
    });

    const attachData = await attachRes.json();
    const nextAction = attachData.data?.attributes?.next_action || {};
    
    // Check both qr_code and code properties from PayMongo response
    let paymongoQrUrl = nextAction.qr_code?.image_url || nextAction.code?.image_url || null;
    const paymongoQrRaw = nextAction.qr_code?.qr_code || nextAction.code?.qr_code || null;

    if (!paymongoQrUrl && paymongoQrRaw) {
      paymongoQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(paymongoQrRaw)}`;
    }

    if (!paymongoQrUrl) {
      // Generate Dynamic QRPh image URL as dependable fallback
      paymongoQrUrl = getQRPhImageURL({
        amount: parseAmt,
        reference: fallbackRef,
        merchantName: 'PCC HOME SUITE HOME'
      });
    }

    console.log("PayMongo Official QRPh Ready:", {
      paymentIntentID,
      paymongoQrUrl: paymongoQrUrl ? 'Available' : 'Missing',
      hasRawQr: !!paymongoQrRaw
    });

    return NextResponse.json({
      success: true,
      paymongoQrUrl,
      paymongoQrRaw,
      paymentIntentID,
      amount: parseAmt,
      isTestMode: process.env.PAYMONGO_TEST_MODE !== 'false'
    });

  } catch (error) {
    console.error("PayMongo QRPh route error, generating fallback:", error);
    if (parseAmt > 0) {
      const fallbackUrl = getQRPhImageURL({
        amount: parseAmt,
        reference: fallbackRef,
        merchantName: 'PCC HOME SUITE HOME'
      });
      return NextResponse.json({
        success: true,
        paymongoQrUrl: fallbackUrl,
        paymongoQrRaw: null,
        paymentIntentID: `pi_err_fb_${Date.now()}`,
        amount: parseAmt,
        isTestMode: true,
        isFallback: true
      });
    }
    return NextResponse.json({ error: 'Internal Server Error: ' + error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentIntentID = searchParams.get('paymentIntentID');

    if (!paymentIntentID) {
      return NextResponse.json({ error: 'Missing paymentIntentID' }, { status: 400 });
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY || 'sk_test_GjYHQCNkKkxUuhQykSsSetrS';
    const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');

    const res = await fetch(`https://api.paymongo.com/v1/payment_intents/${paymentIntentID}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader
      }
    });

    const data = await res.json();
    if (!res.ok || !data.data) {
      return NextResponse.json({ error: data.errors?.[0]?.detail || 'Failed to check status' }, { status: 400 });
    }

    const status = data.data.attributes?.status;
    const isPaid = status === 'succeeded';

    return NextResponse.json({
      success: true,
      status,
      isPaid,
      paymentIntentID
    });
  } catch (error) {
    console.error("PayMongo status check error:", error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

