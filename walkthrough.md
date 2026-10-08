# Walkthrough — Username Rule Out, shadcn Checkbox + Dialog

## Changes (no commit/push yet)
- Username checklist row + submit rule removed (5 exact rules; backend parity intact).
- New `components/ui/checkbox.jsx` + `dialog.jsx` (shadcn-style API over React Aria, `.jsx`): Checkbox `isSelected/onChange/isInvalid`; Dialog set with Trigger/Header/Title/Description/Body/Footer/Close; theme-aware + Inter CSS in `globals.css` (+ `react-aria-components` dep).
- Register agreements rebuilt on them: linked words open the Dialog with verbatim document content; scroll-to-bottom gating, badges, and submit validation preserved 1:1; old `ModalPortal` blocks deleted (also cleared a pre-existing lint error).

## Verification
- `npx eslint`: only the pre-existing DOB-effect finding on an untouched line; new files clean.
- `npm run build` success, 96/96 pages.

## Manual check
1. Checklist shows 5 rows ticking live; all-green ⇔ submit passes.
2. Clicking Terms/Privacy words opens the Dialog; checkbox uncheckable until bottom reached; accept enables check; light/dark + Inter correct.

Awaiting review. Say `"push"` only when you want commit + push.
