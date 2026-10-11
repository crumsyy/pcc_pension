# Implementation Plan — Overview Cards Off, Bookings 4-State, Pagination, No Icons

## 1. Changes
**`app/admin/reservations/page.js`**
- Delete the KPI cards row (lines ~106-134); keep filter dropdown (Reserved/Booked/Cancelled already merged) + table.
- Table paginated at 10/page client-side (server search/status/date filters stay): `resPage` state, sliced rows, `AdminPagination` under the table, `start + i` numbering.
- Strip icons from View Bookings + Refresh buttons (labels stay).

**`app/admin/bookings/page.js`**
- Delete the KPI cards row; status filter becomes `Booked / Occupied / Completed / Cancelled`.
- Display mapping (overview only, stored values untouched): `Cancelled/Canceled`→Cancelled; `No Show`→Cancelled (dead arrival, room freed); normalized `Completed`→Completed; `Active Stay/Bill Finalized/Paid` (+in-house legacy)→Occupied; everything else Pending-family→Booked. Badges: Booked info-cyan, Occupied blue, Completed dark, Cancelled red.
- Filtering moves client-side by mapped state (API keeps canonical normalized values; `status` no longer sent as server filter). Table paginated 10/page with `AdminPagination`; numbering `start + i`.
- Strip icons from View Reservations + Refresh buttons. Clean now-unused status imports.

## 2. Verify
- `npx eslint` (stash-compared) + `npm run build` + guard harness; staging visual check.
- Commit/push only on `"push"`.

## 3. Questions
1. No-Show bookings shown as Cancelled (Recommended) vs hidden from the overview?
2. 10 rows per page for both tables (Recommended) vs another size?
3. Proceed?
