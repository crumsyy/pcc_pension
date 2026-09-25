/**
 * Date Utility Helpers
 * Defensive date calculation and night-to-morning mapping for hotel stays.
 */

function parseDateParts(input) {
  if (!input) return null;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }
  const str = String(input).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function getStayNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return [];
  
  const start = parseDateParts(checkIn);
  const end = parseDateParts(checkOut);
  
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return [];
  }

  const nights = [];
  let current = new Date(start);
  while (current < end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const morningDate = new Date(current);
    morningDate.setDate(morningDate.getDate() + 1);

    const formattedNight = current.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    const formattedMorning = morningDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    nights.push({
      dateStr,
      formattedNight,
      formattedMorning,
      morningTitle: `Morning of ${formattedMorning}`
    });

    current.setDate(current.getDate() + 1);
  }

  return nights;
}
