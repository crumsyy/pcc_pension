# Walkthrough — Modal Inter + shadcn Confirmations (Phase 0+1, no commit/push yet)

## Changes (2 files)
- **`app/globals.css`**: Inter enforcement for legacy Bootstrap modal surfaces (same pattern as tables/toasts) — every admin/receptionist/guest modal matches the app font immediately.
- **`app/components/ModalDialog.js`**: confirm shell rebuilt on shadcn `Dialog` primitives (React Aria). Same props/API/behavior: toast branch byte-identical, PCC-blue header, icon, message, variant buttons, submitting spinner, X button, non-dismissable overlay. All ~50 `showConfirm` calls upgrade with zero call-site changes.

## Verification (actually performed)
- `npx eslint`: identical counts before/after (pre-existing only). `npm run build`: 97/97. No leftover Bootstrap modal markup in the component.
- Staging checks needed: open any confirmation (archive/cancel/checkout/payment), X + Cancel + Confirm paths, Escape/backdrop must NOT dismiss, dark-mode confirm, cmd form modals still Bootstrap (Phase 2).

Say `"push"` only when you want commit + push.
