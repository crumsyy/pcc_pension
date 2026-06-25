import { Suspense } from 'react';
import UsersClient from './UsersClient';

export const unstable_instant = {
  prefetch: 'static',
  unstable_disableValidation: true,
};

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="d-flex align-items-center justify-content-center py-5" style={{ minHeight: '50vh' }}>
          <div className="text-center">
            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Loading User Directory...</span>
            </div>
            <p className="text-muted mt-3 fw-semibold">Loading users module...</p>
          </div>
        </div>
      }
    >
      <UsersClient />
    </Suspense>
  );
}
