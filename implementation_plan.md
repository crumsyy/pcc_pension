# Implementation Plan — PO Create Modal Fixes

## 1. Changes (`app/admin/purchase-orders/page.js` only)
1. **Footer**: button group becomes [Cancel][Create] (Grand Total stays left).
2. **Red asterisks**: "Item Name *" and "Qty Ordered *" headers wrap `*` in the existing red `required-asterisk` class.
3. **Dropdown readable + stock**: option rows stack (name bold with wrap + `title` tooltip; second line `Type · Stock: N unit`), joined from the already-fetched `inventoryItems` (`sourceTable`+`itemID` ↔ catalog `type`+`id`); unknown stock shows "Stock: —".
4. **Size**: migrate the create modal shell to shadcn `Dialog` at default width (medium, matches the uniformity drive; `modal-lg` no longer needed once options stack). View/stock-in modals untouched.

## 2. Open question
- "Switch variant to medium" read as dialog size → shadcn default width. If you instead meant the table/dropdown density, say so.

## 3. Verify
- `npx eslint` (stash-compared) + `npm run build`; staging check (dropdown readability, stock figures, footer order).
- Commit/push only on `"push"`.
