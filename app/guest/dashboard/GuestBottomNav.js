'use client';

import { NAV_ITEMS } from './navConfig';

export default function GuestBottomNav({ activeTab, setActiveTab, unreadNotificationsCount = 0 }) {
  return (
    <div className="guest-bottom-nav shadow-lg border-top bg-white d-flex justify-content-around align-items-center py-2 px-1">
      {NAV_ITEMS.map((tab) => {
        const isActive = activeTab === tab.id;
        const isNotification = tab.id === 'notifications';
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn border-0 d-flex flex-column align-items-center justify-content-center p-1 nav-tab-item ${isActive ? 'active' : ''}`}
            style={{
              flex: 1,
              color: isActive ? '#2155B5' : '#64748b',
              transition: 'all 0.2s ease-in-out',
              position: 'relative'
            }}
          >
            <div style={{ position: 'relative' }}>
              <i className={`bi ${tab.icon}`} style={{ fontSize: '1.25rem' }}></i>
              {isNotification && unreadNotificationsCount > 0 && (
                <span
                  className="badge bg-danger rounded-circle position-absolute top-0 start-100 translate-middle"
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
      })}
    </div>
  );
}
