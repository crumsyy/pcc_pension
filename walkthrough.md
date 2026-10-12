# Walkthrough — Deterministic sticky tray box

## Changes (both order files)
- Content row: explicit `align-items-start`.
- Tray column: `height: fit-content` + sticky/top/cap (deterministic capped box for the card + internal scroll + pinned footer to work against).

## Verification
- `eslint`: no new issues. `npm run build`: exit 0.

## Deploy proof protocol (important)
1. Deploy, then hard refresh (Ctrl+Shift+R).
2. Backspace a qty to empty — must clear (proves latest bundle; stale bundles ignore backspace).
3. Add breakfast → Submit must stay visible without page scroll.
4. If it still fails after confirmed-latest bundle, screenshot again — then it's environmental and I'll switch strategy (fixed-height app-shell row).

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
