import { redirect } from 'next/navigation';

// Legacy route: Payments now lives in the Billing & Checkout workspace.
export default async function PaymentsRedirect({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = new URLSearchParams();
  q.set('tab', 'payments');
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
    else q.set(k, String(v));
  }
  redirect(`/receptionist/billing-checkout?${q.toString()}`);
}
