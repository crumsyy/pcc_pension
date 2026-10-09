# Walkthrough — Sidebar-Sourced Palette + Header Page Titles

## Changes (no commit/push yet)
- New `lib/portalMeta.js`: per-role nav data (labels match sidebars 1:1) + route→title map; palette destinations now come from it; header renders the current page's eyebrow + title (fallback to previous static text on unknown routes).
- Stripped duplicate in-page title blocks across 4 admin + 5 admin + 7 receptionist files (action buttons kept, right-aligned; empty rows dropped; dashboards + reports untouched).

## Verification
- `npx eslint` on touched files: only pre-existing findings.
- `npm run build` success, 97/97 pages.

## Manual check
1. Every sidebar destination appears in the palette with identical labels; selecting navigates correctly.
2. Each route shows its title in the blue header with no in-body duplicate (dashboard welcomes excepted).
3. Action buttons intact and right-aligned; no orphaned empty header rows.

Awaiting review. Say `"push"` only when you want commit + push.
