# Walkthrough — Remove Admin Skeleton Loading

## Changes (no commit/push yet)
- Removed all skeleton imports/rendering from `app/admin/*` (grep for `Skeleton` in `app/admin` now returns zero matches).
- Wrappers: `dashboard/page.js`, `users/page.js`, `rooms/page.js` — `Suspense fallback` changed from `Admin*Skeleton` to `null`.
- Clients/pages now render instantly:
  - `DashboardClient.js` — removed `AdminDashboardSkeleton` import + `loading` state; fetch is background-style; error only shows when no cached data.
  - `UsersClient.js`, `RoomsClient.js` — removed `SkeletonTable` import + `loading` gating; tables always render with existing empty states (`No users/rooms found`).
  - `bookings`, `reservations` — removed `SkeletonTable` gate; `loading` kept at `false` only for refresh-button spin.
  - `amenities`, `products`, `purchase-orders` — removed `SkeletonTable` import + `loading` state; `uploadingImage` flows untouched.
  - `discounts` — removed `Skeleton/SkeletonTable` gate; always renders content.
  - `reports` — removed `Skeleton/SkeletonTable/SkeletonChart` gate; cards/chart/table render with `No report data` empty state.
  - `inventory` — removed `AdminInventorySkeleton` early return.
- Skeleton source files kept (`app/components/skeletons/*`) but no longer used by admin. Receptionist/guest skeletons untouched.
- Cache-first + background revalidate preserved; no API/DB changes.

## Verification
- `grep Skeleton app/admin` — clean.
- `npm run build` — success, 96/96 pages.
- ESLint on edited files — no new unused-var errors (remaining warnings pre-existing).

## Manual check (please review)
1. Hard-refresh each admin page (dashboard, users, rooms, bookings, reservations, amenities, products, purchase-orders, discounts, reports, inventory) → real headers/filters/tables paint immediately, no skeleton flash.
2. Throttle network → shell content shows instantly, data fills in; refresh spin only where present.
3. API failure → empty state + existing toast, no hang.

Awaiting review. Say `"push"` only when you want commit + push.
