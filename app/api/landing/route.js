import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

export async function GET(request) {
  try {
    const [roomCountRes, roomsList, activePromotions] = await Promise.all([
      dbQuery("SELECT COUNT(*) as totalRooms FROM room WHERE isArchived = 0"),
      dbQuery(`
        SELECT r.roomID, r.roomNumber, r.status, r.description, r.image, r.occupancyLimit,
               rt.roomTypeID, rt.type as roomType, rt.description as typeDescription,
               fl.floorID, fl.name as floorName,
               COALESCE(rr1.rate, 0) as rateWithoutBreakfast,
               COALESCE(rr2.rate, 0) as rateWithBreakfast
        FROM room r
        JOIN room_type rt ON rt.roomTypeID = r.roomTypeID
        JOIN floor fl ON fl.floorID = r.floorID
        LEFT JOIN room_rate rr1 ON rr1.roomTypeID = r.roomTypeID AND rr1.floorID = r.floorID AND rr1.breakfastID = 1
        LEFT JOIN room_rate rr2 ON rr2.roomTypeID = r.roomTypeID AND rr2.floorID = r.floorID AND rr2.breakfastID = 2
        WHERE r.isArchived = 0
        ORDER BY fl.floorID, r.roomNumber
      `),
      dbQuery(`
        SELECT p.promotionID, COALESCE(p.name, p.title, 'Special Discount') as name, 
               p.description, COALESCE(p.percentage, p.discountPercentage, 10) as percentage, 
               p.startDate, p.endDate, rt.type as roomTypeName
        FROM promotions p
        LEFT JOIN room_type rt ON rt.roomTypeID = p.roomTypeID
        WHERE (p.isArchived IS NULL OR p.isArchived = 0)
          AND (p.endDate IS NULL OR p.endDate >= CURDATE())
        UNION ALL
        SELECT d.discountID as promotionID, d.name, 
               d.description, COALESCE(d.discountPercentage, d.percentage, 10) as percentage,
               CURDATE() as startDate, d.validUntil as endDate, 'All Room Types' as roomTypeName
        FROM discounts d
        WHERE (d.isArchived IS NULL OR d.isArchived = 0)
          AND (d.validUntil IS NULL OR d.validUntil >= CURDATE())
          AND d.name NOT IN (SELECT COALESCE(p2.name, '') FROM promotions p2)
        ORDER BY endDate ASC
      `)
    ]);

    const totalRooms = roomCountRes[0]?.totalRooms || 0;

    return NextResponse.json({
      success: true,
      totalRooms,
      rooms: roomsList,
      promotions: activePromotions
    });
  } catch (error) {
    console.error("Failed to fetch landing page data:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
