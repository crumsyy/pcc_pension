# Implementation Plan — Unclip Inventory Dashboard (Pagination Reachable)

## 1. Root cause (verified in CSS + layout)
- The app shell is exact-fit: `.pcc-main-wrapper` is `height:100vh; overflow:hidden`, `main` scrolls, but `.pcc-page-container` is `overflow:hidden` (`globals.css:1150-1157`). Any page content taller than the viewport is **clipped with no scroll**.
- The old inner-scroll cap on Recent Stock Movements masked this by keeping the card short. Removing the cap (last push) lets the card grow — and its bottom (pagination) now renders inside the clipped zone.
- CSS already provides the escape hatch: `.pcc-page-container.pcc-page-natural { overflow: visible }` (`globals.css:1159`), so the page flows and `main` scrolls. It is currently used by zero pages.

## 2. Change (one class, inventory page only)
- Add `pcc-page-natural` to the inventory root (`page.js:689`: `pcc-page-container table-compact pcc-content-reveal` → append `pcc-page-natural`).
- Nothing else changes: dashboard table stays cap-free (all 10 rows + pagination visible via page scroll); other tabs keep their own inner-scroll caps, which continue to work inside a scrolling page.
- Not changing the shell CSS itself (global blast radius) or pagination behavior.

## 3. Verify
- `npx eslint` (stash-compared) + `npm run build`; browser scroll check needs staging (unproven hatch — flagging honestly: if `main` scroll misbehaves, fallback is a taller dashboard-only cap).
- Commit/push only on `"push"`.

## 4. Questions
1. Apply the `pcc-page-natural` class (Recommended) vs another approach?
2. Proceed?
