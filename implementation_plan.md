# Implementation Plan — Single-trigger toasts + notifications (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User reports (with evidence)
1. **Double success/error toast on reservation cancel** ([Image 1]): `handleCancel` fires `toast.success('Reservation Canceled', …)` (907) AND `showAlert('success', 'Success', …)` (908) — and `showAlert` itself calls `toast.add`. Same double in its catch path (911-912). Identical doubles in update flow (883-884, 888-889). Create flow (792/800) already fires once — no change there.
2. **Double “Reservation Cancelled Audit” popup** ([Image 2]): verified in live DB — exactly ONE audit row per staff user per cancel (e.g. #4 → 4 rows, one per userID, same timestamp). So the duplicate is purely client-side: `SidebarClient` mounts TWO `NotificationBell`s (mobile top bar :274 + desktop header :533; CSS hides one but both poll + toast), each with its own `knownNotifIDsRef` dedupe set and its own sonner `<Toaster>` (`NotificationBell.js:424`).

## 2. Proposed changes
1. `reservations/page.js` — single trigger per path: drop direct `toast.success`/`toast.error` in `handleUpdateSubmit` + `handleCancel` (success + catch), keep the `showAlert` calls (file convention; create flow untouched). `toast` import stays (used by create flow).
2. `NotificationBell.js` — cross-instance dedupe: module-scope `toastedNotifIDs` Set; only ring/chime/fire sonner toasts for IDs not in it (fixes double popup AND double chime across the two mounts and remounts). Remove the per-instance `<Toaster>` (keep `toast` import for firing).
3. `SidebarClient.js` — render ONE sonner `<Toaster position="top-right" richColors closeButton expand={false} />` at the layout root (covers both bell instances, both roles). Guest tree untouched (no sonner Toaster there today; out of scope).

## 3. Verification
- `grep`: `toast.success|toast.error` in reservations page only at create-flow lines; `Toaster` rendered once (SidebarClient); no `<Toaster>` in bell.
- Cancel a reservation: exactly one success toast + one audit popup; dropdown shows one audit entry.
- `eslint` (pre-existing families only); `npm run build` 97/97.

## 4. Risks
- Low: toast-text changes (titles now come from `showAlert`: “Success/Error” instead of “Reservation Canceled/Cancel Failed”) — same green/red styling, single popup.
- Both bells keep polling (badges stay correct); only toast firing is deduped.

## 5. Questions
- Q1: Proceed as planned (fix cancel + update doubles, bell dedupe, single Toaster)?
