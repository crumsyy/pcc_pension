# Implementation Plan — PO Dropdown Clipping Fix

## 1. Root cause
The option list lives inside the dialog body's scroll container, so it can never paint outside it — widening alone can't fix the cut. The real culprit is the option's second line (`d-flex justify-content-between`): it forces badge + stock onto one rigid row, pushing "Stock: 2 pcs" past the menu edge.

## 2. Change (`app/admin/purchase-orders/page.js`, Combobox only)
- Option second line becomes wrapping flow (`flex-wrap`, badge + stock inline with gap) so nothing is forced off-screen at any width; name keeps wrapping + tooltip. Menu keeps `min-width: 280px`.
- Untouched: dialog size, columns, stock figures, submit logic.

## 3. Verify
- `npx eslint` (stash-compared) + `npm run build`; staging check.
- Commit/push only on `"push"`.
