"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast, Toaster } from "sonner";

export default function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [filterTab, setFilterTab] = useState("all"); // "all" | "unread"

  const dropdownRef = useRef(null);
  const clientReadIDsRef = useRef(new Set());
  const knownNotifIDsRef = useRef(null);

  // Web Audio API Synthesizer Chime
  const playNotificationChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc2.type = "sine";
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
        const list = rawList.map((n) => ({
          ...n,
          isRead: clientReadIDsRef.current.has(n.notificationID) ? 1 : n.isRead ? 1 : 0,
        }));

        // Detect brand-new incoming unread notifications
        if (knownNotifIDsRef.current !== null) {
          const brandNewUnread = list.filter(
            (n) => !n.isRead && !knownNotifIDsRef.current.has(n.notificationID)
          );
          if (brandNewUnread.length > 0) {
            setIsRinging(true);
            setTimeout(() => setIsRinging(false), 1600);
            playNotificationChime();

            // Fire modern Sonner rich toasts for new incoming alerts
            brandNewUnread.slice(0, 3).forEach((n) => {
              const lowerTitle = (n.title || "").toLowerCase();
              const isNoStock = lowerTitle.includes("no stock") || lowerTitle.includes("out of stock");
              const isLowStock = lowerTitle.includes("low inventory") || lowerTitle.includes("stock");
              const isPayment = lowerTitle.includes("payment") || lowerTitle.includes("gcash");

              const actionConfig = {
                label: isNoStock || isLowStock ? "View Stock" : isPayment ? "View Payment" : "View",
                onClick: () => handleNotificationClick(n),
              };

              if (isNoStock) {
                toast.error(n.title, {
                  description: n.message,
                  action: actionConfig,
                  duration: 8000,
                });
              } else if (isLowStock) {
                toast.warning(n.title, {
                  description: n.message,
                  action: actionConfig,
                  duration: 6500,
                });
              } else if (isPayment) {
                toast.success(n.title, {
                  description: n.message,
                  action: actionConfig,
                  duration: 6500,
                });
              } else {
                toast.info(n.title, {
                  description: n.message,
                  action: actionConfig,
                  duration: 6000,
                });
              }
            });
          }
        }

        knownNotifIDsRef.current = new Set(list.map((n) => n.notificationID));
        setNotifications(list);
        setUnreadCount(list.filter((n) => !n.isRead).length);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // High-frequency 3-second real-time polling
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchNotifications();
      }
    }, 3000);

    const handleFocus = () => fetchNotifications();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchNotifications();
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
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const toggleDropdown = async () => {
    const willOpen = !isOpen;
    setIsOpen(willOpen);
    if (willOpen) {
      await fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setNotifications((prev) => {
        prev.forEach((n) => clientReadIDsRef.current.add(n.notificationID));
        return prev.map((n) => ({ ...n, isRead: 1 }));
      });
      setUnreadCount(0);
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (res.ok) {
        const data = await res.json();
        (data.updatedIDs || []).forEach((id) => clientReadIDsRef.current.add(id));
      }
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    }
  };

  const handleMarkRead = async (notificationID) => {
    try {
      clientReadIDsRef.current.add(notificationID);
      setNotifications((prev) =>
        prev.map((n) => (n.notificationID === notificationID ? { ...n, isRead: 1 } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", notificationID }),
      });
      if (res.ok) {
        const data = await res.json();
        (data.updatedIDs || []).forEach((id) => clientReadIDsRef.current.add(id));
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

    const fullText = `${n.title || ""} ${n.message || ""}`;
    const lowerTitle = (n.title || "").toLowerCase();
    const lowerMsg = (n.message || "").toLowerCase();

    const bookingMatch =
      fullText.match(/booking\s*#?\s*(\d+)/i) || fullText.match(/stay\s*#?\s*(\d+)/i);
    const bookingID = bookingMatch ? bookingMatch[1] : "";

    const orderMatch = fullText.match(/order\s*#?\s*(\d+)/i);
    const orderID = orderMatch ? orderMatch[1] : "";

    const resMatch = fullText.match(/reservation\s*#?\s*(\d+)/i);
    const reservationID = resMatch ? resMatch[1] : "";

    const isGuest = pathname ? pathname.startsWith("/guest") : false;

    if (isGuest) {
      if (lowerTitle.includes("order") || lowerMsg.includes("order")) {
        const url = orderID
          ? `/guest/dashboard?tab=orders&highlightOrderID=${orderID}`
          : "/guest/dashboard?tab=orders";
        router.push(url);
      } else if (
        lowerTitle.includes("payment") ||
        lowerMsg.includes("payment") ||
        lowerTitle.includes("bill")
      ) {
        const url = bookingID
          ? `/guest/dashboard?tab=home&openBilling=${bookingID}`
          : "/guest/dashboard?tab=home";
        router.push(url);
      } else if (lowerTitle.includes("inquiry") || lowerMsg.includes("inquiry")) {
        router.push("/guest/inquiries");
      } else {
        const url = bookingID
          ? `/guest/dashboard?highlightBookingID=${bookingID}`
          : reservationID
          ? `/guest/dashboard?highlightResID=${reservationID}`
          : "/guest/dashboard";
        router.push(url);
      }
      return;
    }

    // Admin Routing
    const isAdmin = pathname ? pathname.startsWith("/admin") : false;
    if (isAdmin) {
      if (lowerTitle.includes("inventory") || lowerTitle.includes("stock")) {
        router.push("/admin/inventory");
        return;
      }
      if (
        lowerTitle.includes("payment") ||
        lowerMsg.includes("payment") ||
        lowerTitle.includes("down payment") ||
        lowerTitle.includes("gcash")
      ) {
        router.push("/admin/reports");
        return;
      }
    }

    // Receptionist Routing
    if (lowerTitle.includes("checkout") || lowerMsg.includes("checkout")) {
      const url = bookingID
        ? `/receptionist/checkin?highlightBookingID=${bookingID}`
        : "/receptionist/checkin";
      router.push(url);
    } else if (
      lowerTitle.includes("check-in") ||
      lowerMsg.includes("check-in") ||
      lowerTitle.includes("arrival") ||
      lowerMsg.includes("arrival")
    ) {
      const url = bookingID
        ? `/receptionist/checkin?highlightBookingID=${bookingID}`
        : "/receptionist/checkin";
      router.push(url);
    } else if (
      lowerTitle.includes("order") ||
      lowerMsg.includes("order") ||
      lowerTitle.includes("meal")
    ) {
      const url = orderID
        ? `/receptionist/orders?highlightOrderID=${orderID}`
        : "/receptionist/orders";
      router.push(url);
    } else if (
      lowerTitle.includes("payment") ||
      lowerMsg.includes("payment") ||
      lowerTitle.includes("down payment")
    ) {
      const url = bookingID
        ? `/receptionist/payments?bookingID=${bookingID}`
        : "/receptionist/payments";
      router.push(url);
    } else if (
      lowerTitle.includes("reservation") ||
      lowerTitle.includes("courtesy hold") ||
      lowerMsg.includes("reservation")
    ) {
      const url = reservationID
        ? `/receptionist/reservations?highlightResID=${reservationID}`
        : "/receptionist/reservations";
      router.push(url);
    } else if (lowerTitle.includes("inquiry") || lowerMsg.includes("inquiry")) {
      router.push("/receptionist/inquiries");
    } else if (lowerTitle.includes("inventory") || lowerTitle.includes("stock")) {
      router.push("/admin/inventory");
    } else if (bookingID) {
      router.push(`/receptionist/checkin?highlightBookingID=${bookingID}`);
    }
  };

  const getNotificationTheme = (title = "") => {
    const t = title.toLowerCase();
    if (t.includes("no stock") || t.includes("out of stock")) {
      return {
        icon: "bi-x-octagon-fill text-danger",
        badgeBg: "rgba(239, 68, 68, 0.12)",
        badgeColor: "#dc2626",
        borderAccent: "#ef4444",
        category: "No Stock",
      };
    }
    if (t.includes("low inventory") || t.includes("low stock")) {
      return {
        icon: "bi-exclamation-triangle-fill text-warning",
        badgeBg: "rgba(245, 158, 11, 0.12)",
        badgeColor: "#d97706",
        borderAccent: "#f59e0b",
        category: "Low Stock",
      };
    }
    if (t.includes("payment") || t.includes("billing") || t.includes("gcash")) {
      return {
        icon: "bi-credit-card-fill text-success",
        badgeBg: "rgba(16, 185, 129, 0.12)",
        badgeColor: "#059669",
        borderAccent: "#10b981",
        category: "Payment",
      };
    }
    if (
      t.includes("booking") ||
      t.includes("reservation") ||
      t.includes("check-in") ||
      t.includes("check-out")
    ) {
      return {
        icon: "bi-calendar-check-fill text-primary",
        badgeBg: "rgba(37, 99, 235, 0.12)",
        badgeColor: "#2563eb",
        borderAccent: "#3b82f6",
        category: "Booking",
      };
    }
    return {
      icon: "bi-bell-fill text-info",
      badgeBg: "rgba(6, 182, 212, 0.12)",
      badgeColor: "#0891b2",
      borderAccent: "#06b6d4",
      category: "System",
    };
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now - date) / 1000);
      if (diffSec < 45) return "Just now";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch (e) {
      return "";
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterTab === "unread") return !n.isRead;
    return true;
  });

  return (
    <div className="position-relative d-inline-block" ref={dropdownRef}>
      <Toaster position="top-right" richColors closeButton expand={false} />

      {/* Bell Shake Keyframes */}
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
        .pcc-notif-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 360px;
          max-width: 90vw;
          background: #ffffff;
          border-radius: 14px;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);
          border: 1px solid rgba(226, 232, 240, 0.95);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          z-index: 1060;
          animation: pccFadeInDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes pccFadeInDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .pcc-notif-card-down {
          transition: transform 0.15s ease, background-color 0.15s ease;
        }
        .pcc-notif-card-down:hover {
          background-color: #f1f5f9 !important;
        }
      `}</style>

      {/* Bell Trigger Button */}
      <button
        onClick={toggleDropdown}
        className={`btn btn-sm d-inline-flex align-items-center justify-content-center rounded-circle p-0 transition-all position-relative ${
          isRinging ? "bell-ring-active" : ""
        }`}
        style={{
          width: "38px",
          height: "38px",
          backgroundColor: "rgba(255, 255, 255, 0.18)",
          color: "#ffffff",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          cursor: "pointer",
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
              zIndex: 5,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Modern Dropdown Menu */}
      {isOpen && (
        <div className="pcc-notif-dropdown">
          {/* Header */}
          <div
            className="d-flex flex-column text-white px-3 py-2.5"
            style={{
              background: "linear-gradient(135deg, #0B2F4C 0%, #164e63 100%)",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-bell-fill text-warning fs-6"></i>
                <span className="fw-bold small mb-0" style={{ letterSpacing: "-0.2px" }}>
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span
                    className="badge rounded-pill bg-danger"
                    style={{ fontSize: "0.62rem", padding: "2px 6px" }}
                  >
                    {unreadCount} new
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="btn btn-xs btn-outline-light rounded-pill px-2 py-0.5 fw-semibold d-inline-flex align-items-center gap-1"
                  style={{ fontSize: "0.68rem" }}
                  title="Mark all notifications as read"
                >
                  <i className="bi bi-check2-all"></i>
                  Mark all read
                </button>
              )}
            </div>

            {/* Segmented Filter Pills */}
            <div
              className="d-flex p-0.5 rounded-pill"
              style={{
                background: "rgba(0, 0, 0, 0.22)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
              }}
            >
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`btn btn-sm flex-fill rounded-pill py-0.5 fw-semibold transition-all ${
                  filterTab === "all"
                    ? "bg-white text-dark shadow-sm"
                    : "text-white-50 border-0 bg-transparent"
                }`}
                style={{ fontSize: "0.7rem" }}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("unread")}
                className={`btn btn-sm flex-fill rounded-pill py-0.5 fw-semibold transition-all ${
                  filterTab === "unread"
                    ? "bg-white text-dark shadow-sm"
                    : "text-white-50 border-0 bg-transparent"
                }`}
                style={{ fontSize: "0.7rem" }}
              >
                Unread ({unreadCount})
              </button>
            </div>
          </div>

          {/* List Area */}
          <div
            className="flex-grow-1 overflow-auto p-2"
            style={{ maxHeight: "360px", backgroundColor: "#f8fafc" }}
          >
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-4 text-muted small">
                <i className="bi bi-bell-slash fs-3 d-block mb-1 text-secondary opacity-50"></i>
                {filterTab === "unread" ? "No unread alerts." : "No notifications yet."}
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const theme = getNotificationTheme(n.title);
                const isUnread = !n.isRead;

                return (
                  <div
                    key={n.notificationID}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleNotificationClick(n)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") handleNotificationClick(n);
                    }}
                    className={`pcc-notif-card-down p-2.5 mb-1.5 rounded-3 border transition-all ${
                      isUnread
                        ? "bg-white border-primary-subtle shadow-xs"
                        : "bg-white border-light text-muted opacity-85"
                    }`}
                    style={{
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      borderLeft: `4px solid ${theme.borderAccent} !important`,
                    }}
                    title="Click to view details"
                  >
                    <div className="d-flex align-items-start gap-2">
                      <div
                        className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0 mt-0.5"
                        style={{
                          width: "30px",
                          height: "30px",
                          background: theme.badgeBg,
                        }}
                      >
                        <i className={`bi ${theme.icon} fs-6`}></i>
                      </div>

                      <div className="flex-grow-1 min-w-0">
                        <div className="d-flex justify-content-between align-items-start mb-0.5">
                          <span
                            className={`fw-bold text-truncate pe-1 ${
                              isUnread ? "text-dark" : "text-secondary"
                            }`}
                            style={{ fontSize: "0.82rem" }}
                          >
                            {n.title}
                          </span>
                          {isUnread && (
                            <span
                              className="badge rounded-circle p-1 flex-shrink-0"
                              style={{
                                backgroundColor: "#3b82f6",
                                width: "6px",
                                height: "6px",
                                marginTop: "4px",
                              }}
                              title="Unread"
                            ></span>
                          )}
                        </div>

                        <p
                          className="mb-1 text-secondary"
                          style={{
                            fontSize: "0.77rem",
                            lineHeight: "1.32",
                            wordBreak: "break-word",
                          }}
                        >
                          {n.message}
                        </p>

                        <div className="d-flex justify-content-between align-items-center pt-0.5">
                          <small className="text-muted" style={{ fontSize: "0.68rem" }}>
                            {formatTimeAgo(n.createdAt)}
                          </small>
                          <small className="text-primary fw-semibold" style={{ fontSize: "0.68rem" }}>
                            View <i className="bi bi-chevron-right ms-0.5"></i>
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

