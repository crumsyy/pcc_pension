# Implementation Plan — HCI pass on guest portal (mobile + desktop) (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Goal
Apply the 10 HCI principles across the guest portal, with mobile treated as first-class (not shrunk desktop) and desktop polished separately. No logic/API/business-rule changes — presentational + interaction only.

## 2. Phase 1 — Mobile foundation (highest impact)
- **Bottom nav**: safe-area inset, ≥44px targets, active-state clarity, badge counts readable.
- **Sticky/fixed coexistence**: floating order bar, chat bubble, and bottom nav never cover CTAs or inputs (audit every tab at 375px; add content insets where missing).
- **Tables → cards** on small screens (bookings/orders/history lists already card-based — verify the rest; e.g. notifications render non-table already).
- **Touch targets**: all icon-only buttons (pen, trash, chevrons, bell) get ≥44px hit areas via padding, visuals unchanged.
- **Feedback**: loading skeletons/spinners on tab switches and list fetches where missing; disabled states visibly distinct.

## 3. Phase 2 — Consistency + cognitive load (both form factors)
- **Consistency**: one button hierarchy (primary / neutral / danger), one badge language, one card radius (tokens), one empty-state pattern with icon + action.
- **Visibility/affordance/mapping**: section eyebrows on all tabs (as piloted on Home); destructive actions always red + confirm; primary action per screen visually dominant.
- **Constraints/error recovery**: destructive confirms already dialog-based (keep); inline field errors where missing; keep undo-safe flows (cancel windows) unchanged.
- **Simplicity/learnability**: plain-language labels (e.g. "Courtesy Hold" gets a one-line explainer where shown); reduce duplicate CTAs per card to one primary + overflow.

## 4. Verification
- `npm run build` passes; checklist per tab at 375px + 1440px, light + dark; no behavior diffs (screenshot review before push).

## 5. Risks
- Medium-large surface, presentational only. Phased commits; rollback per phase.

## 6. Questions
- Q1: Proceed Phase 1 first, or both phases in one pass? Q2: Any tab to exclude from restyling?
