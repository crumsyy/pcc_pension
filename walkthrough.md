# Walkthrough — PO Locked Layout: 8/Page + 4/Page Restock

## Changes (no commit/push yet)
- `app/admin/purchase-orders/page.js`:
  - Restored locked viewport layout (fixed-height container/columns/cards, internal table scroll) with the earlier scroller (`min-height: 0`) and pinned-footer fixes kept, plus `table-sm` density.
  - PO table now 8/page (`PO_PAGE_SIZE = 8`; footer reads `Showing 1–8 of 40`).
  - Recommended Restock now 4/page (`RESTOCK_PAGE_SIZE = 4`) with its own `AdminPagination` footer (clamped, no extra effects).
- No API/logic changes; other pages untouched (their 10/page standard stays).

## Verification
- `npx eslint`: only pre-existing findings on untouched effects.
- `npm run build` success, 96/96 pages.

## Manual check (please review)
1. No whole-page scroll; table and restock scroll internally only if needed; both footers fully visible with zero clipping.
2. PO pager walks 5 pages of 8; restock pager walks 4-per-page; filters reset PO to page 1.

Awaiting review. Say `"push"` only when you want commit + push.
