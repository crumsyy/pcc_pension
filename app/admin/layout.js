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
    <SidebarClient session={session} role="Administrator">
      {children}
    </SidebarClient>
  );
}
