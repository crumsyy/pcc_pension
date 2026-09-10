'use client';

import React from 'react';
import ReservationForm from './ReservationForm';

/**
 * GuestReservationForm Component
 * Specialized reservation form for Guests:
 * - Courtesy Hold (48 hours temporary hold without payment + 30m grace period)
 * - Schedule conflict warnings & calendar overview
 */
export default function GuestReservationForm({
  selectedRoom = null,
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
      {/* Courtesy Hold Notice Banner */}
      <div className="alert alert-warning small fw-semibold mb-3" role="alert">
        Courtesy Hold: This room will be held for 48 hours without payment. 
        If not confirmed with payment, it will be automatically released after a 30-minute grace period.
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
