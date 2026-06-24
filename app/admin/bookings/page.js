import Link from "next/link";
import { dbQuery } from "@/lib/db";

export default async function AdminBookings({ searchParams }) {
  // In Next.js App Router, searchParams is an object (or Promise in newer versions)
  const resolvedParams = await searchParams;
  const search = resolvedParams.search || "";
  const statusF = resolvedParams.status || "";
  const dateF = resolvedParams.date || "";

  // 1. Build query to list bookings (matches bookings.php exactly)
  let sql = `
    SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
           g.firstName, g.lastName, g.contact,
           rm.roomNumber, rt.type as roomType, fl.name as floor
    FROM booking b
    JOIN guest g ON g.guestID=b.guestID
    JOIN room rm ON rm.roomID=b.roomID
    JOIN room_type rt ON rt.roomTypeID=rm.roomTypeID
    JOIN floor fl ON fl.floorID=rm.floorID
    WHERE 1=1
  `;
  
  const params = [];
  if (search) {
    const like = `%${search}%`;
    sql += " AND (g.firstName LIKE ? OR g.lastName LIKE ? OR rm.roomNumber LIKE ?)";
    params.push(like, like, like);
  }
  if (statusF) {
    sql += " AND b.status = ?";
    params.push(statusF);
  }
  if (dateF) {
    sql += " AND DATE(b.checkInDateTime) = ?";
    params.push(dateF);
  }
  sql += " ORDER BY b.checkInDateTime DESC";

  const bookings = await dbQuery(sql, params);

  // 2. Fetch booking status counts for summary
  const countsRows = await dbQuery("SELECT status, COUNT(*) as cnt FROM booking GROUP BY status");
  const counts = {};
  countsRows.forEach(row => {
    counts[row.status] = row.cnt;
  });

  const statColors = {
    'Pending':     '#f0a500',
    'Confirmed':   '#3FA34D',
    'Checked In':  '#2155B5',
    'Checked Out': '#17a2b8',
    'Canceled':    '#dc3545',
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "Confirmed": return "#3FA34D";
      case "Checked In": return "#2155B5";
      case "Checked Out": return "#17a2b8";
      case "Pending": return "#f0a500";
      default: return "#dc3545";
    }
  };

  return (
    <>
      <div className="mb-3">
        <div className="section-eyebrow">Admin</div>
        <h2 className="section-title mb-0">Booking Status Overview</h2>
        <small className="text-muted">REQ010 — View all booking records and statuses</small>
      </div>

      {/* Status Summary */}
      <div className="row g-2 mb-4">
        {Object.entries(statColors).map(([status, color]) => (
          <div key={status} className="col">
            <Link href={`/admin/bookings?status=${encodeURIComponent(status)}`} className="text-decoration-none">
              <div
                className="text-center p-3 rounded"
                style={{
                  background: `${color}18`,
                  border: `2px solid ${statusF === status ? color : "transparent"}`,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: "1.6rem", fontWeight: "700", color }}>
                  {counts[status] || 0}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--pcc-muted)" }}>{status}</div>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {/* Search & Filter Form */}
      <div className="card-module mb-4" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <form method="GET" className="row g-2 align-items-end">
          <div className="col-md-4">
            <input
              type="text"
              name="search"
              className="form-control"
              placeholder="Search guest name or room..."
              defaultValue={search}
            />
          </div>
          <div className="col-md-3">
            <select name="status" className="form-select" defaultValue={statusF}>
              <option value="">All Status</option>
              {Object.keys(statColors).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <input
              type="date"
              name="date"
              className="form-control"
              defaultValue={dateF}
              title="Filter by check-in date"
            />
          </div>
          <div className="col-md-2 d-flex gap-2">
            <button type="submit" className="btn btn-pcc-primary w-100">Filter</button>
            <Link href="/admin/bookings" className="btn btn-pcc-outline">Clear</Link>
          </div>
        </form>
      </div>

      {/* Bookings Table */}
      <div className="card-module" style={{ backgroundColor: "#fff", padding: "1.5rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>#</th>
                <th>Guest</th>
                <th>Contact</th>
                <th>Room</th>
                <th>Floor</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted py-4">No bookings found.</td>
                </tr>
              ) : (
                bookings.map((b, index) => {
                  const badgeColor = getStatusBadgeColor(b.status);
                  return (
                    <tr key={b.bookingID}>
                      <td>{index + 1}</td>
                      <td><strong>{b.firstName} {b.lastName}</strong></td>
                      <td>{b.contact}</td>
                      <td>{b.roomNumber} — {b.roomType}</td>
                      <td>{b.floor}</td>
                      <td>
                        {new Date(b.checkInDateTime).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true
                        })}
                      </td>
                      <td>
                        {new Date(b.checkOutDateTime).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true
                        })}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: `${badgeColor}18`,
                            color: badgeColor,
                            border: `1px solid ${badgeColor}33`
                          }}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-muted" style={{ fontSize: "0.82rem" }}>
          Showing {bookings.length} booking(s)
          {statusF && <> with status <strong>{statusF}</strong></>}
        </div>
      </div>
    </>
  );
}
