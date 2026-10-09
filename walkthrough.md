# Walkthrough — Billing & Checkout Workspace

## Changes (no commit/push yet)
- New `components/ui/tabs.jsx` (shadcn-style `Tabs/TabList/Tab/TabPanel` over React Aria) + theme-aware Inter CSS in `globals.css`. Hand-built like checkbox/dialog — not CLI code.
- New route `/receptionist/billing-checkout`: `page.js` (server + Suspense) + `WorkspaceClient.js` (tab state synced to `?tab=`, booking carried in `?bookingID=`).
- `BillingTab.js` / `PaymentsTab.js`: exact copies of the old pages; only additions are a `syncBookingToUrl` write on every selection/clear site and one internal link pointed at the workspace. All billing/payment/checkout logic byte-identical.
- Sharing model: URL is the store — tabs write `?bookingID` on select, read it on mount; inactive panels unmount on switch (verified in RAC source), so each activation refetches fresh. Existing polling untouched.
- Old `/billing` + `/payments` routes are now thin server redirects preserving all query params (+ correct `tab=`). Sidebar has one "Billing & Checkout" entry (active-state matching works via prefix).

## Verification
- `npx eslint` on touched files: only pre-existing findings copied with the pages; new files clean.
- `npm run build` success, 97/97 pages (`billing-checkout` listed).

## Manual check
1. Open workspace, pick a booking in Billing → switch to Payments → same booking loaded; reverse works; refresh keeps tab + booking.
2. Legacy links (`/payments?bookingID=`, `/billing?bookingID=`) land on the right tab with the booking loaded.
3. Full flow: edit bill/finalize in Billing → pay + Complete Booking in Payments → room released.
4. Sidebar single entry highlights on the workspace.

## Known tradeoff
- Switching tabs remounts the panel (loses half-filled form input, guarantees fresh data). Say the word if you want state preserved instead.

Awaiting review. Say `"push"` only when you want commit + push.
