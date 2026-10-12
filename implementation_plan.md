# Implementation Plan — Single toast per booking flow (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User request
- Booking-create fires two identical “Booking Created” toasts ([Image 1]); trigger only one.

## 2. Evidence
- `bookings/page.js:1479-1480` (success) and `1486-1487` (catch): direct `toast.success/error` + `showAlert` (which itself toasts). Same doubles at update (~517), check-in (~1535), check-out (~1575), cancel (~1621) — each paired with an adjacent `showAlert`.

## 3. Proposed changes (only `bookings/page.js`)
- Remove the direct `toast.success`/`toast.error` line wherever an adjacent `showAlert` already fires on the same path (create/update/check-in/check-out/cancel, success + catch). Keep `showAlert` (matches reservations convention).
- Safety: any `toast.*` without an adjacent `showAlert` on its path is kept as-is — single trigger either way. `toast` import stays.

## 4. Verification
- `grep toast.success|toast.error` shows only single-fire lines; `eslint`; `npm run build` 97/97; manual create → one toast + receipt modal.

## 5. Risks
- None: deletion of redundant fires only; titles/copy come from the kept `showAlert` calls.

## 6. Questions
- Q1: Proceed (all five flows, not just create)?
