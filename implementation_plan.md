# Implementation Plan — Remove skeleton loading UI (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User request
- Remove skeleton loading UI ([Image 1] receptionist dashboard shimmer); “just make pages load fast” — render content directly, no shimmer placeholders.

## 2. Evidence / full inventory
- Route loading files: `app/receptionist/dashboard/loading.js` (→ `ReceptionistDashboardSkeleton`), `app/guest/dashboard/loading.js` (→ `GuestDashboardSkeleton`).
- Skeleton lib (4 files): `app/components/skeletons/Skeleton.js` (base + Table/Chart/Card/Input/Button/Avatar/Text), `ReceptionistSkeletons.js` (only used by receptionist dashboard loading.js), `GuestSkeletons.js` (used by accounts/bookings, guest/edit-profile, guest dashboard loading.js), `AdminSkeletons.js` (zero consumers — dead code).
- Inline usages: reservations `page.js:1050` (`loading ? SkeletonTable`) + `2015-2019` (Suspense fallback SkeletonTable); `accounts/bookings/page.js:177` (`loading ? GuestBookingsHistorySkeleton`); `guest/edit-profile/page.js:391` (`loading ? GuestEditProfileSkeleton`); `GuestDashboardClient.js:2393-2406` (`loadingRooms ?` shimmer cards); `GuestOrdersContent.js:1315-1329` (`loading ?` shimmer cards).
- Raw CSS classes: `.skeleton-box` (guest dashboard), `.pcc-skeleton-box` (orders catalog) — both shimmer-only.
- Already clean: bookings page renders tables directly (no loading branch); other Suspense fallbacks are `null` except billing-checkout text + auth text.
- No artificial delays found (no `setTimeout` gating data; cache-first `clientCache` already paints fast). The only live spinner (`spinner-grow` status dot, dashboard:145) is a status indicator, not a skeleton — untouched.

## 3. Proposed changes
1. Delete `app/receptionist/dashboard/loading.js`, `app/guest/dashboard/loading.js` (Next then paints page content directly, no skeleton flash).
2. Delete `app/components/skeletons/` (all 4 files).
3. Consumer edits (render content directly; existing empty-states cover no-data):
   - reservations: `loading ? SkeletonTable :` → render table block directly; Suspense fallback → `null`; remove `SkeletonTable` import.
   - accounts/bookings: `loading ? GuestBookingsHistorySkeleton :` → render card directly; remove import.
   - guest/edit-profile: `loading ? GuestEditProfileSkeleton :` → render form directly; remove import.
   - GuestDashboardClient rooms: drop `loadingRooms ?` shimmer branch (keep rooms grid + empty state; list persists across refreshes).
   - GuestOrdersContent catalog: drop `loading ?` shimmer branch (render catalog directly).
   - billing-checkout page Suspense text fallback → `null` (same “no flash” treatment; auth `Loading...` text left untouched as out of scope).
4. `globals.css`: remove skeleton tokens (`--skeleton-bg/shimmer` x2 themes), `@keyframes pcc-skeleton-shimmer` + `.pcc-skeleton`, `.skeleton-box` + `@keyframes skeleton-shimmer`, `.pcc-skeleton-box` (+dark variant).

## 4. Verification
- `grep -r Skeleton app` → zero matches (outside history); `ls app/components/skeletons` → gone; both `loading.js` deleted.
- `eslint` touched files (pre-existing families only); `npm run build` success.
- Cold-load each touched page: content paints directly with no shimmer frames.

## 5. Risks / notes
- First-paint on empty cache shows real empty-states for ~1 fetch round-trip instead of shimmer — intended per request (“just load fast”; cache-first keeps repeat visits instant).
- No API/fetch logic changes; spinners (payment processing, status dots) untouched.

## 6. Questions for user
- Q1: Remove everywhere incl. guest portal + dead admin lib (recommended), or receptionist only?
