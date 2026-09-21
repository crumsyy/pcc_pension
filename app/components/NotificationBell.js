"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        const list = data.notifications || [];
        setNotifications(list);
        setUnreadCount(list.filter(n => !n.isRead).length);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
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
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    }
  };

  const handleMarkRead = async (notificationID) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationID }),
      });
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => (n.notificationID === notificationID ? { ...n, isRead: 1 } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
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
        router.push('/guest/dashboard?tab=orders');
      } else if (lowerTitle.includes('payment') || lowerMsg.includes('payment') || lowerTitle.includes('bill')) {
        router.push('/guest/dashboard?tab=billing');
      } else if (lowerTitle.includes('inquiry') || lowerMsg.includes('inquiry')) {
        router.push('/guest/inquiries');
      } else {
        router.push('/guest/dashboard');
      }
      return;
    }

    // Receptionist / Admin Routing
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
      <button
        onClick={toggleDropdown}
        className="btn btn-sm d-inline-flex align-items-center justify-content-center rounded-circle p-0 transition-all position-relative"
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
    </div>
  );
}
