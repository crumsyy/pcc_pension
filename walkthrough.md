# Walkthrough — Abortable Report Fetches

## Changes (no commit/push yet)
- `reports/page.js`: `fetchReport` aborts any in-flight request before starting a new one; `AbortError` swallowed silently; pending work aborted on unmount. Rapid type switches now keep at most one live request — no pile-up of full datasets, state updates, or chart recomputes.

## Verification
- `npx eslint`: only pre-existing findings on untouched lines.
- `npm run build` success, 97/97 pages.

## Manual check
1. Switch sales → occupancy → sales rapidly several times: Network tab shows cancelled requests, page stays alive, latest report renders.
2. Normal single switches behave exactly as before.

Awaiting review. Say `"push"` only when you want commit + push.
