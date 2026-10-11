# Walkthrough — Nights-only advance check-in charges

## Changes
- `api/receptionist/bookings/route.js`: advance branch no longer computes/charges the hourly early fee — dialog shows extra night(s) × room rate only; title simplified to `Advance Check-In Notice`. Same-day-before-2PM hourly flow untouched.
- `checkin/page.js`: fallback dialog text updated to match (nights extend, auto-billed).

## Verification
- `eslint`: no new issues. `npm run build`: exit 0.
- Manual to confirm: 2-days-early arrival → dialog shows only `2 night(s) at ₱2100 (₱4200)`; confirm → no early-fee incidental, billing nights +2.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
