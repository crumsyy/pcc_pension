# Walkthrough — Billing filter labels + full Inter font

## Changes
- `app/receptionist/billing-checkout/BillingTab.js`
  - Stay filter tabs now `All` / `Booked` / `Occupied` / `Completed` (ids `all/booked/occupied/completed`).
  - `BOOKED_STATUS_LIST = [Pending, Pending Check-in, Confirmed, Booked]`; `OCCUPIED_STATUS_LIST` = in-house + finalizing/bill-ready/paid-awaiting-checkout states (Checked In, Active Stay, Late Checkout, verification/checkout-request states, Bill Finalized, Final Billing Updated, Payment Completed, Paid); completed unchanged.
- `app/globals.css`
  - Inter import extended with `800` weight for headings.
  - New override: headings (`h1-h4`, `.display-font`) inside `.pcc-main-wrapper` (receptionist) and `.guest-portal` render Inter. Admin/auth keep Fraunces.
- `app/guest/layout.js`: wraps children in `<div className="guest-portal">` to scope the override.

## Verification
- `grep`: old `upcoming/active` filter keys gone from BillingTab; override selectors present in CSS.
- `eslint`: same 4 pre-existing issues only; no new warnings.
- `npm run build`: success.
- Visual to confirm: four short tabs; receptionist + guest headings in Inter (no serif).

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
