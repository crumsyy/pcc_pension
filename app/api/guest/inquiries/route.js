import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'Guest') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find guest details
    const guestRes = await dbQuery("SELECT email FROM guest WHERE userID = ?", [session.userID]);
    if (guestRes.length === 0) {
      return NextResponse.json({ inquiry: null });
    }
    const email = guestRes[0].email;

    // Fetch the latest inquiry for this guest's email (Module H)
    const inquiries = await dbQuery(
      "SELECT * FROM inquiry WHERE email = ? ORDER BY createdAt DESC LIMIT 1",
      [email]
    );

    return NextResponse.json({ success: true, inquiry: inquiries[0] || null });
  } catch (error) {
    console.error("Failed to fetch guest inquiry:", error);
    return NextResponse.json({ error: 'Failed to fetch inquiry: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSession();
    const body = await request.json();
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    let name = "Anonymous Guest";
    let email = "guest@pcc.com";

    if (session && session.userID) {
      // Find guest details
      const guestRes = await dbQuery("SELECT firstName, lastName, email FROM guest WHERE userID = ?", [session.userID]);
      if (guestRes.length > 0) {
        name = `${guestRes[0].firstName} ${guestRes[0].lastName}`;
        email = guestRes[0].email || session.email || 'guest@pcc.com';
      }
    } else {
      name = body.name?.trim() || name;
      email = body.email?.trim() || email;
    }

    // Check if there is an existing inquiry for this guest's email
    const lastInq = await dbQuery("SELECT * FROM inquiry WHERE email = ? ORDER BY createdAt DESC LIMIT 1", [email]);

    if (lastInq.length > 0) {
      // Continuous conversation: append and reset status
      const existingInq = lastInq[0];
      let updatedMessage = existingInq.message;
      if (existingInq.response) {
        updatedMessage += "\n\nStaff: " + existingInq.response;
      }
      updatedMessage += "\n\nGuest: " + message;

      await dbQuery(
        "UPDATE inquiry SET message = ?, status = 'Pending', response = NULL, createdAt = NOW(), isChatbotForwarded = 1 WHERE inquiryID = ?",
        [updatedMessage, existingInq.inquiryID]
      );
    } else {
      // Insert new inquiry
      await dbQuery(
        "INSERT INTO inquiry(name, email, message, status, isChatbotForwarded) VALUES(?, ?, ?, 'Pending', 1)",
        [name, email, message]
      );
    }

    // Notify all active receptionists (roleID = 2) via the notification bell
    const receptionists = await dbQuery("SELECT userID FROM user WHERE roleID = 2 AND status = 'Active'");
    for (const r of receptionists) {
      await dbQuery(
        "INSERT INTO notification(userID, title, message) VALUES(?, 'New Guest Inquiry', ?)",
        [r.userID, `Guest ${name} has forwarded an inquiry to staff: "${message.substring(0, 50)}..."`]
      );
    }

    return NextResponse.json({ success: true, message: 'Inquiry submitted successfully to Front Desk.' });
  } catch (error) {
    console.error("Failed to submit guest inquiry:", error);
    return NextResponse.json({ error: 'Failed to submit inquiry: ' + error.message }, { status: 500 });
  }
}
