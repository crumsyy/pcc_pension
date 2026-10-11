# Implementation Plan — Selective Master-Data Clear with Checklist

## 1. Current state (verified)
- Reset = `resetGuestTransactions()` (`lib/db.js:1971`): FK_CHECKS=0 txn, TRUNCATEs 21 transaction tables + filtered `inventory_movement` delete, rooms → Available, counts + `system_audit`/`billing_audit` entries, receptionist notification. Route `POST /api/admin/reset-transactions` (`verifyAdmin`,़् default admin key fallback). Dashboard modal in `DashboardClient.js` (confirm + run + refresh).
- Master tables (from `tidb_schema.sql`, seeds like `role`, `payment_method`, categories never touched): Users & Guests (`user`, `guest`, `staff`), Discounts & Promos (`discounts`, `promotions`), Rooms (`room`), Amenities (`amenities`), Products (`products`).

## 2. Conflicts — read before approving (destructive)
1. **Orphans**: bookings/reservations/orders/billing/payments/notifications reference guests, rooms, discounts. Clearing a master area while those rows exist orphans them (billing math degrades to missing names/discounts). **Rule: server preflights; if dependent transaction rows exist and Transactions isn't also selected → 400 with "clear Transactions first" guidance.** After your usual transaction reset, counts are 0 and master clears proceed cleanly.
2. **Self-lockout**: the calling admin's `user` row is never deleted; operation aborts if it would leave zero active admins.
3. **IDs restart** (`AUTO_INCREMENT = 1` per cleared table, same as existing reset) — new rows reuse IDs; old external references (receipts) must be treated as historical.
4. Rooms cleared → rooms list empty until recreated; room rates/types/floors (config) are kept.

## 3. Changes
1. **`lib/db.js`**: new `resetMasterData({areas, userID, userName, userRole})` — area→table map (6 areas: `transactions` = today's exact behavior, `users`, `discounts`, `rooms`, `amenities`, `products`); per-area preflight counts; dependent-transaction guard; self/last-admin guard; same txn + TRUNCATE-fallback pattern; per-area counts + `system_audit` entry; response summary. `resetGuestTransactions` untouched (delegates or stays as-is for compat).
2. **`app/api/admin/reset-transactions/route.js`**: `POST {areas: [...]}` (default `['transactions']` = current behavior); new `GET ?preview=1` returning live row counts per area + dependent-transaction counts for the modal.
3. **`app/admin/dashboard/DashboardClient.js` reset modal**: checklist (Transactions pre-checked), per-area counts from preview, typed `DELETE` confirmation, ≥1 area required, disabled-while-running, refresh + result summary. Theme preserved.
- Out of scope: `reset_transactions.sql` script (left as-is), purchase orders/inventory batches (stock-valuation ties — follow-up on request), seeds/config tables (never cleared).

## 4. Questions
1. Area list as above (Recommended) vs add purchase orders / inventory batches now?
2. Block-on-dependents (Recommended) vs auto-cascade dependent transactions silently?
3. Proceed?

## 5. Acceptance
- Clearing Users + Discounts (your case, after a transaction reset) empties exactly those tables, restarts IDs, audits, and leaves everything else intact; guards proven by attempted violations (self-delete, last-admin, dependents-present); build + eslint clean; commit/push only on `"push"`.
