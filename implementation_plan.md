# Implementation Plan — PO Compact Density (Fit 8 Rows, No Scroll)

## 1. Goal
All 8 PO rows + footer visible with zero internal scrolling at normal desktop heights. No API/DB/pagination-count changes.

## 2. Current State (verified from localhost screenshot)
- Footers now fully render (flexbox shell + pinned footers work), but rows run ~55-60px tall so only ~7.5 of 8 rows fit; the 8th requires internal scroll and the top row renders half-cut.
- `purchase-orders/page.js` table already has `table-sm`; row height is driven by 32px action buttons + default cell/badge padding and a roomy filter card.

## 3. Scope
- IN: PO-page-scoped density CSS + class hooks in `purchase-orders/page.js`.
- OUT: other pages, counts, APIs.

## 4. Design (scoped `.po-compact` on the page container)
- Table cells: `padding-top/bottom .3rem`; badges `font-size .68rem`; action buttons 28px / `.8rem`.
- Filter card padding `1rem 1.25rem` → `.75rem 1rem`; title block margins tightened.
- Restock items: `py-2` → keep, but name `font-size .85rem`, meta lines tightened (panel is the shorter column; leave mostly as-is unless needed).
- Target stack: 8×~40 + thead ~36 + footer ~55 + card padding ~40 + filter ~110 + title ~65 ≈ 625 + shell ≈ fits <864px viewports with margin.
- Keep `table-sm`, locked flex layout, 8/4 pagination untouched.

## 5. Steps
1. Add `.po-compact` CSS rules + container class.
2. `npm run build` (CSS/JSX-only; eslint N/A).
3. Manual on localhost: all 8 rows + footer visible, no table scrollbar at ~900px height; restock 4 + footer visible; shorter viewports degrade to internal scroll with pinned footers (acceptable fallback).
4. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- 8 rows fully visible, no internal table scroll, no clipped rows at normal desktop height; build passes.

## 7. Risks
- Denser rows slightly reduce touch targets — still ≥28px buttons, acceptable for desktop admin.
