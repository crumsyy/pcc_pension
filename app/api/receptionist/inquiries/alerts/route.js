import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, ensureInquirySchema } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureInquirySchema();
    const rows = await dbQuery(`
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN unreadReceptionist > 0 THEN unreadReceptionist
            WHEN status = 'Pending' THEN 1
            ELSE 0 
          END
        ), 0) as alertsCount
      FROM inquiry
      WHERE status != 'Closed'
    `);

    const alertsCount = rows.length > 0 ? parseInt(rows[0].alertsCount || 0) : 0;
    return NextResponse.json({ success: true, alertsCount });
  } catch (error) {
    console.error("Failed to fetch inquiries alerts count:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message, alertsCount: 0 }, { status: 500 });
  }
}
