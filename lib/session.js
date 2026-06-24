import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('pcc_session')?.value;
  if (!token) return null;

  try {
    const secret = process.env.JWT_SECRET || 'super_secret_pcc_pension_key_change_me_in_production';
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch (err) {
    console.error("Session verification failed:", err.message);
    return null;
  }
}

export async function requireSessionRole(allowedRole) {
  const session = await getSession();
  
  if (!session) {
    return { redirect: '/auth/login' };
  }

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
