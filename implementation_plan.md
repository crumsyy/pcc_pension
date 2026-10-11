# Implementation Plan — Placeholders, Tabs, Dashboard Skeleton (approved, proceed)

1. Icon-only bigger placeholders: receptionist orders card (2), GuestOrdersContent (2), guest dashboard room cards + gallery (6). Drop text spans, icon ~2rem, layout identical.
2. shadcn Tabs/TabList/Tab on receptionist reservations + bookings active/history pairs; labels, counts, reset side-effects kept.
3. `app/receptionist/dashboard/loading.js` skeleton for instant paint.
Verify: eslint stash-compared, build 97/97. Commit/push only on "push".
