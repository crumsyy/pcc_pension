'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function GuestError({ error, reset }) {
  useEffect(() => {
    console.error('Guest Portal Error:', error);
  }, [error]);

  return (
    <div className="d-flex align-items-center justify-content-center px-3" style={{ minHeight: '80vh', backgroundColor: '#f8fafc' }}>
      <div className="card border-0 shadow-sm p-4 p-md-5 text-center bg-white" style={{ maxWidth: '520px', borderRadius: '16px' }}>
        <div
          className="rounded-circle bg-warning-subtle text-warning-emphasis d-inline-flex align-items-center justify-content-center mx-auto mb-3"
          style={{ width: '64px', height: '64px', fontSize: '2rem' }}
        >
          <i className="bi bi-exclamation-triangle"></i>
        </div>
        <h4 className="fw-bold text-dark mb-2">Unable to Load Guest Portal</h4>
        <p className="text-muted small mb-4">
          We encountered a temporary issue while loading your guest account details. Please try reloading or return to the login screen.
        </p>

        <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
          <button
            type="button"
            className="btn btn-primary px-4 py-2 fw-semibold"
            style={{ borderRadius: '8px', backgroundColor: '#0a3663', borderColor: '#0a3663' }}
            onClick={() => reset ? reset() : (window.location.href = '/guest/dashboard')}
          >
            <i className="bi bi-arrow-clockwise me-1"></i> Reload Dashboard
          </button>
          <Link
            href="/"
            className="btn btn-outline-secondary px-4 py-2 fw-semibold"
            style={{ borderRadius: '8px' }}
          >
            <i className="bi bi-house me-1"></i> Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
