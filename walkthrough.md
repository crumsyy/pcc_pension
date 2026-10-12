# Walkthrough — Full booking lifecycle rename (Booked → Occupied → …)

## Changes
- `lib/bookingStatuses.js`: canonical `['Booked','Occupied','Bill Finalized','Paid','Completed']`; normalizer maps every legacy value; transitions rewritten; badge styles for Booked (cyan) / Occupied (blue). `StatusBadge` auto-follows.
- Writers store new values: receptionist bookings create/check-in, conversion (`Occupied`/`Booked`), guest bookings create, auto-settle ×2, paymongo webhook (pending-family → Booked, no downgrades).
- Readers/lists switched: sweep + room calc + billing details (`lib/db.js`), `dashboardSnapshot.js`, admin/receptionist dashboards, billing tabs, payments list + settle gate, notifications (upcoming/overdue), guest bookings/CASEs/checkout-request/pay/orders, guest dashboard finders + timeline (`Booked→Occupied→…`) + badges, orders picker, admin bookings/reports, mailer.
- Guards use new names (check-in/out, finalize, verify, guest cancel/pay, checkout-request). Two pre-existing dead comparisons (`PaymentModal`, guest `payments`) now correctly enforce their documented in-house restriction.
- Reservation table, order/payment/delivery statuses, terminal values (`Completed/Checked Out/Cancelled/No Show`) untouched.
- **Live migration**: backup `booking_backup_20261012`; 2 rows `Pending/Pending Check-in` → `Booked`; audit now: `Booked×2`, zero legacy stragglers.

## Verification
- `eslint`: no new issues. `npm run build`: exit 0.
- Manual to confirm: create (Booked) → advance check-in (Occupied) → finalize → pay → complete → history; filters per stage; guest timeline; no-show + reinstate.

## No commit/push
No commit or push made. Awaiting explicit `push` keyword after your review.
