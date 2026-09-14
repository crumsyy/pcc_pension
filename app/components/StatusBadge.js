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

export default function StatusBadge({ status, type = null, className = '', style = {}, showNormalized = true }) {
  const isRes = type === 'reservation' || (type !== 'booking' && (RESERVATION_STATUSES.includes(status) || ['Courtesy Hold', 'Released', 'On Hold', 'Reserved'].includes(status)));
  const normalized = showNormalized 
    ? (isRes ? normalizeReservationStatus(status) : normalizeBookingStatus(status)) 
    : status;
    
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
