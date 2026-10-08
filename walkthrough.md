# Walkthrough — Admin Inter Font + Flatpickr

## Changes (no commit/push yet)
- Font (admin-only): `SidebarClient.js` root adds `admin-inter` for Administrator role; `globals.css` forces Inter on `.admin-inter, .admin-inter *` + flatpickr popup. Landing/guest/receptionist untouched.
- `FlatDatePicker.js` extended (backward-compatible): `dateFormat` prop (`m/d/Y` default, `Y-m-d` supported), iso/slash normalization, dual onChange (event `{target:{name,value}}` when `name` set, else plain string). Landing plain-string usage unaffected.
- Admin pickers converted (formats preserved):
  - `bookings/page.js`, `reservations/page.js` — native `type="date"` → `FlatDatePicker dateFormat="Y-m-d"` (API param unchanged).
  - `users/UsersClient.js` (dob x2), `inventory/page.js` (x3), `reports/page.js` (dateFrom/dateTo), `purchase-orders/page.js` (x3), `discounts/page.js` (x4) — `DateInput` → `FlatDatePicker dateFormat="m/d/Y"`; helpers (`isValidDate/toDbDate/toUiDate`) kept.
- Grep check: no `<DateInput` component and no `type="date"` remain under `app/admin` (only helper imports).

## Verification
- `npx eslint app/components/FlatDatePicker.js` clean.
- `npm run build` success, 96/96 pages.
- Other eslint findings on admin pages pre-existing (hooks/img), untouched.

## Manual check (please review)
1. Open each admin page → all text (sidebar, headings, badges, tables, modals) renders in Inter.
2. Each date field opens flatpickr calendar; select/clear/type works; filters and form submits behave as before.
3. Landing hero pickers still work (plain-string regression check).

Awaiting review. Say `"push"` only when you want commit + push.
