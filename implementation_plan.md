# Implementation Plan — Audit Panel: Slim Rows + Viewport Cap

## 1. Goal
Audit History footer visible with breathing room at laptop viewport heights (~768px), not just tall screens. No API/DB/count changes (stays 10/page).

## 2. Root Cause (verified)
- Audit rows run ~75px tall (date wraps to 2 lines, item names wrap) vs ~55px in Disposal. Fixed `350px` cap + footer + chrome ≈ 510px card, but at a 768px viewport only ~460px is available after header/title/tabs — footer lands below the fold (screenshot).
- A fixed cap can't fit all viewports; the Disposal panel fits only because it renders 5 short rows.

## 3. Scope
- IN: audit table date cell + audit scroller cap in `inventory/page.js`.
- OUT: counts, pagination, disposal panel, APIs.

## 4. Design
- Date `td` gains `text-nowrap` (single-line dates → rows drop to ~50px like the rest).
- Scroller cap → `max(180px, calc(100vh - 500px))`: reserves ~500px for shell + title + tabs + card chrome + footer. At 930px shows ~8 rows; at 768px ~5 rows + internal scroll; footer always visible with room to spare.

## 5. Steps
1. Two small edits in `inventory/page.js`.
2. `npx eslint` file + `npm run build`.
3. Manual: footer visible with whitespace below at 768px and 930px heights; rows single-line dates.
4. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- Footer visible with breathing room at laptop heights; build passes.

## 7. Risks
- Narrow screens may horizontal-scroll the nowrap date column inside `table-responsive` — acceptable, standard pattern.
