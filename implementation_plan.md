# Implementation Plan — Billing & Payment flow rework (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User requests
1. Rename `Billing & Checkout` → `Billing & Payment` everywhere it surfaces.
2. New flow: page opens on billing list first; clicking `View` on a row opens a dialog whose tabs are already scoped to that guest's bill; switching to the Payments tab inside that dialog must already show the same guest name + bill (no re-select). Current pain: pick bill → go to Payments tab → must choose guest again.

## 2. Evidence / current state
- Route shell: `app/receptionist/billing-checkout/page.js:1-10` → `WorkspaceClient`.
- Page-level tabs: `WorkspaceClient.js:13-45` — `Tabs selectedKey={tab}` (`billing`|`payments`, synced to `?tab=`), renders `BillingTabContent` + `PaymentsTabContent` in separate `TabPanel`s.
- Billing list + View modal: `BillingTab.js`:
  - List from `/api/receptionist/payments` (`allBillingStays`), search + All/Upcoming/Active/Completed filters (lines ~105-126, 626-739), table with eye `View` button (lines ~802-820).
  - `View` sets `selectedBookingID`, syncs `?bookingID=` via `syncBookingToUrl` (lines 17-25), fetches `/api/receptionist/billing?bookingID=` into `billDetails`, opens large `ModalPortal` statement-of-account modal (lines ~831+).
  - Billing modal has its own record-payment/finalize/complete actions — scope overlap with PaymentsTab must be preserved, not duplicated blindly.
- Payments terminal: `PaymentsTab.js` (`PaymentsClient`):
  - Own `selectedBookingID` + `SearchableSelect` guest picker (lines ~607-634), own `fetchBillingDetails` → `billData`, checkout calculations panel (lines ~740-858), history + receipt modals.
  - Cross-tab sharing today is only via `?bookingID=` URL: BillingTab writes it; PaymentsTab reads `searchParams.get('bookingID')` once as `initialBookingID` on first mount (lines 15, 113-116, 150-153). Switching page tabs does not reliably carry selection (mount timing / TabPanel unmount / cache-first path), hence the reported hassle.
- Labels to rename:
  - `app/components/SidebarClient.js:216` nav label `Billing & Checkout`.
  - `app/components/ReceptionistSidebarNav.js:33` nav label `Billing & Checkout`.
  - `lib/portalMeta.js:24` nav/search label + `:46` header `{ eyebrow, title }` → drives top-bar `Billing & Checkout` title.
  - `app/receptionist/billing/page.js:3`, `app/receptionist/payments/page.js:3` legacy comments mention workspace name (cosmetic; update to avoid confusion).
  - URL slug `billing-checkout` stays (route rename out of scope — avoids breaking `?tab=payments` deep links like screenshot 2 URL).

## 3. Proposed changes
### A. Rename (no behavior change)
- `SidebarClient.js:216`, `ReceptionistSidebarNav.js:33`, `portalMeta.js:24,46`, legacy comments in `billing/page.js`, `payments/page.js`: `Billing & Checkout` → `Billing & Payment`. Keywords line keep `checkout` as search keyword.

### B. Dialog-scoped Billing/Payments flow (core)
New `app/receptionist/billing-checkout/BillDialog.js` (dialog owns the tabs):
- Props: `bookingID`, `onClose`, `onChanged` (refresh list after payment/finalize/complete).
- Internal `Tabs selectedKey={dialogTab}` with `<Tab id="billing">Billing</Tab>` + `<Tab id="payments">Payments</Tab>`, default `billing`.
- Billing panel: reuse current BillingTab statement content for `bookingID` (extract or render existing billing-details component with `bookingID` prop — prefer extracting current modal body into `BillingStatement(bookingID)` so list and dialog share it, no logic fork).
- Payments panel: render payment terminal + checkout calculations for the same `bookingID` (extract current PaymentsTab terminal/calculations into `PaymentTerminal(bookingID, onPaid)` so dialog and standalone `?tab=payments` deep-link share it). Guest picker inside dialog becomes read-only locked header (guest name/room/balance) instead of a searchable select — selection is inherited, satisfying "name is already there as well and bill is there".
- `BillingTab.js` list: `View` now opens `BillDialog(bookingID)` instead of the old billing-only modal; keep `?bookingID=` sync for deep-linking (dialog opens on load if param present).
- `WorkspaceClient.js`: page defaults to billing list (no change to default). Page-level `Payments` tab becomes a thin wrapper over the same `PaymentTerminal` that reads `?bookingID=` live (subscribe to searchParams, not just first mount) so a carried selection appears preselected; empty state keeps current "select guest" picker when no `bookingID` present (preserves direct `?tab=payments` usage).
- Checkout-complete path stays single-sourced: dialog calls existing `complete_booking` API then `onChanged` refreshes list + closes or shows settled state.

### C. State plumbing (avoid two sources of truth)
- `bookingID` stays the single key: URL `?bookingID=` (existing convention in both tabs) + dialog prop. Both panels fetch `/api/receptionist/billing?bookingID=` independently or via a shared hook `useBill(bookingID)` (new, small) to avoid prop-drilling stale `billDetails`/`billData` copies.
- Refresh: after payment/finalize/complete, invalidate `RECEPTIONIST_BILLING` + `RECEPTIONIST_PAYMENTS` clientCache entries and refetch (both tabs currently cache separately).

## 4. Verification
- Rename: `grep -r "Billing & Checkout" app lib components` → only historical/changelog hits (intended: zero UI hits); sidebar + top-bar header read `Billing & Payment`.
- Flow: open page → billing list visible first; click eye View → dialog opens on Billing tab scoped to that row's guest; switch to Payments tab → same guest/room/balance preselected, no picker needed; process payment → dialog + list refresh; direct URL `?tab=payments&bookingID=X` still preselects.
- `eslint` on touched files; no new `no-unused-vars` (remove old modal state that becomes dead).
- No API changes; no route/slug changes.

## 5. Risks / notes
- `BillingTab.js` (~1000+ lines modal body) and `PaymentsTab.js` (~1000+ lines terminal) are large; extraction must be mechanical (move, not rewrite) to avoid regressing finalize/settle/complete, GCash/BroadcastChannel sync, receipts, history.
- React Aria `Tabs` inside `ModalPortal`: verify focus-trap + tab keyboard nav coexist (used elsewhere for page tabs, low risk).
- `?tab=payments` back-compat kept; page-level Payments tab remains for direct access, just selection-aware.

## 6. Questions for user
- Q1: Dialog tabs or page tabs? Plan assumes tabs move INTO the View dialog (recommended per request). Alternative: keep page-level tabs and only fix selection carry-over. Confirm dialog approach?
- Q2: Inside the dialog Payments tab, hide the guest picker entirely (locked to dialog guest, recommended) or keep it enabled to switch guests without closing?
