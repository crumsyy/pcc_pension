'use client';

import React from 'react';

export {
  BOOKING_STATUSES,
  normalizeBookingStatus,
  getStatusBadgeClass,
  getStatusBadgeStyle
} from '@/lib/bookingStatuses';

import {
  normalizeBookingStatus,
  getStatusBadgeClass,
  getStatusBadgeStyle
} from '@/lib/bookingStatuses';

export default function StatusBadge({ status, className = '', style = {}, showNormalized = true }) {
  const normalized = showNormalized ? normalizeBookingStatus(status) : status;
  const badgeClass = getStatusBadgeClass(normalized);
  const badgeStyle = { ...getStatusBadgeStyle(normalized), ...style };

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
