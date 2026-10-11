# Walkthrough — PO Dropdown Fit (no commit/push yet)

## Change (`app/admin/purchase-orders/page.js` only)
- Create PO dialog back to 800px wide; catalog dropdown list gains `min-width: 280px` so options render wider than their table column (names wrap, badge + stock fully visible). Nothing else changed.

## Verification (actually performed)
- `npx eslint`: 5 problems before = 5 after (pre-existing). `npm run build`: 97/97.

Say `"push"` only when you want commit + push.
