import { redirect } from 'next/navigation';

// Legacy route: Payments now lives inside each bill (dialog Payments tab).
export default async function PaymentsRedirect({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'tab') continue;
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
    else q.set(k, String(v));
  }
  const qs = q.toString();
  redirect(`/receptionist/billing-checkout${qs ? `?${qs}` : ''}`);
}
