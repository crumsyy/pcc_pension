# Implementation Plan — Dropdown Final Fixes

## 1. Root causes (from your screenshot)
1. **Still cut by the footer**: my flip measures space against the *window*, but the list lives inside the dialog body's own scroll box — the footer overlaps the "free" space the math sees. Fix: measure against the visible dialog-body rect (fallback: window).
2. **Blue on hover**: that's the shadcn active-item highlight (keyboard auto-selects row 0; mouse-move follows). Fix: neutral option styling for this picker — light hover grey, no blue fill — via a scoped CSS rule that beats `.pcc-command-item[data-active]`; keyboard Enter still picks invisibly.

## 2. Changes (`app/admin/purchase-orders/page.js` + `app/globals.css` command section)
- `decideDirection`: closest `.pcc-dialog-body` rect (fallback window/viewport as today).
- Options get a `po-pick-item` class; CSS keeps them white/transparent with grey hover in both themes (dark-aware).
- Untouched: search, stock rows, selection, flip thresholds otherwise, submit logic.

## 3. Verify
- `npx eslint` (stash-compared) + `npm run build`; staging check (open downward with room, upward when crowded, hover neutral, Enter picks).
- Commit/push only on `"push"`.
