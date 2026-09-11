'use client';

import React from 'react';

/**
 * StatusBadge Component
 * Renders streamlined booking status badges with standardized color coding:
 * - Active Stay → Blue
 * - Checkout Requested → Orange
 * - Bill Finalized → Purple
 * - Paid → Green
 * - Completed → Gray
 */

export function getStatusBadgeClass(status) {
  switch (status) {
    case 'Active Stay':
    case 'Checked In':
      return 'badge text-white shadow-xs';
    case 'Checkout Requested':
    case 'Pending Checkout':
    case 'Pending Room Verification':
      return 'badge text-dark shadow-xs';
    case 'Bill Finalized':
    case 'Final Billing Updated':
    case 'Room Verified':
      return 'badge text-white shadow-xs';
    case 'Paid':
    case 'Payment Completed':
      return 'badge text-white shadow-xs';
    case 'Completed':
    case 'Checked Out':
      return 'badge text-white shadow-xs';
    case 'Pending Check-in':
    case 'Pending':
    case 'Confirmed':
    case 'Booked':
      return 'badge bg-info text-dark shadow-xs';
    case 'Overdue Check-In':
    case 'Late Checkout':
      return 'badge bg-warning text-dark shadow-xs';
    case 'Cancelled':
    case 'No Show':
      return 'badge bg-danger text-white shadow-xs';
    default:
      return 'badge bg-secondary text-white shadow-xs';
  }
}

export function getStatusBadgeStyle(status) {
  switch (status) {
    case 'Active Stay':
    case 'Checked In':
      return { backgroundColor: '#0d6efd', color: '#ffffff', border: '1px solid #0d6efd' }; // Blue
    case 'Checkout Requested':
    case 'Pending Checkout':
    case 'Pending Room Verification':
      return { backgroundColor: '#fd7e14', color: '#212529', border: '1px solid #fd7e14' }; // Orange
    case 'Bill Finalized':
    case 'Final Billing Updated':
    case 'Room Verified':
      return { backgroundColor: '#6f42c1', color: '#ffffff', border: '1px solid #6f42c1' }; // Purple
    case 'Paid':
    case 'Payment Completed':
      return { backgroundColor: '#198754', color: '#ffffff', border: '1px solid #198754' }; // Green
    case 'Completed':
    case 'Checked Out':
      return { backgroundColor: '#6c757d', color: '#ffffff', border: '1px solid #6c757d' }; // Gray
    default:
      return {};
  }
}

export function normalizeBookingStatus(status) {
  if (!status) return 'Active Stay';
  if (status === 'Checked In') return 'Active Stay';
  if (status === 'Pending Room Verification' || status === 'Pending Checkout') return 'Checkout Requested';
  if (status === 'Room Verified' || status === 'Final Billing Updated') return 'Bill Finalized';
  if (status === 'Payment Completed') return 'Paid';
  if (status === 'Checked Out') return 'Completed';
  return status;
}

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
