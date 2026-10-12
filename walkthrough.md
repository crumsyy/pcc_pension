# Walkthrough — Catalog width back + compact dropdown labels

## Changes
- Grid reverted to original `col-xl-8` / `col-xl-4` (both files); `orders-tray-col` / `orders-catalog-col` overrides deleted from CSS. Fixed 360px tray unchanged.
- Tray guest picker labels shortened to `Room 102 — LastName, FirstName` (UID/status stay searchable via keywords).
- `SearchableSelect`: dropdown clips horizontal overflow; option labels ellipsis-truncate (helps all pickers).

## Verification
- `eslint`: no new issues. `npm run build`: exit 0.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
