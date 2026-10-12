# Implementation Plan — Red Cancel + blue confirm on guest destructive dialogs (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Request (Image 1)
Guest Cancel Booking dialog: left **Cancel** button red filled, right **Yes, Cancel** button blue filled.

## 2. Approach (scoped, no shared-component change)
- `ModalDialog` already maps `confirmVariant='primary'` → blue confirm and `cancelVariant='danger'` → red cancel. `showConfirm` already forwards both variants.
- Change only the two destructive guest callers (`handleCancelBooking`, `handleCancelReservation`) to pass `('primary', 'danger', 'Yes, Cancel')`. Checkout-request and all other dialogs keep current colors. No global CSS or shared-component edits.

## 3. Verification
- Visual: Cancel red left, Yes-Cancel blue right, both themes; other dialogs unchanged; `npm run build` passes.

## 4. Risks
- Minimal: two call-site arg changes.

## 5. Questions
- Q1: Proceed scoped to the two cancel dialogs, or apply red-cancel/blue-confirm to all guest dialogs?
