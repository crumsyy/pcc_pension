# Implementation Plan — Empty Catalog Dropdown Fix (my regression)

## 1. Root cause (verified by reading `command.jsx`)
`CommandList` only traverses one level deep (direct `CommandItem`/`CommandGroup` children). I wrapped the items in a plain scroll `<div>`, so traversal finds zero items → always "No results found." — even with an empty query.

## 2. Fix (`app/admin/purchase-orders/page.js`, Combobox only)
- Drop the inner wrapper div; move `maxHeight` + `overflowY: auto` onto the outer dropdown-menu div so the whole menu scrolls. Items become direct `CommandList` children again (filtering, highlight, Enter all work).
- Untouched: flip logic, stock rows, selection, dialog.

## 3. Verify
- `npx eslint` (stash-compared) + `npm run build`; staging check (open picker empty → all items; type → filters; Enter picks).
- Commit/push only on `"push"`.
