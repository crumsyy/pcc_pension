# Walkthrough — Remove manual release (lock) button

## Changes (`reservations/page.js` only)
- Deleted the orange lock / “Manually Release Courtesy Hold” button from hold rows.
- Deleted the now-dead `handleReleaseHold` handler.
- Cancel flow, Convert/Edit buttons, auto-release scheduler, and the server `release_hold` action untouched.

## Verification
- `grep`: zero matches for handler/label/icon.
- `eslint`: no new issues. `npm run build`: exit 0.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
