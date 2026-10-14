# Walkthrough — HCI pass, guest portal (both phases)

## Phase 1 — Mobile foundation
- Bottom nav: safe-area inset, taller 44px-friendly targets, compact labels for 6 items.
- Header bell + profile menu: 44px hit areas (bell via min size, menu via padding, theme toggle via invisible expansion — visuals unchanged).
- Notifications tab: skeleton placeholders instead of false-empty flash.
- Verified sticky/fixed coexistence: bottom nav, chat bubble offsets, floating order bar + spacer, modal z-index — no overlaps.

## Phase 2 — Consistency / cognitive load
- Eyebrow headers on Rooms, Bookings, Notifications tabs (Home pattern extended).
- No logic, API, copy-meaning, or status changes.

## Verification
- `npm run build` → success.
- Manual: 375px + desktop, light + dark; tab through all screens checking targets, overlaps, loading states.
