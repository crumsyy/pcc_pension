'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ReceptionistSidebarNav({ pathname, icons, onLinkClick }) {
  const [alertsCount, setAlertsCount] = useState(0);

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/receptionist/inquiries/alerts');
      const data = await res.json();
      if (res.ok && data.success) {
        setAlertsCount(data.alertsCount || 0);
      }
    } catch (e) {
      // Silent catch for background polling
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const receptionistNavLinks = [
    ['/receptionist/dashboard', icons?.dashboard, 'Dashboard'],
    ['/receptionist/reservations', icons?.reservations, 'Reservations'],
    ['/receptionist/bookings', icons?.bookings, 'Bookings'],
    ['/receptionist/checkin', icons?.checkin, 'Check-In / Out'],
    ['/receptionist/orders', icons?.orders, 'Orders'],
    ['/receptionist/billing-checkout', icons?.billing, 'Billing & Checkout'],
    ['/receptionist/inquiries', icons?.inquiries, 'Inquiries']
  ];

  return (
    <ul className="nav flex-column gap-1" style={{ paddingLeft: '0', listStyle: 'none' }}>
      {receptionistNavLinks.map(([path, icon, label], index) => {
        const isActive = pathname === path || (path !== '/receptionist/dashboard' && pathname?.startsWith(path));
        const isInquiries = path === '/receptionist/inquiries';

        return (
          <li key={index}>
            <Link
              href={path}
              onClick={onLinkClick}
              className={`nav-link text-white d-flex align-items-center justify-content-between mb-1 px-3 py-2 ${isActive ? 'active' : ''}`}
              style={{
                borderRadius: '7px',
                fontSize: '0.88rem',
                fontWeight: isActive ? '600' : '400',
                backgroundColor: isActive ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
                borderLeft: isActive ? '3px solid #fff' : '3px solid transparent',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              <div className="d-flex align-items-center gap-3" style={{ gap: '12px' }}>
                <span className="d-inline-flex align-items-center justify-content-center" style={{ opacity: isActive ? 1 : 0.85, width: '20px', flexShrink: 0 }}>{icon}</span>
                <span>{label}</span>
              </div>
              {isInquiries && alertsCount > 0 && (
                <span className="badge rounded-pill bg-danger px-2 py-0.5 fw-bold" style={{ fontSize: '0.72rem', boxShadow: '0 2px 6px rgba(220,53,69,0.4)' }}>
                  {alertsCount}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
