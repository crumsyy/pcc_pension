# Implementation Plan — Fixed Fit-to-Screen Inventory Tables (No Page Scroll)

## 1. Direction change (your call)
Revert the scrolling approach: the Inventory page goes back to the exact-fit shell (no page scroll), and the three tables get fixed viewport-sized scroll areas with sticky headers + always-visible pagination.

## 2. Changes (`app/admin/inventory/page.js` only)
1. Root: remove `pcc-page-natural` (restores shell clipping + `main` fit; page itself no longer scrolls).
2. Dashboard Recent Stock Movements wrapper: `maxHeight: max(320px, calc(100dvh - 440px))` + `overflowY: auto` — fits all 10 rows at normal viewport heights; headers stick (global CSS), pagination sits right below inside the card.
3. Movement Logs row (`logs` tab): fixed row height `max(420px, calc(100dvh - 380px))`; both table wrappers become `flex: 1, minHeight: 0, overflowY: auto` (replacing the short `100vh-500px` caps) so both cards stretch to the viewport bottom with internal scroll; `mt-auto` paginations stay pinned at card bottoms.
- Untouched: columns, data, page sizes, filters, pagination component, other tabs, theme, shell CSS.

## 3. Verify
- `npx eslint` (stash-compared) + `npm run build`; staging visual check (exact pixel fit varies by screen height — floors keep short screens usable).
- Commit/push only on `"push"`.

## 4. Questions
1. Fixed sizes as computed (Recommended) vs taller/shorter caps?
2. Proceed?
