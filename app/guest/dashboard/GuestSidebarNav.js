'use client';

import Link from 'next/link';
import { NAV_ITEMS } from './navConfig';

export default function GuestSidebarNav({ activeTab, setActiveTab, unreadNotificationsCount = 0, guest, onRequestLogout }) {
  return (
    <aside className="guest-desktop-sidebar text-white shadow-sm d-flex flex-column p-3" style={{ background: 'var(--pcc-blue)', minHeight: '100vh' }}>
      {/* BRAND HEADER */}
      <div className="mb-3 text-center p-3 rounded-3 text-white shadow-sm" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
        <Link href="/" className="d-flex align-items-center justify-content-center gap-2 text-decoration-none text-white">
          <img src="/assets/images/logo.jpg" height="40" alt="PCC Logo" style={{ borderRadius: "8px" }} />
          <div className="text-start">
            <h6 className="fw-bold mb-0 display-font" style={{ fontSize: '1.05rem', lineHeight: '1.1', color: '#ffffff' }}>
              PCC Home Suite
            </h6>
            <span className="text-white-50" style={{ fontSize: '0.72rem' }}>Guest Portal</span>
          </div>
        </Link>
      </div>

      {/* GUEST PROFILE SUMMARY */}
      <div className="p-2.5 rounded-3 mb-3 border border-white-50" style={{ background: 'rgba(255,255,255,0.12)' }}>
        <div className="fw-bold text-white text-truncate" style={{ fontSize: '0.9rem' }}>
          {guest?.firstName} {guest?.lastName}
        </div>
        <span className="text-white-50 text-truncate d-block" style={{ fontSize: '0.75rem' }}>Guest Account</span>
      </div>

      {/* NAVIGATION MENU */}
      <div className="nav flex-column nav-pills gap-1.5 mb-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          const isNotification = item.id === 'notifications';

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`btn text-start d-flex align-items-center justify-content-between p-2.5 rounded-3 border-0 sidebar-nav-item ${isActive ? 'active' : ''}`}
              style={{
                backgroundColor: isActive ? '#ffffff' : 'transparent',
                color: isActive ? 'var(--pcc-blue)' : '#ffffff',
                fontWeight: isActive ? '700' : '500',
                fontSize: '0.92rem',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <div className="d-flex align-items-center gap-2.5">
                <i className={`bi ${item.icon}`} style={{ fontSize: '1.15rem' }}></i>
                <span>{item.label}</span>
              </div>
              {isNotification && unreadNotificationsCount > 0 && (
                <span className={`badge ${isActive ? 'bg-danger text-white' : 'bg-white text-danger'} rounded-pill`} style={{ fontSize: '0.7rem' }}>
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* FOOTER & LOGOUT BUTTON */}
      <div className="pt-3 border-top border-white-50 mt-3">
        <button
          onClick={onRequestLogout}
          className="btn btn-danger text-white w-100 py-2.5 px-3 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
          style={{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
        >
          <i className="bi bi-power fs-5"></i>
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}
