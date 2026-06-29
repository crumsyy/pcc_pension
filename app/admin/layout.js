import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionRole } from "@/lib/session";
import NotificationBell from "../components/NotificationBell";

export const unstable_instant = false;

export default async function AdminLayout({ children }) {
  const auth = await requireSessionRole("Administrator");
  if (auth.redirect) {
    redirect(auth.redirect);
  }

  const { session } = auth;

  const adminNav = [
    [
      "/admin/dashboard",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
      "Dashboard"
    ],
    [
      "/admin/users",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      "User Management"
    ],
    [
      "/admin/rooms",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16"/><path d="M2 11h20"/><path d="M22 4v16"/><path d="M2 16h20"/><path d="M6 11V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/></svg>,
      "Room Management"
    ],
    [
      "/admin/amenities",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z"/></svg>,
      "Amenities"
    ],
    [
      "/admin/products",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
      "Products"
    ],
    [
      "/admin/inventory",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/><line x1="9" y1="8" x2="10" y2="8"/></svg>,
      "Inventory"
    ],
    [
      "/admin/purchase-orders",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
      "Purchase Orders"
    ],
    [
      "/admin/discounts",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
      "Discounts & Promos"
    ],
    [
      "/admin/reports",
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
      "Reports"
    ],
  ];

  // Helper to render the navigation links list
  const renderNavLinks = () => (
    <ul className="nav flex-column gap-1" style={{ paddingLeft: "0", listStyle: "none" }}>
      {adminNav.map(([path, icon, label], index) => (
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
          <span className="fw-bold text-white" style={{ fontSize: "0.95rem" }}>PCC Admin</span>
        </Link>
        <div className="d-flex align-items-center gap-2">
          <NotificationBell />
          <button 
            className="btn btn-outline-light d-flex align-items-center justify-content-center p-2" 
            type="button" 
            data-bs-toggle="offcanvas" 
            data-bs-target="#adminOffcanvas" 
            aria-controls="adminOffcanvas"
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
        id="adminOffcanvas" 
        aria-labelledby="adminOffcanvasLabel"
        style={{ backgroundColor: "var(--pcc-blue)", color: "white", width: "260px" }}
      >
        <div className="offcanvas-header d-flex justify-content-between align-items-center p-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <h5 className="offcanvas-title fw-bold" id="adminOffcanvasLabel">PCC Administration</h5>
          <button type="button" className="btn-close btn-close-white text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div className="offcanvas-body d-flex flex-column p-3">
          <div className="mb-2" style={{ fontFamily: "var(--font-tag)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)" }}>
            Navigation Menu
          </div>
          {renderNavLinks()}
          <div className="mt-auto pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.2)" }}>
            <div className="text-white-50" style={{ fontSize: "0.75rem" }}>Logged in as</div>
            <div className="text-white fw-semibold" style={{ fontSize: "0.88rem" }}>{session.fullName}</div>
            <div className="text-white-50 mb-2" style={{ fontSize: "0.75rem" }}>Administrator</div>
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
            color: "rgba(255,255,255,0.45)",
            marginBottom: "0.5rem",
          }}
        >
          Administration
        </div>
        
        {/* Render nav links */}
        {renderNavLinks()}

        <div className="mt-auto pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.2)" }}>
          <div className="text-white-50" style={{ fontSize: "0.75rem" }}>Logged in as</div>
          <div className="text-white fw-semibold" style={{ fontSize: "0.88rem" }}>{session.fullName}</div>
          <div className="text-white-50" style={{ fontSize: "0.75rem" }}>Administrator</div>
          <a
            href="/api/auth/logout"
            className="btn btn-sm mt-2 w-100"
            style={{
              backgroundColor: "rgba(255,255,255,0.12)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            Log Out
          </a>
        </div>
      </nav>

      {/* MAIN CONTENT (Responsive margins and padding) */}
      <div className="flex-grow-1 d-flex flex-column pcc-main-wrapper" style={{ backgroundColor: "#f6faf7", minHeight: "100vh" }}>
        {/* DESKTOP TOP BAR (Only visible on screens >= 992px) */}
        <header className="d-none d-lg-flex justify-content-between align-items-center px-4 py-3 bg-white border-bottom shadow-sm">
          <div>
            <h4 className="m-0 text-dark fw-bold" style={{ fontSize: "1.1rem" }}>PCC Pension Administration</h4>
          </div>
          <div className="d-flex align-items-center gap-3">
            <NotificationBell />
            <div className="text-end" style={{ borderLeft: "1px solid #eee", paddingLeft: "15px" }}>
              <div className="fw-semibold text-dark" style={{ fontSize: "0.85rem" }}>{session.fullName}</div>
              <div className="text-muted" style={{ fontSize: "0.72rem" }}>Administrator</div>
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
