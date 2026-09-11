/**
 * Validation utilities for Pension House Reservation & Booking system
 */

/**
 * Validates whether a reservation check-in date meets the minimum 2-day lead time.
 * Guests and receptionists cannot reserve for today, tomorrow, or any earlier date.
 *
 * Example: If today is Sept 11, 2026 -> earliest valid date is Sept 13, 2026.
 *
 * @param {Date|string} date - Date object or date string (e.g. 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ss', 'YYYY-MM-DD HH:mm:ss')
 * @returns {boolean} true if date is at least 2 days ahead of today
 */
export function validateReservationDate(date) {
  if (!date) return false;

  const today = new Date();
  const minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
  minDate.setHours(0, 0, 0, 0);

  let targetDate;
  if (date instanceof Date) {
    targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  } else if (typeof date === 'string') {
    const cleanDateStr = date.split(' ')[0].split('T')[0];
    const parts = cleanDateStr.split('-');
    if (parts.length === 3) {
      targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      targetDate = new Date(date);
    }
  } else {
    targetDate = new Date(date);
  }

  if (isNaN(targetDate.getTime())) return false;
  targetDate.setHours(0, 0, 0, 0);

  return targetDate >= minDate;
}
