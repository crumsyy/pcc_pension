import { Suspense } from 'react';
import DashboardClient from './DashboardClient';

export const unstable_instant = {
  prefetch: 'static',
  unstable_disableValidation: true,
};

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="d-flex align-items-center justify-content-center py-5" style={{ minHeight: '50vh' }}>
          <div className="text-center">
            <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Loading Dashboard...</span>
            </div>
            <p className="text-muted mt-3 fw-semibold">Loading stats...</p>
          </div>
        </div>
      }
    >
      <DashboardClient />
    </Suspense>
  );
}
