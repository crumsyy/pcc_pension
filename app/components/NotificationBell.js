"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [activeToast, setActiveToast] = useState(null);
  const dropdownRef = useRef(null);
  const clientReadIDsRef = useRef(new Set());
  const knownNotifIDsRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // Web Audio API Synthesizer Chime (zero external audio file dependency)
  const playNotificationChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.12); // A5

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.25);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.65);
    } catch (e) {
      // AudioContext blocked or muted
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        const rawList = data.notifications || [];
        const list = rawList.map(n => ({
          ...n,
          isRead: clientReadIDsRef.current.has(n.notificationID) ? 1 : (n.isRead ? 1 : 0)
        }));

        // Detect new unread incoming notifications
        if (knownNotifIDsRef.current !== null) {
          const brandNewUnread = list.filter(n => !n.isRead && !knownNotifIDsRef.current.has(n.notificationID));
          if (brandNewUnread.length > 0) {
            setIsRinging(true);
            setTimeout(() => setIsRinging(false), 1600);
            playNotificationChime();
            
            // Show latest toast
            const latest = brandNewUnread[0];
            setActiveToast(latest);
            if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
            toastTimeoutRef.current = setTimeout(() => {
              setActiveToast(null);
            }, 6000);
          }
        }

        knownNotifIDsRef.current = new Set(list.map(n => n.notificationID));
        setNotifications(list);
        setUnreadCount(list.filter(n => !n.isRead).length);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // High-frequency 3-second real-time polling
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchNotifications();
      }
    }, 3000);

    // Instant sync on tab focus or visibility change
    const handleFocus = () => fetchNotifications();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchNotifications();
    };
    const handleCustomRefresh = () => fetchNotifications();

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pcc-refresh-notifications", handleCustomRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pcc-refresh-notifications", handleCustomRefresh);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = async () => {
    const willOpen = !isOpen;
    setIsOpen(willOpen);
    if (willOpen) {
      await fetchNotifications();
      handleMarkAllRead();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setNotifications(prev => {
        prev.forEach(n => clientReadIDsRef.current.add(n.notificationID));
        return prev.map(n => ({ ...n, isRead: 1 }));
      });
      setUnreadCount(0);
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (res.ok) {
        const data = await res.json();
        (data.updatedIDs || []).forEach(id => clientReadIDsRef.current.add(id));
      }
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    }
  };

  const handleMarkRead = async (notificationID) => {
    try {
      clientReadIDsRef.current.add(notificationID);
      setNotifications(prev =>
        prev.map(n => (n.notificationID === notificationID ? { ...n, isRead: 1 } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", notificationID }),
      });
      if (res.ok) {
        const data = await res.json();
        (data.updatedIDs || []).forEach(id => clientReadIDsRef.current.add(id));
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleNotificationClick = async (n) => {
    if (!n.isRead) {
      await handleMarkRead(n.notificationID);
    }
    setIsOpen(false);

    const fullText = `${n.title || ''} ${n.message || ''}`;
    const lowerTitle = (n.title || '').toLowerCase();
    const lowerMsg = (n.message || '').toLowerCase();

    // Extract identifiers if available
    const bookingMatch = fullText.match(/booking\s*#?\s*(\d+)/i) || fullText.match(/stay\s*#?\s*(\d+)/i);
    const bookingID = bookingMatch ? bookingMatch[1] : '';

    const orderMatch = fullText.match(/order\s*#?\s*(\d+)/i);
    const orderID = orderMatch ? orderMatch[1] : '';

    const resMatch = fullText.match(/reservation\s*#?\s*(\d+)/i);
    const reservationID = resMatch ? resMatch[1] : '';

    const isGuest = pathname ? pathname.startsWith('/guest') : false;

    if (isGuest) {
      if (lowerTitle.includes('order') || lowerMsg.includes('order')) {
        const url = orderID ? `/guest/dashboard?tab=orders&highlightOrderID=${orderID}` : '/guest/dashboard?tab=orders';
        router.push(url);
      } else if (lowerTitle.includes('payment') || lowerMsg.includes('payment') || lowerTitle.includes('bill')) {
        const url = bookingID ? `/guest/dashboard?tab=home&openBilling=${bookingID}` : '/guest/dashboard?tab=home';
        router.push(url);
      } else if (lowerTitle.includes('inquiry') || lowerMsg.includes('inquiry')) {
        router.push('/guest/inquiries');
      } else {
        const url = bookingID ? `/guest/dashboard?highlightBookingID=${bookingID}` : (reservationID ? `/guest/dashboard?highlightResID=${reservationID}` : '/guest/dashboard');
        router.push(url);
      }
      return;
    }

    // Admin Routing
    const isAdmin = pathname ? pathname.startsWith('/admin') : false;
    if (isAdmin) {
      if (lowerTitle.includes('inventory') || lowerTitle.includes('stock')) {
        router.push('/admin/inventory');
        return;
      }
      if (lowerTitle.includes('payment') || lowerMsg.includes('payment') || lowerTitle.includes('down payment') || lowerTitle.includes('gcash')) {
        router.push('/admin/reports');
        return;
      }
    }

    // Receptionist Routing
    if (lowerTitle.includes('checkout') || lowerMsg.includes('checkout')) {
      const url = bookingID ? `/receptionist/checkin?highlightBookingID=${bookingID}` : '/receptionist/checkin';
      router.push(url);
    } else if (lowerTitle.includes('check-in') || lowerMsg.includes('check-in') || lowerTitle.includes('arrival') || lowerMsg.includes('arrival')) {
      const url = bookingID ? `/receptionist/checkin?highlightBookingID=${bookingID}` : '/receptionist/checkin';
      router.push(url);
    } else if (lowerTitle.includes('order') || lowerMsg.includes('order') || lowerTitle.includes('meal')) {
      const url = orderID ? `/receptionist/orders?highlightOrderID=${orderID}` : '/receptionist/orders';
      router.push(url);
    } else if (lowerTitle.includes('payment') || lowerMsg.includes('payment') || lowerTitle.includes('down payment')) {
      const url = bookingID ? `/receptionist/payments?bookingID=${bookingID}` : '/receptionist/payments';
      router.push(url);
    } else if (lowerTitle.includes('reservation') || lowerTitle.includes('courtesy hold') || lowerMsg.includes('reservation')) {
      const url = reservationID ? `/receptionist/reservations?highlightResID=${reservationID}` : '/receptionist/reservations';
      router.push(url);
    } else if (lowerTitle.includes('inquiry') || lowerMsg.includes('inquiry')) {
      router.push('/receptionist/inquiries');
    } else if (lowerTitle.includes('inventory') || lowerTitle.includes('stock')) {
      router.push('/admin/inventory');
    } else if (bookingID) {
      router.push(`/receptionist/checkin?highlightBookingID=${bookingID}`);
    }
  };

  const getNotificationIcon = (title = '') => {
    const t = title.toLowerCase();
    if (t.includes('payment') || t.includes('billing') || t.includes('balance')) return 'bi-credit-card-fill text-success';
    if (t.includes('booking') || t.includes('reservation') || t.includes('check-in')) return 'bi-calendar-check-fill text-primary';
    if (t.includes('alert') || t.includes('stock') || t.includes('warning')) return 'bi-exclamation-triangle-fill text-warning';
    return 'bi-bell-fill text-info';
  };

  return (
    <div className="position-relative d-inline-block" ref={dropdownRef}>
      <style jsx global>{`
        @keyframes pccBellRing {
          0% { transform: rotate(0); }
          15% { transform: rotate(16deg); }
          30% { transform: rotate(-16deg); }
          45% { transform: rotate(12deg); }
          60% { transform: rotate(-12deg); }
          75% { transform: rotate(5deg); }
          100% { transform: rotate(0); }
        }
        .bell-ring-active {
          animation: pccBellRing 0.75s ease-in-out infinite !important;
          background-color: rgba(255, 255, 255, 0.35) !important;
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.7) !important;
        }
      `}</style>
      <button
        onClick={toggleDropdown}
        className={`btn btn-sm d-inline-flex align-items-center justify-content-center rounded-circle p-0 transition-all position-relative ${isRinging ? 'bell-ring-active' : ''}`}
        style={{
          width: "36px",
          height: "36px",
          backgroundColor: "rgba(255, 255, 255, 0.18)",
          color: "#ffffff",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          cursor: "pointer"
        }}
        aria-label="Notifications"
        type="button"
      >
        <i className="bi bi-bell-fill fs-6"></i>
        {unreadCount > 0 && (
          <span
            className="position-absolute badge rounded-pill bg-danger border border-white d-inline-flex align-items-center justify-content-center shadow-sm"
            style={{
              top: "-2px",
              right: "-4px",
              fontSize: "0.62rem",
              fontWeight: "700",
              minWidth: "18px",
              height: "18px",
              padding: "0 4px",
              lineHeight: 1,
              zIndex: 5
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Modern Dropdown Menu */}
      {isOpen && (
        <div
          className="position-absolute bg-white rounded-3 shadow-lg border mt-2 animate__animated animate__fadeIn"
          style={{
            width: "340px",
            right: 0,
            maxHeight: "440px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            zIndex: 1060,
            borderRadius: "14px"
          }}
        >
          {/* Header */}
          <div
            className="d-flex justify-content-between align-items-center px-3 py-2.5 text-white"
            style={{ backgroundColor: "var(--pcc-blue)" }}
          >
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-bell-fill text-warning"></i>
              <span className="fw-bold small mb-0">Notifications</span>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="btn btn-xs btn-outline-light rounded-pill px-2 py-0.5 fw-semibold"
                style={{ fontSize: "0.68rem" }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List Area */}
          <div className="flex-grow-1 overflow-auto p-2" style={{ maxHeight: "360px" }}>
            {notifications.length === 0 ? (
              <div className="text-center py-4 text-muted small">
                <i className="bi bi-bell-slash fs-3 d-block mb-1 text-secondary opacity-50"></i>
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notificationID}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotificationClick(n)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleNotificationClick(n); }}
                  className={`p-2.5 mb-1.5 rounded-3 border transition-all ${
                    !n.isRead ? "bg-light border-primary-subtle shadow-xs" : "bg-white border-light text-muted"
                  }`}
                  style={{
                    cursor: "pointer",
                    fontSize: "0.8rem"
                  }}
                  title="Click to view details"
                >
                  <div className="d-flex align-items-start gap-2.5">
                    <div className="d-flex align-items-center justify-content-center rounded-circle bg-light border flex-shrink-0 mt-0.5" style={{ width: "32px", height: "32px" }}>
                      <i className={`bi ${getNotificationIcon(n.title)} fs-6`}></i>
                    </div>
                    <div className="flex-grow-1 min-w-0">
                      <div className="d-flex justify-content-between align-items-center mb-0.5">
                        <span className={`fw-bold ${!n.isRead ? "text-dark" : "text-secondary"}`}>
                          {n.title}
                        </span>
                        {!n.isRead && (
                          <span className="badge bg-primary rounded-circle p-1" style={{ width: '6px', height: '6px' }}></span>
                        )}
                      </div>
                      <p className="mb-1 text-secondary small" style={{ lineHeight: "1.3", fontSize: "0.78rem" }}>
                        {n.message}
                      </p>
                      <div className="d-flex justify-content-between align-items-center">
                        <small className="text-muted" style={{ fontSize: '0.68rem' }}>
                          {new Date(n.createdAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                        </small>
                        <small className="text-primary fw-semibold" style={{ fontSize: '0.68rem' }}>
                          View <i className="bi bi-chevron-right ms-0.5"></i>
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Real-time Floating Toast Alert Banner */}
      {activeToast && (
        <div
          className="position-fixed shadow-lg p-3 bg-white rounded-3 border border-primary border-2 animate__animated animate__fadeInDown"
          style={{
            top: '20px',
            right: '20px',
            maxWidth: '380px',
            zIndex: 99999,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}
          role="alert"
          aria-live="assertive"
        >
          <div className="d-flex align-items-start gap-2.5">
            <div
              className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0 text-white"
              style={{ width: '36px', height: '36px', backgroundColor: 'var(--pcc-blue)' }}
            >
              <i className="bi bi-bell-fill fs-6"></i>
            </div>
            <div className="flex-grow-1 min-w-0">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <strong className="text-dark small d-block text-truncate" style={{ fontSize: '0.85rem' }}>
                  {activeToast.title}
                </strong>
                <button
                  type="button"
                  className="btn-close ms-2"
                  style={{ fontSize: '0.65rem' }}
                  onClick={() => setActiveToast(null)}
                  aria-label="Close"
                ></button>
              </div>
              <p className="mb-2 text-muted small" style={{ fontSize: '0.78rem', lineHeight: '1.3' }}>
                {activeToast.message}
              </p>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-pcc-primary text-white py-1 px-2.5 rounded"
                  style={{ fontSize: '0.72rem' }}
                  onClick={() => {
                    handleNotificationClick(activeToast);
                    setActiveToast(null);
                  }}
                >
                  View Details
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary py-1 px-2 rounded"
                  style={{ fontSize: '0.72rem' }}
                  onClick={() => setActiveToast(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
