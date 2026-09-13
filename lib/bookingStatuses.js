export const BOOKING_STATUSES = [
  'Pending',
  'Checked-In',
  'Checked-Out',
  'Bill Ready',
  'Paid',
  'Completed'
];

export const STREAMLINED_BOOKING_STATUSES = BOOKING_STATUSES;

export function normalizeBookingStatus(status) {
  if (!status) return 'Pending';
  const s = String(status).trim();

  // Exact unified match
  if (BOOKING_STATUSES.includes(s)) {
    return s;
  }

  // Checked-In
  if (['Checked In', 'Active Stay'].includes(s)) {
    return 'Checked-In';
  }

  // Checked-Out
  if (['Checked Out', 'Checkout Requested', 'Pending Checkout', 'Pending Room Verification', 'Late Checkout'].includes(s)) {
    return 'Checked-Out';
  }

  // Bill Ready
  if (['Bill Finalized', 'Room Verified', 'Final Billing Updated'].includes(s)) {
    return 'Bill Ready';
  }

  // Paid
  if (['Payment Completed'].includes(s)) {
    return 'Paid';
  }

  // Completed
  if (['Departed'].includes(s)) {
    return 'Completed';
  }

  // Pending
  if (['Pending Check-in', 'Confirmed', 'Booked', 'Overdue Check-In', 'No Show'].includes(s)) {
    return 'Pending';
  }

  if (s === 'Cancelled') {
    return 'Cancelled';
  }

  return s;
}

export function isValidBookingStatusTransition(currentStatus, newStatus) {
  const curr = normalizeBookingStatus(currentStatus);
  const next = normalizeBookingStatus(newStatus);

  const allowed = {
    'Pending': ['Checked-In', 'Cancelled', 'Pending'],
    'Checked-In': ['Checked-Out', 'Bill Ready', 'Paid', 'Completed', 'Cancelled'],
    'Checked-Out': ['Bill Ready', 'Checked-In', 'Paid', 'Completed'],
    'Bill Ready': ['Paid', 'Completed', 'Checked-In', 'Checked-Out'],
    'Paid': ['Completed'],
    'Completed': [],
    'Cancelled': []
  };

  return allowed[curr]?.includes(next) ?? true;
}

export function getStatusBadgeClass(status) {
  const norm = normalizeBookingStatus(status);
  switch (norm) {
    case 'Pending':
      return 'badge text-white shadow-xs';
    case 'Checked-In':
      return 'badge text-white shadow-xs';
    case 'Checked-Out':
      return 'badge text-white shadow-xs';
    case 'Bill Ready':
      return 'badge text-white shadow-xs';
    case 'Paid':
      return 'badge text-white shadow-xs';
    case 'Completed':
      return 'badge text-white shadow-xs';
    case 'Cancelled':
      return 'badge bg-danger text-white shadow-xs';
    default:
      return 'badge bg-secondary text-white shadow-xs';
  }
}

export function getStatusBadgeStyle(status) {
  const norm = normalizeBookingStatus(status);
  switch (norm) {
    case 'Pending':
      return { backgroundColor: '#6c757d', color: '#ffffff', border: '1px solid #6c757d' }; // Gray
    case 'Checked-In':
      return { backgroundColor: '#0d6efd', color: '#ffffff', border: '1px solid #0d6efd' }; // Blue
    case 'Checked-Out':
      return { backgroundColor: '#fd7e14', color: '#ffffff', border: '1px solid #fd7e14' }; // Orange
    case 'Bill Ready':
      return { backgroundColor: '#6f42c1', color: '#ffffff', border: '1px solid #6f42c1' }; // Purple
    case 'Paid':
      return { backgroundColor: '#198754', color: '#ffffff', border: '1px solid #198754' }; // Green
    case 'Completed':
      return { backgroundColor: '#343a40', color: '#ffffff', border: '1px solid #343a40' }; // Dark Gray
    case 'Cancelled':
      return { backgroundColor: '#dc3545', color: '#ffffff', border: '1px solid #dc3545' };
    default:
      return { backgroundColor: '#6c757d', color: '#ffffff', border: '1px solid #6c757d' };
  }
}
