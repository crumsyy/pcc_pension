import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { dbQuery } from '@/lib/db';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('pcc_session')?.value;
    if (token) {
      const secret = process.env.JWT_SECRET || 'super_secret_pcc_pension_key_change_me_in_production';
      const decoded = jwt.verify(token, secret);
      // Clear the session token in the database
      await dbQuery("UPDATE user SET sessionToken = NULL WHERE userID = ?", [decoded.userID]);
    }
  } catch (err) {
    // Session token might be already expired or malformed, continue with clearing cookie
  }

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

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('pcc_session')?.value;
    if (token) {
      const secret = process.env.JWT_SECRET || 'super_secret_pcc_pension_key_change_me_in_production';
      const decoded = jwt.verify(token, secret);
      // Clear the session token in the database
      await dbQuery("UPDATE user SET sessionToken = NULL WHERE userID = ?", [decoded.userID]);
    }
  } catch (err) {
    // Session already expired, continue
  }

  // Redirect to login page
  const response = NextResponse.redirect(new URL('/auth/login', request.url));

  // Clear cookie
  response.cookies.set('pcc_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  });

  return response;
}
