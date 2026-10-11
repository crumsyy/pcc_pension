# Implementation Plan — Allow advance check-in with charge confirmation (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User request
- Early (advance) check-in before the scheduled date should be ALLOWED, not blocked: show a Yes/No confirm dialog warning of charges; day-gaps add extra nights at room rate ([Image 1] currently hard-blocks with an error).

## 2. Evidence / current state
- Block: `api/receptionist/bookings/route.js:1092-1096` returns 400 when Manila date < scheduled date. Dead scaffold below it (`advanceNights`/`additionalRoomCharge` always 0; incidental insert 1117-1123 never fires).
- Client `checkin/page.js:262-273` ALREADY handles `requiresAdvanceCheckInConfirmation` (`Confirm & Add Charges` / `Cancel`, shows nights + amount) and sends `confirmAdvanceCheckIn` — but the API never returns that key. `bookings/page.js` `handleCheckIn` only handles same-day-early confirm; needs the advance branch + flag too.
- Billing (`lib/db.js:880-887`): nights = calendar diff of `booking.checkInDateTime → checkOutDateTime`, and check-in rewrites `checkInDateTime = now` (`route.js:1150`). So an advance check-in AUTOMATICALLY lengthens the stay and bills extra nights at room rate — inserting the scaffolded incidental on top would DOUBLE-charge. Design below therefore warns + extends, with NO incidental insert (scaffold block removed).
- Gap guard missing: existing `sameDayOccupant` check (1135-1147) only covers in-house statuses, not a future booking/reservation holding the room during the advance gap → must add overlap check or risk double-booking.

## 3. Proposed changes
1. **API `checkin` (`bookings/route.js`):**
   - Compute `advanceDays` (Manila calendar days, today → scheduled date). If > 0 and no `confirmAdvanceCheckIn` flag: return `{ requiresAdvanceCheckInConfirmation: true, advanceNights, additionalRoomCharge: advanceNights × roomBaseRate, roomNumber, title, message }` (keys match existing client) instead of the 400.
   - On confirmed advance: (a) overlap-check room for [today, scheduled check-out] vs other active/future bookings + reservations → 409 conflict if occupied (new; prevents double-booking); (b) proceed with existing check-in (rewrites `checkInDateTime`, stay auto-extends, extra nights bill automatically); (c) remove/skip the scaffold incidental insert (avoid double charge); success message states early days + auto-billing.
   - Same-day-early hourly-fee flow unchanged; no hourly fee on advance arrival day (nights cover it).
2. **Client `bookings/page.js` `handleCheckIn`:** add `requiresAdvanceCheckInConfirmation` branch (same Yes/No dialog as checkin page) + send `confirmAdvanceCheckIn` flag. Checkin page needs NO change (already wired).
3. **Dialog copy (server-provided):** “Guest is checking in N day(s) early (scheduled MMM DD). Stay extends to X nights; additional ₱Y at ₱rate/night will reflect on the bill. Proceed? [Yes, Check In Early / Cancel]”.

## 4. Verification
- `eslint` touched files; `npm run build` 97/97.
- Manual: booking dated Oct 14 → check in Oct 12 → Yes/No dialog with N=2, amount=2×rate → confirm → Checked In, billing nights +2, no duplicate incidental rows; Cancel aborts cleanly; conflicting room in gap → 409; same-day flow unchanged.

## 5. Risks
- No-incidental design hinges on billing auto-extending via rewritten `checkInDateTime` (verified in code); will assert bill math in manual test (nights +2, single room-charge line).
- Past-date (late) check-ins unaffected (still allowed as today).

## 6. Questions
- Q1: No hourly early fee on the advance arrival day, nights only (recommended)?
- Q2: Add the same advance dialog to the bookings-list check-in (recommended, both entry points consistent)?
