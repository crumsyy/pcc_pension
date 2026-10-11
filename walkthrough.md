# Walkthrough — Simplify receptionist tabs

## Changes
- `app/receptionist/reservations/page.js`
  - Tab list now plain shadcn text: `Reservations` (active) + `History` (history). Removed `bi-bookmark-check` / `bi-archive-fill` icons and count badges.
  - Removed unused `activeReservationsCount` / `historyReservationsCount`.
- `app/receptionist/bookings/page.js`
  - Tab list now plain shadcn text: `Bookings` (active) + `History` (history). Removed `bi-clock-history` / `bi-archive-fill` icons and count badges.
  - Removed unused `activeBookingsCount` / `historyBookingsCount`.
- Tab behavior unchanged: same `Tabs selectedKey={activeTab}` + `onSelectionChange` side-effects; filtering keyed off `activeTab` ids.

## Verification
- `grep` for count vars: no matches (clean removal).
- `eslint` on both files: only pre-existing `set-state-in-effect` / `exhaustive-deps` issues; no new `no-unused-vars`.
- Visual to confirm: two text-only tabs per page, no icons/numbers.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
