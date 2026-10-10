# Implementation Plan — Dashboard Equal Bottoms + List Pagination + Icon Removal

## 1. Changes (`app/admin/dashboard/DashboardClient.js` only)
1. **Equal bottoms**: left card (`Active Reservations and Bookings`) gains `h-100` (right card already has it; Bootstrap row stretches columns) so both cards bottom-align.
2. **Detailed Status List pagination (6/page)**: new `statusPage` state; `rooms.slice` 6 per page; `AdminPagination` (already the repo pattern) pinned under the table; clamp page when room count shrinks. Table keeps its scroll cap as fallback.
3. **Left-panel pagination (5/page)**: `activeResPage` + `activeBookPage` states slicing `activeResList` / `activeBookingsList` at 5 with an `AdminPagination` under each section (counts in headers stay totals).
4. **Icon removal** across the whole left panel: header `h6` icons (`bi-bookmark-fill`, `bi-house-door-fill`), empty-state icons (`bi-bookmark-check`, `bi-calendar-check`), and the Reservations/Bookings link-button icons — text labels stay.
- Untouched: data fetching, filters, badges, board grid, KPIs, theme. Import `AdminPagination` from `../../components/AdminPagination`.

## 2. Verify
- `npx eslint` (stash-compared) + `npm run build`; staging visual check (bottom alignment, pagination behavior).
- Commit/push only on `"push"`.

## 3. Questions
1. Separate 5/page paginations per section (Recommended) vs one shared pager for the panel?
2. Proceed?
