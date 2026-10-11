# Walkthrough — Modern shadcn tabs for billing stay filters

## Changes (`app/receptionist/billing-checkout/BillingTab.js` only)
- Replaced the Bootstrap `btn-group` stay filter (`All Stays (0)` / `Upcoming / Booked (0)` / `Active Stays (0)` / `Completed Stays (0)`) with shadcn `Tabs/TabList/Tab` (`All Stays`, `Upcoming / Booked`, `Active Stays`, `Completed Stays`), no icons, no counts — consistent with Reservations/Bookings tabs.
- `selectedKey={statusFilter}` + `onSelectionChange={setStatusFilter}` use the same filter keys (`all`/`upcoming`/`active`/`completed`), so table filtering behavior is unchanged.
- Removed now-unused `allCount/upcomingCount/activeCount/completedCount` declarations.

## Verification
- `eslint`: only the 4 pre-existing issues (refs/purity/set-state-in-effect/exhaustive-deps in untouched code); no new warnings.
- Visual to confirm: pill-style shadcn strip at the right of the search card; each tab filters the stays table as before.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
