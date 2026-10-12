# Walkthrough — Guest Bookings nav tab (Upcoming + Past)

## Changes
- `navConfig.js`: new **Bookings** item (`bi-journal-bookmark-fill`) between Rooms and Orders (sidebar + mobile bottom nav both consume it).
- `GuestDashboardClient.js`:
  - Extracted `renderReservationHistoryCard` / `renderBookingHistoryCard` (canonical account versions; booking card keeps the active-booking anchor id) + Upcoming/Past grouping (active booking statuses; reservations past = Cancelled/Released/Expired/No Show/Completed/Booked).
  - New `bookings` tab: header + Upcoming (holds + upcoming/ongoing stays) + Past groups; wrapper keeps `reservations-history-section` / `bookings-history-section` IDs.
  - Removed duplicated histories from Home and Account tabs; Quick Action My Bookings → `bookings` tab; all notification/URL deep-links retargeted (`account`/`home` → `bookings`); `?tab=bookings` recognized.
- Note: notification ID extraction still parses raw numeric IDs, but new notifications carry public codes — deep-links fall back to section scroll (same as unknown-ID behavior).

## Verification
- `npm run build` → success.
- Manual: Bookings tab shows Upcoming/Past; empty states; card actions (pay/cancel/proceed/billing) unchanged; notification clicks land on bookings tab; file encoding verified intact after edit (no mojibake, peso signs intact).
