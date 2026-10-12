# Walkthrough — Admin-editable inclusive VAT

## Changes
- **Storage:** `system_settings.vat_percentage` already seeded `12.00` live; added `updatedBy` audit column (migration + live). `getSystemVatRate()` reads it with 60s cache, fallback 0.
- **API `app/api/admin/tax/route.js` (new):** admin-only GET/POST, 0–100 validation, stamps user/time, invalidates cache. Settled bills never rewritten.
- **UI:** Discounts & Promos gains `Tax Settings` tab — current rate, editor, live preview (₱1,800 → VAT ₱192.86), audit line; list fetching skipped on the tab.
- **Math (`lib/db.js`):** inclusive `vatAmount = netTotal × rate/(100+rate)`, `grandTotal = netTotal` unchanged (totals, balances, down payments bit-identical); persisted in both sync UPDATEs; creation + conversion flows seed real values.
- **Visibility:** `api/billing` balancing, bookings payload, BillingTab summary, terminal calculations + receipt modal + printed invoice, down-payment receipt modal + print, guest receipt object + print + PNG — all show `Inclusive of VAT (x%) ₱Y` only when non-zero; booking-create preview + history folio likewise.

## Verification
- `eslint`: no new issues. `npm run build`: exit 0.
- Manual: Tax tab save 12 → new bills show breakout, totals unchanged; set 0 → rows disappear; old settled bills untouched (spot-check one pre-change folio); non-admin POST → 401/403.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
