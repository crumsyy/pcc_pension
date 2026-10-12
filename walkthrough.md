# Walkthrough — Single toast per booking flow

## Changes (`bookings/page.js` only)
- Removed redundant direct `toast.success`/`toast.error` in create, update, check-in, check-out, and cancel flows (success + catch paths, 10 lines); each path now fires exactly one `showAlert`.

## Verification
- `grep toast.` → only the shared `toast.add` inside `showAlert` remains.
- `eslint`: no new issues. `npm run build`: exit 0.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
