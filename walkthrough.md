# Walkthrough — PO Dropdown Wrap Fix (no commit/push yet)

## Change (`app/admin/purchase-orders/page.js`, Combobox options only)
- The option's second line was a rigid edge-to-edge row that pushed stock text past the menu edge (unfixable by widening — the list lives inside the dialog's scroll container). It now wraps, so badge + stock always stay visible at any width. Nothing else changed.

## Verification (actually performed)
- `npx eslint`: 5 problems before = 5 after (pre-existing). `npm run build`: 97/97.

Say `"push"` only when you want commit + push.
