# Walkthrough — Guest confirms are real Yes/No dialogs

## Changes (only `GuestDashboardClient.js`)
- `showConfirm` now uses `type: 'confirm'` so the shared dialog renders a blocking Yes/No modal instead of a fire-and-forget toast. This also fixes the silent auto-execution: Cancel truly does nothing now.
- Cancel Booking + Cancel Reservation confirm buttons read **Yes, Cancel** (new optional label param; checkout request keeps Confirm).

## Verification
- `npm run build` → success.
- Manual: cancel flows open a blocking dialog; Cancel/X closes with no API call; Yes, Cancel runs once with spinner; result toasts unchanged.

## Notes
- Receptionist portals may share the same toast-instead-of-dialog pattern — flagged, untouched in this change.
