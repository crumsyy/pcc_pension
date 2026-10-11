# Implementation Plan — Stop the Form Wipe (Real Fix)

## 1. Root cause (verified, and why the first fix couldn't work)
- Lines 503-543: a form-init effect depends on `[activeModal, guests, minResDate]`. Every background poll replaces the `guests` array → the effect reruns **while the create modal is open** → `setFormData({guestID: ''})` + blank `guestForm` + reset dates. The UID box, the lock, the typed search, and the whole in-progress form are wiped every few seconds. (My SearchableSelect guard was correct but powerless — the parent genuinely clears the value.)
- `minResDate` is write-once state (never changes); `guests` is the live trigger. The query-prefill effect (line 461) only acts on `?action=new` links — not the culprit.

## 2. Fix (one effect, `app/receptionist/reservations/page.js`)
- Transition-guard the init effect with a `prevModalRef`: run the create-init only when the modal OPENS, the clear only when it CLOSES; data churn while open is ignored. Deps stay (lint-quiet), edit-modal path untouched (imperative `openEditModal`).
- Keep the SearchableSelect guard (still valid protection for all 6 usages).

## 3. Verify
- `npx eslint` (stash-compared) + `npm run build`; staging: open create modal, type UID, wait 15s through polls — selection, search text, and dates must all survive.
- Commit/push only on `"push"`.
