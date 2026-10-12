# Walkthrough — Stop billing auto-refresh jump

## Changes
- `BillingTab.js`
  - New `isBillingModalOpen` (view dialog, discounts, incidental, damage, settle): 6s poll + focus refetch skip while open; explicit custom-event refresh still honored.
  - `fetchBillingDetails(bID, silent=true)`: no loading-placeholder flash on background/mutation refetches; skeleton only on fresh opens (View click, deep-link).
- `PaymentTerminal.js`: same silent default; skeleton only when switching to an unfetched bill (tracked `billedIdRef`); GCash poll flows untouched.

## Verification
- `eslint`: no new issues. `npm run build`: exit 0.

## Manual to confirm
- Open a bill, scroll mid-statement, wait 30s + switch windows: no jump, no flash; edit discounts/incidentals → single update via mutation refetch.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
