# Walkthrough — Rooms: Delete "Ro", Numeric Numbers, Footer Order

## Data change (done, verified)
- Room "Ro" (roomID 360002, Available) had 0 reservations + 0 bookings → hard-deleted (`DELETE` affected 1 row, re-SELECT confirms 0 remaining). Temp scripts removed.

## Code changes (no commit/push yet)
- `RoomsClient.js`: room-number inputs strip non-digits live (create + edit); create/edit submit guards reject non-`^\d+$` with a clear error; create modal footer swapped to Cancel (left) → Create Room (right). Edit modal footer untouched.
- `app/api/admin/rooms/route.js`: create + update reject non-numeric numbers with 400 (direct API POSTs covered too).

## Verification
- `npx eslint`: only pre-existing findings on untouched lines.
- `npm run build` success, 96/96 pages.

## Manual check
1. Room list has no "Ro" (active or archived).
2. Typing letters in Room Number does nothing; submitting numeric works; direct API POST with letters returns 400.
3. Create modal shows Cancel left, Create Room right.

Awaiting review. Say `"push"` only when you want commit + push.
