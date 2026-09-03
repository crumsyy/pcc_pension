import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { amount, description } = body;

    const parseAmt = parseFloat(amount) || 0;
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
            payment_method_allowed: ['qrph'],
            description: description || 'PCC Suite Room Downpayment'
          }
        }
      })
    });

    const piData = await piRes.json();
    if (!piRes.ok || !piData.data?.id) {
      const err = piData.errors?.[0]?.detail || 'Failed to create PayMongo Payment Intent';
      return NextResponse.json({ error: err }, { status: 400 });
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
              email: 'guest@example.com'
            }
          }
        }
      })
    });

    const pmData = await pmRes.json();
    if (!pmRes.ok || !pmData.data?.id) {
      const err = pmData.errors?.[0]?.detail || 'Failed to create PayMongo QRPh Payment Method';
      return NextResponse.json({ error: err }, { status: 400 });
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
    if (!attachRes.ok || !attachData.data) {
      const err = attachData.errors?.[0]?.detail || 'Failed to attach PayMongo QRPh payment method';
      return NextResponse.json({ error: err }, { status: 400 });
    }

    // Extract official PayMongo QRPh image URL & raw QR code returned by PayMongo
    const nextAction = attachData.data.attributes?.next_action || {};
    const paymongoQrUrl = nextAction.code?.image_url || null;
    const paymongoQrRaw = nextAction.code?.qr_code || null;

    console.log("PayMongo Official QRPh Created:", {
      paymentIntentID,
      paymongoQrUrl,
      hasRawQr: !!paymongoQrRaw
    });

    return NextResponse.json({
      success: true,
      paymongoQrUrl,
      paymongoQrRaw,
      paymentIntentID,
      amount: parseAmt
    });

  } catch (error) {
    console.error("PayMongo QRPh route error:", error);
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

