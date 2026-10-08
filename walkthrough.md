# Walkthrough — Audit Slim Rows + Viewport Cap

## Changes (no commit/push yet)
- `inventory/page.js` audit table: date cells `text-nowrap` (rows drop from ~75px to ~50px); scroller cap `350px` → `max(180px, calc(100vh - 500px))` so the footer stays on screen at laptop heights. Stays 10/page; disposal panel untouched.

## Verification
- `npx eslint`: only the pre-existing fetch-effect finding.
- `npm run build` success, 96/96 pages.

## Manual check
1. Audit footer fully visible with whitespace below at ~768px and ~930px heights; dates on single lines.
2. Short screens fall back to in-table scroll with footer visible.

Awaiting review. Say `"push"` only when you want commit + push.
