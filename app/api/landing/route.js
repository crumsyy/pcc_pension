import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

export async function GET(request) {
  try {
    const [roomCountRes, floorCountRes, roomTypeCountRes, roomsList, activePromotions, roomTypesList] = await Promise.all([
      dbQuery("SELECT COUNT(*) as totalRooms FROM room WHERE isArchived = 0"),
      dbQuery("SELECT COUNT(*) as totalFloors FROM floor"),
      dbQuery("SELECT COUNT(*) as totalRoomTypes FROM room_type"),
      dbQuery(`
        SELECT r.roomID, r.roomNumber, r.status, r.description, r.image, r.occupancyLimit, r.breakfastRate,
               r.price,
               rt.roomTypeID, COALESCE(rt.type, 'Standard Room') as roomType, rt.description as typeDescription,
               fl.floorID, COALESCE(fl.name, 'Ground Floor') as floorName,
               COALESCE(r.price, rr1.rate, 0) as rateWithoutBreakfast,
               COALESCE(r.price + COALESCE(r.breakfastRate, 0), rr2.rate, 0) as rateWithBreakfast
        FROM room r
        LEFT JOIN room_type rt ON rt.roomTypeID = r.roomTypeID
        LEFT JOIN floor fl ON fl.floorID = r.floorID
        LEFT JOIN room_rate rr1 ON rr1.roomTypeID = r.roomTypeID AND rr1.floorID = r.floorID AND rr1.breakfastID = 1
        LEFT JOIN room_rate rr2 ON rr2.roomTypeID = r.roomTypeID AND rr2.floorID = r.floorID AND rr2.breakfastID = 2
        WHERE r.isArchived = 0
        ORDER BY fl.floorID, r.roomNumber
      `),
      dbQuery(`
        SELECT p.promotionID, COALESCE(p.name, 'Special Discount') as name, 
                p.description, COALESCE(p.percentage, 10) as percentage, 
                p.startDate, p.endDate, rt.type as roomTypeName
        FROM promotions p
        LEFT JOIN room_type rt ON rt.roomTypeID = p.roomTypeID
        WHERE (p.isArchived IS NULL OR p.isArchived = 0)
          AND (p.endDate IS NULL OR p.endDate >= CURDATE())
        UNION ALL
        SELECT d.discountID as promotionID, d.name, 
                d.description, COALESCE(d.percentage, 10) as percentage,
                CURDATE() as startDate, CURDATE() as endDate, 'All Room Types' as roomTypeName
        FROM discounts d
        WHERE (d.isArchived IS NULL OR d.isArchived = 0)
          AND d.name NOT IN (SELECT COALESCE(p2.name, '') FROM promotions p2)
        ORDER BY endDate ASC
      `),
      dbQuery(`
        SELECT 
          rt.roomTypeID,
          rt.type as name,
          rt.description,
          rt.minOccupancy,
          rt.maxOccupancy,
          rt.extraFoam,
          COALESCE(MIN(rm.price), rt.price, 0) as price,
          COUNT(DISTINCT rm.roomID) as totalRooms,
          COUNT(DISTINCT CASE WHEN rm.status = 'Available' THEN rm.roomID END) as availableRooms,
          (
            SELECT rm2.image 
            FROM room rm2 
            WHERE rm2.roomTypeID = rt.roomTypeID AND rm2.isArchived = 0 AND rm2.image IS NOT NULL AND rm2.image != '' 
            LIMIT 1
          ) as roomImage
        FROM room_type rt
        LEFT JOIN room rm ON rm.roomTypeID = rt.roomTypeID AND rm.isArchived = 0
        GROUP BY rt.roomTypeID, rt.type, rt.description, rt.minOccupancy, rt.maxOccupancy, rt.extraFoam, rt.price
        ORDER BY price ASC
      `)
    ]);

    const totalRooms = roomCountRes[0]?.totalRooms || 0;
    const totalFloors = floorCountRes[0]?.totalFloors || 0;
    const totalRoomTypes = roomTypeCountRes[0]?.totalRoomTypes || 0;

    return NextResponse.json({
      success: true,
      totalRooms,
      totalFloors,
      totalRoomTypes,
      rooms: roomsList,
      roomTypes: roomTypesList,
      promotions: activePromotions
    });
  } catch (error) {
    console.error("Failed to fetch landing page data:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
