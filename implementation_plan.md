# Implementation Plan — Flatpickr Dark Mode + NotificationBell Dark Fix

## 1. Findings
- Theme = `pcc_theme` localStorage → `data-bs-theme` on `<html>` + `body.dark-theme`; dark surfaces in `globals.css` (`#1e293b` cards etc.). Form inputs already themed — only popups/surfaces are broken.
- **Flatpickr**: all instances go through the single `app/components/FlatDatePicker.js`; base CSS imported once in `app/layout.js`; the calendar popup (`.flatpickr-calendar` on `body`) has zero dark rules. Official `flatpickr/dist/themes/dark.css` exists (117 rules, only `@keyframes` at-rules) — mechanically scoping it under the dark selectors is faithful and complete.
- **NotificationBell** (`app/components/NotificationBell.js`): cards already go dark via global `.bg-white` override, but white leaks through (your screenshot): `.pcc-notif-dropdown` hardcodes `background:#ffffff` + light border (448-451), list area hardcodes `#f8fafc` (602), card hover hardcodes `#f1f5f9` (472). Text colors use `text-dark/text-secondary/text-muted`, which already have global dark overrides — no text changes needed.

## 2. Changes
1. **New `app/flatpickr-dark.css`**: official dark theme, every selector prefixed with `[data-bs-theme="dark"]` and `body.dark-theme` variants (generated once by script from the installed package — no hand edits, no light-mode impact), imported in `app/layout.js` after the base flatpickr CSS.
2. **`NotificationBell.js`** (dropdown only): dropdown bg → `#1e293b` + dark border in dark mode; list area `#f8fafc` → theme-aware (CSS class, dark `#0f172a`); cards `bg-white` → dedicated `pcc-notif-card` class (light `#fff`, dark `#0f172a` + `#334155` border); hover dark variant. Accent borders, badge colors, blue header, pills untouched.
- Out of scope: sonner `Toaster` theming, any other component.

## 3. Verify
- Regeneration check: re-run prefix script → byte-identical output (proves no hand drift); `npx eslint` (stash-compared) + `npm run build`; visual pass needs your browser (I can't render): open any date picker + notification bell in dark mode.
- Commit/push only on `"push"`.

## 4. Questions
1. Official-dark-theme look for calendars (Recommended) vs custom PCC-tinted dark calendar?
2. Proceed?
