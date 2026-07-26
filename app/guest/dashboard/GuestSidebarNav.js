'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NAV_ITEMS } from './navConfig';

export default function GuestSidebarNav({ activeTab, setActiveTab, unreadNotificationsCount = 0, guest, onRequestLogout }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className="d-none d-lg-flex flex-column text-white sticky-top shadow-sm"
      style={{
        width: isCollapsed ? '76px' : '240px',
        backgroundColor: 'var(--pcc-blue)',
        flexShrink: 0,
        height: '100vh',
        top: 0,
        zIndex: 1020,
        transition: 'width 0.2s ease-in-out',
        padding: isCollapsed ? '1rem 0.5rem' : '1rem'
      }}
    >
      {/* BRAND HEADER & COLLAPSE TOGGLE */}
      <div className="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
        <Link href="/" className="d-flex align-items-center gap-2 text-decoration-none text-white overflow-hidden">
          <img src="/assets/images/logo.jpg" alt="PCC Logo" style={{ height: '36px', minWidth: '36px', borderRadius: '6px' }} />
          {!isCollapsed && (
            <div className="text-start text-nowrap">
              <span className="fw-bold text-white d-block" style={{ fontSize: '0.95rem', lineHeight: '1.2' }}>PCC Guest Suite</span>
              <span className="text-white-50 small" style={{ fontSize: '0.72rem' }}>Hotel Guest Portal</span>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="btn btn-sm text-white-50 border-0 p-1 ms-auto d-flex align-items-center justify-content-center"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`} style={{ fontSize: '0.85rem' }}></i>
        </button>
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
                title={isCollapsed ? item.label : undefined}
                className={`nav-link text-white d-flex align-items-center ${isCollapsed ? 'justify-content-center' : 'justify-content-between'} gap-2 mb-1 px-3 py-2 w-100 border-0 text-start ${isActive ? 'active' : ''}`}
                style={{
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.22)' : 'transparent',
                  fontWeight: isActive ? '700' : '500',
                  transition: 'all 0.15s ease-in-out',
                  position: 'relative'
                }}
              >
                <div className="d-flex align-items-center gap-2.5">
                  <i className={`bi ${item.icon}`} style={{ fontSize: '1.15rem' }}></i>
                  {!isCollapsed && <span className="text-nowrap">{item.label}</span>}
                </div>
                {isNotification && unreadNotificationsCount > 0 && (
                  <span
                    className={`badge bg-danger text-white rounded-pill ${isCollapsed ? 'position-absolute top-0 start-100 translate-middle' : ''}`}
                    style={{ fontSize: '0.68rem' }}
                  >
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
        {!isCollapsed ? (
          <>
            <div className="text-white-50" style={{ fontSize: '0.75rem' }}>Logged in as</div>
            <div className="text-white fw-semibold text-truncate mb-2" style={{ fontSize: '0.88rem' }}>
              {guest?.firstName} {guest?.lastName}
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
          </>
        ) : (
          <button
            type="button"
            className="btn btn-sm text-white w-100 py-2 d-flex justify-content-center align-items-center"
            onClick={onRequestLogout}
            title="Log Out"
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '6px'
            }}
          >
            <i className="bi bi-power fs-5"></i>
          </button>
        )}
      </div>
    </aside>
  );
}
