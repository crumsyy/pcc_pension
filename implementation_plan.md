# Implementation Plan — PO Dropdown Fit (user-approved "proceed")

1. `app/admin/purchase-orders/page.js` only: Create PO `Dialog` `maxWidth` 42rem default → 800px; Combobox dropdown `ul` gains `minWidth: 280px` so the option list renders wider than its table column (names wrap, badge + stock stay readable).
2. Nothing else changes. Verify: eslint stash-compared, build 97/97. Commit/push only on "push".
