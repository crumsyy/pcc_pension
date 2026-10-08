'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import StatusBadge, { getStatusBadgeStyle, RESERVATION_STATUSES } from '@/app/components/StatusBadge';
import FlatDatePicker from '../../components/FlatDatePicker';
import clientCache, { CACHE_TTL } from '@/lib/clientCache';

export default function AdminReservations() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const cacheKey = `admin-reservations:${search}_${statusFilter}_${dateFilter}`;
  const initialCache = clientCache.get(cacheKey);

  const [reservations, setReservations] = useState(initialCache?.data?.reservations || []);
  const [counts, setCounts] = useState(initialCache?.data?.counts || {});
  const [loading, setLoading] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(!initialCache);
  const [error, setError] = useState('');
  const isFirstMount = useRef(true);

  const fetchReservations = async (isBackground = false) => {
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

      const res = await fetch(`/api/admin/reservations?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch reservations');

      const nextReservations = data.reservations || [];
      const nextCounts = data.counts || {};
      setReservations(nextReservations);
      setCounts(nextCounts);
      clientCache.set(cacheKey, { reservations: nextReservations, counts: nextCounts }, CACHE_TTL.RESERVATIONS);
    } catch (err) {
      if (!isBackground) setError(err.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    const entry = clientCache.get(cacheKey);
    if (entry) {
      setReservations(entry.data?.reservations || []);
      setCounts(entry.data?.counts || {});
      setLoading(false);
      setShouldAnimate(false);
      if (entry.isStale) {
        fetchReservations(true);
      }
    } else {
      if (!isFirstMount.current) {
        setShouldAnimate(true);
      }
      fetchReservations(false);
    }
    isFirstMount.current = false;
  }, [search, statusFilter, dateFilter]);

  return (
    <div className="pcc-page-container pcc-content-reveal">
      {/* Top Header with Switcher Button */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <div className="section-eyebrow">Admin</div>
          <h2 className="section-title mb-1">Reservation Status Overview</h2>
          <small className="text-muted">Monitor and inspect all room reservations, courtesy holds, and booking conversions</small>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <Link
            href="/admin/bookings"
            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 px-3 py-2 fw-semibold"
            style={{ borderRadius: '7px' }}
          >
            <i className="bi bi-calendar-check"></i>
            <span>View Bookings</span>
          </Link>
          <button
            onClick={fetchReservations}
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
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Status Summary KPI Cards */}
      <div className="row g-2 mb-4">
        {RESERVATION_STATUSES.map((status) => {
          const badgeStyle = getStatusBadgeStyle(status, 'reservation');
          const isSelected = statusFilter === status;
          return (
            <div className="col-6 col-md-3" key={status}>
              <div
                className="text-center p-3 rounded"
                onClick={() => setStatusFilter(isSelected ? '' : status)}
                style={{
                  backgroundColor: isSelected ? `${badgeStyle.backgroundColor}25` : `${badgeStyle.backgroundColor}12`,
                  border: `2px solid ${isSelected ? badgeStyle.backgroundColor : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <div style={{ fontSize: '1.65rem', fontWeight: '700', color: badgeStyle.backgroundColor }}>
                  {counts[status] || 0}
                </div>
                <div className="mt-1">
                  <StatusBadge status={status} type="reservation" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "10px", border: "1px solid var(--pcc-mist)" }}>
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label small fw-semibold text-muted mb-1">Search</label>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light text-muted border-end-0">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Guest name, email, contact, or room..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold text-muted mb-1">Status Filter</label>
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses ({counts.All || 0})</option>
              {RESERVATION_STATUSES.map((s) => (
                <option key={s} value={s}>{s} ({counts[s] || 0})</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold text-muted mb-1">Date Filter (Check-in)</label>
            <FlatDatePicker dateFormat="Y-m-d" className="form-control form-control-sm" value={dateFilter} onChange={(val)=>setDateFilter(typeof val==='string'?val:val?.target?.value||'')} />
          </div>
          <div className="col-md-2">
            <button
              className="btn btn-sm btn-pcc-primary text-white w-100"
              style={{ height: '31px' }}
              onClick={() => { setSearch(''); setStatusFilter(''); setDateFilter(''); }}
            >
              <i className="bi bi-x-circle me-1"></i> Clear
            </button>
          </div>
        </div>
      </div>

      {/* Reservations Table */}
      <div className={`card-module pcc-table-card ${shouldAnimate ? 'pcc-content-reveal' : ''}`} style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "10px", border: "1px solid var(--pcc-mist)" }}>
          <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-secondary">
                <tr>
                  <th style={{ width: '50px' }}>#</th>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Check-In & Check-Out</th>
                  <th>Guests & Breakfast</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {reservations.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted py-5">
                      <div className="d-flex flex-column align-items-center">
                        <i className="bi bi-bookmark-x text-secondary fs-1 mb-2"></i>
                        <span className="fw-semibold">No reservations found.</span>
                        <small className="text-muted mt-1">Try adjusting your search keywords or filter settings.</small>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reservations.map((r, i) => (
                    <tr key={r.reservationID}>
                      <td className="text-muted fw-semibold" style={{ fontSize: '0.82rem' }}>{i + 1}</td>
                      <td>
                        <div className="fw-bold text-dark">{`${r.firstName || ''} ${r.lastName || ''}`}</div>
                        <div className="small text-muted d-flex flex-column gap-0.5">
                          {r.contact && <span><i className="bi bi-telephone text-secondary me-1"></i>{r.contact}</span>}
                          {r.email && <span><i className="bi bi-envelope text-secondary me-1"></i>{r.email}</span>}
                        </div>
                      </td>
                      <td>
                        <div className="fw-bold text-primary">Room {r.roomNumber}</div>
                        <div className="small text-muted">{r.roomType} {r.floor ? `(${r.floor})` : ''}</div>
                      </td>
                      <td>
                        <div className="small">
                          <span className="fw-semibold text-dark">In:</span>{' '}
                          {r.reservationDateTime
                            ? new Date(r.reservationDateTime).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </div>
                        <div className="small text-muted">
                          <span className="fw-semibold text-secondary">Out:</span>{' '}
                          {r.checkOutDateTime
                            ? new Date(r.checkOutDateTime).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </div>
                      </td>
                      <td>
                        <div className="small fw-semibold">
                          <i className="bi bi-people me-1 text-secondary"></i>{r.guestCount} {r.guestCount === 1 ? 'Guest' : 'Guests'}
                        </div>
                        <div className="small text-muted">
                          {r.breakfastOption === 'with' ? (
                            <span className="text-success"><i className="bi bi-cup-hot me-1"></i>With Breakfast</span>
                          ) : (
                            <span className="text-muted"><i className="bi bi-cup-straw me-1"></i>No Breakfast</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={r.status} type="reservation" />
                        {r.status === 'On Hold' && r.holdExpiryDateTime && (
                          <div className="mt-1 small text-warning-emphasis" style={{ fontSize: '0.72rem' }}>
                            <i className="bi bi-clock me-1"></i>Expires:{' '}
                            {new Date(r.holdExpiryDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>
                      <td>
                        {r.bookingID ? (
                          <Link
                            href={`/admin/bookings?search=${encodeURIComponent(r.roomNumber || '')}`}
                            className="btn btn-xs btn-outline-success d-inline-flex align-items-center gap-1 py-1 px-2"
                            style={{ fontSize: '0.75rem', borderRadius: '5px' }}
                            title="View converted booking"
                          >
                            <i className="bi bi-box-arrow-up-right"></i> Booking #{r.bookingID}
                          </Link>
                        ) : (
                          <span className="text-muted small" style={{ fontSize: '0.78rem' }}>Res #{r.reservationID}</span>
                        )}
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
