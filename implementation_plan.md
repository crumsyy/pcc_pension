# Implementation Plan — Archived Side-by-Side + Emoji Removal

## 1. Changes (`app/admin/discounts/page.js` only)
1. Headings: `'📦 Archived Discounts'` → `'Archived Discounts'`; `'📦 Archived Promos'` → `'Archived Promos'`.
2. Archived tab only (active tabs render one section and keep today's full-width layout):
   - Wrap both sections in a div that is `row g-3` with fixed height `max(480px, calc(100dvh - 340px))` when `activeTab === 'archived'` (plain fragment otherwise).
   - Each section gets a `col-12 col-lg-6` wrapper in archived mode (stacked on small screens); cards gain `h-100 d-flex flex-column` (drop `mb-4` there).
   - Table wrappers become `flex: 1, minHeight: 0, overflowY: auto` (keep a `maxHeight` cap as safety) so both tables stretch top-to-bottom; each keeps its own `AdminPagination` pinned via `mt-auto`.
   - Narrow screens fall back to stacked cards + horizontal table scroll (`table-responsive` kept).
- Untouched: columns, data, pagination logic, filters, restore/edit actions, search, theme. (These two tables stay plain `<table>` — the shadcn pass covered the other four pages; say so if you want them migrated too.)

## 2. Verify
- `npx eslint` (stash-compared) + `npm run build`; staging visual check at desktop width (7-col promos table is tight at half width — horizontal scroll is the fallback).
- Commit/push only on `"push"`.

## 3. Questions
1. Side-by-side at `lg` breakpoint and up, stacked below (Recommended) vs side-by-side at all widths?
2. Proceed?
