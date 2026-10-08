# Walkthrough — User Management Updates

## Changes (no commit/push yet)
- `app/admin/users/UsersClient.js` only (API/DB untouched):
  - Masked IDs: new `toPublicUserCode(userID)` (stable hash → `USR-XXXXXX`, non-sequential). Table header `User ID` → `User Code`, cell shows code; view modal adds User Code row. Real `userID` kept for `key`, self-check, and all API payloads.
  - Staff-only: `staffUsers`/`staffRoles` exclude `Guest`; table, counts, role filter, create/edit role selects, and create/edit submit guards (reject Guest role) all staff-only.
  - Role badges: `roleBadgeClass` — Administrator `text-bg-primary` (blue), Receptionist `text-bg-success` (green); applied table + view modal.
  - Pagination: 10/page with `page` state, reset on search/filter/clear, clamped `safePage`, `Showing X–Y of Z users` + Prev/numbered (windowed)/Next footer.

## Verification
- `grep #USER- / User ID` in `app/admin/users` — clean.
- `npx eslint` — only pre-existing `set-state-in-effect`/`exhaustive-deps` findings (fetch effect predates change); no new unused-var issues.
- `npm run build` success, 96/96 pages.

## Manual check (please review)
1. User Management shows `USR-XXXXXX` codes (stable across refresh, non-sequential), no raw DB IDs.
2. No Guest rows in table/filter/create/edit; creating with staff roles works, Guest rejected.
3. Admin badges blue, receptionist green (table + view modal).
4. 10 rows/page; filters reset to page 1; last-page clamp + counts correct.

Note: masking is display-only; raw IDs still travel in API JSON. Say `"push"` only when you want commit + push.
