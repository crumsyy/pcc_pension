# Implementation Plan — shadcn Table UI for Users, Rooms, Amenities, Products

## 1. Inspection findings
- All 4 pages (`app/admin/users/UsersClient.js` L569-653, `app/admin/rooms/RoomsClient.js` L581-667, `app/admin/amenities/page.js` L412-478, `app/admin/products/page.js` L473-565) use the **same pattern**: plain `<table className="table align-middle mb-0">` in a `card-module` + `table-responsive` wrapper, custom filter bars, `AdminPagination` (10/page), `ActionButtons` row actions, Bootstrap modals. No sorting anywhere; none import `@/components/ui/table`.
- shadcn setup exists (`components.json`, Tailwind, `@tanstack/react-table` installed): `components/ui/table.jsx` primitives (`Table/TableHeader/TableBody/TableRow/TableHead/TableCell/TableCaption` → same Bootstrap classes + `pcc-datatable` Inter enforcement, verified in `globals.css:2634`) and `data-table.jsx` `DataTable` (core row model only — no sorting/pagination; used solely by inventory page).

## 2. Proposal (recommended: primitives swap, not a TanStack rewrite)
Per page, replace only the table markup, keeping every behavior identical:
- `<table>` → `<Table>`, `<thead>` → `<TableHeader>`, `<tbody>` → `<TableBody>`, `<tr>` → `<TableRow>`, `<th>` → `<TableHead>`, `<td>` → `<TableCell>` (add `scope="col"` comes free; keep all existing classNames, colSpans, empty states, cell renderers verbatim).
- Import from `@/components/ui/table`. No changes to columns, filters, tabs, pagination, `ActionButtons`, modals, caching, or data fetching.
- **Not doing**: migrating to `DataTable`/TanStack column defs (would require extending it with sorting/pagination + rewriting 4 tables' cells — high churn, zero visual gain since `table.jsx` renders the same Bootstrap markup; can be a follow-up if you want client sorting).

## 3. Steps
1. Users → Rooms → Amenities → Products (one page at a time, same 6-tag swap).
2. After each: `npx eslint` on the file + `npm run build`; visual parity check (same classes → same look, plus Inter enforcement).
3. Walkthrough; commit/push only on `"push"`.

## 4. Questions
1. Primitives swap as above (Recommended) vs full TanStack DataTable rewrite vs primitives + add client-side sorting?
2. Proceed?

## 5. Acceptance
- 4 pages render identical tables via `@/components/ui/table`; filters/pagination/actions/modals behave exactly as before; build + lint clean; no other modules touched.
