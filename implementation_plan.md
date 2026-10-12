# Implementation Plan — Admin-editable inclusive VAT (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Agreed scope (all recommendations accepted)
- PH-standard **inclusive 12% VAT** (totals unchanged; receipts gain “Inclusive of VAT” breakout; down-payment math untouched).
- Tax controls as a **new tab in Discounts & Promos**; settled bills never rewritten.

## 2. Changes
1. **Storage:** `system_settings` table (`setting_key` PK, `setting_value`, `updated_by`, `updated_at`) via `database/migrate.mjs` pattern; seed `vat_rate=12`. `getSystemVatRate()` reads it with short module cache, falls back to 0.
2. **API `app/api/admin/tax/route.js`:** admin-only GET (rate + last-changed audit) / POST (validate 0–100, upsert, stamp user/time). Mirrors existing admin route auth pattern.
3. **UI tab:** Discounts page third tab `Tax Settings` — current rate card, numeric editor + save, live preview (“₱1,800 stay → VAT ₱192.86”), audit line. Reuses page’s ModalDialog/toast/LoadingButton patterns.
4. **Billing math (`lib/db.js`):** `vatRate = rate/100`-style fraction from `getSystemVatRate()`; inclusive `vatAmount = netTotal × rate/(100+rate)`; `grandTotal = netTotal` unchanged; persist real values in the two hardcoded `0.00` UPDATEs; same for the second details path (~1846-1851, verify source of its vat fields first).
5. **Receipts:** replace hardcoded `0.00` VAT with billed values + “Inclusive of VAT ₱X” row in down-payment invoice, front-desk payment invoice, and guest receipt templates (enumerate all print templates during implementation).

## 3. Verification
- `eslint`; `npm run build` 97/97.
- Manual: set 12% → new billing shows VAT 192.86 on 1800, totals unchanged; set 0% → VAT 0; old settled bills unchanged; receipts print the breakout; non-admin POST rejected.

## 4. Risks
- Math change touches money: inclusive design guarantees totals/balances/down-payments bit-identical; only the breakout row is new. Client-side preview totals (if any hardcode VAT) must display server values — audit during implementation.

## 5. Questions
- Q1: Proceed exactly as above?
