# Walkthrough — Distinct dialog Cancel button

## Changes
- `globals.css`: new `btn-dialog-cancel` (neutral grey, wins over the app-wide red-secondary rule).
- `ModalDialog.js`: default safe Cancel uses the neutral class; explicit danger cancels stay red. Destructive confirms unchanged red.

## Verification
- `npm run build` → success.
- Manual: Cancel grey + Yes-Cancel red in light and dark themes, guest and receptionist dialogs.
