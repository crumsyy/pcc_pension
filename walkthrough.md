# Walkthrough — Hierarchical SOA (phases A–D) + requested fixes

## Changes (only `app/receptionist/billing-checkout/BillingTab.js`)

### Hierarchy: 4 phases, step-by-step
- **Phase A — Stay Context:** A1 Guest & Booking Details, A2 Occupancy & Capacity (headcount only, view-only).
- **Phase B — Room & Package:** B1 Room Rent Charges (table only), B2 Breakfast Package (complimentary line + schedule dates moved out of Occupancy into here).
- **Phase C — Discounts:** C1 Applied Discounts — single home for split-per-guest box (moved here from Room Rent) + beneficiary badges + the ONE Apply/Edit Discounts button (moved here from Occupancy).
- **Phase D — Extras & Condition:** D1 Orders (renamed), D2 Inspection, D3 Incidentals, D4 Borrowed.
- New `PhaseLabel` divider (A/B/C/D) + `SectionHeader` with lettered numbers (A1, B1, B2, A2, C1, D1–D4), Editable/View-only badge, one-line hint. No icons.

### Requested fixes
- Discount split box now inside Applied Discounts, not under Room Rent.
- Breakfast info now under Room Rent (B2), not inside Occupancy.
- `Orders & Room Service` → `Orders`.
- Icons removed from Billing labels: section header icons, coffee-cup, calendar, tag, user-check, calculator glyphs. Buttons keep plain text (Apply/Edit, + Add Incidental stay text-only).

## Verification
- `grep icon="bi|fa-tags|fa-user-check|fa-calculator|bi-cup|bi-calendar|bi-tag|Orders & Room` → zero hits.
- `npm run build` → success.
- No logic/API changes; Payments tab untouched.
