# Walkthrough — Discount Eligibility: ID / Booking-Count / Open (no commit/push yet)

## Changes
- **Model**: `eligibility_type` gains `Open` (schema seed + idempotent `migrate.mjs` seed); `booking_discount.kind` (`guest`/`open`) via `ensureColumn` + self-healing ALTER at apply; balance reader sums open rows and no longer wipes them as orphans.
- **Create/update** (`api/admin/discounts` + modals): shared validation (1–100%, Booking Count needs ≥1 stay, Open forces 0, type/eligibility must exist); modal locks Req. Bookings for Open with hints.
- **Apply** (`api/receptionist/billing`): per-eligibility branch — ID unchanged; Booking Count verifies primary-booker stay history (name resolution + completed-stay count, clear reject messages); Open is booking-level (max 1, no name/ID, fixed % off gross room charge); promos now also 400 when expired/archived or room-mismatched (dates were already enforced); archived discounts 400 instead of silent 0%. Pax cap counts guest rows only. BillingTab labels show kind/requirement, inputs/preview/submit honor Open rows.
- Booking creation paths already ignore creation-time discounts — no changes needed there. Promos keep ID flow.

## Verification (actually performed)
- `npx eslint`: 7 problems before = 7 after (pre-existing). `npm run build`: 97/97. Calculator Open-math spot check passes (5000 − 250 = 4750).
- NOT run (needs live DB + staging): create each kind (incl. invalid combos rejected), apply ID/Booking-Count/Open with correct/incorrect proofs, promo room-mismatch rejection, balance persistence across recalculation, remove/re-apply idempotency.

Say `"push"` only when you want commit + push.
