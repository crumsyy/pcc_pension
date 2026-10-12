# Implementation Plan — Remove finalize gates + billing UX batch (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Agreed rules (all recommendations accepted)
- No new `Bill Finalized` rows; old ones stay readable (no migration).
- Pay anytime (guest + counter), no request-final-bill step.
- Checkout completes only at ₱0.00 AND room-verified (inspection stays as the guard).
- Statement/discount UI fixes as specced.

## 2. Changes
### A. Guest portal (`GuestDashboardClient.js`)
1. `handleInitiatePay`: drop finalized gate (keep declined + settled-zero notes) → pay whenever balance > 0.05.
2. `handleRequestCheckout`: rename UI copy to Request Check-Out / inspection language (API unchanged).
3. Action buttons (both desktop + mobile blocks): Pay Balance button whenever balance > 0.05 and status not terminal; Request Check-Out on Occupied; settled banner at zero regardless of finalized flag; reword Room-Verified/Pending-Bill notes (no finalize language); drop finalized-only banners for new rows (keep conditions harmless for legacy).
4. Guest pay APIs (`guest/bookings/pay`, `guest/payments`): remove unfinalized blocks.

### B. Receptionist
5. `bookings/page.js`: delete finalize modal + state + handlers + trigger (incidental-adding lives in BillingTab).
6. `BillingTab.js`: drop “Bill Not Yet Finalized” alert (added last round); legacy finalized alerts stay.
7. Completion gates (`completeBookingAndFreeRoom` + billing `checkout` action): require verified room (`roomVerifiedAt` set OR status in Room Verified/Pending Bill/Bill Finalized family) AND zero balance; error message states which is missing.

### C. Labels + statement/discount UX (`BillingTab.js`, `PaymentTerminal.js` totals TBD)
8. `Orders & Room Service` → `Orders` (payment summary + statement headers).
9. Discount card: red/danger → blue family, title `Applied Discounts`; per-guest pills restyled to match.
10. Applied-discount badges → stacked rows (name+ID left, amount right, wrapped, `mb-2` gap) — overlap structurally impossible.
11. Statement money-line reorder: all additive charges (room, extra pax, breakfast, orders, incidentals) → subtotal/discounts/net → payments → balance LAST; dedupe Net Room Stay Charges line.

## 3. Verification
- `eslint`; `npm run build` 97/97.
- Manual: guest pays unfinalized bill to zero; checkout blocked until verified AND zero (each missing piece errors clearly); legacy finalized rows display unchanged; statement reads top-down; discounts readable at any name length.

## 4. Risks
- Checkout now has TWO gates (verified + zero) — receptionist hitting Complete on unverified zero-balance stays gets a clear error, not silent success. Intended.
- Guest pay-anytime increases pre-inspection payments; inspection still gates completion, and damage incidentals post as charges due (balance reopens) — same as today’s walk-in payment behavior.

## 5. Questions
- Q1: Proceed with the full batch as specced?
