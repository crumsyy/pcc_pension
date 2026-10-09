# Implementation Plan — Fix Header Search (Server Down + Palette Identity Bug)

## 1. Goals
Header search button opens a working palette on localhost. No API/logic changes beyond the fix.

## 2. Findings (verified)
- **Localhost is down**: nothing listens on port 3000 (dev server died of OOM earlier and was never restarted) — a dead server produces exactly a "page couldn't load" browser error. Primary suspect.
- **Real palette bug regardless**: `CommandList` filters via `Set` of element object identities, but `Children.map/toArray` clone elements (new identities), so matches never equal and the list can render empty. Must index by traversal order instead.
- Dev-only `key={paletteOpen?...}` remount and query flow are otherwise sound.

## 3. Scope
- IN: rewrite `CommandList` filtering/rendering by traversal index; restart dev server with 4GB heap.
- OUT: features, APIs, other components.

## 4. Design
- Single recursive walk assigns each `CommandItem` a stable ordinal per render; the filtered set stores ordinals; render pass clones matches (active highlight + hover) and drops empty groups. No identity comparison anywhere.
- Dev server: `$env:NODE_OPTIONS='--max-old-space-size=4096'; npm run dev` in background.

## 5. Steps
1. Rewrite filtering. 2. Lint + build. 3. Restart dev server, smoke-check boot. 4. Walkthrough; no commit/push until `"push"`.

## 6. Acceptance
- Clicking search opens the palette with Pages listed; typing filters; Enter/click navigates; localhost stays up.

## 7. Risks
- Dev OOM may recur over very long sessions (polling-heavy app) — mitigation is the bigger heap + user restarts.
