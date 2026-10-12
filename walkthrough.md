# Walkthrough — Public obfuscated codes for all entity IDs

## New helper (`lib/publicCodes.js`)
- `toPublicUserCode` (GST-/STF-, salt 0 = byte-identical to legacy admin codes), `toPublicGuestCode`, `toPublicBookingCode` (BKG-), `toPublicReservationCode` (RSV-), `toPublicTransactionCode` (TXN-), `toPublicOrderCode` (ORD-), `toPublicBorrowCode` (BRW-). Knuth-hash, one-way, salted per type; bad input → `XXX-XXXXXX`.

## Changed (display-only; numeric IDs stay in API payloads/keys)
- **Admin**: UsersClient imports helper (zero visual change); reports order/booking/transaction cells; reservations booking/reservation refs; inventory borrow IDs.
- **Receptionist**: bookings (account line, pickers, table, conflicts, modals, receipts), reservations (pickers, table, history), checkin badges, inquiries picker, orders (cards, details, toasts), billing history table + search (matches TXN/BKG codes), terminal header, QR stay ref, dashboard table, sidebar palette labels, payments test page.
- **Guest**: sidebar, dashboard (welcome, profile, booking cards, reservations, orders, bills, receipts incl. printable HTML), ActiveStayPanel, PaymentModal, orders list/modals/toasts.
- **Accounts**: bookings table + payment notice.
- **API message templates** (surfaced in notifications/toasts): bookings, reservations, convert, orders, payments, billing, checkout-requests, notifications scheduler, auto-settle. New audit entries also use public codes.

## Deliberately untouched
- PayMongo descriptions + webhook parser (`Booking #BK00001`), QR payload contents, audit internals, `formatters.js` (legacy padded codes remain for internal use), receipt/invoice sequence numbers (`INV-`, `REC-` header on invoice canvas — document numbers, normal business practice), admin purge next-ID display.

## Verification
- `npm run build` → success, all routes.
- Helper spot-check: id 5 → GST-6EKOS5 / BKG-0C847E / RSV-U9VJMN (distinct per type); bad input → fallback.
- Manual pass still recommended: pickers accept typed codes; no raw `UID#`/`BK00001` visible in portals.
