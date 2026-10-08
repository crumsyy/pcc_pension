# Walkthrough — Inventory Dashboard Movements Fit

## Changes (no commit/push yet)
- `inventory/page.js`: dashboard Recent Stock Movements scroller `maxHeight 350px` → `max(200px, calc(100vh - 500px))`, reserving room for title, tabs, stat cards, and the pagination footer. Stays 10/page; no logic/API changes.

## Verification
- `npx eslint`: only the pre-existing fetch-effect finding on an untouched line.
- `npm run build` success, 96/96 pages.

## Manual check (localhost http://localhost:3000, hard-refresh)
1. Inventory → Dashboard: movements footer fully visible with whitespace below; table scrolls internally only.

Awaiting review. Say `"push"` only when you want commit + push.
