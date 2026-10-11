import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { resetGuestTransactions, resetMasterData, getResetPreview, MASTER_RESET_AREAS } from '@/lib/db';

function authorized(auth, request) {
  const authHeader = request.headers.get('x-admin-reset-key');
  const expectedKey = process.env.ADMIN_RESET_SECRET || 'pcc-suite-reset-2026';
  const hasValidKey = authHeader && authHeader === expectedKey;
  return auth.authorized || hasValidKey;
}

// Live row counts per management area (checklist preview). Never mutates.
export async function GET(request) {
  try {
    const auth = await verifyAdmin();
    if (!authorized(auth, request)) {
      return NextResponse.json({ error: 'Unauthorized: Only Administrators can preview a system reset.' }, { status: 401 });
    }
    const preview = await getResetPreview();
    return NextResponse.json({ success: true, ...preview, areaOrder: Object.keys(MASTER_RESET_AREAS) });
  } catch (error) {
    console.error("Admin reset preview failed:", error);
    return NextResponse.json({ error: 'Preview failed: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await verifyAdmin();
    if (!authorized(auth, request)) {
      return NextResponse.json({ error: 'Unauthorized: Only Administrators can trigger a system reset.' }, { status: 401 });
    }

    const session = auth.session || {};
    const actor = {
      userID: session?.userID || null,
      userName: session?.fullName || 'Administrator',
      userRole: session?.role || 'Administrator'
    };

    let areas = ['transactions'];
    const body = await request.json().catch(() => null);
    if (Array.isArray(body?.areas) && body.areas.length > 0) {
      areas = [...new Set(body.areas)].filter((a) => a === 'transactions' || MASTER_RESET_AREAS[a]);
    }

    const result = { areas };
    if (areas.includes('transactions')) {
      Object.assign(result, await resetGuestTransactions(actor));
    }
    const masterAreas = areas.filter((a) => a !== 'transactions');
    if (masterAreas.length > 0) {
      result.master = await resetMasterData({ areas: masterAreas, ...actor });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Admin transactional reset failed:", error);
    const status = error?.status === 400 ? 400 : 500;
    return NextResponse.json({ error: 'Reset failed: ' + error.message }, { status });
  }
}
