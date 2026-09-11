'use client';

import React from 'react';
import ReceptionistReservationFormBase from '@/app/components/ReceptionistReservationForm';
import { validateReservationDate } from '@/lib/validation';

/**
 * ReservationForm Component for Receptionist Portal
 * Enforces a strict 2-day lead time: receptionists cannot override this restriction when creating reservations.
 * Earliest selectable date is today + 2 days.
 */
export const RESERVATION_LEAD_TIME_ERROR = "Reservations must be made at least 2 days in advance.";

export function getMinReservationDate() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d;
}

export function getMinReservationDateStr() {
  const minD = getMinReservationDate();
  const pad = (n) => String(n).padStart(2, '0');
  return `${minD.getFullYear()}-${pad(minD.getMonth() + 1)}-${pad(minD.getDate())}`;
}

export function validateLeadTime(date) {
  if (!date || !validateReservationDate(date)) {
    return {
      valid: false,
      error: RESERVATION_LEAD_TIME_ERROR
    };
  }
  return { valid: true, error: null };
}

export default function ReservationForm(props) {
  const minLeadStr = getMinReservationDateStr();
  // Ensure receptionist cannot override this restriction to select earlier dates
  const effectiveMin = (props.minDate && props.minDate > minLeadStr) ? props.minDate : minLeadStr;

  return (
    <ReceptionistReservationFormBase
      {...props}
      minDate={effectiveMin}
    />
  );
}
