# Implementation Plan — Remove Finalize + Open Terminal buttons (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User request
- Remove `Finalize Bill` and `Open Payment Terminal` buttons from the bill dialog ([Image 1]); paying happens in the Payments tab.

## 2. Evidence
- `BillingTab.js` Step 1 (`!isSettled`, `!isFinalized`): green Finalize + disabled terminal button.
- Step 2 (finalized): amber “Ready for Settlement” alert + blue Open Payment Terminal link + Record Walk-in Payment + disabled Complete.
- Finalize stays reachable elsewhere (bookings page finalize flow + API), so online-payment unlocking isn't orphaned.

## 3. Proposed changes (only `BillingTab.js`)
1. Step 1: replace both buttons with a muted hint: “Review the statement here, then switch to the Payments tab to settle.”
2. Step 2: remove the Open Payment Terminal link; reword alert to point at the Payments tab; keep Record Walk-in Payment + disabled Complete (not asked to remove).
3. Remove now-dead `handleFinalizeBill` + `finalizingBill` state if unreferenced elsewhere in the file (verify via grep; keep if used).

## 4. Verification
- `grep Finalize Bill|Open Payment Terminal` in BillingTab → zero (except alert copy); `eslint`; `npm run build` 97/97.
- Visual: no dead buttons; Payments tab settles normally.

## 5. Risks
- Low: button/handler removal; finalize path preserved via bookings page. Note: staff flow becomes review → Payments tab; guest online payment still requires finalize elsewhere.

## 6. Questions
- Q1: Proceed as specced (keep Record Walk-in Payment)?
