# Implementation Plan — Purchase Orders: No-Cut Natural Flow Layout

## 1. Goal
Purchase Orders page shows all 10 rows + footer with nothing clipped at any viewport. No API/DB/pagination-logic changes.

## 2. Root Cause (verified)
- `purchase-orders/page.js:842` locks the page to viewport height with `overflow: hidden`; columns/card/table scroller are `flex-grow-1 / h-100 / overflow-hidden|auto`, so rows beyond the space are trapped in an internal scroll region (screenshot: only ~7 of 10 rows visible).
- Global `globals.css:1095-1100` also forces `.pcc-page-container { height: ... !important; overflow: hidden !important }`, so inline styles alone cannot unlock it.

## 3. Scope
- IN: PO page layout classes/styles + one `globals.css` unlock modifier + compact table density.
- OUT: pagination counts (stay 10/page), other pages, APIs.

## 4. Design
- Add `globals.css` modifier: `.pcc-page-container.pcc-page-natural { height: auto !important; overflow: visible !important; }`.
- PO page: add `pcc-page-natural`, drop inline fixed height/overflow; columns and table card drop `h-100/flex-grow-1/overflow-hidden` constraints; table scroller becomes plain `table-responsive` (no internal scroll); right Restock column flows naturally too. Page scrolls via `main` (`overflow-y: auto` already), so nothing is ever clipped.
- Density: add Bootstrap `table-sm` to the PO table so more rows fit per screen.
- Keep `AdminPagination` footer in normal flow (always fully visible).

## 5. Steps
1. CSS modifier + PO layout edits + `table-sm`.
2. `npx eslint` file + `npm run build`.
3. Manual: all 10 rows + footer visible/reachable at desktop and short viewports with zero clipping; restock column intact; other pages unchanged.
4. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- No clipped/cut UI anywhere on PO page; footer always fully visible; build passes.

## 7. Risks
- Page now scrolls in `main` instead of internal boxes — intended; consistent with other admin pages (users/rooms).
