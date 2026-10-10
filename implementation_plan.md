# Implementation Plan — Professional PDF + Genuine XLSX Exports (Reports Module)

## 1. Inspection Findings (verified 2026-10-10)

**Project:** Next.js 16.2.9, React 19.2.4, Tailwind 4, PCC blue `#2155B5` / `#1e3a8a` theme, sidebar + layout intact.

**Reports page:** `app/admin/reports/page.js` (~2600 lines, client component)
- 4 report types: `sales` | `occupancy` | `inventory` | `guests`
- 10 sub-tabs: sales `summary/transactions/orders/purchase_orders`; occupancy `trends/performance`; inventory `balances/movements`; guests `stays/reservations`
- Filters: dateFrom/dateTo + preset, grouping (Daily/Weekly/Monthly/Yearly), roomID, roomTypeID, itemClassification, paymentMethod, status, discountType, movementType, fulfillmentStatus. Search + sort + pagination (10/page) are client-side only.
- Data source: `GET /api/admin/reports?report=...` in `app/api/admin/reports/route.js` aggregates transactions, bookings, discounts (`lib/billingCalculator.js` per-capita logic), PO expenses, occupancy, inventory, guests. Totals (totalRevenue, grossRevenue, netProfit, averageOccupancy, etc.) come from API — must be reused verbatim.

**Current export logic (non-compliant):**
- `handleExportCSV` (page.js:303): builds CSV string from `sortedData` (filtered+sorted, may exclude search? actually includes search term — needs full filter set excluding search/pagination), downloads as `.csv`.
- `handleExportPDF` (page.js:378): builds HTML string, `window.open('', '_blank')` + `window.print()` (page.js:786-1289). Violates Req #3.
- No genuine XLSX; no PDF library usage currently.

**Installed deps (reuse, no new installs needed):**
- `@react-pdf/renderer@^4.9.0` — for professional PDFs.
- `exceljs@^4.4.0` — for genuine `.xlsx` with styling, number formats, autofilter, freeze panes.
- `lib/formatters.js` (`formatCurrency` with ₱ U+20B1), `lib/billingCalculator.js`, `sonner` toasts, existing UI tabs.

**Dashboard totals:** API `reportData` KPIs are source of truth; dashboard reads same tables. Exports must reuse `reportData` KPIs + `currentRawRows`-equivalent (all rows matching server filters), not `paginatedData`.

## 2. Goals (per requirements 1-10)
Preserve theme/sidebar/layout, all categories/filters/tabs/data. Replace print-window PDF with `@react-pdf/renderer` A4 documents; replace CSV with `exceljs` `.xlsx` (headers, peso/date formats, widths, autofilter, frozen header). Export all matching records. Totals = API values. Incremental, build-verified, no unrelated changes.

## 3. Proposed Changes (incremental)

**Step 0 — No new packages.** Verify `exceljs` + `@react-pdf/renderer` load under React 19 / Next 16 (dynamic import, client-only). If compat fails, fallback documented before proceeding.

**Step 1 — New lib (no page rewrite):**
- `lib/reports/reportExportModel.js` — single mapping: (report, subTab) → { title, filename base, columns [{key, header, width, numFmt}], rowMapper(row)→array, totalsMapper(reportData)→summary rows, kpiList }. Reuses exact field names from current `handleExportCSV` + PDF table sections so calculations are not reinvented.
- `lib/reports/exportExcel.js` — `exportReportExcel({report, subTab, rows, reportData, filters})`: Summary sheet (title, period, generated-at, filters, doc-ref `PCC-REP-<TYPE>-<YYYYMMDD>`, KPIs/totals as values) + Details sheet (all `rows`, blue header `#1e3a8a`, alternating shading, autofilter, frozen top row, native numbers/dates, `₱#,##0.00` formats, column widths). Filename `PCC_<Report>_<from>_to_<to>.xlsx`.
- `lib/reports/exportPdf.js` — `exportReportPdf(...)` via `@react-pdf/renderer`: shared A4 shell (letterhead, doc-ref, metadata incl. filters + timestamp, KPI grid per type, tables with repeated headers, Page X of Y footers, sign-off). Portrait; landscape for wide tables (sales summary/transactions, inventory movements). Empty-data page instead of misleading summary.
- Data input = `currentRawRows`-equivalent (server-filtered, search-excluded? Decision below) sorted by current sort, NOT `paginatedData`.

**Step 2 — Minimal page wiring (`app/admin/reports/page.js` only):**
- Keep `handleExportCSV` (or repurpose as XLSX) + `handleExportPDF` signatures; replace bodies with dynamic-import calls to new lib, busy state, `sonner` success/error, empty-guard (toast, no file). Buttons disabled while generating. No theme/layout/tabs/filter changes.

**Step 3 — Verification:**
- `npm run build` + `npx eslint app/admin/reports/page.js lib/reports/` after each step; fix only introduced errors.
- Manual + script round-trip: row counts = API rows; totals in files = `reportData` KPIs; open PDF/XLSX in viewers; check pagination, formats, filters reflected.

**OUT:** report logic/filters/tabs/UI theme, other modules, git commit/push (await `"push"` keyword per workflow).

## 4. Open Questions (need your choice before coding)
1. XLSX export scope: include search-term filtering or export all server-filtered rows ignoring search box?
2. Keep legacy CSV button alongside new XLSX, or replace CSV button with XLSX?
3. PDF orientation: auto-landscape for wide tables (recommended) or strict A4 portrait always?

## 5. Acceptance
Valid PDF/XLSX open correctly; pagination/headers/footers/formats/totals verified; filters reflected; empty handled; build+lint clean; no unrelated diffs.
