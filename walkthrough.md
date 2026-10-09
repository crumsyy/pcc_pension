# Walkthrough — Users Page Compaction

## Changes (no commit/push yet)
- Top row merged: tabs left + create button right (one row instead of two); filter card tightened; table card padding reduced.
- `.users-compact` density (28px action buttons, tighter cells/badges — same proven pattern as PO).
- Table cap retuned so 10 compact rows + footer fit laptop heights with room to spare.

## Verification
- `npx eslint`: only the pre-existing finding.
- `npm run build` success, 97/97 pages.

## Manual check
1. No dead gap up top; 10 rows + footer visible with whitespace below.
2. If any dead space persists, send a DevTools element id from the gap and I'll target it exactly.

Awaiting review. Say `"push"` only when you want commit + push.
