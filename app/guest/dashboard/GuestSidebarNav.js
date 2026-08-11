'use client';

import Link from 'next/link';
import { NAV_ITEMS } from './navConfig';

export default function GuestSidebarNav({ activeTab, setActiveTab, unreadNotificationsCount = 0, guest, onRequestLogout }) {
  return (
    <aside
      className="d-none d-lg-flex flex-column text-white sticky-top p-3 shadow-sm"
      style={{
        width: '240px',
        backgroundColor: 'var(--pcc-blue)',
        flexShrink: 0,
        height: '100vh',
        top: 0,
        zIndex: 1020
      }}
    >
      {/* BRAND HEADER */}
      <div className="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
        <div className="d-flex align-items-center gap-2">
          <img src="/assets/images/logo.jpg" alt="PCC Logo" style={{ height: '36px', borderRadius: '6px' }} />
          <div className="text-start">
            <span className="fw-bold text-white d-block" style={{ fontSize: '0.95rem', lineHeight: '1.2' }}>PCC Guest Suite</span>
            <span className="text-white-50 small" style={{ fontSize: '0.72rem' }}>Hotel Guest Portal</span>
          </div>
        </div>
      </div>

      {/* NAVIGATION MENU */}
      <ul className="nav flex-column gap-1 mb-auto" style={{ paddingLeft: 0, listStyle: 'none' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          const isNotification = item.id === 'notifications';

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`nav-link text-white d-flex align-items-center justify-content-between gap-2 mb-1 px-3 py-2 w-100 border-0 text-start ${isActive ? 'active' : ''}`}
                style={{
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.22)' : 'transparent',
                  fontWeight: isActive ? '700' : '500',
                  transition: 'all 0.15s ease-in-out'
                }}
              >
                <div className="d-flex align-items-center gap-3">
                  <i className={`bi ${item.icon} me-1`} style={{ fontSize: '1.1rem' }}></i>
                  <span className="text-nowrap" style={{ letterSpacing: '0.01em' }}>{item.label}</span>
                </div>
                {isNotification && unreadNotificationsCount > 0 && (
                  <span className="badge bg-danger text-white rounded-pill" style={{ fontSize: '0.68rem' }}>
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* LOGGED IN USER INFO & LOGOUT BUTTON */}
      <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
        <div className="text-white-50" style={{ fontSize: '0.75rem' }}>Logged in as</div>
        <div className="text-white fw-semibold text-truncate mb-1" style={{ fontSize: '0.88rem' }}>
          {guest?.firstName} {guest?.lastName}
        </div>
        <div className="text-white-50 font-monospace mb-2" style={{ fontSize: '0.72rem' }}>
          User ID: #{guest?.userID || guest?.guestID}
        </div>
        <button
          type="button"
          className="btn btn-sm w-100 text-white fw-bold py-2 shadow-sm"
          onClick={onRequestLogout}
          style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '6px'
          }}
        >
          <i className="bi bi-power me-1"></i> Log Out
        </button>
      </div>
    </aside>
  );
}
