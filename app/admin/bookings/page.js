'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import FlatDatePicker from '../../components/FlatDatePicker';
import AdminPagination from '../../components/AdminPagination';
import { normalizeBookingStatus } from '@/lib/bookingStatuses';
import clientCache, { CACHE_TTL } from '@/lib/clientCache';

// Overview display states: confirmed bookings read as Booked, in-house
// stays (incl. finalized/paid) as Occupied, finished as Completed,
// dead arrivals as Cancelled. Stored values are never rewritten here.
const BOOKING_OVERVIEW_STATES = ['Booked', 'Occupied', 'Completed', 'Cancelled'];

function toOverviewBookingState(rawStatus) {
  const s = String(rawStatus || '').trim();
  if (s === 'Cancelled' || s === 'Canceled') return 'Cancelled';
  if (s === 'No Show') return 'Cancelled';
  const norm = normalizeBookingStatus(s);
  if (norm === 'Completed') return 'Completed';
  if (norm === 'Occupied' || norm === 'Bill Finalized' || norm === 'Paid') return 'Occupied';
  return 'Booked';
}

function overviewBookingBadgeClass(state) {
  switch (state) {
    case 'Booked': return 'text-bg-info text-dark';
    case 'Occupied': return 'text-bg-primary';
    case 'Completed': return 'text-bg-dark';
    case 'Cancelled': return 'text-bg-danger';
    default: return 'text-bg-secondary';
  }
}

export default function AdminBookings() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState(search);
  const searchTimer = useRef(null);
  const handleSearchInput = (v) => { setSearchInput(v); if (searchTimer.current) clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => setSearch(v), 350); };
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const cacheKey = `admin-bookings:v2:${search}_${statusFilter}_${dateFilter}`;
  const initialCache = clientCache.get(cacheKey);

  const [bookings, setBookings] = useState(initialCache?.data?.bookings || []);
  const [loading, setLoading] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(!initialCache);
  const [error, setError] = useState('');
  const isFirstMount = useRef(true);
  const [page, setPage] = useState(1);
  const BOOK_PAGE_SIZE = 10;

  // Server filters by search/date; status filtering is client-side so the
  // overview states (Booked/Occupied/Completed/Cancelled) apply uniformly.
  const visibleBookings = statusFilter
    ? bookings.filter((b) => toOverviewBookingState(b.status) === statusFilter)
    : bookings;
  const bookTotalPages = Math.max(1, Math.ceil(visibleBookings.length / BOOK_PAGE_SIZE));
  const bookSafePage = Math.min(page, bookTotalPages);
  const bookRows = visibleBookings.slice((bookSafePage - 1) * BOOK_PAGE_SIZE, bookSafePage * BOOK_PAGE_SIZE);
  const bookStart = (bookSafePage - 1) * BOOK_PAGE_SIZE;

  const fetchBookings = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
      setError('');
    }
    try {
      const query = new URLSearchParams({
        search,
        date: dateFilter,
      }).toString();

      const res = await fetch(`/api/admin/bookings?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch bookings');

      const nextBookings = data.bookings || [];
      setBookings(nextBookings);
      clientCache.set(cacheKey, { bookings: nextBookings }, CACHE_TTL.BOOKINGS);
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
      <div className="d-flex flex-column flex-md-row justify-content-end align-items-md-center gap-3 mb-4">
        <div className="d-flex gap-2 align-items-center">
          <Link
            href="/admin/reservations"
            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5 px-3 py-2 fw-semibold"
            style={{ borderRadius: '7px' }}
          >
            <span>View Reservations</span>
          </Link>
          <button
            onClick={fetchBookings}
            className="btn btn-sm btn-light border d-inline-flex align-items-center gap-1 px-3 py-2 text-secondary"
            style={{ borderRadius: '7px' }}
            title="Refresh list"
          >
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

      {/* Search & Filters */}
      <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <input
              type="text"
              className="form-control"
              placeholder="Search guest name or room..."
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Booking States</option>
              {BOOKING_OVERVIEW_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <FlatDatePicker dateFormat="Y-m-d" className="form-control" value={dateFilter} onChange={(val)=>setDateFilter(typeof val==='string'?val:val?.target?.value||'')} />
          </div>
          <div className="col-md-2 d-flex gap-2">
            <button className="btn btn-pcc-primary text-white w-100" onClick={() => { if (searchTimer.current) clearTimeout(searchTimer.current); setSearchInput(''); setSearch(''); setStatusFilter(''); setDateFilter(''); }}>
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
                {bookRows.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center text-muted py-4">
                      No bookings found.
                    </td>
                  </tr>
                ) : (
                  bookRows.map((b, i) => (
                    <tr key={b.bookingID}>
                      <td>{bookStart + i + 1}</td>
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
                        <span className={`badge ${overviewBookingBadgeClass(toOverviewBookingState(b.status))}`}>
                          {toOverviewBookingState(b.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {visibleBookings.length > BOOK_PAGE_SIZE && (
            <AdminPagination page={bookSafePage} totalPages={bookTotalPages} onPage={setPage} start={bookStart + 1} end={Math.min(bookStart + BOOK_PAGE_SIZE, visibleBookings.length)} total={visibleBookings.length} label="bookings" ariaLabel="Bookings pagination" />
          )}
      </div>
    </div>
  );
}
