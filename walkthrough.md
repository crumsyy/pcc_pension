# Walkthrough — Purchase Orders Clipped Footer Fix

## Changes (no commit/push yet)
- `app/admin/purchase-orders/page.js` table card only:
  - Table scroller gains `min-height: 0` so it shrinks and scrolls internally instead of pushing content past the card edge.
  - Pagination footer wrapped in `flex-shrink-0` so it always keeps its space at the card bottom.
- No logic, pagination, API, or other-table changes.

## Verification
- `npx eslint`: only pre-existing findings on untouched effects; nothing new from this change.
- `npm run build` success, 96/96 pages.

## Manual check (please review)
1. Purchase Orders: `Showing 1–10 of 40` + page buttons fully visible; table scrolls internally; all 4 pages work; footer stays visible at short viewport heights.

Awaiting review. Say `"push"` only when you want commit + push.
