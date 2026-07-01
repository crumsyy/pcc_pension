'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DashboardClient({ userName }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState('');

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch dashboard data');
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    // Clock updates
    const updateTime = () => {
      const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
      setCurrentTime(new Date().toLocaleDateString('en-US', options));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center py-5" style={{ minHeight: '50vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading Dashboard...</span>
          </div>
          <p className="text-muted mt-3 fw-semibold">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <strong>Error loading dashboard:</strong> {error}
      </div>
    );
  }

  const {
    roomStats = {},
    totalRooms = 0,
    todayRevenue = 0,
    monthRevenue = 0,
    todayCheckIn = 0,
    todayCheckOut = 0,
    lowStockCount = 0,
    pendingResCount = 0,
    rooms = [],
    recentRes = [],
    recentBookings = [],
  } = stats || {};

  const roomStatusColors = {
    'Available': '#3FA34D',
    'Occupied': '#2155B5',
    'Reserved': '#f0a500',
    'Under Maintenance': '#dc3545',
    'Cleaning': '#17a2b8',
  };

  const totalRoomsCount = rooms ? rooms.length : 0;
  const cleanedCount = rooms ? rooms.filter(rm => ['Available', 'Occupied', 'Reserved'].includes(rm.status)).length : 0;
  const notCleanedCount = rooms ? rooms.filter(rm => ['Cleaning', 'Under Maintenance'].includes(rm.status)).length : 0;
  const cleanedPercent = totalRoomsCount > 0 ? Math.round((cleanedCount / totalRoomsCount) * 100) : 0;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="section-eyebrow">Administrator</div>
          <h2 className="section-title mb-0">Welcome, {userName || 'Admin'}!</h2>
          <small className="text-muted">{currentTime}</small>
        </div>
      </div>

      {/* System Alerts */}
      {lowStockCount > 0 && (
        <div className="alert alert-warning d-flex align-items-center gap-2 mb-2 shadow-sm" role="alert">
          <span>
            ⚠ <strong>{lowStockCount} item(s)</strong> are running low on stock.
          </span>
          <Link href="/admin/inventory" className="ms-auto btn btn-sm btn-warning">
            View Alerts
          </Link>
        </div>
      )}
      {pendingResCount > 0 && (
        <div className="alert alert-info d-flex align-items-center gap-2 mb-2 shadow-sm" role="alert">
          <span>
            📅 <strong>{pendingResCount} reservation(s)</strong> are awaiting confirmation.
          </span>
          <Link href="/admin/bookings?status=Pending" className="ms-auto btn btn-sm btn-primary text-white">
            View
          </Link>
        </div>
      )}
      {todayCheckIn > 0 && (
        <div className="alert alert-success d-flex align-items-center gap-2 mb-2 shadow-sm" role="alert">
          <span>
            ✅ <strong>{todayCheckIn} guest(s)</strong> are scheduled to check in today.
          </span>
        </div>
      )}

      {/* Room Status Cards */}
      <div className="row g-3 mb-3">
        {[
          ['Total Rooms', totalRooms, '#2155B5'],
          ['Available', roomStats['Available'] || 0, '#3FA34D'],
          ['Occupied', roomStats['Occupied'] || 0, '#1a3c8f'],
          ['Reserved', roomStats['Reserved'] || 0, '#f0a500'],
          ['Maintenance', roomStats['Under Maintenance'] || 0, '#dc3545'],
          ['Cleaning', roomStats['Cleaning'] || 0, '#17a2b8'],
        ].map(([label, val, color], idx) => (
          <div className="col-6 col-md-4 col-xl-2" key={idx}>
            <div
              className="stat-card text-center text-white p-3 rounded"
              style={{ backgroundColor: color }}
            >
              <div style={{ fontSize: '2rem', fontWeight: '700' }}>{val}</div>
              <div style={{ fontSize: '0.75rem', opacity: '0.9' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue + Today's Activity */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div
            className="card-module h-100 p-3 rounded"
            style={{
              backgroundColor: '#fff',
              borderLeft: '4px solid #2155B5',
              borderTop: '1px solid var(--pcc-mist)',
              borderRight: '1px solid var(--pcc-mist)',
              borderBottom: '1px solid var(--pcc-mist)',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--pcc-muted)',
                fontFamily: 'var(--font-tag)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              Today's Revenue
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2155B5' }}>
              ₱{todayRevenue.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div
            className="card-module h-100 p-3 rounded"
            style={{
              backgroundColor: '#fff',
              borderLeft: '4px solid #3FA34D',
              borderTop: '1px solid var(--pcc-mist)',
              borderRight: '1px solid var(--pcc-mist)',
              borderBottom: '1px solid var(--pcc-mist)',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--pcc-muted)',
                fontFamily: 'var(--font-tag)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              Month Revenue
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#3FA34D' }}>
              ₱{monthRevenue.toFixed(2)}
            </div>
            <Link
              href="/admin/reports?report=sales"
              className="btn btn-sm btn-pcc-outline mt-2 w-100"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
            >
              Full Report
            </Link>
          </div>
        </div>
        <div className="col-md-3">
          <div
            className="card-module h-100 p-3 rounded"
            style={{
              backgroundColor: '#fff',
              borderLeft: '4px solid #f0a500',
              borderTop: '1px solid var(--pcc-mist)',
              borderRight: '1px solid var(--pcc-mist)',
              borderBottom: '1px solid var(--pcc-mist)',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--pcc-muted)',
                fontFamily: 'var(--font-tag)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              Check-Ins Today
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#f0a500' }}>
              {todayCheckIn}
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div
            className="card-module h-100 p-3 rounded"
            style={{
              backgroundColor: '#fff',
              borderLeft: '4px solid #17a2b8',
              borderTop: '1px solid var(--pcc-mist)',
              borderRight: '1px solid var(--pcc-mist)',
              borderBottom: '1px solid var(--pcc-mist)',
            }}
          >
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--pcc-muted)',
                fontFamily: 'var(--font-tag)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              Check-Outs Today
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#17a2b8' }}>
              {todayCheckOut}
            </div>
          </div>
        </div>
      </div>

      {/* Main Splits */}
      <div className="row g-4 mb-4">
        {/* Left Column: Recent reservations and bookings */}
        <div className="col-lg-6">
          {/* Recent Reservations */}
          <div
            className="card-module mb-4 p-3 rounded"
            style={{ backgroundColor: '#fff', border: '1px solid var(--pcc-mist)' }}
          >
            <h5 className="mb-3 text-blue">📅 Booking & Reservation Status — Recent Reservations (REQ010)</h5>
            {recentRes.length === 0 ? (
              <p className="text-muted small">No recent reservations.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Room</th>
                      <th>Reserved Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRes.map((r) => (
                      <tr key={r.reservationID}>
                        <td>{`${r.firstName || ''} ${r.lastName || ''}`}</td>
                        <td>{`${r.roomNumber} - ${r.type}`}</td>
                        <td>
                          {new Date(r.reservationDateTime).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              r.status === 'Confirmed'
                                ? 'text-bg-success'
                                : r.status === 'Canceled'
                                ? 'text-bg-danger'
                                : 'text-bg-warning'
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
            <Link href="/admin/bookings" className="btn btn-pcc-outline btn-sm mt-3">
              View Bookings Board
            </Link>
          </div>

          {/* Recent Bookings */}
          <div
            className="card-module p-3 rounded"
            style={{ backgroundColor: '#fff', border: '1px solid var(--pcc-mist)' }}
          >
            <h5 className="mb-3 text-blue">🛏 Booking & Reservation Status — Recent Bookings (REQ010)</h5>
            {recentBookings.length === 0 ? (
              <p className="text-muted small">No recent bookings.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.82rem' }}>
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
                    {recentBookings.map((b) => (
                      <tr key={b.bookingID}>
                        <td>{`${b.firstName || ''} ${b.lastName || ''}`}</td>
                        <td>{`${b.roomNumber} - ${b.type}`}</td>
                        <td>
                          {new Date(b.checkInDateTime).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td>
                          {new Date(b.checkOutDateTime).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td>
                          <span className="badge text-bg-secondary">{b.status}</span>
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

        {/* Right Column: Room Board */}
        <div className="col-lg-6">
          <div
            className="card-module p-3 rounded h-100"
            style={{ backgroundColor: '#fff', border: '1px solid var(--pcc-mist)' }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0 text-blue">🏠 Housekeeping & Room Status Board (REQ011)</h5>
              <Link href="/admin/rooms" className="btn btn-pcc-outline btn-sm" style={{ fontSize: '0.78rem' }}>
                Manage Rooms
              </Link>
            </div>
            {rooms.length === 0 ? (
              <p className="text-muted small">No rooms configured.</p>
            ) : (
              <>
                <div className="row align-items-center g-3">
                  {/* Left Column: Visual Grid of rooms */}
                  <div className="col-md-7">
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {rooms.map((rm) => {
                        const color = roomStatusColors[rm.status] || '#6c757d';
                        return (
                          <div
                            key={rm.roomNumber}
                            title={`Room ${rm.roomNumber} — ${rm.roomType} | ${rm.status}`}
                            style={{
                              width: '54px',
                              height: '54px',
                              backgroundColor: color,
                              borderRadius: '8px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontWeight: '700',
                              fontSize: '0.8rem',
                              cursor: 'default',
                              gap: '1px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            }}
                          >
                            <span>{rm.roomNumber}</span>
                            <span style={{ fontSize: '0.58rem', fontWeight: '400', opacity: 0.85 }}>
                              {rm.floor === 'Ground Floor' ? 'GF' : '2F'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div className="d-flex flex-wrap gap-2 mt-2" style={{ fontSize: '0.7rem' }}>
                      {Object.entries(roomStatusColors).map(([status, color]) => (
                        <span key={status} className="d-flex align-items-center me-2 mb-1">
                          <span
                            style={{
                              display: 'inline-block',
                              width: '10px',
                              height: '10px',
                              backgroundColor: color,
                              borderRadius: '2px',
                              marginRight: '4px',
                            }}
                          ></span>
                          {status}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Housekeeping Pie/Donut Chart */}
                  <div className="col-md-5 text-center border-start ps-md-3">
                    <h6 className="fw-bold text-muted mb-3" style={{ fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Housekeeping Status
                    </h6>
                    {totalRoomsCount === 0 ? (
                      <p className="text-muted small">No data</p>
                    ) : (
                      <>
                        <div style={{ position: 'relative', width: '110px', height: '110px', margin: '0 auto' }}>
                          <div style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            background: `conic-gradient(#3FA34D 0% ${cleanedPercent}%, #dc3545 ${cleanedPercent}% 100%)`,
                            boxShadow: '0 3px 6px rgba(0,0,0,0.08)'
                          }}></div>
                          <div style={{
                            position: 'absolute',
                            top: '15%',
                            left: '15%',
                            width: '70%',
                            height: '70%',
                            borderRadius: '50%',
                            backgroundColor: '#fff',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1F2A24' }}>{totalRoomsCount}</span>
                            <span style={{ fontSize: '0.55rem', color: 'var(--pcc-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Rooms</span>
                          </div>
                        </div>
                        
                        {/* Donut Chart Legend */}
                        <div className="d-flex flex-column gap-1 align-items-center mt-3" style={{ fontSize: '0.72rem' }}>
                          <div className="d-flex align-items-center gap-1">
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#3FA34D', borderRadius: '50%' }}></span>
                            <span className="fw-semibold">Cleaned:</span>
                            <span className="text-muted">{cleanedCount} ({cleanedPercent}%)</span>
                          </div>
                          <div className="d-flex align-items-center gap-1">
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#dc3545', borderRadius: '50%' }}></span>
                            <span className="fw-semibold">Not Cleaned:</span>
                            <span className="text-muted">{notCleanedCount} ({100 - cleanedPercent}%)</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Detailed Housekeeping & Room Status Table */}
                <div className="mt-4 pt-3 border-top">
                  <h6 className="mb-2 fw-bold text-secondary" style={{ fontSize: '0.85rem' }}>Detailed Status List</h6>
                  <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.78rem' }}>
                      <thead className="sticky-top bg-white" style={{ zIndex: 1 }}>
                        <tr>
                          <th>Room</th>
                          <th>Floor</th>
                          <th>Room Type</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rooms.map((rm) => (
                          <tr key={rm.roomNumber}>
                            <td className="fw-bold">Room {rm.roomNumber}</td>
                            <td>{rm.floor}</td>
                            <td>{rm.roomType}</td>
                            <td>
                              <span
                                className={`badge ${
                                  rm.status === 'Available' ? 'text-bg-success' :
                                  rm.status === 'Occupied' ? 'text-bg-primary' :
                                  rm.status === 'Reserved' ? 'text-bg-warning text-dark' :
                                  rm.status === 'Cleaning' ? 'text-bg-info text-white' : 'text-bg-danger'
                                }`}
                              >
                                {rm.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
