# Implementation Plan — PO Mirrors Room Management Layout

## 1. Goal
Purchase Orders panels behave exactly like Room Management: natural-height cards, footer below the table in normal flow, breathing room at the viewport bottom, internal table scroll only as a short-screen fallback. No API/DB/count changes (stay 8/page + 4/page restock).

## 2. Current State (verified from screenshots + code)
- Rooms (`RoomsClient.js:576-577,660`): plain table card + `table-responsive maxHeight calc(100vh - 280px), overflowY auto` + footer below → content shorter than viewport → whitespace below, never edge-to-edge.
- PO (`purchase-orders/page.js`): locked flex (`flex-grow-1/h-100/overflow-hidden` row, columns, cards) stretches content to fill the container exactly → footers sit at the very viewport edge, perceived as cut (Image 2), even though nothing is technically clipped.

## 3. Scope
- IN: `purchase-orders/page.js` layout classes/styles only.
- OUT: pagination, shell CSS, other pages, APIs.

## 4. Design (copy the Rooms pattern)
- Container: drop inline fixed height/overflow (keep `po-compact` + padding).
- Row/columns/table card/restock card: drop all `flex-grow-1/h-100/overflow-hidden/minHeight` locks → plain `row g-3`, plain cols, plain cards (restore filter `mb-3`, card paddings `1.25rem`, title `mb-3` to match Rooms rhythm).
- Table scroller: `maxHeight: calc(100vh - 340px), overflowY: auto` (340 covers title + filter + thead + footer + paddings, so 8 compact rows show fully at normal heights with room to spare).
- Restock list: same `maxHeight` cap + `overflowY: auto`; footers stay in normal flow below each card.
- Keep `table-sm`, `.po-compact`, 8/4 pagination, pinned-footer wrappers (harmless).

## 5. Steps
1. Layout edits in `purchase-orders/page.js`.
2. `npx eslint` file + `npm run build`.
3. Manual on localhost + deployed: PO panels show top+bottom borders with whitespace below like Rooms; no internal scroll at ~900px; short screens fall back to in-table scroll with footers visible.
4. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- PO visually matches Rooms panel behavior; zero edge-touching/cut panels; build passes.

## 7. Risks
- Very short viewports use in-table scroll (same as Rooms) — intended fallback.
