# Implementation Plan — Receptionist Speed + Flatpickr Date Inputs

## 1. Perf diagnosis (verified by parallel deep-dive)
Ranked causes of the ~5s dashboard navigation: (a) server page forces `syncRoomStatuses(true)` (throttle bypassed) + repeats 12 queries the client then re-fetches; (b) bookings GET fans out ~9 queries **per booking** with no LIMIT, polled every 5s alongside 3s dashboard + 3s bell + 1.5s inquiries pollers, none abortable; (c) missing status/date indexes (`DATE(col)=CURDATE()` can't use indexes); (d) header search dumps the full bookings payload per keystroke; (e) render-blocking CDN CSS (minor).

## 2. P0 fixes (this turn — no behavior change)
1. `receptionist/dashboard/page.js`: `syncRoomStatuses(true)` → `(false)` (30s throttle honored; cron already syncs).
2. Dashboard route: `LIMIT` on unbounded `checkInsList`; sargable checkout-today range instead of `DATE()=CURDATE()`.
3. `migrate.mjs`: 3 indexes — `booking(status,checkOutDateTime)`, `reservation(status,holdExpiryDateTime)`, `room(isArchived,status)` (additive, `ensureIndex` pattern).
4. Poll intervals: dashboard 3s→15s, NotificationBell 3s→10s (shared component — all pages benefit); inquiries/bookings/reservations intervals untouched this turn.
5. `AbortController` on dashboard + bookings + reservations fetches (abort on unmount/tab switch; same pattern as reports).
6. Header search: `?limit=6` support in bookings GET (additive param, default unbounded as today) + use it in `SidebarClient`.

## 3. Flatpickr swap (4 date inputs, times stay native)
- Reservations workspace check-in/out + bookings workspace check-in/out: native `type="date"` → `<FlatDatePicker dateFormat="m/d/Y">` emitting UI format (which actually **normalizes** today's mixed DB/UI state — all validators/converters accept it). `min`, `required`, `disabled`, error classes, auto-advance checkout, and the availability calendar below all stay wired identically.

## 4. Explicitly out of scope
Bookings N+1 lazy balances, flatpickr-CSS scoping, font CDN preload, inquiries pacing (follow-up turn on request).

## 5. Verify
- `npx eslint` (stash-compared) + `npm run build` + timing before/after on staging (note: index creation runs once via migrate; measure second load).
- Commit/push only on `"push"`.

## 6. Questions
1. P0 perf set as above (Recommended) vs different subset?
2. Flatpickr for the 4 date inputs, times native (Recommended) vs times too?
3. Proceed?
