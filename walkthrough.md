# Walkthrough — Guest profile dropdown (mobile + desktop)

## Changes
- New `GuestProfileMenu.js`: pill button (avatar + ellipsis-capped name + chevron) with Profile / Log Out dropdown; closes on outside click / Escape.
- `GuestDashboardClient.js`: mobile bar uses menu (name capped at 110px, logout icon button removed); extracted `openEditProfile()` reused by Account tab button; unused `HeaderProfile` import removed.
- `GuestHeader.js`: desktop header uses same menu (140px cap) with `onProfile`/`onLogout` wired to the same modals.

## Verification
- `npm run build` → success.
- Manual: mobile name fits; both menus open Profile modal and logout confirm correctly.
