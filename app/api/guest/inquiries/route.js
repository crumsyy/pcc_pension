import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, ensureInquirySchema } from '@/lib/db';

export async function GET(request) {
  try {
    await ensureInquirySchema();
    const session = await getSession();
    const { searchParams } = new URL(request.url);
    const queryEmail = searchParams.get('email')?.trim();

    let email = null;
    let name = 'Guest';

    if (session && session.userID) {
      const guestRes = await dbQuery("SELECT firstName, lastName, email, contact FROM guest WHERE userID = ?", [session.userID]);
      if (guestRes.length > 0) {
        name = `${guestRes[0].firstName} ${guestRes[0].lastName}`;
        email = guestRes[0].email || session.email;
      }
    } else if (queryEmail) {
      email = queryEmail;
    }

    if (!email) {
      return NextResponse.json({ success: true, inquiry: null, messages: [] });
    }

    // Fetch the latest active or most recent inquiry for this guest email
    const inquiries = await dbQuery(
      "SELECT * FROM inquiry WHERE email = ? ORDER BY createdAt DESC LIMIT 1",
      [email]
    );

    if (inquiries.length === 0) {
      return NextResponse.json({ success: true, inquiry: null, messages: [] });
    }

    const inquiry = inquiries[0];

    // Mark guest unread count as 0
    await dbQuery("UPDATE inquiry SET unreadGuest = 0 WHERE inquiryID = ?", [inquiry.inquiryID]);
    await dbQuery("UPDATE inquiry_message SET isRead = 1 WHERE inquiryID = ? AND senderType = 'Receptionist'", [inquiry.inquiryID]);

    // Fetch message history thread
    const messages = await dbQuery(
      "SELECT * FROM inquiry_message WHERE inquiryID = ? ORDER BY timestamp ASC",
      [inquiry.inquiryID]
    );

    return NextResponse.json({ success: true, inquiry, messages });
  } catch (error) {
    console.error("Failed to fetch guest inquiry:", error);
    return NextResponse.json({ error: 'Failed to fetch inquiry: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureInquirySchema();
    const session = await getSession();
    const body = await request.json();
    const message = body.message?.trim();
    const contactNumber = body.contactNumber?.trim() || null;

    if (!message) {
      return NextResponse.json({ error: 'Message content is required.' }, { status: 400 });
    }

    let name = body.name?.trim() || "Guest Visitor";
    let email = body.email?.trim() || "visitor@pcc.com";

    if (session && session.userID) {
      const guestRes = await dbQuery("SELECT firstName, lastName, email, contact FROM guest WHERE userID = ?", [session.userID]);
      if (guestRes.length > 0) {
        name = `${guestRes[0].firstName} ${guestRes[0].lastName}`;
        email = guestRes[0].email || session.email || email;
      }
    }

    const localNow = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

    // Check for an existing non-closed inquiry ticket for this email
    let inquiryID;
    const existingInquiries = await dbQuery(
      "SELECT inquiryID, status FROM inquiry WHERE email = ? AND status != 'Closed' ORDER BY createdAt DESC LIMIT 1",
      [email]
    );

    if (existingInquiries.length > 0) {
      inquiryID = existingInquiries[0].inquiryID;
      // Update status back to Pending when guest sends a new message after receptionist replied
      await dbQuery(
        `UPDATE inquiry 
         SET status = 'Pending', message = ?, contactNumber = COALESCE(?, contactNumber), unreadReceptionist = unreadReceptionist + 1, isChatbotForwarded = 1 
         WHERE inquiryID = ?`,
        [message, contactNumber, inquiryID]
      );
    } else {
      // Create new inquiry ticket
      const insertRes = await dbQuery(
        `INSERT INTO inquiry(name, email, contactNumber, message, status, isChatbotForwarded, unreadReceptionist, createdAt) 
         VALUES(?, ?, ?, ?, 'Pending', 1, 1, ?)`,
        [name, email, contactNumber, message, nowStr]
      );
      inquiryID = insertRes.insertId;
    }

    // Insert message into inquiry_message thread
    await dbQuery(
      `INSERT INTO inquiry_message (inquiryID, senderType, senderName, message, isRead, timestamp) 
       VALUES (?, 'Guest', ?, ?, 0, ?)`,
      [inquiryID, name, message, nowStr]
    );

    // Notify all active receptionists & admins via notification bell
    const staffToNotify = await dbQuery("SELECT u.userID FROM user u WHERE u.roleID IN (1, 2) AND u.status = 'Active'");
    for (const r of staffToNotify) {
      await dbQuery(
        "INSERT INTO notification(userID, title, message) VALUES(?, 'New Inquiry Live Message', ?)",
        [r.userID, `New inquiry message from ${name}: "${message.substring(0, 45)}${message.length > 45 ? '...' : ''}"`]
      );
    }

    // Fetch updated message thread
    const updatedMessages = await dbQuery(
      "SELECT * FROM inquiry_message WHERE inquiryID = ? ORDER BY timestamp ASC",
      [inquiryID]
    );

    const [inquiry] = await dbQuery("SELECT * FROM inquiry WHERE inquiryID = ?", [inquiryID]);

    return NextResponse.json({
      success: true,
      message: 'Your request has been sent. A receptionist will respond shortly.',
      inquiry,
      messages: updatedMessages
    });
  } catch (error) {
    console.error("Failed to submit guest inquiry message:", error);
    return NextResponse.json({ error: 'Failed to submit inquiry message: ' + error.message }, { status: 500 });
  }
}
