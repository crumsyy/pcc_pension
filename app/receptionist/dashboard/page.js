import { requireSessionRole } from "@/lib/session";
import { fetchDashboardSnapshot } from "@/lib/dashboardSnapshot";
import ReceptionistDashboardClient from "./ReceptionistDashboardClient";

export default async function ReceptionistDashboard() {
  const DEV_TIMING = process.env.NODE_ENV !== 'production';
  if (DEV_TIMING) console.time('[dashboard] total');
  if (DEV_TIMING) console.time('[dashboard] session');
  const auth = await requireSessionRole("Receptionist");
  if (DEV_TIMING) console.timeEnd('[dashboard] session');
  // NOTE: room-status sweep intentionally NOT awaited here (cron owns it);
  // awaiting it blocked every dashboard render on sequential maintenance writes.
  const userName = auth.session?.fullName || "Receptionist";

  // Single-roundtrip snapshot (15s server cache); falls back to parallel queries.
  if (DEV_TIMING) console.time('[dashboard] queries');
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
  if (DEV_TIMING) console.timeEnd('[dashboard] queries');
  const initialData = {
    userName,
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
  };
  if (DEV_TIMING) console.timeEnd('[dashboard] total');

  return <ReceptionistDashboardClient initialData={initialData} />;
}
