import Link from "next/link";
import { dbQuery } from "@/lib/db";
import { requireSessionRole } from "@/lib/session";

export default async function ReceptionistDashboard() {
  const auth = await requireSessionRole("Receptionist");
  const userName = auth.session?.fullName || "Receptionist";
  // 1. Fetch statistics, check-ins, reservations, and room status board in parallel
  const [
    checkInsTodayRes,
    checkOutsTodayRes,
    occupiedRoomsRes,
    availableRoomsRes,
    pendingResRes,
    checkInsList,
    pendingResList,
    rooms
  ] = await Promise.all([
    dbQuery("SELECT COUNT(*) as count FROM booking WHERE DATE(checkInDateTime) = CURDATE() AND status IN ('Confirmed','Pending')"),
    dbQuery("SELECT COUNT(*) as count FROM booking WHERE DATE(checkOutDateTime) = CURDATE() AND status = 'Checked In'"),
    dbQuery("SELECT COUNT(*) as count FROM room WHERE status = 'Occupied' AND isArchived = 0"),
    dbQuery("SELECT COUNT(*) as count FROM room WHERE status = 'Available' AND isArchived = 0"),
    dbQuery("SELECT COUNT(*) as count FROM reservation WHERE status = 'Pending'"),
    dbQuery(`
      SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
             g.firstName, g.lastName, g.contact,
             rm.roomNumber, rt.type as roomType
      FROM booking b
      JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE DATE(b.checkInDateTime) = CURDATE()
      ORDER BY b.checkInDateTime ASC
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

  const checkInsToday = checkInsTodayRes[0]?.count || 0;
  const checkOutsToday = checkOutsTodayRes[0]?.count || 0;
  const occupiedRooms = occupiedRoomsRes[0]?.count || 0;
  const availableRooms = availableRoomsRes[0]?.count || 0;
  const pendingRes = pendingResRes[0]?.count || 0;

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
    ["Check-Ins Today", checkInsToday, "#2155B5"],
    ["Check-Outs Today", checkOutsToday, "#3FA34D"],
    ["Rooms Occupied", occupiedRooms, "#e05c2a"],
    ["Rooms Available", availableRooms, "#3FA34D"],
    ["Pending Reserv.", pendingRes, "#f0a500"]
  ];

  return (
    <>
      <div className="section-eyebrow">Receptionist</div>
      <h2 className="section-title mb-1">Welcome, {userName}!</h2>
      <p className="text-muted mb-4" style={{ fontSize: "0.9rem" }}>
        Today — {formatDateLong(new Date())}
      </p>

      {/* Quick stats */}
      <div className="row g-3 mb-4">
        {stats.map(([label, value, color], index) => (
          <div key={index} className="col-6 col-xl-2">
            <div className="key-tag text-center" style={{ borderTop: `3px solid ${color}` }}>
              <div style={{ fontSize: "2rem", fontWeight: "700", color }}>
                {value}
              </div>
              <div className="room-meta">{label}</div>
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
                  <span>
                    <span style={{ display: "inline-block", width: "10px", height: "10px", backgroundColor: "#dc3545", borderRadius: "2px", marginRight: "4px" }}></span>
                    Maintenance
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Today's check-ins */}
        <div className="col-lg-8">
          <div className="key-tag mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="room-type">Today&apos;s Check-Ins</div>
              <Link href="/receptionist/checkin" className="btn btn-pcc-primary btn-sm">
                Process Check-In
              </Link>
            </div>
            {checkInsList.length === 0 ? (
              <p className="text-muted small">No check-ins scheduled for today.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Room</th>
                      <th>Check-In</th>
                      <th>Check-Out</th>
                      <th>Status</th>
                      <th></th>
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
                        <td>{b.roomNumber} - {b.roomType}</td>
                        <td>{formatTime(b.checkInDateTime)}</td>
                        <td>{formatDateShort(b.checkOutDateTime)}</td>
                        <td>
                          <span
                            className={`badge ${
                              b.status === "Checked In" ? "text-bg-primary" : "text-bg-warning"
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/receptionist/checkin?bookingID=${b.bookingID}`}
                            className="btn btn-sm btn-pcc-outline"
                          >
                            {b.status === "Checked In" ? "Check Out" : "Check In"}
                          </Link>
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
