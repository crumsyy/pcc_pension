import Link from "next/link";
import { dbQuery, syncRoomStatuses } from "@/lib/db";
import { requireSessionRole } from "@/lib/session";
import AutoRefresh from "@/app/components/AutoRefresh";

export default async function ReceptionistDashboard() {
  const auth = await requireSessionRole("Receptionist");
  await syncRoomStatuses(true);
  const userName = auth.session?.fullName || "Receptionist";

  // Fetch statistics, check-ins, reservations, confirmed bookings, inquiries, orders, and payment statuses in parallel
  const [
    totalCheckInsRes,
    totalCheckOutsRes,
    occupiedRoomsRes,
    availableRoomsRes,
    pendingResRes,
    underMaintenanceRoomsRes,
    checkInsList,
    pendingResList,
    rooms,
    confirmedBookingsList,
    guestInquiriesList,
    guestOrdersList
  ] = await Promise.all([
    dbQuery("SELECT COUNT(*) as count FROM booking WHERE status IN ('Checked In', 'Active Stay', 'Late Checkout', 'Pending Room Verification', 'Room Verified', 'Bill Finalized', 'Final Billing Updated', 'Paid', 'Payment Completed')"),
    dbQuery("SELECT COUNT(*) as count FROM booking WHERE DATE(checkOutDateTime) = CURDATE() AND status = 'Checked Out'"),
    dbQuery("SELECT COUNT(*) as count FROM room WHERE status = 'Occupied' AND isArchived = 0"),
    dbQuery("SELECT COUNT(*) as count FROM room WHERE status = 'Available' AND isArchived = 0"),
    dbQuery(`
      SELECT COUNT(*) as count FROM reservation 
      WHERE status IN ('Pending', 'Confirmed', 'Courtesy Hold', 'Overdue Check-In')
        AND status NOT IN ('Cancelled', 'Canceled', 'Released', 'Expired', 'No Show', 'Booked', 'Completed')
        AND NOT EXISTS (SELECT 1 FROM booking b WHERE b.reservationID = reservation.reservationID)
        AND (
          status != 'Courtesy Hold' 
          OR (holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(holdExpiryDateTime, INTERVAL 30 MINUTE))
        )
    `),
    dbQuery("SELECT COUNT(*) as count FROM room WHERE status = 'Under Maintenance' AND isArchived = 0"),
    dbQuery(`
      SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
             COALESCE(g.firstName, 'Guest') as firstName, COALESCE(g.lastName, '') as lastName, g.contact,
             rm.roomNumber, rt.type as roomType
      FROM booking b
      LEFT JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE b.status IN ('Checked In', 'Active Stay', 'Late Checkout', 'Pending Room Verification', 'Room Verified', 'Bill Finalized', 'Final Billing Updated', 'Paid', 'Payment Completed')
        AND b.status NOT IN ('Completed', 'Checked Out', 'Cancelled', 'No Show')
      ORDER BY rm.roomNumber ASC
    `),
    dbQuery(`
      SELECT r.reservationID, r.reservationDateTime, r.status, r.isCourtesyHold, r.holdExpiryDateTime,
             COALESCE(g.firstName, 'Walk-in') as firstName, COALESCE(g.lastName, 'Guest') as lastName, g.contact,
             rm.roomNumber, rt.type as roomType
      FROM reservation r
      LEFT JOIN guest g ON g.guestID = r.guestID
      JOIN room rm ON rm.roomID = r.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE r.status IN ('Pending', 'Confirmed', 'Courtesy Hold', 'Overdue Check-In')
        AND r.status NOT IN ('Cancelled', 'Canceled', 'Released', 'Expired', 'No Show', 'Booked', 'Completed')
        AND NOT EXISTS (SELECT 1 FROM booking b WHERE b.reservationID = r.reservationID)
        AND (
          r.status != 'Courtesy Hold' 
          OR (r.holdExpiryDateTime IS NULL OR NOW() <= DATE_ADD(r.holdExpiryDateTime, INTERVAL 30 MINUTE))
        )
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
    `),
    dbQuery(`
      SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
             COALESCE(g.firstName, 'Guest') as firstName, COALESCE(g.lastName, '') as lastName, g.contact,
             rm.roomNumber, rt.type as roomType
      FROM booking b
      LEFT JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE b.status IN ('Confirmed', 'Pending Check-in', 'Pending', 'Booked')
        AND b.status NOT IN ('Completed', 'Checked Out', 'Cancelled', 'No Show')
      ORDER BY b.checkInDateTime ASC
      LIMIT 10
    `),
    dbQuery(`
      SELECT inquiryID, name as guestName, email, message as subject, status, DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i') as createdAt
      FROM inquiry
      ORDER BY createdAt DESC
      LIMIT 6
    `).catch(() => []),
    dbQuery(`
      SELECT o.orderID, o.orderStatus, DATE_FORMAT(o.orderDateTime, '%Y-%m-%d %H:%i') as orderDateTime,
             g.firstName, g.lastName, rm.roomNumber
      FROM orders o
      JOIN guest g ON g.guestID = o.guestID
      LEFT JOIN booking b ON b.guestID = g.guestID AND b.status IN ('Checked In', 'Active Stay', 'Late Checkout', 'Pending Room Verification', 'Room Verified', 'Bill Finalized')
      LEFT JOIN room rm ON rm.roomID = b.roomID
      ORDER BY o.orderDateTime DESC
      LIMIT 6
    `).catch(() => [])
  ]);

  const totalCheckIns = totalCheckInsRes[0]?.count || 0;
  const totalCheckOuts = totalCheckOutsRes[0]?.count || 0;
  const occupiedRooms = occupiedRoomsRes[0]?.count || 0;
  const availableRooms = availableRoomsRes[0]?.count || 0;
  const pendingRes = pendingResRes[0]?.count || 0;
  const underMaintenanceRooms = underMaintenanceRoomsRes[0]?.count || 0;

  // Formatter helpers
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
      case "Available": return "#3FA34D";
      case "Occupied": return "#2155B5";
      case "Reserved": return "#f0a500";
      case "Under Maintenance": return "#dc3545";
      default: return "#6c757d";
    }
  };

  const stats = [
    ["Active Stays", totalCheckIns, "#2155B5"],
    ["Today's Check-outs", totalCheckOuts, "#3FA34D"],
    ["Rooms Occupied", occupiedRooms, "#e05c2a"],
    ["Rooms Available", availableRooms, "#3FA34D"],
    ["Active Reserv.", pendingRes, "#f0a500"],
    ["Under Maintenance", underMaintenanceRooms, "#dc3545"]
  ];

  return (
    <>
      <AutoRefresh interval={5000} />
      <div className="section-eyebrow">Receptionist Portal</div>
      <h2 className="section-title mb-1">Welcome, {userName}!</h2>
      <p className="text-muted mb-4" style={{ fontSize: "0.9rem" }}>
        Today — {formatDateLong(new Date())}
      </p>

      {/* Quick stats */}
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

      {/* PAYMENT STATUS BREAKDOWN SUMMARY */}
      <div className="card shadow-sm border-0 p-3 mb-4 bg-white" style={{ borderRadius: '12px' }}>
        <h6 className="fw-bold text-pcc-blue mb-3">
          <i className="bi bi-wallet2 me-2"></i> Payment Statuses Summary
        </h6>
        <div className="row g-3 text-center">
          <div className="col-3">
            <div className="p-2 border rounded bg-light">
              <div className="fw-bold text-success fs-5">{totalCheckOuts}</div>
              <small className="text-muted fw-semibold" style={{ fontSize: '0.75rem' }}>PAID (Checked Out)</small>
            </div>
          </div>
          <div className="col-3">
            <div className="p-2 border rounded bg-light">
              <div className="fw-bold text-primary fs-5">{occupiedRooms}</div>
              <small className="text-muted fw-semibold" style={{ fontSize: '0.75rem' }}>PARTIALLY PAID (In-Stay)</small>
            </div>
          </div>
          <div className="col-3">
            <div className="p-2 border rounded bg-light">
              <div className="fw-bold text-warning text-dark fs-5">{confirmedBookingsList.length}</div>
              <small className="text-muted fw-semibold" style={{ fontSize: '0.75rem' }}>PENDING CHECK-IN</small>
            </div>
          </div>
          <div className="col-3">
            <div className="p-2 border rounded bg-light">
              <div className="fw-bold text-danger fs-5">{underMaintenanceRooms}</div>
              <small className="text-muted fw-semibold" style={{ fontSize: '0.75rem' }}>OVERDUE / ISSUES</small>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Room status board */}
        <div className="col-lg-4">
          <div className="key-tag mb-4">
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
                    Under Maintenance
                  </span>
                </div>
              </>
            )}
          </div>

          {/* GUEST INQUIRIES VIEW */}
          <div className="key-tag mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="room-type">Guest Inquiries</div>
              <Link href="/receptionist/inquiries" className="btn btn-pcc-outline btn-sm">View All</Link>
            </div>
            {guestInquiriesList.length === 0 ? (
              <p className="text-muted small">No guest inquiries submitted.</p>
            ) : (
              <div className="list-group list-group-flush">
                {guestInquiriesList.map(inq => (
                  <div key={inq.inquiryID} className="list-group-item px-0 py-2 border-bottom">
                    <div className="d-flex justify-content-between align-items-center">
                      <strong className="text-dark small">{inq.guestName || 'Guest'}</strong>
                      <span className={`badge ${inq.status === 'Closed' ? 'bg-secondary' : inq.status === 'Responded' ? 'bg-success' : 'bg-warning text-dark'}`} style={{ fontSize: '0.7rem' }}>
                        {inq.status || 'Pending'}
                      </span>
                    </div>
                    <div className="small text-muted text-truncate">{inq.subject || 'Portal Inquiry'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GUEST ORDERS VIEW */}
          <div className="key-tag">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="room-type">Active Guest Orders</div>
              <Link href="/receptionist/orders" className="btn btn-pcc-outline btn-sm">View All</Link>
            </div>
            {guestOrdersList.length === 0 ? (
              <p className="text-muted small">No recent guest orders.</p>
            ) : (
              <div className="list-group list-group-flush">
                {guestOrdersList.map(ord => (
                  <div key={ord.orderID} className="list-group-item px-0 py-2 border-bottom">
                    <div className="d-flex justify-content-between align-items-center">
                      <strong className="text-dark small">Order #{ord.orderID} ({ord.firstName} {ord.lastName})</strong>
                      <span className="badge bg-info text-dark" style={{ fontSize: '0.7rem' }}>{ord.orderStatus}</span>
                    </div>
                    <div className="small text-muted">Room: {ord.roomNumber || 'N/A'} • {ord.orderDateTime}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-8">
          {/* CONFIRMED BOOKINGS VIEW */}
          <div className="key-tag mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="room-type">Confirmed Bookings (Ready for Check-In)</div>
              <Link href="/receptionist/bookings" className="btn btn-pcc-outline btn-sm">View All</Link>
            </div>
            {confirmedBookingsList.length === 0 ? (
              <div className="p-3 text-center text-muted border rounded bg-light small">
                <i className="bi bi-calendar-check me-2 text-primary"></i>No active bookings pending check-in right now.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>Guest</th>
                      <th>Room</th>
                      <th>Check-In Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confirmedBookingsList.map((b) => (
                      <tr key={b.bookingID}>
                        <td><strong>#{b.bookingID}</strong></td>
                        <td>{b.firstName} {b.lastName}</td>
                        <td><strong>Room {b.roomNumber}</strong> ({b.roomType})</td>
                        <td>{formatDateShort(b.checkInDateTime)}</td>
                        <td><span className="badge bg-warning text-dark">{b.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Currently Checked-In Rooms */}
          <div className="key-tag mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="room-type d-flex align-items-center gap-2">
                <i className="bi bi-person-check-fill text-primary"></i>
                <span>Currently In-House / Checked-In Guests ({checkInsList.length})</span>
              </div>
              <Link href="/receptionist/checkin" className="btn btn-sm btn-outline-primary fw-semibold d-flex align-items-center gap-1.5" style={{ fontSize: '0.80rem' }}>
                <i className="bi bi-box-arrow-up-right"></i>
                <span>Manage Check-In/Out</span>
              </Link>
            </div>
            {checkInsList.length === 0 ? (
              <div className="p-3 text-center text-muted border rounded bg-light small">
                <i className="bi bi-people me-2 text-primary"></i>No guests currently staying in rooms.
              </div>
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

          {/* Active Reservations & Courtesy Holds */}
          <div className="key-tag">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="room-type">Active Reservations &amp; Courtesy Holds</div>
              <Link href="/receptionist/reservations" className="btn btn-pcc-outline btn-sm">
                View All
              </Link>
            </div>
            {pendingResList.length === 0 ? (
              <div className="p-3 text-center text-muted border rounded bg-light small">
                <i className="bi bi-bookmark-check me-2 text-warning"></i>No active reservations or courtesy holds right now.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0" style={{ fontSize: "0.85rem" }}>
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Room</th>
                      <th>Reserved On</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingResList.map((r, idx) => (
                      <tr key={idx}>
                        <td>
                          {r.firstName} {r.lastName}
                          <br />
                          <small className="text-muted">{r.contact || 'No contact'}</small>
                        </td>
                        <td><strong>Room {r.roomNumber}</strong> - {r.roomType}</td>
                        <td>{formatDateShort(r.reservationDateTime)}</td>
                        <td>
                          <span 
                            className={`badge ${r.status === 'Courtesy Hold' ? 'text-white' : r.status === 'Confirmed' ? 'bg-success' : 'bg-warning text-dark'}`}
                            style={{ backgroundColor: r.status === 'Courtesy Hold' ? '#fd7e14' : undefined, fontSize: '0.72rem' }}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/receptionist/reservations?confirm=${r.reservationID}`}
                            className="btn btn-sm btn-pcc-primary"
                          >
                            Manage
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
