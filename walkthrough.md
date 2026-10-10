# Walkthrough — Native PDF + Genuine XLSX Reports Exports

## Changes (no commit/push yet — say `"push"` only when you want commit + push)

**New (additive, `lib/reports/`):**
- `reportExportModel.js` — single source of truth for all 10 report views (sales summary/transactions/orders/purchase_orders, occupancy trends/performance, inventory balances/movements, guests stays/reservations): titles, columns/widths/formats, KPI reuse from `reportData`, `PCC-REP-<TYPE>-<YYYYMMDD>` doc-refs, `PCC_<Report>_<from>_to_<to>` filenames. No new calculations — field names mirror the old CSV/PDF code and the `/api/admin/reports` payload.
- `exportExcel.js` — genuine `.xlsx` via `exceljs` (already installed): Summary sheet (title, period, generated-at, filters, doc-ref, KPIs) + Details sheet (all rows, PCC-blue headers, alternating shading, autofilter, frozen header, native numeric peso `₱#,##0.00` / int / `%` formats, column widths).
- `exportPdf.js` — native A4 portrait PDFs via `@react-pdf/renderer` (already installed): letterhead, doc-ref, metadata incl. filters + timestamp, KPI grid, paginated tables with repeated headers, Page X of Y footers, sign-off. Empty datasets render an explicit no-records page.

**Modified (`app/admin/reports/page.js` only):**
- Replaced `handleExportCSV` (CSV blob) with `handleExportExcel`, and the `window.open` + `window.print()` HTML "PDF" (~990 lines) with async `handleExportPDF` using the new lib (dynamic imports keep the page bundle lean).
- Exports use `exportRows` = all server-filtered rows + current sort (search box ignored per your choice; no pagination cut-off). Totals come from `reportData` KPIs — same values as the on-screen cards.
- Buttons show busy state (`Generating...`), are disabled during export, and toast success/empty/error via the existing app toast system. Theme, sidebar, layout, filters, tabs, and report data untouched.

## Verification
- `npm run build`: Compiled successfully, 97/97 pages.
- `npx eslint`: only pre-existing findings (verified identical on HEAD via `git stash`); `lib/reports/` clean.
- Round-trip harness (real lib code, 15 rows × 10 views): 6/6 PASS — specs resolve, KPIs match API totals (₱8,100.00 / ₱6,900.00), filenames/doc-refs match pattern, XLSX reads back as valid zip with correct headers/row counts/numeric peso cells/autofilter/freeze/PCC-blue headers, PDFs start with `%PDF-` incl. empty-set case.
- Note: `@react-pdf/renderer` v4 `toBuffer()` returns a PDFKit stream in Node — production code correctly uses `toBlob()` (verified working).

## Manual check
1. Reports → any type/sub-tab → Export to Excel (.xlsx): opens with Summary + Details, formatted pesos, frozen/filterable header.
2. Export / Download PDF: native A4 PDF with header, KPIs, full table, footers, sign-off.
3. Empty filter result → toast, no file. Rapid filter switches unaffected (abort logic intact).

Awaiting review. Say `"push"` only when you want commit + push.
