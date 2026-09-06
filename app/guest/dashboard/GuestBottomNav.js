'use client';

import Link from 'next/link';
import { NAV_ITEMS } from './navConfig';

export default function GuestBottomNav({ activeTab, setActiveTab, unreadNotificationsCount = 0 }) {
  return (
    <div
      className="guest-bottom-nav shadow-lg border-top border-white-50 text-white d-flex justify-content-around align-items-center py-2 px-1"
      style={{ background: 'var(--pcc-blue)', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1040 }}
    >
      {NAV_ITEMS.map((tab) => {
        const isActive = activeTab === tab.id;
        const isNotification = tab.id === 'notifications';

        if (tab.href) {
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`btn border-0 d-flex flex-column align-items-center justify-content-center p-1 nav-tab-item text-decoration-none ${isActive ? 'active' : ''}`}
              style={{
                flex: 1,
                color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
                backgroundColor: isActive ? 'rgba(255, 255, 255, 0.22)' : 'transparent',
                borderRadius: '8px',
                transition: 'all 0.2s ease-in-out',
                position: 'relative'
              }}
            >
              <div>
                <i className={`bi ${tab.icon}`} style={{ fontSize: '1.2rem' }}></i>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: isActive ? '700' : '500', marginTop: '2px' }}>
                {tab.label}
              </span>
            </Link>
          );
        }

        if (setActiveTab) {
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`btn border-0 d-flex flex-column align-items-center justify-content-center p-1 nav-tab-item ${isActive ? 'active' : ''}`}
              style={{
                flex: 1,
                color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
                backgroundColor: isActive ? 'rgba(255, 255, 255, 0.22)' : 'transparent',
                borderRadius: '8px',
                transition: 'all 0.2s ease-in-out',
                position: 'relative'
              }}
            >
              <div style={{ position: 'relative' }}>
                <i className={`bi ${tab.icon}`} style={{ fontSize: '1.2rem' }}></i>
                {isNotification && unreadNotificationsCount > 0 && (
                  <span
                    className="badge bg-danger text-white rounded-circle position-absolute top-0 start-100 translate-middle"
                    style={{ fontSize: '0.65rem', padding: '3px 5px' }}
                  >
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: isActive ? '700' : '500', marginTop: '2px' }}>
                {tab.label}
              </span>
            </button>
          );
        }

        return (
          <Link
            key={tab.id}
            href={tab.id === 'home' ? '/guest/dashboard' : `/guest/dashboard?tab=${tab.id}`}
            className={`btn border-0 d-flex flex-column align-items-center justify-content-center p-1 nav-tab-item text-decoration-none ${isActive ? 'active' : ''}`}
            style={{
              flex: 1,
              color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
              backgroundColor: isActive ? 'rgba(255, 255, 255, 0.22)' : 'transparent',
              borderRadius: '8px',
              transition: 'all 0.2s ease-in-out',
              position: 'relative'
            }}
          >
            <div style={{ position: 'relative' }}>
              <i className={`bi ${tab.icon}`} style={{ fontSize: '1.2rem' }}></i>
              {isNotification && unreadNotificationsCount > 0 && (
                <span
                  className="badge bg-danger text-white rounded-circle position-absolute top-0 start-100 translate-middle"
                  style={{ fontSize: '0.65rem', padding: '3px 5px' }}
                >
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: isActive ? '700' : '500', marginTop: '2px' }}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
