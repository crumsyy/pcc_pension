# Walkthrough — Sidebar 1-Line Labels + Real Collapse Width

## Changes (no commit/push yet)
- `app/globals.css` (desktop media query): `.pcc-fixed-sidebar.sidebar-collapsed { width: 76px !important }` + sibling override `.sidebar-collapsed ~ .pcc-main-wrapper { margin-left: 76px !important }` so the rail and content offset actually shrink (the old `240px !important` rules were overriding the collapse state); width/margin transitions added.
- `SidebarClient.js`: nav gains `sidebar-collapsed` class when collapsed (admin only).
- Nav labels: single-line rule (`nowrap` + ellipsis) so `Inventory Management` stays on one line.

## Verification
- `npx eslint` on sidebar: 0 errors (2 pre-existing img warnings).
- `npm run build` success, 96/96 pages.

## Manual check (please review)
1. Expanded sidebar: `Inventory Management` on one line.
2. Collapse: rail narrows to icons-only and page content shifts left; expand restores 240px; choice persists; mobile drawer unchanged.

Awaiting review. Say `"push"` only when you want commit + push.
