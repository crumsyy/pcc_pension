import { NextResponse } from 'next/server';
import { sendCourtesyHoldCreatedEmail, sendBookingConfirmationEmail } from '@/lib/mailer';

export { sendCourtesyHoldCreatedEmail, sendBookingConfirmationEmail };

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, email, name, details } = body;

    if (!email) {
      return NextResponse.json({ error: 'Recipient email is required.' }, { status: 400 });
    }

    let success = false;
    if (type === 'courtesy_hold') {
      success = await sendCourtesyHoldCreatedEmail(email, name || 'Valued Guest', details);
    } else if (type === 'booking_confirmation') {
      success = await sendBookingConfirmationEmail(email, name || 'Valued Guest', details);
    } else {
      return NextResponse.json({ error: 'Invalid notification type.' }, { status: 400 });
    }

    return NextResponse.json({ success, message: success ? 'Email dispatched successfully.' : 'Failed to send email.' });
  } catch (error) {
    console.error('Notification email API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to dispatch email' }, { status: 500 });
  }
}
