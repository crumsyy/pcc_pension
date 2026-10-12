# Implementation Plan — Sticky tray footer, blue steppers, typeable qty (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User requests ([Images])
1. Tray scrolls away the Submit button when many items + scheduling panel show → pin totals + Submit in a fixed tray footer.
2. Qty −/+ buttons red → blue.
3. Qty field typeable (not just steppers).

## 2. Evidence
- Receptionist tray (`orders/page.js`): card 1386 sticky + scroll div 1396 renders `renderOrderTrayContent()` = items list (own 280px inner scroll, 780) + scheduling panel (881) + totals (938) + submit (962) — submit lives inside the scroll flow.
- Steppers `btn-secondary` (818, 831); qty input `readOnly` (823-828); `handleUpdateQty` (489) already caps stock + removes at ≤0.

## 3. Proposed changes
1. Split tray content: scroll area keeps items list (drop its 280px inner cap → outer scroll is the single scroller) + scheduling panel; new footer (border-top) holds totals + Submit, always visible. Empty-cart state unchanged.
2. Steppers `btn-secondary` → `btn-primary`; trash stays red.
3. Qty input editable (`inputMode numeric`): onChange strips non-digits, ignores empty/NaN, commits ≥1 via existing `handleUpdateQty` (stock cap + alerts reused).

## 4. Verification
- `eslint`; `npm run build` 97/97; visual: long tray + breakfast scheduled → Submit pinned, blue steppers, type-to-set qty with stock cap.

## 5. Risks
- Low: layout split + input handler only; submit/stock logic untouched.

## 6. Questions
- Q1: Receptionist only, or mirror guest tray too (recommended: both)?
