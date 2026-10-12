# Implementation Plan — Confirm button label (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Request (Image 1)
Guest Cancel Booking dialog: right button text "Yes, Cancel" → "Confirm". Colors/order unchanged (red Cancel left, blue Confirm right).

## 2. Proposed changes (only `GuestDashboardClient.js`, 2 strings)
- `handleCancelBooking` + `handleCancelReservation` confirm labels `'Yes, Cancel'` → `'Confirm'`.

## 3. Verification
- Visual check; `npm run build` passes.

## 4. Risks
- None: text-only.

## 5. Questions
- Q1: Proceed?
