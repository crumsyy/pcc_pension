# Walkthrough — Sticky tray footer, blue steppers, typeable qty

## Changes (both `receptionist/orders/page.js` + `GuestOrdersContent.js`)
1. Pinned footer: totals + Submit moved out of the scroll flow into a fixed footer (totals + submit always visible; items list + scheduling panel scroll above). Single scroller per tray (removed nested 280px caps). Guest keeps everything inside its `<form>`; mobile modal unchanged (scrolls natively).
2. Qty steppers `btn-secondary` → `btn-primary` (trash stays red).
3. Qty input editable (`inputMode numeric`): digits-only, empty/NaN ignored, ≥1 committed via existing `handleUpdateQty` (receptionist stock cap + alerts reused).

## Verification
- `eslint`: no new issues. `npm run build`: exit 0. Nesting order verified (items → footer → submit).

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
