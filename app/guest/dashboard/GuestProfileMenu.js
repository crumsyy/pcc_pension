'use client';

import { useState, useEffect, useRef } from 'react';

export default function GuestProfileMenu({ guest, onProfile, onLogout, maxNameWidth = 140 }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const displayName = guest?.firstName
    ? `${guest.firstName} ${guest.lastName || ''}`.trim()
    : 'Guest';
  const initial = displayName ? displayName.charAt(0).toUpperCase() : 'G';

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  const pick = (fn) => {
    setOpen(false);
    if (fn) fn();
  };

  return (
    <div ref={containerRef} className="position-relative">
      <button
        type="button"
        className="btn btn-sm d-inline-flex align-items-center gap-2 text-white border-0 px-2 py-1"
        style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: '20px', maxWidth: '100%' }}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={displayName}
      >
        {guest?.profilePicture ? (
          <img
            src={guest.profilePicture}
            alt="Avatar"
            className="rounded-circle flex-shrink-0"
            style={{ width: '24px', height: '24px', objectFit: 'cover' }}
          />
        ) : (
          <span
            className="rounded-circle bg-white text-primary fw-bold d-inline-flex align-items-center justify-content-center flex-shrink-0"
            style={{ width: '24px', height: '24px', fontSize: '0.75rem' }}
          >
            {initial}
          </span>
        )}
        <span
          className="text-truncate fw-semibold text-start"
          style={{ fontSize: '0.8rem', maxWidth: `${maxNameWidth}px` }}
        >
          {displayName}
        </span>
        <i className={`bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'} flex-shrink-0`} style={{ fontSize: '0.7rem' }}></i>
      </button>
      {open && (
        <div
          role="menu"
          className="dropdown-menu show position-absolute end-0 mt-1 shadow border-0 py-1"
          style={{ minWidth: '170px', borderRadius: '10px', zIndex: 2000 }}
        >
          <div className="px-3 py-2 border-bottom">
            <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.85rem' }}>{displayName}</div>
            {guest?.email && (
              <div className="text-muted text-truncate" style={{ fontSize: '0.72rem' }}>{guest.email}</div>
            )}
          </div>
          <button type="button" role="menuitem" className="dropdown-item d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }} onClick={() => pick(onProfile)}>
            <i className="bi bi-person-circle text-primary"></i> Profile
          </button>
          <button type="button" role="menuitem" className="dropdown-item d-flex align-items-center gap-2 text-danger" style={{ fontSize: '0.85rem' }} onClick={() => pick(onLogout)}>
            <i className="bi bi-box-arrow-right"></i> Log Out
          </button>
        </div>
      )}
    </div>
  );
}
