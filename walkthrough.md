# Walkthrough — Landing Page Updates

## 1. Flatpickr date pickers (previous, kept)
- Installed `flatpickr`; new `app/components/FlatDatePicker.js` (vanilla, `m/d/Y`, `disableMobile:true`).
- `app/layout.js:2` CSS import; `app/globals.css` z-index fix.
- `app/page.js` hero Check-in/Check-out now `FlatDatePicker`, `MM/DD/YYYY` contract kept, `maxCheckIn` = today+2.

## 2. Show 6 + See More (new)
- `app/page.js` only:
  - `VISIBLE_COUNT = 6`, `showAllPromos`, `showAllRooms` states.
  - Promotions: `visiblePromos = showAllPromos ? all : slice(0,6)` (`page.js:~249-251,433`); toggle `See More (X more)` ↔ `Show Less` only when `> 6`.
  - Rooms dynamic: `visibleRooms` sliced to 6 then re-grouped by floor, so total visible = 6 across floors; same toggle pattern. Fallback static 6 cards unchanged.
  - Buttons reuse `btn btn-pcc-outline`, centered.
- No API/DB changes; search/modal/booking logic untouched.

## Verification
- `npx eslint app/components/FlatDatePicker.js` clean.
- `npm run build` success, 96/96 pages, `/` static.
- Manual to check: with >6 promos/rooms → 6 shown + button; expand shows all; collapse back to 6; <=6 → no button.

Awaiting review. Say `"push"` only when you want commit + push.
