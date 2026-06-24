import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully."
  });

  // Clear cookie by setting maxAge to 0
  response.cookies.set('pcc_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  });

  return response;
}
export async function GET() {
  // Support both GET and POST for logout simplicity
  return POST();
}
