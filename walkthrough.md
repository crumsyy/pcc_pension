# Walkthrough — Dashboard Equal Bottoms + Pagination + Icon Removal (no commit/push yet)

## Changes (`app/admin/dashboard/DashboardClient.js` only)
- **Equal bottoms**: left panel card gains `h-100` (right card already had it) — both bottoms align.
- **Detailed Status List**: 6 rows per page with `AdminPagination` underneath (page state clamps when room count shrinks); scroll cap kept as fallback.
- **Left panel**: Active Reservations and Active Stays & Bookings each paginate at 5 rows with their own `AdminPagination` (headers keep total counts).
- **Icons removed** across the left panel: section header icons, empty-state icons, and the Reservations/Bookings button icons (text labels stay).
- Untouched: data fetching, filters, badges, board grid, KPIs, theme.

## Verification (actually performed)
- `npx eslint`: clean, no findings. `npm run build`: 97/97.

Say `"push"` only when you want commit + push.
