# Walkthrough — Remove Finalize + Open Terminal buttons

## Changes (`BillingTab.js` only)
- Step 1 (unfinalized): buttons replaced with a muted hint pointing at the Payments tab.
- Step 2 (finalized): Open Payment Terminal link removed; alert reworded toward the Payments tab; Record Walk-in Payment + Complete kept.
- Deleted dead `handleFinalizeBill` + `finalizingBill` state. Finalize remains available via bookings page + API.

## Verification
- `grep`: zero button/handler remnants. `eslint`: no new issues. `npm run build`: exit 0.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
