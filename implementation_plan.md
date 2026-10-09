# Implementation Plan — shadcn DataTable Everywhere (Admin → Receptionist)

## 1. Goals
(a) Audit History stops showing a half-cut last row. (b) All 51 tables (28 admin + 23 receptionist, 16 files) render through shadcn-style DataTable UI. No API/logic/count changes.

## 2. Current State (verified)
- All tables are hand-written Bootstrap `<table>` markup with per-page variations; sore spots (audit half-row) come from fixed caps + variable row heights inside scroll boxes.
- No `@tanstack/react-table` installed; no shadcn table components (CLI never initialized) — same hand-built approach as checkbox/dialog/tabs will apply. Will state that plainly in the walkthrough.

## 3. Scope
- IN: `npm install @tanstack/react-table`; new `components/ui/table.jsx` (Table/Header/Body/Row/Head/Cell/Caption) + `components/ui/data-table.jsx` (TanStack-powered shell: header groups, rows, empty state, footer slot) + theme/Inter CSS; migration of all 51 tables preserving columns, badges, action buttons, sticky headers, and existing `AdminPagination` footers (no new sorting/filtering behavior).
- OUT: APIs, pagination counts, sorting features, guest/landing tables.

## 4. Design
- Table primitives mirror shadcn classnames/behavior; DataTable wrapper takes `columns` (TanStack defs with existing cell renderers moved verbatim) + `data` + footer node; empty states preserved (`No ... found` rows).
- Audit pilot additionally: whole-row fit — cap tuned to a multiple of the compacted row height + `text-nowrap` kept, so no fractional last row at target heights; short screens keep in-table scroll with footer visible (same fallback as elsewhere).
- Migration order: foundation → pilot (inventory logs tab: disposal + audit) → admin batch (users, rooms, amenities, products, POs, discounts, bookings, reservations, dashboard, reports) → receptionist batch (billing-checkout tabs, bookings, reservations, checkin, orders, dashboard) → verify each file builds.

## 5. Steps
1. Dep + primitives + DataTable + CSS + pilot migration.
2. Admin batch, then receptionist batch (subagents per file, no commits).
3. Full `npm run build` + per-page visual checklist.
4. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- Every admin/receptionist table renders via DataTable with identical content, actions, and pagination; audit shows whole rows only; build passes.

## 7. Risks
- Very large diff (~16 files); mitigated by verbatim cell-renderer moves + per-file build checks. Sorting/filtering deliberately NOT added (would change behavior) — flag if wanted later.
