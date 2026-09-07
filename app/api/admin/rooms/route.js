import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, syncRoomStatuses, ensureBreakfastRateSchema } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await syncRoomStatuses();
  await ensureBreakfastRateSchema();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const typeF = searchParams.get('roomTypeID') || '';
  const archived = searchParams.get('archived') === 'true';

  let sql = `
    SELECT rm.*, rt.type as typeName, fl.name as floorName,
           COALESCE(rr1.rate, 0) as rateWithoutBreakfast,
           COALESCE(rr2.rate, 0) as rateWithBreakfast
    FROM room rm
    JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
    JOIN floor fl ON fl.floorID = rm.floorID
    LEFT JOIN room_rate rr1 ON rr1.roomTypeID = rm.roomTypeID AND rr1.floorID = rm.floorID AND rr1.breakfastID = 1
    LEFT JOIN room_rate rr2 ON rr2.roomTypeID = rm.roomTypeID AND rr2.floorID = rm.floorID AND rr2.breakfastID = 2
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
    const [rooms, floors, roomTypes, roomRates] = await Promise.all([
      dbQuery(sql, params),
      dbQuery("SELECT * FROM floor ORDER BY floorID"),
      dbQuery("SELECT * FROM room_type ORDER BY type"),
      dbQuery("SELECT * FROM room_rate")
    ]);
    return NextResponse.json({ rooms, floors, roomTypes, roomRates });
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
    await ensureBreakfastRateSchema();
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const roomNumber = body.roomNumber.trim();
      const status = body.status || 'Available';
      const floorID = parseInt(body.floorID);
      const roomTypeID = parseInt(body.roomTypeID);
      const rateWithoutBreakfast = parseFloat(body.rateWithoutBreakfast);
      const rateWithBreakfast = parseFloat(body.rateWithBreakfast);
      const description = (body.description || '').trim();
      const occupancyLimit = parseInt(body.occupancyLimit) || 4;
      const image = (body.image || '').trim() || null;
      const breakfastRate = body.breakfastRate !== undefined && body.breakfastRate !== '' && body.breakfastRate !== null ? parseFloat(body.breakfastRate) : null;

      if (status === 'Occupied') {
        return NextResponse.json({ error: 'Administrators cannot manually set a room to Occupied.' }, { status: 400 });
      }

      // Check if room number already exists
      const existingRoom = await dbQuery(
        "SELECT roomID FROM room WHERE LOWER(TRIM(roomNumber)) = LOWER(TRIM(?)) AND isArchived = 0",
        [roomNumber]
      );
      if (existingRoom.length > 0) {
        return NextResponse.json({ error: 'A room with this room number already exists.' }, { status: 400 });
      }

      await dbQuery(
        "INSERT INTO room(roomNumber,status,floorID,roomTypeID,description,occupancyLimit,image,breakfastRate) VALUES(?,?,?,?,?,?,?,?)",
        [roomNumber, status, floorID, roomTypeID, description, occupancyLimit, image, breakfastRate]
      );

      // Upsert rates
      if (!isNaN(rateWithoutBreakfast) && !isNaN(rateWithBreakfast)) {
        const rr1 = await dbQuery("SELECT roomRateID FROM room_rate WHERE roomTypeID=? AND floorID=? AND breakfastID=1", [roomTypeID, floorID]);
        if (rr1.length > 0) {
          await dbQuery("UPDATE room_rate SET rate=? WHERE roomRateID=?", [rateWithoutBreakfast, rr1[0].roomRateID]);
        } else {
          await dbQuery("INSERT INTO room_rate(rate, roomTypeID, floorID, breakfastID) VALUES(?,?,?,1)", [rateWithoutBreakfast, roomTypeID, floorID]);
        }

        const rr2 = await dbQuery("SELECT roomRateID FROM room_rate WHERE roomTypeID=? AND floorID=? AND breakfastID=2", [roomTypeID, floorID]);
        if (rr2.length > 0) {
          await dbQuery("UPDATE room_rate SET rate=? WHERE roomRateID=?", [rateWithBreakfast, rr2[0].roomRateID]);
        } else {
          await dbQuery("INSERT INTO room_rate(rate, roomTypeID, floorID, breakfastID) VALUES(?,?,?,2)", [rateWithBreakfast, roomTypeID, floorID]);
        }
      }

      return NextResponse.json({ success: true, message: 'Room and rates processed successfully.' });
    }

    if (action === 'update') {
      const roomID = parseInt(body.roomID);
      const roomNumber = body.roomNumber.trim();
      const status = body.status;
      const floorID = parseInt(body.floorID);
      const roomTypeID = parseInt(body.roomTypeID);
      const rateWithoutBreakfast = parseFloat(body.rateWithoutBreakfast);
      const rateWithBreakfast = parseFloat(body.rateWithBreakfast);
      const description = (body.description || '').trim();
      const occupancyLimit = parseInt(body.occupancyLimit) || 4;
      const image = (body.image || '').trim() || null;
      const breakfastRate = body.breakfastRate !== undefined && body.breakfastRate !== '' && body.breakfastRate !== null ? parseFloat(body.breakfastRate) : null;

      if (status === 'Occupied') {
        return NextResponse.json({ error: 'Administrators cannot manually set a room to Occupied.' }, { status: 400 });
      }

      // Check current status in DB to ensure it is not Occupied
      const currentRoom = await dbQuery("SELECT status FROM room WHERE roomID=?", [roomID]);
      if (currentRoom.length > 0 && currentRoom[0].status === 'Occupied') {
        return NextResponse.json({ error: 'Occupied rooms cannot be edited.' }, { status: 400 });
      }

      // Check if room number already exists for another room
      const existingRoom = await dbQuery(
        "SELECT roomID FROM room WHERE LOWER(TRIM(roomNumber)) = LOWER(TRIM(?)) AND roomID != ? AND isArchived = 0",
        [roomNumber, roomID]
      );
      if (existingRoom.length > 0) {
        return NextResponse.json({ error: 'A room with this room number already exists.' }, { status: 400 });
      }

      await dbQuery(
        "UPDATE room SET roomNumber=?, status=?, floorID=?, roomTypeID=?, description=?, occupancyLimit=?, image=?, breakfastRate=? WHERE roomID=?",
        [roomNumber, status, floorID, roomTypeID, description, occupancyLimit, image, breakfastRate, roomID]
      );

      // Upsert rates
      if (!isNaN(rateWithoutBreakfast) && !isNaN(rateWithBreakfast)) {
        const rr1 = await dbQuery("SELECT roomRateID FROM room_rate WHERE roomTypeID=? AND floorID=? AND breakfastID=1", [roomTypeID, floorID]);
        if (rr1.length > 0) {
          await dbQuery("UPDATE room_rate SET rate=? WHERE roomRateID=?", [rateWithoutBreakfast, rr1[0].roomRateID]);
        } else {
          await dbQuery("INSERT INTO room_rate(rate, roomTypeID, floorID, breakfastID) VALUES(?,?,?,1)", [rateWithoutBreakfast, roomTypeID, floorID]);
        }

        const rr2 = await dbQuery("SELECT roomRateID FROM room_rate WHERE roomTypeID=? AND floorID=? AND breakfastID=2", [roomTypeID, floorID]);
        if (rr2.length > 0) {
          await dbQuery("UPDATE room_rate SET rate=? WHERE roomRateID=?", [rateWithBreakfast, rr2[0].roomRateID]);
        } else {
          await dbQuery("INSERT INTO room_rate(rate, roomTypeID, floorID, breakfastID) VALUES(?,?,?,2)", [rateWithBreakfast, roomTypeID, floorID]);
        }
      }

      return NextResponse.json({ success: true, message: 'Room and rates updated successfully.' });
    }

    if (action === 'delete') {
      const roomID = parseInt(body.roomID);
      
      // Prevent deleting occupied rooms
      const currentRoom = await dbQuery("SELECT status FROM room WHERE roomID = ?", [roomID]);
      if (currentRoom.length > 0 && currentRoom[0].status === 'Occupied') {
        return NextResponse.json({ error: 'Occupied rooms cannot be deleted or archived.' }, { status: 400 });
      }

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
