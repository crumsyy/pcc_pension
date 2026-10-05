import { Suspense } from 'react';
import UsersClient from './UsersClient';
import { AdminUsersSkeleton } from '@/app/components/skeletons/AdminSkeletons';

export const unstable_instant = {
  prefetch: 'static',
  unstable_disableValidation: true,
};

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<AdminUsersSkeleton />}>
      <UsersClient />
    </Suspense>
  );
}
