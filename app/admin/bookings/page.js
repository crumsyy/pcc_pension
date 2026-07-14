'use client';

import { useState, useEffect } from 'react';

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [counts, setCounts] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const statColors = {
    'Pending': '#f0a500',
    'Confirmed': '#3FA34D',
    'Checked In': '#2155B5',
    'Checked Out': '#17a2b8',
    'Canceled': '#dc3545',
  };

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        search,
        status: statusFilter,
        date: dateFilter,
      }).toString();

      const res = await fetch(`/api/admin/bookings?${query}`);
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

  return (
    <div>
      <div className="mb-3">
        <div className="section-eyebrow">Admin</div>
        <h2 className="section-title mb-0">Booking Status Overview</h2>
        <small className="text-muted">View all booking records and statuses</small>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Status Summary Cards */}
      <div className="row g-2 mb-4">
        {Object.entries(statColors).map(([status, color]) => (
          <div className="col" key={status}>
            <div
              className="text-center p-3 rounded"
              onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
              style={{
                backgroundColor: color + '18',
                border: `2px solid ${statusFilter === status ? color : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '1.6rem', fontWeight: '700', color: color }}>
                {counts[status] || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--pcc-muted)' }}>{status}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <input
              type="text"
              className="form-control"
              placeholder="Search guest name or room..."
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
              <option value="">All Status</option>
              {Object.keys(statColors).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <input
              type="date"
              className="form-control"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              title="Filter by check-in date"
            />
          </div>
          <div className="col-md-2 d-flex gap-2">
            <button className="btn btn-pcc-outline w-100" onClick={() => { setSearch(''); setStatusFilter(''); setDateFilter(''); }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="card-module" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            <table className="table align-middle mb-0">
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
                    <td colSpan="8" className="text-center text-muted py-4">
                      No bookings found.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b, i) => (
                    <tr key={b.bookingID}>
                      <td>{i + 1}</td>
                      <td>
                        <strong>{`${b.firstName || ''} ${b.lastName || ''}`}</strong>
                      </td>
                      <td>{b.contact || '—'}</td>
                      <td>{`${b.roomNumber} — ${b.roomType}`}</td>
                      <td>{b.floor}</td>
                      <td>
                        {new Date(b.checkInDateTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>
                        {new Date(b.checkOutDateTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: (statColors[b.status] || '#6c757d') + '18',
                            color: statColors[b.status] || '#6c757d',
                            border: `1px solid ${(statColors[b.status] || '#6c757d')}33`,
                            padding: '0.4em 0.8em',
                          }}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
