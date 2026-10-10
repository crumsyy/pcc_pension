# Walkthrough — Fix ₱ Mojibake + PDF Currency & Document Polish (no commit/push yet)

## Root causes (both verified with byte-level evidence)
1. **`â‚±` on screen: my encoding bug.** The earlier PowerShell `Get-Content`/`Set-Content` splice misread UTF-8 as Windows-1252 and re-saved it (47 lines in `app/admin/reports/page.js`: `₱`→`â‚±`, 🍳🥤🧴→`ðŸ…`, `⚠`→`âš `, `—`→`â€"`).
2. **Peso in PDF would print as `±`.** Decompressed PDF stream showed `₱` (U+20B1) emitted as raw bytes `<20 b1…>`; under Helvetica/WinAnsi byte `0xB1` renders as `±`. No shippable font exists in the repo, so PDFs now use the `PHP` code per your choice.

## Changes (Reports module only; theme, sidebar, filters, tabs, data untouched)
- **`app/admin/reports/page.js`**: byte-exact mojibake reversal via Node (cp1252-table + strict UTF-8 decode + proved round-trip `re-corrupt(restored) === current`). Restored alphabet is exactly `₱ ×31`, `— ×8`, `⚠ ×2`, `✓ ×1`, `🍳/🥤/🧴 ×3`, `🕒 ×1` — every corrupted char accounted for. Prevention: Node-only file edits from now on.
- **`lib/reports/exportPdf.js`**: `formatPdfMoney()` (`PHP 8,100.00`, negatives `PHP -70,054.00`); KPI peso strings converted to `PHP`; TOTAL/AVERAGE footer rows using **only** `reportData` aggregates (sales summary/transactions/orders/POs, occupancy trends, stays, reservations); meta gains Prepared-By + Source rows. Document conventions kept from hotel-report samples (memo meta, KPI summary, tabulated detail + totals, sign-off, `PCC-REP-*` ref, Page X of Y, confidentiality footer).
- Excel (`.xlsx` `₱` formats) and on-screen `₱` cards unchanged — both render fine outside PDF.

## Verification
- Round-trip harness (real lib code): **8/8 PASS** — specs, KPI totals, filenames, XLSX read-back (zip/headers/15 rows/money fmt/filter/freeze/PCC blue), `formatPdfMoney`, `%PDF-` for all 10 views + empty set, PDF stream contains `PHP` amounts + `TOTAL` footer.
- `npm run build`: Compiled successfully, 97/97 pages. `npx eslint`: only the 5 pre-existing findings (verified identical on HEAD).
- Screenshot case now renders `₱0.00`, `₱70,054.00`, `-₱70,054.00` correctly.

## Manual check
1. Reports → Sales → Export to Excel: `₱` amounts, Summary + Details.
2. Export / Download PDF: amounts read `PHP …`, blue TOTAL footer, sign-off, page numbers.
3. Empty filter result → toast, no file.

Awaiting review. Say `"push"` only when you want commit + push.
