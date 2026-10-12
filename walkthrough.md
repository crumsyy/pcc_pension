# Walkthrough — No page tabs, Payment History beside status filters

## Changes
- `WorkspaceClient.js`: page-level Billing/Payments tabs + `?tab=` sync removed; page renders Guest Billing list only. `?bookingID=` deep-links still open the bill dialog (which keeps its own Billing/Payments tabs for per-stay paying + checkout).
- `BillingTab.js`: Payment History button added beside All/Booked/Occupied/Completed filters; history state + `paymentHistory` from existing `/api/receptionist/payments` fetch (fresh + cached) + identical history modal (search/method/date filters, table) moved in.
- `PaymentsTab.js`: deleted (standalone POS retired; walk-ins flow via reservation/booking into Billing list).
- `receptionist/payments/page.js`: legacy redirect no longer forces `?tab=payments`; passes through remaining params (e.g. `bookingID`).

## Verification
- `npm run build` → success.
- Manual: page shows no tab bar; history button beside filters opens same modal; bill dialog tabs unchanged; legacy `/receptionist/payments?bookingID=X` lands on Billing with bill open.
