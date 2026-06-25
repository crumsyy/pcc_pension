import { Suspense } from 'react';
import RoomsClient from './RoomsClient';

export const unstable_instant = {
  prefetch: 'static',
  unstable_disableValidation: true,
};

export default function AdminRoomsPage() {
  return (
    <Suspense
      fallback={
        <div className="d-flex align-items-center justify-content-center py-5" style={{ minHeight: '50vh' }}>
          <div className="text-center">
            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Loading Room Inventory...</span>
            </div>
            <p className="text-muted mt-3 fw-semibold">Loading rooms module...</p>
          </div>
        </div>
      }
    >
      <RoomsClient />
    </Suspense>
  );
}
