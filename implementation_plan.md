# Implementation Plan — PO Locked Layout: 8/Page Table + 4/Page Restock

## 1. Goal
Purchase Orders page goes back to a locked viewport layout (only tables scroll internally, no whole-page scroll) with everything fitting: PO table 8 rows/page, Recommended Restock 4 items/page with its own pagination. No API/DB changes.

## 2. Current State (verified)
- Page is natural flow after last change (`pcc-page-natural`, plain `table-responsive`, `table-sm` added). Pagination is 10/page via `paginate(orders, page, ADMIN_PAGE_SIZE)` (`page.js:817`); restock panel renders all `recommendedItems` with its own internal scroller (`:1001`).
- Previous locked layout clipped because the scroller lacked `min-height: 0` and the footer wasn't pinned — both fixed already and kept.

## 3. Scope
- IN: `purchase-orders/page.js` + tiny `globals.css` tweak if needed.
- OUT: other pages, page-size standard elsewhere (stays 10), APIs.

## 4. Design
- Restore locked flex layout (container fixed height + `overflow-hidden` columns/card as before), keep `min-height: 0` scroller + pinned footer + `table-sm` density.
- PO table: `paginate(orders, page, 8)` with `PO_PAGE_SIZE = 8` constant; footer reads `Showing 1–8 of 40`.
- Restock: `restockPage` state + `paginate(recommendedItems, restockPage, 4)` + compact `AdminPagination` footer (label "items"); clamping handles list shrinkage, no extra effects.
- Fit math (864px viewport): rows 8×~44 + thead + footer ≈ 450; filter + title ≈ 200; total ≈ 650 + padding < ~780 available. Restock 4×~90 + header + footer ≈ 480. Both fit without page scroll.

## 5. Steps
1. Revert container/columns/card to locked flex classes; keep scroller fix, pinned footer, `table-sm`.
2. PO page size 8; restock pagination 4/page with footer.
3. `npx eslint` file + `npm run build`.
4. Manual: no whole-page scroll; table and restock scroll internally only if overflow; footers fully visible; page through POs (5 pages) and restock pages.
5. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- No whole-page scroll; no clipped UI; 8 PO rows and 4 restock items per page with working pagers; build passes.

## 7. Risks
- Very short viewports (<700px) may still internal-scroll tables — acceptable fallback, footers stay pinned.
