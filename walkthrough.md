# Walkthrough — Remove skeleton loading UI

## Changes
- Deleted: `app/receptionist/dashboard/loading.js`, `app/guest/dashboard/loading.js`, `app/components/skeletons/` (Skeleton, Guest, Receptionist, Admin — Admin was already dead code).
- `reservations/page.js`: table renders directly; Suspense fallback `null`; import removed (`loading` state kept as ready-gate for `?action=new`).
- `accounts/bookings/page.js`: bookings card renders directly; dead `loading` state + setters removed.
- `guest/edit-profile/page.js`: form renders directly; dead `loading` state removed; split into `EditProfileClient` + `<Suspense fallback={null}>` export (see note below).
- `GuestDashboardClient.js`: room-cards shimmer branch removed (grid + empty state render directly).
- `GuestOrdersContent.js`: catalog shimmer branch removed; dead catalog `loading` state + setters removed.
- `billing-checkout/page.js`: text fallback → `null`.
- `globals.css`: removed skeleton tokens, `pcc-skeleton-shimmer`/`pcc-skeleton`, `skeleton-box` + keyframes, `pcc-skeleton-box` (+dark).
- Left untouched: real spinners (payment processing buttons, order-history `spinner-border`, rooms-catalog refresh spinner) and auth `Loading...` text — genuine async affordances, not skeletons.

## Important finding (build break + fix)
- Removing the edit-profile skeleton exposed a latent prerender CSR bailout (“Render in Browser should be wrapped in a suspense boundary”): previously the skeleton branch hid the form during prerender; with direct render, something in the form subtree postpones prerender. Baseline builds 97/97, so this is purely exposed, not introduced, behavior.
- Fix: `<Suspense fallback={null}>` wrapper (same convention as reservations/bookings pages) — zero loading UI, build green again.

## Verification
- `grep -ri skeleton app` (code/CSS): zero matches outside docs; `loading.js` files gone; `skeletons/` dir gone.
- `eslint`: no `no-unused-vars`/parse errors on touched files (only pre-existing `set-state-in-effect` family).
- `npm run build`: 97/97 success.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
