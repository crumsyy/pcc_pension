# Implementation Plan — Palette Fetch Loop Fix + Crash Diagnostics

## 1. Goals
Eliminate the unbounded refetch cycle in the header palette (a renderer-memory suspect) and gather the decisive crash facts. No API/feature changes.

## 2. Findings (verified)
- Live-site SSR is healthy (`/admin/rooms` returns a proper auth redirect, no server error) — the black "couldn't load" page is the browser killing the tab renderer (typically OOM), happening client-side while logged in.
- Real defect found by reading: `handlePaletteQuery` is redefined on every `SidebarClient` render, so `CommandDialog`'s `[query, open, onQueryChange]` effect refires constantly while open — each fire restarts the 300ms fetch timer, and each fetch's `setRoomResults` re-renders, repeating forever (fetch → render → refire → fetch…).
- No other unbounded work found in new code (polling/intervals all have cleanups; cache writes are overwrites, not appends).

## 3. Scope
- IN: stabilize the callback (`useCallback`, `[role]` deps) + guard the dialog effect so identical queries don't reschedule; keep behavior identical.
- OUT: features, APIs, polling architecture.

## 4. Design
- `handlePaletteQuery = useCallback(..., [role])`; CommandDialog effect skips when `query` unchanged since last call (ref compare). Net effect: one debounced fetch per actual query change, zero render-driven refires.

## 5. Steps
1. Two edits. 2. Lint + build. 3. Walkthrough; no commit/push until `"push"`.
4. Still needed from you (decisive): crash on every page or only discounts? Same in Incognito with extensions off? Any red console text before it dies?

## 6. Acceptance
- Palette issues one network request per query change (verifiable in Network tab); no render-driven refetch loop in code; build passes.

## 7. Risks
- If crashes persist after this + deploy, cause is environmental (20 tabs/extensions) or data-specific — diagnostics answers decide.
