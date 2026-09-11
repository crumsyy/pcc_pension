import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

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

    // Get guest details
    const guests = await dbQuery("SELECT guestID, firstName, lastName, contact, email FROM guest WHERE userID = ?", [session.userID]);
    const guest = guests[0] || {};
    let guestName = (body.billingName || `${guest.firstName || ''} ${guest.lastName || ''}`).trim();
    if (!guestName) {
      guestName = (session.fullName || session.email || 'Guest User').trim();
    }
    if (!guestName) {
      return NextResponse.json({ error: 'Billing name is required for PayMongo payments.' }, { status: 400 });
    }

    const guestEmail = guest.email || session?.email || 'guest@example.com';
    let guestPhone = (guest.contact || body.phone || '09171234567').replace(/\D/g, '');
    if (guestPhone.length !== 11) guestPhone = '09171234567';

    // Host URL calculation
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const amountInCentavos = Math.round(parseAmt * 100);

    // Call PayMongo API to create GCash Source
    const authHeader = 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
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
              success: `${baseUrl}/guest/dashboard?payment=success&reservationID=${reservationID || ''}&bookingID=${bookingID || ''}`,
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

    return NextResponse.json({
      success: true,
      checkoutUrl,
      sourceID,
      amount: parseAmt
    });

  } catch (error) {
    console.error("PayMongo GCash initiation failed:", error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
