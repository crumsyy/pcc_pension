import { Suspense } from 'react';
import RoomsClient from './RoomsClient';
import { AdminRoomsSkeleton } from '@/app/components/skeletons/AdminSkeletons';

export const unstable_instant = {
  prefetch: 'static',
  unstable_disableValidation: true,
};

export default function AdminRoomsPage() {
  return (
    <Suspense fallback={<AdminRoomsSkeleton />}>
      <RoomsClient />
    </Suspense>
  );
}
