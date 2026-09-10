'use client';

import React from 'react';
import ReservationCalendar from './ReservationCalendar';

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
  useCurrentTimeIn = false,
  onChangeUseCurrentTimeIn,
  useCurrentTimeOut = false,
  onChangeUseCurrentTimeOut,
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
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const effectiveMinDate = minDate || todayStr;

  const handleToggleCurrentIn = (checked) => {
    if (onChangeUseCurrentTimeIn) onChangeUseCurrentTimeIn(checked);
    if (checked) {
      const now = new Date();
      const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const nowTodayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      if (onChangeCheckInTime) onChangeCheckInTime(nowTime);
      if (onChangeCheckInDate && (!checkInDate || checkInDate < nowTodayStr)) {
        onChangeCheckInDate(nowTodayStr);
      }
    }
  };

  const handleToggleCurrentOut = (checked) => {
    if (onChangeUseCurrentTimeOut) onChangeUseCurrentTimeOut(checked);
    if (checked) {
      const now = new Date();
      const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      if (onChangeCheckOutTime) onChangeCheckOutTime(nowTime);
    }
  };

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

        {/* Check-In Time */}
        <div className="col-md-6">
          <label className="form-label fw-semibold small text-dark mb-1 d-flex justify-content-between">
            <span>Check-in Time *</span>
            <small className="text-muted" style={{ fontSize: '0.72rem' }}>Std: 2:00 PM</small>
          </label>
          <input
            type="time"
            className={`form-control ${useCurrentTimeIn ? 'bg-light text-muted' : ''}`}
            value={checkInTime}
            onChange={(e) => onChangeCheckInTime && onChangeCheckInTime(e.target.value)}
            disabled={Boolean(useCurrentTimeIn)}
            required
          />
          <div className="form-check mt-1">
            <input
              className="form-check-input"
              type="checkbox"
              id="rfUseCurrentTimeIn"
              checked={Boolean(useCurrentTimeIn)}
              onChange={(e) => handleToggleCurrentIn(e.target.checked)}
            />
            <label className="form-check-label small text-muted user-select-none" htmlFor="rfUseCurrentTimeIn" style={{ fontSize: '0.75rem' }}>
              Use Current Time (auto-record actual time)
            </label>
          </div>
          {isEarlyCheckIn && (
            <small className="text-warning-emphasis d-block mt-0.5 fw-semibold" style={{ fontSize: '0.73rem' }}>
              ℹ Early Check-in ({earlyHours} hr{earlyHours > 1 ? 's' : ''} prior to 2:00 PM) fee of ₱{earlyFee.toFixed(2)} may apply.
            </small>
          )}
        </div>

        {/* Check-Out Time */}
        <div className="col-md-6">
          <label className="form-label fw-semibold small text-dark mb-1 d-flex justify-content-between">
            <span>Check-out Time *</span>
            <small className="text-muted" style={{ fontSize: '0.72rem' }}>Std: 12:00 PM</small>
          </label>
          <input
            type="time"
            className={`form-control ${useCurrentTimeOut ? 'bg-light text-muted' : ''}`}
            value={checkOutTime}
            onChange={(e) => onChangeCheckOutTime && onChangeCheckOutTime(e.target.value)}
            disabled={Boolean(useCurrentTimeOut)}
            required
          />
          <div className="form-check mt-1">
            <input
              className="form-check-input"
              type="checkbox"
              id="rfUseCurrentTimeOut"
              checked={Boolean(useCurrentTimeOut)}
              onChange={(e) => handleToggleCurrentOut(e.target.checked)}
            />
            <label className="form-check-label small text-muted user-select-none" htmlFor="rfUseCurrentTimeOut" style={{ fontSize: '0.75rem' }}>
              Use Current Time (auto-record actual time)
            </label>
          </div>
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
