# Implementation Plan — Button-free Billing tab + titled Statement of Account (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User request (Image 1)

1. **No action buttons in Billing:** Billing tab = view + modify billing only. All paying (Record Walk-in / counter payment) and Complete Booking (checkout) live in the Payments tab.
2. **Clear per-section titles in Statement of Account:** each block gets an explicit title so users know "this section is guest and booking details, etc."

## 2. Current state (verified in `app/receptionist/billing-checkout/BillingTab.js`)

- Visible Billing-tab Payment Summary panel (lines ~1550–1606) already shows **info alerts only** (checked-out info, overpaid warning, "Switch to the Payments tab to settle", "Complete checkout in the Payments tab") — no visible pay/complete buttons. Matches the screenshot's intent, screenshot is from an older build.
- **Dead/broken code still present** that must be removed:
  - `openRecordPaymentModal` / `openSettleBillModal` (lines 120–132), `handleSettleBillSubmit` (134–179) reference `setSettleForm`, `setIsSettlingBill`, `isSettlingBillPayment` — none of these states are defined → runtime crash if invoked.
  - `handleCompleteBooking` / `handleCheckOutGuest` (355–392) references undefined `setCheckingOut`.
  - `isBillingModalOpen` (499–506) references `isSettlingBill`.
  - Full `SETTLE BILL MODAL` JSX (lines 2013–2164, "Record Walk-in Counter Payment") references `isSettlingBill`, `settleForm`, `isSettlingBillPayment` — all undefined.
  - `paymentMethods` state is still needed (passed to `PaymentTerminal` in Payments tab) — keep it.
- `PaymentTerminal.js` (used in Payments `TabPanel`) already owns paying + Complete Booking (Zero Balance) flows — no changes needed there.
- Statement sections lack consistent titles:
  - Guest/stay grid (lines 785–807) has **no title**.
  - `Room Rent Charges` (line 810) — titled, keep.
  - Discount apportionment row (833–851) — inline "Discount Apportionment:" only, no section header.
  - `Stay Occupancy & Capacity` (937) — titled but booking-jargon; clarify.
  - Scheduled breakfast mornings block (1013–1027) — emoji label `🍳 Scheduled Breakfast Mornings`, style mismatched.
  - Applied Discounts breakdown (1033–1051) — small label, not `h6`-matched.
  - `Orders` (1055), `Room Check-Out Inspection` (1167), `Incidental & Damage Charges` (1270), `Borrowed Room Items & Amenities` (1330) — already titled, keep wording consistent.
  - Right panel header `Payment Summary` (1379) — misleading in a button-free Billing tab (implies paying here).

## 3. Proposed changes (only `BillingTab.js`, subtractive + titles)

### A. Billing = modify-only (delete ~150 lines, fix crash)
1. Delete `openRecordPaymentModal` / `openSettleBillModal`, `handleSettleBillSubmit`.
2. Delete `handleCompleteBooking` / `handleCheckOutGuest` (Payments tab owns checkout).
3. Delete entire `SETTLE BILL MODAL` JSX block.
4. Fix `isBillingModalOpen` to drop `isSettlingBill` reference.
5. Keep `paymentMethods` state + pass-through to Payments tab.
6. Reword balance-due alert to settle-in-Payments only (already correct at line 1590: "Switch to the Payments tab to settle this bill." — keep).
7. **Kept modify controls (these are NOT action buttons):** `Apply / Edit Discounts` (occupancy header + Payment Summary discount card), `+ Add Incidental Charge`, incidental delete, amenity inspection checkbox + lost-qty input, `Report Lost/Damaged`, discount modal Add/Remove/Apply & Recalculate.

### B. Statement of Account — add style-matched `h6` titles (same `fw-bold text-dark mb-1 border-bottom pb-1`, `fontSize 0.82rem`)
1. Guest/stay grid → `Guest & Booking Details`.
2. Keep `Room Rent Charges`.
3. Discount apportionment row → retitle inline label to `Applied Discounts — Per-Guest Apportionment` (keeps existing breakdown list).
4. `Stay Occupancy & Capacity` → `Occupancy & Capacity` (clearer, keeps icon + Apply/Edit button).
5. Breakfast mornings block → `Breakfast Schedule` (replace 🍳 emoji header, keep date badges).
6. Discount beneficiaries block → `Applied Discounts` (promote existing label to full `h6`).
7. Keep `Orders` → expand to `Orders & Room Service` (matches empty-state copy "No room service or product orders…").
8. Keep `Room Check-Out Inspection — Ordered Non-Consumable Amenities`, `Incidental & Damage Charges`, `Borrowed Room Items & Amenities` (verify consistent title-case).
9. Right panel header `Payment Summary` → `Bill Totals Summary (Read-Only)` + sub-caption `Pay or complete checkout in the Payments tab` so users don't look for buttons here.

No logic, calculation, or API changes. Pure JSX text + deletion.

## 4. Verification
- `grep -n "isSettlingBill\|settleForm\|handleSettleBill\|openRecordPaymentModal\|handleCompleteBooking\|Record Walk-in\|Complete Booking (Balance" app/receptionist/billing-checkout/BillingTab.js` → zero hits (except Payments-tab pointer strings).
- `npm run lint` / `eslint`; `npm run build` passes.
- Visual: Billing tab shows zero pay/complete buttons; every statement block has a titled header; Payments tab still settles + completes unchanged.

## 5. Risks
- Low-medium: sizable deletion but purely subtractive; pay/complete paths already proven in Payments tab. Rollback = revert commit.

## 6. Questions
- Q1: Proceed exactly as above?
- Q2: Accept right-panel rename to `Bill Totals Summary (Read-Only)`?
