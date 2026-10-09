import { Suspense } from 'react';
import WorkspaceClient from './WorkspaceClient';

export default function BillingCheckoutPage() {
  return (
    <Suspense fallback={<div className="p-4 text-muted small">Loading Billing &amp; Checkout…</div>}>
      <WorkspaceClient />
    </Suspense>
  );
}
