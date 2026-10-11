# Walkthrough — Booking parity with Reservation

## Changes (only `app/receptionist/bookings/page.js`)
1. **Save gated on schedule conflict (no toast):**
   - Added derived `createScheduleConflict` / `updateScheduleConflict` / `activeScheduleConflict` + `isSaveDisabledByConflict` (after `selectedRoomObj` ~line 1785), using same effective times as submit handlers; update path excludes own `bookingID`.
   - Added inline red `Schedule Conflict` alert above Stay Schedule section (parity with Reservation).
   - `LoadingButton` Save now has `disabled={isSaveDisabledByConflict}` + tooltip title. `LoadingButton` already supports `disabled`.
   - Submit guards in `handleCreateSubmit` / `handleUpdateBookingSubmit` kept as race safety net but now silent `return` (removed `showAlert` toast for conflict).

2. **Guest Details locked on selected UID:**
   - Added `const detailsLocked = Boolean(formData.guestID)`.
   - Lock banner when `formData.guestID` set: “Details are locked to the selected guest account...”
   - `disabled={detailsLocked}` + lock title on First/Middle/Last, Contact, Email, Birthdate (`DateInput` supports `disabled`).
   - `handleUidChange` clear path now resets `guestForm` to blank (was leaving stale autofill), parity with Reservation.
   - Applies to both New Booking and Update Booking (shared state).

## Verification
- `grep` confirms 6 locked inputs + conflict gating wired.
- `eslint app/receptionist/bookings/page.js`: only pre-existing `set-state-in-effect` / `exhaustive-deps` warnings/errors, no new errors referencing new vars.
- Manual test needed: select UID → locked; clear → editable; pick conflicting room/dates → alert + Save disabled; resolve → enabled.

## No commit/push
Per workflow: no commit or push made. Awaiting explicit `push` keyword after your review.
