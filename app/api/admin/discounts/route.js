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

  try {
    const discounts = await dbQuery(`
      SELECT d.*, dt.type as discType, et.eligibility 
      FROM discounts d 
      JOIN discount_type dt ON dt.discountTypeID = d.discountTypeID 
      JOIN eligibility_type et ON et.eligibilityTypeID = d.eligibilityTypeID 
      ORDER BY d.name
    `);

    const promotions = await dbQuery(`
      SELECT p.*, rm.roomNumber 
      FROM promotions p 
      LEFT JOIN room rm ON rm.roomID = p.roomID 
      ORDER BY p.startDate DESC
    `);

    const discountTypes = await dbQuery("SELECT * FROM discount_type");
    const eligibilityTypes = await dbQuery("SELECT * FROM eligibility_type");
    const rooms = await dbQuery("SELECT roomID, roomNumber FROM room ORDER BY roomNumber");

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
    });
  } catch (error) {
    console.error("Failed to fetch discounts/promos:", error);
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
      await dbQuery("DELETE FROM discounts WHERE discountID=?", [discountID]);
      return NextResponse.json({ success: true, message: 'Discount removed successfully.' });
    }

    // Promotions
    if (action === 'create_promo') {
      const { name, description, startDate, endDate, percentage, roomID } = body;
      await dbQuery(
        "INSERT INTO promotions(name,description,startDate,endDate,percentage,roomID) VALUES(?,?,?,?,?,?)",
        [name.trim(), description.trim(), startDate, endDate, parseInt(percentage), roomID ? parseInt(roomID) : null]
      );
      return NextResponse.json({ success: true, message: 'Promotion created successfully.' });
    }

    if (action === 'update_promo') {
      const { promotionID, name, description, startDate, endDate, percentage, roomID } = body;
      await dbQuery(
        "UPDATE promotions SET name=?, description=?, startDate=?, endDate=?, percentage=?, roomID=? WHERE promotionID=?",
        [name.trim(), description.trim(), startDate, endDate, parseInt(percentage), roomID ? parseInt(roomID) : null, parseInt(promotionID)]
      );
      return NextResponse.json({ success: true, message: 'Promotion updated successfully.' });
    }

    if (action === 'archive_promo') {
      const promotionID = parseInt(body.promotionID);
      await dbQuery("DELETE FROM promotions WHERE promotionID=?", [promotionID]);
      return NextResponse.json({ success: true, message: 'Promotion removed successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process discount/promo action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
