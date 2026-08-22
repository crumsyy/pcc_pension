import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { amount, refNumber } = body;

    const parseAmt = parseFloat(amount) || 0;
    if (parseAmt <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'PayMongo secret key is not configured.' }, { status: 500 });
    }

    const amountInCentavos = Math.round(parseAmt * 100);
    const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');

    // Call PayMongo API to create a QR Ph source
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
            type: 'qrph',
            redirect: {
              success: 'https://paymongo.com',
              failed: 'https://paymongo.com'
            }
          }
        }
      })
    });

    const pmData = await pmRes.json();

    if (pmRes.ok && pmData.data) {
      const attributes = pmData.data.attributes || {};
      const paymongoQrUrl = attributes.image_url || null;
      return NextResponse.json({
        success: true,
        paymongoQrUrl,
        sourceID: pmData.data.id
      });
    }

    return NextResponse.json({
      success: false,
      error: pmData.errors?.[0]?.detail || 'Could not fetch PayMongo QR'
    });

  } catch (error) {
    console.error("PayMongo QR generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
