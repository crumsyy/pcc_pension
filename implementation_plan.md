# Implementation Plan — Landing Page "Show 6 + See More"

## 1. Goal
Limit landing page (`app/page.js`) data lists to 6 visible items initially with a "See More / Show Less" toggle. No API/DB changes.

## 2. Current State (verified `app/page.js`)
- Promotions (`page.js:399-429`): maps ALL `landingData.promotions` — no limit, no toggle.
- Rooms & Rates dynamic (`page.js:440-534`): groups `landingData.rooms` by floor (`roomsByFloor`), then maps ALL floors + ALL `floorRooms` — no limit.
- Rooms fallback (no API data, `page.js:536-624`): 3 Ground + 3 Second = exactly 6 static cards — already meets "6", no change needed.
- No existing `showMore`/`slice` state on landing page.

## 3. Scope
- IN: `app/page.js` only — promotions grid + dynamic rooms grid.
- OUT: API (`/api/landing`), CSS framework, fallback static rooms, About/Amenities/Footer, modal, search logic.

## 4. Design
- Add state: `const [showAllPromos, setShowAllPromos] = useState(false)` and `const [showAllRooms, setShowAllRooms] = useState(false)`.
- Constant `VISIBLE_COUNT = 6`.
- Promotions: `const visiblePromos = showAllPromos ? promotions : promotions.slice(0, 6)`; render `visiblePromos`; if `promotions.length > 6` show toggle button below grid: `See More (X more)` ↔ `Show Less`.
- Rooms: flatten-preserving-floors problem — simplest that keeps floor headers correct:
  - Option A (recommended): flatten all rooms to one ordered list, `visibleRooms = showAllRooms ? rooms : rooms.slice(0,6)`, then re-group `visibleRooms` by floor for rendering. Floor headers show only for floors with visible rooms; counts reflect visible subset. Toggle below section shows `See More Rooms (X more)` ↔ `Show Less`.
  - This keeps total visible = 6 across both floors (e.g. 3+3 or 4+2 depending on order), which matches "only show 6".
- Button style: reuse existing `btn btn-pcc-outline` centered (`text-center mt-4`), no new deps.
- No behavior change when list length <= 6 (no button rendered).

## 5. Steps
1. Edit `app/page.js`: add `VISIBLE_COUNT`, two states.
2. Promotions block: compute `visiblePromos`, render it, add conditional toggle.
3. Rooms dynamic block: compute `allRooms = landingData.rooms`, `visibleRooms`, re-group, render, add conditional toggle.
4. Verify `npm run build` + manual: >6 promos/rooms → 6 shown + button; expand/collapse works; <=6 → no button; fallback (no data) unchanged.
5. Write `walkthrough.md` for review; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- Initial landing shows max 6 promos and max 6 rooms with See More buttons only when more exist.
- Toggle expands/collapses without breaking floor grouping, search, or booking buttons.
- Build passes.

## 7. Risks
- Floor grouping after slice may hide a floor header initially — acceptable and expected; full grouping returns on expand.
- Alternative (per-floor 6) rejected as it could show up to 12 total, violating "only show 6".
