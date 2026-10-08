# Implementation Plan — User Management: Masked IDs, Staff-Only, Role Colors, Pagination

## 1. Goal
User Management (`app/admin/users/UsersClient.js`) shows public display codes instead of raw DB IDs, lists/creates only Administrator + Receptionist (no guests), colors role badges (admin blue, receptionist green), and paginates 10/page. No API/DB changes (display-level only).

## 2. Current State (verified)
- Table `UsersClient.js:465-487`: header `User ID`, cell `#USER-{u.userID}`, `key={u.userID}`; view modal (`:656-716`) shows no ID; edit/toggle/suspend payloads use real `userID`/`staffID`/`guestID` (`:247-249,283,329`).
- API `GET /api/admin/users/route.js:19-39` UNIONs staff (Admin/Receptionist) + guests; `roles` returns all incl. Guest; `create` accepts any `roleID`.
- Role badges grey for all (`:496`, view `:688`); status badges already colored (`:499-506`).
- Role filter (`:427-438`) + create role select (`:590-595`) list all roles; edit modal locks Guest rows (`:767-775`).
- No pagination: all `users` rendered in scroll box (`:483-529`); cache key `admin-users:{search}_{role}_{status}`.

## 3. Scope
- IN: `UsersClient.js` only (helper + table + view modal + filters + create/edit guards + pagination UI).
- OUT: API route, DB, other admin pages, `ActionButtons`, stylesheets (use existing Bootstrap badge classes).

## 4. Design
- Public code helper (stable, non-sequential, front-end only):
  `toPublicUserCode(userID)` → e.g. `((userID * 2654435761) >>> 0).toString(36).toUpperCase().padStart(6,'0')` → `USR-XXXXXX`. Same ID always maps same code; not reversible to sequence at a glance.
  Real `userID` kept for `key`, `isSelf`, and all API bodies; only display text changes. Empty-state `colSpan` unchanged.
- Staff-only display: `const staffUsers = users.filter(u => u.role !== 'Guest')`; table/pagination/empty-state use `staffUsers`. Role filter options + create role options filtered to `role !== 'Guest'`; create/edit submit guards reject Guest role with error toast. Suspend-reason guest wording left as-is (functional text, not user listing).
- Badges: `roleBadgeClass(role)` → Administrator `text-bg-primary`, Receptionist `text-bg-success`, fallback `text-bg-secondary`; applied table `:496` + view modal `:688`.
- Pagination: `PAGE_SIZE = 10`, `page` state reset to 1 whenever `search/roleFilter/statusFilter/staffUsers.length` change; `totalPages = max(1, ceil(staffUsers.length/10))`, clamp page; slice for rows; footer `Showing X–Y of Z users` + Prev/numbered/Next (numbers compact, e.g. windowed when many pages). Header `User ID` → `User Code`.

## 5. Steps
1. Add helper + badge fn + pagination state in `UsersClient.js`.
2. Filter guests from table/filter/create; add guards.
3. Swap ID cell + view modal row; recolor badges.
4. Add pagination footer; reset/clamp logic.
5. `npx eslint` edited file (fix only new issues) + `npm run build`; manual: codes non-sequential/stable, no guests anywhere, badge colors, 10/page incl. filter-reset and last-page clamp.
6. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- No raw `#USER-<id>` visible in User Management; codes stable across refresh.
- No Guest rows/options; only Admin/Receptionist creatable (front-end).
- Admin badges blue, receptionist green (table + view modal).
- 10/page with correct counts/controls; build passes.

## 7. Risks
- Masking is display-only; raw IDs remain in network JSON (accepted per user).
- Hash collisions negligible for user-table scale; codes unique in practice.
