'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import GuestSidebarNav from '../guest/dashboard/GuestSidebarNav';
import GuestBottomNav from '../guest/dashboard/GuestBottomNav';

export default function GuestLayout({ children, activeTab = 'orders', guest: propGuest }) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [guest, setGuest] = useState(propGuest || null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const media = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(media.matches);

    const listener = (e) => setIsDesktop(e.matches);
    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      media.addListener(listener);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, []);

  useEffect(() => {
    if (propGuest) {
      setGuest(propGuest);
    } else if (!guest) {
      // Fetch lightweight guest profile if not supplied by parent
      fetch('/api/guest/profile')
        .then(res => res.json())
        .then(data => {
          if (data && data.guest) {
            setGuest(data.guest);
          }
        })
        .catch(() => {});
    }
  }, [propGuest]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/auth/login';
    } catch (e) {
      window.location.href = '/auth/login';
    }
  };

  return (
    <div className="d-flex flex-column flex-lg-row" style={{ minHeight: '100vh', width: '100%', backgroundColor: '#f8fafc' }}>
      {/* RESPONSIVE NAVIGATION: DESKTOP SIDEBAR vs MOBILE TOP BAR */}
      {isMounted && isDesktop ? (
        <GuestSidebarNav
          activeTab={activeTab}
          guest={guest}
          onRequestLogout={() => setShowLogoutModal(true)}
        />
      ) : (
        /* TOP BRANDING BAR (Mobile & Tablet) */
        <nav className="navbar navbar-dark text-white border-bottom shadow-sm sticky-top px-3" style={{ background: 'var(--pcc-blue)', zIndex: 1030 }}>
          <div className="container-fluid p-0 d-flex justify-content-between align-items-center">
            <Link 
              href="/guest/dashboard" 
              className="navbar-brand d-flex align-items-center gap-2 m-0 text-white cursor-pointer" 
              title="Guest Dashboard Home"
            >
              <img src="/assets/images/logo.jpg" height="38" alt="PCC Logo" style={{ borderRadius: "6px" }} />
              <span className="fw-bold display-font d-none d-sm-inline" style={{ fontSize: '1.05rem', color: '#ffffff' }}>PCC Home Suite</span>
            </Link>
            <div className="d-flex align-items-center gap-2">
              <span className="fw-semibold text-white px-2.5 py-1 rounded-pill d-flex align-items-center gap-1.5" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', border: '1px solid rgba(255, 255, 255, 0.35)', fontSize: '0.82rem' }}>
                {guest?.profilePicture ? (
                  <img
                    src={guest.profilePicture}
                    alt="Avatar"
                    className="rounded-circle border border-white flex-shrink-0"
                    style={{ width: '22px', height: '22px', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    className="rounded-circle bg-white text-pcc-blue fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: '22px', height: '22px', fontSize: '0.65rem' }}
                  >
                    {guest?.firstName ? guest.firstName.charAt(0).toUpperCase() : 'G'}
                  </div>
                )}
                {guest?.firstName ? `${guest.firstName} ${guest.lastName || ''}`.trim() : 'Guest'}
              </span>
              <button
                className="btn btn-sm text-white border-0"
                title="Log Out"
                onClick={() => setShowLogoutModal(true)}
              >
                <i className="bi bi-power fs-5"></i>
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* MAIN WORKSPACE CONTENT */}
      <main
        className={`flex-grow-1 ${!isDesktop ? 'pb-5' : ''}`}
        style={{
          minWidth: 0,
          paddingBottom: !isDesktop ? '95px' : undefined
        }}
      >
        {children}
      </main>

      {/* MOBILE BOTTOM NAVIGATION (Mobile & Tablet Only) */}
      {isMounted && !isDesktop && (
        <GuestBottomNav
          activeTab={activeTab}
        />
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold">Confirm Log Out</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowLogoutModal(false)}></button>
              </div>
              <div className="modal-body p-4 text-center">
                <div className="text-danger mb-3">
                  <i className="bi bi-exclamation-triangle fs-1"></i>
                </div>
                <h6 className="fw-bold mb-2">Are you sure you want to log out?</h6>
                <p className="text-muted small mb-0">Your current guest portal session will be safely terminated.</p>
              </div>
              <div className="modal-footer bg-light border-0">
                <button type="button" className="btn btn-secondary px-3" onClick={() => setShowLogoutModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger px-4 fw-bold" onClick={handleLogout}>
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
