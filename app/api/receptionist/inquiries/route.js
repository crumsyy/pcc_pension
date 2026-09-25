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
    const action = searchParams.get('action');

    if (action === 'guests') {
      const guests = await dbQuery(
        "SELECT guestID, userID, firstName, lastName, contact, email FROM guest ORDER BY lastName, firstName"
      );
      return NextResponse.json({ success: true, guests });
    }

    const selectedID = searchParams.get('inquiryID') ? parseInt(searchParams.get('inquiryID')) : null;

    // Fetch all inquiries and selected thread messages in parallel
    const [inquiries, selectedMessages] = await Promise.all([
      dbQuery(`
        SELECT i.*, 
               (SELECT message FROM inquiry_message im WHERE im.inquiryID = i.inquiryID ORDER BY im.timestamp DESC LIMIT 1) as lastMessage,
               (SELECT timestamp FROM inquiry_message im WHERE im.inquiryID = i.inquiryID ORDER BY im.timestamp DESC LIMIT 1) as lastMessageTime
        FROM inquiry i
        ORDER BY COALESCE(lastMessageTime, i.createdAt) DESC
      `),
      selectedID
        ? dbQuery(
            `SELECT messageID, inquiryID, 
                    COALESCE(senderRole, LOWER(senderType)) as senderRole,
                    COALESCE(senderType, 'Guest') as senderType,
                    senderID, senderName, 
                    COALESCE(messageText, message) as messageText,
                    COALESCE(message, messageText) as message,
                    COALESCE(status, 'Delivered') as status,
                    isRead, createdAt, readAt, timestamp 
             FROM inquiry_message 
             WHERE inquiryID = ? 
             ORDER BY createdAt ASC, timestamp ASC, messageID ASC`,
            [selectedID]
          )
        : Promise.resolve([])
    ]);

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

    // Get staff name and ID
    const staffRes = await dbQuery("SELECT staffID, firstName, lastName FROM staff WHERE userID = ?", [session.userID]);
    const staffName = staffRes.length > 0 ? `${staffRes[0].firstName} ${staffRes[0].lastName}` : 'Front Desk Staff';
    const staffID = staffRes.length > 0 ? staffRes[0].staffID : (session.userID || 0);

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

      // Insert first message defaulting to 'Delivered'
      await dbQuery(
        `INSERT INTO inquiry_message (inquiryID, senderRole, senderType, senderID, senderName, messageText, message, status, isRead, createdAt, timestamp)
         VALUES (?, 'receptionist', 'Receptionist', ?, ?, ?, ?, 'Delivered', 0, NOW(), NOW())`,
        [newInquiryID, staffID, staffName, message, message]
      );

      // Dispatch in-app notification to the guest if guestID is available
      if (guestID) {
        try {
          const gRows = await dbQuery("SELECT userID FROM guest WHERE guestID = ?", [guestID]);
          if (gRows.length > 0 && gRows[0].userID) {
            await dbQuery(
              "INSERT INTO notification (userID, title, message) VALUES (?, 'New Message from Front Desk', ?)",
              [gRows[0].userID, `The front desk sent you a message: "${message.length > 80 ? message.substring(0, 80) + '...' : message}"`]
            );
          }
        } catch (notifErr) {
          console.error("Failed to send in-app notification to reached out guest:", notifErr);
        }
      }

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

      // Insert message into inquiry_message thread defaulting to 'Delivered'
      await dbQuery(
        `INSERT INTO inquiry_message (inquiryID, senderRole, senderType, senderID, senderName, messageText, message, status, isRead, createdAt, timestamp)
         VALUES (?, 'receptionist', 'Receptionist', ?, ?, ?, ?, 'Delivered', 0, NOW(), NOW())`,
        [inquiryID, staffID, staffName, response, response]
      );

      // Update inquiry status to Responded and increment unreadGuest
      await dbQuery(
        `UPDATE inquiry 
         SET status = 'Responded', response = ?, unreadReceptionist = 0, unreadGuest = unreadGuest + 1 
         WHERE inquiryID = ?`,
        [response, inquiryID]
      );

      const messages = await dbQuery(
        `SELECT messageID, inquiryID, 
                COALESCE(senderRole, LOWER(senderType)) as senderRole,
                COALESCE(senderType, 'Guest') as senderType,
                senderID, senderName, 
                COALESCE(messageText, message) as messageText,
                COALESCE(message, messageText) as message,
                COALESCE(status, 'Delivered') as status,
                isRead, createdAt, readAt, timestamp 
         FROM inquiry_message 
         WHERE inquiryID = ? 
         ORDER BY createdAt ASC, timestamp ASC, messageID ASC`,
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
          `INSERT INTO inquiry_message (inquiryID, senderRole, senderType, senderID, senderName, messageText, message, status, isRead, createdAt, timestamp)
           VALUES (?, 'bot', 'System', 0, 'System', 'Conversation closed by Receptionist.', 'Conversation closed by Receptionist.', 'Read', 1, NOW(), NOW())`,
          [inquiryID]
        );
      }

      return NextResponse.json({ success: true, message: `Status updated to ${status}.` });
    }

    if (action === 'mark_read') {
      const inquiryID = parseInt(body.inquiryID);
      if (inquiryID) {
        await dbQuery("UPDATE inquiry SET unreadReceptionist = 0 WHERE inquiryID = ?", [inquiryID]);
        await dbQuery(
          `UPDATE inquiry_message 
           SET status = 'Read', isRead = 1, readAt = NOW() 
           WHERE inquiryID = ? 
             AND (senderRole != 'receptionist' OR senderRole IS NULL) 
             AND status != 'Read'`,
          [inquiryID]
        );
      }
      return NextResponse.json({ success: true, message: 'Inquiry thread marked as read.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process inquiry action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
