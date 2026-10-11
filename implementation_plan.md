# Implementation Plan — Booking parity with Reservation (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User requests
1. **Booking conflict UX:** Don't rely on toast for schedule conflict. Make `Save Booking & Record Down Payment` not clickable when there is a schedule conflict, just like Reservation (`Place Courtesy Hold` / `Update Reservation` disabled pattern).
2. **Booking guest lock:** When a guest account (UID) is selected in Booking, Guest Details fields should not be editable — same as Reservation (`detailsLocked`).

## 2. Evidence / current state
- Booking file: `app/receptionist/bookings/page.js`
  - Create submit conflict guard `handleCreateSubmit` lines ~1283-1299: calls `checkScheduleConflict(...)` then `showAlert('error','Schedule Conflict',...)` + `return`. This is the toast the user wants to remove/replace.
  - `checkScheduleConflict(roomId, inDate, outDate, inTime, outTime, currentBookingId)` lines ~1694-1754: returns object or null. Reservation version returns boolean. Both check `roomSchedules` + bookings overlap `sIn < reqOut && sOut > reqIn`.
  - Save button lines ~3144-3157: `LoadingButton` with only `isLoading`, no `disabled` for conflict. `LoadingButton` (`app/components/LoadingButton.js:10-26`) already supports `disabled` prop (`disabled={disabled || isLoading}`), so parity is trivial.
  - Guest details inputs lines ~2325-2404: `firstName/middleName/lastName/contact/DateInput/email` are always editable. No `detailsLocked`. `handleUidChange` lines ~227-246: on clear only sets `isAutoFilled(false)`, leaves stale `guestForm` values (Reservation clears to blank).
  - Room dropdown lines ~2440-2448 filters with `isRoomAvailableForDates(...)` (hides conflicted rooms), but user can still pick dates after room that cause conflict — hence button-disable + inline alert still needed.
- Reservation reference: `app/receptionist/reservations/page.js`
  - `detailsLocked = Boolean(formData.guestID)` line 194; inputs use `disabled={detailsLocked}` + `title='Locked...'` lines 1515-1614; lock banner lines 1501-1506; badge `Account Linked / Walk-In Entry` lines 1497-1499.
  - Conflict UI: inline `alert-danger` lines 1775-1780 + button `disabled={Boolean(formData.roomID && resDate && checkScheduleConflict(...))}` line 1960. Submit guards lines ~747, 852 set `errors.conflict`.
  - `handleUidChange` lines 161-191 clears `guestForm` on empty UID.

## 3. Proposed changes (only `app/receptionist/bookings/page.js`, no API changes)
### A. Conflict → disable Save (create + update)
- Add derived memo/const in render scope (before return, near `selectedRoomObj` line ~1787):
  - `createConflict` for `activeModal==='create'`: `Boolean(formData.roomID && checkInDate && checkOutDate && checkScheduleConflict(formData.roomID, checkInDate, checkOutDate, useCurrentTimeIn ? currentTimeStr : checkInTime, checkOutTime))`
  - `updateConflictCheck` for `activeModal==='update_booking'`: same but pass `updatingBooking?.bookingID` as exclusion, using `updateUseCurrentTimeIn` equivalent if applicable (booking update modal currently has no “use current time” checkbox — confirm; else reuse `checkInTime/checkOutTime`).
- Add inline conflict alert above schedule/calendar section (copy Reservation style):
  - Condition: same as disabled condition. Message: `Schedule Conflict: Room X is already booked or reserved during this schedule ... Please select another room or adjust the dates.` Reuse conflict object’s `type/id/checkIn/checkOut` if available.
- `LoadingButton` Save:
  - `disabled={activeModal==='create' ? Boolean(createConflict) : Boolean(updateConflictCheck)}`
  - Add `title={conflict ? 'Schedule conflict — select another room or dates' : ''}` for affordance.
- Keep submit-time `checkScheduleConflict` guard as safety net (race if schedules refresh between render/submit), but **remove `toast`/`showAlert` for this path** per request (silent `return`, inline alert already visible). Alternatively keep `showAlert` only as fallback — needs user decision (see Q1).
- No changes to `checkScheduleConflict` logic itself.

### B. Guest Details lock on selected UID
- Add `const detailsLocked = Boolean(formData.guestID);` near `selectedRoomObj` (parity with Reservation line 194).
- When `detailsLocked`:
  - Show lock banner under `Guest Details` header (copy Reservation lines 1501-1506): `Details are locked to the selected guest account. Clear the account above to enter a walk-in manually.`
  - Set `disabled={detailsLocked}` + `title='Locked to the selected guest account'` on: First/ Middle/ Last Name, Contact, Email, and Birthdate `DateInput` (verify `DateInput` forwards `disabled`; if not, wrap with `fieldset disabled` or pass through — check `app/components/DateInput.js` during implementation).
  - Keep `SearchableSelect` enabled so user can clear to unlock.
  - Update badge already exists (`Account Linked / Walk-In Entry` lines 2320-2322) — keep.
- Fix `handleUidChange` clear path to reset `guestForm` to blank defaults (parity with Reservation lines 164-176), not just `isAutoFilled(false)`.
- Apply to both `create` and `update_booking` modals (shared `guestForm` state). `openUpdateBookingModal` / `handleRebook` set `isAutoFilled(Boolean(b.guestID))` — locked state derives from `formData.guestID` so it will lock automatically.
- No validation logic changes; locked fields still submit via `guestForm`.

## 4. Verification
- Manual UI: (1) select guest UID → fields disabled + lock banner; clear UID → editable + blank. (2) pick room + overlapping dates → red conflict alert appears + Save disabled with tooltip; change room/dates → enabled. (3) update modal with same-room overlapping other booking → disabled; same booking’s own schedule excluded.
- `npm run lint` (or project eslint cmd) + `npm run build` smoke if cheap; no new deps.
- No DB/API changes; server-side conflict validation untouched.

## 5. Risks / notes
- `DateInput`/`FlatDatePicker` disabled forwarding must be verified; fallback is `pointer-events:none + opacity` wrapper — will confirm during implementation.
- Update modal currently lacks `useCurrentTimeIn` toggle (`updateUseCurrentTimeIn` state exists but no checkbox wired in modal?) — conflict check must use the same effective times as submit to avoid disabled/submit mismatch. Will align.
- Removing toast entirely means screen-reader users rely on inline alert + disabled title; keep `aria-disabled` semantics via native `disabled`.

## 6. Questions for user
- Q1: On conflict submit race (schedules refresh after render), should we fully remove toast/silent-return, or keep a silent fallback `showAlert` only for that race?
- Q2: Apply Save-disable + lock to **both** New Booking and Update Booking modals, or New Booking only?
