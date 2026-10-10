# Walkthrough — shadcn Table UI for Users, Rooms, Amenities, Products (no commit/push yet)

## Changes
Main listing tables in all 4 pages now use `@/components/ui/table` primitives (`Table/TableHeader/TableBody/TableRow/TableHead/TableCell`), one import added per file:
- `app/admin/users/UsersClient.js` (8-col table), `app/admin/rooms/RoomsClient.js` (9-col), `app/admin/amenities/page.js` (8-col), `app/admin/products/page.js` (9-col).
- Swap is tag-for-tag: every className, colSpan, empty state, cell renderer, badge, and `ActionButtons` usage is byte-identical — only element names changed. Look is unchanged (primitives render the same Bootstrap classes + `pcc-datatable` Inter enforcement).
- Untouched by design: filters, tabs, `AdminPagination`, row-action handlers, modals (incl. small label-value tables inside view modals), data fetching/caching. No TanStack rewrite (per your choice; `DataTable` stays available for later).

## Verification (actually performed)
- Swap script asserted per file: marker found/closed, zero lowercase table tags left in the region, exactly one `ui/table` import.
- `npx eslint` on the 4 files: 16 problems before = 16 after (zero new findings, stash-compared).
- `npm run build`: Compiled successfully, 97/97.
- Not run here (needs browser): visual click-through of the 4 tables — recommended 2-minute staging check (filter, paginate, row actions, modals).

Say `"push"` only when you want commit + push.
