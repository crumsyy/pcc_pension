# Implementation Plan — Restore Admin Action Button Icons (Inter-safe)

## 1. Goal
Restore visible action-button icons in `app/admin/*` (view = eye, etc.) while keeping Inter for all text. No API/DB changes.

## 2. Current State (verified)
- `app/components/ActionButtons.js:67-258` already assigns icons: view `fa-eye`, print `fa-print`, edit `fa-pen`, suspend `fa-user-slash`, activate/approve `fa-circle-check`, deactivate `fa-circle-xmark`, cancel `fa-ban`, stock-in `fa-box-archive`, create-PO `fa-file-circle-plus`, archive `fa-box-archive`, delete `fa-trash` (or archive variant), restore `fa-rotate-left`. Tooltips via Bootstrap `data-bs-toggle="tooltip"`.
- Button colors in `app/globals.css:1223-1328` (`.action-btn-*`) intact.
- Suspected killer: admin Inter override (`globals.css` `.admin-inter, .admin-inter * { font-family: Inter !important }` + `SidebarClient.js` root `admin-inter` class) forces Inter onto `<i class="fa-...">` / `<i class="bi-...">` glyphs, which require `Font Awesome 6 Free` / `bootstrap-icons` families — icons render blank. Same affects inline `inventory/page.js:1010,1031,1111,1125` icons.

## 3. Scope
- IN: `app/globals.css` (Inter override scoping), `app/components/ActionButtons.js` (1 icon disambiguation only).
- OUT: admin pages' handlers, APIs, fonts loading, landing/guest/receptionist.

## 4. Design
- CSS: exclude icon elements from Inter force:
  `.admin-inter *:not(i):not(svg):not(path):not([class*="fa-"]):not([class*="bi-"]) { font-family: Inter... !important; }`
  plus explicit restore:
  `.admin-inter i[class*="fa-"] { font-family: "Font Awesome 6 Free" !important; }`
  `.admin-inter i[class*="bi-"] { font-family: "bootstrap-icons" !important; }`
  (FA weight comes from FA CSS; do not override font-weight.)
- Component: change stock-in icon `fa-box-archive` → `fa-boxes-stacked` (distinct from archive); keep all others incl. view `fa-eye`.
- Keep `admin-inter` text coverage (sidebar, headings, badges, tables, modals, flatpickr).

## 5. Steps
1. Edit `globals.css` override block only.
2. Edit `ActionButtons.js` stock-in icon only.
3. `npx eslint` on edited component + `npm run build`.
4. Manual: check admin tables (users/rooms/amenities/products/inventory/POs/discounts/bookings/reservations) — colored buttons with eye/pen/trash/etc. + tooltips; Inter text unchanged.
5. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- All admin action buttons show distinct icons (eye for view) with existing colors/tooltips.
- No Inter regression on text; no other portals affected.
- Build passes.

## 7. Risks
- FA/BO icon family names version-sensitive — verify against loaded CDN CSS (FA 6.6.0, BI 1.11.3); fallback: use `:where()` exclusion only (no explicit restore) if family names differ.
