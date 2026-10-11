# Implementation Plan — Nights-only advance check-in charges (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Agreed rule (from Plan discussion)
- Before scheduled date → extra night(s) at room rate only, no hourly fee (the extra night already buys those 24h; hourly on top is double-charging).
- On scheduled date before 2PM → hourly fee only (unchanged existing flow).

## 2. Proposed changes (`api/receptionist/bookings/route.js` only)
1. Advance branch: remove `earlyHours`/`earlyFee` computation (keep them 0); dialog `message` drops the “plus an early check-in fee…” clause; response still includes `earlyHours: 0, earlyFee: 0` so both clients render unchanged.
2. Keep the early-fee incidental insert as-is (now only reachable with `earlyFee > 0` from the same-day branch).
3. No client changes needed (both dialogs render server text); no same-day changes.

## 3. Verification
- `eslint`; `npm run build` 97/97.
- Manual: 2-days-early check-in → dialog shows nights + amount only; confirm → one early-fee incidental only if same-day-before-2PM, zero otherwise; billing nights +2.

## 4. Risks
- None: pure subtraction; same-day flow untouched.

## 5. Questions
- Q1: Proceed?
