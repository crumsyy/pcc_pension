import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionRole } from "@/lib/session";
import { dbQuery } from "@/lib/db";
import NotificationBell from "../../components/NotificationBell";
import GuestChatBubble from "../../components/GuestChatBubble";

export const unstable_instant = false;

export default async function GuestDashboard() {
  // Check auth and role
  const auth = await requireSessionRole("Guest");
  if (auth.redirect) {
    redirect(auth.redirect);
  }

  const { session } = auth;

  // 1. Fetch guest profile
  const guests = await dbQuery(
    "SELECT g.*, u.email, u.createdAt FROM guest g JOIN user u ON u.userID = g.userID WHERE g.userID = ?",
    [session.userID]
  );
  
  if (guests.length === 0) {
    redirect("/auth/login?error=" + encodeURIComponent("Profile details not found. Please log in again."));
  }
  const guest = guests[0];

  // 2. Fetch reservations and bookings in parallel
  const [reservations, bookings] = await Promise.all([
    dbQuery(
      `SELECT r.reservationID, r.reservationDateTime, r.status,
              rm.roomNumber, rt.type as roomType, fl.name as floor
       FROM reservation r
       JOIN room rm ON rm.roomID = r.roomID
       JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
       JOIN floor fl ON fl.floorID = rm.floorID
       WHERE r.guestID = ?
       ORDER BY r.reservationDateTime DESC LIMIT 5`,
      [guest.guestID]
    ),
    dbQuery(
      `SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status,
              rm.roomNumber, rt.type as roomType
       FROM booking b
       JOIN room rm ON rm.roomID = b.roomID
       JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
       WHERE b.guestID = ?
       ORDER BY b.checkInDateTime DESC LIMIT 5`,
      [guest.guestID]
    )
  ]);

  // Date formatting options
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const activeBookingsCount = bookings.filter(b => b.status === "Checked In").length;

  return (
    <>
      {/* NAVBAR */}
      <nav className="navbar navbar-expand-lg navbar-pcc guest-fixed-nav">
        <div className="container-fluid px-4">
          <Link href="/" className="navbar-brand d-flex align-items-center gap-2">
            <img src="/assets/images/logo.jpg" height="42" alt="PCC Logo" style={{ borderRadius: "4px" }} />
          </Link>
          <div className="d-flex align-items-center gap-3 ms-auto">
            <span className="text-muted d-none d-md-inline" style={{ fontSize: "0.9rem" }}>
              Hi, <strong className="text-blue">{guest.firstName}</strong>
            </span>
            <NotificationBell />
            <Link href="/api/auth/logout" className="btn btn-pcc-outline btn-sm">Log Out</Link>
          </div>
        </div>
      </nav>

      <div className="container py-4 guest-content-wrapper">
        {/* Welcome */}
        <div className="mb-4">
          <div className="section-eyebrow">Guest Dashboard</div>
          <h2 className="section-title">Welcome, {guest.firstName} {guest.lastName}!</h2>
        </div>

        {/* Quick stats */}
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="key-tag text-center">
              <div style={{ fontSize: "2rem", fontWeight: "700", color: "var(--pcc-blue)" }}>
                {reservations.length}
              </div>
              <div className="room-meta">Reservations</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="key-tag text-center">
              <div style={{ fontSize: "2rem", fontWeight: "700", color: "var(--pcc-blue)" }}>
                {bookings.length}
              </div>
              <div className="room-meta">Bookings</div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="key-tag text-center">
              <div style={{ fontSize: "2rem", fontWeight: "700", color: "var(--pcc-green)" }}>
                {activeBookingsCount}
              </div>
              <div className="room-meta">Currently Checked In</div>
            </div>
          </div>
        </div>

        <div className="row g-4">
          {/* Profile */}
          <div className="col-lg-4">
            <div className="key-tag h-100">
              <div className="room-type mb-3">My Profile</div>
              <table className="table table-sm table-borderless mb-3" style={{ fontSize: "0.9rem" }}>
                <tbody>
                  <tr>
                    <td className="text-muted">Name</td>
                    <td>{guest.firstName} {guest.lastName}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Email</td>
                    <td>{guest.email}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Contact</td>
                    <td>{guest.contact}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Gender</td>
                    <td>{guest.gender}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">City</td>
                    <td>{guest.city}, {guest.province}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Member Since</td>
                    <td>{formatDate(guest.createdAt)}</td>
                  </tr>
                </tbody>
              </table>
              <Link href="/guest/edit-profile" className="btn btn-pcc-outline btn-sm w-100">
                Edit Profile
              </Link>
            </div>
          </div>

          {/* Reservations */}
          <div className="col-lg-8">
            <div className="key-tag mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="room-type">My Reservations</div>
                <Link href="/#rooms" className="btn btn-pcc-primary btn-sm">
                  + New Reservation
                </Link>
              </div>
              {reservations.length === 0 ? (
                <p className="text-muted" style={{ fontSize: "0.9rem" }}>
                  No reservations yet. <Link href="/#rooms" className="text-blue">Browse rooms</Link> to get started.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle" style={{ fontSize: "0.88rem" }}>
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th>Type</th>
                        <th>Date Reserved</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map((r, index) => (
                        <tr key={index}>
                          <td>{r.roomNumber}</td>
                          <td>{r.roomType}</td>
                          <td>{formatDate(r.reservationDateTime)}</td>
                          <td>
                            <span
                              className={`badge ${
                                r.status === "Confirmed"
                                  ? "text-bg-success"
                                  : r.status === "Pending"
                                  ? "text-bg-warning"
                                  : "text-bg-secondary"
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bookings */}
            <div className="key-tag">
              <div className="room-type mb-3">My Bookings</div>
              {bookings.length === 0 ? (
                <p className="text-muted" style={{ fontSize: "0.9rem" }}>No bookings yet.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle" style={{ fontSize: "0.88rem" }}>
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th>Check-In</th>
                        <th>Check-Out</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b, index) => (
                        <tr key={index}>
                          <td>{b.roomNumber} - {b.roomType}</td>
                          <td>{formatDate(b.checkInDateTime)}</td>
                          <td>{formatDate(b.checkOutDateTime)}</td>
                          <td>
                            <span
                              className={`badge ${
                                b.status === "Confirmed"
                                  ? "text-bg-success"
                                  : b.status === "Checked In"
                                  ? "text-bg-primary"
                                  : b.status === "Checked Out"
                                  ? "text-bg-secondary"
                                  : b.status === "Pending"
                                  ? "text-bg-warning"
                                  : "text-bg-danger"
                              }`}
                            >
                              {b.status}
                            </span>
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
      </div>
      <GuestChatBubble />
    </>
  );
}
