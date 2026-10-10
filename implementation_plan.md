# Implementation Plan — Fix ₱ Mojibake + PDF Currency & Document Look

## 1. Diagnosis (verified, read-only inspection)

**Bug A — `â‚±` on screen (your screenshot): my fault, encoding corruption.**
- The Reports KPI cards show `â‚±0.00` because `app/admin/reports/page.js` (47 lines) got double-encoded: my PowerShell `Get-Content`/`Set-Content` splice during the export rewiring misread UTF-8 bytes as Windows-1252 and re-saved them (`₱` U+20B1 → `â‚±`, 🍳🥤🧴 → `ðŸ…`, `⚠` → `âš `, `—` → `â€"`).
- `lib/reports/*` are clean (written UTF-8; peso only as `\u20B1` escapes). No other repo file went through that splice.

**Bug B — peso inside the PDF would print as `±`, not `₱` (found by decompressing a test PDF).**
- Content stream shows the peso emitted as raw bytes `<20 b1 …>`. Under Helvetica/WinAnsi (no `₱` glyph), viewers render byte `0xB1` = `±`. So even after Bug A is fixed, PDFs need a currency fix.

## 2. Proposed fixes (Reports module only, theme/filters/tabs/data untouched)

**Step 1 — Restore page.js bytes (reversible, verifiable).**
- Node script (UTF-8 safe): reverse the double-encoding for the whole file (`Buffer.from(s,'latin1').toString('utf8')`), then restore the 3 spots I had converted to `-` back to `—`.
- Verify: rescan shows only legitimate non-ASCII (`₱`, emoji, `—`, `⚠`); `git diff` on non-ASCII lines matches HEAD exactly except my intended new-code lines; build passes.

**Step 2 — PDF currency + document look.**
- Currency: check for a shippable TTF with U+20B1 (repo `public/`, npm cache). If available: `Font.register` + use it for peso runs (Helvetica kept elsewhere). If not: render amounts as `PHP 8,100.00` in PDFs only (Excel keeps `₱` — it renders fine there via system fonts; on-screen cards keep `₱` once Step 1 restores them).
- Document look: pull 1–2 online hotel/audit report samples, then refine the existing shell (letterhead, doc-ref, period/filters meta, KPI summary, repeated-header tables, Page X of Y, prepared/approved sign-off, confidentiality footer) to match conventions. No window.print, still native `@react-pdf/renderer`.
- Re-run the 6-check round-trip harness (incl. a new assertion: PDF content stream contains no stray `0xB1`-as-peso bytes) + build + lint.

**Step 3 — Prevention:** no PowerShell text cmdlets on UTF-8 files; Node-only splicing from now on.

## 3. Open questions
1. PDF currency if no embeddable font is found: use `PHP 8,100.00` (recommended fallback) or keep trying to source a font?
2. Proceed with Steps 1–2 as above?

## 4. Acceptance
- Screenshot cards show `₱0.00`/`₱70,054.00` correctly; PDF amounts show real peso (or `PHP`); document-style layout; build + harness green; no unrelated diffs; commit/push only on `"push"`.
