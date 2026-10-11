# Walkthrough — Remove Sync Now + Live Real-Time from dashboard header

## Changes (`ReceptionistDashboardClient.js` only)
- Deleted the `Live Real-Time` badge (+ `•` separator); header keeps title + date.
- Deleted the `Sync Now` button and its `spin-icon` keyframes block.
- Removed now-dead `isRefreshing` / `lastUpdated` state; `fetchDashboardData` takes no indicator param; polling, freshness-gated focus/visibility refetch, and `pcc-refresh-dashboard` event refresh all keep working silently.

## Verification
- `grep`: zero matches for `Sync Now|Live Real-Time|isRefreshing|spin-icon` in the file.
- `eslint`: clean.
- `npm run build`: exit 0.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
