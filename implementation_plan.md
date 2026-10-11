# Implementation Plan — Modern shadcn Catalog Picker with Smart Flip (user-approved "proceed")

1. `app/admin/purchase-orders/page.js` only: rebuild the local `Combobox` list on shadcn `Command` primitives (input/list/empty/item) with the same search + stock rows; add open-direction flip (measure space above/below on open, drop-up when crowded, capped to available space); selection/disabled/placeholder behavior unchanged.
2. Verify: eslint stash-compared, build 97/97. Commit/push only on "push".
