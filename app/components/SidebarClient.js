'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import LoadingButton from './LoadingButton';
import ReceptionistSidebarNav from './ReceptionistSidebarNav';
import ModalPortal from './ModalPortal';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { CommandDialog, CommandGroup, CommandItem } from '@/components/ui/command';
import {
  Dialog,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

export default function SidebarClient({ session, role, children }) {
  const pathname = usePathname();
  const router = useRouter();
  // Always render expanded on first paint (matches server HTML), then apply
  // the persisted preference on mount to avoid a hydration mismatch.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('pcc-sidebar-collapsed') === '1') {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- apply persisted pref after mount to avoid hydration mismatch
        setCollapsed(true);
      }
    } catch (e) {}
  }, []);

  const dashboardUrl = role === 'Administrator' ? '/admin/dashboard' : '/receptionist/dashboard';
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [roomResults, setRoomResults] = useState([]);
  const roomTimer = useRef(null);

  const userInitial = session?.fullName ? session.fullName.trim().charAt(0).toUpperCase() : 'U';

  const paletteDestinations = (role === 'Administrator' ? [
    { label: 'Dashboard', hint: 'Admin', keywords: 'dashboard home overview', path: '/admin/dashboard' },
    { label: 'User Management', hint: 'Admin', keywords: 'users staff guests accounts user management', path: '/admin/users' },
    { label: 'Room Management', hint: 'Admin', keywords: 'rooms room management rates', path: '/admin/rooms' },
    { label: 'Amenities', hint: 'Admin', keywords: 'amenities inventory items', path: '/admin/amenities' },
    { label: 'Products', hint: 'Admin', keywords: 'products meals cooked food menu', path: '/admin/products' },
    { label: 'Inventory Management', hint: 'Admin', keywords: 'inventory stocks batches borrow movements', path: '/admin/inventory' },
    { label: 'Purchase Orders', hint: 'Admin', keywords: 'purchase orders procurement suppliers', path: '/admin/purchase-orders' },
    { label: 'Discounts & Promos', hint: 'Admin', keywords: 'discounts promos offers deals', path: '/admin/discounts' },
    { label: 'Reports', hint: 'Admin', keywords: 'reports sales analytics occupancy', path: '/admin/reports' },
  ] : [
    { label: 'Dashboard', hint: 'Front Desk', keywords: 'dashboard home overview', path: '/receptionist/dashboard' },
    { label: 'Reservations', hint: 'Front Desk', keywords: 'reservations holds bookings requests', path: '/receptionist/reservations' },
    { label: 'Bookings', hint: 'Front Desk', keywords: 'bookings stays guests rooms checkin', path: '/receptionist/bookings' },
    { label: 'Check-In / Out', hint: 'Front Desk', keywords: 'checkin checkout arrivals departures front desk', path: '/receptionist/checkin' },
    { label: 'Orders', hint: 'Front Desk', keywords: 'orders food meals room service', path: '/receptionist/orders' },
    { label: 'Billing & Checkout', hint: 'Front Desk', keywords: 'billing checkout payments folio settle invoice', path: '/receptionist/billing-checkout' },
    { label: 'Inquiries', hint: 'Front Desk', keywords: 'inquiries messages chat guest questions', path: '/receptionist/inquiries' },
  ]);

  const handlePaletteQuery = (q) => {
    if (roomTimer.current) clearTimeout(roomTimer.current);
    const query = (q || '').trim();
    if (!query) {
      setRoomResults([]);
      return;
    }
    roomTimer.current = setTimeout(async () => {
      try {
        if (role === 'Administrator') {
          const res = await fetch(`/api/admin/rooms?search=${encodeURIComponent(query)}&archived=false`);
          const data = await res.json();
          setRoomResults(((data && data.rooms) || []).slice(0, 6).map((r) => ({
            label: `Room ${r.roomNumber} — ${r.typeName || r.type || r.roomType || ''}`.trim(),
            hint: r.status || '',
            keywords: `room ${r.roomNumber} ${r.typeName || r.type || r.roomType || ''} ${r.status || ''}`,
            path: `/admin/rooms?search=${encodeURIComponent(r.roomNumber)}`,
          })));
        } else {
          const res = await fetch('/api/receptionist/bookings');
          const data = await res.json();
          const all = data.bookings || data.bookingsWithGuests || [];
          const ql = query.toLowerCase();
          setRoomResults(all.filter((b) =>
            `${b.roomNumber || ''} ${b.firstName || ''} ${b.lastName || ''} ${b.bookingID || ''} ${b.status || ''}`.toLowerCase().includes(ql)
          ).slice(0, 6).map((b) => ({
            label: `BK-${b.bookingID} · Room ${b.roomNumber} (${b.status || ''})`,
            hint: `${b.firstName || ''} ${b.lastName || ''}`.trim(),
            keywords: `booking ${b.bookingID} room ${b.roomNumber} ${b.firstName || ''} ${b.lastName || ''}`,
            path: `/receptionist/bookings?search=${encodeURIComponent(query)}`,
          })));
        }
      } catch (e) {
        setRoomResults([]);
      }
    }, 300);
  };

  const goPalettePath = (path) => {
    setPaletteOpen(false);
    router.push(path);
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem('pcc-sidebar-collapsed', next ? '1' : '0');
      } catch (e) {}
      return next;
    });
  };

  // If this is the guest-facing dual-monitor QR payment page, render standalone view without receptionist controls
  if (pathname?.startsWith('/receptionist/qr-payment')) {
    return <>{children}</>;
  }

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
    ['/admin/inventory', icons.inventory, 'Inventory Management'],
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

  const renderNavLinksList = () => {
    if (role === 'Receptionist') {
      return <ReceptionistSidebarNav pathname={pathname} icons={icons} />;
    }
    return (
      <ul className="nav flex-column gap-1" style={{ paddingLeft: '0', listStyle: 'none' }}>
        {navLinks.map(([path, icon, label], index) => {
          const isActive = pathname === path || (path !== '/admin/dashboard' && pathname?.startsWith(path));
          return (
            <li key={index}>
              <Link
                href={path}
                title={collapsed ? label : undefined}
                className={`nav-link text-white d-flex align-items-center gap-3 mb-1 px-3 py-2 ${isActive ? 'active' : ''}`}
                style={{
                  borderRadius: '7px',
                  fontSize: '0.88rem',
                  fontWeight: isActive ? '600' : '400',
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
                  borderLeft: isActive ? '3px solid #fff' : '3px solid transparent',
                  transition: 'all 0.15s ease-in-out',
                  gap: '12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <span className="d-inline-flex align-items-center justify-content-center" style={{ opacity: isActive ? 1 : 0.85, width: '20px', flexShrink: 0 }}>{icon}</span>
                {!(collapsed) && <span>{label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  };

  const mainBgColor = role === 'Administrator' ? '#f6faf7' : '#f0f4f8';

  return (
    <div className={`d-flex flex-column flex-lg-row ${role === 'Administrator' ? 'admin-inter' : ''}`} style={{ minHeight: '100vh' }}>
      {/* MOBILE TOP BAR */}
      <div 
        className="d-flex d-lg-none justify-content-between align-items-center p-3 text-white sticky-top" 
        style={{ backgroundColor: 'var(--pcc-blue)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 1050, position: 'sticky', top: 0 }}
      >
        <Link href={dashboardUrl} className="d-flex align-items-center gap-2 text-decoration-none">
          <img src="/assets/images/logo.jpg" alt="PCC Logo" style={{ height: '36px', borderRadius: '4px' }} />
          <span className="fw-bold text-white" style={{ fontSize: '0.95rem' }}>{labelText}</span>
        </Link>
        <div className="d-flex align-items-center gap-2">
          {(role === 'Administrator' || role === 'Receptionist') && <NotificationBell />}
          <ThemeToggle />
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
          <div className="mt-auto pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="d-flex align-items-center gap-2.5 mb-2.5 p-2 rounded" style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}>
              <div className="d-flex align-items-center justify-content-center rounded-circle bg-white text-primary fw-bold flex-shrink-0" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                {session?.fullName ? session.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="overflow-hidden" style={{ minWidth: 0 }}>
                <div className="text-white fw-semibold text-truncate" style={{ fontSize: '0.84rem' }}>{session?.fullName}</div>
                <div className="text-white-50 text-truncate" style={{ fontSize: '0.72rem' }}>{role}</div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
              onClick={() => setShowLogoutModal(true)}
              style={{
                backgroundColor: 'rgba(255,255,255,0.12)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: '7px',
                fontWeight: '500',
                padding: '6px 12px',
              }}
            >
              <i className="bi bi-box-arrow-right"></i>
              Log Out
            </button>
          </div>
        </div>
      </div>

      {/* DESKTOP SIDEBAR */}
      <nav
        style={{
          width: collapsed ? '76px' : '240px',
          backgroundColor: 'var(--pcc-blue)',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 1020,
          transition: 'width 0.2s ease-in-out'
        }}
        className={`d-none d-lg-flex flex-column p-3 pcc-fixed-sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}
      >
        <div className="mb-4 text-center">
          <Link href={dashboardUrl} title={collapsed ? 'Dashboard' : undefined}>
            <img src="/assets/images/logo.jpg" alt="PCC Logo" style={{ maxWidth: collapsed ? '44px' : '140px', borderRadius: '6px', transition: 'max-width 0.2s ease-in-out' }} />
          </Link>
        </div>
        <div className="d-flex align-items-center justify-content-between" style={{ marginBottom: '0.5rem' }}>
          {!(collapsed) && (
            <div
              style={{
                fontFamily: 'var(--font-tag)',
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'rgba(255, 255, 255, 0.45)',
              }}
            >
              {role === 'Administrator' ? 'Administration' : 'Front Desk'}
            </div>
          )}
          {(
            <button
              type="button"
              className="btn btn-sm d-inline-flex align-items-center justify-content-center"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                backgroundColor: 'rgba(255,255,255,0.12)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: '6px',
                width: '28px',
                height: '28px',
                marginLeft: collapsed ? 'auto' : undefined,
                marginRight: collapsed ? 'auto' : undefined,
              }}
            >
              <i className={`bi ${collapsed ? 'bi-chevron-double-right' : 'bi-chevron-double-left'}`}></i>
            </button>
          )}
        </div>
        
        {renderNavLinksList()}

        <div className="mt-auto pt-3" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.15)' }}>
          <div className="d-flex align-items-center gap-2.5 mb-2.5 p-2 rounded" style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <Avatar title={collapsed ? session?.fullName : undefined}>
              <AvatarFallback>{userInitial}</AvatarFallback>
            </Avatar>
            {!(collapsed) && (
              <div className="overflow-hidden" style={{ minWidth: 0 }}>
                <div className="text-white fw-semibold text-truncate" style={{ fontSize: '0.84rem' }}>{session?.fullName}</div>
                <div className="text-white-50 text-truncate" style={{ fontSize: '0.72rem' }}>{role}</div>
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
            onClick={() => setShowLogoutModal(true)}
            title={collapsed ? 'Log Out' : undefined}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              borderRadius: '7px',
              fontWeight: '500',
              padding: '6px 12px',
              transition: 'all 0.15s ease',
            }}
          >
            <i className="bi bi-box-arrow-right"></i>
            {!(collapsed) && 'Log Out'}
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
          className="d-none d-lg-flex justify-content-between align-items-center px-4 py-3 text-white border-bottom shadow-sm" 
          style={{ position: 'sticky', top: 0, zIndex: 1050, backgroundColor: 'var(--pcc-blue)' }}
        >
          <div>
            <h4 className="m-0 text-white fw-bold" style={{ fontSize: '1.1rem' }}>{headingText}</h4>
          </div>
          <div className="d-none d-md-flex flex-grow-1 justify-content-center px-4">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="btn btn-sm d-flex align-items-center gap-2 w-100"
              style={{ maxWidth: '420px', backgroundColor: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '8px' }}
              aria-label="Search pages and records"
              title="Search pages and records (Ctrl+K)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.5" y2="16.5" />
              </svg>
              <span className="opacity-75 small flex-grow-1 text-start">Search pages, rooms…</span>
              <kbd style={{ fontSize: '0.65rem', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: '4px', padding: '1px 6px' }}>Ctrl K</kbd>
            </button>
          </div>
          <div className="d-flex align-items-center gap-3">
            {(role === 'Administrator' || role === 'Receptionist') && <NotificationBell />}
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger>
                <button
                  type="button"
                  className="d-flex align-items-center gap-2 bg-transparent border-0 p-1"
                  style={{ borderLeft: '1px solid rgba(255,255,255,0.25)', paddingLeft: '15px' }}
                  aria-label="Account menu"
                >
                  <Avatar>
                    <AvatarFallback>{userInitial}</AvatarFallback>
                  </Avatar>
                  <span className="text-start">
                    <span className="fw-semibold text-white d-block text-truncate" style={{ fontSize: '0.85rem', maxWidth: '140px' }}>{session?.fullName}</span>
                    <span className="text-white-50 d-block" style={{ fontSize: '0.72rem' }}>{role}</span>
                  </span>
                  <i className="bi bi-chevron-down text-white-50" style={{ fontSize: '0.75rem' }}></i>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <strong>{session?.fullName}</strong>
                  {session?.email ? session.email : role}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
                  <i className="bi bi-person-circle"></i> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShowLogoutModal(true)}>
                  <i className="bi bi-box-arrow-right"></i> Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-grow-1 p-3 p-lg-4">
          {children}
        </main>
      </div>

      {/* GLOBAL SEARCH PALETTE */}
      <CommandDialog key={paletteOpen ? 'palette-open' : 'palette-closed'} open={paletteOpen} onOpenChange={setPaletteOpen} onQueryChange={handlePaletteQuery} placeholder="Search pages, rooms, bookings…">
        <CommandGroup heading="Pages">
          {paletteDestinations.map((d) => (
            <CommandItem key={d.path} keywords={`${d.label} ${d.keywords}`} onSelect={() => goPalettePath(d.path)}>
              <span>{d.label}</span>
              <span className="text-muted small ms-auto">{d.hint}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {roomResults.length > 0 && (
          <CommandGroup heading={role === 'Administrator' ? 'Rooms' : 'Stays'}>
            {roomResults.map((r, idx) => (
              <CommandItem key={`${r.path}-${idx}`} keywords={r.keywords} onSelect={() => goPalettePath(r.path)}>
                <span>{r.label}</span>
                <span className="text-muted small ms-auto">{r.hint}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandDialog>

      {/* PROFILE DIALOG */}
      <DialogTrigger isOpen={profileOpen} onOpenChange={setProfileOpen}>
        <button type="button" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
        <Dialog>
          <DialogHeader>
            <DialogTitle>My Profile</DialogTitle>
            <DialogDescription>Signed-in account details for this session.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="d-flex align-items-center gap-3 mb-3">
              <Avatar>
                <AvatarFallback>{userInitial}</AvatarFallback>
              </Avatar>
              <div>
                <div className="fw-bold" style={{ fontSize: '1rem' }}>{session?.fullName || 'User'}</div>
                <div className="text-muted small">{role}</div>
              </div>
            </div>
            <table className="table table-sm table-borderless mb-0">
              <tbody>
                <tr>
                  <td className="text-muted" style={{ width: '35%' }}>Full Name</td>
                  <td><strong>{session?.fullName || '—'}</strong></td>
                </tr>
                {session?.email ? (
                  <tr>
                    <td className="text-muted">Email</td>
                    <td>{session.email}</td>
                  </tr>
                ) : null}
                <tr>
                  <td className="text-muted">Role</td>
                  <td><span className="badge text-bg-primary">{role}</span></td>
                </tr>
              </tbody>
            </table>
          </DialogBody>
          <DialogFooter>
            <span />
            <DialogClose>Close</DialogClose>
          </DialogFooter>
        </Dialog>
      </DialogTrigger>

      {/* PCC THEME LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <ModalPortal>
          <div className="modal show d-block animate-fade-in" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.32)', backdropFilter: 'blur(10px) saturate(125%)', WebkitBackdropFilter: 'blur(10px) saturate(125%)', zIndex: 99999 }}>
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
                    <LoadingButton 
                      type="button" 
                      className="btn btn-pcc-primary text-white w-100 fw-semibold"
                      isLoading={loggingOut}
                      loadingText="Logging out..."
                      onClick={async () => {
                        setLoggingOut(true);
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
                    </LoadingButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
