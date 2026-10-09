# Implementation Plan — shadcn-Style Switch for Inventory Toggles

## 1. Goal
Replace the Bootstrap switches for "Low Stock Only" (stocks tab) and "Expired Only" (batches tab) with modern shadcn-style Switch UI. No behavior/logic changes.

## 2. Current State (verified from screenshots + code)
- Both are Bootstrap `form-check form-switch` checkboxes (`inventory/page.js`: `lowStockOnlySwitch`, `expiredOnlySwitch`) with emoji/label text beside them.
- No Switch component exists; will hand-build shadcn-style (React Aria `Switch`) like checkbox/dialog/tabs — NOT CLI code.

## 3. Scope
- IN: new `components/ui/switch.jsx` + theme/Inter CSS; swap the two inventory switches (labels, badges, and filter behavior verbatim).
- OUT: other switches elsewhere, APIs, counts.

## 4. Design
- `Switch({ isSelected, defaultSelected, onChange, isDisabled, children })`: React Aria Switch with sliding-thumb styling, PCC-blue when on, `data-selected/disabled/focus-visible` states, dark-theme parity, Inter labels.
- Inventory: same `checked/onChange` wiring (`lowStockOnly`, `expiredOnly`), same surrounding labels/badges; only the checkbox element itself is replaced.

## 5. Steps
1. Component + CSS. 2. Swap both toggles. 3. Lint + build; manual toggle on/off filtering + theme check. 4. Walkthrough; no commit/push until `"push"`.

## 6. Acceptance
- Both toggles look modern, animate, filter identically, build passes.

## 7. Risks
- None; presentational swap.
