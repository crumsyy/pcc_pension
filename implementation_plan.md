# Implementation Plan — Stop billing auto-refresh jump (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Problem
- Bill dialog re-renders every ~6s (poll) + on focus; each cycle flashes the loading placeholder, destroying modal scroll position.

## 2. Proposed changes (billing workspace only)
1. `BillingTab.js`: gate the 6s interval + focus/visibility/custom-event background refetches so they skip while the bill dialog or any sub-modal (discounts, incidental, damage, settle) is open. Explicit refetches stay: on dialog open, after every mutation, manual refresh.
2. Silent background refetch: poll-driven `fetchBillingDetails` no longer sets `loadingBill` (no placeholder flash); loading state only for user-initiated opens.
3. `PaymentTerminal.js` (dialog-embedded use): same silent treatment for its bill refetch; GCash pending-payment poll untouched.

## 3. Verification
- `eslint`; `npm run build` 97/97.
- Manual: open bill, scroll mid-statement, wait 30s + switch windows — no jump, no flash; add discount/incidental → numbers update once via mutation refetch.

## 4. Risks
- Low: refresh triggers narrowed, never removed; worst case is data up to one poll older while a dialog is open, refreshed on close/action.

## 5. Questions
- Q1: Proceed billing-only as specced?
