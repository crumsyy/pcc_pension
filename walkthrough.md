# Walkthrough — PO Compact Specificity + Sidebar Hydration Fix

## Changes (no commit/push yet)
- `globals.css`: `.po-compact` cell rule rewritten as `.po-compact .table-responsive table th/td` — higher specificity than the global cell rule, so compact padding genuinely applies (~38px rows).
- `SidebarClient.js`: collapsed state initializes `false` (matches server HTML) and applies the persisted preference in a mount effect — fixes the hydration-mismatch "1 Issue" dev error. Hooks order kept valid.
- Build passes 96/96; eslint 0 errors.

## Manual check (localhost http://localhost:3000, hard-refresh)
1. PO rows visibly tighter; all 8 + footer + restock 4 + footer on screen with breathing room, no cut.
2. Collapsed-sidebar preference still works; "1 Issue" badge gone.

Awaiting review. Say `"push"` only when you want commit + push.
