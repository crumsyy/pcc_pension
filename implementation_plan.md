# Implementation Plan — Public obfuscated codes for all entity IDs (for approval)

> RequestFeedback: true — STOP here. No code changes made. Proceed only on explicit approval.

## 1. Goal
No raw database IDs visible in any portal. Display-only obfuscated public codes everywhere; numeric IDs stay in API payloads/keys and machine paths only.

## 2. Code scheme (new shared helper `lib/publicCodes.js`)
Same Knuth-hash (`id * 2654435761` → base36, 6 chars) for all types, salted per entity type so id 5 as a user vs booking vs order yields different codes. Convention: public codes always contain a hyphen; legacy padded codes never do.

| Entity | Legacy display | New public code |
|---|---|---|
| Guest users | `UID#5`, `#5` | `GST-XXXXXX` (existing algorithm, moved into helper) |
| Staff users | `UID#5` | `STF-XXXXXX` (existing algorithm, moved into helper) |
| Bookings | `Booking #5`, `BK00001` | `BKG-XXXXXX` |
| Reservations | `RV00001`, `Reservation #5` | `RSV-XXXXXX` |
| Transactions/payments | `#TRX-00001` | `TXN-XXXXXX` |
| Orders | `ORD00001`, `Order #3` | `ORD-XXXXXX` |

Room numbers unchanged (physical door numbers, not secrets).

## 3. Changes
1. **New `lib/publicCodes.js`**: `toPublicUserCode(userID, role)`, `toPublicBookingCode(id)`, `toPublicReservationCode(id)`, `toPublicTransactionCode(id)`, `toPublicOrderCode(id)` + generic `toPublicCode(id, prefix, salt)`. Backward-compatible fallbacks (`XXX-XXXXXX` on bad input).
2. **Admin**: `UsersClient.js` imports helper (zero visual change); reports/reservations `Booking #...` displays switched to `BKG-XXXXXX`.
3. **Receptionist**: bookings, reservations, inquiries picker labels/placeholders; bookings `UID#` account line + `Booking #` confirms/receipts; billing terminal search (match public codes too) + bill/history `Booking #` lines; QR payment description display; sidebar `BK-` labels.
4. **Guest portal**: sidebar `User ID: #`, dashboard welcome/profile/booking lines, bill headers, payment modal titles.
5. **Search**: pickers/terminal accept public codes (compare computed hash client-side alongside name/contact).
6. **Untouched**: API payloads/keys, PayMongo webhook description parsing, audit/notification stored strings, QR payload contents, `formatters.js` (kept for internal/legacy use).

## 4. Verification
- `grep` for `UID#`, `UID${`, `Booking #${`, `BK${`, `RV0000`, `TRA0000`, `ORD0000`, `User ID: #` in UI display JSX → zero hits (excluding helper, webhook parser, API internals).
- `npm run build` passes; screen pass over admin users, receptionist pickers/billing/history, guest sidebar/profile/bills.

## 5. Risks
- Medium: wide display-only sweep (~30 spots). Display-only — no DB/API contract changes; rollback = revert commit.
- Note: codes are obfuscation (one-way hash), not encryption — sufficient to stop casual ID exposure/param-tampering, not cryptographic secrecy.

## 6. Questions
- Q1: Proceed with all six entity types as above?
