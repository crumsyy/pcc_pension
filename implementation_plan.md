# Implementation Plan — Tray stick hardening + deploy verification (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. What the screenshot proves
- Blue steppers + no Immediate pill = bundle has `1146fc9`, but the still-broken pin matches either a missing `4d21f7c`/`3d369df` or a genuinely defeated sticky. Both get handled.

## 2. Proposed changes (both order files)
1. Row: add explicit `align-items-start` (stops any stretch interference with the sticky column).
2. Tray column: `height: fit-content` + keep sticky/top/cap — deterministic capped box.
3. Card/scroll/footer chain as-is (verified: header fixed, single internal scroller, footer `flex-shrink-0`).
4. No logic changes.

## 3. Verification
- `eslint`; `npm run build` 97/97.
- Post-deploy proof protocol (do this before reporting back): hard refresh, then (a) backspace qty to empty — must clear (proves latest bundle), (b) breakfast in tray → Submit visible without page scroll.

## 4. Risks
- None (CSS positioning only).

## 5. Questions
- Q1: Proceed?
