# Walkthrough — Button-free Billing tab + titled Statement of Account

## Changes (only `app/receptionist/billing-checkout/BillingTab.js`)

### A. Billing = view + modify only
- Deleted `openRecordPaymentModal` / `openSettleBillModal` + `handleSettleBillSubmit` (counter-payment logic).
- Deleted `handleCompleteBooking` / `handleCheckOutGuest` (checkout now owned by Payments `PaymentTerminal`).
- Deleted full `SETTLE BILL MODAL` JSX ("Record Walk-in Counter Payment").
- Fixed `isBillingModalOpen` (removed undefined `isSettlingBill` ref). This also fixes a runtime crash: those states were referenced but never defined.
- Kept modify controls: Apply/Edit Discounts (x2), Add/Delete Incidental, amenity inspection checkbox + qty, Report Lost/Damaged, discount modal editors.
- Kept `paymentMethods` state (passed to Payments tab).
- Billing right panel already showed info-only alerts ("Switch to the Payments tab to settle", "Complete checkout in the Payments tab") — kept as-is.

### B. Statement of Account titles (style-matched `h6`)
- `Guest & Booking Details` (was untitled grid).
- `Room Rent Charges` (kept).
- `Applied Discounts — Per-Guest Apportionment` (was "Discount Apportionment:").
- `Occupancy & Capacity` section + `Occupancy Details` sub-header (was "Stay Occupancy & Capacity").
- `Breakfast Schedule (N Days)` (was emoji "🍳 Scheduled Breakfast Mornings").
- `Applied Discounts` header above beneficiary badges.
- `Orders & Room Service` (was "Orders").
- Kept `Room Check-Out Inspection`, `Incidental & Damage Charges`, `Borrowed Room Items & Amenities`.
- Right panel: `Payment Summary` → `Bill Totals Summary (Read-Only)` + caption "Pay or complete checkout in the Payments tab."

## Verification
- `grep isSettlingBill|settleForm|handleSettleBill|openRecordPaymentModal|handleCompleteBooking|Record Walk-in` in BillingTab.js → zero hits.
- `npx eslint BillingTab.js` → 2 pre-existing errors only (refs during render line 95, set-state-in-effect line 411 — untouched by this change).
- `npm run build` → success, all routes compiled (billing-checkout included).
- No API/logic changes; Payments tab untouched.

## How to review
1. Open receptionist billing-checkout → select a stay → Billing tab: confirm zero pay/complete buttons, only modify buttons (discounts/incidentals/damage).
2. Confirm each statement block has a clear title.
3. Switch to Payments tab: confirm paying + Complete Booking still work.
