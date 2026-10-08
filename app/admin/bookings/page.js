'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import StatusBadge, { getStatusBadgeStyle, BOOKING_STATUSES } from '@/app/components/StatusBadge';
import FlatDatePicker from '../../components/FlatDatePicker';
import clientCache, { CACHE_TTL } from '@/lib/clientCache';

export default function AdminBookings() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const cacheKey = `admin-bookings:${search}_${statusFilter}_${dateFilter}`;
  const initialCache = clientCache.get(cacheKey);

  const [bookings, setBookings] = useState(initialCache?.data?.bookings || []);
  const [counts, setCounts] = useState(initialCache?.data?.counts || {});
  const [loading, setLoading] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(!initialCache);
  const [error, setError] = useState('');
  const isFirstMount = useRef(true);

  const fetchBookings = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
      setError('');
    }
    try {
      const query = new URLSearchParams({
        search,
        status: statusFilter,
        date: dateFilter,
      }).toString();

      const res = await fetch(`/api/admin/bookings?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch bookings');

      const nextBookings = data.bookings || [];
      const nextCounts = data.counts || {};
      setBookings(nextBookings);
      setCounts(nextCounts);
      clientCache.set(cacheKey, { bookings: nextBookings, counts: nextCounts }, CACHE_TTL.BOOKINGS);
    } catch (err) {
      if (!isBackground) setError(err.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    const entry = clientCache.get(cacheKey);
    if (entry) {
      setBookings(entry.data?.bookings || []);
      setCounts(entry.data?.counts || {});
      setLoading(false);
      setShouldAnimate(false);
      if (entry.isStale) {
        fetchBookings(true);
      }
    } else {
      if (!isFirstMount.current) {
        setShouldAnimate(true);
      }
      fetchBookings(false);
    }
    isFirstMount.current = false;
  }, [search, statusFilter, dateFilter]);

  return (
    <div className="pcc-page-container pcc-content-reveal">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <div className="section-eyebrow">Admin</div>
          <h2 className="section-title mb-1">Booking Status Overview</h2>
          <small className="text-muted">View all booking records, room occupancy, and statuses</small>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <Link
            href="/admin/reservations"
            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 px-3 py-2 fw-semibold"
            style={{ borderRadius: '7px' }}
          >
            <i className="bi bi-bookmark"></i>
            <span>View Reservations</span>
          </Link>
          <button
            onClick={fetchBookings}
            className="btn btn-sm btn-light border d-inline-flex align-items-center gap-1 px-3 py-2 text-secondary"
            style={{ borderRadius: '7px' }}
            title="Refresh list"
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i>
            <span className="d-none d-sm-inline">Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Status Summary Cards */}
      <div className="row g-2 mb-4">
        {BOOKING_STATUSES.map((status) => {
          const badgeStyle = getStatusBadgeStyle(status);
          const isSelected = statusFilter === status;
          return (
            <div className="col-6 col-md-4 col-lg-2" key={status}>
              <div
                className="text-center p-3 rounded"
                onClick={() => setStatusFilter(isSelected ? '' : status)}
                style={{
                  backgroundColor: isSelected ? `${badgeStyle.backgroundColor}22` : `${badgeStyle.backgroundColor}12`,
                  border: `2px solid ${isSelected ? badgeStyle.backgroundColor : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: '1.6rem', fontWeight: '700', color: badgeStyle.backgroundColor }}>
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
              <option value="">All Unified Statuses</option>
              {BOOKING_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <FlatDatePicker dateFormat="Y-m-d" className="form-control" value={dateFilter} onChange={(val)=>setDateFilter(typeof val==='string'?val:val?.target?.value||'')} />
          </div>
          <div className="col-md-2 d-flex gap-2">
            <button className="btn btn-pcc-primary text-white w-100" onClick={() => { setSearch(''); setStatusFilter(''); setDateFilter(''); }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className={`card-module pcc-table-card ${shouldAnimate ? 'pcc-content-reveal' : ''}`} style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
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
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
}
