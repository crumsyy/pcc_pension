import { NextResponse } from 'next/server';
import { getDbConnection, dbQuery } from '@/lib/db';

export async function POST(request) {
  try {
    const rawBody = await request.text();
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const event = payload?.data;
    if (!event) {
      return NextResponse.json({ error: 'Missing event data' }, { status: 400 });
    }

    const eventType = event.attributes?.type;
    const eventData = event.attributes?.data;

    console.log(`PayMongo Webhook Received Event: ${eventType}`, eventData?.id);

    const secretKey = process.env.PAYMONGO_SECRET_KEY;

    // Handle source.chargeable event (GCash Payment Authorized by Guest)
    if (eventType === 'source.chargeable' && eventData && secretKey) {
      const sourceID = eventData.id;
      const amountInCentavos = eventData.attributes?.amount;
      const currency = eventData.attributes?.currency || 'PHP';
      const amountInPesos = amountInCentavos ? amountInCentavos / 100 : 0;

      // Charge the source using PayMongo Payments API
      const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
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
              amount: amountInCentavos,
              currency,
              source: {
                id: sourceID,
                type: 'source'
              },
              description: `GCash Payment via PayMongo (${sourceID})`
            }
          }
        })
      });

      const chargeData = await chargeRes.json();
      console.log("PayMongo Charge Result:", chargeData);
    }

    // Handle payment.paid event (Payment Successfully Charged)
    if (eventType === 'payment.paid' && eventData) {
      const paymentID = eventData.id;
      const amountInCentavos = eventData.attributes?.amount;
      const amountInPesos = amountInCentavos ? amountInCentavos / 100 : 0;
      const description = eventData.attributes?.description || '';

      console.log(`PayMongo Payment Paid: ${paymentID} - ₱${amountInPesos}`);

      // Auto-notify Administrators
      const admins = await dbQuery("SELECT userID FROM user WHERE roleID = 1 AND status = 'Active'");
      for (const adm of admins) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'PayMongo Payment Received', ?)",
          [adm.userID, `Online GCash Payment of ₱${amountInPesos.toFixed(2)} received via PayMongo.`]
        );
      }
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error) {
    console.error("PayMongo Webhook Error:", error);
    return NextResponse.json({ error: 'Internal Server Error: ' + error.message }, { status: 500 });
  }
}
