import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionRole } from "@/lib/session";
import NotificationBell from "../components/NotificationBell";

export const unstable_instant = false;

export default async function ReceptionistLayout({ children }) {
  const auth = await requireSessionRole("Receptionist");
  if (auth.redirect) {
    redirect(auth.redirect);
  }

  const { session } = auth;

  const receptionistNav = [
    [
      "/receptionist/dashboard",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
      "Dashboard"
    ],
    [
      "/receptionist/reservations",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
      "Reservations"
    ],
    [
      "/receptionist/bookings",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16"/><path d="M2 11h20"/><path d="M22 4v16"/><path d="M2 16h20"/><path d="M6 11V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/></svg>,
      "Bookings"
    ],
    [
      "/receptionist/checkin",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
      "Check-In / Out"
    ],
    [
      "/receptionist/orders",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>,
      "Orders"
    ],
    [
      "/receptionist/billing",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M16 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/></svg>,
      "Billing"
    ],
    [
      "/receptionist/payments",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
      "Payments"
    ],
    [
      "/receptionist/guests",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
      "Guests"
    ],
  ];

  // Helper to render the navigation links list
  const renderNavLinks = () => (
    <ul className="nav flex-column gap-1" style={{ paddingLeft: "0", listStyle: "none" }}>
      {receptionistNav.map(([path, icon, label], index) => (
        <li key={index}>
          <Link
            href={path}
            className="nav-link text-white d-flex align-items-center gap-2 mb-1 px-2 py-2"
            style={{ borderRadius: "6px", fontSize: "0.9rem" }}
          >
            {icon} {label}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="d-flex flex-column flex-lg-row" style={{ minHeight: "100vh" }}>
      
      {/* MOBILE TOP BAR (Only visible on screens < 992px) */}
      <div className="d-flex d-lg-none justify-content-between align-items-center p-3 text-white sticky-top" style={{ backgroundColor: "var(--pcc-blue)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", zIndex: 1030, position: "sticky", top: 0 }}>
        <Link href="/" className="d-flex align-items-center gap-2 text-decoration-none">
          <img src="/assets/images/logo.jpg" alt="PCC Logo" style={{ height: "36px", borderRadius: "4px" }} />
          <span className="fw-bold text-white" style={{ fontSize: "0.95rem" }}>PCC Front Desk</span>
        </Link>
        <div className="d-flex align-items-center gap-2">
          <NotificationBell />
          <button 
            className="btn btn-outline-light d-flex align-items-center justify-content-center p-2" 
            type="button" 
            data-bs-toggle="offcanvas" 
            data-bs-target="#receptionistOffcanvas" 
            aria-controls="receptionistOffcanvas"
            style={{ width: "38px", height: "38px", borderRadius: "6px" }}
          >
            ☰
          </button>
        </div>
      </div>

      {/* MOBILE OFFCANVAS DRAWER (Only visible on screens < 992px when opened) */}
      <div 
        className="offcanvas offcanvas-start d-lg-none" 
        tabIndex="-1" 
        id="receptionistOffcanvas" 
        aria-labelledby="receptionistOffcanvasLabel"
        style={{ backgroundColor: "var(--pcc-blue)", color: "white", width: "260px" }}
      >
        <div className="offcanvas-header d-flex justify-content-between align-items-center p-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <h5 className="offcanvas-title fw-bold" id="receptionistOffcanvasLabel">PCC Front Desk</h5>
          <button type="button" className="btn-close btn-close-white text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body d-flex flex-column p-3">
          <div className="mb-2" style={{ fontFamily: "var(--font-tag)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)" }}>
            Front Desk Menu
          </div>
          {renderNavLinks()}
          <div className="mt-auto pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.2)" }}>
            <div className="text-white-50" style={{ fontSize: "0.75rem" }}>Logged in as</div>
            <div className="text-white fw-semibold" style={{ fontSize: "0.88rem" }}>{session.fullName}</div>
            <div className="text-white-50 mb-2" style={{ fontSize: "0.75rem" }}>Receptionist</div>
            <a
              href="/api/auth/logout"
              className="btn btn-sm w-100"
              style={{
                backgroundColor: "rgba(255,255,255,0.12)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              Log Out
            </a>
          </div>
        </div>
      </div>

      {/* DESKTOP SIDEBAR (Only visible on screens >= 992px) */}
      <nav
        style={{
          width: "240px",
          backgroundColor: "var(--pcc-blue)",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh"
        }}
        className="d-none d-lg-flex flex-column p-3 pcc-fixed-sidebar"
      >
        <div className="mb-4 text-center">
          <Link href="/">
            <img src="/assets/images/logo.jpg" alt="PCC Logo" style={{ maxWidth: "140px", borderRadius: "6px" }} />
          </Link>
        </div>
        <div
          style={{
            fontFamily: "var(--font-tag)",
            fontSize: "0.68rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "rgba(255, 255, 255, 0.45)",
            marginBottom: "0.5rem",
          }}
        >
          Front Desk
        </div>
        
        {/* Render nav links */}
        {renderNavLinks()}

        <div className="mt-auto pt-3" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.2)" }}>
          <div className="text-white-50" style={{ fontSize: "0.75rem" }}>Logged in as</div>
          <div className="text-white fw-semibold" style={{ fontSize: "0.88rem" }}>{session.fullName}</div>
          <div className="text-white-50" style={{ fontSize: "0.75rem" }}>Receptionist</div>
          <a
            href="/api/auth/logout"
            className="btn btn-sm mt-2 w-100"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              color: "#fff",
              border: "1px solid rgba(255, 255, 255, 0.3)",
            }}
          >
            Log Out
          </a>
        </div>
      </nav>

      {/* MAIN CONTENT PORTION (Responsive margins and padding) */}
      <div className="flex-grow-1 d-flex flex-column pcc-main-wrapper" style={{ backgroundColor: "#f0f4f8", minHeight: "100vh" }}>
        {/* DESKTOP TOP BAR (Only visible on screens >= 992px) */}
        <header className="d-none d-lg-flex justify-content-between align-items-center px-4 py-3 bg-white border-bottom shadow-sm">
          <div>
            <h4 className="m-0 text-dark fw-bold" style={{ fontSize: "1.1rem" }}>PCC Front Desk Panel</h4>
          </div>
          <div className="d-flex align-items-center gap-3">
            <NotificationBell />
            <div className="text-end" style={{ borderLeft: "1px solid #eee", paddingLeft: "15px" }}>
              <div className="fw-semibold text-dark" style={{ fontSize: "0.85rem" }}>{session.fullName}</div>
              <div className="text-muted" style={{ fontSize: "0.72rem" }}>Receptionist</div>
            </div>
          </div>
        </header>

        <main className="flex-grow-1 p-3 p-lg-4">
          {children}
        </main>
      </div>
    </div>
  );
}
