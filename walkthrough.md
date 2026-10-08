# Walkthrough — Purchase Orders No-Cut Layout

## Changes (no commit/push yet)
- `app/globals.css`: new `.pcc-page-container.pcc-page-natural` modifier (auto height, visible overflow) to opt out of the locked viewport layout.
- `app/admin/purchase-orders/page.js`: page uses natural flow — removed fixed `calc(100vh - 90px)` height and all `h-100`/`flex-grow-1`/`overflow-hidden|auto` locks on container, columns, table card, table scroller, and restock panel; table given `table-sm` density. Page scrolls via `main`; footer sits in normal flow.
- Pagination stays 10/page; no logic/API changes; other pages untouched.

## Verification
- `npx eslint`: only pre-existing findings on untouched effects.
- `npm run build` success, 96/96 pages.

## Manual check (please review)
1. All 10 PO rows + `Showing 1–10 of 40` footer fully visible/reachable with zero clipping at desktop and short viewports.
2. Restock panel intact; modals and filters unaffected.

Awaiting review. Say `"push"` only when you want commit + push.
