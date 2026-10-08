# Walkthrough — PO Matches Rooms Panel Pattern

## Changes (no commit/push yet)
- `purchase-orders/page.js` layout only: removed the locked flex stretch (fixed heights, `flex-grow-1`/`h-100`/`overflow-hidden` on container, row, columns, cards); cards are now natural height like Room Management, with `table-responsive`/`restock` capped at `maxHeight calc(100vh - 340px)` + internal scroll as short-screen fallback. Footers sit in normal flow with whitespace below.
- Kept: 8/page + 4/page restock pagers, `table-sm`, `.po-compact`, shell flexbox. No logic/API changes.

## Verification
- `npx eslint`: only pre-existing findings on untouched effects.
- `npm run build` success, 96/96 pages.

## Manual check (localhost http://localhost:3000, hard-refresh)
1. PO table + restock panels show top and bottom borders with whitespace below, like Room Management.
2. No internal scroll at normal heights; short screens fall back to in-table scroll with footers visible.

Awaiting review. Say `"push"` only when you want commit + push.
