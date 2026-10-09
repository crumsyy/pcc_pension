# Walkthrough — Users Tabs Polish, Guest Creation, Cleaning Removal

## Changes (no commit/push yet)
- Users: role filter hidden on Guests tab (search widens); header button + modal + confirm + success follow the tab (`Create Staff`/`Create Guest`); Guest create locks role to Guest; API `create` branches into `guest` vs `staff` tables (same validations, role allow-list, transactional); footer → shared shadcn `AdminPagination` (hand pager deleted).
- Dashboard: Cleaning stat card + legend swatch removed (5 cards); donut math + detail badges untouched.

## Verification
- `npx eslint`: only pre-existing findings on untouched lines.
- `npm run build` success, 97/97 pages.

## Manual check
1. Guests tab: no role filter, wide search; per-tab Create buttons/modals/role locking.
2. Create a guest → GST- ID appears in Guests tab and can log in; create staff unchanged.
3. Users pager renders shadcn-style; dashboard shows 5 cards, no Cleaning swatch.

Awaiting review. Say `"push"` only when you want commit + push.
