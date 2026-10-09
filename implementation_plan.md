# Implementation Plan — Sidebar-Driven Palette + Header Page Titles

## 1. Goals
(a) Palette results mirror the sidebar exactly (single source). (b) Page eyebrow + title move into the blue header (MEDIPRIME-style); page bodies keep only their action buttons. No API/DB changes.

## 2. Current State (verified)
- Palette destinations are hardcoded in `SidebarClient.js` (can drift from sidebar); page titles live in ~15 page-level header blocks (eyebrow + `section-title` + action buttons in one row).
- Header left is static text (`headingText`); dashboard welcomes are personalized (`Welcome, {name}`).

## 3. Scope
- IN: new `lib/portalMeta.js` (per-role NAV links + ROUTE_TITLES map); palette reads NAV links; header renders eyebrow/title from map by pathname; strip page-level title blocks (actions preserved, rows re-justified); dashboard welcomes stay (personalized exception, header shows "Dashboard").
- OUT: APIs, actions, logic.

## 4. Design
- `portalMeta.js`: `ADMIN_NAV` / `RECEPTIONIST_NAV` [{path,label,keywords}] matching sidebar labels 1:1; `pageTitle(pathname)` with longest-prefix match + role fallbacks.
- Header: eyebrow (white-50 caps) over title (bold white) left; search stays centered; right cluster unchanged.
- Page edits: delete the left eyebrow/title div only; if the row keeps action buttons, switch row to `justify-content-end` (or keep spacing harmless); if nothing remains, drop the row. Tabs/filters/tables untouched.
- Palette room/stay results + `?search=` prefill unchanged.

## 5. Steps
1. Meta lib + header + palette source swap. 2. Page header strips in batches (subagents, no commits). 3. Lint + build; manual per-route header titles, palette coverage, no orphaned empty rows. 4. Walkthrough; no commit/push until `"push"`.

## 6. Acceptance
- Every sidebar destination appears in palette with identical labels; every management route shows its title in the header with none duplicated in-body (dashboard welcome excepted); build passes.

## 7. Risks
- Large mechanical diff (~15 files) — mitigated by row-preserving edits + per-file build check. Dynamic titles beyond dashboard welcome: none found.
