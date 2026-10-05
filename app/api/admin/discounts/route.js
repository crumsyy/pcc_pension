import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { dbQuery } from '@/lib/db';

export async function GET(request) {
  const auth = await verifyAdmin();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const archived = searchParams.get('archived') === 'true';
  const fetchLookups = searchParams.get('lookups') === 'true';

  try {
    const [discounts, promotions, discountTypes, eligibilityTypes, rooms, roomTypes] = await Promise.all([
      dbQuery(`
        SELECT d.*, dt.type as discType, et.eligibility 
        FROM discounts d 
        JOIN discount_type dt ON dt.discountTypeID = d.discountTypeID 
        JOIN eligibility_type et ON et.eligibilityTypeID = d.eligibilityTypeID 
        WHERE d.isArchived = ?
        ORDER BY d.discountID DESC
      `, [archived ? 1 : 0]),
      dbQuery(`
        SELECT p.*, rm.roomNumber, rt.type as roomTypeName 
        FROM promotions p 
        LEFT JOIN room rm ON rm.roomID = p.roomID 
        LEFT JOIN room_type rt ON rt.roomTypeID = p.roomTypeID
        WHERE p.isArchived = ?
        ORDER BY p.promotionID DESC, p.startDate DESC
      `, [archived ? 1 : 0]),
      fetchLookups ? dbQuery("SELECT * FROM discount_type") : Promise.resolve([]),
      fetchLookups ? dbQuery("SELECT * FROM eligibility_type") : Promise.resolve([]),
      fetchLookups ? dbQuery("SELECT roomID, roomNumber FROM room WHERE isArchived = 0 ORDER BY roomNumber") : Promise.resolve([]),
      fetchLookups ? dbQuery("SELECT roomTypeID, type FROM room_type ORDER BY type") : Promise.resolve([])
    ]);

    let filteredDiscounts = discounts;
    let filteredPromotions = promotions;

    if (search) {
      const queryLower = search.toLowerCase();
      filteredDiscounts = discounts.filter(
        (d) =>
          d.name.toLowerCase().includes(queryLower) ||
          d.discType.toLowerCase().includes(queryLower)
      );
      filteredPromotions = promotions.filter((p) =>
        p.name.toLowerCase().includes(queryLower)
      );
    }

    return NextResponse.json({
      discounts: filteredDiscounts,
      promotions: filteredPromotions,
      discountTypes,
      eligibilityTypes,
      rooms,
      roomTypes
    });
  } catch (error) {
    console.error("Failed to fetch discounts/promos:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await verifyAdmin();
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;


    // Discounts
    if (action === 'create_discount') {
      const { name, description, percentage, requiredBookings, discountTypeID, eligibilityTypeID } = body;
      await dbQuery(
        "INSERT INTO discounts(name,description,percentage,requiredBookings,discountTypeID,eligibilityTypeID) VALUES(?,?,?,?,?,?)",
        [name.trim(), description.trim(), parseInt(percentage), parseInt(requiredBookings || 0), parseInt(discountTypeID), parseInt(eligibilityTypeID)]
      );
      return NextResponse.json({ success: true, message: 'Discount created successfully.' });
    }

    if (action === 'update_discount') {
      const { discountID, name, description, percentage, requiredBookings, discountTypeID, eligibilityTypeID } = body;
      await dbQuery(
        "UPDATE discounts SET name=?, description=?, percentage=?, requiredBookings=?, discountTypeID=?, eligibilityTypeID=? WHERE discountID=?",
        [name.trim(), description.trim(), parseInt(percentage), parseInt(requiredBookings || 0), parseInt(discountTypeID), parseInt(eligibilityTypeID), parseInt(discountID)]
      );
      return NextResponse.json({ success: true, message: 'Discount updated successfully.' });
    }

    if (action === 'archive_discount') {
      const discountID = parseInt(body.discountID);
      await dbQuery("UPDATE discounts SET isArchived = 1 WHERE discountID=?", [discountID]);
      return NextResponse.json({ success: true, message: 'Discount archived successfully.' });
    }

    if (action === 'restore_discount') {
      const discountID = parseInt(body.discountID);
      await dbQuery("UPDATE discounts SET isArchived = 0 WHERE discountID=?", [discountID]);
      return NextResponse.json({ success: true, message: 'Discount restored successfully.' });
    }

    // Promotions
    if (action === 'create_promo') {
      const { name, description, startDate, endDate, percentage, roomID, roomTypeID } = body;
      await dbQuery(
        "INSERT INTO promotions(name,description,startDate,endDate,percentage,roomID,roomTypeID) VALUES(?,?,?,?,?,?,?)",
        [name.trim(), description.trim(), startDate, endDate, parseInt(percentage), roomID ? parseInt(roomID) : null, roomTypeID ? parseInt(roomTypeID) : null]
      );
      return NextResponse.json({ success: true, message: 'Promotion created successfully.' });
    }

    if (action === 'update_promo') {
      const { promotionID, name, description, startDate, endDate, percentage, roomID, roomTypeID } = body;
      await dbQuery(
        "UPDATE promotions SET name=?, description=?, startDate=?, endDate=?, percentage=?, roomID=?, roomTypeID=? WHERE promotionID=?",
        [name.trim(), description.trim(), startDate, endDate, parseInt(percentage), roomID ? parseInt(roomID) : null, roomTypeID ? parseInt(roomTypeID) : null, parseInt(promotionID)]
      );
      return NextResponse.json({ success: true, message: 'Promotion updated successfully.' });
    }

    if (action === 'archive_promo') {
      const promotionID = parseInt(body.promotionID);
      await dbQuery("UPDATE promotions SET isArchived = 1 WHERE promotionID=?", [promotionID]);
      return NextResponse.json({ success: true, message: 'Promotion archived successfully.' });
    }

    if (action === 'restore_promo') {
      const promotionID = parseInt(body.promotionID);
      await dbQuery("UPDATE promotions SET isArchived = 0 WHERE promotionID=?", [promotionID]);
      return NextResponse.json({ success: true, message: 'Promotion restored successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process discount/promo action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
