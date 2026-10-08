# Implementation Plan — Faster Admin Portal Loading

## 1. Goal
Make admin management pages feel instant and cut wasted database/API load. No API/DB schema changes except additive query params if server pagination is approved; no visual/behavior changes.

## 2. Findings (verified)
- **No search debounce anywhere**: every keystroke in Search boxes refetches from MySQL — `bookings/page.js:52-69`, `reservations:52-69`, `UsersClient:155-167`, `RoomsClient:257-270`, amenities `:117-128`, products `:111-122`, discounts `:159-181`, inventory, POs. Typing "pool" = 4 full round-trips + 4 cache entries (cache key embeds raw search text).
- **Hot polling loops**: dashboard every 3.5s (`DashboardClient.js:78`), inventory every 3s (`inventory:324-325`), POs every 5s (`:223`), discounts every 5s (`:177-181`, recreated per keystroke via deps, no visibility gate). Each tick runs full-list queries even when the tab is hidden or a previous fetch is still in flight.
- **Reports API does ~20 sequential round-trips** (`reports/route.js`: lines 26, 77, 80, 91, 269, 331, 470-667 — only a few `Promise.all` batches). Single report load = sum of all latencies.
- **No server-side pagination**: bookings/reservations/users/movements fetch ALL rows, ship + render them, then slice 8-10 client-side.

## 3. Scope
- IN: `app/admin/*` pages + `app/api/admin/reports/route.js` (+ `bookings`/`reservations` routes only if server pagination approved).
- OUT: DB schema/indexes, receptionist/guest, visual changes, refresh-freshness guarantees (polling stays, just hygienic).

## 4. Design
- **P1 — Debounced search (350ms)** on all admin list pages: local `searchInput` state bound to the input, `useEffect` timer commits to the query `search` state; cache keys/fetches only fire on committed value. Same pattern × 10 pages. Biggest keystroke-load win.
- **P2 — Polling hygiene** (dashboard, inventory, POs, discounts): skip tick when `document.hidden`, skip when a fetch is already in-flight (ref guard), keep intervals as-is. Halves wasted queries with zero freshness change while visible.
- **P3 — Parallelize reports queries**: group independent `dbQuery` calls into `Promise.all` batches (filter-options + counts + series), identical results, latency ≈ slowest batch instead of sum.
- **P4 (optional, needs approval) — Server-side pagination** for bookings + reservations (highest-churn lists): API accepts `page, limit` (defaults preserve current full-list behavior for other callers), returns `{ rows, total }`; client sends its page state and renders server rows. Cuts transfer + DB sort/scan per navigation.

## 5. Steps
1. P1 debounce × pages; P2 guards × 4 polls.
2. P3 reports batching.
3. (If approved) P4 bookings/reservations server pagination.
4. `npx eslint` touched files (fix only new issues) + `npm run build`; manual: typing fires 1 request, background tabs idle, reports visibly quicker, lists identical.
5. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- Network tab: typing a word = 1 list request (not N); hidden tab = no polling; reports load faster with identical numbers; build passes.

## 7. Risks
- Debounce adds ~350ms before search results refresh — standard, imperceptible.
- P4 changes API shape (additive, backward-compatible defaults).
