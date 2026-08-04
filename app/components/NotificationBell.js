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
    // Poll every 4 seconds for near real-time notifications
    const interval = setInterval(fetchNotifications, 4000);
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
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", notificationID: id }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.notificationID === id ? { ...n, isRead: 1 } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="position-relative" ref={dropdownRef} style={{ zIndex: 1050 }}>
      <button
        onClick={toggleDropdown}
        className="btn d-flex align-items-center justify-content-center p-0 rounded-circle"
        style={{
          width: "36px",
          height: "36px",
          background: "none",
          border: "none",
          color: "currentColor",
          cursor: "pointer",
          transition: "transform 0.2s ease, opacity 0.2s ease"
        }}
        aria-label="Notifications"
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-light"
            style={{ fontSize: "0.65rem", padding: "0.25em 0.5em" }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="position-absolute bg-white rounded shadow-lg border mt-2"
          style={{
            width: "320px",
            right: 0,
            maxHeight: "400px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            borderColor: "var(--pcc-mist)"
          }}
        >
          {/* Header */}
          <div
            className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom"
            style={{ backgroundColor: "#fbfdfb" }}
          >
            <span className="fw-bold text-dark" style={{ fontSize: "0.9rem" }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="btn btn-link p-0 text-blue fw-semibold text-decoration-none"
                style={{ fontSize: "0.75rem" }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List Area */}
          <div className="flex-grow-1 overflow-auto" style={{ maxHeight: "330px" }}>
            {notifications.length === 0 ? (
              <div className="text-center py-4 text-muted" style={{ fontSize: "0.85rem" }}>
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notificationID}
                  onClick={() => !n.isRead && handleMarkRead(n.notificationID)}
                  className={`px-3 py-2 border-bottom ${!n.isRead ? "bg-light" : ""}`}
                  style={{
                    cursor: !n.isRead ? "pointer" : "default",
                    transition: "background-color 0.2s ease"
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <span
                      className={`fw-semibold ${!n.isRead ? "text-dark" : "text-muted"}`}
                      style={{ fontSize: "0.82rem" }}
                    >
                      {n.title}
                    </span>
                    {!n.isRead && (
                      <span
                        className="bg-primary rounded-circle"
                        style={{ width: "6px", height: "6px", display: "inline-block", marginTop: "4px" }}
                      ></span>
                    )}
                  </div>
                  <p
                    className="mb-1 text-muted mt-1"
                    style={{ fontSize: "0.75rem", lineHeight: "1.3", whiteSpace: "pre-line" }}
                  >
                    {n.message}
                  </p>
                  <div className="text-end" style={{ fontSize: "0.65rem", color: "var(--pcc-muted)" }}>
                    {formatTime(n.createdAt)}
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
