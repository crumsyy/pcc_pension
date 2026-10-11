# Implementation Plan — Fix slow receptionist dashboard load (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Diagnosis (evidence-backed)
- `app/receptionist/dashboard/page.js:6-7`: `requireSessionRole` + `await syncRoomStatuses(false)` run serially before 12 parallel `dbQuery` calls (`page.js:24-108`).
- Session check (`lib/session.js:5-34`) = local JWT verify + 1 indexed `SELECT sessionToken FROM user`; runs twice per navigation (layout `app/receptionist/layout.js:8` + page `page.js:6`). Minor cost, pure waste.
- `syncRoomStatuses` (`lib/db.js:355-~500+`) = no-show sweeps with per-row UPDATE/INSERT loops + per-receptionist notification fan-out + scheduler import; awaited on dashboard page, dashboard API route (`route.js:12`, hit every 15s per open tab by `ReceptionistDashboardClient.js:55-59`), and ~10 other API routes. Module-level 30s throttle (`lib/db.js:357`) doesn't hold across serverless instances.
- No `loading.js` (deleted earlier) → navigation gives zero feedback until the server finishes all of the above.

## 2. Changes
1. **Instrument (temporary, dev-only):** `console.time/timeEnd` around session-check, `syncRoomStatuses`, and the `Promise.all` query block in `dashboard/page.js`; one real measurement to confirm the split. Remove after (or keep behind `NODE_ENV !== 'production'`).
2. **Unblock the sweep:** in `dashboard/page.js` and `api/receptionist/dashboard/route.js`, stop awaiting `syncRoomStatuses` (fire-and-forget NOT awaited, or drop the call — sweep already runs via `api/cron/check-expired-reservations`). Bump throttle `30s → 5min` in `lib/db.js:357` as backstop. No other routes touched.
3. **Dedupe session check:** wrap `getSessionDetails` body with React `cache()` (`lib/session.js`, `import { cache } from 'react'`) so layout + page share one DB lookup per request. Behavior identical (same return shape).
4. **Batch counts:** merge the 6 `COUNT(*)` dashboard queries into one conditional-aggregation query (`SUM(status=...)`) in both `dashboard/page.js` and the dashboard API route; map results to the same `initialData`/JSON keys. List queries (LIMIT 10/6) unchanged.
5. **Indexes:** run `EXPLAIN` on the sweep + dashboard queries; add missing indexes only if absent (`booking(status, checkInDateTime)`, `room(status)`, `reservation(status, reservationDateTime)`, `orders(orderDateTime)`). Verify existing schema first — no blind migrations.
6. **Instant navigation (optional):** add `app/receptionist/dashboard/loading.js` returning `null` so the route transition unblocks immediately with no skeleton flash.

## 3. Verification
- Dev timing logs show session <5% and sweep off the critical path; dashboard TTFB drops (target: single-digit roundtrips: 1 session + 1 counts + 5 lists).
- `eslint` touched files; `npm run build` 97/97.
- Manual: cold-load dashboard, switch tabs, confirm counts/lists identical; cron route still runs the sweep.

## 4. Risks
- Fire-and-forget sweep: unhandled rejection risk → attach `.catch`; sweep still runs via cron so no data-correctness change.
- `cache()` on session: per-request memoization only; concurrent-login protection semantics unchanged.
- Batched counts: same predicates, same keys; verify numbers match before/after.

## 5. Questions
- Q1: Include step 6 (`loading.js` → null)?
- Q2: Drop the dashboard-page sweep call entirely (cron owns it, recommended) or keep fire-and-forget?
