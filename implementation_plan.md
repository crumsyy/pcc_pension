# Implementation Plan — Revert catalog, drop FREE row, tray-only bounded box (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Agreed scope
1. Revert every catalog-side change from the sticky rounds (row/catalog/root shell classes, catalog internal scroll) — catalog returns to natural page scroll.
2. Remove the `Delivery / Service Fee: FREE` row from tray totals (both files).
3. Tray-only fix, no sticky: capped tray card + single internal scroller (guest selector + items + scheduling) + pinned footer (totals + Submit). Footer lives outside the scroller, inside the card.

## 2. Concrete edits
- `globals.css`: delete the `.orders-workspace-*` shell block (keep everything else).
- `receptionist/orders/page.js` + `GuestOrdersContent.js`: remove `orders-workspace-shell/row/catalog` classes; tray column keeps plain static + cap; card keeps flex column + internal scroll div + footer div (already split); delete FREE-fee row JSX in both footers.
- No logic, submit, stock, or stepper changes.

## 3. Verification
- `grep orders-workspace-` → zero matches; `grep "Service Fee" tray` → gone; `eslint`; `npm run build` 97/97.
- Post-deploy proof: FREE row absent (bundle proof) + breakfast in tray → Submit visible with zero page scroll; catalog scrolls naturally.

## 4. Risks
- Low: reversions + deletions + footer placement; no behavior changes.

## 5. Questions
- Q1: Proceed exactly as above?
