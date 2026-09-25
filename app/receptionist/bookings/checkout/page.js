'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';

function ReceptionistCheckoutContent() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchFinalizedBookings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/receptionist/bookings');
      const data = await res.json();
      if (res.ok && data.bookings) {
        setBookings(data.bookings);
      }
    } catch (err) {
      console.error('Failed to fetch finalized bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinalizedBookings();
  }, []);

  const finalizedBookings = bookings.filter(b => [
    'Final Billing Updated', 'Room Verified', 'Payment Completed', 'Pending Room Verification', 'Pending Checkout'
  ].includes(b.status));

  const filtered = finalizedBookings.filter(b => {
    const q = search.toLowerCase();
    const name = `${b.firstName} ${b.lastName}`.toLowerCase();
    const room = String(b.roomNumber).toLowerCase();
    const id = String(b.bookingID).toLowerCase();
    return name.includes(q) || room.includes(q) || id.includes(q);
  });

  return (
    <div className="container-fluid p-3 p-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <h4 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
            <i className="fa-solid fa-cash-register text-primary"></i> Guest Checkout &amp; QR Payment Terminal
          </h4>
          <p className="text-muted small mb-0">
            View finalized guest stays and launch the dual-monitor / guest-facing QR payment terminal.
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Link href="/receptionist/checkin" className="btn btn-outline-secondary btn-sm">
            <i className="fa-solid fa-arrow-left me-1"></i> Back to Check-In Desk
          </Link>
          <button className="btn btn-outline-primary btn-sm" onClick={fetchFinalizedBookings}>
            <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card shadow-sm border-0 mb-4 p-3 bg-white" style={{ borderRadius: '12px' }}>
        <div className="input-group">
          <span className="input-group-text bg-light border-end-0">
            <i className="fa-solid fa-magnifying-glass text-muted"></i>
          </span>
          <input
            type="text"
            className="form-control border-start-0 ps-0"
            placeholder="Search by guest name, room number, or booking ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Cards List */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="text-muted mt-2">Loading checkout billing cards...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card border-0 shadow-sm p-5 text-center bg-white" style={{ borderRadius: '12px' }}>
          <i className="fa-solid fa-clipboard-check text-muted fs-1 mb-2"></i>
          <h6 className="text-dark fw-bold mb-1">No Pending Checkouts Found</h6>
          <p className="text-muted small mb-0">No stays currently match the finalized billing filter.</p>
        </div>
      ) : (
        <div className="row g-3">
          {filtered.map(b => {
            const isReadyForPayment = b.status === 'Final Billing Updated';
            const isPaid = b.status === 'Payment Completed' || b.status === 'Paid';
            const amountDue = parseFloat(b.remainingBalance || b.finalBalance || 0);

            return (
              <div key={b.bookingID} className="col-12 col-md-6 col-xl-4">
                <div className="card shadow-sm border h-100 bg-white" style={{ borderRadius: '14px' }}>
                  <div className="card-body p-3 d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h6 className="fw-bold mb-0 text-dark">
                          {b.firstName} {b.lastName}
                        </h6>
                        <span className="text-secondary small font-monospace">
                          Room {b.roomNumber} ({b.roomType}) • Stay #{b.bookingID}
                        </span>
                      </div>
                      <span className={`badge ${
                        isPaid ? 'bg-success' : isReadyForPayment ? 'bg-primary' : 'bg-warning text-dark'
                      } fw-bold`}>
                        {b.status}
                      </span>
                    </div>

                    <div className="p-2.5 bg-light rounded-2 border my-2 small">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Balance Due:</span>
                        <strong className={amountDue > 0 ? 'text-danger' : 'text-success'}>
                          ₱{amountDue.toFixed(2)}
                        </strong>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">Checkout Time:</span>
                        <span>{new Date(b.checkOutDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    <div className="mt-auto pt-2 border-top d-flex gap-2">
                      <a
                        href={`/receptionist/payments?bookingID=${b.bookingID}`}
                        className="btn btn-success btn-sm flex-fill fw-bold d-inline-flex align-items-center justify-content-center gap-1.5 shadow-sm text-white"
                        title="Proceed to Payment Terminal"
                        aria-label="Payment Terminal"
                      >
                        <i className="fa-solid fa-cash-register"></i> Payment Terminal
                      </a>
                      <a
                        href={`/receptionist/billing?bookingID=${b.bookingID}`}
                        className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
                        title="View Billing Ledger"
                      >
                        <i className="fa-solid fa-receipt"></i>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReceptionistCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted mt-2">Loading checkout page...</p>
      </div>
    }>
      <ReceptionistCheckoutContent />
    </Suspense>
  );
}
