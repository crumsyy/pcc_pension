# Walkthrough — Billing & Payment flow rework

## Changes
- **Rename `Billing & Checkout` → `Billing & Payment`:**
  - `app/components/SidebarClient.js:216`, `app/components/ReceptionistSidebarNav.js:33` (sidebar nav).
  - `lib/portalMeta.js:24,46` (nav search label + top-bar header title).
  - Legacy redirect comments in `app/receptionist/billing/page.js`, `app/receptionist/payments/page.js`.
  - URL slug `billing-checkout` unchanged (deep links like `?tab=payments` keep working).

- **New `PaymentTerminal.js` (shared, extracted verbatim from `PaymentsTab`):**
  - Props: `bookingID`, `locked`, `bookingOptions`, `pickerLoading`, `paymentMethods`, `onBookingChange`, `onPaid`, `onCompleted`.
  - Keeps Cash/GCash terminal, checkout calculations, receipt + print, GCash BroadcastChannel/storage sync + polling, complete-booking flow. Dropped only the never-rendered `discounts` list fetch (`discountID` was reset but never displayed/sent — payload already sent `null`).
  - `locked` mode (dialog): hides guest picker, shows guest/room/balance header — name + bill pre-set, no re-select.

- **`PaymentsTab.js` rewritten as shell:** header + Payment History button + unlocked `<PaymentTerminal>` (picker still available for direct access) + history modal (unchanged). Added live-sync: adopts `?bookingID=` carried over from Billing while mounted; `onCompleted` clears selection (old behavior preserved).

- **`BillingTab.js` View modal is now the bill dialog:**
  - Header renamed to `Guest Bill — Room …`; added shadcn `Tabs`: `Billing` (existing statement, untouched) + `Payments` (`<PaymentTerminal locked>` for the same booking).
  - `billDialogTab` resets to `billing` on every View/deep-link open.
  - Old “Open Payment Terminal” page-link replaced with in-dialog tab switch (no more losing context to `?tab=payments`).
  - Terminal `onPaid`/`onCompleted` refresh billing details + stays list.
  - Flex/min-height styles so both panels scroll inside the fixed 85vh modal.

- `WorkspaceClient.js` unchanged (page still opens on billing list; page-level Payments tab remains for direct access, now selection-aware).

## Verification
- `eslint` on touched files: only pre-existing `set-state-in-effect`/`exhaustive-deps`/`refs`/`purity` families; zero parse errors, zero `no-unused-vars`.
- `npm run build`: success, all routes rendered (incl. `/receptionist/billing-checkout`).
- Manual to confirm: Billing list → View → Billing tab scoped to guest → Payments tab shows same guest/bill locked → pay → dialog + list refresh; `?tab=payments&bookingID=X` still preselects.

## Deviation from plan (documented)
- Plan proposed a separate `BillDialog.js` + `useBill` hook. Implemented the dialog tabs inside the existing View modal instead (same UX, ~1500-line move avoided, lower regression risk). Shared terminal extracted as `PaymentTerminal.js` per plan.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
