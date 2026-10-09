# Implementation Plan — Compaction Rollout, Reports Tabs, Crash Hardening

## 1. Goals
(a) Users-style compaction (merged top rows, tightened cards, shared compact density, retuned caps) for rooms, amenities, products, inventory, discounts & promos; POs filter+table verified/aligned. (b) Reports crash on type-switch can never kill the page. (c) Report-type cards → shadcn Tabs. No API/count/logic changes.

## 2. Findings
- Charts are hand-rolled SVG (no canvas leak). Crash likely comes from transitional render states when switching types (reportData null/stale-shaped) with no boundary — production then dies instead of degrading.
- Each target page has the same rhythm as users had: separate create-button row + tabs + roomy cards + tall rows.

## 3. Scope
- IN: shared `.table-compact` CSS (one block covering the 5 pages; po-/users- variants left untouched); per-page merge/tighten/cap edits; reports Tabs conversion; per-view remount `key={report}` + null-shape guards + error boundary around report views.
- OUT: APIs, counts, filters, sorting.

## 4. Design
- Compaction recipe per page: tabs + create button share one `mb-2` row; filter/table cards `mb-3` + `1rem` padding; container gains `table-compact`; scroller caps retuned so footers sit on screen with whitespace (report exact reserves per page).
- Reports: `Tabs selectedKey={report} onSelectionChange={handleSelectReport}` with the 4 full labels; views render under `key={report}` (clean slate per switch, kills stale-shape crashes); boundary fallback card ("Report failed to load, pick another type") if anything still throws.
- PO: verify filter/table match the pattern; adjust only if deviating.

## 5. Steps
1. CSS block + 5 page compactions + PO check (subagents, no commits). 2. Reports tabs + hardening (direct). 3. Lint + build + manual incl. rapid type-switching. 4. Walkthrough; no commit/push until `"push"`.

## 6. Acceptance
- All six pages compact with visible footers; report switching never kills the page (boundary + remount); tabs styled; build passes.

## 7. Risks
- Remount per report type discards per-view scroll position — acceptable (fresh data anyway).
