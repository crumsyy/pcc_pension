import { NextResponse } from 'next/server';
import { dbQuery, ensureTestModeSchema } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('paymongo-signature') || '';
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET || 'whsk_ueV7cmWcMZyBvMWn7GoYuHj5';

    // Signature Verification (if header present and secret configured)
    if (signatureHeader && webhookSecret) {
      const parts = signatureHeader.split(',');
      let timestamp = '';
      let testSignature = '';
      let liveSignature = '';

      for (const part of parts) {
        const [key, value] = part.split('=');
        if (key.trim() === 't') timestamp = value.trim();
        if (key.trim() === 'te') testSignature = value.trim();
        if (key.trim() === 'li') liveSignature = value.trim();
      }

      const signatureToVerify = testSignature || liveSignature;
      if (timestamp && signatureToVerify) {
        const payloadToSign = `${timestamp}.${rawBody}`;
        const computedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(payloadToSign)
          .digest('hex');

        if (computedSignature !== signatureToVerify) {
          console.warn("PayMongo Webhook Signature mismatch. Processing in fallback mode.");
        }
      }
    }

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

    const secretKey = process.env.PAYMONGO_SECRET_KEY || 'sk_test_GjYHQCNkKkxUuhQykSsSetrS';

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

      console.log(`PayMongo GCash Payment Paid: ${paymentID} - ₱${amountInPesos}`);

      await ensureTestModeSchema();

      // Extract booking ID if present in description e.g. "Booking #BK00001" or "BK00001"
      let bookingIDMatch = description.match(/BK(\d+)/i);
      let targetBookingID = bookingIDMatch ? parseInt(bookingIDMatch[1]) : null;

      if (targetBookingID) {
        // Auto-update booking status to Paid / Confirmed
        await dbQuery(
          "UPDATE booking SET status = CASE WHEN status = 'Pending Check-in' THEN 'Pending Check-in' ELSE 'Confirmed' END WHERE bookingID = ?",
          [targetBookingID]
        );
      }

      // Auto-notify Administrators & Receptionists
      const staffToNotify = await dbQuery("SELECT userID FROM user WHERE roleID IN (1, 2) AND status = 'Active'");
      for (const st of staffToNotify) {
        await dbQuery(
          "INSERT INTO notification (userID, title, message) VALUES (?, 'PayMongo GCash Test Payment Received', ?)",
          [st.userID, `Online GCash/QRPh Payment of ₱${amountInPesos.toFixed(2)} received (Test Mode = 1).`]
        );
      }
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error) {
    console.error("PayMongo Webhook Error:", error);
    return NextResponse.json({ error: 'Internal Server Error: ' + error.message }, { status: 500 });
  }
}
