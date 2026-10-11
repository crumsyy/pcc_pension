# Walkthrough — Collapsed receptionist sidebar icons-only

## Changes
- `app/components/ReceptionistSidebarNav.js`
  - Accepts `collapsed = false`; when collapsed: label hidden, Inquiries badge hidden, icon centered (`justifyContent: center`), native `title` tooltip with label (mirrors admin pattern).
- `app/components/SidebarClient.js`
  - `renderNavLinksList(isDesktopSidebar = false)` with `hideLabels = isDesktopSidebar && collapsed`; desktop sidebar passes `true`, mobile offcanvas omits it so the 260px drawer always shows labels (also fixes admin offcanvas inheriting desktop collapse state).

## Verification
- `eslint`: 1 pre-existing error + 2 pre-existing warnings only; nothing new.
- Visual to confirm: collapse → 7 centered icons with tooltips, no clipped letters, no badge overflow; expand → labels + badge back; mobile drawer unaffected.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
