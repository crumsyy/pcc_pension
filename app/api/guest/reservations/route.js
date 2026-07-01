import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'Guest') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { roomID, checkInDate } = body; // checkInDate is YYYY-MM-DD

    if (!roomID || !checkInDate) {
      return NextResponse.json({ error: 'Room ID and Check-in date are required.' }, { status: 400 });
    }

    // Find the guestID of the logged-in user
    const guests = await dbQuery("SELECT guestID FROM guest WHERE userID = ?", [session.userID]);
    if (guests.length === 0) {
      return NextResponse.json({ error: 'Guest profile not found.' }, { status: 404 });
    }
    const guestID = guests[0].guestID;

    // Insert reservation at 2:00 PM on check-in date
    const reservationDateTime = `${checkInDate} 14:00:00`;

    await dbQuery(
      "INSERT INTO reservation (reservationDateTime, status, guestID, roomID) VALUES (?, 'Pending', ?, ?)",
      [reservationDateTime, guestID, roomID]
    );

    // Also add a user notification
    await dbQuery(
      "INSERT INTO notification (userID, title, message) VALUES (?, 'Reservation Submitted', ?)",
      [
        session.userID,
        `Your reservation request for Room is submitted. Front desk will confirm it shortly.`
      ]
    );

    return NextResponse.json({ success: true, message: 'Reservation request submitted successfully!' });
  } catch (error) {
    console.error("Failed to create guest reservation:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
