import { NextResponse } from 'next/server';
import { POST as bookingsPost } from '../bookings/route';

export async function POST(request) {
  try {
    const body = await request.json();
    const newRequest = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ ...body, action: 'checkin' })
    });
    return await bookingsPost(newRequest);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
