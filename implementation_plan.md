# Implementation Plan — Inline Header Searchbar with Suggestions

## 1. Goal
Header search becomes a directly typeable input; matches drop down beneath it in place (MEDIPRIME-style). No dialog. No API changes.

## 2. Current State (verified from screenshot)
Palette dialog opens and lists correctly — mechanics proven. Only the interaction shape changes.

## 3. Scope
- IN: `SidebarClient.js` header block only (+ small CSS for the inline dropdown panel).
- OUT: dialog component (left in place, unused by header), destinations/room fetching, navigation targets.

## 4. Design
- Replace the search button with an inline `<input>` (same pill styling, magnifier icon, Ctrl+K hint). Typing filters destinations with the existing keyword algorithm + debounced room/stay fetch (reuse `handlePaletteQuery`).
- Suggestions render in an absolutely-positioned card under the input reusing `pcc-command-item` styles; mouse hover highlights, click navigates; ArrowUp/Down + Enter keyboard support; Esc or outside-click closes; Ctrl+K focuses the input.
- Results capped as today (9 pages + 6 records).

## 5. Steps
1. Header block rewrite. 2. Lint + build. 3. Walkthrough; no commit/push until `"push"`.

## 6. Acceptance
- Click input → type immediately (no popup); suggestions narrow live; Enter/click navigates; Esc closes; empty query hides dropdown; build passes.

## 7. Risks
- Dropdown overlap with page content: panel is absolutely positioned with high z-index inside the sticky header — verified pattern.
