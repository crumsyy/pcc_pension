/**
 * Public obfuscated codes for database IDs (PCC Pension House).
 *
 * Display-only one-way obfuscation so raw database IDs are never exposed
 * in any portal UI. NOT encryption and NOT reversible: APIs, keys, the
 * PayMongo webhook parser, and audit internals keep using numeric IDs.
 *
 * Convention: public codes ALWAYS contain a hyphen (e.g. `GST-AB12CD`);
 * legacy padded codes (`BK00001`, `RV00000`) never do, so staff can tell
 * at a glance which is which.
 */

function hash6(id, salt) {
  const num = parseInt(id, 10);
  if (!Number.isFinite(num) || num < 0) return null;
  // Knuth multiplicative hash, salted per entity type so the same numeric
  // id yields a different code for users vs bookings vs orders, etc.
  const saltNum = parseInt(salt, 10) || 0;
  const hashed = (((num + saltNum) * 2654435761) >>> 0)
    .toString(36)
    .toUpperCase()
    .padStart(6, '0')
    .slice(-6);
  return hashed;
}

function makeCode(id, prefix, salt) {
  const hashed = hash6(id, salt);
  if (!hashed) return `${prefix}-XXXXXX`;
  return `${prefix}-${hashed}`;
}

/** Guest -> GST-XXXXXX, staff -> STF-XXXXXX (matches legacy admin display). */
export function toPublicUserCode(userID, role) {
  const prefix = role === 'Guest' ? 'GST' : 'STF';
  // Salt 0 preserves the exact legacy admin codes (no visual change there).
  return makeCode(userID, prefix, 0);
}

/** Booking -> BKG-XXXXXX */
export function toPublicBookingCode(bookingID) {
  return makeCode(bookingID, 'BKG', 101);
}

/** Reservation -> RSV-XXXXXX */
export function toPublicReservationCode(reservationID) {
  return makeCode(reservationID, 'RSV', 202);
}

/** Payment/transaction -> TXN-XXXXXX */
export function toPublicTransactionCode(paymentID) {
  return makeCode(paymentID, 'TXN', 303);
}

/** Order -> ORD-XXXXXX */
export function toPublicOrderCode(orderID) {
  return makeCode(orderID, 'ORD', 404);
}

/** Guest-profile fallback when only a guestID exists (no user account). */
export function toPublicGuestCode(guestID) {
  return makeCode(guestID, 'GST', 505);
}

/** Borrow transaction -> BRW-XXXXXX */
export function toPublicBorrowCode(borrowID) {
  return makeCode(borrowID, 'BRW', 606);
}
