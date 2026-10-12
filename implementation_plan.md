# Implementation Plan — Full booking lifecycle rename (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Agreed change
Canonical booking lifecycle becomes `Booked → Occupied → Bill Finalized → Paid → Completed` (+ `Cancelled`, `No Show` unchanged), replacing `Pending-family → Active Stay-family`. Stored values, normalizer, transitions, filters, UI, and existing rows all move together.

## 2. New canonical mapping (`lib/bookingStatuses.js`)
- `BOOKING_STATUSES = ['Booked','Occupied','Bill Finalized','Paid','Completed']`.
- `normalizeBookingStatus`: `Pending/Pending Check-in/Confirmed/Booked/Overdue Check-In/Reserved` → `Booked`; `Checked In/Checked-In/Active Stay/Occupied/Checkout Requested/Pending Room Verification/Pending Checkout/Room Verified/Pending Bill/Late Checkout` → `Occupied`; `Bill Finalized/Bill Ready/Final Billing Updated` → `Bill Finalized`; `Paid/Payment Completed` → `Paid`; `Completed/Departed/Checked Out/Checked-Out` → `Completed`; `Cancelled/Canceled` → `Cancelled`; `No Show` → `Cancelled` (dead-end; raw value kept in DB).
- Transitions rewritten on new names (`Booked→Occupied/Cancelled`, `Occupied→Bill Finalized/Paid/Completed/Cancelled`, rest unchanged).
- Badge styles: add `Booked` (info cyan) + `Occupied` (royal blue); keep legacy entries harmlessly.

## 3. Writers (store new values)
- `api/receptionist/bookings/route.js`: create default `Pending…` → `Booked`, immediate check-in `Active Stay/Checked In` → `Occupied`; check-in `UPDATE … 'Active Stay'` → `'Occupied'` + transition assert; display CASE pending-family → `Booked`; gap/sameday guards; update/cancel guards via normalizer (mostly automatic).
- `api/payments/paymongo-qr/auto-settle/route.js:181` + `api/webhooks/paymongo/route.js:111`: `Active Stay`/`Confirmed` writes → `Occupied`/`Booked`.

## 4. Readers (raw SQL IN-lists → new names; display logic follows normalizer)
- `lib/db.js` sweep + room calc + balance flows; `lib/dashboardSnapshot.js` batched queries; `api/receptionist/dashboard`, `api/admin/dashboard`, `api/billing`, `api/notifications`, `api/guest/bookings` (+Overdue/No Show CASEs), `api/guest/checkout-request`.
- Pages: bookings (filters/tabs/badges/buttons/status arrays), checkin (arrivals/departures/badges), billing BillingTab + PaymentsTab tags, orders picker labels, admin bookings/dashboard, guest dashboard timeline (`Pending→Active Stay` → `Booked→Occupied`) + finders + badges, ActiveStayPanel/PaymentModal defaults, qr-payment text.

## 5. Data migration (live DB, backup first)
- `CREATE TABLE booking_backup_YYYYMMDD AS SELECT * FROM booking;`
- Pending-family → `Booked`; in-house family → `Occupied`; terminal values (`Completed/Checked Out/Cancelled/No Show`) untouched; `reservation` table untouched.
- Pre/post row-count audit per status; rollback = restore from backup.

## 6. Verification
- `eslint`; `npm run build` 97/97.
- Manual full lifecycle: create (Booked) → advance check-in (Occupied) → finalize → pay → complete → history; filters/tabs per stage; guest timeline; no-show + reinstate paths.
- Post-migration: zero bookings left in legacy pending/in-house values.

## 7. Risks
- Large surface (~20 files); mitigated by normalizer backward-compat (any missed raw comparison still displays correctly; SQL lists are the critical path — enumerated explicitly).
- Booking-`Occupied` vs room-`Occupied` same word in adjacent contexts (accepted earlier).
- `No Show → Cancelled` normalization is a semantic choice (dead-end bucket); raw `No Show` value preserved for reinstate logic.

## 8. Questions
- Q1: Proceed with full rename + live migration as specced?
