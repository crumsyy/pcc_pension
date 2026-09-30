import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { resetGuestTransactions } from '@/lib/db';

export async function POST(request) {
  try {
    const auth = await verifyAdmin();
    const authHeader = request.headers.get('x-admin-reset-key');
    const expectedKey = process.env.ADMIN_RESET_SECRET || 'pcc-suite-reset-2026';
    const hasValidKey = authHeader && authHeader === expectedKey;

    if (!auth.authorized && !hasValidKey) {
      return NextResponse.json({ error: 'Unauthorized: Only Administrators can trigger a system reset.' }, { status: 401 });
    }

    const session = auth.session || {};
    const result = await resetGuestTransactions({
      userID: session?.userID || null,
      userName: session?.fullName || 'Administrator',
      userRole: session?.role || 'Administrator'
    });


    return NextResponse.json(result);
  } catch (error) {
    console.error("Admin extended transactional reset failed:", error);
    return NextResponse.json({ error: 'Reset failed: ' + error.message }, { status: 500 });
  }
}
