# Walkthrough — PO Create Modal Fixes (no commit/push yet)

## Changes (`app/admin/purchase-orders/page.js` only)
- Footer: Cancel left, Create Purchase Order right (Grand Total stays left).
- Red asterisks on "Item Name" and "Qty Ordered" headers via the existing class.
- Catalog dropdown options stack (full wrapping name + `Type · Stock: N unit` line, tooltip), stock joined from the already-fetched restock feed; unknown stock shows "Stock: —".
- Create modal shell migrated to shadcn `Dialog` at default (medium) width; view/stock-in modals untouched.

## Verification (actually performed)
- `npx eslint`: 5 problems before = 5 after (pre-existing). `npm run build`: 97/97.

Say `"push"` only when you want commit + push.
