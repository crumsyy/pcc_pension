# Implementation Plan — Distinct Cancel vs Yes-Cancel buttons (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Root cause (verified)
- `globals.css:233` forces **all** `.btn-secondary` red app-wide ("Ensure all Cancel buttons are styled Red").
- The dialog's safe Cancel button uses `btn-secondary` → renders red, identical to destructive `btn-danger` Yes, Cancel. Indistinguishable choices.

## 2. Proposed changes
1. **`globals.css`**: add dedicated `btn-dialog-cancel` (neutral grey, placed after the red rule so it wins) used only for dialog safe-action buttons.
2. **`ModalDialog.js`**: default cancel button uses `btn-dialog-cancel` instead of `btn-secondary` (explicit `danger` cancelVariant still red). Destructive confirm stays red. Affects all `ModalDialog` consumers consistently (guest + receptionist confirm dialogs).

## 3. Verification
- Visual: Cancel grey, Yes-Cancel red, in light + dark themes; `npm run build` passes.

## 4. Risks
- Low: one new class + one component default; no logic changes. Deliberately not touching the global red-secondary rule (other screens may rely on it).

## 5. Questions
- Q1: Proceed?
