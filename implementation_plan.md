# Implementation Plan — Archived Tab Stale-Data Flash

## 1. Root cause (verified in code)
`app/admin/discounts/page.js`: `discounts`/`promotions` state persists across tab switches. On switching to Archived, the effect fires `fetchData` for `archived=true`, but until it resolves the tables render the previous tab's ACTIVE rows — every discount/promo appears, then "disappears" (replaced by the archived set). Same-tab search typing is fine (results stay relevant); only tab switches cross disjoint datasets.

## 2. Fix (page-local, no API change)
1. `handleTabChange`: immediately `setDiscounts([])` + `setPromotions([])` and raise a `listLoading` flag.
2. `fetchData` `finally`: lower `listLoading`.
3. Both tables: when `listLoading` and rows are empty, render a "Loading archived records…" row instead of the "No … found" empty state (prevents a misleading flash).
- Untouched: fetch logic, cache keys, pagination, filters, modals, API.

## 3. Verify
- `npx eslint` (stash-compared) + `npm run build`; staging check: switch Discounts→Archived—no active rows may appear.
- Commit/push only on `"push"`.

## 4. Questions
1. Clear-then-loading-row as above (Recommended) vs skeleton shimmer?
2. Proceed?
