# Implementation Plan — Remove Admin Skeleton Loading (Fast Load)

## 1. Goal
Remove skeleton loading UI in `app/admin/*` so pages render instantly (no blank/skeleton flash). Keep data correct via cache-first + background revalidate. No API/DB changes.

## 2. Current State (verified)
- Skeleton components: `app/components/skeletons/Skeleton.js` (base), `AdminSkeletons.js` (11 variants: Dashboard/Users/Rooms/Amenities/Products/Inventory/PurchaseOrders/Discounts/Reports/Bookings/Reservations).
- Used in 12 admin routes:
  - `dashboard/page.js:12` + `DashboardClient.js:129` (`AdminDashboardSkeleton`)
  - `users/page.js:12` + `UsersClient.js:467` (`SkeletonTable`)
  - `rooms/page.js:12` + `RoomsClient.js:574` (`SkeletonTable`)
  - `bookings/page.js:180`, `reservations/page.js:195`, `amenities/page.js:418`, `products/page.js:469`, `purchase-orders/page.js:892`, `discounts/page.js:563-571`, `reports/page.js:1592-1618`, `inventory/page.js:561-562`
- Pattern: `const [loading, setLoading] = useState(!cached)` then `if (loading) return <Skeleton/>` or `{loading ? <SkeletonTable/> : <table/>}`. First visit (no cache) always shows skeleton until fetch completes.
- `lib/clientCache` already exists and is used for instant cached render on repeat visits.

## 3. Scope
- IN: all `app/admin/*` pages + `DashboardClient`, `UsersClient`, `RoomsClient` loading branches only.
- OUT: skeleton files themselves (kept, unused), receptionist/guest skeletons, APIs, styles, landing page flatpickr work.

## 4. Approach (no skeleton flash, still correct)
- Cache-first instant render: initialize `loading=false` (or `initialLoading=false`), render real layout immediately with cached data if present, else empty-state tables (`No records found` / `0` stats) — never `<Skeleton*>`.
- Background fetch: keep existing `fetch... (isBackground=true)` on mount; update state when done; show tiny non-blocking refresh indicator only (existing spin icon where present, e.g. `bookings/page.js:94`), no full-page replacement.
- Remove `Suspense fallback={<Admin*Skeleton>}` in `dashboard/page.js`, `users/page.js`, `rooms/page.js` → `fallback={null}` (or real children directly since clients are client components).
- Remove `if (loading) return <Admin*Skeleton>` early-returns → return real JSX always; convert `{loading ? <SkeletonTable/> : <table/>}` → always `<table/>` with empty-state row when `data.length===0`.
- Keep `loading` var only for refresh-button spin/disabled if already present; do not gate rendering on it. Delete unused skeleton imports per file.
- Honest speed note: this removes *perceived* loading, not API latency; data still loads async. True faster API would need pagination/lighter queries (out of scope unless you ask).

## 5. Steps
1. `dashboard`: `page.js` fallback null; `DashboardClient.js` remove early skeleton return, render stats/tables with `data ?? []` + empty states.
2. `users`/`rooms`: `page.js` fallback null; `UsersClient.js`/`RoomsClient.js` always render table.
3. `bookings`, `reservations`, `amenities`, `products`, `purchase-orders`, `discounts`, `reports`, `inventory`: set initial loading false / remove skeleton branches, always render content + empty states; remove skeleton imports.
4. `npm run build` + manual: hard-refresh each admin page → instant content, no skeleton flash; throttle network → content shell shows immediately, data fills in; refresh icon spins only.
5. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- No `Admin*Skeleton`/`SkeletonTable` rendered from any `app/admin` route (grep clean for those imports in admin).
- First paint shows real headers/filters/tables instantly; no layout shift from skeleton→content swap.
- Build passes.

## 7. Risks
- Empty-state flash before fetch completes (better than skeleton per request; mitigated by cache-first).
- If API fails, page shows empty state + existing error toast (no hang).
