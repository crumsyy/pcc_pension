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
    ['/receptionist/billing', icons?.billing, 'Billing'],
    ['/receptionist/payments', icons?.payments, 'Payments'],
    ['/receptionist/inquiries', icons?.inquiries, 'Inquiries']
  ];

  return (
    <ul className="nav flex-column gap-1" style={{ paddingLeft: '0', listStyle: 'none' }}>
      {receptionistNavLinks.map(([path, icon, label], index) => {
        const isActive = pathname === path;
        const isInquiries = path === '/receptionist/inquiries';

        return (
          <li key={index}>
            <Link
              href={path}
              onClick={onLinkClick}
              className={`nav-link text-white d-flex align-items-center justify-content-between mb-1 px-3 py-2 ${isActive ? 'active' : ''}`}
              style={{ borderRadius: '6px', fontSize: '0.9rem' }}
            >
              <div className="d-flex align-items-center gap-2">
                {icon}
                <span>{label}</span>
              </div>
              {isInquiries && alertsCount > 0 && (
                <span className="badge bg-danger ms-2">{alertsCount}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
