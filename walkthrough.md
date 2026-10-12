# Walkthrough — Payable QRPh payloads + env keys + test banner

## Changes
- `lib/qrph.js`: merchant account from `QRPH_MERCHANT_ACCOUNT` env (legacy dummy fallback retained); new `isQrLiveReady()`. Payload builder itself verified: 2-digit EMV lengths, valid CRC.
- `DynamicQrPhCode.js`: deleted both hand-built fallback payload strings (the malformed-length bug); uses server-built `qrFallbackUrl`, else an honest error state instead of a bogus QR.
- `api/payments/paymongo-qr`: success responses include server-built `qrFallbackUrl` + `qrLiveReady`.
- `api/guest/payments/paymongo`: response includes `isTestMode` (from live key prefix).
- Guest QR card: TEST MODE banner ("simulated only — do not pay with real GCash") whenever not live.
- No keys committed; test-key fallbacks unchanged for dev.

## Verification
- `npm run build` → success; node payload check: `5405`/`5407` length fields correct; `isQrLiveReady()` false without env.
- Still user-side: fresh live keys (posted ones must be revoked), `QRPH_MERCHANT_ACCOUNT` + `PAYMONGO_*` in Vercel env, then one small real-payment test.
