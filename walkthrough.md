# Walkthrough — Sticky-free orders shell

## Changes
- `globals.css`: new desktop-only (`≥992px`) shell classes — page flex column `height:100%`, row `flex:1/min-height:0`, catalog column internal scroll, tray column fit-content + cap. Mobile unchanged.
- Both order pages: shell classes attached; tray sticky kept as harmless fallback; no logic changes.

## Why this round is different
- Three sticky variants failed inside this app shell, so sticky is no longer load-bearing: the page itself can't scroll past the viewport on desktop — catalog scrolls left, tray sits right with its pinned footer.

## Verification
- `eslint`: no new issues. `npm run build`: exit 0.

## Deploy protocol
1. Deploy, hard refresh (Ctrl+Shift+R).
2. Bundle proof: backspace a qty to empty (must clear).
3. Breakfast in tray → no page scroll; catalog scrolls independently; Submit always visible.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
