# Walkthrough — Production dashboard latency fix

## Changes
- `vercel.json`: added `"regions": ["sin1"]` — functions now run next to the TiDB DB (ap-southeast) instead of default US East. Expected: per-roundtrip ~200ms+ → single-digit ms on deploy.
- `lib/dashboardSnapshot.js` (new): all 9 dashboard reads as ONE multi-statement batch over a dedicated read-only connection (`multipleStatements`, static SQL only, pool limit 3), 15s module-level result cache (matches client poll), parallel-`Promise.all` fallback on any batch error.
- `dashboard/page.js` + `api/receptionist/dashboard/route.js`: consume `fetchDashboardSnapshot()`; sweep calls removed; same predicates, same response keys, `Number(...) || 0` normalization (verified live: `SUM()` returns DECIMAL strings).
- `lib/session.js`: `getSessionDetails` wrapped in React `cache()` — layout + page share one lookup per request.
- `lib/db.js`: sweep throttle 30s → 5min backstop (cron owns the sweep).
- Pollers calmed: inquiry alerts 10s → 60s (`ReceptionistSidebarNav.js`); dashboard focus/visibility refetch gated on >15s staleness (`lastFetchAtRef`, set on mount + each successful fetch).

## Verification
- Live DB probes: batch shape correct (N statements → N row-arrays, one roundtrip); `SUM()` string typing confirmed and handled.
- `eslint`: clean on all touched files (one new `purity` error I introduced was fixed via mount-effect init).
- `npm run build`: exit 0, 97/97.
- After deploy: confirm sin1 in function logs + dashboard TTFB; dev server prints `[dashboard] session/queries/total` timings.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
