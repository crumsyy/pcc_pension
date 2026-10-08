# Walkthrough — Red Stock Out + Audit Panel Fit

## Changes (no commit/push yet)
- `inventory/page.js`: Stock Out badges `text-bg-dark` → `text-bg-danger` in both movement tables (dashboard Recent Stock Movements + logs Audit History).
- Audit History scroller cap `calc(100vh - 380px)` → fixed `350px`, matching the sibling Disposed panel so both footers sit on screen. Pagination (already present) unchanged otherwise.

## Verification
- `npx eslint`: only the pre-existing fetch-effect finding.
- `npm run build` success, 96/96 pages.

## Manual check
1. Stock Out badges red in both tables.
2. Audit footer fully visible with whitespace below, aligned with the Disposed panel.

Awaiting review. Say `"push"` only when you want commit + push.
