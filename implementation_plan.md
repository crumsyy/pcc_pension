# Implementation Plan — Abortable Report Fetches (Kill the Pile-Up Crash)

## 1. Goal
Switching report types rapidly can never stack concurrent full-dataset loads. No API/visual/logic changes to results.

## 2. Root Cause (verified `reports/page.js:124-164`)
`fetchReport` has no cancellation: sales → occupancy → sales fires 3 overlapping full-dataset requests; every completion runs big `setState`s + full re-renders + SVG chart recomputes + cache writes. That pile-up is what kills the tab renderer.

## 3. Scope
- IN: `AbortController` wiring in `fetchReport` + abort on unmount.
- OUT: APIs, views, tabs, counts.

## 4. Design
- `reportAbort` ref: each `fetchReport` aborts the previous controller, creates a new one, passes `signal` to `fetch`; `AbortError` is swallowed silently (not shown as an error); unmount effect aborts pending work. Stale responses can never commit state.

## 5. Steps
1. Edit + lint + build. 2. Walkthrough; no commit/push until `"push"`.
3. Retest protocol for you: latest commit Ready → hard refresh → switch sales→occupancy→sales rapidly several times. If it still dies, the cause is outside fetch pile-up and I'll need console text.

## 6. Acceptance
- Rapid switching issues at most one live request (Network tab); no crash across repeated switches; build passes.

## 7. Risks
- None to results; aborted requests never resolve.
