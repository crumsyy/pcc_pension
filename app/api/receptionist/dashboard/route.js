import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { fetchDashboardSnapshot } from '@/lib/dashboardSnapshot';

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // NOTE: room-status sweep intentionally NOT run here (cron owns it);
    // it used to block this polled endpoint on sequential maintenance writes.
    // Single-roundtrip snapshot (15s server cache); falls back to parallel queries.
    const {
      bookingCounts,
      roomCounts,
      pendingResRes,
      checkInsList,
      pendingResList,
      rooms,
      confirmedBookingsList,
      guestInquiriesList,
      guestOrdersList
    } = await fetchDashboardSnapshot();

    return NextResponse.json({
      success: true,
      totalCheckIns: Number(bookingCounts[0]?.activeStays) || 0,
      totalCheckOuts: Number(bookingCounts[0]?.todayCheckouts) || 0,
      occupiedRooms: Number(roomCounts[0]?.occupied) || 0,
      availableRooms: Number(roomCounts[0]?.available) || 0,
      pendingRes: pendingResRes[0]?.count || 0,
      underMaintenanceRooms: Number(roomCounts[0]?.maintenance) || 0,
      checkInsList,
      pendingResList,
      rooms,
      confirmedBookingsList,
      guestInquiriesList,
      guestOrdersList
    });
  } catch (error) {
    console.error("Receptionist dashboard real-time API error:", error);
    return NextResponse.json({ error: error.message || 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
