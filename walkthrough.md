# Walkthrough — Palette Fetch-Loop Fix

## Changes (no commit/push yet)
- `SidebarClient.js`: `handlePaletteQuery` stabilized with `useCallback([role])` — one debounced fetch per actual query change instead of refiring on every render.
- `command.jsx`: dialog effect skips already-sent queries (ref guard).
- Verified live-site SSR healthy (proper auth redirect); crash is client-side tab death.

## Verification
- `npx eslint`: 0 errors (warnings only).
- `npm run build` success, 97/97 pages.

## Still needed from you (decisive for the crash)
1. Vercel deployment for the newest commit = Ready?
2. Crash on every page or only discounts?
3. Same crash in Incognito (extensions off)?

Awaiting review. Say `"push"` only when you want commit + push.
