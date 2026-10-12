# Implementation Plan — Sticky-free orders layout (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Problem
- Tray Submit still requires full-page scroll (screenshot proof, twice). `position: sticky` has now failed in three variants inside this app shell — root-cause hunting it further wastes more rounds than replacing it.

## 2. Strategy change
- Drop `sticky` entirely. New layout (desktop `lg+` only, via scoped CSS so mobile is untouched): the page becomes a bounded flex shell — tabs/search fixed, catalog column gets its **own internal scroll**, tray column is static with the existing capped card + internal scroll + pinned footer. The page itself never scrolls, so Submit is always on screen by construction. No sticky, no fixed positioning, no magic pixel heights (chain: bounded `main` → `height:100%` page → `flex:1/min-height:0` row → bounded columns).

## 3. Proposed changes
1. `globals.css`: add scoped `@media (min-width: 992px)` classes — `.orders-workspace-shell` (flex column, `height:100%`), `.orders-workspace-row` (`flex:1`, `min-height:0`, `align-items:flex-start`), `.orders-catalog-col` (`height:100%`, `overflow-y:auto`, `min-height:0`), `.orders-tray-col` (`height:fit-content`, capped).
2. `receptionist/orders/page.js` + `GuestOrdersContent.js`: attach the classes (page root, row, catalog col, tray col); remove `position:sticky/top` from tray columns (keep caps + internal scroll + footer as built).
3. Mobile (<lg): zero change — stacks and scrolls as today; mobile order modal untouched.

## 4. Verification
- `eslint`; `npm run build` 97/97.
- Manual: tall catalog + breakfast scheduled → page does not scroll; catalog scrolls left, tray fixed right with Submit visible; empty tray, history tab, and mobile unaffected.

## 5. Risks
- Medium-low: layout restructure, but pure CSS + class attachment; no logic, submit, or stock changes. If viewport is very short, both columns scroll independently (correct behavior).

## 6. Questions
- Q1: Proceed?
