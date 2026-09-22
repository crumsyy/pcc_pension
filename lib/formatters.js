/**
 * Primary Key Formatting Utilities for PCC Home Suite System
 */

export function formatReservationID(id) {
  if (id === null || id === undefined || id === '') return 'RV00000';
  const rawStr = String(id).trim();
  if (rawStr.startsWith('RV')) return rawStr;
  const num = parseInt(rawStr.replace(/\D/g, '')) || 0;
  return `RV${String(num).padStart(5, '0')}`;
}

export function formatBookingID(id) {
  if (id === null || id === undefined || id === '') return 'BK00000';
  const rawStr = String(id).trim();
  if (rawStr.startsWith('BK')) return rawStr;
  const num = parseInt(rawStr.replace(/\D/g, '')) || 0;
  return `BK${String(num).padStart(5, '0')}`;
}

export function formatTransactionID(id) {
  if (id === null || id === undefined || id === '') return 'TRA00000';
  const rawStr = String(id).trim();
  if (rawStr.startsWith('TRA')) return rawStr;
  const num = parseInt(rawStr.replace(/\D/g, '')) || 0;
  return `TRA${String(num).padStart(5, '0')}`;
}

export function formatOrderID(id) {
  if (id === null || id === undefined || id === '') return 'ORD00000';
  const rawStr = String(id).trim();
  if (rawStr.startsWith('ORD')) return rawStr;
  const num = parseInt(rawStr.replace(/\D/g, '')) || 0;
  return `ORD${String(num).padStart(5, '0')}`;
}

export function formatRoomNumber(roomNumber) {
  if (roomNumber === null || roomNumber === undefined || roomNumber === '') return 'RN000';
  const rawStr = String(roomNumber).trim();
  if (rawStr.startsWith('RN')) return rawStr;
  const digits = rawStr.replace(/\D/g, '');
  return `RN${digits ? digits.padStart(3, '0') : rawStr}`;
}

/**
 * 12-Hour Time Presentation & 24-Hour SQL Parsing Helpers
 */
export function formatTo12Hour(timeStr) {
  if (!timeStr) return '';
  const str = String(timeStr).trim();

  // If already contains AM or PM, normalize spacing and padding
  if (/am|pm/i.test(str)) {
    const parts = str.split(/\s+/);
    if (parts.length >= 2) {
      const [time, meridiem] = parts;
      const [h, m] = time.split(':');
      const hr = parseInt(h, 10);
      const min = (m || '00').padStart(2, '0');
      const med = meridiem.toUpperCase();
      return `${String(hr % 12 || 12).padStart(2, '0')}:${min} ${med}`;
    }
  }

  // Handle datetime string like "2026-09-23 14:00:00" or "2026-09-23T14:00"
  let cleanTime = str;
  if (str.includes(' ') && str.includes('-')) {
    cleanTime = str.split(' ')[1] || str;
  } else if (str.includes('T')) {
    cleanTime = str.split('T')[1] || str;
  }

  const timeParts = cleanTime.split(':');
  if (timeParts.length < 2) return str;

  let hours = parseInt(timeParts[0], 10);
  const minutes = (timeParts[1] || '00').substring(0, 2).padStart(2, '0');
  if (isNaN(hours)) return str;

  const meridiem = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 hour should be 12
  const formattedHours = String(hours).padStart(2, '0');

  return `${formattedHours}:${minutes} ${meridiem}`;
}

export function parseTo24Hour(timeStr) {
  if (!timeStr) return '14:00:00';
  const str = String(timeStr).trim();

  // If already 24-hour format like "14:00" or "14:00:00" without AM/PM
  if (!/am|pm/i.test(str)) {
    const parts = str.split(':');
    if (parts.length >= 2) {
      const h = String(parseInt(parts[0], 10) || 0).padStart(2, '0');
      const m = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
      const s = parts[2] ? String(parseInt(parts[2], 10) || 0).padStart(2, '0') : '00';
      return `${h}:${m}:${s}`;
    }
    return str;
  }

  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return str;

  let hours = parseInt(match[1], 10);
  const minutes = match[2].padStart(2, '0');
  const seconds = (match[3] || '00').padStart(2, '0');
  const meridiem = match[4].toUpperCase();

  if (meridiem === 'PM' && hours !== 12) {
    hours += 12;
  } else if (meridiem === 'AM' && hours === 12) {
    hours = 0;
  }

  return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
}

export function formatDateTime12H(dateTimeStr, options = { humanDate: true }) {
  if (!dateTimeStr) return '';
  const str = String(dateTimeStr).trim();
  const dateObj = new Date(str.includes(' ') ? str.replace(' ', 'T') : str);
  if (!isNaN(dateObj.getTime())) {
    const timeFormatted = dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    if (options?.humanDate) {
      const dateFormatted = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      return `${dateFormatted}, ${timeFormatted}`;
    }
    const pad = (n) => String(n).padStart(2, '0');
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${timeFormatted}`;
  }
  const datePart = str.split(' ')[0] || str.split('T')[0];
  const timePart = str.includes(' ') ? str.split(' ')[1] : (str.includes('T') ? str.split('T')[1] : '');
  
  if (!timePart) return datePart;
  return `${datePart} ${formatTo12Hour(timePart)}`;
}
