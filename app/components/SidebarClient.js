'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NotificationBell from './NotificationBell';

export default function SidebarClient({ session, role, children }) {
  const pathname = usePathname();
  const dashboardUrl = role === 'Administrator' ? '/admin/dashboard' : '/receptionist/dashboard';
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // SVG Icons
  const icons = {
    dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
    users: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    rooms: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16"/><path d="M2 11h20"/><path d="M22 4v16"/><path d="M2 16h20"/><path d="M6 11V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/></svg>,
    amenities: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z"/></svg>,
    products: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    inventory: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/><line x1="9" y1="8" x2="10" y2="8"/></svg>,
    purchaseOrders: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
    discounts: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    reports: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    reservations: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    bookings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16"/><path d="M2 11h20"/><path d="M22 4v16"/><path d="M2 16h20"/><path d="M6 11V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/></svg>,
    checkin: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    orders: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>,
    billing: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M16 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/></svg>,
    payments: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    guests: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    inquiries: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  };

  // Nav Items based on role
  const navLinks = role === 'Administrator' ? [
    ['/admin/dashboard', icons.dashboard, 'Dashboard'],
    ['/admin/users', icons.users, 'User Management'],
    ['/admin/rooms', icons.rooms, 'Room Management'],
    ['/admin/amenities', icons.amenities, 'Amenities'],
    ['/admin/products', icons.products, 'Products'],
    ['/admin/inventory', icons.inventory, 'Inventory'],
    ['/admin/purchase-orders', icons.purchaseOrders, 'Purchase Orders'],
    ['/admin/discounts', icons.discounts, 'Discounts & Promos'],
    ['/admin/reports', icons.reports, 'Reports']
  ] : [
    ['/receptionist/dashboard', icons.dashboard, 'Dashboard'],
    ['/receptionist/reservations', icons.reservations, 'Reservations'],
    ['/receptionist/bookings', icons.bookings, 'Bookings'],
    ['/receptionist/checkin', icons.checkin, 'Check-In / Out'],
    ['/receptionist/orders', icons.orders, 'Orders'],
    ['/receptionist/billing', icons.billing, 'Billing'],
    ['/receptionist/payments', icons.payments, 'Payments'],
    ['/receptionist/inquiries', icons.inquiries, 'Inquiries']
  ];

  const offcanvasId = role === 'Administrator' ? 'adminOffcanvas' : 'receptionistOffcanvas';
  const labelText = role === 'Administrator' ? 'PCC Admin' : 'PCC Front Desk';
  const headingText = role === 'Administrator' ? 'PCC Administration' : 'PCC Front Desk Panel';

  const renderNavLinksList = () => (
    <ul className="nav flex-column gap-1" style={{ paddingLeft: '0', listStyle: 'none' }}>
      {navLinks.map(([path, icon, label], index) => {
        const isActive = pathname === path;
        return (
          <li key={index}>
            <Link
              href={path}
              className={`nav-link text-white d-flex align-items-center gap-2 mb-1 px-3 py-2 ${isActive ? 'active' : ''}`}
              style={{ borderRadius: '6px', fontSize: '0.9rem' }}
            >
              {icon} {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const mainBgColor = role === 'Administrator' ? '#f6faf7' : '#f0f4f8';

  return (
    <div className="d-flex flex-column flex-lg-row" style={{ minHeight: '100vh' }}>
      {/* MOBILE TOP BAR */}
      <div 
        className="d-flex d-lg-none justify-content-between align-items-center p-3 text-white sticky-top" 
        style={{ backgroundColor: 'var(--pcc-blue)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 1030, position: 'sticky', top: 0 }}
      >
        <Link href={dashboardUrl} className="d-flex align-items-center gap-2 text-decoration-none">
          <img src="/assets/images/logo.jpg" alt="PCC Logo" style={{ height: '36px', borderRadius: '4px' }} />
          <span className="fw-bold text-white" style={{ fontSize: '0.95rem' }}>{labelText}</span>
        </Link>
        <div className="d-flex align-items-center gap-2">
          <NotificationBell />
          <button 
            className="btn btn-outline-light d-flex align-items-center justify-content-center p-2" 
            type="button" 
            data-bs-toggle="offcanvas" 
            data-bs-target={`#${offcanvasId}`} 
            aria-controls={offcanvasId}
            style={{ width: '38px', height: '38px', borderRadius: '6px' }}
          >
            ☰
          </button>
        </div>
      </div>

      {/* MOBILE OFFCANVAS DRAWER */}
      <div 
        className="offcanvas offcanvas-start d-lg-none" 
        tabIndex="-1" 
        id={offcanvasId} 
        aria-labelledby={`${offcanvasId}Label`}
        style={{ backgroundColor: 'var(--pcc-blue)', color: 'white', width: '260px' }}
      >
        <div className="offcanvas-header d-flex justify-content-between align-items-center p-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h5 className="offcanvas-title fw-bold" id={`${offcanvasId}Label`}>{labelText}</h5>
          <button type="button" className="btn-close btn-close-white text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body d-flex flex-column p-3">
          <div className="mb-2" style={{ fontFamily: 'var(--font-tag)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)' }}>
            Navigation Menu
          </div>
          {renderNavLinksList()}
          <div className="mt-auto pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <div className="text-white-50" style={{ fontSize: '0.75rem' }}>Logged in as</div>
            <div className="text-white fw-semibold" style={{ fontSize: '0.88rem' }}>{session.fullName}</div>
            <div className="text-white-50 mb-2" style={{ fontSize: '0.75rem' }}>{role}</div>
            <button
              type="button"
              className="btn btn-sm w-100"
              onClick={() => setShowLogoutModal(true)}
              style={{
                backgroundColor: 'rgba(255,255,255,0.12)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* DESKTOP SIDEBAR */}
      <nav
        style={{
          width: '240px',
          backgroundColor: 'var(--pcc-blue)',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 1020
        }}
        className="d-none d-lg-flex flex-column p-3 pcc-fixed-sidebar"
      >
        <div className="mb-4 text-center">
          <Link href={dashboardUrl}>
            <img src="/assets/images/logo.jpg" alt="PCC Logo" style={{ maxWidth: '140px', borderRadius: '6px' }} />
          </Link>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-tag)',
            fontSize: '0.68rem',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'rgba(255, 255, 255, 0.45)',
            marginBottom: '0.5rem',
          }}
        >
          {role === 'Administrator' ? 'Administration' : 'Front Desk'}
        </div>
        
        {renderNavLinksList()}

        <div className="mt-auto pt-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
          <div className="text-white-50" style={{ fontSize: '0.75rem' }}>Logged in as</div>
          <div className="text-white fw-semibold" style={{ fontSize: '0.88rem' }}>{session.fullName}</div>
          <div className="text-white-50" style={{ fontSize: '0.75rem' }}>{role}</div>
          <button
            type="button"
            className="btn btn-sm mt-2 w-100"
            onClick={() => setShowLogoutModal(true)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            Log Out
          </button>
        </div>
      </nav>

      {/* MAIN CONTENT WRAPPER */}
      <div 
        className="flex-grow-1 d-flex flex-column pcc-main-wrapper" 
        style={{ backgroundColor: mainBgColor, minHeight: '100vh' }}
      >
        {/* DESKTOP HEADER PORTION */}
        <header 
          className="d-none d-lg-flex justify-content-between align-items-center px-4 py-3 bg-white border-bottom shadow-sm" 
          style={{ position: 'sticky', top: 0, zIndex: 1010 }}
        >
          <div>
            <h4 className="m-0 text-dark fw-bold" style={{ fontSize: '1.1rem' }}>{headingText}</h4>
          </div>
          <div className="d-flex align-items-center gap-3">
            <NotificationBell />
            <div className="text-end" style={{ borderLeft: '1px solid #eee', paddingLeft: '15px' }}>
              <div className="fw-semibold text-dark" style={{ fontSize: '0.85rem' }}>{session.fullName}</div>
              <div className="text-muted" style={{ fontSize: '0.72rem' }}>{role}</div>
            </div>
          </div>
        </header>

        <main className="flex-grow-1 p-3 p-lg-4">
          {children}
        </main>
      </div>

      {/* PCC THEME LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div className="modal show d-block animate-fade-in" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 11000 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '400px' }}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '8px' }}>
              <div className="modal-body p-4 text-center">
                <div className="d-inline-flex align-items-center justify-content-center bg-danger bg-opacity-10 text-danger rounded-circle mb-3" style={{ width: '64px', height: '64px' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </div>
                <h5 className="fw-bold text-dark mb-2">Log Out Confirmation</h5>
                <p className="text-muted small px-3">Are you sure you want to log out from PCC Home Suite Home?</p>
                <div className="d-flex gap-2 mt-4">
                  <button 
                    type="button" 
                    className="btn btn-secondary text-white w-100 fw-semibold" 
                    onClick={() => setShowLogoutModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-pcc-primary text-white w-100 fw-semibold"
                    onClick={async () => {
                      try {
                        await fetch('/api/auth/logout', { method: 'POST' });
                        window.location.href = '/auth/login';
                      } catch (err) {
                        console.error('Logout error:', err);
                        window.location.href = '/auth/login';
                      }
                    }}
                  >
                    Log Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
