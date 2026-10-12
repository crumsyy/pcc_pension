# Walkthrough — Finalize removal + billing UX batch

## Changes
- **Guest pay-anytime:** dropped finalized gates in `handleInitiatePay` + guest pay APIs; Request Final Bill → Request Check-Out (same inspection API, reworded); Pay Balance button on any owing non-terminal stay; settled/verified banners reworded off finalize language (legacy finalized rows still display).
- **Receptionist:** deleted dead bookings finalize modal + handlers; dropped “Bill Not Yet Finalized” notice; removed dead `handleFinalizeBillOnly`.
- **Checkout gates:** `completeBookingAndFreeRoom` + billing complete now require verified room (roomVerifiedAt or verified/finalized legacy status) AND ₱0.00, with specific errors.
- **Labels/UX:** `Orders & Room Service` → `Orders` (2 headers); discount card blue + `Applied Discounts`; per-guest discounts are stacked rows (no overlap possible); statement money lines reordered (charges → payments → balance last).
- Server `finalize_bill`/`update_final_billing` actions kept (no callers; harmless).

## Verification
- `eslint`: no new issues. `npm run build`: exit 0.

## Manual to confirm
- Guest pays unfinalized bill; checkout blocked until verified + zero (each reason errors clearly); legacy finalized rows unchanged; statement reads top-down; long discount names never overlap.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
