# Implementation Plan — A2 ordering fix + editable headcount (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Issues
1. **Order bug (Image 1):** sections read A1 → B1 → B2 → A2. A2 Occupancy (Stay Context) must sit directly after A1, before Phase B.
2. **New request:** A2 Number of Guests editable via pen button → dialog (Cancel/Save) → bill recalculates. Headcount source verified: `COALESCE(booking.guestCount, reservation.guestCount, 1)` (`lib/db.js:843`), so editing = updating `booking.guestCount` (and linked reservation for consistency), then refetch recalculates per-capita split, extra-guest fees, discounts.

## 2. Proposed changes
### A. Order fix (only `BillingTab.js`, move only)
- Cut A2 Occupancy block from after B2 → paste immediately after A1 grid, before Phase B label. Final: A1 → A2 → B1 → B2 → C1 → D1–D4.

### B. Editable headcount (frontend `BillingTab.js` + backend `app/api/receptionist/billing/route.js`)
1. **A2 header:** `editable={true}`, hint `Headcount drives per-guest split and extra-guest fees. Click the pen to update.` + pen icon-button next to Number of Guests card (not a full-width button — small outline pen).
2. **Dialog (new modal, same ModalPortal pattern):** title `Update Number of Guests — Room X`; shows Room capacity max + current value; numeric input min 1 max 20; note `Extra guests beyond standard capacity auto-add ₱100/night at final billing. Reducing below discount beneficiaries will be blocked with a warning.`; footer Cancel (secondary) + Save (primary, LoadingButton while saving).
3. **Save flow:** validate integer ≥1; if new count < applied discount beneficiaries count → block with warning (discounts are per-beneficiary, can't have more beneficiaries than guests). POST `{ action: 'update_guest_count', bookingID, guestCount }` → success toast → `fetchBillingDetails` refetch recalculates; error toast on failure.
4. **Backend new action `update_guest_count`:** session-checked; validate bookingID + guestCount 1–20; `UPDATE booking SET guestCount = ?`; if booking has reservationID, `UPDATE reservation SET guestCount = ?` for consistency; audit log (`Guest Count Updated: old → new`, amount 0). Returns `{ success: true }`. No other calculation changes — existing calculator derives split/fees from the new count on next fetch.

## 3. Verification
- Visual: order A1 → A2 → B1 → B2; pen button only on headcount card; dialog Cancel closes without change, Save refetches and totals/headcount/badges update.
- Edge: save 0/negative/empty blocked; save below beneficiary count blocked with message; over-capacity allowed but capacity badge flips to extra-pax warning.
- `npm run build` passes; `grep update_guest_count` hits frontend + backend.

## 4. Risks
- Low-medium: new write path to booking/reservation counts. Guarded by validation + audit. Discount-beneficiary invariant explicitly checked. Rollback = revert commit.

## 5. Questions
- Q1: Proceed with move + editable headcount as above?
- Q2: Max headcount cap — 20 OK, or match room capacity strictly (block over-capacity saves)?
