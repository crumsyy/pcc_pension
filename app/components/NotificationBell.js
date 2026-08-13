"use client";

import { useState, useEffect, useRef } from "react";

export default function NotificationBell() {
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
            className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-white"
            style={{ fontSize: "0.6rem", padding: "0.22em 0.45em" }}
          >
            {unreadCount}
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
                  onClick={() => !n.isRead && handleMarkRead(n.notificationID)}
                  className={`p-2.5 mb-1.5 rounded-3 border transition-all ${
                    !n.isRead ? "bg-light border-primary-subtle shadow-xs" : "bg-white border-light text-muted"
                  }`}
                  style={{
                    cursor: !n.isRead ? "pointer" : "default",
                    fontSize: "0.8rem"
                  }}
                >
                  <div className="d-flex align-items-start gap-3">
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
                      <small className="text-muted d-block" style={{ fontSize: "0.68rem" }}>
                        {new Date(n.createdAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                      </small>
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
