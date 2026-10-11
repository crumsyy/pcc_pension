# Walkthrough — Reserved Merge + Reservation Lifecycle (no commit/push yet)

## Changes (per your chain: Reserved→Booked→Occupied→Completed, plus terminal branches)
- **Global merge**: `normalizeReservationStatus` maps holds → `Reserved`; `RESERVATION_STATUSES` is now `[Reserved, Booked, Cancelled]`, so the admin overview renders 3 cards with merged counts and filter. Hold-expiry notes key off `rawStatus` (still shown); receptionist hold countdown/convert UI keys off raw values + `isCourtesyHold` (preserved); guest timeline simplified to Reserved→Booked(/Cancelled).
- **Reserved→Expired**: scheduler writes `Expired` (was `Released`) with matching notification titles; `Expired` added everywhere `Released` was already excluded (guest API CASE + schedule query).
- **Booked→No-Show**: manual `noshow` + auto booking No-Show cascade the linked `Booked` reservation; receptionist/guest API CASEs now map `No Show`→`Cancelled` for display.
- **Booked→Cancelled**: guest self-cancel cascades to its linked reservation (mirrors receptionist); room release covers `Booked` rooms.
- Convert/cancel paths already matched the diagram — untouched. Raw DB values (`On Hold`, `Courtesy Hold`, `Released`) still work everywhere via backstop checks; only display + terminal writes changed.

## Verification (actually performed)
- Guard harness 23/23 (incl. new merge assertions). `npx eslint`: 26→26 identical. `npm run build`: 97/97.
- Live flows (holds expiring, no-show cascades) need staging — no test DB here.

Say `"push"` only when you want commit + push.
