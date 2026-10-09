# Implementation Plan — Users Tabs Polish, Guest Creation, Dashboard Cleaning Removal

## 1. Goals
(a) Guests tab drops the redundant Roles filter (search widens). (b) Per-tab create: Staff tab `+ Create Staff`, Guests tab `+ Create Guest` (new API branch writing `user` + `guest` rows). (c) User Management footer → shared shadcn `AdminPagination`. (d) Admin dashboard drops "Cleaning" displays. No DB changes.

## 2. Current State (verified in discussion)
- `UsersClient.js`: tabs, role filter with per-tab options, hand-rolled pager, staff-only create guards, Guest edit-role lock.
- API `app/api/admin/users/route.js` `create` inserts `user` + `staff` only.
- Dashboard (`DashboardClient.js`): 6 stat cards incl. Cleaning; board legend incl. Cleaning swatch; donut counts Cleaning internally.

## 3. Scope
- IN: role-filter conditional + grid tweak; tab-aware create button/modal; API guest-create branch (same validations); AdminPagination swap; remove Cleaning stat card + legend swatch.
- OUT: schema, Cleaning-status data logic (donut math unchanged), other pages.

## 4. Design
- Guests tab hides role filter, search becomes `col-md-7`; Staff tab unchanged.
- Create modal shared, role locked per tab (title/buttons swap); API validates Guest roleID like staff, then `user` + `guest` insert in transaction; edit/suspend untouched (userID-based).
- AdminPagination with same page state/props; empty-state row kept.
- Dashboard: 5 stat cards; legend without Cleaning; grey fallback tile retained.

## 5. Steps
1. Filters + create UI + API branch. 2. Pagination swap. 3. Dashboard removals. 4. Lint + build + manual. 5. Walkthrough; no commit/push until `"push"`.

## 6. Acceptance
- Guests tab has no role filter; per-tab create works with correct tables; pager identical behavior; no Cleaning card/legend; build passes.

## 7. Risks
- First admin-side guest creation path — verify transaction + login-ability of created guest.
