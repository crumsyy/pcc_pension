# Implementation Plan — Sidebar 1-Line Labels + Real Collapse Width

## 1. Goal
Fix two reported sidebar issues (screenshots): (a) `Inventory Management` wraps to 2 lines — force single line; (b) collapsing hides labels but width stays wide — actually shrink the rail. No API/DB changes.

## 2. Root Causes (verified)
- (b) `app/globals.css:1048-1066`: desktop `@media (min-width:992px)` forces `.pcc-fixed-sidebar { width: 240px !important }` and `.pcc-main-wrapper { margin-left: 240px !important }`, which override the inline `width: 76px` set by the collapse state in `SidebarClient.js` — so icons center but the rail never narrows (matches screenshot 2).
- (a) Nav label spans have no wrapping constraint, so the longest label (`Inventory Management`) wraps inside the 240px rail (screenshot 1).

## 3. Scope
- IN: `app/globals.css` (collapsed overrides + label single-line rule), tiny `SidebarClient.js` toggle (add `sidebar-collapsed` class when collapsed).
- OUT: nav items, collapse behavior/state, other portals.

## 4. Design
- CSS (inside the existing desktop media query):
  `.pcc-fixed-sidebar.sidebar-collapsed { width: 76px !important; }`
  `.pcc-fixed-sidebar.sidebar-collapsed ~ .pcc-main-wrapper { margin-left: 76px !important; }`
  plus `transition: width .2s, margin .2s` on both (inline transition on nav already exists; add margin transition via CSS).
- `SidebarClient.js`: nav `className` gains `${collapsed && isAdmin ? 'sidebar-collapsed' : ''}` (keep inline width as fallback).
- Single-line labels: `.pcc-fixed-sidebar .nav-link span:last-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }` — full text stays readable at 240px; longest label fits on one line (verify visually; font-size stays 0.88rem).

## 5. Steps
1. Edit `globals.css` + one-line class toggle in `SidebarClient.js`.
2. `npx eslint` changed JS file + `npm run build`.
3. Manual: expanded → `Inventory Management` on one line; collapse → rail narrows to ~76px icons-only and content shifts left; expand restores; preference persists; mobile drawer unchanged.
4. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- Label never wraps; collapse visibly narrows rail + content margin; build passes.

## 7. Risks
- `~` sibling selector depends on nav/main-wrapper staying siblings in `SidebarClient.js` — true today; noted in code comment.
