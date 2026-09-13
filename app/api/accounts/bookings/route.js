import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getBookingBalance, BOOKING_STATUSES, normalizeBookingStatus, ensureBookingBillingSchema } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || !['Administrator', 'Receptionist', 'Staff'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';
  const dateFilter = searchParams.get('date') || '';

  try {
    await ensureBookingBillingSchema();

    let sql = `
      SELECT b.bookingID, 
             DATE_FORMAT(b.checkInDateTime, '%Y-%m-%dT%H:%i:%s') as checkInDateTime, 
             DATE_FORMAT(b.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime, 
             b.status,
             b.finalBalance,
             b.remainingBalance,
             g.firstName, g.lastName, g.contact, g.email,
             rm.roomNumber, rt.type as roomType, fl.name as floor
      FROM booking b
      JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      JOIN floor fl ON fl.floorID = rm.floorID
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      const like = `%${search}%`;
      sql += " AND (g.firstName LIKE ? OR g.lastName LIKE ? OR rm.roomNumber LIKE ? OR b.bookingID LIKE ?)";
      params.push(like, like, like, like);
    }
    if (dateFilter) {
      sql += " AND DATE(b.checkInDateTime) = ?";
      params.push(dateFilter);
    }

    sql += " ORDER BY b.checkInDateTime DESC";

    const rawBookings = await dbQuery(sql, params);

    // Normalize all statuses according to the single source of truth
    const bookings = await Promise.all(rawBookings.map(async b => {
      const normalizedStatus = normalizeBookingStatus(b.status);
      const remainingBalance = await getBookingBalance(b.bookingID);
      return {
        ...b,
        status: normalizedStatus,
        rawStatus: b.status,
        remainingBalance
      };
    }));

    // Filter by normalized status if filter specified
    const filteredBookings = statusFilter 
      ? bookings.filter(b => b.status === statusFilter)
      : bookings;

    // Calculate count breakdown strictly matching BOOKING_STATUSES
    const counts = {};
    BOOKING_STATUSES.forEach(st => {
      counts[st] = 0;
    });

    bookings.forEach(b => {
      if (counts[b.status] !== undefined) {
        counts[b.status]++;
      } else {
        counts[b.status] = 1;
      }
    });

    return NextResponse.json({
      success: true,
      statuses: BOOKING_STATUSES,
      bookings: filteredBookings,
      counts
    });
  } catch (error) {
    console.error("Failed to fetch accounts bookings:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || !['Administrator', 'Receptionist', 'Staff'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, bookingID } = body;

    const parsedBookingID = parseInt(bookingID, 10);
    if (!parsedBookingID || isNaN(parsedBookingID)) {
      return NextResponse.json({ error: 'Valid Booking ID is required.' }, { status: 400 });
    }

    const [booking] = await dbQuery(
      "SELECT bookingID, status, finalBalance, remainingBalance FROM booking WHERE bookingID = ?",
      [parsedBookingID]
    );

    if (!booking) {
      return NextResponse.json({ error: 'Booking record not found.' }, { status: 404 });
    }

    const normalizedStatus = normalizeBookingStatus(booking.status);

    if (action === 'pay') {
      // Enforce status === 'Bill Ready' before processing payment
      if (normalizedStatus !== 'Bill Ready') {
        return NextResponse.json(
          { error: "Payment is only allowed once the bill is ready." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        bookingID: parsedBookingID,
        bookingStatus: 'Bill Ready',
        message: 'Payment authorized: Booking status is verified as Bill Ready.'
      });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    console.error("Accounts booking action error:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
