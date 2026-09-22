'use client';

import React from 'react';
import ReservationCalendar from './ReservationCalendar';
import { formatTo12Hour } from '@/lib/formatters';

const TIME_SLOTS_30MIN = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'
];

/**
 * ReservationForm Component
 * Standard form controls for selecting Check-in/out Dates and Times,
 * accompanied by the non-interactive ReservationCalendar visual overview.
 */
export default function ReservationForm({
  checkInDate = '',
  onChangeCheckInDate,
  checkOutDate = '',
  onChangeCheckOutDate,
  checkInTime = '14:00',
  onChangeCheckInTime,
  checkOutTime = '12:00',
  onChangeCheckOutTime,
  minDate = '',
  maxDate = '',
  selectedRoom = null,
  roomSchedules = [],
  showCalendar = true,
  className = ''
}) {
  const isEarlyCheckIn = checkInTime && checkInTime < '14:00';
  const isLateCheckOut = checkOutTime && checkOutTime > '12:00';

  // Compute estimated early arrival hours
  let earlyHours = 0;
  let earlyFee = 0;
  if (isEarlyCheckIn) {
    const [h, m] = checkInTime.split(':').map(Number);
    const inMinutes = (h || 0) * 60 + (m || 0);
    const standardInMinutes = 14 * 60;
    earlyHours = Math.max(1, Math.ceil((standardInMinutes - inMinutes) / 60));
    earlyFee = earlyHours * 50;
  }

  // Compute estimated late departure hours
  let lateHours = 0;
  let lateFee = 0;
  if (isLateCheckOut) {
    const [h, m] = checkOutTime.split(':').map(Number);
    const outMinutes = (h || 0) * 60 + (m || 0);
    const standardOutMinutes = 12 * 60;
    lateHours = Math.max(1, Math.ceil((outMinutes - standardOutMinutes) / 60));
    lateFee = lateHours * 100;
  }

  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const minLeadDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
  const minLeadDateStr = `${minLeadDate.getFullYear()}-${pad(minLeadDate.getMonth() + 1)}-${pad(minLeadDate.getDate())}`;
  const effectiveMinDate = (minDate && minDate > minLeadDateStr) ? minDate : minLeadDateStr;


  return (
    <div className={`reservation-form-container ${className}`}>
      {showCalendar && (
        <div className="mb-3">
          <ReservationCalendar
            schedules={roomSchedules}
            selectedRoom={selectedRoom}
            selectedRoomId={selectedRoom?.roomID}
            checkInDate={checkInDate}
            checkOutDate={checkOutDate}
            title="Room Availability Overview"
          />
        </div>
      )}

      <div className="row g-2">
        {/* Check-In Date */}
        <div className="col-md-6">
          <label className="form-label fw-semibold small text-dark mb-1">
            Check-in Date *
          </label>
          <input
            type="date"
            className="form-control"
            value={checkInDate}
            min={effectiveMinDate}
            max={maxDate}
            onChange={(e) => onChangeCheckInDate && onChangeCheckInDate(e.target.value)}
            required
          />
        </div>

        {/* Check-Out Date */}
        <div className="col-md-6">
          <label className="form-label fw-semibold small text-dark mb-1">
            Check-out Date *
          </label>
          <input
            type="date"
            className="form-control"
            value={checkOutDate}
            min={checkInDate || effectiveMinDate}
            onChange={(e) => onChangeCheckOutDate && onChangeCheckOutDate(e.target.value)}
            required
          />
        </div>

        {/* Check-In Time (12-Hour Presentation) */}
        <div className="col-md-6">
          <label className="form-label fw-semibold small text-dark mb-1 d-flex justify-content-between align-items-center">
            <span>Check-in Time *</span>
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: '0.72rem' }}>
              {formatTo12Hour(checkInTime || '14:00')}
            </span>
          </label>
          <select
            className="form-select"
            value={checkInTime?.substring(0, 5) || '14:00'}
            onChange={(e) => onChangeCheckInTime && onChangeCheckInTime(e.target.value)}
            required
          >
            {checkInTime && !TIME_SLOTS_30MIN.includes(checkInTime.substring(0, 5)) && (
              <option value={checkInTime.substring(0, 5)}>
                {formatTo12Hour(checkInTime)}
              </option>
            )}
            {TIME_SLOTS_30MIN.map((slot) => (
              <option key={`res-in-${slot}`} value={slot}>
                {formatTo12Hour(slot)}{slot === '14:00' ? ' (Standard 2:00 PM)' : ''}
              </option>
            ))}
          </select>
          {isEarlyCheckIn && (
            <small className="text-warning-emphasis d-block mt-0.5 fw-semibold" style={{ fontSize: '0.73rem' }}>
              ℹ Early Check-in ({earlyHours} hr{earlyHours > 1 ? 's' : ''} prior to 02:00 PM) fee of ₱{earlyFee.toFixed(2)} may apply.
            </small>
          )}
        </div>

        {/* Check-Out Time (12-Hour Presentation) */}
        <div className="col-md-6">
          <label className="form-label fw-semibold small text-dark mb-1 d-flex justify-content-between align-items-center">
            <span>Check-out Time *</span>
            <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle" style={{ fontSize: '0.72rem' }}>
              {formatTo12Hour(checkOutTime || '12:00')}
            </span>
          </label>
          <select
            className="form-select"
            value={checkOutTime?.substring(0, 5) || '12:00'}
            onChange={(e) => onChangeCheckOutTime && onChangeCheckOutTime(e.target.value)}
            required
          >
            {checkOutTime && !TIME_SLOTS_30MIN.includes(checkOutTime.substring(0, 5)) && (
              <option value={checkOutTime.substring(0, 5)}>
                {formatTo12Hour(checkOutTime)}
              </option>
            )}
            {TIME_SLOTS_30MIN.map((slot) => (
              <option key={`res-out-${slot}`} value={slot}>
                {formatTo12Hour(slot)}{slot === '12:00' ? ' (Standard 12:00 PM)' : ''}
              </option>
            ))}
          </select>
          {isLateCheckOut && (
            <small className="text-danger d-block mt-0.5 fw-semibold" style={{ fontSize: '0.73rem' }}>
              ℹ Late Check-out ({lateHours} hr{lateHours > 1 ? 's' : ''} past 12:00 PM) fee of ₱{lateFee.toFixed(2)} applied @ ₱100/hr.
            </small>
          )}
        </div>
      </div>
    </div>
  );
}
