# Walkthrough — Save QR Image (guest portal)

## Changes (only `GuestDashboardClient.js`, settle QR card)
- New **Save QR Image** button under the QR; downloads `PCC-QRPh-{amount}.png` via fetch→blob→object URL.
- CORS-blocked fallback opens the image in a new tab with long-press-save guidance; success/failure toasts.

## Verification
- `npm run build` → success.
- Manual: all three QR sources (PayMongo, qrserver fallback, data-URL) save a scannable PNG; blocked path falls back cleanly.
