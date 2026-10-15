import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { dbQuery, getDbConnection, ensureBreakfastRateSchema, syncRoomStatuses } from '@/lib/db';

function getFloorNameByIndex(index) {
  if (index === 1) return 'Ground Floor';
  if (index === 2) return '2nd Floor';
  if (index === 3) return '3rd Floor';
  const s = ['th', 'st', 'nd', 'rd'];
  const val = index % 100;
  const ordinal = index + (s[(val - 20) % 10] || s[val] || s[0]);
  return `${ordinal} Floor`;
}

function parseFloorIndex(name) {
  const fn = (name || '').trim().toLowerCase();
  if (fn.includes('ground')) return 1;
  const match = fn.match(/(\d+)/);
  if (match) return parseInt(match[1], 10);
  const wordMap = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
  for (const [w, val] of Object.entries(wordMap)) {
    if (fn.includes(w)) return val;
  }
  return 1;
}

async function resequenceFloors() {
  const remainingFloors = await dbQuery("SELECT floorID, name FROM floor");
  if (remainingFloors.length > 0) {
    remainingFloors.sort((a, b) => parseFloorIndex(a.name) - parseFloorIndex(b.name));
    for (const f of remainingFloors) {
      await dbQuery("UPDATE floor SET name=? WHERE floorID=?", [`_t_${f.floorID}`, f.floorID]);
    }
    for (let i = 0; i < remainingFloors.length; i++) {
      const newName = getFloorNameByIndex(i + 1);
      await dbQuery("UPDATE floor SET name=? WHERE floorID=?", [newName, remainingFloors[i].floorID]);
    }
  }
}

export async function GET(request) {
  const auth = await verifyAdmin();
  if (!auth.authorized) return auth.response;

  await syncRoomStatuses();
  await ensureBreakfastRateSchema();
  await resequenceFloors().catch(() => {});

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const typeF = searchParams.get('roomTypeID') || '';
  const archived = searchParams.get('archived') === 'true';

  let sql = `
    SELECT rm.*, rt.type as typeName, fl.name as floorName,
           rt.minOccupancy, rt.maxOccupancy, rt.extraFoam, rt.price,
           COALESCE(rt.price, rr1.rate, rr2.rate, 0) as rate,
           COALESCE(rt.price, rr1.rate, 0) as rateWithoutBreakfast,
           COALESCE(rt.price, rr2.rate, 0) as rateWithBreakfast
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

  sql += " ORDER BY rm.roomID DESC";

  try {
    const [rooms, floors, roomTypes, roomRates] = await Promise.all([
      dbQuery(sql, params),
      dbQuery(`
        SELECT fl.floorID, fl.name, COUNT(rm.roomID) as roomCount
        FROM floor fl
        LEFT JOIN room rm ON rm.floorID = fl.floorID AND rm.isArchived = 0
        GROUP BY fl.floorID, fl.name
        ORDER BY fl.floorID
      `),
      dbQuery(`
        SELECT rt.roomTypeID, rt.type, rt.description, rt.minOccupancy, rt.maxOccupancy, rt.extraFoam, rt.price, COUNT(rm.roomID) as roomCount
        FROM room_type rt
        LEFT JOIN room rm ON rm.roomTypeID = rt.roomTypeID AND rm.isArchived = 0
        GROUP BY rt.roomTypeID, rt.type, rt.description, rt.minOccupancy, rt.maxOccupancy, rt.extraFoam, rt.price
        ORDER BY rt.type
      `),
      dbQuery("SELECT * FROM room_rate")
    ]);
    return NextResponse.json({ rooms, floors, roomTypes, roomRates });
  } catch (error) {
    console.error("Failed to fetch rooms:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await verifyAdmin();
  if (!auth.authorized) return auth.response;

  try {
    await ensureBreakfastRateSchema();
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const floorID = parseInt(body.floorID);
      const floorRows = await dbQuery("SELECT name FROM floor WHERE floorID = ?", [floorID]);
      const floorName = floorRows.length > 0 ? floorRows[0].name : '';
      const floorRank = parseFloorIndex(floorName);
      const baseRoomNum = floorRank * 100;

      let roomNumber = (body.roomNumber || '').trim();
      const existingRooms = await dbQuery("SELECT roomNumber FROM room WHERE isArchived = 0");
      const existingNumSet = new Set(existingRooms.map(r => String(r.roomNumber).trim()));

      if (!roomNumber || !/^\d+$/.test(roomNumber) || existingNumSet.has(roomNumber)) {
        let candidate = baseRoomNum + 1;
        while (existingNumSet.has(String(candidate))) {
          candidate++;
        }
        roomNumber = String(candidate);
      }
      const status = body.status || 'Available';
      const roomTypeID = parseInt(body.roomTypeID);
      const rtInfo = await dbQuery("SELECT minOccupancy, maxOccupancy, price FROM room_type WHERE roomTypeID=?", [roomTypeID]);
      const rate = rtInfo.length > 0 ? parseFloat(rtInfo[0].price || 0) : parseFloat(body.rate ?? body.price ?? 0);
      const description = (body.description || '').trim();
      const occupancyLimit = rtInfo.length > 0 ? parseInt(rtInfo[0].minOccupancy || 2, 10) : 4;
      const image = (body.image || '').trim() || null;
      const breakfastRate = 0;

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
      const rr1 = await dbQuery("SELECT roomRateID FROM room_rate WHERE roomTypeID=? AND floorID=? AND breakfastID=1", [roomTypeID, floorID]);
      if (rr1.length > 0) {
        await dbQuery("UPDATE room_rate SET rate=? WHERE roomRateID=?", [rate, rr1[0].roomRateID]);
      } else {
        await dbQuery("INSERT INTO room_rate(rate, roomTypeID, floorID, breakfastID) VALUES(?,?,?,1)", [rate, roomTypeID, floorID]);
      }

      const rr2 = await dbQuery("SELECT roomRateID FROM room_rate WHERE roomTypeID=? AND floorID=? AND breakfastID=2", [roomTypeID, floorID]);
      if (rr2.length > 0) {
        await dbQuery("UPDATE room_rate SET rate=? WHERE roomRateID=?", [rate, rr2[0].roomRateID]);
      } else {
        await dbQuery("INSERT INTO room_rate(rate, roomTypeID, floorID, breakfastID) VALUES(?,?,?,2)", [rate, roomTypeID, floorID]);
      }

      return NextResponse.json({ success: true, message: 'Room and rates processed successfully.' });
    }

    if (action === 'update') {
      const roomID = parseInt(body.roomID);
      const roomNumber = body.roomNumber.trim();

      if (!/^\d+$/.test(roomNumber)) {
        return NextResponse.json({ error: 'Room Number must contain numbers only (no letters).' }, { status: 400 });
      }
      const status = body.status;
      const floorID = parseInt(body.floorID);
      const roomTypeID = parseInt(body.roomTypeID);
      const rtInfo = await dbQuery("SELECT minOccupancy, maxOccupancy, price FROM room_type WHERE roomTypeID=?", [roomTypeID]);
      const rate = rtInfo.length > 0 ? parseFloat(rtInfo[0].price || 0) : parseFloat(body.rate ?? body.price ?? 0);
      const description = (body.description || '').trim();
      const occupancyLimit = rtInfo.length > 0 ? parseInt(rtInfo[0].minOccupancy || 2, 10) : 4;
      const image = (body.image || '').trim() || null;
      const breakfastRate = 0;

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
      const rr1 = await dbQuery("SELECT roomRateID FROM room_rate WHERE roomTypeID=? AND floorID=? AND breakfastID=1", [roomTypeID, floorID]);
      if (rr1.length > 0) {
        await dbQuery("UPDATE room_rate SET rate=? WHERE roomRateID=?", [rate, rr1[0].roomRateID]);
      } else {
        await dbQuery("INSERT INTO room_rate(rate, roomTypeID, floorID, breakfastID) VALUES(?,?,?,1)", [rate, roomTypeID, floorID]);
      }

      const rr2 = await dbQuery("SELECT roomRateID FROM room_rate WHERE roomTypeID=? AND floorID=? AND breakfastID=2", [roomTypeID, floorID]);
      if (rr2.length > 0) {
        await dbQuery("UPDATE room_rate SET rate=? WHERE roomRateID=?", [rate, rr2[0].roomRateID]);
      } else {
        await dbQuery("INSERT INTO room_rate(rate, roomTypeID, floorID, breakfastID) VALUES(?,?,?,2)", [rate, roomTypeID, floorID]);
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

    if (action === 'create_room_type') {
      const type = (body.type || '').trim();
      const description = (body.description || '').trim() || null;
      const minOccupancy = Math.max(1, parseInt(body.minOccupancy) || 1);
      const maxOccupancy = Math.max(minOccupancy, parseInt(body.maxOccupancy) || minOccupancy);
      const extraFoam = Math.max(0, parseInt(body.extraFoam) || 0);
      const price = Math.max(0, parseFloat(body.price) || 0);
      if (!type) return NextResponse.json({ error: 'Room type name is required.' }, { status: 400 });
      const dup = await dbQuery("SELECT roomTypeID FROM room_type WHERE LOWER(TRIM(type)) = LOWER(TRIM(?))", [type]);
      if (dup.length > 0) return NextResponse.json({ error: 'A room type with this name already exists.' }, { status: 400 });
      const res = await dbQuery(
        "INSERT INTO room_type(type, description, minOccupancy, maxOccupancy, extraFoam, price) VALUES(?,?,?,?,?,?)",
        [type, description, minOccupancy, maxOccupancy, extraFoam, price]
      );
      const newRoomTypeID = res.insertId;

      // Sync room_rate across all floors
      const allFloors = await dbQuery("SELECT floorID FROM floor");
      for (const f of allFloors) {
        for (const b of [1, 2]) {
          await dbQuery("INSERT INTO room_rate(rate, roomTypeID, floorID, breakfastID) VALUES(?,?,?,?)", [price, newRoomTypeID, f.floorID, b]);
        }
      }

      return NextResponse.json({ success: true, message: `Room type "${type}" created successfully.` });
    }

    if (action === 'update_room_type') {
      const roomTypeID = parseInt(body.roomTypeID);
      const type = (body.type || '').trim();
      const description = (body.description || '').trim() || null;
      const minOccupancy = Math.max(1, parseInt(body.minOccupancy) || 1);
      const maxOccupancy = Math.max(minOccupancy, parseInt(body.maxOccupancy) || minOccupancy);
      const extraFoam = Math.max(0, parseInt(body.extraFoam) || 0);
      const price = Math.max(0, parseFloat(body.price) || 0);
      if (!roomTypeID || !type) return NextResponse.json({ error: 'Room type ID and name are required.' }, { status: 400 });
      const dup = await dbQuery("SELECT roomTypeID FROM room_type WHERE LOWER(TRIM(type)) = LOWER(TRIM(?)) AND roomTypeID != ?", [type, roomTypeID]);
      if (dup.length > 0) return NextResponse.json({ error: 'A room type with this name already exists.' }, { status: 400 });
      await dbQuery(
        "UPDATE room_type SET type=?, description=?, minOccupancy=?, maxOccupancy=?, extraFoam=?, price=? WHERE roomTypeID=?",
        [type, description, minOccupancy, maxOccupancy, extraFoam, price, roomTypeID]
      );

      // Sync room_rate across all floors
      const allFloors = await dbQuery("SELECT floorID FROM floor");
      for (const f of allFloors) {
        for (const b of [1, 2]) {
          const existing = await dbQuery("SELECT roomRateID FROM room_rate WHERE roomTypeID=? AND floorID=? AND breakfastID=?", [roomTypeID, f.floorID, b]);
          if (existing.length > 0) {
            await dbQuery("UPDATE room_rate SET rate=? WHERE roomRateID=?", [price, existing[0].roomRateID]);
          } else {
            await dbQuery("INSERT INTO room_rate(rate, roomTypeID, floorID, breakfastID) VALUES(?,?,?,?)", [price, roomTypeID, f.floorID, b]);
          }
        }
      }

      return NextResponse.json({ success: true, message: `Room type "${type}" updated successfully.` });
    }

    if (action === 'delete_room_type') {
      const roomTypeID = parseInt(body.roomTypeID);
      if (!roomTypeID) return NextResponse.json({ error: 'Room type ID is required.' }, { status: 400 });
      const used = await dbQuery("SELECT roomID FROM room WHERE roomTypeID = ? LIMIT 1", [roomTypeID]);
      if (used.length > 0) return NextResponse.json({ error: 'Cannot delete: rooms (including history) still use this room type.' }, { status: 400 });
      await dbQuery("DELETE FROM room_rate WHERE roomTypeID = ?", [roomTypeID]);
      await dbQuery("DELETE FROM room_type WHERE roomTypeID = ?", [roomTypeID]);
      return NextResponse.json({ success: true, message: 'Room type deleted successfully.' });
    }

    if (action === 'create_floor') {
      let name = (body.name || '').trim();
      if (!name) {
        const existingFloors = await dbQuery("SELECT floorID, name FROM floor ORDER BY floorID");
        let maxNum = 0;
        for (const f of existingFloors) {
          const idx = parseFloorIndex(f.name);
          if (idx > maxNum) maxNum = idx;
        }
        const nextNum = Math.max(maxNum + 1, existingFloors.length + 1);
        name = getFloorNameByIndex(nextNum);
      }
      const dup = await dbQuery("SELECT floorID FROM floor WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))", [name]);
      if (dup.length > 0) return NextResponse.json({ error: 'A floor with this name already exists.' }, { status: 400 });
      await dbQuery("INSERT INTO floor(name) VALUES(?)", [name]);
      return NextResponse.json({ success: true, message: `Floor "${name}" created successfully.` });
    }

    if (action === 'update_floor') {
      const floorID = parseInt(body.floorID);
      const name = (body.name || '').trim();
      if (!floorID || !name) return NextResponse.json({ error: 'Floor ID and name are required.' }, { status: 400 });
      const dup = await dbQuery("SELECT floorID FROM floor WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND floorID != ?", [name, floorID]);
      if (dup.length > 0) return NextResponse.json({ error: 'A floor with this name already exists.' }, { status: 400 });
      await dbQuery("UPDATE floor SET name=? WHERE floorID=?", [name, floorID]);
      return NextResponse.json({ success: true, message: `Floor renamed to "${name}" successfully.` });
    }

    if (action === 'delete_floor') {
      const floorID = parseInt(body.floorID);
      if (!floorID) return NextResponse.json({ error: 'Floor ID is required.' }, { status: 400 });
      const used = await dbQuery("SELECT roomID FROM room WHERE floorID = ? LIMIT 1", [floorID]);
      if (used.length > 0) return NextResponse.json({ error: 'Cannot delete: rooms (including history) still use this floor.' }, { status: 400 });
      await dbQuery("DELETE FROM room_rate WHERE floorID = ?", [floorID]);
      await dbQuery("DELETE FROM floor WHERE floorID = ?", [floorID]);

      // Re-sequence remaining floors consecutively: Ground Floor, 2nd Floor, 3rd Floor...
      await resequenceFloors();

      return NextResponse.json({ success: true, message: 'Floor deleted and remaining floors re-sequenced successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process room action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
