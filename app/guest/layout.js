import { redirect } from "next/navigation";
import { requireSessionRole } from "@/lib/session";

export const unstable_instant = false;

export default async function GuestLayout({ children }) {
  const auth = await requireSessionRole("Guest");
  if (auth.redirect) {
    redirect(auth.redirect);
  }

  return children;
}

