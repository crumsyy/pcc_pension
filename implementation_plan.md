# Implementation Plan — Catalog width back + compact dropdown labels (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User requests
1. Catalog got too wide — bring it back down (keep the slim fixed tray).
2. Tray guest dropdown labels too big + horizontal scrollbar — compact them, no x-scroll.

## 2. Proposed changes
1. Grid (both files): catalog `col-xl-9` → `col-xl-8`, tray `col-xl-3` → `col-xl-4`; drop the `orders-tray-col`/`orders-catalog-col` overrides (delete from CSS). Fixed 360px card hugs the lane's right edge (`right:36px` unchanged); leftover lane space is invisible background. `lg` and below untouched.
2. Orders picker labels (`orders/page.js`): `Room 102 — Gloria, Ernest Dylan (Booked)` → `Room 102 — Gloria, Ernest Dylan` (UID/status stay in `searchKeywords`, still searchable).
3. `SearchableSelect.js`: dropdown `ul` gets `overflowX:hidden`; option label span gets truncate (`min-width:0`) — kills horizontal scroll everywhere it's used (also benefits bookings/reservations pickers).

## 3. Verification
- `eslint`; `npm run build` 97/97; visual: catalog cards back to original size, tray 360 fixed no overlap, dropdown options single-line ellipsis, searchable by UID/status still works.

## 4. Risks
- Low: grid revert + label shortening + CSS clamp. Status still visible after selection? The input shows the full label on select — shortened label means less context post-select; acceptable per request.

## 5. Questions
- Q1: Proceed?
