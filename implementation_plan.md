# Implementation Plan — Level Logs Tab Panels (Equal Height, Bottom-Aligned Footers)

## 1. Goal
Disposed Inventory Logs and All Stock Movements Audit History panels render at equal height with footers on the same baseline. No API/DB/count changes.

## 2. Current State (verified from screenshot + code)
- Logs tab (`inventory/page.js:1260-1334`): two `col-12 col-lg-6` columns; cards are plain `card bg-white p-3 border` (natural height), footers sit directly under each table. The audit card (10 tall rows) runs longer, so bottoms misalign.

## 3. Scope
- IN: card/column classes + footer wrappers in the logs tab only.
- OUT: caps, counts, pagination logic, other tabs, APIs.

## 4. Design
- Both cards: add `h-100 d-flex flex-column` (columns already stretch to equal height; cards fill them).
- Wrap each `AdminPagination` in `<div className="mt-auto">` so both footers pin to the cards' shared bottom edge; shorter panel gains whitespace above its footer.
- Everything else (scroller caps, 5/10-per-page, badges) untouched.

## 5. Steps
1. Four small edits in `inventory/page.js` (2 card classes + 2 footer wrappers).
2. `npx eslint` file + `npm run build`.
3. Manual: bottom borders + footers aligned at 768px and 930px heights.
4. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- Panels level with aligned footers; build passes.

## 7. Risks
- None; flex alignment only.
