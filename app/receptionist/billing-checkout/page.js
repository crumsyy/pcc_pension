import { Suspense } from 'react';
import WorkspaceClient from './WorkspaceClient';

export default function BillingCheckoutPage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceClient />
    </Suspense>
  );
}
