# Walkthrough — Single-trigger toasts + notifications

## Changes
- `reservations/page.js`: `handleCancel` + `handleUpdateSubmit` now fire exactly one toast per path (`showAlert` only; direct `toast.success/error` removed). Create flow untouched (already single).
- `NotificationBell.js`: module-scope `toastedNotifIDs` set shared by both mounted instances — ring/chime/sonner fire once per notification; per-instance `<Toaster>` removed.
- `SidebarClient.js`: one shared sonner `<Toaster>` at layout root (covers mobile + desktop bells, both roles).

## Verification
- Live DB check: one audit row per staff user per cancel → duplicates were purely client-side; now impossible (shared set + single Toaster).
- `eslint`: no new issues. `npm run build`: exit 0.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
