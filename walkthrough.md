# Walkthrough — Icon Placeholders, shadcn Tabs, Dashboard Skeleton (no commit/push yet)

## Changes
1. **Icon-only bigger placeholders** (10 spots): receptionist order cards, guest order cards, guest room cards + gallery fallbacks — text spans removed, `bi-image` at 2rem, box sizes/layouts identical.
2. **shadcn Tabs** on receptionist Reservations + Bookings active/history pairs (labels, counts, reset side-effects kept; tables/filters untouched).
3. **`app/receptionist/dashboard/loading.js`** (new): instant skeleton paint while the server streams dashboard data.

## Verification (actually performed)
- `npx eslint`: 54 problems before = 54 after (pre-existing; new loading.js clean). `npm run build`: 97/97.

Say `"push"` only when you want commit + push.
