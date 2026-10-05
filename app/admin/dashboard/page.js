import { Suspense } from 'react';
import DashboardClient from './DashboardClient';
import { requireSessionRole } from "@/lib/session";
import { AdminDashboardSkeleton } from '@/app/components/skeletons/AdminSkeletons';

export const unstable_instant = {
  prefetch: 'static',
  unstable_disableValidation: true,
};

export default async function AdminDashboardPage() {
  const auth = await requireSessionRole("Administrator");
  const userName = auth.session?.fullName || "Admin";

  return (
    <Suspense fallback={<AdminDashboardSkeleton userName={userName} />}>
      <DashboardClient userName={userName} />
    </Suspense>
  );
}
