'use client';

export default function GuestBottomNav({ activeTab, setActiveTab, unreadNotificationsCount = 0 }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: 'bi-house-door-fill' },
    { id: 'rooms', label: 'Rooms', icon: 'bi-door-open-fill' },
    { id: 'chat', label: 'Chat', icon: 'bi-chat-dots-fill' },
    { id: 'notifications', label: 'Notifications', icon: 'bi-bell-fill', badge: unreadNotificationsCount },
    { id: 'account', label: 'Account', icon: 'bi-person-circle' }
  ];

  return (
    <div className="guest-bottom-nav shadow-lg border-top bg-white d-flex justify-content-around align-items-center py-2 px-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
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
              {tab.badge > 0 && (
                <span
                  className="badge bg-danger rounded-circle position-absolute top-0 start-100 translate-middle"
                  style={{ fontSize: '0.65rem', padding: '3px 5px' }}
                >
                  {tab.badge > 9 ? '9+' : tab.badge}
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
