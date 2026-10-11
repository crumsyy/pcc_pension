# Implementation Plan — Simplify receptionist tabs (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. User requests
- Reservations tabs → just `Reservations`, no icons, no count badges ([Image 1]).
- Bookings tabs → just `Bookings`, no icons, no count badges ([Image 2]).
- “remove the number as well for both just tabs shadcnUI” — plain shadcn `Tabs/TabList/Tab` text labels.

Interpretation: each page keeps its 2-tab structure (active vs history filtering) but labels become single words:
- `app/receptionist/reservations/page.js`: `Reservations` (id `active`) + `History`? Or both tabs literally “Reservations”? Latter would be duplicate labels. Assume: active → `Reservations`, history → `History`. Needs confirmation (see Q1).
- `app/receptionist/bookings/page.js`: active → `Bookings`, history → `History`.

If user literally wants both tabs on a page to read the same word, say so — will implement verbatim but it hurts usability.

## 2. Evidence / current state
- Reservations `app/receptionist/reservations/page.js:1006-1031`:
  - `<Tabs selectedKey={activeTab} onSelectionChange=...>` with `<Tab id="active">` icon `bi-bookmark-check` + `Active Reservations & Holds` + badge `{activeReservationsCount}`, and `<Tab id="history">` icon `bi-archive-fill` + `Historical & Converted Log` + badge `{historyReservationsCount}`.
- Bookings `app/receptionist/bookings/page.js:1821-1846`:
  - Same pattern: `bi-clock-history` + `Active Stays & Bookings` + `{activeBookingsCount}`; `bi-archive-fill` + `Historical Log` + `{historyBookingsCount}`.
- Counts derived: `activeReservationsCount/historyReservationsCount` (~line 973), `activeBookingsCount/historyBookingsCount` (lines 1665-1666). After removal these vars become unused → remove or leave (lint `no-unused-vars` risk; will remove).
- No other code depends on tab labels; `activeTab` values (`active`/`history`), search placeholders, status filters, tables all keyed off `activeTab`, not labels — safe.

## 3. Proposed changes
Only the two `TabList` blocks + unused count vars:
1. Reservations (`page.js:1011-1030`):
```jsx
<TabList aria-label="Reservation lists">
  <Tab id="active">Reservations</Tab>
  <Tab id="history">History</Tab>
</TabList>
```
2. Bookings (`page.js:1826-1845`):
```jsx
<TabList aria-label="Booking lists">
  <Tab id="active">Bookings</Tab>
  <Tab id="history">History</Tab>
</TabList>
```
3. Remove now-unused `activeReservationsCount/historyReservationsCount` and `activeBookingsCount/historyBookingsCount` declarations if no other references (verify via grep before edit).
4. Keep shadcn `Tabs/TabList/Tab`, `selectedKey`, `onSelectionChange` side-effects (`setExpanded*/setStatusFilter`) unchanged. No icon/badge markup remains in these blocks.

## 4. Verification
- `grep` Tab blocks to confirm no `<i class="bi` / `badge` remain in tab lists.
- `npx eslint` on both files (pre-existing errors only, no new `no-unused-vars`).
- Visual: two plain-text tabs per page; active/history filtering still works; search placeholders still mention active vs historical (out of scope unless requested).

## 5. Risks / notes
- Duplicate-label ambiguity if user wants identical text on both tabs — will follow explicit answer to Q1.
- Search input placeholders and status filter dropdowns still say “Active/ Historical” — intentionally untouched; say so if you want those simplified too.

## 6. Questions for user
- Q1: Confirm history tab labels: `History` for both pages (recommended), or literally `Reservations`/`Reservations` and `Bookings`/`Bookings`?
