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

export function getManilaNow() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = {};
  formatter.formatToParts(new Date()).forEach(({ type, value }) => { parts[type] = value; });
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parseInt(hour, 10),
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    timeStr: `${hour}:${parts.minute}`,
    timeSecStr: `${hour}:${parts.minute}:${parts.second}`,
    dateTimeStr: `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second}`
  };
}
