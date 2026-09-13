'use client';

import React from 'react';
import ReservationFormBase from '@/app/components/ReservationForm';
import { validateReservationDate } from '@/lib/validation';

/**
 * ReservationForm Component for Guest Dashboard
 * Enforces a strict 2-day lead time: guests cannot select today, tomorrow, or next day.
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

export async function handleCourtesyHold(payload) {
  const {
    roomID,
    checkInDate,
    checkOutDate,
    checkInTime,
    checkOutTime,
    numGuests,
    specialRequests,
    useCurrentTime,
    useCurrentTimeIn,
    useCurrentTimeOut,
    reservationID,
    bookingID
  } = payload || {};

  const res = await fetch('/api/guest/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomID,
      checkInDate,
      checkOutDate,
      checkInTime,
      checkOutTime,
      useCurrentTime: Boolean(useCurrentTime),
      useCurrentTimeIn: Boolean(useCurrentTimeIn),
      useCurrentTimeOut: Boolean(useCurrentTimeOut),
      numGuests: numGuests || 1,
      specialRequests: specialRequests || '',
      isCourtesyHold: true,
      holdDurationHours: 48,
      reservationID: reservationID || undefined,
      bookingID: bookingID || undefined
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to place courtesy hold');
  }
  return data;
}

export default function ReservationForm(props) {
  const minLeadStr = getMinReservationDateStr();
  const effectiveMin = (props.minDate && props.minDate > minLeadStr) ? props.minDate : minLeadStr;

  return (
    <ReservationFormBase
      {...props}
      minDate={effectiveMin}
    />
  );
}

