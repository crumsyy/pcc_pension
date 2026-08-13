import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { redirect } from 'next/navigation';
import { dbQuery } from './db';

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('pcc_session')?.value;
  if (!token) return null;

  try {
    const secret = process.env.JWT_SECRET || 'super_secret_pcc_pension_key_change_me_in_production';
    const decoded = jwt.verify(token, secret);

    try {
      // Verify sessionToken in DB to implement concurrent session protection
      const users = await dbQuery("SELECT sessionToken FROM user WHERE userID = ?", [decoded.userID]);
      if (users.length === 0 || users[0].sessionToken !== decoded.sessionToken) {
        console.log(`Session concurrency mismatch or user not found for userID: ${decoded.userID}`);
        return null;
      }
    } catch (dbErr) {
      console.warn("Database connection issue during session validation. Proceeding with verified JWT:", dbErr.message);
    }

    return decoded;
  } catch (err) {
    console.error("Session verification failed:", err.message);
    return null;
  }
}

export async function requireSessionRole(allowedRole) {
  const session = await getSession();
  
  if (!session) {
    redirect('/auth/login');
  }

  if (session.role !== allowedRole) {
    // Redirect to their respective dashboard if they have the wrong role
    if (session.role === 'Administrator') {
      redirect('/admin/dashboard');
    } else if (session.role === 'Receptionist') {
      redirect('/receptionist/dashboard');
    } else {
      redirect('/guest/dashboard');
    }
  }

  return { session };
}
