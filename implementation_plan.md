# Implementation Plan — Reservation Guest Search + Details Lock

## 1. Root causes (verified)
1. **Typing disappears**: `SearchableSelect`'s sync effect depends on `[value, options]`, but parents build `options` inline (`guests.map(...)`), so every parent re-render (incl. the 5s poll) gives a new array identity, reruns the effect, and overwrites the in-progress `searchTerm` + clears `isTyping`. Fix in the shared component: only resync when `value` actually changed (prev-value ref), ignoring options-identity churn.
2. **Lock on select**: add `detailsLocked = Boolean(formData.guestID)`; `disabled` on the 6 detail inputs (first/middle/last/contact/birthdate/email) with a "locked to account" hint; clearing the UID resets the form to blanks (currently stale autofill lingers, editable). Validation still passes (values present; disabled skips browser checks).

## 2. Files
- `app/components/SearchableSelect.js` (effect guard — fixes all 6 usages).
- `app/receptionist/reservations/page.js` (lock + clear-reset; create + edit share the form).

## 3. Verify
- `npx eslint` (stash-compared) + `npm run build`; staging: type mid-poll without loss, select locks, clear unlocks blank.
- Commit/push only on `"push"`.
