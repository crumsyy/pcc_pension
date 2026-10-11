# Walkthrough — Advance check-in allowed with charge confirmation

## Changes
- `api/receptionist/bookings/route.js` (`checkin` action)
  - Removed the hard 400 block for before-date check-ins. Now computes `advanceNights` + `additionalRoomCharge` (nights × room rate) and, if arriving before 2PM, the hourly early fee; returns `requiresAdvanceCheckInConfirmation` (title/message/amounts) when unconfirmed.
  - Split confirm flags (`confirmEarlyCheckIn` vs `confirmAdvanceCheckIn`, OR-tolerant for old clients); added `checkOutDateTime` to the booking lookup.
  - New gap guard: confirmed advance check-in 409-conflicts if another booking/reservation holds the room between today and checkout (prevents double-booking; old guard only saw in-house statuses).
  - No night incidental is recorded (stay auto-extends via rewritten `checkInDateTime`, so billing picks up extra nights — incidental would double-charge); hourly early fee still recorded as incidental.
- `bookings/page.js` `handleCheckIn`: sends `confirmAdvanceCheckIn` + new Yes/No advance dialog branch (3-arg `showConfirm` per this file's signature). Check-In/Out page needed no change (already wired).

## Verification
- `eslint`: no new issues. `npm run build`: exit 0.
- Manual to confirm: Oct-14 booking → check in Oct 12 → dialog shows 2 nights + amount (+hourly fee if before 2PM) → Yes: Checked In, billing nights +2, exactly one early-fee incidental, zero night incidentals; Cancel aborts; gap conflict → 409; same-day flows unchanged.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
