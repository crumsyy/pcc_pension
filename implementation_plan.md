# Implementation Plan — Modern shadcn tabs for billing stay filters (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User request
- Billing list filter pills (`All Stays (0)` / `Upcoming / Booked (0)` / `Active Stays (0)` / `Completed Stays (0)`) currently render as a Bootstrap `btn-group` ([Image 1]); convert to modern shadcnUI tabs, consistent with the Reservations/Bookings tab simplification.

## 2. Evidence / current state
- `app/receptionist/billing-checkout/BillingTab.js:709-740`: `<div className="btn-group btn-group-sm">` with 4 `<button>`s keyed off `statusFilter` (`all`/`upcoming`/`active`/`completed`), counts `allCount/upcomingCount/activeCount/completedCount`.
- `statusFilter` state + `setStatusFilter` drive `filteredBookings` only; no other logic depends on the button markup.
- shadcn wrapper already imported in this file: `Tabs, TabList, Tab, TabPanel` from `@/components/ui/tabs` (used for the bill dialog). Only `Tabs/TabList/Tab` needed here (no panels — tabs act as filter switch).

## 3. Proposed changes (only `BillingTab.js:709-740`)
Replace the `btn-group` with:
```jsx
<Tabs selectedKey={statusFilter} onSelectionChange={(key) => setStatusFilter(key)}>
  <TabList aria-label="Stay filters">
    <Tab id="all">All Stays</Tab>
    <Tab id="upcoming">Upcoming / Booked</Tab>
    <Tab id="active">Active Stays</Tab>
    <Tab id="completed">Completed Stays</Tab>
  </TabList>
</Tabs>
```
- Labels: keep words, drop the `(count)` numbers — consistent with prior “remove the number, just tabs” direction. Counts (`allCount`, etc.) become unused → remove those 4 declarations if unreferenced elsewhere (verify via grep).
- `onSelectionChange` passes the tab id directly (same values as current filter keys), so filtering behavior is identical.
- Keep right-aligned placement (`col-md-6 text-md-end`); `TabList` is `inline-flex w-fit`, aligns fine.

## 4. Verification
- `grep` for `btn-group` in `BillingTab.js` → gone; `statusFilter` still drives `filteredBookings`.
- `eslint` on file (pre-existing families only, no new `no-unused-vars`).
- Visual: pill-style shadcn tab strip; clicking each filters the stays table as before.

## 5. Risks / notes
- None behavioral; pure markup swap on a local filter state.

## 6. Questions for user
- Q1: Drop the `(0)` counts from labels (recommended, matches previous tabs), or keep counts inside shadcn tabs?
