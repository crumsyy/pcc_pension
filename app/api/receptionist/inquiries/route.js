import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const inquiries = await dbQuery("SELECT * FROM inquiry ORDER BY createdAt DESC");
    return NextResponse.json({ success: true, inquiries });
  } catch (error) {
    console.error("Failed to fetch inquiries:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'respond') {
      const inquiryID = parseInt(body.inquiryID);
      const response = body.response;

      if (!inquiryID || !response || !response.trim()) {
        return NextResponse.json({ error: 'Missing inquiry ID or response content.' }, { status: 400 });
      }

      await dbQuery(
        "UPDATE inquiry SET status = 'Responded', response = ? WHERE inquiryID = ?",
        [response.trim(), inquiryID]
      );

      return NextResponse.json({ success: true, message: 'Response submitted successfully.' });
    }

    if (action === 'update_status') {
      const inquiryID = parseInt(body.inquiryID);
      const status = body.status; // 'Pending' or 'Responded'

      if (!inquiryID || !status) {
        return NextResponse.json({ error: 'Missing inquiry ID or status.' }, { status: 400 });
      }

      await dbQuery(
        "UPDATE inquiry SET status = ? WHERE inquiryID = ?",
        [status, inquiryID]
      );

      return NextResponse.json({ success: true, message: 'Status updated successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process inquiry action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
