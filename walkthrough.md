# Walkthrough — Restore Admin Action Button Icons

## Changes (no commit/push yet)
- `app/globals.css`: scoped Inter override to exclude icon glyphs — `i`, `svg`, `path`, `[class*="fa-"]`, `[class*="bi-"]` — plus explicit restore: FA icons → `"Font Awesome 6 Free"`, BI icons → `"bootstrap-icons"`. Text (sidebar, headings, tables, modals, flatpickr) stays Inter.
- `app/components/ActionButtons.js`: stock-in icon `fa-box-archive` → `fa-boxes-stacked` (archive keeps `fa-box-archive`); view stays `fa-eye`, edit `fa-pen`, delete `fa-trash`, restore `fa-rotate-left`, print `fa-print`, suspend `fa-user-slash`, activate/approve `fa-circle-check`, deactivate `fa-circle-xmark`, cancel `fa-ban`, create-PO `fa-file-circle-plus`.

## Verification
- `npx eslint app/components/ActionButtons.js` clean.
- `npm run build` success, 96/96 pages.

## Manual check (please review)
1. Open admin tables (users, rooms, amenities, products, inventory, purchase orders, discounts) → colored buttons show eye/pen/trash/etc. with hover tooltips.
2. Confirm admin text is still Inter and other portals unchanged.

Awaiting review. Say `"push"` only when you want commit + push.
