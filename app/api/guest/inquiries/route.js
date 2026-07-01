import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

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

    // Insert new inquiry
    await dbQuery(
      "INSERT INTO inquiry(name, email, message, status, isChatbotForwarded) VALUES(?, ?, ?, 'Pending', 1)",
      [name, email, message]
    );

    return NextResponse.json({ success: true, message: 'Inquiry submitted successfully to Front Desk.' });
  } catch (error) {
    console.error("Failed to submit guest inquiry:", error);
    return NextResponse.json({ error: 'Failed to submit inquiry: ' + error.message }, { status: 500 });
  }
}
