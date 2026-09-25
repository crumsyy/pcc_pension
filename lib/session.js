import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { dbQuery, ensureUserSessionSchema } from './db';

export async function getSessionDetails() {
  const cookieStore = await cookies();
  const token = cookieStore.get('pcc_session')?.value;
  if (!token) return { session: null, reason: 'no_session' };

  try {
    const secret = process.env.JWT_SECRET || 'super_secret_pcc_pension_key_change_me_in_production';
    const decoded = jwt.verify(token, secret);

    try {
      await ensureUserSessionSchema();
      // Verify sessionToken in DB to implement concurrent session protection
      const users = await dbQuery("SELECT sessionToken FROM user WHERE userID = ?", [decoded.userID]);
      if (users.length === 0) {
        return { session: null, reason: 'user_not_found', decoded };
      }
      if (users[0].sessionToken !== decoded.sessionToken) {
        console.log(`Session concurrency mismatch for userID: ${decoded.userID}`);
        return { session: null, reason: 'concurrent_login', decoded };
      }
    } catch (dbErr) {
      console.warn("Database connection issue during session validation. Proceeding with verified JWT:", dbErr.message);
    }

    return { session: decoded, reason: 'valid' };
  } catch (err) {
    console.error("Session verification failed:", err.message);
    return { session: null, reason: 'invalid_token' };
  }
}

export async function getSession() {
  const details = await getSessionDetails();
  return details.session;
}

export async function requireSessionRole(allowedRole) {
  const details = await getSessionDetails();
  
  if (!details.session) {
    if (details.reason === 'concurrent_login') {
      return { redirect: '/auth/login?reason=concurrent' };
    }
    return { redirect: '/auth/login' };
  }

  const { session } = details;

  if (session.role !== allowedRole) {
    // Redirect to their respective dashboard if they have the wrong role
    if (session.role === 'Administrator') {
      return { redirect: '/admin/dashboard' };
    } else if (session.role === 'Receptionist') {
      return { redirect: '/receptionist/dashboard' };
    } else {
      return { redirect: '/guest/dashboard' };
    }
  }

  return { session };
}
