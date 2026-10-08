# Implementation Plan — Purchase Orders Clipped Footer Fix

## 1. Goal
Stop the `Showing 1–10 of 40` + pagination footer from being cut off at the bottom of the Purchase Orders table card. No API/DB/logic changes.

## 2. Root Cause (verified `purchase-orders/page.js:912-976`)
The table card is `d-flex flex-column overflow-hidden` with a fixed page height (`842: height calc(100vh - 90px), overflow hidden`). The `table-responsive` scroller is `flex-grow-1` but has no `min-height: 0`, so as a flex item it refuses to shrink below the 10-row table's content height — it pushes the `AdminPagination` footer past the card's bottom edge, where `overflow-hidden` clips it (matches screenshot).

## 3. Scope
- IN: `purchase-orders/page.js` table card only (2 small JSX/style edits).
- OUT: pagination logic, other tables, APIs.

## 4. Design
- Scroller: add `style={{ minHeight: 0 }}` so it shrinks and scrolls internally.
- Footer: wrap `<AdminPagination>` in `<div className="flex-shrink-0">` so it always keeps its space at the card bottom.
- No other layout changes; right-hand Restock column untouched.

## 5. Steps
1. Two edits in `purchase-orders/page.js`.
2. `npx eslint` file + `npm run build`.
3. Manual: 10 rows visible with internal scroll when needed, footer fully visible, page through all 4 pages; shorter viewports still show footer.
4. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- Footer never clipped at any viewport height; table scrolls internally; build passes.

## 7. Risks
- None expected; pure flexbox sizing fix.
