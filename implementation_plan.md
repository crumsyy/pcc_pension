# Implementation Plan — Discount Eligibility (ID / Booking-Count / Open)

## Agreed design (from Plan-mode discussion; user approved "proceed")
- Three eligibility kinds: ID-Based (unchanged), Booking Count (newly enforced, primary bookings only — companions earn no credit), Open/None (new, booking-level, no proof, standard audit only).
- Creation: Eligibility dropdown drives the form (Booking Count → Req. Bookings > 0 mandatory; Open → Req. Bookings locked 0 + hint); server validates the same triple.
- Billing math reused: ID/Booking-Count per-guest per-capita; Open via existing `fixedDiscount` once per booking. Pax cap stays; duplicate-ID guard stays for ID-Based.
- Promos: mechanics unchanged; verify date/room enforcement server-side at apply.

## Implementation order
1. Seed `eligibility_type (3,'Open')` in schema + idempotent migration path.
2. Admin create/update validation + modal behavior.
3. Apply-time branch: Booking-Count stay-count check (primary bookings), Open booking-level path.
4. Promo date/room verification at apply.
5. Build + eslint + walkthrough; commit/push only on `"push"`.
