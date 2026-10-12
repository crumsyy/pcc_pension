'use client';

import React from 'react';

export {
  RESERVATION_STATUSES,
  BOOKING_STATUSES,
  normalizeReservationStatus,
  normalizeBookingStatus,
  getStatusBadgeClass,
  getStatusBadgeStyle
} from '@/lib/bookingStatuses';

import {
  RESERVATION_STATUSES,
  normalizeReservationStatus,
  normalizeBookingStatus,
  getStatusBadgeClass,
  getStatusBadgeStyle
} from '@/lib/bookingStatuses';

export default function StatusBadge({ status, type = null, className = '', style = {}, showNormalized = true, foldBookingFlow = false }) {
  const isRes = type === 'reservation' || (type !== 'booking' && (RESERVATION_STATUSES.includes(status) || ['Courtesy Hold', 'Released', 'On Hold', 'Reserved'].includes(status)));
  let normalized = showNormalized
    ? (isRes ? normalizeReservationStatus(status) : normalizeBookingStatus(status))
    : status;

  // Display-only simplification: Booked > Occupied > Completed.
  // Mid-flow billing states render as Occupied. Backend statuses untouched.
  if (foldBookingFlow && !isRes && ['Bill Finalized', 'Final Billing Updated', 'Bill Ready', 'Paid', 'Payment Completed'].includes(normalized)) {
    normalized = 'Occupied';
  }
    
  const badgeClass = getStatusBadgeClass(normalized, isRes ? 'reservation' : 'booking');
  const badgeStyle = { ...getStatusBadgeStyle(normalized, isRes ? 'reservation' : 'booking'), ...style };

  return (
    <span
      className={`${badgeClass} ${className} px-2.5 py-1 fw-semibold`}
      style={{
        borderRadius: '6px',
        fontSize: '0.76rem',
        letterSpacing: '0.01em',
        ...badgeStyle
      }}
    >
      {normalized}
    </span>
  );
}
