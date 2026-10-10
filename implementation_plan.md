# Implementation Plan — Reservation → Booking → Payment → Checkout Workflow

## 1. Inspection summary (4 parallel maps, verified)

**Architecture:** Next.js + MySQL (`mysql2` pool, `lib/db.js`). Statuses are free `VARCHAR(50)` (migrated from ENUM by `database/migrate.mjs`) — no schema change needed for status work.
- Canonical maps: `lib/bookingStatuses.js` (`RESERVATION_STATUSES=[Reserved,On Hold,Booked,Cancelled]`, `BOOKING_STATUSES=[Pending,Active Stay,Bill Finalized,Paid,Completed]`, normalizers + `isValidBookingStatusTransition` — currently **dead code**, and it has no `Checked Out` key so legacy writes bypass it).
- Money truth: `getBookingBalanceDetails/getBookingBalance` (`lib/db.js:777/1607`) + `calculateBillingTotals` (`lib/billingCalculator.js`); checkout gates use `>0.05` tolerance everywhere.
- Billing & Checkout merge (Req 7) **already exists**: `app/receptionist/billing-checkout/` workspace with Billing/Payments tabs sharing `?bookingID`, legacy `/billing` + `/payments` redirect to it, checkout button lives in Payments tab with balance gating. Only stale leftovers remain (`SidebarClient.js:210-219` nav list, `NotificationBell.js:325-326` deep links — both still work via redirects).
- 2-day reservation rule enforced client+server (`lib/validation.js`, both reservation APIs). No bank transfer anywhere (seed has Cash/GCash only). Payment verification (PayMongo QR + auto-settle + webhook + guest 5-min/ref guards) exists.
- Reservation→booking conversion exists on 3 paths (receptionist modal, guest convert route, guest bookings route) with overlap txn + victim auto-cancel; guest conversion locks dates and reuses guest record.

## 2. Gaps & conflicts (must decide before coding)

| # | Gap / conflict | Proposal (no invented rules, no rebuild) |
|---|---|---|
| 1 | Strict labels (`Booked/Occupied`) vs canonical (`Pending/Active Stay`); `Occupied` is a room status | Keep canonical values (blast radius: dashboards, reports, badges all normalize them). Enforce the strict *sequence* through the canonical states + activate `isValidBookingStatusTransition` at API write points. Display stays consistent via existing normalizers. |
| 2 | `completeBookingAndFreeRoom` writes `Checked Out` but returns `Completed`; reports filter legacy list (`Checked Out/Bill Finalized/Payment Completed`) and would miss new `Completed` rows | Write `Completed` going forward; extend the sales/occupancy report queries + dashboard buckets to include `Completed` alongside legacy values (read-only display effect, verified by query test). |
| 3 | Checkout threshold `0.05` vs Req exact `₱0.00`; negative balances currently pass (`balance=max(0,…)` hides them) | Cent-safe compare: round computed balance to centavos, require `=== 0`; block + flag review when negative (surface raw negative instead of zeroing). |
| 4 | Checkout/cancel/no-show set room straight to `Available`; `REQ116` + Req 6 want `Cleaning`, and `syncRoomStatuses` would overwrite `Cleaning` back to `Available` | Checkout (from Occupied) sets `Cleaning`; guard sync to never auto-clear `Cleaning` (only manual/admin release → `Available`). Cancel/no-show of never-occupied stays keep `Available`. |
| 5 | Check-in has no status/date guard (re-check-in overwrites; early-date check-in allowed, only fee-confirmed) | Require booking in `Pending`-family status + same calendar date as scheduled check-in (keep existing same-day early-fee flow); block idempotent re-check-in with explicit error. |
| 6 | Down-payment tiers are **30/50/100** in code, Req says 25/50/full | **Conflict: keep existing 30/50/100** (do not invent rules). Needs your explicit override to change. |
| 7 | One-room-per-guest is **explicitly disabled** (`checkActiveReservationOrBooking` always valid); availability API only excludes `Pending` reservations (misses On Hold/Confirmed) | Keep disabled state (existing business rule) but fix the availability query to exclude all active reservation statuses — pure bug fix, no rule change. Flag the one-room rule as your call. |
| 8 | Receptionist `convert_to_booking` doesn't reject already-`Booked` reservations (double-click risk); guest paths do | Add already-converted guard + UI busy-state (buttons already mostly disable; audit remaining). |
| 9 | `ReservationCalendar.js:145-174` renders legacy labels (`Reserved/Booked/Occupied`) raw | Switch to `normalizeBookingStatus`/`StatusBadge` like everywhere else. |
| 10 | Guest cannot edit own reservation (cancel + re-reserve only); Req allows modify "where permitted by existing rules" | Keep receptionist-only modify (existing rule); no new guest-edit surface. |

## 3. Implementation phases (incremental, existing deps only)

- **P0 — Guards & correctness (no UI redesign):** activate transition validation in `api/receptionist/bookings` (checkin/checkout/cancel/noshow), `api/receptionist/reservations` (convert), guest convert/bookings routes; already-Booked convert guard; check-in status+date+idempotency guard; exact-₱0.00 checkout gate (cent-safe, negative-block) in `bookings/route`, `billing/route`, `receptionist/billing/route`, `completeBookingAndFreeRoom`; `Completed` write + report/dashboard query extension; availability-API status fix.
- **P1 — Room cleaning:** checkout-from-Occupied → `Cleaning`; sync preserves `Cleaning`; admin/receptionist manual clear path already exists (verify); notifications unchanged (post-commit only, dedup kept).
- **P2 — Consistency sweep:** `ReservationCalendar` labels via normalizers; remove/refresh stale sidebar list; keep deep links working; status counts stay query-driven (no hardcoding).
- **P3 — Verify:** build + eslint (pre-existing baseline kept), route-level balance/transition tests with fixtures (honest Passport: no live-DB claims — live flows need staging), walkthrough; commit/push only on `"push"`.

## 4. Questions (need answers before coding)
1. Keep canonical statuses and enforce sequence through them (recommended) vs rename everything to Reserved/Booked/Occupied/Completed?
2. Keep 30/50/100 down-payment tiers (recommended, existing rule) vs switch to 25/50/100?
3. Re-enable one-room-per-guest (was explicitly disabled) or leave disabled + fix availability query only (recommended)?
4. Proceed with P0–P3 as scoped?

## 5. Acceptance
All 13 Req-10 cases verified (valid/early/duplicate reservation; conversion reuse; partial/unverified payments; check-in date; checkout gating ±/zero/double; Completed+room state; tab sync; unrelated features intact); build green; no guest-auth/landing changes; no mock-data claims.
