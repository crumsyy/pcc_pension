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

  const activeBooking = bookings.find(b => b.status === "Checked In");
  let activeBill = null;

  if (activeBooking) {
    const bookingID = activeBooking.bookingID;
    
    // 1. Fetch booking details
    const bookingRes = await dbQuery(`
      SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status, b.guestID, b.roomID,
             rm.roomNumber, rm.floorID, rt.type as roomType, rt.roomTypeID
      FROM booking b
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE b.bookingID = ?
    `, [bookingID]);

    if (bookingRes.length > 0) {
      const booking = bookingRes[0];

      // 2. Fetch room rate
      const rateRes = await dbQuery(
        "SELECT rate FROM room_rate WHERE roomTypeID = ? AND floorID = ? AND breakfastID = 1",
        [booking.roomTypeID, booking.floorID]
      );
      const rate = rateRes[0]?.rate || 0;

      // Calculate nights (min 1)
      const checkIn = new Date(booking.checkInDateTime);
      const checkOut = new Date(booking.checkOutDateTime);
      const diffTime = Math.abs(checkOut - checkIn);
      const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
      const roomCharge = rate * nights;

      // Early check-in fee
      let earlyCheckInFee = 0;
      const standardCheckInTime = new Date(checkIn);
      standardCheckInTime.setHours(14, 0, 0, 0);
      if (checkIn < standardCheckInTime && checkIn.toDateString() === standardCheckInTime.toDateString()) {
        const earlyHours = Math.ceil((standardCheckInTime - checkIn) / (1000 * 60 * 60));
        if (earlyHours > 0) {
          earlyCheckInFee = earlyHours * 50;
        }
      }

      // Late check-out fee
      let lateCheckOutFee = 0;
      const standardCheckOutTime = new Date(checkOut);
      standardCheckOutTime.setHours(12, 0, 0, 0);
      if (checkOut > standardCheckOutTime && checkOut.toDateString() === standardCheckOutTime.toDateString()) {
        const lateHours = Math.ceil((checkOut - standardCheckOutTime) / (1000 * 60 * 60));
        if (lateHours > 0) {
          lateCheckOutFee = lateHours * 150;
        }
      }

      // 3. Fetch product orders
      const productCharges = await dbQuery(`
        SELECT op.quantity, p.name, p.price, (op.quantity * p.price) as subtotal
        FROM order_product op
        JOIN products p ON p.productID = op.productID
        JOIN orders o ON o.orderID = op.orderID
        WHERE o.guestID = ? AND o.orderDateTime >= ? AND o.orderStatus != 'Canceled'
      `, [booking.guestID, booking.checkInDateTime]);

      // 4. Fetch amenity orders
      const amenityCharges = await dbQuery(`
        SELECT oa.quantity, a.name, a.price, (oa.quantity * a.price) as subtotal
        FROM order_amenities oa
        JOIN amenities a ON a.amenityID = oa.amenityID
        JOIN orders o ON o.orderID = oa.orderID
        WHERE o.guestID = ? AND o.orderDateTime >= ? AND o.orderStatus != 'Canceled'
      `, [booking.guestID, booking.checkInDateTime]);

      const productTotal = productCharges.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
      const amenityTotal = amenityCharges.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

      // Fetch registered guest list for this booking
      const guestsList = await dbQuery(`
        SELECT bg.*, d.name as discountName, d.percentage as discountPercentage
        FROM booking_guest_details bg
        LEFT JOIN discounts d ON d.discountID = bg.discountID
        WHERE bg.bookingID = ?
      `, [booking.bookingID]);

      let finalGuestsList = [...guestsList];
      if (finalGuestsList.length === 0) {
        finalGuestsList = [{
          bookingGuestID: 0,
          bookingID: booking.bookingID,
          fullName: `${booking.firstName} ${booking.lastName}`,
          age: 30,
          discountID: null,
          discountIdNumber: null,
          discountName: null,
          discountPercentage: 0
        }];
      }

      // Apportionment math: divide room charge equally and apply discount to senior/PWD shares
      const totalGuestsCount = finalGuestsList.length;
      const sharePerGuest = roomCharge / totalGuestsCount;
      
      finalGuestsList = finalGuestsList.map(g => {
        const discountPercentage = g.discountPercentage ? parseInt(g.discountPercentage) : 0;
        const discountAmount = sharePerGuest * (discountPercentage / 100);
        return {
          ...g,
          share: sharePerGuest,
          discount: discountAmount,
          netShare: sharePerGuest - discountAmount
        };
      });

      const totalDiscount = finalGuestsList.reduce((sum, g) => sum + g.discount, 0);
      const finalRoomCharge = roomCharge - totalDiscount;
      const totalCharges = finalRoomCharge + earlyCheckInFee + lateCheckOutFee + productTotal + amenityTotal;

      // 5. Fetch payments
      const billingRes = await dbQuery("SELECT billingID FROM billing WHERE bookingID = ?", [bookingID]);
      let paidTotal = 0;
      if (billingRes.length > 0) {
        const payments = await dbQuery("SELECT amount FROM payment WHERE billingID = ?", [billingRes[0].billingID]);
        paidTotal = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      }

      const balance = totalCharges - paidTotal;

      activeBill = {
        booking: { 
          ...booking, 
          nights, 
          rate, 
          originalRoomCharge: roomCharge,
          roomCharge: finalRoomCharge 
        },
        productCharges,
        amenityCharges,
        guestsList: finalGuestsList,
        summary: {
          room: finalRoomCharge,
          originalRoomCharge: roomCharge,
          totalDiscount,
          sharePerGuest,
          totalGuests: totalGuestsCount,
          earlyCheckIn: earlyCheckInFee,
          lateCheckOut: lateCheckOutFee,
          products: productTotal,
          amenities: amenityTotal,
          total: totalCharges,
          paid: paidTotal,
          balance: balance
        }
      };
    }
  }

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
            <a href="/api/auth/logout" className="btn btn-pcc-outline btn-sm">Log Out</a>
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

            {/* Active Stay Statement of Account */}
            {activeBill && (
              <div className="key-tag mt-4">
                <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                  <div className="room-type">Active Stay Statement of Account</div>
                  <span className="badge text-bg-primary px-3 py-2">
                    Room {activeBill.booking.roomNumber} ({activeBill.booking.roomType})
                  </span>
                </div>
                
                <div className="mb-4">
                  <div className="fw-bold text-dark mb-2" style={{ fontSize: '0.95rem' }}>Room Rent Charges</div>
                  <table className="table table-sm align-middle mb-3" style={{ fontSize: "0.85rem" }}>
                    <thead>
                      <tr className="table-light">
                        <th>Description</th>
                        <th>Rate</th>
                        <th>Nights</th>
                        <th className="text-end">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{activeBill.booking.roomType} (Room {activeBill.booking.roomNumber})</td>
                        <td>₱{parseFloat(activeBill.booking.rate).toFixed(2)}</td>
                        <td>{activeBill.booking.nights}</td>
                        <td className="text-end fw-bold text-dark">₱{parseFloat(activeBill.summary.originalRoomCharge || activeBill.booking.originalRoomCharge || activeBill.booking.roomCharge).toFixed(2)}</td>
                      </tr>
                      {activeBill.summary.totalDiscount > 0 && (
                        <tr className="table-warning small">
                          <td colSpan="3" className="ps-3 text-warning-dark">
                            <div>
                              <strong>Discount Apportionment (R.A. 9994 / R.A. 10754):</strong>
                              <ul className="mb-0 mt-1" style={{ listStyleType: 'square' }}>
                                <li>Total Registered Guests: <strong>{activeBill.summary.totalGuests} Pax</strong></li>
                                <li>Individual Guest Share: <strong>₱{parseFloat(activeBill.summary.sharePerGuest).toFixed(2)}</strong></li>
                                <li>
                                  Applied Discounts/Promotions: <strong>{activeBill.guestsList.filter(g => g.discountID).length} Guest(s)</strong> (configured discount percentage applied to their individual share)
                                </li>
                              </ul>
                            </div>
                          </td>
                          <td className="text-end fw-bold text-success align-bottom">
                            -₱{parseFloat(activeBill.summary.totalDiscount).toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {activeBill.summary.totalDiscount > 0 && (
                        <tr className="table-light">
                          <td colSpan="3" className="fw-semibold">Final Room Charge Due</td>
                          <td className="text-end fw-bold text-dark">₱{parseFloat(activeBill.summary.room).toFixed(2)}</td>
                        </tr>
                      )}
                      {activeBill.summary.earlyCheckIn > 0 && (
                        <tr>
                          <td colSpan="3" className="text-muted">Early Check-In Fee (₱50/hr before 2:00 PM)</td>
                          <td className="text-end text-danger">₱{parseFloat(activeBill.summary.earlyCheckIn).toFixed(2)}</td>
                        </tr>
                      )}
                      {activeBill.summary.lateCheckOut > 0 && (
                        <tr>
                          <td colSpan="3" className="text-muted">Late Check-Out Fee (₱150/hr after 12:00 PM)</td>
                          <td className="text-end text-danger">₱{parseFloat(activeBill.summary.lateCheckOut).toFixed(2)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Registered Guests Pax breakdown list */}
                  {activeBill.guestsList && activeBill.guestsList.length > 0 && (
                    <div className="p-3 rounded border bg-light" style={{ fontSize: '0.82rem' }}>
                      <div className="fw-bold mb-2 text-dark d-flex justify-content-between align-items-center">
                        <span>👥 Registered Room Guests ({activeBill.guestsList.length} Pax)</span>
                        <span className="small text-muted font-monospace">Room Rent split equally</span>
                      </div>
                      <div className="row g-2">
                        {activeBill.guestsList.map((g, index) => (
                          <div key={index} className="col-md-6">
                            <div className="p-2 border rounded bg-white h-100 d-flex justify-content-between align-items-center shadow-sm">
                              <div>
                                <span className="fw-semibold text-dark">{g.fullName}</span> 
                                <span className="text-muted"> ({g.age} yrs)</span>
                                {g.discountName && (
                                  <div className="text-success fw-semibold" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                                    ✓ {g.discountName} {g.discountIdNumber ? `(${g.discountIdNumber})` : ''}
                                  </div>
                                )}
                              </div>
                              <div className="text-end font-monospace ms-2">
                                {g.discount > 0 ? (
                                  <>
                                    <div className="text-decoration-line-through text-muted" style={{ fontSize: '0.72rem' }}>₱{parseFloat(g.share).toFixed(2)}</div>
                                    <div className="text-success fw-bold">₱{parseFloat(g.netShare).toFixed(2)}</div>
                                  </>
                                ) : (
                                  <div className="text-dark fw-semibold">₱{parseFloat(g.share).toFixed(2)}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <div className="fw-bold text-dark mb-2" style={{ fontSize: '0.95rem' }}>Products & Meals Ordered</div>
                  <table className="table table-sm align-middle" style={{ fontSize: "0.85rem" }}>
                    <thead>
                      <tr className="table-light">
                        <th>Item</th>
                        <th>Unit Price</th>
                        <th>Qty</th>
                        <th className="text-end">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeBill.productCharges.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="text-center py-2 text-muted small">No products ordered yet.</td>
                        </tr>
                      ) : (
                        activeBill.productCharges.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.name}</td>
                            <td>₱{parseFloat(item.price).toFixed(2)}</td>
                            <td>{item.quantity}</td>
                            <td className="text-end fw-bold text-dark">₱{parseFloat(item.subtotal).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mb-4">
                  <div className="fw-bold text-dark mb-2" style={{ fontSize: '0.95rem' }}>Extra Amenities Requested</div>
                  <table className="table table-sm align-middle" style={{ fontSize: "0.85rem" }}>
                    <thead>
                      <tr className="table-light">
                        <th>Item</th>
                        <th>Unit Price</th>
                        <th>Qty</th>
                        <th className="text-end">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeBill.amenityCharges.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="text-center py-2 text-muted small">No extra amenities requested yet.</td>
                        </tr>
                      ) : (
                        activeBill.amenityCharges.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.name}</td>
                            <td>₱{parseFloat(item.price).toFixed(2)}</td>
                            <td>{item.quantity}</td>
                            <td className="text-end fw-bold text-dark">₱{parseFloat(item.subtotal).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-light rounded" style={{ fontSize: '0.9rem' }}>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Total Charges:</span>
                    <span className="fw-semibold text-dark">₱{parseFloat(activeBill.summary.total).toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1 text-success">
                    <span>Total Amount Paid:</span>
                    <span>₱{parseFloat(activeBill.summary.paid).toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center pt-2 mt-2 border-top border-secondary-subtle">
                    <span className="fw-bold text-danger">Outstanding Balance:</span>
                    <span className="fw-bold text-danger" style={{ fontSize: '1.15rem' }}>
                      ₱{parseFloat(activeBill.summary.balance).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <GuestChatBubble />
    </>
  );
}
