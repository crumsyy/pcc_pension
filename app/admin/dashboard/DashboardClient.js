'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

import { AdminDashboardSkeleton } from '@/app/components/skeletons/AdminSkeletons';
import clientCache, { CACHE_TTL } from '@/lib/clientCache';

export default function DashboardClient({ userName }) {
  const cached = clientCache.get('admin-dashboard');
  const [stats, setStats] = useState(cached ? cached.data : null);
  const [loading, setLoading] = useState(!cached);
  const [shouldAnimate, setShouldAnimate] = useState(!cached);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [resetting, setResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetFeedback, setResetFeedback] = useState(null);

  const handleExecuteReset = async () => {
    setResetting(true);
    try {
      let res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.status === 404) {
        res = await fetch('/api/admin/reset-transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setResetFeedback(data);
      clientCache.invalidate('admin-dashboard');
      await fetchDashboardStats(false);
    } catch (err) {
      alert('Error during reset: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  const fetchDashboardStats = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await fetch('/api/admin/dashboard', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch dashboard data');
      setStats(data);
      clientCache.set('admin-dashboard', data, CACHE_TTL.DASHBOARD);
      if (!isBackground) setError('');
    } catch (err) {
      if (!isBackground) setError(err.message);
      else console.warn('Background dashboard refresh error:', err.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    const currentCached = clientCache.get('admin-dashboard');
    if (!currentCached) {
      fetchDashboardStats(false);
    } else if (currentCached.isStale) {
      fetchDashboardStats(true);
    }
    // Clock updates
    const updateTime = () => {
      const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
      setCurrentTime(new Date().toLocaleDateString('en-US', options));
    };
    updateTime();
    const clockTimer = setInterval(updateTime, 1000);

    // Real-time polling every 3.5 seconds when tab is active and not resetting
    const pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !resetting && !showResetModal) {
        fetchDashboardStats(true);
      }
    }, 3500);

    const handleFocus = () => {
      if (!resetting && !showResetModal) fetchDashboardStats(true);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !resetting && !showResetModal) {
        fetchDashboardStats(true);
      }
    };

    const handleSync = () => {
      if (!resetting && !showResetModal) fetchDashboardStats(true);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pcc-inventory-sync', handleSync);

    let bc;
    try {
      bc = new BroadcastChannel('pcc_inventory_sync');
      bc.onmessage = () => {
        handleSync();
      };
    } catch (e) {}

    return () => {
      clearInterval(clockTimer);
      clearInterval(pollTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pcc-inventory-sync', handleSync);
      if (bc) {
        try { bc.close(); } catch (e) {}
      }
    };
  }, [resetting, showResetModal]);

  if (loading) {
    return <AdminDashboardSkeleton userName={userName} />;
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
    <div className={shouldAnimate ? 'pcc-content-reveal' : ''}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="section-eyebrow">Administrator</div>
          <h2 className="section-title mb-0">Welcome, {userName || 'Admin'}!</h2>
          <div className="d-flex align-items-center gap-2 mt-1">
            <small className="text-muted">{currentTime}</small>
            <span className="badge bg-success-subtle text-success border border-success-subtle d-inline-flex align-items-center gap-1 px-2 py-0.5" style={{ fontSize: '0.68rem' }}>
              <span className="spinner-grow spinner-grow-sm text-success" style={{ width: '6px', height: '6px' }} role="status"></span>
              Live Sync
            </span>
          </div>
        </div>
        <div>
          <button 
            type="button" 
            className="btn btn-outline-danger btn-sm fw-bold d-flex align-items-center gap-1 shadow-xs"
            onClick={() => { setResetFeedback(null); setShowResetModal(true); }}
            title="Testing utility: Reset transaction tables to #00001"
          >
            <i className="bi bi-arrow-counterclockwise"></i> Reset Transaction Records (Testing Only)
          </button>
        </div>
      </div>





      {/* Room Status Cards */}
      <div className="row g-3 mb-3">
        {[
          ['Total Rooms', totalRooms, '#2155B5'],
          ['Available', roomStats['Available'] || 0, '#2155B5'],
          ['Occupied', roomStats['Occupied'] || 0, '#2155B5'],
          ['Reserved', roomStats['Reserved'] || 0, '#2155B5'],
          ['Maintenance', roomStats['Under Maintenance'] || 0, '#2155B5'],
          ['Cleaning', roomStats['Cleaning'] || 0, '#2155B5'],
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
              Month Revenue
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2155B5' }}>
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
              Check-Ins Today
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2155B5' }}>
              {todayCheckIn}
            </div>
          </div>
        </div>
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
              Check-Outs Today
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2155B5' }}>
              {todayCheckOut}
            </div>
          </div>
        </div>
      </div>

      {/* Main Splits */}
      <div className="row g-4 mb-4">
        {/* Left Column: Recent reservations and bookings */}
        <div className="col-lg-6">
          {/* Reservations and Booking List status Card */}
          <div
            className="card-module p-3 rounded"
            style={{ backgroundColor: '#fff', border: '1px solid var(--pcc-mist)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h5 className="mb-0 text-blue fw-bold" style={{ fontSize: '1.05rem' }}>Active Reservations and Bookings</h5>
              <div className="d-flex gap-2">
                <Link
                  href="/admin/reservations"
                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 px-2.5 py-1"
                  style={{ fontSize: '0.78rem', borderRadius: '6px' }}
                >
                  <i className="bi bi-bookmark"></i>
                  Reservations
                </Link>
                <Link
                  href="/admin/bookings"
                  className="btn btn-sm btn-pcc-primary text-white d-inline-flex align-items-center gap-1 px-2.5 py-1"
                  style={{ fontSize: '0.78rem', borderRadius: '6px' }}
                >
                  <i className="bi bi-calendar-check"></i>
                  Bookings
                </Link>
              </div>
            </div>
            
            {/* Active Reservations Section */}
            {(() => {
              const activeResList = (recentRes || []).filter(r => !['Cancelled', 'Canceled', 'Released', 'Expired', 'No Show', 'Booked', 'Completed'].includes(r.status));
              return (
                <div className="mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fw-bold text-secondary mb-0" style={{ fontSize: '0.85rem' }}>
                      <i className="bi bi-bookmark-fill text-warning me-1.5"></i> Active Reservations ({activeResList.length})
                    </h6>
                  </div>
                  {activeResList.length === 0 ? (
                    <div className="p-3 text-center text-muted border rounded bg-light small">
                      <i className="bi bi-bookmark-check me-2 text-warning"></i>No active reservations right now.
                    </div>
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
                          {activeResList.map((r) => (
                            <tr key={r.reservationID}>
                              <td>{`${r.firstName || ''} ${r.lastName || ''}`}</td>
                              <td><strong>{r.roomNumber}</strong> - {r.type}</td>
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
                                      : r.status === 'Courtesy Hold'
                                      ? 'text-bg-warning text-dark'
                                      : 'text-bg-primary'
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
              );
            })()}

            {/* Active Stays & Bookings Section */}
            {(() => {
              const activeBookingsList = (recentBookings || []).filter(b => !['Completed', 'Checked Out', 'Cancelled', 'No Show'].includes(b.status));
              return (
                <div className="mb-2">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fw-bold text-secondary mb-0" style={{ fontSize: '0.85rem' }}>
                      <i className="bi bi-house-door-fill text-primary me-1.5"></i> Active Stays & Bookings ({activeBookingsList.length})
                    </h6>
                  </div>
                  {activeBookingsList.length === 0 ? (
                    <div className="p-3 text-center text-muted border rounded bg-light small">
                      <i className="bi bi-calendar-check me-2 text-primary"></i>No active bookings right now.
                    </div>
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
                          {activeBookingsList.map((b) => (
                            <tr key={b.bookingID}>
                              <td>{`${b.firstName || ''} ${b.lastName || ''}`}</td>
                              <td><strong>{b.roomNumber}</strong> - {b.type}</td>
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
                                <span className={`badge ${
                                  ['Checked In', 'Active Stay'].includes(b.status)
                                    ? 'text-bg-primary'
                                    : ['Confirmed', 'Pending Check-in'].includes(b.status)
                                    ? 'text-bg-warning text-dark'
                                    : ['Bill Finalized', 'Room Verified', 'Payment Completed', 'Paid'].includes(b.status)
                                    ? 'text-bg-success'
                                    : 'text-bg-secondary'
                                }`}>
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
              );
            })()}

          </div>
          </div>

        {/* Right Column: Room Board */}
        <div className="col-lg-6">
          <div
            className="card-module p-3 rounded h-100"
            style={{ backgroundColor: '#fff', border: '1px solid var(--pcc-mist)' }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0 text-blue">Housekeeping & Room Status Board</h5>
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
                  <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
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

      {/* RESET TRANSACTION RECORDS MODAL */}
      {showResetModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '12px' }}>
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold d-flex align-items-center flex-wrap gap-2">
                  <i className="bi bi-exclamation-triangle-fill"></i> Clean Reset — Transaction Records Only
                  <span className="badge bg-warning text-dark fw-bold" style={{ fontSize: '0.75rem' }}>FOR TESTING ONLY</span>
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowResetModal(false)} disabled={resetting}></button>
              </div>
              <div className="modal-body p-4">
                {resetFeedback ? (
                  <div className="text-center py-3">
                    <div className="rounded-circle bg-success-subtle text-success d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '64px', height: '64px', fontSize: '2rem' }}>
                      <i className="bi bi-check-lg"></i>
                    </div>
                    <h4 className="fw-bold text-success mb-2">Reset Completed Successfully!</h4>
                    <p className="text-muted small mb-4">{resetFeedback.message}</p>

                    <div className="row g-2 text-start p-3 bg-light rounded border mb-3" style={{ fontSize: '0.82rem' }}>
                      <div className="col-6"><strong>Next Reservation ID:</strong> <span className="text-primary font-monospace">{resetFeedback.nextIDs?.reservationID}</span></div>
                      <div className="col-6"><strong>Next Booking ID:</strong> <span className="text-primary font-monospace">{resetFeedback.nextIDs?.bookingID}</span></div>
                      <div className="col-6"><strong>Next Transaction ID:</strong> <span className="text-primary font-monospace">{resetFeedback.nextIDs?.transactionID}</span></div>
                      <div className="col-6"><strong>Next Order ID:</strong> <span className="text-primary font-monospace">{resetFeedback.nextIDs?.orderID}</span></div>
                      <div className="col-12 mt-2 pt-2 border-top text-success fw-bold">
                        ✓ {resetFeedback.roomsResetToAvailable} Rooms released back to Available. Master accounts & inventory intact.
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="alert alert-warning py-3 small mb-3 border-start border-warning border-4 shadow-xs">
                      <div className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
                        <i className="bi bi-info-circle-fill text-warning fs-5"></i>
                        <span>NOTICE: FOR TESTING & DEMONSTRATION PURPOSES ONLY</span>
                      </div>
                      <div className="text-dark">
                        This database reset utility is provided strictly for testing, capstone evaluations, and demonstration purposes to purge demo transactions back to <code>#00001</code>. Master administrative logins, room inventory, product/meal catalogs, and pricing configurations will remain intact.
                      </div>
                    </div>

                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <div className="p-3 bg-danger-subtle rounded border border-danger-subtle h-100" style={{ fontSize: '0.82rem' }}>
                          <h6 className="fw-bold text-danger mb-2">Tables to Truncate (Reset to 1):</h6>
                          <ul className="mb-0 ps-3 text-dark">
                            <li>Reservations (starts at <code>RV00001</code>)</li>
                            <li>Bookings (starts at <code>BK00001</code>)</li>
                            <li>Payments (starts at <code>TRA00001</code>)</li>
                            <li>Orders (starts at <code>ORD00001</code>)</li>
                            <li>Billing Invoices & Line Items</li>
                            <li>Borrow Transactions & Inquiries</li>
                            <li>Occupied/Reserved rooms → <code>Available</code></li>
                          </ul>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="p-3 bg-success-subtle rounded border border-success-subtle h-100" style={{ fontSize: '0.82rem' }}>
                          <h6 className="fw-bold text-success mb-2">Master Data Preserved (Unchanged):</h6>
                          <ul className="mb-0 ps-3 text-dark">
                            <li>User & Admin Logins</li>
                            <li>Registered Guest & Staff Profiles</li>
                            <li>Rooms, Room Types, & Rates</li>
                            <li>Products & Cooked Meals Catalog</li>
                            <li>Amenities Inventory & Categories</li>
                            <li>Discounts & Promotions Settings</li>
                            <li>Purchase Orders & Batch Records</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <p className="text-muted small mb-0">
                      Are you sure you want to perform a clean transactional reset? This is irreversible.
                    </p>
                  </>
                )}
              </div>
              <div className="modal-footer">
                {resetFeedback ? (
                  <button type="button" className="btn btn-primary text-white fw-bold" onClick={() => setShowResetModal(false)}>
                    Done & View Dashboard
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn btn-secondary text-white" onClick={() => setShowResetModal(false)} disabled={resetting}>
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-danger text-white fw-bold d-flex align-items-center gap-1"
                      disabled={resetting}
                      onClick={handleExecuteReset}
                    >
                      {resetting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1"></span>
                          Resetting Tables...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-arrow-counterclockwise"></i> Confirm Clean Reset (Testing Only)
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
