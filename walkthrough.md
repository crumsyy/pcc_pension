# Walkthrough — PO Compact Density Fit

## Changes (no commit/push yet)
- `app/globals.css`: scoped `.po-compact` rules — tighter table cell padding, 28px action buttons, smaller badges.
- `purchase-orders/page.js`: container gains `po-compact` + reduced padding; filter card, table card, and title margins tightened. Pagination (8/4), locked layout, and shell flexbox unchanged.

## Verification
- `npm run build` success, 96/96 pages (CSS/JSX-only change).

## Manual check (please review on localhost http://localhost:3000)
1. All 8 PO rows fully visible with no table scrollbar and no half-cut rows at normal desktop height.
2. Footer + restock 4 + restock footer fully on screen.

Awaiting review. Say `"push"` only when you want commit + push (this will also include the earlier unpushed flexbox shell fix).
