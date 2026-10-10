# Walkthrough — Inventory Pagination Unclipped (no commit/push yet)

## Change
- `app/admin/inventory/page.js` root: added the existing `pcc-page-natural` escape-hatch class (`overflow: visible` instead of `hidden`), so the cap-free Recent Stock Movements card flows and the page scrolls via `main` — pagination is now reachable below the last row. One class only; shell CSS, other tabs, and data untouched.

## Verification (actually performed)
- `npx eslint`: clean, no findings. `npm run build`: Compiled successfully, 97/97.
- Browser scroll behavior still needs your staging check (this hatch had zero prior users): scroll the dashboard top-to-bottom and confirm the pagination row is reachable and sticky UI (sidebar/header) still behaves. If anything misbehaves, the honest fallback is restoring a taller dashboard-only cap.

Say `"push"` only when you want commit + push.
