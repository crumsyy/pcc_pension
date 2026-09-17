export const RESERVATION_STATUSES = [
  'Reserved',
  'On Hold',
  'Booked',
  'Cancelled'
];

export const BOOKING_STATUSES = [
  'Pending',
  'Active Stay',
  'Bill Finalized',
  'Paid',
  'Completed'
];

export const STREAMLINED_BOOKING_STATUSES = BOOKING_STATUSES;

export function normalizeReservationStatus(status) {
  if (!status) return 'Reserved';
  const s = String(status).trim();

  if (RESERVATION_STATUSES.includes(s)) {
    return s;
  }

  // On Hold
  if (['Courtesy Hold', 'Hold', 'On Hold'].includes(s)) {
    return 'On Hold';
  }

  // Booked
  if (['Booked', 'Confirmed', 'Converted to Booking'].includes(s)) {
    return 'Booked';
  }

  // Cancelled
  if (['Cancelled', 'Canceled', 'Released', 'Expired', 'No Show'].includes(s)) {
    return 'Cancelled';
  }

  // Reserved
  if (['Pending', 'Reserved'].includes(s)) {
    return 'Reserved';
  }

  return s;
}

export function normalizeBookingStatus(status) {
  if (!status) return 'Pending';
  const s = String(status).trim();

  // Exact unified match
  if (BOOKING_STATUSES.includes(s)) {
    return s;
  }

  // Active Stay (In-house and in-progress checkouts)
  if (['Checked In', 'Checked-In', 'Active Stay', 'Occupied', 'Checkout Requested', 'Pending Room Verification', 'Pending Checkout', 'Room Verified', 'Late Checkout'].includes(s)) {
    return 'Active Stay';
  }

  // Bill Finalized (Staff has reviewed and finalized charges)
  if ([
    'Bill Finalized',
    'Bill Ready',
    'Final Billing Updated'
  ].includes(s)) {
    return 'Bill Finalized';
  }

  // Paid
  if (['Paid', 'Payment Completed'].includes(s)) {
    return 'Paid';
  }

  // Completed
  if (['Completed', 'Departed', 'Checked Out', 'Checked-Out'].includes(s)) {
    return 'Completed';
  }

  // Pending
  if (['Pending', 'Pending Check-in', 'Confirmed', 'Booked', 'Overdue Check-In', 'No Show'].includes(s)) {
    return 'Pending';
  }

  if (['Cancelled', 'Canceled'].includes(s)) {
    return 'Cancelled';
  }

  return s;
}

export function isValidBookingStatusTransition(currentStatus, newStatus) {
  const curr = normalizeBookingStatus(currentStatus);
  const next = normalizeBookingStatus(newStatus);

  const allowed = {
    'Pending': ['Active Stay', 'Cancelled', 'Pending'],
    'Active Stay': ['Bill Finalized', 'Paid', 'Completed', 'Cancelled', 'Active Stay'],
    'Bill Finalized': ['Paid', 'Completed', 'Active Stay', 'Bill Finalized'],
    'Paid': ['Completed', 'Paid'],
    'Completed': [],
    'Cancelled': []
  };

  if (!allowed[curr]) return true;
  return allowed[curr].indexOf(next) !== -1;
}

export function getStatusBadgeClass(status, type = null) {
  let norm;
  if (type === 'reservation' || RESERVATION_STATUSES.includes(status) || ['Courtesy Hold', 'Released'].includes(status)) {
    norm = normalizeReservationStatus(status);
  } else {
    norm = normalizeBookingStatus(status);
  }

  switch (norm) {
    // Reservation Flow
    case 'Reserved':
      return 'badge text-white shadow-xs';
    case 'On Hold':
      return 'badge text-white shadow-xs';
    case 'Booked':
      return 'badge text-white shadow-xs';

    // Booking Flow
    case 'Pending':
      return 'badge text-white shadow-xs';
    case 'Active Stay':
      return 'badge text-white shadow-xs';
    case 'Bill Finalized':
      return 'badge text-white shadow-xs';
    case 'Paid':
      return 'badge text-white shadow-xs';
    case 'Completed':
      return 'badge text-white shadow-xs';

    case 'Cancelled':
    case 'Payment Declined':
    case 'Declined':
      return 'badge bg-danger text-white shadow-xs';
    default:
      return 'badge bg-secondary text-white shadow-xs';
  }
}

export function getStatusBadgeStyle(status, type = null) {
  let norm;
  if (type === 'reservation' || (type !== 'booking' && ['Courtesy Hold', 'Released', 'On Hold', 'Reserved'].includes(status))) {
    norm = normalizeReservationStatus(status);
  } else {
    norm = normalizeBookingStatus(status);
  }

  switch (norm) {
    // Reservation Flow
    case 'Reserved':
      return { backgroundColor: '#0d6efd', color: '#ffffff', border: '1px solid #0d6efd' }; // Primary Blue
    case 'On Hold':
      return { backgroundColor: '#fd7e14', color: '#ffffff', border: '1px solid #fd7e14' }; // Amber / Orange
    case 'Booked':
      return { backgroundColor: '#0dcaf0', color: '#055160', border: '1px solid #0dcaf0' }; // Cyan / Info

    // Booking Flow
    case 'Pending':
      return { backgroundColor: '#6c757d', color: '#ffffff', border: '1px solid #6c757d' }; // Slate Gray
    case 'Active Stay':
      return { backgroundColor: '#0d6efd', color: '#ffffff', border: '1px solid #0d6efd' }; // Royal Blue
    case 'Bill Finalized':
      return { backgroundColor: '#6f42c1', color: '#ffffff', border: '1px solid #6f42c1' }; // Purple
    case 'Paid':
      return { backgroundColor: '#198754', color: '#ffffff', border: '1px solid #198754' }; // Emerald Green
    case 'Completed':
      return { backgroundColor: '#343a40', color: '#ffffff', border: '1px solid #343a40' }; // Dark Charcoal

    case 'Cancelled':
    case 'Payment Declined':
    case 'Declined':
      return { backgroundColor: '#dc3545', color: '#ffffff', border: '1px solid #dc3545' };
    default:
      return { backgroundColor: '#6c757d', color: '#ffffff', border: '1px solid #6c757d' };
  }
}
