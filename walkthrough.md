# Walkthrough — Selective Master-Data Reset Checklist (no commit/push yet)

## Changes
- **`lib/db.js`**: `MASTER_RESET_AREAS` (users, discounts, rooms, amenities, products, purchase_orders, inventory) + `resetMasterData()` (preflight guard counts, caller spare + identity checks, same txn + TRUNCATE-fallback pattern, per-area counts, `system_audit`) + `getResetPreview()` (read-only counts). `resetGuestTransactions` untouched.
- **`app/api/admin/reset-transactions/route.js`**: `POST {areas}` (default `['transactions']` = today's exact behavior; transactions run first, then masters) + `GET ?preview=1`. Guard violations return 400 with the reason.
- **Dashboard reset modal**: 8-area checklist with live row counts + linked-row badges, Transactions pre-ticked, typed `DELETE` gate, per-area result summary. Same theme/styles.
- Rules enforced: dependents present + Transactions not selected → refused with guidance; your own login never deleted; IDs restart on fully-cleared tables.

## Verification (actually performed)
- `npx eslint`: the single finding is pre-existing HEAD text (`Today's Revenue` apostrophe). `npm run build`: 97/97.
- Live destructive flows NOT run here (no test DB; this wipes data) — staging only, starting with your Users + Discounts case after a transaction reset.

Say `"push"` only when you want commit + push.
