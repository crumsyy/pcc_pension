# Walkthrough — Guest desktop header bar

## Changes
- New `app/guest/dashboard/GuestHeader.js` (desktop only, `d-none d-lg-flex`): sticky pcc-blue bar with eyebrow + per-tab title, tab search with Ctrl+K, bell with unread badge → notifications tab, `ThemeToggle`, `HeaderProfile`.
- `GuestDashboardClient.js`: desktop right side wrapped in flex column with `GuestHeader` above `main`. Mobile layout untouched.
- Notes: staff `NotificationBell` not reused (hardcodes staff URLs); search covers tabs only, no room-record search.

## Verification
- `npm run build` → success.
- Manual: desktop header visible on all tabs with correct titles; search jumps tabs; bell badge mirrors sidebar; mobile unchanged.
