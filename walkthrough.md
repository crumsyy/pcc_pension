# Walkthrough — Guest Search Typing + Details Lock (no commit/push yet)

## Fixes
1. **Typing no longer disappears** (`app/components/SearchableSelect.js`): the sync effect only resyncs when the selected value actually changes (prev-value ref), ignoring options-array identity churn from parent re-renders/polling. Fixes all 6 usages (reservations, bookings, orders, inquiries, payments, reservation form).
2. **Details lock on select** (`app/receptionist/reservations/page.js`): all 6 detail inputs disable with tooltips + a lock notice when a guest account is linked; clearing the account resets to a blank walk-in form (no stale autofill). Validation still passes on autofilled values; if a linked record is itself invalid, clear-and-type-manually is the escape hatch. Applies to create + edit (shared form).

## Verification (actually performed)
- `npx eslint`: 7 problems before = 7 after (pre-existing). `npm run build`: 97/97.

Say `"push"` only when you want commit + push.
