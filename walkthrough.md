# Walkthrough — Bulletproof sticky order tray

## Changes
- `receptionist/orders/page.js` + `GuestOrdersContent.js`: stickiness moved from the card to the tray column (`align-self-start`, sticky, capped at viewport height); card fills with internal scroll + pinned footer (dark-theme tray class preserved).

## Verification
- `eslint`: no new issues. `npm run build`: exit 0.

## Deploy note
- After deploy, hard refresh (Ctrl+Shift+R) — screenshots showed a stale bundle (red steppers). Then retest with breakfast scheduled: footer must stay put.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
