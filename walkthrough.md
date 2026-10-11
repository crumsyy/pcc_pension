# Walkthrough — Archived Tab Stale-Data Flash (no commit/push yet)

## Fix (`app/admin/discounts/page.js` only)
- Root cause: tab switches kept the previous tab's rows in state until the new fetch resolved, so active items flashed in the archived tables.
- `handleTabChange` now clears both lists and raises `listLoading` (also no-ops on re-clicking the active tab); `fetchData` always lowers it. Empty tables render a "Loading records…" row mid-switch instead of stale rows or a false empty state. Silent background polls can't stick the flag (only the completing fetch clears it).

## Verification (actually performed)
- `npx eslint`: 3 problems before = 3 after (pre-existing). `npm run build`: 97/97.
- Staging check: jump Discounts→Archived—no active rows may flash.

Say `"push"` only when you want commit + push.
