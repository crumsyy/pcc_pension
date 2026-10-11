# Implementation Plan — Remove Sync Now + Live Real-Time from dashboard header (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User request
- Remove the `Sync Now` button and the `Live Real-Time` badge from the receptionist dashboard header ([Image 1]).

## 2. Evidence / current state
- `ReceptionistDashboardClient.js:148-167`: header row renders date + `•` + green `Live Real-Time` badge (151-154) on the left, and the `Sync Now` button (158-167, calls `fetchDashboardData(true)`) on the right.
- `isRefreshing` state (line 11) exists only for that button (spinner class + `Updating...` label + `disabled`); `setIsRefreshing` is called only inside `fetchDashboardData(showIndicator)` and the button.
- `pcc-refresh-dashboard` custom event (line ~69: `fetchDashboardData(true)`) also passes `showIndicator=true` — no UI will consume it after removal, but the fetch itself still works.
- `spin-icon` keyframes (`170-177`) only serve the button icon.

## 3. Proposed changes (only `ReceptionistDashboardClient.js`)
1. Delete the badge block (lines 150-154: `•` separator + badge). Keep `Today — {date}`.
2. Delete the `Sync Now` button (158-167) and the `spin-icon` `<style>` block (170-177).
3. Simplify: `fetchDashboardData(showIndicator)` → drop the parameter; remove `isRefreshing` state + `setIsRefreshing` calls (keep `lastUpdated`, `lastFetchAtRef`, polling, focus gate, custom event — auto-refresh keeps working silently).
4. Update the polling comment (line 58) that references “Sync Now”.

## 4. Verification
- `grep -n "Sync Now\|Live Real-Time\|isRefreshing\|spin-icon" ReceptionistDashboardClient.js` → zero matches.
- `eslint` (pre-existing families only); `npm run build` 97/97.
- Visual: header shows title + date only; stats auto-refresh silently every 15s as before.

## 5. Risks / notes
- None behavioral for data: manual sync is gone, but 15s polling + focus-gate + `pcc-refresh-dashboard` event refreshes remain. If other code dispatches `pcc-refresh-dashboard` expecting a visible indicator, it will now refresh silently — acceptable per request.

## 6. Questions
- Q1: Proceed as planned?
