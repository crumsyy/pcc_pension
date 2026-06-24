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

  return (
    <div className="d-flex" style={{ minHeight: "100vh" }}>
      {/* SIDEBAR */}
      <nav
        style={{
          width: "240px",
          minHeight: "100vh",
          backgroundColor: "var(--pcc-blue)",
          flexShrink: 0,
          position: "sticky",
          top: 0,
        }}
        className="d-flex flex-column p-3"
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

      {/* MAIN CONTENT */}
      <div className="flex-grow-1 p-4" style={{ backgroundColor: "#f6faf7", minHeight: "100vh" }}>
        {children}
      </div>
    </div>
  );
}
