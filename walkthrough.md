# Walkthrough — Overview Cards Off, 4-State Bookings, Pagination (no commit/push yet)

## Changes
**Reservations overview (`app/admin/reservations/page.js`)**
- Deleted the KPI cards row; filter dropdown unchanged (Reserved/Booked/Cancelled).
- Table paginated 10/page client-side over server-filtered rows (`AdminPagination`, `start + i` numbering); icons stripped from View Bookings + Refresh (labels stay).

**Bookings overview (`app/admin/bookings/page.js`)**
- Deleted the KPI cards row; filter is now Booked / Occupied / Completed / Cancelled (booked cancellable via the Cancelled view).
- Display mapping, stored values untouched: Pending-family→Booked, in-house (Active Stay/Bill Finalized/Paid)→Occupied, Completed→Completed, Cancelled/No-Show→Cancelled; badges in matching colors. Filtering moved client-side (server keeps canonical values); cache key namespaced `v2` so old pre-filtered entries can't linger.
- Table paginated 10/page; icons stripped from View Reservations + Refresh.

## Verification (actually performed)
- `npx eslint`: 4 problems before = 4 after (pre-existing effect-rule findings). `npm run build`: 97/97.

Say `"push"` only when you want commit + push.
