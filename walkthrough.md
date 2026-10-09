# Walkthrough — Inline Header Searchbar

## Changes (no commit/push yet)
- Header search is now a directly typeable input (no dialog): typing filters sidebar pages live with debounced room/stay results beneath it; hover/arrows highlight, click/mousedown/Enter navigates, Esc or click-away closes, Ctrl+K focuses. Reuses the proven keyword + room fetch logic.
- Dead dialog block removed; new dropdown styles added.

## Verification
- `npx eslint`: 0 errors (2 pre-existing img warnings).
- `npm run build` success, 97/97 pages.

## Manual check
1. Click the bar and type immediately; suggestions narrow per keystroke.
2. Type "rooms" → Room Management; Enter/click navigates (room picks land prefiltered).
3. Esc closes; Ctrl+K refocuses; empty query shows all pages.

Awaiting review. Say `"push"` only when you want commit + push.
