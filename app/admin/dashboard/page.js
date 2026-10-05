import { Suspense } from 'react';
import DashboardClient from './DashboardClient';
import { AdminDashboardSkeleton } from '@/app/components/skeletons/AdminSkeletons';

export const unstable_instant = {
  prefetch: 'static',
  unstable_disableValidation: true,
};

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <DashboardClient />
    </Suspense>
  );
}
