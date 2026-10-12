# Walkthrough — User-friendly SOA with editable vs view-only sections

## Changes (only `app/receptionist/billing-checkout/BillingTab.js`)

### A. Right totals card truly read-only (Image 1 fix)
- Removed `Edit / Adjust Guest Discounts` / `Apply Senior Citizen / PWD Discount` button from `Bill Totals Summary (Read-Only)`.
- Replaced with hint text: `To modify discounts, use Apply / Edit Discounts in the Billing statement (Section 3).`
- Single discount entry point remains: `Apply / Edit Discounts` in Section 3 Occupancy header.

### B. Shared `SectionHeader` (number + icon + Editable/View-only badge + hint)
- `1 · Guest & Booking Details` — View only — booking record, cannot edit here.
- `2 · Room Rent Charges` — View only — auto-computed rate × nights.
- `3 · Occupancy & Capacity` — Editable, keeps Apply/Edit button.
- `4 · Breakfast Schedule` — View only — from booking package.
- `5 · Applied Discounts` — Editable via Section 3.
- `6 · Orders & Room Service` — View only, total badge kept.
- `7 · Room Check-Out Inspection` — Editable, tick/untick to bill.
- `8 · Incidental & Damage Charges` — Editable, keeps Add button.
- `9 · Borrowed Room Items & Amenities` — Editable (when present).

### C. Structural clarity (Image 2 fix)
- Discount apportionment moved out of Room Rent table into standalone yellow box below table.
- Sections separated with spacing; empty states keep headers visible.

## Verification
- `grep Edit / Adjust` → zero buttons in totals card; one entry point in Section 3.
- `npm run build` → success.
- No logic/API changes; Payments tab untouched.
