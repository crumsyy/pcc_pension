# Walkthrough — shadcn Dialog for 12 Management Modals (no commit/push yet)

## Changes (create/update only; fields, validation, submits byte-identical)
- `app/admin/discounts/page.js`: create_disc, edit_disc, create_promo, edit_promo (800px width kept for promos).
- `app/admin/users/UsersClient.js`: create, edit (800px kept; view/suspend stay Bootstrap).
- `app/admin/rooms/RoomsClient.js`: create, edit (680px kept).
- `app/admin/amenities/page.js`: create, edit (640px kept).
- `app/admin/products/page.js`: create, edit incl. meal variants (640px kept).
- Pattern each: shell → `DialogTrigger isOpen` + `Dialog isDismissable={false}` + `DialogHeader/Title` (PCC blue via CSS, existing X button kept) + `DialogBody/DialogFooter` (same buttons). Surrounding gating, `ModalPortal` wrappers, and all logic untouched. Dark mode + Inter + animations come from the existing dialog shell.

## Verification (actually performed)
- `npx eslint` on the 5 files: 19 problems before = 19 after (pre-existing). `npm run build`: 97/97. Grep confirms only out-of-scope modals (view/suspend/purchase-orders/inventory/dashboard) still use Bootstrap markup.
- Staging checks needed: open/save each of the 12, X + Cancel paths, Escape/backdrop must not dismiss, dark mode.

Say `"push"` only when you want commit + push.
