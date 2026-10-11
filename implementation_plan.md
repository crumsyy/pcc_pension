# Implementation Plan — User Status Badge Colors

## 1. Change (`app/admin/users/UsersClient.js`, table badge only)
- `Active` → green (unchanged), `Suspended` → orange (`text-bg-warning`), `Inactive` → red (`text-bg-danger`), anything else → grey. Filter options, toggle logic, and modals untouched (no colors there).

## 2. Verify
- `npx eslint` (stash-compared) + `npm run build`; staging visual check.
- Commit/push only on `"push"`.
