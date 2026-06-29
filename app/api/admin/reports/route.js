import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const report = searchParams.get('report') || 'sales';
  const from = searchParams.get('from') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0, 10);
  const to = searchParams.get('to') || new Date().toISOString().substring(0, 10);

  try {
    const data = {};

    if (report === 'sales') {
      const salesRows = await dbQuery(`
        SELECT DATE_FORMAT(t.transactionDateTime, '%Y-%m-%d') as txDate,
               COUNT(t.transactionID) as txCount,
               SUM(p.amount) as revenue
        FROM transactions t
        JOIN payment p ON p.paymentID = t.paymentID
        WHERE DATE(t.transactionDateTime) BETWEEN ? AND ?
        GROUP BY DATE_FORMAT(t.transactionDateTime, '%Y-%m-%d')
        ORDER BY txDate
      `, [from, to]);

      const totalRevenue = salesRows.reduce((sum, row) => sum + parseFloat(row.revenue || 0), 0);
      const totalTx = salesRows.reduce((sum, row) => sum + parseInt(row.txCount || 0), 0);

      data.salesRows = salesRows;
      data.totalRevenue = totalRevenue;
      data.totalTx = totalTx;
    } else if (report === 'occupancy') {
      const totalRoomsRes = await dbQuery("SELECT COUNT(*) as count FROM room WHERE isArchived = 0");
      const occupiedNowRes = await dbQuery("SELECT COUNT(*) as count FROM room WHERE status = 'Occupied' AND isArchived = 0");

      const totalRooms = totalRoomsRes[0]?.count || 0;
      const occupiedNow = occupiedNowRes[0]?.count || 0;

      const roomUtilRows = await dbQuery(`
        SELECT rt.type, COUNT(b.bookingID) as bookings
        FROM booking b
        JOIN room rm ON rm.roomID = b.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE DATE(b.checkInDateTime) BETWEEN ? AND ?
        GROUP BY rt.type
      `, [from, to]);

      data.totalRooms = totalRooms;
      data.occupiedNow = occupiedNow;
      data.roomUtilRows = roomUtilRows;
    } else if (report === 'inventory') {
      const invRows = await dbQuery(`
        SELECT DATE_FORMAT(i.stockInDate, '%Y-%m-%d') as stockInDate,
               COALESCE(a.name, p.name) as itemName,
               CASE WHEN i.amenityID IS NOT NULL THEN 'Amenity' ELSE 'Product' END as itemType,
               i.quantityReceived
        FROM inventory i
        LEFT JOIN amenities a ON a.amenityID = i.amenityID
        LEFT JOIN products p ON p.productID = i.productID
        WHERE i.stockInDate BETWEEN ? AND ?
        ORDER BY i.stockInDate DESC
      `, [from, to]);

      data.invRows = invRows;
    } else if (report === 'guests') {
      const guestRows = await dbQuery(`
        SELECT g.firstName, g.lastName, g.contact, g.email,
               COUNT(b.bookingID) as totalBookings,
               MAX(b.checkOutDateTime) as lastStay
        FROM guest g
        LEFT JOIN booking b ON b.guestID = g.guestID AND b.status = 'Checked Out'
        GROUP BY g.guestID, g.firstName, g.lastName, g.contact, g.email
        ORDER BY totalBookings DESC
        LIMIT 20
      `);

      data.guestRows = guestRows;
    }

    return NextResponse.json({ report, from, to, data });
  } catch (error) {
    console.error("Failed to generate report:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
