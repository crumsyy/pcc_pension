# Walkthrough — Calendar status cleanup (display only)

## Changes (shared component → guest + receptionist calendars)
- `ReservationCalendar.js`: all hold variants fold into **Reserved** (mapping branch, priority table, `Hold` label, legend entry removed); **Booked** legend dot → sky blue; doc comment updated.
- `globals.css`: `.calendar-status-booked` → sky-blue tint (`#cff4fc`/`#0dcaf0`/`#055160`, matching canonical badge); `.calendar-status-courtesy-hold` deleted; palette comment updated.
- Untouched: hold business logic/APIs/scheduler/terms/emails; Check-In/Out, Stay Range, Conflict, Reserved, Occupied, Maintenance rendering and date logic.

## Verification
- `npm run build` → success.
- Manual: hold dates render Reserved yellow; Booked dates sky blue; legend has no Hold entry — in guest room forms and receptionist bookings/reservations/check-in.
