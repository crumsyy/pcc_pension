# Implementation Plan — Users Page Compaction (Merge Top Rows + Compact Table)

## 1. Goal
Eliminate the dead space between the create-button row and tabs; fit all 10 rows + footer on screen with breathing room. No logic/count/API changes.

## 2. Current State (verified)
- `UsersClient.js`: separate create-button row, `Tabs mb-3`, filter card `mb-4 p-1.25rem`, table scroller capped `calc(100vh - 280px)`, standard-density rows (~55px with 32px action buttons). Footer already renders — the waste is vertical rhythm, not clipping logic.

## 3. Scope
- IN: `UsersClient.js` top-row merge + spacing + table cap; one `.users-compact` CSS block (28px action buttons, tighter cells/badges) mirroring the proven `po-compact` pattern.
- OUT: counts, filters, pagination, modals, APIs.

## 4. Design
- Single top row: tabs left, create button right (`justify-content-between`), `mb-2`.
- Filter card `mb-3`, padding `1rem`; table card padding `1rem`.
- `.users-compact` density: cells `.3rem`, action buttons 28px/`.8rem`, badges `.68rem` → ~42px rows.
- Scroller cap → `max(200px, calc(100vh - 300px))` so 10 compact rows show fully at laptop heights with the footer visible; short screens fall back to in-table scroll.

## 5. Steps
1. Merge + spacing + density + cap. 2. Lint + build. 3. Walkthrough; no commit/push until `"push"`.
4. If dead space persists after this (i.e., not inter-row rhythm), I'll need a DevTools element id from you to target it exactly.

## 6. Acceptance
- No dead gap; 10 rows + footer visible with room to spare at ~870px viewport; build passes.

## 7. Risks
- Denser rows/buttons (still ≥28px, desktop admin context) — stated.
