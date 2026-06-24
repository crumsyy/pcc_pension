import Link from "next/link";
import { dbQuery } from "@/lib/db";

export default async function AdminDashboard() {
  // Helper to map array results to key-value objects (replicates PDO::FETCH_KEY_PAIR)
  const mapToKeyValue = (rows, keyField = "status", valueField = "cnt") => {
    const obj = {};
    rows.forEach((row) => {
      obj[row[keyField]] = row[valueField];
    });
    return obj;
  };

  // 1. Fetch Room stats
  const roomStatsRows = await dbQuery("SELECT status, COUNT(*) as cnt FROM room GROUP BY status");
  const roomStats = mapToKeyValue(roomStatsRows);

  const totalRoomsRes = await dbQuery("SELECT COUNT(*) as count FROM room");
  const totalRooms = totalRoomsRes[0]?.count || 0;
  const availableRooms = roomStats["Available"] || 0;
  const occupiedRooms = roomStats["Occupied"] || 0;
  const reservedRooms = roomStats["Reserved"] || 0;
  const maintenanceRooms = roomStats["Under Maintenance"] || 0;
  const cleaningRooms = roomStats["Cleaning"] || 0;

  // 2. Fetch Revenue
  const monthRevenueRes = await dbQuery(`
    SELECT COALESCE(SUM(p.amount), 0) as amount 
    FROM payment p
    JOIN transactions t ON t.paymentID = p.paymentID
    WHERE MONTH(t.transactionDateTime) = MONTH(NOW())
      AND YEAR(t.transactionDateTime) = YEAR(NOW())
  `);
  const monthRevenue = parseFloat(monthRevenueRes[0]?.amount || 0);

  const todayRevenueRes = await dbQuery(`
    SELECT COALESCE(SUM(p.amount), 0) as amount 
    FROM payment p
    JOIN transactions t ON t.paymentID = p.paymentID
    WHERE DATE(t.transactionDateTime) = CURDATE()
  `);
  const todayRevenue = parseFloat(todayRevenueRes[0]?.amount || 0);

  // 3. Fetch Reservation stats
  const reservationStatsRows = await dbQuery("SELECT status, COUNT(*) as cnt FROM reservation GROUP BY status");
  const reservationStats = mapToKeyValue(reservationStatsRows);
  const pendingRes = reservationStats["Pending"] || 0;
  const confirmedRes = reservationStats["Confirmed"] || 0;
  const canceledRes = reservationStats["Canceled"] || 0;

  // 4. Fetch Booking stats
  const bookingStatsRows = await dbQuery("SELECT status, COUNT(*) as cnt FROM booking GROUP BY status");
  const bookingStats = mapToKeyValue(bookingStatsRows);
  const pendingBook = bookingStats["Pending"] || 0;
  const confirmedBook = bookingStats["Confirmed"] || 0;
  const checkedInBook = bookingStats["Checked In"] || 0;
  const checkedOutBook = bookingStats["Checked Out"] || 0;
  const canceledBook = bookingStats["Canceled"] || 0;

  // 5. Today's check-ins & check-outs count
  const todayCheckInRes = await dbQuery(
    "SELECT COUNT(*) as count FROM booking WHERE DATE(checkInDateTime) = CURDATE() AND status IN ('Confirmed','Pending')"
  );
  const todayCheckIn = todayCheckInRes[0]?.count || 0;

  const todayCheckOutRes = await dbQuery(
    "SELECT COUNT(*) as count FROM booking WHERE DATE(checkOutDateTime) = CURDATE() AND status = 'Checked In'"
  );
  const todayCheckOut = todayCheckOutRes[0]?.count || 0;

  // 6. Low stock alert count
  const lowStockCountRes = await dbQuery(`
    SELECT COUNT(*) as count FROM (
        SELECT amenityID FROM amenities WHERE quantity <= 5
        UNION ALL
        SELECT productID FROM products WHERE quantity <= 5
    ) low
  `);
  const lowStockCount = lowStockCountRes[0]?.count || 0;

  // 7. Room status board
  const rooms = await dbQuery(`
    SELECT rm.roomNumber, rm.status, rt.type as roomType, fl.name as floor
    FROM room rm
    JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
    JOIN floor fl ON fl.floorID = rm.floorID
    ORDER BY fl.name, rm.roomNumber
  `);

  // 8. Recent reservations (last 6)
  const recentRes = await dbQuery(`
    SELECT r.reservationID, r.reservationDateTime, r.status,
           g.firstName, g.lastName, rm.roomNumber, rt.type
    FROM reservation r
    JOIN guest g ON g.guestID = r.guestID
    JOIN room rm ON rm.roomID = r.roomID
    JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
    ORDER BY r.reservationDateTime DESC LIMIT 6
  `);

  // 9. Recent bookings (last 6)
  const recentBookings = await dbQuery(`
    SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
           g.firstName, g.lastName, rm.roomNumber, rt.type
    FROM booking b
    JOIN guest g ON g.guestID = b.guestID
    JOIN room rm ON rm.roomID = b.roomID
    JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
    ORDER BY b.checkInDateTime DESC LIMIT 6
  `);

  // Formatter helpers
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP"
    }).format(amount);
  };

  const formatDateShort = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  };

  const formatDateLong = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
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
        return "#17a2b8";
    }
  };

  const resStatusColors = {
    pending: "text-bg-warning",
    confirmed: "text-bg-success",
    canceled: "text-bg-danger"
  };

  const bookingStatusColors = {
    pending: "text-bg-warning",
    confirmed: "text-bg-success",
    "checked-in": "text-bg-primary",
    "checked-out": "text-bg-secondary",
    canceled: "text-bg-danger"
  };

  const rstats = [
    ["Total Rooms", totalRooms, "#2155B5"],
    ["Available", availableRooms, "#3FA34D"],
    ["Occupied", occupiedRooms, "#1a3c8f"],
    ["Reserved", reservedRooms, "#f0a500"],
    ["Maintenance", maintenanceRooms, "#dc3545"],
    ["Cleaning", cleaningRooms, "#17a2b8"]
  ];

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="section-eyebrow">Administrator</div>
          <h2 className="section-title mb-0">Dashboard</h2>
          <small className="text-muted">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true
            })}
          </small>
        </div>
      </div>

      {/* System Alerts */}
      {lowStockCount > 0 && (
        <div className="alert alert-warning d-flex align-items-center gap-2 mb-2">
          ⚠ <strong>{lowStockCount} item(s)</strong> are running low on stock.
          <Link href="/admin/inventory#lowstock" className="ms-auto btn btn-sm btn-warning">
            View Alerts
          </Link>
        </div>
      )}
      {pendingRes > 0 && (
        <div className="alert alert-info d-flex align-items-center gap-2 mb-2">
          📅 <strong>{pendingRes} reservation(s)</strong> are awaiting confirmation.
          <Link href="/admin/reservations" className="ms-auto btn btn-sm btn-primary">
            View
          </Link>
        </div>
      )}
      {todayCheckIn > 0 && (
        <div className="alert alert-success d-flex align-items-center gap-2 mb-2">
          ✅ <strong>{todayCheckIn} guest(s)</strong> are scheduled to check in today.
        </div>
      )}

      {/* Room Status Stats */}
      <div className="row g-3 mb-3">
        {rstats.map(([label, val, color], index) => (
          <div key={index} className="col-6 col-md-4 col-xl-2">
            <div className="text-center p-3 rounded text-white" style={{ backgroundColor: color }}>
              <div style={{ fontSize: "2rem", fontWeight: "700" }}>{val}</div>
              <div style={{ fontSize: "0.75rem", opacity: 0.9 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue + Today's Activity */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card-module h-100" style={{ borderLeft: "4px solid #2155B5", backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)", borderLeftWidth: "4px" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--pcc-muted)", fontFamily: "var(--font-tag)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Today&apos;s Revenue
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: "700", color: "#2155B5" }}>
              {formatCurrency(todayRevenue)}
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card-module h-100" style={{ borderLeft: "4px solid #3FA34D", backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)", borderLeftWidth: "4px" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--pcc-muted)", fontFamily: "var(--font-tag)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Month Revenue
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: "700", color: "#3FA34D" }}>
              {formatCurrency(monthRevenue)}
            </div>
            <Link href="/admin/reports?report=sales" className="btn btn-sm btn-pcc-outline mt-2" style={{ fontSize: "0.75rem" }}>
              Full Report
            </Link>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card-module h-100" style={{ borderLeft: "4px solid #f0a500", backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)", borderLeftWidth: "4px" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--pcc-muted)", fontFamily: "var(--font-tag)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Check-Ins Today
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: "700", color: "#f0a500" }}>
              {todayCheckIn}
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card-module h-100" style={{ borderLeft: "4px solid #17a2b8", backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)", borderLeftWidth: "4px" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--pcc-muted)", fontFamily: "var(--font-tag)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Check-Outs Today
            </div>
            <div style={{ fontSize: "1.8rem", fontWeight: "700", color: "#17a2b8" }}>
              {todayCheckOut}
            </div>
          </div>
        </div>
      </div>

      {/* Reservation & Booking Status Summary */}
      <div className="row g-4 mb-4">
        {/* Reservation Status */}
        <div className="col-md-6">
          <div className="card-module h-100" style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
            <div className="room-type mb-3">📅 Reservation Status Overview</div>
            <div className="row g-2 mb-3">
              {[
                ["Pending", pendingRes, "#f0a500"],
                ["Confirmed", confirmedRes, "#3FA34D"],
                ["Canceled", canceledRes, "#dc3545"]
              ].map(([label, val, color], idx) => (
                <div key={idx} className="col-4">
                  <div className="text-center p-2 rounded" style={{ backgroundColor: `${color}18`, border: `1px solid ${color}33` }}>
                    <div style={{ fontSize: "1.6rem", fontWeight: "700", color }}>{val}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--pcc-muted)" }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Recent Reservations */}
            {recentRes.length === 0 ? (
              <p className="text-muted small">No reservations yet.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0" style={{ fontSize: "0.82rem" }}>
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Room</th>
                      <th>Date Reserved</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRes.map((r, idx) => (
                      <tr key={idx}>
                        <td>{r.firstName} {r.lastName}</td>
                        <td>{r.roomNumber} - {r.type}</td>
                        <td>{formatDateLong(r.reservationDateTime)}</td>
                        <td>
                          <span className={`badge ${resStatusColors[r.status.toLowerCase()] || "text-bg-secondary"}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Link href="/admin/reservations" className="btn btn-pcc-outline btn-sm mt-3">
              View All Reservations
            </Link>
          </div>
        </div>

        {/* Booking Status */}
        <div className="col-md-6">
          <div className="card-module h-100" style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
            <div className="room-type mb-3">🛏 Booking Status Overview</div>
            <div className="row g-2 mb-3">
              {[
                ["Pending", pendingBook, "#f0a500"],
                ["Confirmed", confirmedBook, "#3FA34D"],
                ["Checked In", checkedInBook, "#2155B5"],
                ["Checked Out", checkedOutBook, "#17a2b8"],
                ["Canceled", canceledBook, "#dc3545"]
              ].map(([label, val, color], idx) => (
                <div key={idx} className="col">
                  <div className="text-center p-2 rounded" style={{ backgroundColor: `${color}18`, border: `1px solid ${color}33` }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: "700", color }}>{val}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--pcc-muted)", lineHeight: "1.2" }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Recent Bookings */}
            {recentBookings.length === 0 ? (
              <p className="text-muted small">No bookings yet.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0" style={{ fontSize: "0.82rem" }}>
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Room</th>
                      <th>Check-In</th>
                      <th>Check-Out</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((b, idx) => (
                      <tr key={idx}>
                        <td>{b.firstName} {b.lastName}</td>
                        <td>{b.roomNumber} - {b.type}</td>
                        <td>{formatDateShort(b.checkInDateTime)}</td>
                        <td>{formatDateLong(b.checkOutDateTime)}</td>
                        <td>
                          <span className={`badge ${bookingStatusColors[b.status.toLowerCase().replace(" ", "-")] || "text-bg-secondary"}`}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Link href="/admin/bookings" className="btn btn-pcc-outline btn-sm mt-3">
              View All Bookings
            </Link>
          </div>
        </div>
      </div>

      {/* Room Status Board */}
      <div className="card-module" style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="room-type mb-0">🏠 Room Status Board</div>
          <Link href="/admin/rooms" className="btn btn-pcc-outline btn-sm">
            Manage Rooms
          </Link>
        </div>
        {rooms.length === 0 ? (
          <p className="text-muted small">No rooms configured yet. <Link href="/admin/rooms">Add rooms →</Link></p>
        ) : (
          <>
            <div className="d-flex flex-wrap gap-2 mb-3">
              {rooms.map((rm, idx) => (
                <div
                  key={idx}
                  title={`Room ${rm.roomNumber} — ${rm.roomType} | ${rm.status}`}
                  style={{
                    width: "54px",
                    height: "54px",
                    backgroundColor: getRoomColor(rm.status),
                    borderRadius: "8px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: "700",
                    fontSize: "0.8rem",
                    cursor: "default",
                    gap: "1px"
                  }}
                >
                  <span>{rm.roomNumber}</span>
                  <span style={{ fontSize: "0.58rem", fontWeight: "400", opacity: 0.85 }}>
                    {rm.floor === "Ground Floor" ? "GF" : "2F"}
                  </span>
                </div>
              ))}
            </div>
            <div className="d-flex flex-wrap gap-3" style={{ fontSize: "0.75rem" }}>
              <span><span style={{ display: "inline-block", width: "10px", height: "10px", backgroundColor: "#3FA34D", borderRadius: "2px", marginRight: "3px" }}></span>Available</span>
              <span><span style={{ display: "inline-block", width: "10px", height: "10px", backgroundColor: "#2155B5", borderRadius: "2px", marginRight: "3px" }}></span>Occupied</span>
              <span><span style={{ display: "inline-block", width: "10px", height: "10px", backgroundColor: "#f0a500", borderRadius: "2px", marginRight: "3px" }}></span>Reserved</span>
              <span><span style={{ display: "inline-block", width: "10px", height: "10px", backgroundColor: "#dc3545", borderRadius: "2px", marginRight: "3px" }}></span>Maintenance</span>
              <span><span style={{ display: "inline-block", width: "10px", height: "10px", backgroundColor: "#17a2b8", borderRadius: "2px", marginRight: "3px" }}></span>Cleaning</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
