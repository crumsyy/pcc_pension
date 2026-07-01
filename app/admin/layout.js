import { redirect } from "next/navigation";
import { requireSessionRole } from "@/lib/session";
import SidebarClient from "../components/SidebarClient";

export const unstable_instant = false;

export default async function AdminLayout({ children }) {
  const auth = await requireSessionRole("Administrator");
  if (auth.redirect) {
    redirect(auth.redirect);
  }

  const { session } = auth;

  return (
    <div className="d-flex flex-column flex-lg-row" style={{ minHeight: "100vh" }}>
      <SidebarClient session={session} role="Administrator" />

      {/* MAIN CONTENT (Responsive margins and padding) */}
      <div className="flex-grow-1 d-flex flex-column pcc-main-wrapper" style={{ backgroundColor: "#f6faf7", minHeight: "100vh" }}>
        <main className="flex-grow-1 p-3 p-lg-4">
          {children}
        </main>
      </div>
    </div>
  );
}
