# Implementation Plan — Save QR code image (guest portal) (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Request
Guest QRPh payment card: add Save QR button downloading the QR as an image for use in GCash.

## 2. Proposed changes (only `GuestDashboardClient.js`, settle QR card ~4653)
1. Add **Save QR Image** button under the QR (next to the instruction banner), filename `PCC-QRPh-{amount}.png`.
2. Download via `fetch(url) → blob → object URL → a[download]` (works for remote + `data:` URLs); revoke object URL after click.
3. CORS fallback: if fetch is blocked, open the image in a new tab + toast guiding mobile users to long-press-save. Result toasts for success/failure.

## 3. Verification
- Click saves a scannable PNG (PayMongo, qrserver fallback, and data-URL variants); blocked-fetch path opens new tab; `npm run build` passes.

## 4. Risks
- Low: additive UI + client-side download; QR payload/verification untouched.

## 5. Questions
- Q1: Proceed?
