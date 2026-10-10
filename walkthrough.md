# Walkthrough — Flatpickr Dark Mode + Notification Dark Fix (no commit/push yet)

## Changes
1. **New `app/flatpickr-dark.css`** (generated, not hand-written): the official flatpickr dark theme with all 185 selectors scoped under `[data-bs-theme="dark"]` / `body.dark-theme`. Covers every `FlatDatePicker` instance automatically (single shared component); light mode untouched. Imported in `app/layout.js` after the base flatpickr CSS. Regeneration is byte-identical (script asserts it).
2. **`app/components/NotificationBell.js`** (dropdown only): dark variants for the dropdown shell (`#1e293b`), list area (new `pcc-notif-list` class, dark `#0f172a` — replaces hardcoded `#f8fafc`), and card hover (`#334155`). Cards/text/pills/header untouched (already theme correctly).

## Verification (actually performed)
- Prefix script re-ran byte-identical; `npx eslint`: 3 problems before = 3 after (pre-existing); `npm run build`: 97/97.
- Browser visual pass still needed (I can't render): open any date picker + the bell in dark mode, and confirm light mode is unchanged.

Say `"push"` only when you want commit + push.
