# Implementation Plan — Fix production dashboard latency (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Diagnosis (measured)
- DB is TiDB on AWS ap-southeast (Singapore); `vercel.json` pins no region → functions run US East by default (~200ms+ per roundtrip).
- Live probe: every query ~55-60ms uniform from PH, tables tiny (booking 0 / room 19 / reservation 3 / orders 0 rows) → latency-bound, not query-bound. Indexes already adequate (verified `SHOW INDEX` earlier).
- Dashboard pays ~10 roundtrips per server render (session + 2 batched counts + reservation count + 6 lists) + TLS handshakes on cold starts; pollers (dashboard 15s, alerts 10s, focus-refetch) replay it constantly per open tab.

## 2. Changes
1. **Pin region (`vercel.json`):** add `"regions": ["sin1"]` (keep existing `crons` block). Applies on next deploy; biggest win.
2. **Single-roundtrip snapshot:** new `getDashboardSnapshot()` in `lib/db.js` (or dashboard lib) running all dashboard reads as one multi-statement batch over a dedicated connection (`multipleStatements: true`, read-only SELECTs only), returning the same keys both `dashboard/page.js` and `api/receptionist/dashboard/route.js` consume. Falls back to the current `Promise.all` path on any batch error.
3. **Server snapshot cache (~15s):** module-level `{ data, ts }` cache in the snapshot getter (freshness matches the client's 15s poll; per-instance, zero staleness risk beyond one poll interval). Poll endpoint + page share it.
4. **Calm pollers:** inquiry alerts `ReceptionistSidebarNav.js` 10s → 60s; dashboard client focus/visibility refetch gated on data older than ~15s (`lastUpdated` check); polling intervals themselves unchanged otherwise.

## 3. Verification
- `eslint` touched files; `npm run build` 97/97.
- Numbers identical before/after (same predicates/keys; client untouched).
- Production check after deploy: dashboard TTFB seconds → few hundred ms; confirm in Vercel function logs (sin1) + browser timing.

## 4. Risks
- `regions` change: all functions + cron move to sin1 — intended (DB is there); no code risk.
- Multi-statement: scoped to a dedicated read-only batch connection (no global `multipleStatements`), parameterized inputs pass through existing `sanitizeSqlParams`; fallback path on error.
- 15s server cache: worst-case staleness equals one client poll interval; mutations (check-in/out, payments) still refresh via existing `pcc-refresh-*` events + focus gate.

## 5. Questions
- Q1: Proceed with all four steps?
- Q2: If multi-statement proves awkward with the sanitize wrapper, fall back to keeping `Promise.all` (region pin alone) — acceptable?
