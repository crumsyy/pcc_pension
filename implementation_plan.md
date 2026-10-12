# Walkthrough — Overlap fix (px-locked tray pair)

## Changes
- `globals.css`: fixed rail gated to `xl` with explicit `360px` card width; new `orders-tray-col` (`flex:0 0 360px`) reserves exact grid space; `orders-catalog-col` (`flex:1`) takes the rest. Below xl: Bootstrap grid as before.
- Both files: column classes attached. Root cause fixed: `width:inherit` copied the 25% which resolved against the viewport for fixed elements.

## Verification
- `eslint`: no new issues. `npm run build`: exit 0.

## Deploy protocol
1. Deploy + hard refresh.
2. Any scroll position: tray exactly fills its lane, zero catalog overlap; catalog breathes wider.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
