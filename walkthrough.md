# Walkthrough — Reservation → Booking → Payment → Checkout Workflow (no commit/push yet)

## What changed (existing architecture reused, no rebuild, PCC theme untouched)

**Lifecycle enforcement (`lib/db.js`, `lib/bookingStatuses.js` unchanged)**
- New `assertBookingTransition()` + `getBookingRawBalance()` + `isSettledBalance()` (exact ₱0.00, cent-safe).
- Balance core: `paidTotal` now counts only `Settled`/legacy-NULL payments (Declined no longer reduces balance); signed `rawBalance` + `hasNegativeDiscrepancy` exposed (display `balance` still clamped, so cards don't change shape).
- `completeBookingAndFreeRoom`: writes `Completed` (was `Checked Out`), room → `Cleaning` (was `Available`), idempotent incl. legacy rows, exact-zero gate with overpayment review message, still fully transactional.
- `syncRoomStatuses` preserves `Cleaning`; booking exclusion adds legacy `Canceled`.

**Check-in (`api/receptionist/bookings`)**: Pending-family + not-No-Show guard, same-calendar-date rule (advance check-in now 400s with "update dates first"; same-day early-fee flow kept), room Maintenance/Cleaning block, same-day occupant conflict check, duplicate check-in blocked, `assertBookingTransition` on the write.
**Checkout (`receptionist/bookings`, `api/billing`, `receptionist/billing`)**: in-house-state guard, exact-zero gate (negative → review 400), responses return real `roomStatus`, audit/messages say Cleaning, notifications kept post-commit.
**Cancel/no-show**: terminal-state re-entry blocked; in-house cancel → `Cleaning`; no-show Pending-only.
**Conversion**: receptionist `convert_to_booking` rejects already-`Booked` + in-txn `FOR UPDATE` re-check (guest paths already had both).
**Race-safe creates**: receptionist + guest reservation creates now run conflict-check + insert + room update in a transaction with room `FOR UPDATE`.
**Availability API**: excludes all active reservation statuses (was `Pending` only), unexpired-hold grace, NULL-safe dates, `Canceled` bookings.
**Verified-only money**: reports revenue/paid sums + admin dashboard sums exclude non-Settled payments; `Completed` added to sales/occupancy report lists + receptionist checkout counter; orders APIs + schedules exclude `Completed` so closed stays can't take orders.
**Tiers 25/50/100** (your explicit choice): receptionist workspace + convert modal + reservations default, guest fallback label, terms Section 5 (50%→25% minimum). Server accepts any int (no whitelist existed); guest label already covered 25%.
**Checkout UI**: BillingTab + PaymentsTab + check-in page use exact-zero + overpayment-review branch; confirm dialogs show guest/room/final-total/verified-paid/₱0.00; success copy says Cleaning. Tab sync untouched (already `?bookingID`-based). Sidebar stale Billing/Payments entries merged to Billing & Checkout (redirects preserved).

## Decisions honored from your answers
Canonical statuses kept (sequence enforced through them); tiers switched to 25/50/100; one-room rule left disabled + availability fixed; P0–P3 implemented. Left as-is deliberately: advance check-in removed in favor of update-dates-first (Req 5 literal); guest self-edit stays cancel+re-reserve (existing rule); `ReservationCalendar` labels already map cleanly onto Req vocabulary.

## Verification (actually performed)
- `npm run build`: Compiled successfully, 97/97.
- `npx eslint` on all 24 touched files: identical problem counts before/after (58→58 full set; 12→12 final trio) — zero new findings.
- Logic harness (pure functions, no DB): 20/20 — transitions, normalization, exact-zero incl. float dust, overpayment.
- **Not performed (no test DB in this environment; .env points at the live database, which I will not mutate): the 13 live Req-10 flows. Verify on staging:** future reservation OK; same/next-day rejected; overlap + double-click conversion blocked; partial/unverified payments don't settle; early check-in blocked; checkout disabled >₱0.00 and on overpayment, enabled at exactly ₱0.00; double checkout idempotent; Completed + Cleaning result; tab sync; regression of dashboards/reports.

Say `"push"` only when you want commit + push.
