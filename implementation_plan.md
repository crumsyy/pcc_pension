# Implementation Plan — Room Statuses (No Cleaning) + Dashboard Revenue Hero

## 1. What you asked (my read — correct me in feedback)
1. Room statuses become exactly: **Available, Reserved, Booked, Occupied, Maintenance** — no Cleaning/housekeeping status anywhere.
2. Admin dashboard KPI row gains a **Booked** card.
3. Dashboard's main information becomes **Today's + Month revenue**, not room statuses.

## 2. Proposed semantics (needs your confirm)
- **Available** — free for sale.
- **Reserved** — unconverted reservation holds (48h courtesy holds, future reservations).
- **Booked** — confirmed bookings awaiting check-in (converted, Pending-family). *This is new: today these rooms show as Reserved.*
- **Occupied** — checked-in stays (Active Stay family). Unchanged.
- **Maintenance** — display label; DB keeps `Under Maintenance`. Unchanged.
- Checkout and in-house cancel set the room straight back to **Available** (reverts my Cleaning change from the last push — explicitly superseded by this request). Any legacy `Cleaning` rows flip to `Available` automatically on the next `syncRoomStatuses` run.

## 3. Files to change
- **`lib/db.js`**: sync recompute produces `Booked` for Pending-family bookings (today yields `Reserved`); holds-only still `Reserved`; drop `Cleaning` preservation; `completeBookingAndFreeRoom` → `Available` + messages; keep `Canceled` exclusion.
- **Writers `→ 'Booked'`** (confirmed, not-yet-checked-in): `api/receptionist/bookings` create, `api/guest/bookings` create, `api/receptionist/reservations` convert, `api/guest/reservations/convert`, guest PATCH convert, paymongo auto-settle. Holds stay `Reserved`. Checkout/cancel paths → `Available`; UI copy (`BillingTab`, `PaymentsTab`, check-in page, audits, notifications) reverted to Available; check-in/occupant guards drop `Cleaning` (keep Maintenance).
- **`app/admin/dashboard/DashboardClient.js`**: KPI row adds `Booked` card (6 cards; counts come free from the existing `roomStats` GROUP BY); **Revenue row moved above** the status cards as the hero; board retitled “Room Status Board”, donut + Cleaned/Not-Cleaned counts removed, legend/badges gain `Booked` (info cyan `#0dcaf0`, matches reservation Booked badge), `Cleaning` badge case dropped.
- **`app/admin/rooms/RoomsClient.js`**: `getStatusColor` gains `Booked`, drops `Cleaning`.
- **`database/tidb_schema.sql`**: ENUM swaps `Cleaning` → `Booked` (runtime is VARCHAR anyway; keeps seed truthful). Check `migrate.mjs`/scheduler for `Cleaning` refs during implementation.
- **Verify-only**: receptionist dashboard + reports occupancy for `Cleaning`/`Booked` display handling; `roomStats` needs no API change.

## 4. Questions
1. Is the Reserved = holds / Booked = confirmed-awaiting-check-in split correct?
2. Checkout → Available with no cleaning step — confirmed?
3. Dashboard: (a) revenue hero row first, status cards kept below (recommended); (b) delete the room-status cards row entirely; (c) keep order, enlarge revenue?
4. Proceed?

## 5. Acceptance
- No `Cleaning`/housekeeping UI, colors, counts, or writes remain in code (grep-verified); room boards/legends show the 5 statuses incl. Booked with colors.
- Dashboard opens with revenue as the hero; Booked card counts confirmed-unchecked-in rooms (sync-derived, not hardcoded).
- Full lifecycle still enforced (guards untouched except status-wording reverts); build + eslint (stash-compared) + guard harness green; commit/push only on `"push"`.
