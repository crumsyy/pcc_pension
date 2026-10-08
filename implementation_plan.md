# Implementation Plan — Admin Labels, Tab-Aware Buttons, Pagination, Collapsible Sidebar

## 1. Goals (5 items, no API/DB changes)
1. Sidebar nav label `Inventory` → `Inventory Management` (`SidebarClient.js:52`).
2. Products header button follows tab: Cooked Meals → `+ Create Meal`, otherwise `+ Create Product` (`products/page.js:367-369`); Archived tab → hide create button (create modal defaults don't apply to archived view).
3. Discounts & Promos: one header button that follows tab — `active_discounts` → `+ Create Discount` (`openCreateDiscModal`), `active_promos` → `+ Create Promotion` (`openCreatePromoModal`), `archived` → hidden (`discounts/page.js:500-507`).
4. Pagination (10/page, Users-style) for Rooms, Amenities, Products, Inventory, Purchase Orders, Discounts & Promos tables.
5. Collapsible admin sidebar: toggle collapses to icons-only minimized rail; expands back; preference persisted.

## 2. Current State (verified)
- Sidebar links in `SidebarClient.js:46-55`; desktop sidebar fixed 240px (`:181-192`), labels always rendered (`:77-101`); mobile uses offcanvas (`:134-178`).
- Products tabs `products|meals|archived` (`products/page.js:14`); create modal already adapts to meals (`:570`). Discounts tabs `active_discounts|active_promos|archived` (`discounts/page.js:14`); archived renders both sections (`:560-615`).
- Pagination exists only in Users (`UsersClient.js:27,47,461-652`, 10/page with reset-on-filter + windowed numbers) and Reports (own pattern). Rooms (`RoomsClient`), Amenities, Products, Inventory (tabs: dashboard|stocks|batches|borrow|logs with lists `items/batches/borrowLogs/movements`), Purchase Orders, Discounts (`discounts/promotions` arrays) render full lists with scroll boxes.

## 3. Scope
- IN: `SidebarClient.js` (label + collapse), `products/page.js`, `discounts/page.js`, new shared `app/components/AdminPagination.js`, pagination wiring in RoomsClient + 5 pages.
- OUT: APIs, DB, reports pagination, receptionist sidebar behavior (collapse toggle rendered for Administrator role only).

## 4. Design
- Items 1-3: one-line conditional renders; archived tabs hide create buttons (no valid create target there).
- Item 4: new `AdminPagination` extracting the Users pattern (props: `page, totalPages, onPage, start, end, total, label`); per page add `page` state reset on any filter/tab/search change (handler wrappers like Users, no set-state-in-effect), slice rendered rows, `Showing X–Y of Z` footer. Page size 10 everywhere.
  - Inventory: paginate each tab's primary table (stocks→items, batches→batches, borrow→borrowLogs, logs→movements (+disposals if separate table); dashboard tab summary untouched except low-stock table if present → paginate it too).
  - Discounts: paginate discounts and promos lists independently (separate page states; archived shows both sections paginated).
  - Products/Rooms/Amenities/POs: paginate the (already filtered) row arrays.
- Item 5: `collapsed` state in `SidebarClient` (init from `localStorage 'pcc-sidebar-collapsed'`, admin-only toggle button with chevron icons + `aria-expanded`, tooltips via `title` when collapsed); desktop `nav` width 240→76px with transition, labels/section captions/user text hidden when collapsed (conditional render), icons centered; main wrapper flexes automatically; mobile offcanvas untouched; collapsed preference persists across visits.

## 5. Steps
1. Label rename + tab-aware buttons (products, discounts).
2. Create `AdminPagination.js`; wire into Rooms/Amenities/Products/Inventory/POs/Discounts with reset-on-change.
3. Sidebar collapse (admin-only toggle + persistence + responsive CSS).
4. `npx eslint` changed files (fix only new issues) + `npm run build`; manual per item incl. archived-tab button hiding, per-tab page resets, collapse persist + tooltips.
5. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- Nav reads `Inventory Management`; meals tab shows `+ Create Meal`; discounts/promos show exactly one correct button (none in archived).
- All six managements paginate 10/page with counts/controls; filters/tabs reset to page 1.
- Sidebar collapses to icons-only rail and restores; choice persists; mobile drawer unchanged; build passes.

## 7. Risks
- Inventory has 5 tabs × lists — most code touch; mitigated by shared component + per-tab page states.
- Long tables previously scrolled internally (`maxHeight` boxes) — pagination replaces full-list render; keep scroll boxes for the 10 rows.
