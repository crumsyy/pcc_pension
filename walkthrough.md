# Walkthrough — shadcn Tabs ×4 + Crash-Proof Header Search

## Changes (no commit/push yet)
- Amenities, Products, Inventory, Discounts tab bars → shadcn `Tabs` (controlled, existing handlers incl. presets/resets; labels verbatim).
- New `HeaderWidgetBoundary` (error boundary) wraps the search button, palette, user menu, and profile dialog — a widget failure degrades to hidden instead of killing the page. This directly addresses the black "couldn't load" screen: even in the worst case, the shell survives.
- Palette filtering rewritten on traversal ordinals (verified logic; prior identity bug could empty the list).

## Verification
- `npx eslint` on touched files: only pre-existing findings.
- `npm run build` success, 97/97 pages.

## Manual check + diagnostics still needed from you
1. Confirm Vercel deployment for the newest commit shows Ready, then retest the search (hard-refresh).
2. Tell me: crash on every page or only discounts? Same in Incognito (extensions off)? Any console error text?
3. If it still crashes with the boundary in place, the cause is outside our code (renderer OOM/environment) — the boundary guarantees the page itself stays up.

Awaiting review. Say `"push"` only when you want commit + push.
