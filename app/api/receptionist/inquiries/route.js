import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, ensureInquirySchema } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureInquirySchema();
    const { searchParams } = new URL(request.url);
    const selectedID = searchParams.get('inquiryID') ? parseInt(searchParams.get('inquiryID')) : null;

    // Fetch all inquiries ordered by latest message / creation date
    const inquiries = await dbQuery(`
      SELECT i.*, 
             (SELECT message FROM inquiry_message im WHERE im.inquiryID = i.inquiryID ORDER BY im.timestamp DESC LIMIT 1) as lastMessage,
             (SELECT timestamp FROM inquiry_message im WHERE im.inquiryID = i.inquiryID ORDER BY im.timestamp DESC LIMIT 1) as lastMessageTime
      FROM inquiry i
      ORDER BY COALESCE(lastMessageTime, i.createdAt) DESC
    `);

    let selectedMessages = [];

    if (selectedID) {
      // Mark unread for receptionist as 0 when thread is opened
      await dbQuery("UPDATE inquiry SET unreadReceptionist = 0 WHERE inquiryID = ?", [selectedID]);
      await dbQuery("UPDATE inquiry_message SET isRead = 1 WHERE inquiryID = ? AND senderType = 'Guest'", [selectedID]);

      selectedMessages = await dbQuery(
        "SELECT * FROM inquiry_message WHERE inquiryID = ? ORDER BY timestamp ASC",
        [selectedID]
      );
    }

    return NextResponse.json({ success: true, inquiries, selectedMessages, inquiryID: selectedID });
  } catch (error) {
    console.error("Failed to fetch receptionist inquiries:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureInquirySchema();
    const body = await request.json();
    const { action } = body;

    const localNow = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

    // Get staff name
    const staffRes = await dbQuery("SELECT firstName, lastName FROM staff WHERE userID = ?", [session.userID]);
    const staffName = staffRes.length > 0 ? `${staffRes[0].firstName} ${staffRes[0].lastName}` : 'Front Desk Staff';

    if (action === 'reach_out') {
      const { guestName, email, contactNumber, message, guestID } = body;
      if (!guestName || !message) {
        return NextResponse.json({ error: 'Guest name and message content are required.' }, { status: 400 });
      }

      // Create new inquiry record
      const inqRes = await dbQuery(
        `INSERT INTO inquiry (guestID, name, email, contactNumber, subject, message, status, unreadGuest, unreadReceptionist, createdAt)
         VALUES (?, ?, ?, ?, 'Direct Staff Reach-Out', ?, 'Responded', 1, 0, ?)`,
        [guestID || null, guestName, email || null, contactNumber || null, message, nowStr]
      );
      const newInquiryID = inqRes.insertId;

      // Insert first message
      await dbQuery(
        `INSERT INTO inquiry_message (inquiryID, senderType, senderName, message, isRead, timestamp)
         VALUES (?, 'Receptionist', ?, ?, 1, ?)`,
        [newInquiryID, staffName, message, nowStr]
      );

      return NextResponse.json({
        success: true,
        message: 'Direct reach-out message sent to guest successfully.',
        inquiryID: newInquiryID
      });
    }

    if (action === 'respond') {
      const inquiryID = parseInt(body.inquiryID);
      const response = body.response?.trim();

      if (!inquiryID || !response) {
        return NextResponse.json({ error: 'Missing inquiry ID or response content.' }, { status: 400 });
      }

      // Insert message into inquiry_message thread
      await dbQuery(
        `INSERT INTO inquiry_message (inquiryID, senderType, senderName, message, isRead, timestamp)
         VALUES (?, 'Receptionist', ?, ?, 1, ?)`,
        [inquiryID, staffName, response, nowStr]
      );

      // Update inquiry status to Responded and increment unreadGuest
      await dbQuery(
        `UPDATE inquiry 
         SET status = 'Responded', response = ?, unreadReceptionist = 0, unreadGuest = unreadGuest + 1 
         WHERE inquiryID = ?`,
        [response, inquiryID]
      );

      const messages = await dbQuery(
        "SELECT * FROM inquiry_message WHERE inquiryID = ? ORDER BY timestamp ASC",
        [inquiryID]
      );

      return NextResponse.json({ success: true, message: 'Response sent successfully.', messages });
    }

    if (action === 'update_status') {
      const inquiryID = parseInt(body.inquiryID);
      const status = body.status; // 'Pending', 'Responded', 'Closed'

      if (!inquiryID || !status) {
        return NextResponse.json({ error: 'Missing inquiry ID or status.' }, { status: 400 });
      }

      await dbQuery("UPDATE inquiry SET status = ? WHERE inquiryID = ?", [status, inquiryID]);

      if (status === 'Closed') {
        await dbQuery(
          `INSERT INTO inquiry_message (inquiryID, senderType, senderName, message, isRead, timestamp)
           VALUES (?, 'System', 'System', 'Conversation closed by Receptionist.', 1, ?)`,
          [inquiryID, nowStr]
        );
      }

      return NextResponse.json({ success: true, message: `Status updated to ${status}.` });
    }

    if (action === 'mark_read') {
      const inquiryID = parseInt(body.inquiryID);
      if (inquiryID) {
        await dbQuery("UPDATE inquiry SET unreadReceptionist = 0 WHERE inquiryID = ?", [inquiryID]);
        await dbQuery("UPDATE inquiry_message SET isRead = 1 WHERE inquiryID = ? AND senderType = 'Guest'", [inquiryID]);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process inquiry action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
