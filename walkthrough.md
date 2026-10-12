# Walkthrough — 3-stage booking display (Path A, display-only)

## Changes (no API/transition/gating edits)
- `StatusBadge.js`: new `foldBookingFlow` prop — billing mid-flow norms render as blue **Occupied**; reservations untouched.
- Guest: timeline 5 nodes → 3 (Booked, Occupied, Completed); booking card + ActiveStayPanel badges folded; timeline header neutral.
- Receptionist: bookings list badges folded (incl. dead local color helper aligned); check-in pill text + class folded.
- Cancelled / No Show rendering unchanged; all filters/logic match raw statuses as before.

## Verification
- `npm run build` → success.
- Manual: finalized/paid stays show Occupied in both portals; timeline matches screenshot as 3 nodes; balances/checkout behavior identical.

## Notes
- Full finalize-flow removal stays a separate project (gates in guest/accounts payments, checkout, reports still enforce Bill Ready).
