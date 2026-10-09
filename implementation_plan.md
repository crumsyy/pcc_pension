# Implementation Plan — Rewrite Palette Filtering (Single Pass, No Identity Tracking)

## 1. Goals
Header search opens every time with correct live results; typing filters; Enter/click navigates. Same UI/API, no backend changes.

## 2. Root Cause (verified by reading)
`CommandList` tracks results in a `Set` of element object identities, but `Children.map/toArray/cloneElement` all mint new identities — matches can never equal, so the list renders empty/broken and the control feels dead (button itself is fine and deployed).

## 3. Scope
- IN: `components/ui/command.jsx` `CommandList` internals only (same props/children API; parents untouched).
- OUT: everything else.

## 4. Design
- One recursive render pass: walk children in order, assign positional indexes, test each `CommandItem` against the query inline, collect the visible ones into a render-order array (ref) for Enter-pick; drop emptied groups. No Sets of elements, no cross-pass identity, no `pick()` re-walk. Keyboard/mouse drive a position index into the visible array.

## 5. Steps
1. Rewrite. 2. Lint + build. 3. Walkthrough; no commit/push until `"push"`.
4. Retest note: confirm Vercel Ready on the new commit + hard refresh before judging (stale deploys mimicked this bug twice).

## 6. Acceptance
- Open → Pages listed; type "rooms" → Room Management; Enter/click navigates; room results appear; build passes.

## 7. Risks
- None structural; pure simplification of one component.
