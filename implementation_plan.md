# Implementation Plan — Payable QRPh + env keys + test banner (for approval)

> RequestFeedback: true — approved ("proceed"). Implementing below. Merchant account number still pending — code ships env-driven with safe fallback behavior documented.

## 1. Changes
1. **`lib/qrph.js`**: default `accountNo` from `process.env.QRPH_MERCHANT_ACCOUNT` (fallback keeps legacy dummy only until env is set — documented); add `isQrLiveReady()` (true when env present); add `getTestModeBanner()` text helper or inline constant. Delete nothing else.
2. **`DynamicQrPhCode.js`**: delete hand-built fallback payload strings; all fallbacks via `generateDynamicQRPh` (correct EMV lengths + CRC).
3. **PayMongo routes** (`api/payments/paymongo-qr`, guest `api/guest/payments`): read secret/public keys from `PAYMONGO_SECRET_KEY` / `PAYMONGO_PUBLIC_KEY` env (no hardcoded keys in repo); derive live-vs-test from key prefix (`sk_live_`); refuse live-amount processing without keys.
4. **Guest QR card**: visible TEST MODE banner on test QRs ("simulated only — do not pay with real GCash").
5. **No keys committed.** User installs fresh live keys + merchant number via Vercel env panel.

## 2. Verification
- `npm run build` passes; grep for hardcoded `sk_`/`pk_` keys → zero hits; payload unit-check (length fields 2-digit, CRC valid).
- Live end-to-end still requires user-side: fresh keys, merchant number, small real-payment test.

## 3. Risks
- Low-medium: key plumbing touches payment routes; test flows must keep working with test keys.
