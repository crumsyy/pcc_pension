# Implementation Plan — Tray back to side, search bar above tabs (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Correction
- Revert the tray relocation: Order Tray returns to the right side column (in normal flow, **without** the deleted fixed overlay — that rule stays deleted so the original overlap cannot return).
- Move the **search bar** above the category tabs row instead, on both guest and receptionist order pages. No logic changes.

## 2. Proposed changes
1. **Guest**: delete top tray card; restore `row` with catalog (`col-md-7...`, incl. mobile bottom spacer) + tray side column (`col-md-5`, no fixed class); move search input block above the tabs row, full width.
2. **Receptionist**: same restore (catalog `col-lg-7 col-xl-8` + tray `col-lg-5 col-xl-4`, history mode hides tray as before); search above tabs.
3. Mobile floating bar + modal unchanged.

## 3. Verification
- Tray on right, search above tabs, no overlap at any width; `npm run build` passes.

## 4. Risks
- Low: restores prior layout minus the overlay bug.

## 5. Questions
- Q1: Proceed?
