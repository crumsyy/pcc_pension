# Implementation Plan — Order Tray above tabs (guest + receptionist) (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Root cause (verified)
- `.orders-tray-fixed` (`globals.css:2253`, ≥1200px only) rips the tray out of flow into a fixed overlay (`top: 96px; right: 36px`), covering the search bar and catalog beneath it.

## 2. Proposed changes
1. **Guest (`GuestOrdersContent.js`)**: move the tray card above the tabs + search toolbar (full width, normal flow); delete the side-column wrapper and the mobile/desktop split for the tray card (mobile floating bar + modal stay as-is for scrolled use); drop `orders-tray-fixed`.
2. **Receptionist (`orders/page.js`)**: same — tray card above tabs, full width, catalog full width below; drop `orders-tray-fixed` / `orders-tray-col` usage.
3. **`globals.css`**: delete the now-unused fixed-rail rule (verified only these two usages).
4. No cart logic, checkout, modal, or API changes. Tray max-height/scroll kept sensible in-flow.

## 3. Verification
- `grep orders-tray-fixed` → zero hits; desktop ≥1200px shows tray above tabs with no overlap; mobile floating bar still opens the modal; `npm run build` passes.

## 4. Risks
- Low-medium: layout-only, but the desktop side-rail disappears — confirm the top-card layout is accepted.

## 5. Questions
- Q1: Proceed? Q2: Tray always expanded on top, or collapsible (collapsed when empty)?
