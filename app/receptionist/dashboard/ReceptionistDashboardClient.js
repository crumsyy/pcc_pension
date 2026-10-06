'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { clientCache, CACHE_TTL } from '@/lib/clientCache';

export default function ReceptionistDashboardClient({ initialData }) {
  const [data, setData] = useState(() => {
    return clientCache.get('RECEPTIONIST_DASHBOARD')?.data || initialData || {};
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const isFetchingRef = useRef(false);

  const fetchDashboardData = useCallback(async (showIndicator = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (showIndicator) setIsRefreshing(true);

    try {
      const res = await fetch('/api/receptionist/dashboard', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setData(prev => ({
            ...prev,
            ...json
          }));
          clientCache.set('RECEPTIONIST_DASHBOARD', json, CACHE_TTL.RECEPTIONIST_DASHBOARD);
          setLastUpdated(new Date());
        }
      }
    } catch (err) {
      console.error('Failed to sync receptionist dashboard:', err);
    } finally {
      isFetchingRef.current = false;
      if (showIndicator) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // 3-second real-time polling
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchDashboardData(false);
      }
    }, 3000);

    const handleFocus = () => fetchDashboardData(false);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchDashboardData(false);
    };
    const handleCustomEvent = () => fetchDashboardData(true);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pcc-refresh-dashboard', handleCustomEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pcc-refresh-dashboard', handleCustomEvent);
    };
  }, [fetchDashboardData]);

  const {
    userName = 'Receptionist',
    totalCheckIns = 0,
    totalCheckOuts = 0,
    occupiedRooms = 0,
    availableRooms = 0,
    pendingRes = 0,
    underMaintenanceRooms = 0,
    checkInsList = [],
    pendingResList = [],
    rooms = [],
    confirmedBookingsList = [],
    guestInquiriesList = [],
    guestOrdersList = []
  } = data;

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '';
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
    ["Today's Check-outs", totalCheckOuts, "#2155B5"],
    ["Rooms Occupied", occupiedRooms, "#2155B5"],
    ["Rooms Available", availableRooms, "#2155B5"],
    ["Active Reserv.", pendingRes, "#2155B5"],
    ["Under Maintenance", underMaintenanceRooms, "#2155B5"]
  ];

  return (
    <div className="pcc-content-reveal">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <div className="section-eyebrow">Receptionist Portal</div>
          <h2 className="section-title mb-1">Welcome, {userName}!</h2>
          <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: "0.88rem" }}>
            <span>Today — {formatDateLong(new Date())}</span>
            <span>•</span>
            <span className="badge bg-success bg-opacity-10 text-success border border-success-subtle d-inline-flex align-items-center gap-1.5 px-2 py-0.5" style={{ fontSize: '0.72rem' }}>
              <span className="spinner-grow spinner-grow-sm text-success" style={{ width: '7px', height: '7px' }}></span>
              Live Real-Time
            </span>
          </div>
        </div>

        <button
          onClick={() => fetchDashboardData(true)}
          disabled={isRefreshing}
          className="btn btn-sm btn-pcc-outline d-inline-flex align-items-center gap-1.5 shadow-xs"
          style={{ fontSize: '0.80rem' }}
          title="Click to manually refresh all dashboard metrics"
        >
          <i className={`bi bi-arrow-repeat ${isRefreshing ? 'spin-icon' : ''}`}></i>
          <span>{isRefreshing ? 'Updating...' : 'Sync Now'}</span>
        </button>
      </div>

      <style jsx global>{`
        @keyframes pccSpin {
          100% { transform: rotate(360deg); }
        }
        .spin-icon {
          animation: pccSpin 0.75s linear infinite;
        }
      `}</style>

      {/* Quick stats */}
      <div className="row g-3 mb-4">
        {stats.map(([label, value, color], index) => (
          <div key={index} className="col-6 col-md-4 col-xl-2">
            <div 
              className="p-3 bg-white shadow-sm transition-all" 
              style={{ 
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                borderLeft: `4px solid ${color}`,
                minHeight: '94px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div style={{ fontSize: "1.85rem", fontWeight: "800", lineHeight: "1.1", color: color }}>
                {value}
              </div>
              <div style={{ fontSize: "0.72rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b", marginTop: '5px' }}>
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
          <div className="col-6 col-md-3">
            <div className="p-2.5 border rounded-3 bg-light">
              <div className="fw-bold text-pcc-blue fs-5">{totalCheckOuts}</div>
              <small className="text-muted fw-semibold" style={{ fontSize: '0.75rem' }}>PAID (Checked Out)</small>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-2.5 border rounded-3 bg-light">
              <div className="fw-bold text-pcc-blue fs-5">{occupiedRooms}</div>
              <small className="text-muted fw-semibold" style={{ fontSize: '0.75rem' }}>PARTIALLY PAID (In-Stay)</small>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-2.5 border rounded-3 bg-light">
              <div className="fw-bold text-pcc-blue fs-5">{confirmedBookingsList.length}</div>
              <small className="text-muted fw-semibold" style={{ fontSize: '0.75rem' }}>PENDING CHECK-IN</small>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-2.5 border rounded-3 bg-light">
              <div className="fw-bold text-pcc-blue fs-5">{underMaintenanceRooms}</div>
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
    </div>
  );
}
