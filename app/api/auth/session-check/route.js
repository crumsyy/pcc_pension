import { NextResponse } from 'next/server';
import { getSessionDetails } from '@/lib/session';

export async function GET() {
  const details = await getSessionDetails();

  if (!details.session) {
    const isConcurrent = details.reason === 'concurrent_login';
    const response = NextResponse.json({
      valid: false,
      reason: details.reason || 'unauthorized',
      message: isConcurrent
        ? 'Your account was logged in on another device or browser.'
        : 'Session expired or invalid.'
    }, { status: isConcurrent ? 401 : 200 });

    if (isConcurrent) {
      // Clear cookie immediately on concurrent logout detection
      response.cookies.set('pcc_session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/'
      });
    }

    return response;
  }

  return NextResponse.json({ valid: true, session: details.session });
}
