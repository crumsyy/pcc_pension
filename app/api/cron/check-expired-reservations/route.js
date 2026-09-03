import { NextResponse } from 'next/server';
import { dbQuery, syncRoomStatuses } from '@/lib/db';

export async function GET(request) {
  try {
    // 1. Run core synchronization routine
    await syncRoomStatuses();

    // 2. Fetch summary metrics for response verification
    const [resSummary, bookingSummary, roomSummary] = await Promise.all([
      dbQuery("SELECT status, COUNT(*) as count FROM reservation GROUP BY status"),
      dbQuery("SELECT status, COUNT(*) as count FROM booking GROUP BY status"),
      dbQuery("SELECT status, COUNT(*) as count FROM room WHERE isArchived = 0 GROUP BY status")
    ]);

    const resCounts = {};
    resSummary.forEach(r => { resCounts[r.status] = r.count; });

    const bookingCounts = {};
    bookingSummary.forEach(b => { bookingCounts[b.status] = b.count; });

    const roomCounts = {};
    roomSummary.forEach(rm => { roomCounts[rm.status] = rm.count; });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Expired reservations and bookings checked and synchronized successfully.',
      reservations: resCounts,
      bookings: bookingCounts,
      rooms: roomCounts
    });
  } catch (error) {
    console.error("Cron check-expired-reservations failed:", error);
    return NextResponse.json({ error: 'Sync failed: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  return GET(request);
}
