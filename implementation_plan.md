# Implementation Plan — Fixed right-rail order tray (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. What you asked (from screenshots)
- Full order tray fixed on the right, always fully visible while scrolling — NOT the floating pill (removing that entirely).

## 2. Approach (no sticky, no page redesign)
- Tray card becomes viewport-fixed on desktop only (`lg+`, new `.orders-tray-fixed` class in a media query; mobile/tablet unchanged static flow).
- Geometry (computed, not guessed): `top:96px` (clears sticky app header), `bottom:20px`, `right:36px` (exact grid alignment: main 24 + container 24 − row 12 + col 12), `width:inherit` (live-tracks the grid column across viewport/sidebar-collapse changes), `z-index:1010` (under header/modals).
- Card keeps flex column + internal scroll + pinned footer; tray column keeps grid space (empty, holds layout).
- Removes: floating pill component + renders + footer/form refs (both files); sticky leftovers on tray columns.

## 3. Verification
- `eslint`; `npm run build` 97/97.
- Visual: any catalog scroll position → full tray visible right, internal items scroll, footer always on screen; mobile + history tab + guest modal unchanged.

## 4. Risks
- Low-medium: fixed positioning is viewport-absolute (immune to the shell issues that killed sticky); offsets are derived from the actual spacing scale. Sidebar collapse safe (right side unaffected, width inherits live).

## 5. Questions
- Q1: Proceed?
