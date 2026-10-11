# Implementation Plan — Reservation Overview Merge + Lifecycle Transitions

## 1. What you asked
- Admin Reservation Status Overview: **Reserved and On Hold are one → single Reserved card** (drop the On Hold card).
- Enforce: Reserved→Booked→Occupied→Completed chain; Reserved→Cancelled; Booked→Cancelled; Reserved→Expired; Booked→No-Show.

## 2. Findings (verified)
- The overview (`app/admin/reservations/page.js`) renders cards/filter from shared `RESERVATION_STATUSES` + API `counts`; rows render `StatusBadge` (On Hold shows orange today).
- API `computedStatus` already collapses most raws; only the hold branch still emits `On Hold`, and `normalizeReservationStatus` preserves it.
- Convert (Reserved→Booked) and cancel (Reserved→Cancelled) exist; receptionist booking-cancel cascades to the linked reservation, **guest self-cancel does not**.
- `Expired` is never written (scheduler writes `Released`); reservation No-Show is only auto-written for unconverted (`Confirmed/Pending`) rows, and manual/auto booking No-Show never cascades to the linked `Booked` reservation.

## 3. Proposed changes (page-local merge — shared normalizer untouched)
1. **Overview page only**: cards + status filter become `Reserved / Booked / Cancelled`; `Reserved` count = Reserved + On Hold raws; On-Hold rows render the Reserved badge (hold-expiry note kept via `rawStatus`); filter `Reserved` matches both.
2. **Reserved→Expired**: scheduler writes `Expired` instead of `Released` (notification copy updated to match); audit every `Released` exclusion list so expired holds behave identically (elsewhere `Expired` is already excluded; `Released` stays recognized as legacy).
3. **Booked→No-Show**: manual `noshow` action + auto booking No-Show in `syncRoomStatuses` cascade the linked reservation (`Booked`→`No Show`); notifications kept.
4. **Booked→Cancelled**: guest self-cancel cascades to its linked `Booked` reservation (mirrors the receptionist path).
- Occupied/Completed live on the booking side (unchanged); converted reservations stay `Booked` (existing lifecycle note).

## 4. Questions
1. Merge display page-local only (Recommended) vs change the shared normalizer so On Hold reads Reserved everywhere (receptionist/guest/reports too)?
2. Rename scheduler `Released`→`Expired` (Recommended, per your diagram) vs keep `Released` writes and only display them as Cancelled?
3. Proceed?

## 5. Acceptance
- Overview shows 3 cards with merged counts; no On Hold anywhere on the page; each diagram transition verified in code (convert/cancel/expire/noshow paths); build + eslint (stash-compared) + guard harness green; commit/push only on `"push"`.
