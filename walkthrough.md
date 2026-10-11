# Walkthrough — Form Wipe on Poll (Real Fix) (no commit/push yet)

## Cause (my first fix couldn't work — owning that)
The search component was innocent: a parent effect (`[activeModal, guests, minResDate]`) re-ran on **every background guests refetch** and blanked `guestID`, the details, dates, and room — wiping the UID box, the lock, and the whole in-progress form every few seconds. One targeted disable-comment added (same pattern the repo already uses).

## Fix (`app/receptionist/reservations/page.js` only)
- Init/clear effect now runs only on modal open/close transitions (`prevModalRef`); data churn while open is ignored.
- Deep-link `?action=new` prefill preserved via one-shot flag (previously also wiped on open/poll).
- Edit-modal path untouched (imperative prefill, never wiped).

## Verification (actually performed)
- `npx eslint`: 7 problems = baseline (one justified disable added, zero new findings). `npm run build`: 97/97.
- Staging proof needed: open create, type UID, wait 15s+ through polls — selection, text, dates, room must all survive; deep link still prefills.

Say `"push"` only when you want commit + push.
