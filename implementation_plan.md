# Implementation Plan — Register: Drop Username Rule, shadcn Checkbox + Dialog

## 1. Goals
(a) Remove the "not contain your username" checklist row + its submit rule (no username field exists). (b) Rebuild Terms & Privacy agreements with shadcn-style Checkbox + Dialog: linked words open dialogs, checkbox unlocks only after reading to bottom, theme-connected Inter UI. No API/DB changes.

## 2. Current State (verified)
- Register page: 6-row checklist + `containsUsername` submit gate; backend enforces only the other 5.
- Agreements: Bootstrap checkboxes + `ModalPortal` modals, scroll-gating, badges, submit validation.
- shadcn never initialized; `react-aria-components` not installed; project is JS; theme hooks `data-bs-theme`/`body.dark-theme`; `register-inter` scope exists.

## 3. Scope
- IN: username removal; `npm install react-aria-components`; new `components/ui/checkbox.jsx` + `dialog.jsx` (JS port, `@/*` paths); swap both agreement blocks preserving gating/badges/validation.
- OUT: APIs, other pages.

## 4. Design
- Checklist back to the screenshot's exact 5 rules; backend parity intact.
- Checkbox: `isSelected/onChange/isInvalid/isDisabled`; Dialog set: `DialogTrigger/Dialog/Header/Title/Description/Footer`; full document content moved verbatim; accept disabled until 30px-threshold scroll-bottom; theme + Inter styling.
- React Aria gives focus scope/aria-modal/labelledby.

## 5. Steps
1. Username removal.
2. Install dep; write components; lint new files.
3. Swap agreement blocks; rewire gating/accept/badges/validation.
4. Build + manual verification per acceptance.
5. Update `walkthrough.md`; no commit/push until exact keyword `"push"`.

## 6. Acceptance
- 5-row checklist, all-green ⇔ submit passes; linked words open dialogs; no accept without reading; theme + Inter correct; build passes.

## 7. Risks
- New dep + `.tsx`→`.jsx` port; fallback (same-API, zero-dep) only if port fails — will confirm first.
