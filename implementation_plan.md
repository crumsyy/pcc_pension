# Implementation Plan — Guest confirm dialogs rendering as toasts (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Root cause (verified)
- Guest `showConfirm` sets `type: 'warning'`, but shared `ModalDialog` only renders a real Yes/No dialog when `type === 'confirm'` — every other type is converted to a **toast**.
- Worse, the toast path **auto-executes the callback**: dismissing/ignoring the "Are you sure?" toast still runs the cancellation (the X does nothing; the booking is already cancelled). So there is effectively zero Yes/No validation today.
- Affects all guest `showConfirm` callers (cancel booking, cancel reservation, checkout request, payments), not just cancel booking.

## 2. Proposed changes (only `GuestDashboardClient.js`)
- `showConfirm` sets `type: 'confirm'` (keep `confirmText: 'Confirm'/'Yes, Cancel'` wording per caller if needed) so `ModalDialog` renders the blocking dialog with Cancel/Confirm buttons; non-dismissable backdrop already enforced by the component.
- Success/error result toasts (`showAlert`) unchanged.
- Same one-line pattern fix verified for reservation-cancel path (shared helper).

## 3. Verification
- Manual: cancel booking/reservation/checkout now opens a blocking Yes/No dialog; Cancel closes with no API call; Confirm executes once with spinner.
- `grep "type: 'warning'"` in guest showConfirm path → gone; `npm run build` passes.

## 4. Risks
- Low: single helper change; all callers already written expecting a dialog. Not touching receptionist portals in this change (flagged as follow-up if same pattern exists there).

## 5. Questions
- Q1: Proceed? Q2: Confirm button label — keep "Confirm" or use explicit "Yes, Cancel" on destructive actions?
