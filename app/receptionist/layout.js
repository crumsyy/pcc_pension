import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionRole } from "@/lib/session";

export default async function ReceptionistLayout({ children }) {
  const auth = await requireSessionRole("Receptionist");
  if (auth.redirect) {
    redirect(auth.redirect);
  }

  const { session } = auth;

  return (
    <div className="d-flex" style={{ minHeight: "100vh" }}>
      {/* SIDEBAR */}
      <nav
        style={{
          width: "240px",
          minHeight: "100vh",
          backgroundColor: "var(--pcc-blue)",
          flexShrink: 0,
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
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgba(255, 255, 255, 0.5)",
            marginBottom: "0.5rem",
          }}
        >
          Front Desk
        </div>
        <ul className="nav flex-column gap-1">
          <li>
            <Link
              href="/receptionist/dashboard"
              className="nav-link text-white d-flex align-items-center gap-2"
              style={{ borderRadius: "6px" }}
            >
              📊 Dashboard
            </Link>
          </li>
          <li>
            <Link
              href="/receptionist/reservations"
              className="nav-link text-white d-flex align-items-center gap-2"
              style={{ borderRadius: "6px" }}
            >
              📅 Reservations
            </Link>
          </li>
          <li>
            <Link
              href="/receptionist/bookings"
              className="nav-link text-white d-flex align-items-center gap-2"
              style={{ borderRadius: "6px" }}
            >
              🛏 Bookings
            </Link>
          </li>
          <li>
            <Link
              href="/receptionist/checkin"
              className="nav-link text-white d-flex align-items-center gap-2"
              style={{ borderRadius: "6px" }}
            >
              ✅ Check-In / Out
            </Link>
          </li>
          <li>
            <Link
              href="/receptionist/orders"
              className="nav-link text-white d-flex align-items-center gap-2"
              style={{ borderRadius: "6px" }}
            >
              🍽 Orders
            </Link>
          </li>
          <li>
            <Link
              href="/receptionist/billing"
              className="nav-link text-white d-flex align-items-center gap-2"
              style={{ borderRadius: "6px" }}
            >
              🧾 Billing
            </Link>
          </li>
          <li>
            <Link
              href="/receptionist/payments"
              className="nav-link text-white d-flex align-items-center gap-2"
              style={{ borderRadius: "6px" }}
            >
              💳 Payments
            </Link>
          </li>
          <li>
            <Link
              href="/receptionist/guests"
              className="nav-link text-white d-flex align-items-center gap-2"
              style={{ borderRadius: "6px" }}
            >
              👤 Guests
            </Link>
          </li>
        </ul>
        <div className="mt-auto pt-3 border-top" style={{ borderColor: "rgba(255, 255, 255, 0.2)" }}>
          <div className="text-white-50" style={{ fontSize: "0.8rem" }}>Logged in as</div>
          <div className="text-white fw-semibold" style={{ fontSize: "0.9rem" }}>{session.fullName}</div>
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

      {/* MAIN CONTENT PORTION */}
      <div className="flex-grow-1 p-4" style={{ backgroundColor: "#f0f4f8", minHeight: "100vh" }}>
        {children}
      </div>
    </div>
  );
}
