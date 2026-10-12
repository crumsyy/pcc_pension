# Implementation Plan — Tray cap fix + typeable qty drafts (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Problems (from screenshots)
1. Tray still exceeds viewport → Submit below fold. Cause: card `h-100` (% of indefinite column height) defeats the `maxHeight` cap chain; flex scroller never engages.
2. Qty `1` can't become `6` (becomes `16`): controlled input commits every keystroke, empty/backspace is ignored.

## 2. Proposed changes (both `receptionist/orders/page.js` + `GuestOrdersContent.js`)
1. Drop `h-100` from tray cards (keep `maxHeight`, `overflow-hidden`, flex column); column keeps `align-self-start` + sticky + cap. Card height = min(content, viewport cap); inner scroller + pinned footer then engage.
2. New per-file `QtyInput` (draft text state, syncs from props when blurred): free typing incl. backspace-to-empty, commits ≥1 int on blur/Enter (else reverts); steppers unchanged (receptionist stock-cap alert reused on commit overflow).

## 3. Verification
- `eslint`; `npm run build` 97/97; visual: long tray → footer visible, no page scroll needed; type 6 over 1 works; stock cap still alerts.

## 4. Risks
- Low: CSS cap correction + isolated input component; submit/stock logic untouched.

## 5. Questions
- Q1: Proceed?
