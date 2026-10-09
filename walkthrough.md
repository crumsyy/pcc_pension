# Walkthrough — User Tabs, STF/GST IDs, ID Search

## Changes (no commit/push yet)
- `UsersClient.js` only: Staffs/Guests tabs (shadcn Tabs, with counts) replace guest-hiding; IDs role-prefixed (`STF-`/`GST-`, same hash); column + view modal relabeled "User ID"; search is local/instant across name/email/code (full, partial, dashless); tab switch resets page/search/role; role options follow tab; staff-only creation + Guest edit lock kept.

## Verification
- `npx eslint`: only pre-existing findings; no leftovers (`searchInput`/`USR-` gone).
- `npm run build` success, 97/97 pages.

## Manual check
1. Tabs show correct counts; switching resets filters.
2. IDs prefixed and stable; typing full/partial ID (with/without dash) finds the user.
3. Guests listed; create still staff-only; pagination per tab.

Awaiting review. Say `"push"` only when you want commit + push.
