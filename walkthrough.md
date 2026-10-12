# Walkthrough — A2 ordering fix + editable headcount

## Changes
- `app/receptionist/billing-checkout/BillingTab.js`
  - Moved A2 Occupancy & Capacity directly after A1 Guest & Booking Details (order now A1 → A2 → B1 → B2 → C1 → D1–D4).
  - A2 now editable: pen button beside Number of Guests opens Update dialog (capacity max + current shown, 1–20 input, Cancel/Save). Save validates, blocks reducing below discount beneficiaries, refetches bill to recalculate split/fees/discounts.
  - C1 Applied Discounts keeps the single Apply/Edit Discounts entry point.
- `app/api/receptionist/billing/route.js`
  - New `update_guest_count` action: validates 1–20, blocks below beneficiary count, updates booking + linked reservation, writes audit log.

## Verification
- `npm run build` → success.
- Manual: open Billing → A2 pen → Cancel closes unchanged; Save valid number → headcount, per-guest share, capacity badge, totals update; Save 0/invalid blocked; Save below beneficiaries blocked.
