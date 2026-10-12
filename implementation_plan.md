# Implementation Plan — Remove page tabs, Payment History beside status filters (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Agreed scope (from Plan-mode discussion)
- Page-level Billing/Payments tabs are redundant: bill dialog already has its own Billing/Payments tabs for per-stay paying + checkout.
- Walk-ins flow through reservation/booking → always appear in Billing list → no standalone POS needed.
- Payment History button moves beside All/Booked/Occupied/Completed status filters (not header).

## 2. Changes
- `WorkspaceClient.js`: delete page-level `Tabs/TabList/TabPanel` + `?tab=` sync; render `BillingTabContent` only. `?bookingID=` deep-links keep working.
- `BillingTab.js`: add Payment History button at right end of status-filter row; add history state + fetch (`paymentHistory` from `/api/receptionist/payments`, same endpoint already used) + existing history modal JSX (search/method/date filters, table) moved from `PaymentsTab.js`.
- `PaymentsTab.js`: standalone page retired (file left in place, unused by page; dialog uses `PaymentTerminal` directly — untouched).

## 3. Verification
- Zero tab bars on page; history button beside filters opens identical modal.
- Bill dialog Billing/Payments tabs unchanged; `npm run build` passes.

## 4. Questions
- Q1: Proceed?
