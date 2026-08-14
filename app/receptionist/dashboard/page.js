import Link from "next/link";
import { dbQuery, syncRoomStatuses } from "@/lib/db";
import { requireSessionRole } from "@/lib/session";
import AutoRefresh from "@/app/components/AutoRefresh";

export default async function ReceptionistDashboard() {
  const auth = await requireSessionRole("Receptionist");
  await syncRoomStatuses();
  const userName = auth.session?.fullName || "Receptionist";
  // 1. Fetch statistics, check-ins, reservations, and room status board in parallel
  const [
    totalCheckInsRes,
    totalCheckOutsRes,
    occupiedRoomsRes,
    availableRoomsRes,
    pendingResRes,
    underMaintenanceRoomsRes,
    checkInsList,
    pendingResList,
    rooms
  ] = await Promise.all([
    dbQuery("SELECT COUNT(*) as count FROM booking WHERE status IN ('Checked In', 'Checked Out')"),
    dbQuery("SELECT COUNT(*) as count FROM booking WHERE status = 'Checked Out'"),
    dbQuery("SELECT COUNT(*) as count FROM room WHERE status = 'Occupied' AND isArchived = 0"),
    dbQuery("SELECT COUNT(*) as count FROM room WHERE status = 'Available' AND isArchived = 0"),
    dbQuery("SELECT COUNT(*) as count FROM reservation WHERE status = 'Pending'"),
    dbQuery("SELECT COUNT(*) as count FROM room WHERE status = 'Under Maintenance' AND isArchived = 0"),
    dbQuery(`
      SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
             g.firstName, g.lastName, g.contact,
             rm.roomNumber, rt.type as roomType
      FROM booking b
      JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE b.status = 'Checked In'
      ORDER BY rm.roomNumber ASC
    `),
    dbQuery(`
      SELECT r.reservationID, r.reservationDateTime, r.status,
             g.firstName, g.lastName, g.contact,
             rm.roomNumber, rt.type as roomType
      FROM reservation r
      JOIN guest g ON g.guestID = r.guestID
      JOIN room rm ON rm.roomID = r.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE r.status = 'Pending'
      ORDER BY r.reservationDateTime ASC
      LIMIT 10
    `),
    dbQuery(`
      SELECT rm.roomID, rm.roomNumber, rm.status, rt.type as roomType, fl.name as floor
      FROM room rm
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      JOIN floor fl ON fl.floorID = rm.floorID
      WHERE rm.isArchived = 0
      ORDER BY fl.name, rm.roomNumber
    `)
  ]);

  const totalCheckIns = totalCheckInsRes[0]?.count || 0;
  const totalCheckOuts = totalCheckOutsRes[0]?.count || 0;
  const occupiedRooms = occupiedRoomsRes[0]?.count || 0;
  const availableRooms = availableRoomsRes[0]?.count || 0;
  const pendingRes = pendingResRes[0]?.count || 0;
  const underMaintenanceRooms = underMaintenanceRoomsRes[0]?.count || 0;

  // Formatter helpers
  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  const formatDateShort = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  };

  const formatDateLong = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  };

  const getRoomColor = (status) => {
    switch (status) {
      case "Available":
        return "#3FA34D";
      case "Occupied":
        return "#2155B5";
      case "Reserved":
        return "#f0a500";
      case "Under Maintenance":
        return "#dc3545";
      default:
        return "#6c757d";
    }
  };

  const stats = [
    ["Total Check-ins", totalCheckIns, "#2155B5"],
    ["Total Check-outs", totalCheckOuts, "#3FA34D"],
    ["Rooms Occupied", occupiedRooms, "#e05c2a"],
    ["Rooms Available", availableRooms, "#3FA34D"],
    ["Pending Reserv.", pendingRes, "#f0a500"],
    ["Under Maintenance", underMaintenanceRooms, "#dc3545"]
  ];

  return (
    <>
      <AutoRefresh interval={5000} />
      <div className="section-eyebrow">Receptionist</div>
      <h2 className="section-title mb-1">Welcome, {userName}!</h2>
      <p className="text-muted mb-4" style={{ fontSize: "0.9rem" }}>
        Today — {formatDateLong(new Date())}
      </p>



      {/* Quick stats as filled colored blocks */}
      <div className="row g-3 mb-4">
        {stats.map(([label, value, color], index) => (
          <div key={index} className="col-6 col-xl-2">
            <div 
              className="text-center p-3 text-white shadow-sm" 
              style={{ 
                backgroundColor: color, 
                borderRadius: "8px",
                minHeight: '94px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <div style={{ fontSize: "2rem", fontWeight: "800", lineHeight: "1.1" }}>
                {value}
              </div>
              <div style={{ fontSize: "0.72rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.9, marginTop: '4px' }}>
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-4">
        {/* Room status board */}
        <div className="col-lg-4">
          <div className="key-tag">
            <div className="room-type mb-3">Room Status Board</div>
            {rooms.length === 0 ? (
              <p className="text-muted small">No rooms configured yet.</p>
            ) : (
              <>
                <div className="d-flex flex-wrap gap-2">
                  {rooms.map((rm, idx) => (
                    <div
                      key={idx}
                      title={`${rm.roomNumber} — ${rm.status}`}
                      style={{
                        width: "48px",
                        height: "48px",
                        backgroundColor: getRoomColor(rm.status),
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontWeight: "700",
                        fontSize: "0.8rem",
                        cursor: "default"
                      }}
                    >
                      {rm.roomNumber}
                    </div>
                  ))}
                </div>
                <div className="d-flex flex-wrap gap-2 mt-3" style={{ fontSize: "0.75rem" }}>
                  <span>
                    <span style={{ display: "inline-block", width: "10px", height: "10px", backgroundColor: "#3FA34D", borderRadius: "2px", marginRight: "4px" }}></span>
                    Available
                  </span>
                  <span>
                    <span style={{ display: "inline-block", width: "10px", height: "10px", backgroundColor: "#2155B5", borderRadius: "2px", marginRight: "4px" }}></span>
                    Occupied
                  </span>
                  <span>
                    <span style={{ display: "inline-block", width: "10px", height: "10px", backgroundColor: "#f0a500", borderRadius: "2px", marginRight: "4px" }}></span>
                    Reserved
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Currently Checked-In Rooms */}
        <div className="col-lg-8">
          <div className="key-tag mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="room-type">Currently Checked-In Rooms</div>
            </div>
            {checkInsList.length === 0 ? (
              <p className="text-muted small">No guests currently checked in.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Room</th>
                      <th>Checked In On</th>
                      <th>Expected Check-Out</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkInsList.map((b, idx) => (
                      <tr key={idx}>
                        <td>
                          {b.firstName} {b.lastName}
                          <br />
                          <small className="text-muted">{b.contact}</small>
                        </td>
                        <td><strong>Room {b.roomNumber}</strong> - {b.roomType}</td>
                        <td>{new Date(b.checkInDateTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                        <td>{formatDateShort(b.checkOutDateTime)}</td>
                        <td>
                          <span className="badge text-bg-primary">
                            Occupied
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pending reservations */}
          <div className="key-tag">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="room-type">Pending Reservations</div>
              <Link href="/receptionist/reservations" className="btn btn-pcc-outline btn-sm">
                View All
              </Link>
            </div>
            {pendingResList.length === 0 ? (
              <p className="text-muted small">No pending reservations.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Room</th>
                      <th>Reserved On</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingResList.map((r, idx) => (
                      <tr key={idx}>
                        <td>
                          {r.firstName} {r.lastName}
                          <br />
                          <small className="text-muted">{r.contact}</small>
                        </td>
                        <td>{r.roomNumber} - {r.roomType}</td>
                        <td>{formatDateShort(r.reservationDateTime)}</td>
                        <td>
                          <Link
                            href={`/receptionist/reservations?confirm=${r.reservationID}`}
                            className="btn btn-sm btn-pcc-primary"
                          >
                            Confirm
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
