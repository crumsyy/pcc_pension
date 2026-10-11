# Implementation Plan — Discount Footer Button Order

## 1. Change
`app/admin/discounts/page.js`, Create Discount footer (and Update Discount for consistency — promo modals already read Cancel-left/Create-right): swap the two buttons so Cancel sits left and the primary submit sits right. `DialogFooter` default (`space-between`) produces that layout with zero extra styling. No logic changes.

## 2. Verify
- `npx eslint` (stash-compared) + `npm run build`.
- Commit/push only on `"push"`.
