# Implementation Plan — Stock Out Red Badge + Audit Panel Fit

## 1. Goal
On Inventory → Movement Logs (and dashboard movements): Stock Out badges red instead of black; All Stock Movements Audit History panel fits with its pagination footer visible. No API/DB/count changes.

## 2. Current State (verified `inventory/page.js`)
- Stock Out badge is `text-bg-dark` in two movement-badge mappings: dashboard table (`:917`) and audit history (`:1316`). Quantity `-N` text is already red.
- Audit panel (`:1295-1334`) is already paginated (`logsPaginated` + footer `:1332`) — the footer exists but is cut: its scroller cap `calc(100vh - 380px)` (~550px at 930px viewport) makes the card overshoot the viewport, unlike the sibling Disposed panel which uses fixed `350px` and fits (`:1265`).

## 3. Scope
- IN: badge classes (2 spots) + audit scroller cap (1 value).
- OUT: counts, pagination logic, other tabs, APIs.

## 4. Design
- `Stock Out` → `text-bg-danger` in both mappings (dashboard + audit). Other types unchanged (In: green, Borrow: yellow, Return: light-blue, fallback: red).
- Audit scroller `maxHeight` → fixed `350px`, matching the sibling Disposed panel so both cards align and both footers sit on screen.

## 5. Steps
1. Three small edits in `inventory/page.js`.
2. `npx eslint` file + `npm run build`.
3. Manual: Stock Out badges red in both tables; audit footer fully visible with whitespace below; disposal panel unchanged.
4. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- Red Stock Out badges; audit footer visible, no cut; build passes.

## 7. Risks
- None; class + cap changes only.
