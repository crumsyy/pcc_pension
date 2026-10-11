# Implementation Plan — Remove manual release (lock) button (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User request
- Remove the lock / “Manually Release Courtesy Hold” button from reservation rows — redundant with Cancel ([Image 1]).

## 2. Evidence / current state
- Button: `reservations/page.js:1163-1173` (orange `fa-unlock-keyhole`, in the courtesy-hold actions branch next to Convert/Edit). Only instance in the file.
- Handler: `handleReleaseHold` (`917-936`), called only from that button (1170). Calls API `release_hold`.
- Cancel flow stays untouched (separate handler + red X button); holds still auto-release via scheduler/cron.
- API `release_hold` action remains server-side (harmless; other callers: none found client-side — cron/scheduler use their own paths).

## 3. Proposed changes (only `reservations/page.js`)
1. Delete the lock button block (1163-1173).
2. Delete the now-dead `handleReleaseHold` (917-936).
3. No API changes; no changes to Convert/Edit/Cancel buttons.

## 4. Verification
- `grep "handleReleaseHold\|Manually Release\|fa-unlock-keyhole"` → zero matches.
- `eslint` (pre-existing families only); `npm run build` 97/97.
- Visual: hold rows show Convert + Edit + Cancel only.

## 5. Risks
- None: pure UI/handler removal; cancel + auto-release cover the use case.

## 6. Questions
- Q1: Proceed as planned?
