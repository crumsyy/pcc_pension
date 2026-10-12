# Implementation Plan — Bulletproof sticky order tray (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Problem
- Tray still runs past the viewport (scheduling panel pushes totals/Submit below the fold) even with the footer split; steppers render red in prod, so at minimum the deployed bundle predates the fix — but the pin itself needs hardening regardless.

## 2. Root cause hypothesis
- `sticky` currently sits on the tray *card* inside a stretched grid column; depending on ancestor overflow/flex behavior the stick + cap doesn't engage and the whole column scrolls with the page. Textbook-robust pattern is sticky on the *column* with a height-capped card.

## 3. Proposed changes (`receptionist/orders/page.js` + `GuestOrdersContent.js`)
1. Move stickiness to the tray column: `align-self-start`, `position sticky`, `top 28px`, `max-height calc(100vh - 56px)`; card becomes `h-100 d-flex flex-column overflow-hidden` (drop `sticky-top` from card).
2. Keep: header fixed, single internal scroller (items + scheduling), footer (totals + Submit) pinned via `flex-shrink-0`.
3. No logic changes (steppers blue / editable qty already in).

## 4. Verification
- `eslint`; `npm run build` 97/97; visual: long tray + breakfast scheduled → footer visible without page scroll; empty tray unchanged; mobile modal unchanged.
- After deploy: hard refresh (Ctrl+Shift+R) to bypass cached bundle, then retest.

## 5. Risks
- Low: CSS positioning only.

## 6. Questions
- Q1: Proceed?
