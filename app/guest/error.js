'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function GuestError({ error, reset }) {
  useEffect(() => {
    console.error('Guest Portal Error:', error);
  }, [error]);

  // If this is a Next.js redirect, do not block navigation with the error UI
  const isRedirect = error?.digest?.startsWith('NEXT_REDIRECT') || error?.message === 'NEXT_REDIRECT';
  if (isRedirect) {
    if (typeof window !== 'undefined') {
      const parts = (error?.digest || '').split(';');
      const destination = parts[2] || '/auth/login';
      window.location.href = destination;
    }
    return (
      <div className="d-flex align-items-center justify-content-center p-5" style={{ minHeight: '80vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Redirecting...</span>
          </div>
          <p className="text-muted small mt-2">Redirecting...</p>
        </div>
      </div>
    );
  }

  const handleReload = () => {
    if (typeof reset === 'function') {
      try {
        reset();
        return;
      } catch (e) {}
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/guest/dashboard';
    }
  };

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

        <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center mb-3">
          <button
            type="button"
            className="btn btn-primary px-4 py-2 fw-semibold"
            style={{ borderRadius: '8px', backgroundColor: '#0a3663', borderColor: '#0a3663' }}
            onClick={handleReload}
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

        {error?.message && !error.message.includes('Server Components render') && (
          <details className="text-start mt-2 p-2 bg-light rounded border text-muted small" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
            <summary className="cursor-pointer fw-semibold text-secondary">Diagnostic Details</summary>
            <div className="mt-1 font-monospace">{error.message}</div>
            {error.digest && <div className="mt-1 font-monospace text-secondary">Digest: {error.digest}</div>}
          </details>
        )}
      </div>
    </div>
  );
}

