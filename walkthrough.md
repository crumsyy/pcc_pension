# Walkthrough — shadcn-Style Switch Toggles

## Changes (no commit/push yet)
- New `components/ui/switch.jsx` (shadcn-style `isSelected/onChange/isDisabled` over React Aria) + sliding-thumb theme CSS. Hand-built, not CLI code.
- Inventory stocks/batches filter bars: both Bootstrap switches replaced, same labels/handlers/filters.

## Verification
- `npx eslint`: only the pre-existing fetch-effect finding; new file clean.
- `npm run build` success, 97/97 pages.

## Manual check
1. Both toggles animate thumb + track, filter identically, keyboard accessible, correct in dark theme.

Awaiting review. Say `"push"` only when you want commit + push.
