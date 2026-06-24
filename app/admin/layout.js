import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionRole } from "@/lib/session";

export default async function AdminLayout({ children }) {
  const auth = await requireSessionRole("Administrator");
  if (auth.redirect) {
    redirect(auth.redirect);
  }

  const { session } = auth;

  const adminNav = [
    ["/admin/dashboard", "📊", "Dashboard"],
    ["/admin/users", "👥", "User Management"],
    ["/admin/rooms", "🛏", "Room Management"],
    ["/admin/amenities", "🧴", "Amenities"],
    ["/admin/products", "📦", "Products"],
    ["/admin/inventory", "📋", "Inventory"],
    ["/admin/purchase-orders", "🛒", "Purchase Orders"],
    ["/admin/discounts", "🏷", "Discounts & Promos"],
    ["/admin/reports", "📈", "Reports"],
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
      <div className="d-flex d-lg-none justify-content-between align-items-center p-3 text-white sticky-top" style={{ backgroundColor: "var(--pcc-blue)", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", zIndex: 1030 }}>
        <Link href="/" className="d-flex align-items-center gap-2 text-decoration-none">
          <img src="/assets/images/logo.jpg" alt="PCC Logo" style={{ height: "36px", borderRadius: "4px" }} />
          <span className="fw-bold text-white" style={{ fontSize: "0.95rem" }}>PCC Admin</span>
        </Link>
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
        className="d-none d-lg-flex flex-column p-3"
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
      <main className="flex-grow-1 p-3 p-lg-4" style={{ backgroundColor: "#f6faf7", minHeight: "100vh" }}>
        {children}
      </main>
    </div>
  );
}
