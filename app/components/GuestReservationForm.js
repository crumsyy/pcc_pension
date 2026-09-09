'use client';

import React from 'react';
import ReservationForm from './ReservationForm';

/**
 * GuestReservationForm Component
 * Specialized reservation form for Guests with support for:
 * 1. Standard Reservation Request
 * 2. Courtesy Hold (No Payment) with selectable durations (24h, 48h default, 72h)
 * 3. Schedule conflict warnings & calendar overview
 */
export default function GuestReservationForm({
  selectedRoom = null,
  isCourtesyHold = false,
  onChangeCourtesyHold,
  holdDurationHours = 48,
  onChangeHoldDuration,
  checkInDate = '',
  onChangeCheckInDate,
  checkOutDate = '',
  onChangeCheckOutDate,
  checkInTime = '14:00',
  onChangeCheckInTime,
  checkOutTime = '12:00',
  onChangeCheckOutTime,
  numGuests = 1,
  onChangeNumGuests,
  roomBasePax = 2,
  specialRequests = '',
  onChangeSpecialRequests,
  minDate = '',
  maxDate = '',
  roomSchedules = [],
  hasConflict = false,
  className = ''
}) {
  return (
    <div className={`guest-reservation-form ${className}`}>
      {/* Reservation Type Selector / Courtesy Hold Toggle */}
      <div className="card border mb-3 shadow-xs bg-light">
        <div className="card-body p-3">
          <label className="form-label fw-bold text-dark mb-2 d-flex align-items-center gap-1.5" id="reservation-type-label">
            <i className="bi bi-shield-check text-primary"></i>
            Reservation Type
          </label>

          <div className="row g-2" role="radiogroup" aria-labelledby="reservation-type-label">
            <div className="col-12 col-sm-6">
              <label
                className={`w-100 p-2.5 rounded border d-flex align-items-start gap-2 cursor-pointer transition ${
                  !isCourtesyHold ? 'bg-white border-primary shadow-xs' : 'bg-light border-secondary-subtle text-muted'
                }`}
                style={{ cursor: 'pointer' }}
              >
                <input
                  type="radio"
                  name="reservationType"
                  className="form-check-input mt-1"
                  checked={!isCourtesyHold}
                  onChange={() => onChangeCourtesyHold && onChangeCourtesyHold(false)}
                  aria-label="Standard Reservation Request"
                />
                <div>
                  <div className="fw-semibold small text-dark">Standard Reservation</div>
                  <div className="small text-muted" style={{ fontSize: '0.74rem' }}>
                    Front Desk review & confirmation
                  </div>
                </div>
              </label>
            </div>

            <div className="col-12 col-sm-6">
              <label
                className={`w-100 p-2.5 rounded border d-flex align-items-start gap-2 cursor-pointer transition ${
                  isCourtesyHold ? 'bg-white border-warning shadow-xs' : 'bg-light border-secondary-subtle text-muted'
                }`}
                style={{ cursor: 'pointer' }}
              >
                <input
                  type="radio"
                  name="reservationType"
                  className="form-check-input mt-1"
                  checked={isCourtesyHold}
                  onChange={() => onChangeCourtesyHold && onChangeCourtesyHold(true)}
                  aria-label="Courtesy Hold (No Payment)"
                />
                <div>
                  <div className="fw-semibold small text-dark d-flex align-items-center gap-1">
                    Courtesy Hold <span className="badge bg-warning text-dark py-0.5 px-1.5" style={{ fontSize: '0.65rem' }}>No Payment</span>
                  </div>
                  <div className="small text-muted" style={{ fontSize: '0.74rem' }}>
                    Temporary room hold (24–72 hours)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Courtesy Hold Duration Selection */}
          {isCourtesyHold && (
            <div className="mt-3 p-2.5 bg-white rounded border border-warning-subtle">
              <label className="form-label fw-semibold small text-dark mb-1 d-flex justify-content-between align-items-center" id="hold-duration-label">
                <span>Hold Duration (Countdown) *</span>
                <span className="badge bg-secondary-subtle text-dark" style={{ fontSize: '0.7rem' }}>+30m Grace Period</span>
              </label>

              <div className="d-flex gap-2" role="radiogroup" aria-labelledby="hold-duration-label">
                {[24, 48, 72].map((dur) => (
                  <label
                    key={dur}
                    className={`flex-fill text-center py-1.5 px-2 border rounded cursor-pointer ${
                      holdDurationHours === dur ? 'bg-warning-subtle border-warning fw-bold text-dark' : 'bg-light text-muted'
                    }`}
                    style={{ cursor: 'pointer', fontSize: '0.82rem' }}
                  >
                    <input
                      type="radio"
                      name="holdDuration"
                      className="d-none"
                      value={dur}
                      checked={holdDurationHours === dur}
                      onChange={() => onChangeHoldDuration && onChangeHoldDuration(dur)}
                      aria-label={`${dur} Hours Hold Duration`}
                    />
                    {dur} Hours {dur === 48 && <span className="d-block" style={{ fontSize: '0.65rem' }}>(Default)</span>}
                  </label>
                ))}
              </div>

              <div className="small text-muted mt-2 d-flex align-items-center gap-1" style={{ fontSize: '0.73rem' }}>
                <i className="bi bi-info-circle text-warning-emphasis"></i>
                Room is held without payment for {holdDurationHours} hours. Confirm with down payment before expiry to finalize booking.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Date and Time Fields + Calendar Overview */}
      <div className="mb-3">
        <ReservationForm
          checkInDate={checkInDate}
          onChangeCheckInDate={onChangeCheckInDate}
          checkOutDate={checkOutDate}
          onChangeCheckOutDate={onChangeCheckOutDate}
          checkInTime={checkInTime}
          onChangeCheckInTime={onChangeCheckInTime}
          checkOutTime={checkOutTime}
          onChangeCheckOutTime={onChangeCheckOutTime}
          minDate={minDate}
          maxDate={maxDate}
          selectedRoom={selectedRoom}
          roomSchedules={roomSchedules}
        />
      </div>

      {/* Schedule Conflict Alert */}
      {hasConflict && (
        <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-1.5 fw-bold"></i>
          <strong>Schedule Conflict:</strong> Room {selectedRoom?.roomNumber} is already reserved, held, or booked for the selected date(s). Please select an alternative date or room.
        </div>
      )}

      {/* Guest Count */}
      <div className="mb-3">
        <label className="form-label fw-semibold small" htmlFor="guestCountInput">Number of Guests *</label>
        <input
          id="guestCountInput"
          type="number"
          className="form-control form-control-sm"
          min="1"
          placeholder="e.g. 2"
          value={numGuests === '' ? '' : numGuests}
          onChange={(e) => onChangeNumGuests && onChangeNumGuests(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
          required
        />
        {selectedRoom && (parseInt(numGuests) || 1) > roomBasePax && (
          <small className="text-primary fw-semibold mt-1 d-block" style={{ fontSize: '0.75rem' }}>
            ℹ Extra Guest Fee: ₱100/night per guest applied for {(parseInt(numGuests) || 1) - roomBasePax} guest(s) exceeding capacity ({roomBasePax}).
          </small>
        )}
      </div>

      {/* Special Requests */}
      <div className="mb-3">
        <label className="form-label fw-semibold small" htmlFor="specialRequestsInput">Special Requests (Optional)</label>
        <textarea
          id="specialRequestsInput"
          className="form-control form-control-sm"
          rows="2"
          placeholder="e.g. Extra pillows, early arrival note"
          value={specialRequests}
          onChange={(e) => onChangeSpecialRequests && onChangeSpecialRequests(e.target.value)}
        ></textarea>
      </div>
    </div>
  );
}
