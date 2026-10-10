# Implementation Plan — Recent Stock Movements Fits Content (No Inner Scroll)

## 1. Finding
`app/admin/inventory/page.js:901` — the dashboard's Recent Stock Movements wrapper has `maxHeight: max(200px, calc(100vh - 500px))` + `overflowY: auto`, so the 10 paginated rows render inside a short inner scroll area (screenshot shows rows cut mid-table with its own scrollbar). Pagination (`AdminPagination`, 10/page, 75 total) already handles length — the inner cap is redundant.

## 2. Change (one line, dashboard table only)
- Remove the `maxHeight`/`overflowY` style on line 901, keeping `table-responsive` (horizontal scroll on narrow screens stays).
- Card then grows to fit all 10 rows; the page scrolls naturally; pagination stays directly under the last row.
- Out of scope (unchanged): other inventory tabs' tables (lines 1011/1103/1200/1249/1268 keep inner scroll — long lists where it makes sense), columns, data, pagination, theme.

## 3. Verify
- `npx eslint` on the file (stash-compared), `npm run build`; visual check needs browser (staging).
- Commit/push only on `"push"`.

## 4. Questions
1. Dashboard Recent Stock Movements only (Recommended) vs all inventory tables?
2. Proceed?
