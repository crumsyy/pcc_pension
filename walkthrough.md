# Walkthrough — 5 Room Statuses + Revenue-Hero Dashboard (no commit/push yet)

## Changes (your three requests, all confirmed choices applied)

**1. Room statuses: Available / Reserved / Booked / Occupied / Maintenance — Cleaning removed.**
- Semantics: `Reserved` = unconverted holds; `Booked` = confirmed bookings awaiting check-in (new — these showed as Reserved before); `Occupied` unchanged; `Maintenance` display label unchanged (`Under Maintenance` in DB).
- `lib/db.js` sync now produces `Booked` for Pending-family bookings (holds-only still `Reserved`); `Cleaning` preservation dropped, so any legacy `Cleaning` rows flip to `Available` on the next sync run.
- Writers: booking creates + all conversion paths set `Booked` (holds stay `Reserved`); checkout/in-house cancel free rooms straight to `Available` (supersedes the Cleaning step from the last push — `completeBookingAndFreeRoom`, receptionist billing, audits, notifications, and all checkout copy updated).
- Bonus fix: guest booking create unconditionally forced rooms `Occupied` on payment — now only when checking in now.
- Colors/legends/badges updated everywhere (`DashboardClient`, `RoomsClient`, receptionist dashboard board + legend, guest cards already handled Booked). `tidb_schema.sql` ENUM swaps `Cleaning`→`Booked`; REQ116 + skeleton comment updated. Grep-verified: no `Cleaning`/housekeeping status code remains (only a guest-chat amenity blurb and reset-script log text, both unrelated).

**2. Dashboard Booked card.** KPI row is now Total / Available / Booked / Occupied / Reserved / Maintenance — counts come from the existing `roomStats` GROUP BY, nothing hardcoded.

**3. Revenue hero.** Revenue + activity row moved above the room-status cards; board retitled “Room Status Board” with the housekeeping donut removed (grid full-width, legend kept).

## Verification (actually performed)
- `npm run build`: Compiled successfully, 97/97. `npx eslint` on all touched files: 17→17 identical (zero new findings). Guard harness 20/20.
- **Not run here (no test DB; live DB must not be mutated):** staging check that rooms transition Reserved→Booked on conversion, Booked→Occupied on check-in, →Available on checkout, Booked card counts, and revenue row order. Cases carry over from the prior walkthrough.

Say `"push"` only when you want commit + push.
