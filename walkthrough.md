# Walkthrough — Dropdown Footer Cut + Hover Blue (no commit/push yet)

## Root causes (from your screenshot)
1. The flip measured free space against the *window*, but the list lives inside the dialog body's scroll box — the footer overlapped the "free" space the math saw, so it still opened downward into the footer.
2. The blue is the shadcn active-item highlight (row 0 auto-selected + mouse-follow), not a bug in your data.

## Changes
- `app/admin/purchase-orders/page.js`: flip measures against the visible dialog-body rect (window fallback outside dialogs).
- `app/globals.css`: `po-pick-item` options stay plain in both themes (hover grey via existing menu behavior, no blue fill); keyboard Enter selection still works invisibly.
- Untouched: search, stock rows, selection, dialog, submit logic.

## Verification (actually performed)
- `npx eslint` (page): 5 problems before = 5 after (pre-existing). CSS braces balanced 483/483. `npm run build`: 97/97.

Say `"push"` only when you want commit + push.
