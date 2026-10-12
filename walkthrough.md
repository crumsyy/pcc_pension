# Walkthrough — Sticky order tray

## Changes
- `globals.css`: new `.orders-tray-sticky` (sticky below header, in-flow, self-scrolling).
- Guest + receptionist tray cards use it; guest column stretch restored so sticky has room to travel.

## Verification
- `npm run build` → success.
- Manual: tray follows scroll on long catalogs, never overlaps search/tabs; long carts scroll inside the tray.
