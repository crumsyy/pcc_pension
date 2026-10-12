import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { dbQuery, invalidateVatRateCache } from '@/lib/db';

export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) return auth.response;
  try {
    const rows = await dbQuery(
      'SELECT settingKey, settingValue, updatedBy, updatedAt FROM system_settings WHERE settingKey = ? LIMIT 1',
      ['vat_percentage']
    );
    const row = rows?.[0] || null;
    return NextResponse.json({
      success: true,
      vatPercentage: row ? parseFloat(row.settingValue) || 0 : 0,
      updatedBy: row?.updatedBy || null,
      updatedAt: row?.updatedAt || null
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load VAT settings.' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await verifyAdmin();
  if (!auth.authorized) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const pct = parseFloat(body.vatPercentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return NextResponse.json({ error: 'VAT percentage must be a number between 0 and 100.' }, { status: 400 });
    }
    const rounded = Math.round(pct * 100) / 100;
    const userName = auth.session?.fullName || auth.session?.email || 'Admin';
    await dbQuery(
      `INSERT INTO system_settings (settingKey, settingValue, updatedBy)
       VALUES ('vat_percentage', ?, ?)
       ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue), updatedBy = VALUES(updatedBy)`,
      [String(rounded), String(userName).substring(0, 150)]
    );
    invalidateVatRateCache();
    return NextResponse.json({ success: true, vatPercentage: rounded, message: `VAT rate updated to ${rounded}%. Applies to new computations; settled bills are unchanged.` });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to save VAT settings.' }, { status: 500 });
  }
}
