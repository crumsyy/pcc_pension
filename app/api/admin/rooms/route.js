import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const typeF = searchParams.get('roomTypeID') || '';
  const archived = searchParams.get('archived') === 'true';

  let sql = `
    SELECT rm.*, rt.type as typeName, fl.name as floorName
    FROM room rm
    JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
    JOIN floor fl ON fl.floorID = rm.floorID
    WHERE rm.isArchived = ?
  `;
  const params = [archived ? 1 : 0];

  if (search) {
    sql += " AND (rm.roomNumber LIKE ? OR rt.type LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like);
  }
  if (typeF) {
    sql += " AND rm.roomTypeID = ?";
    params.push(parseInt(typeF));
  }

  sql += " ORDER BY fl.name, rm.roomNumber";

  try {
    const [rooms, floors, roomTypes] = await Promise.all([
      dbQuery(sql, params),
      dbQuery("SELECT * FROM floor ORDER BY floorID"),
      dbQuery("SELECT * FROM room_type ORDER BY type")
    ]);
    return NextResponse.json({ rooms, floors, roomTypes });
  } catch (error) {
    console.error("Failed to fetch rooms:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const roomNumber = body.roomNumber.trim();
      const status = body.status || 'Available';
      const floorID = parseInt(body.floorID);
      const roomTypeID = parseInt(body.roomTypeID);

      if (status === 'Occupied') {
        return NextResponse.json({ error: 'Administrators cannot manually set a room to Occupied.' }, { status: 400 });
      }

      await dbQuery(
        "INSERT INTO room(roomNumber,status,floorID,roomTypeID) VALUES(?,?,?,?)",
        [roomNumber, status, floorID, roomTypeID]
      );
      return NextResponse.json({ success: true, message: 'Room created successfully.' });
    }

    if (action === 'update') {
      const roomID = parseInt(body.roomID);
      const roomNumber = body.roomNumber.trim();
      const status = body.status;
      const floorID = parseInt(body.floorID);
      const roomTypeID = parseInt(body.roomTypeID);

      if (status === 'Occupied') {
        return NextResponse.json({ error: 'Administrators cannot manually set a room to Occupied.' }, { status: 400 });
      }

      // Check current status in DB to ensure it is not Occupied
      const currentRoom = await dbQuery("SELECT status FROM room WHERE roomID=?", [roomID]);
      if (currentRoom.length > 0 && currentRoom[0].status === 'Occupied') {
        return NextResponse.json({ error: 'Occupied rooms cannot be edited.' }, { status: 400 });
      }

      await dbQuery(
        "UPDATE room SET roomNumber=?, status=?, floorID=?, roomTypeID=? WHERE roomID=?",
        [roomNumber, status, floorID, roomTypeID, roomID]
      );
      return NextResponse.json({ success: true, message: 'Room updated successfully.' });
    }

    if (action === 'delete') {
      const roomID = parseInt(body.roomID);
      
      // Perform soft delete (archive)
      await dbQuery(
        "UPDATE room SET isArchived = 1 WHERE roomID=?",
        [roomID]
      );
      return NextResponse.json({ success: true, message: 'Room archived successfully.' });
    }

    if (action === 'restore') {
      const roomID = parseInt(body.roomID);
      
      // Restore archived room
      await dbQuery(
        "UPDATE room SET isArchived = 0 WHERE roomID=?",
        [roomID]
      );
      return NextResponse.json({ success: true, message: 'Room restored successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process room action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
