# Walkthrough — Admin Labels, Tab Buttons, Pagination, Collapsible Sidebar

## Changes (no commit/push yet)
- Sidebar label: `Inventory` → `Inventory Management` (`SidebarClient.js`).
- Products header button follows tab: Cooked Meals → `+ Create Meal`, otherwise `+ Create Product`; hidden in Archived.
- Discounts & Promos: single header button — `+ Create Discount` on discounts tab, `+ Create Promo` on promos tab, hidden in archived.
- Pagination: new shared `app/components/AdminPagination.js` (10/page, `paginate` helper, `Showing X–Y of Z` + Prev/numbers/Next, null when empty); wired into Rooms, Amenities, Products (tab-aware label), Inventory (per-tab page states: dashboard movements, stocks, batches, borrow, disposals, logs), Purchase Orders, Discounts (independent discounts/promos pages, both shown when archived). Page resets on filter/tab/search change via handlers; no setState-in-effect.
- Collapsible admin sidebar (`SidebarClient.js`, Administrator only): chevron toggle collapses rail 240px → 76px icons-only (labels/captions/user text hidden, tooltips via `title`), preference persisted in `localStorage`; mobile drawer unchanged. Also moved all hooks above the QR-payment early return (fixes pre-existing rules-of-hooks violation).

## Verification
- `npx eslint` on touched files: 0 errors (only pre-existing img/hooks warnings elsewhere).
- `npm run build` success, 96/96 pages.

## Manual check (please review)
1. Nav reads Inventory Management; meals tab button says + Create Meal; discounts/promos show one correct button; archived tabs show no create button.
2. Each management table shows 10/page with counts; filters/tabs reset to page 1.
3. Sidebar toggle collapses to icons, persists across reload, tooltips appear; receptionist sidebar unchanged.

Awaiting review. Say `"push"` only when you want commit + push.
