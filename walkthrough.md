# Walkthrough — Faster Admin Portal Loading (P1–P3)

## Changes (no commit/push yet)
- **P1 — 350ms debounced search** (timer + `useRef`, no new effects): bookings, reservations, users, rooms, amenities, products, purchase-orders, discounts, inventory. Typing updates the input instantly and fires ONE fetch 350ms after stopping (was: one MySQL round-trip per keystroke). Pagination resets and Clear buttons preserved. Reports needed nothing (its text input is client-side only).
- **P2 — polling hygiene** (same intervals, zero freshness change while visible): dashboard, inventory, purchase-orders, discounts polls now skip when the tab is hidden and when a fetch is already in flight (flag always cleared in `finally`).
- **P3 — parallel reports queries** (`app/api/admin/reports/route.js` GET only): independent queries batched into `Promise.all` groups (sales 4-way, counts 3-way, occupancy 4-way + 5-way, inventory 6-way + 2-way, guests 4-way); result-dependent fallbacks and JS aggregation order untouched — identical response values.
- No visual/logic/API-shape changes.

## Verification
- `npx eslint` on all touched files: only pre-existing findings, nothing new.
- `npm run build` success, 96/96 pages.

## Manual check
1. Network tab: typing a search word = 1 list request; results identical.
2. Background tab = no polling requests; visible tab refreshes as before.
3. Reports numbers identical, loading noticeably quicker.

Awaiting review. Say `"push"` only when you want commit + push.
