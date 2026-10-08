# Implementation Plan — Admin Inter Font + Flatpickr Date Pickers

## 1. Goal
In `app/admin/*` only: force Inter font everywhere, and replace date inputs with flatpickr. No API/DB changes.

## 2. Current State (verified)
- Font: `app/globals.css:4` already loads Inter + Fraunces + Space Mono; `--font-body: Inter`, but headings use `--font-display: Fraunces` and tags use `--font-tag: Space Mono` (e.g. `SidebarClient.js:146,199-200` nav labels, many `section-title`/`display-font` usages). Admin has no font scoping — inherits mixed fonts.
- Admin layout: `app/admin/layout.js` renders `SidebarClient` (`app/components/SidebarClient.js:107` root `d-flex...`, main wrapper `pcc-main-wrapper:245`, header/sidebar). No admin-specific font class.
- Date pickers in admin (21 hits):
  - Native `type="date"` (YYYY-MM-DD): `bookings/page.js:161` (`dateFilter`), `reservations/page.js:172` (`dateFilter`).
  - `DateInput` (MM/DD/YYYY, event-style `onChange {target:{name,value}}`): `users/UsersClient.js:573,750` (dob), `inventory/page.js:902,1431,1539`, `reports/page.js:1376,1390`, `purchase-orders/page.js:870,1028,1269`, `discounts/page.js:993,1003,1116,1126`.
  - `FlatDatePicker` (`app/components/FlatDatePicker.js`) currently emits plain string with `dateFormat m/d/Y` only — incompatible with DateInput event handlers and YYYY-MM-DD filters without an adapter.
- `flatpickr` dep + CSS already installed/imported (`package.json`, `app/layout.js:2`).

## 3. Scope
- IN: `app/components/FlatDatePicker.js` (extend, backward-compatible), `app/components/SidebarClient.js` (add scope class only), `app/globals.css` (admin Inter override), admin date usages listed above.
- OUT: landing/guest/receptionist fonts + pickers, APIs, DB, skeleton files, `DateInput.js` source (kept for helpers).

## 4. Design
- Font (admin-only): add `admin-inter` class to `SidebarClient` root (`SidebarClient.js:107`) + CSS in `globals.css`:
  `.admin-inter, .admin-inter * { font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif !important; }`
  plus `.admin-inter .flatpickr-calendar { font-family: inherit; }`. This overrides Fraunces/Space Mono/monospace only inside admin portal.
- Flatpickr adapter: extend `FlatDatePicker` props with `dateFormat` (default `m/d/Y`) and dual `onChange`:
  - if `name` prop present → call `onChange({target:{name, value: dateStr}})` (matches `handlePromoInputChange`, `handleInputChange`).
  - else → call `onChange(dateStr)` for plain setters (landing `setCheckIn` keeps working), but also tolerate event-style wrappers by accepting string-or-event at call sites: `(val) => setX(typeof val==='string'?val:val?.target?.value)`.
  - Add `normalizeToSlash` + new `normalizeToIso` so `value/min/max` accept either format regardless of `dateFormat`.
- Replacements (format-preserving):
  - `bookings/page.js:161`, `reservations/page.js:172`: `<FlatDatePicker dateFormat="Y-m-d" value={dateFilter} onChange={...}>` (keeps YYYY-MM-DD API param).
  - All `DateInput` in admin → `<FlatDatePicker dateFormat="m/d/Y" ...>` keeping same `value/name/className/style/required/min/max`, handlers adapted only where they use `e.target.value` without `name`.
  - Keep `isValidDate/toDbDate/toUiDate` imports (validation/conversion logic unchanged).

## 5. Steps
1. Extend `FlatDatePicker.js` (dateFormat prop, dual onChange, iso/slash normalize, eslint clean).
2. `SidebarClient.js`: root div add `admin-inter` class (no other markup change).
3. `globals.css`: append admin Inter override block.
4. Replace admin date inputs listed in §2 (9 files), preserving props/formats/handlers.
5. `npm run build` + manual: each admin page renders Inter only (spot-check headings, badges, tables, sidebar); each picker opens flatpickr calendar, selects/clears, filters/submits unchanged.
6. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- No `type="date"` and no `<DateInput` remaining under `app/admin` (grep clean); flatpickr opens on all admin date fields.
- Computed font inside admin portal is Inter for headings, body, badges, tables, sidebar, modals, flatpickr popup.
- Build passes; landing + receptionist/guest unchanged.

## 7. Risks
- Dual onChange: landing regression risk — mitigated by default plain-string path + build + landing date smoke test.
- Google Fonts offline: falls back to system sans (acceptable; existing behavior).
