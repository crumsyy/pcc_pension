# Walkthrough — Receptionist Speed (P0) + Flatpickr Dates (no commit/push yet)

## Perf (root causes from diagnosis)
1. Dashboard SSR forced a full room-sync write txn + 12 queries on every navigation, then the client re-fetched the same — now `syncRoomStatuses(false)` (throttle honored; cron still syncs), unbounded check-ins list capped at 10, checkout-today count + `Completed` via a sargable range (also fixes missing new completions).
2. Poll pacing: dashboard 3s→15s, NotificationBell 3s→10s (all pages benefit; Sync-Now/focus/custom events still fetch on demand).
3. Cancellation: `AbortController` on dashboard/bookings/reservations fetches (abort previous + unmount; `AbortError` swallowed) — navigating away kills the heavy request instead of piling onto the 25-connection pool.
4. Header search no longer dumps the full bookings payload per keystroke: new additive `?palette=` lightweight path (top 8 id/room/guest/status matches) used by `SidebarClient`.
5. Indexes (additive, idempotent): `booking(status,checkOutDateTime)`, `reservation(status,holdExpiryDateTime)`, `room(isArchived,status)` — created once by `migrate.mjs`; measure the second load, not the first.

## Flatpickr (4 date inputs, times stay native)
- Reservation + booking workspace check-in/out dates → `FlatDatePicker m/d/Y` (dark-mode calendar included). Emits UI format, which normalizes today's mixed DB/UI state — all validators/converters/min-dates, auto-advance checkout, and the availability calendar stay wired identically.

## Out of scope (offered follow-up)
Bookings N+1 lazy balances, inquiries pacing, flatpickr-CSS scoping, font CDN preload.

## Verification (actually performed)
- `npx eslint`: 22 problems before = 22 after (pre-existing). `npm run build`: 97/97. `node --check` on migrate.
- Staging must confirm: dashboard navigation timing (before/after), poll behavior, header search results, and picking/clearing all 4 date fields incl. min-date enforcement.

Say `"push"` only when you want commit + push.
