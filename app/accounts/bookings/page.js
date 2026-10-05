'use client';

import { useState, useEffect } from 'react';
import StatusBadge, { normalizeBookingStatus, getStatusBadgeStyle, BOOKING_STATUSES } from '@/app/components/StatusBadge';
import { GuestBookingsHistorySkeleton } from '@/app/components/skeletons/GuestSkeletons';

export default function AccountsBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [counts, setCounts] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [paymentNotice, setPaymentNotice] = useState('');

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        search,
        status: statusFilter,
        date: dateFilter,
      }).toString();

      const res = await fetch(`/api/accounts/bookings?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch bookings');

      setBookings(data.bookings || []);
      setCounts(data.counts || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [search, statusFilter, dateFilter]);

  const handleProcessPayment = async (booking) => {
    const normalized = normalizeBookingStatus(booking.status);
    if (normalized !== 'Bill Ready') {
      alert("Payment is only allowed once the bill is ready.");
      return;
    }

    try {
      const res = await fetch('/api/accounts/bookings/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingID: booking.bookingID })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process payment');

      setPaymentNotice(`Payment authorized for Booking #${booking.bookingID}. Status: Bill Ready.`);
      fetchBookings();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="container-fluid py-4" style={{ maxWidth: '1400px' }}>
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
        <div>
          <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1 mb-1" style={{ fontSize: '0.75rem' }}>
            Accounts Module
          </span>
          <h2 className="fw-bold text-dark mb-0">Booking Status &amp; Billing Management</h2>
          <small className="text-muted">Unified booking status tracking and payment controls</small>
        </div>
        <div>
          <button className="btn btn-outline-primary btn-sm fw-semibold shadow-xs" onClick={fetchBookings}>
            <i className="bi bi-arrow-clockwise me-1"></i> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {paymentNotice && (
        <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
          {paymentNotice}
          <button type="button" className="btn-close" onClick={() => setPaymentNotice('')}></button>
        </div>
      )}

      {/* Unified Status Summary Cards */}
      <div className="row g-2 mb-4">
        {BOOKING_STATUSES.map((status) => {
          const badgeStyle = getStatusBadgeStyle(status);
          const isSelected = statusFilter === status;
          return (
            <div className="col-6 col-md-4 col-lg-2" key={status}>
              <div
                className="card shadow-xs h-100 text-center p-3"
                onClick={() => setStatusFilter(isSelected ? '' : status)}
                style={{
                  cursor: 'pointer',
                  borderRadius: '10px',
                  border: isSelected ? `2px solid ${badgeStyle.backgroundColor}` : '1px solid #e2e8f0',
                  backgroundColor: isSelected ? `${badgeStyle.backgroundColor}15` : '#ffffff',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <div style={{ fontSize: '1.75rem', fontWeight: '700', color: badgeStyle.backgroundColor }}>
                  {counts[status] || 0}
                </div>
                <div className="mt-1">
                  <StatusBadge status={status} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="card shadow-xs border-0 p-3 mb-4 bg-white" style={{ borderRadius: '10px' }}>
        <div className="row g-2 align-items-center">
          <div className="col-md-5">
            <input
              type="text"
              className="form-control"
              placeholder="Search guest name, room number, or booking ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Unified Statuses</option>
              {BOOKING_STATUSES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <input
              type="date"
              className="form-control"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              title="Filter by check-in date"
            />
          </div>
          <div className="col-md-2">
            <button
              className="btn btn-secondary w-100 fw-semibold"
              onClick={() => { setSearch(''); setStatusFilter(''); setDateFilter(''); }}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      {loading ? (
        <GuestBookingsHistorySkeleton />
      ) : (
        <div className="card shadow-xs border-0 p-3 bg-white" style={{ borderRadius: '10px' }}>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.88rem' }}>
              <thead className="table-light">
                <tr>
                  <th>Booking Ref</th>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Balance Due</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center text-muted py-4">
                      No booking records found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => {
                    const balance = parseFloat(b.remainingBalance ?? b.finalBalance ?? 0);
                    const isBillReady = b.status === 'Bill Ready';

                    return (
                      <tr key={b.bookingID}>
                        <td>
                          <span className="badge bg-light text-dark border">#{b.bookingID}</span>
                        </td>
                        <td>
                          <div className="fw-bold text-dark">{b.firstName} {b.lastName}</div>
                          <small className="text-muted">{b.contact || b.email || '—'}</small>
                        </td>
                        <td>
                          <strong className="text-primary">Room {b.roomNumber}</strong>
                          <div className="small text-muted">{b.roomType} ({b.floor})</div>
                        </td>
                        <td>
                          {b.checkInDateTime ? new Date(b.checkInDateTime).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          }) : '—'}
                        </td>
                        <td>
                          {b.checkOutDateTime ? new Date(b.checkOutDateTime).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          }) : '—'}
                        </td>
                        <td>
                          <span className={`fw-bold ${balance > 0 ? 'text-danger' : 'text-success'}`}>
                            ₱{balance.toFixed(2)}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={b.status} />
                        </td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => setSelectedBooking(b)}
                              title="View Detail"
                            >
                              Details
                            </button>

                            {isBillReady && balance > 0 && (
                              <button
                                type="button"
                                className="btn btn-sm btn-success text-white fw-semibold"
                                onClick={() => handleProcessPayment(b)}
                              >
                                Accept Payment
                              </button>
                            )}

                            {!isBillReady && (
                              <button
                                type="button"
                                className="btn btn-sm btn-light text-muted border"
                                disabled
                                title="Payment is only allowed once the bill is ready."
                              >
                                Pay (Bill Not Ready)
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-dark">
                  Booking #{selectedBooking.bookingID} Details
                </h5>
                <button type="button" className="btn-close" onClick={() => setSelectedBooking(null)}></button>
              </div>
              <div className="modal-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h6 className="fw-bold mb-0 text-dark">{selectedBooking.firstName} {selectedBooking.lastName}</h6>
                    <small className="text-muted">{selectedBooking.contact} • {selectedBooking.email}</small>
                  </div>
                  <StatusBadge status={selectedBooking.status} />
                </div>

                <div className="list-group list-group-flush border rounded-3 mb-3" style={{ fontSize: '0.86rem' }}>
                  <div className="list-group-item d-flex justify-content-between">
                    <span className="text-muted">Room:</span>
                    <strong className="text-dark">Room {selectedBooking.roomNumber} ({selectedBooking.roomType})</strong>
                  </div>
                  <div className="list-group-item d-flex justify-content-between">
                    <span className="text-muted">Check-In:</span>
                    <span>{new Date(selectedBooking.checkInDateTime).toLocaleString()}</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between">
                    <span className="text-muted">Check-Out:</span>
                    <span>{new Date(selectedBooking.checkOutDateTime).toLocaleString()}</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between">
                    <span className="text-muted">Balance Due:</span>
                    <span className="fw-bold text-danger">₱{parseFloat(selectedBooking.remainingBalance || 0).toFixed(2)}</span>
                  </div>
                  <div className="list-group-item d-flex justify-content-between">
                    <span className="text-muted">Unified Status:</span>
                    <strong className="text-dark">{selectedBooking.status}</strong>
                  </div>
                </div>

                {selectedBooking.status !== 'Bill Ready' ? (
                  <div className="alert alert-warning py-2 small mb-0">
                    <i className="bi bi-info-circle me-1"></i>
                    Payment is restricted: The bill is not yet ready. Receptionist finalization required.
                  </div>
                ) : (
                  <div className="alert alert-success py-2 small mb-0">
                    <i className="bi bi-check-circle me-1"></i>
                    Bill is ready for settlement.
                  </div>
                )}
              </div>
              <div className="modal-footer border-top">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedBooking(null)}>
                  Close
                </button>
                {selectedBooking.status === 'Bill Ready' && parseFloat(selectedBooking.remainingBalance || 0) > 0 && (
                  <button
                    type="button"
                    className="btn btn-success text-white fw-bold"
                    onClick={() => {
                      handleProcessPayment(selectedBooking);
                      setSelectedBooking(null);
                    }}
                  >
                    Process Payment
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
