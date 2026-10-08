import { Suspense } from 'react';
import RoomsClient from './RoomsClient';

export const unstable_instant = {
  prefetch: 'static',
  unstable_disableValidation: true,
};

export default function AdminRoomsPage() {
  return (
    <Suspense fallback={null}>
      <RoomsClient />
    </Suspense>
  );
}
