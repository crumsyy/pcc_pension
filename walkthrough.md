# Walkthrough — Rooms Tabs, Header Search, User Menu, Receptionist Parity

## Changes (no commit/push yet)
- Rooms: Bootstrap tabs → shadcn `Tabs`; "Active Rooms" → "Rooms"; search prefills from `?search=` (lazy init, no new effects).
- New `avatar.jsx`, `dropdown-menu.jsx`, `command.jsx` + theme CSS (hand-built shadcn-style, not CLI code).
- Header (admin + receptionist): centered search button → palette (Ctrl+K) with per-role page destinations + live room/stay results (debounced; admin rooms API / receptionist bookings); user block → avatar + dropdown (Profile dialog with session info, Logout into existing confirm modal).
- Sidebar collapse toggle now works for receptionists too (shared persisted key); sidebar bottom avatar swapped.
- Receptionist skeletons removed: checkin, orders, inquiries, bookings, dashboard `loading.js` (deleted), billing-checkout inline shimmer → quiet text placeholders. Sources kept.
- Receptionist bookings search prefills from `?search=` (palette deep-links land filtered).

## Verification
- `npx eslint` on touched files: only pre-existing findings; new code clean.
- `npm run build` success, 97/97 pages.

## Manual check
1. Rooms tabs renamed/styled; palette finds pages + rooms/stays, keyboard works.
2. Avatar menu: Profile dialog shows session info; Logout opens confirm.
3. Receptionist rail collapses/persists; no skeleton flash anywhere in receptionist.
4. Palette room pick lands prefiltered.

Awaiting review. Say `"push"` only when you want commit + push.
