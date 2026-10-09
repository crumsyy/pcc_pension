# Implementation Plan — shadcn Tabs (4 Pages) + Search-Crash Hardening

## 1. Goals
(a) Amenities, Products, Inventory, Discounts tabs → shadcn `Tabs` (same pattern as Rooms/Users). (b) Make it structurally impossible for header search to crash a page + diagnose the deployed crash. No API/logic changes.

## 2. Findings
- Tab structures verified: amenities (boolean active/archived), products (products/meals/archived), inventory (5 custom tabs), discounts (3 tabs) — all map to controlled `selectedKey`.
- The black "couldn't load" page is the browser's tab-crash UI (renderer died), not an app 404/500. Code review of all new shell code found no unbounded loops (palette is dormant until opened; effects all have cleanups; cache keys bounded). Prime suspects are environmental (20 open tabs + extensions in screenshot) or a bad deploy. The deployed commit must be confirmed.
- Regardless of cause, the shell currently has no error boundary: ANY exception in the header palette would kill the whole admin layout. That gets fixed no matter what.

## 3. Scope
- IN: 4 tab conversions; new `components/ui/error-boundary.jsx` wrapping the palette (and user menu) so failures degrade to a hidden/quiet state instead of a dead page; palette `try/catch` already present stays.
- OUT: APIs, tab logic/counts, other pages.

## 4. Design
- Tabs: controlled `selectedKey` + existing handlers (`handleShowActive`, `setActiveTab`, etc. — including inventory's per-tab page resets and products' catFilter presets) wired through `onSelectionChange`; labels identical (incl. "Rooms"-style renames? No renames requested — keep labels verbatim).
- Error boundary: class component with `getDerivedStateFromError` + `componentDidCatch` (console only), fallback `null` for palette/menu regions.

## 5. Steps
1. Tabs × 4. 2. Boundary + wraps. 3. Lint + build. 4. Walkthrough; no commit/push until `"push"`.
5. Diagnostics I need from you (answer in chat): Vercel deployment for the latest commit shows Ready? Crash on every page or only discounts? Same crash in Incognito (extensions off)?

## 6. Acceptance
- Four pages on shadcn tabs with identical behavior; palette errors cannot kill the shell; build passes.

## 7. Risks
- If the crash is environmental, code cannot fix it — diagnostics answers decide next steps.
