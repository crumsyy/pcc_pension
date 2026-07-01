import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';

  try {
    let query = "SELECT guestID, firstName, middleName, lastName, gender, dateOfBirth, city, province, contact, email, userID FROM guest";
    const params = [];

    if (search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      query += " WHERE firstName LIKE ? OR lastName LIKE ? OR contact LIKE ? OR email LIKE ?";
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += " ORDER BY lastName, firstName";

    const guests = await dbQuery(query, params);
    return NextResponse.json({ success: true, guests });
  } catch (error) {
    console.error("Failed to fetch guests list:", error);
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

    if (action === 'update') {
      const guestID = parseInt(body.guestID);
      const { firstName, lastName, contact, email, gender, city, province } = body;

      if (!guestID || !firstName || !lastName) {
        return NextResponse.json({ error: 'Missing guestID, firstName, or lastName.' }, { status: 400 });
      }

      await dbQuery(
        `UPDATE guest 
         SET firstName = ?, lastName = ?, contact = ?, email = ?, gender = ?, city = ?, province = ?
         WHERE guestID = ?`,
        [firstName.trim(), lastName.trim(), (contact || '').trim(), (email || '').trim() || null, gender || null, city || null, province || null, guestID]
      );

      return NextResponse.json({ success: true, message: 'Guest details updated successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process guest action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
