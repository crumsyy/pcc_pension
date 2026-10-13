# Walkthrough — Manage room types & floors

## Changes
- `api/admin/rooms/route.js`: 6 new admin actions — create/update/delete room type (unique names, min/max occupancy, foam) and floor (unique names, rename); deletes blocked while any room references them.
- `RoomsClient.js`: "Manage Types & Floors" button + modal (type list/form, floor list/form, guards via confirm + toasts); room create/edit dropdowns refresh from the same fetch so new entries are immediately usable.

## Verification
- `npm run build` → success.
- Manual: add type + floor → create room with them; duplicates rejected; in-use delete blocked with message.
