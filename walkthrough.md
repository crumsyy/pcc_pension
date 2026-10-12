# Walkthrough — Fixed right-rail order tray

## Changes
- `globals.css`: new desktop-only `.orders-tray-fixed` — viewport-fixed right rail (`top:96px`, `bottom:20px`, `right:36px` grid-aligned, live `width:inherit`, under header/modals). Mobile/tablet static flow untouched.
- Both order pages: tray card uses the fixed rail (keeps flex column + internal scroll + pinned footer); floating pill, its refs, and sticky leftovers removed.
- Nothing else touched: catalog, steppers, qty, submit logic, scheduling all as before.

## Verification
- `eslint`: no new issues. `npm run build`: exit 0.

## Deploy protocol
1. Deploy + hard refresh.
2. Scroll the catalog freely: the FULL tray (items, scheduling, totals, Submit) stays fixed on the right; no floating button appears.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
