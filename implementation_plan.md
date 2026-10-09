# Implementation Plan — Billing & Checkout Workspace (Two Tabs)

## 1. Goal
One receptionist workspace with Billing | Payments tabs; checkout stays in Payments tab. No API/logic changes — moves + wiring only.

## 2. Current State (verified)
- `billing/page.js` (~132KB) and `payments/page.js` (~55KB): self-contained, each with own `?bookingID=` picker + fetches to `/api/receptionist/billing|payments|bookings`. Checkout flow already in Payments (`shouldCheckout`, zero-balance completion).
- Deep links to both routes exist; sidebar has separate entries (`ReceptionistSidebarNav`).
- No shadcn Tabs exists; will hand-build shadcn-style `Tabs` (React Aria) like checkbox/dialog — NOT CLI code.

## 3. Scope
- IN: new `components/ui/tabs.jsx` + CSS; extract both pages into tab components under the workspace; shared `bookingID` + refresh counter; old routes → thin redirects; sidebar single entry.
- OUT: APIs, billing/payment/checkout logic, other pages.

## 4. Design
- Workspace URL TBD (see question): tabs + `bookingID` synced to `?tab=&bookingID=`; old routes redirect preserving `?bookingID=`.
- Billing mutations bump a workspace refresh counter; Payments refetches on booking/tab/counter change.
- Tab components = existing pages minus page shells, `bookingID` as prop.

## 5. Steps
1. Tabs component + CSS. 2. Extract tab components. 3. Workspace + redirects + sidebar. 4. Build + manual flows. 5. Walkthrough; no commit/push until `"push"`.

## 6. Acceptance
- Both tabs work, booking selection shared + URL-synced, old links redirect correctly, checkout completes in Payments tab, sidebar single entry, build passes.
