# Implementation Plan — Inventory Dashboard Movements Panel Fit

## 1. Goal
Recent Stock Movements panel (Inventory → Dashboard tab) shows its pagination footer with breathing room, no bottom cut. No API/DB/count changes (stays 10/page).

## 2. Root Cause (verified `inventory/page.js:893-935`)
The table scroller is fixed at `maxHeight: 350px`, ignoring the ~450px of content stacked above it on the dashboard tab (page title, tab bar, 6 stat cards, card header). 350 + footer overflows the flex:1 container, so the footer renders below the fold and is clipped (screenshot).

## 3. Scope
- IN: one style value on the dashboard movements scroller.
- OUT: other tabs, counts, APIs.

## 4. Design
- `maxHeight: 'max(200px, calc(100vh - 500px))'` (replaces fixed `350px`): reserves ~500px for header + title + tabs + stats + card chrome + footer, so the footer stays visible with room to spare at normal heights; `200px` floor keeps the table usable on short screens (internal scroll, footer still pinned below in flow).
- Other tabs already use viewport-relative caps (`calc(100vh - 380px)`) suited to their slimmer headers — untouched.

## 5. Steps
1. One-line edit in `inventory/page.js`.
2. `npx eslint` file + `npm run build`.
3. Manual on localhost: dashboard footer fully visible with whitespace below at ~900px height; short screens scroll the table only.
4. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- Footer visible with breathing room, no cut; build passes.

## 7. Risks
- None; single viewport-relative cap.
