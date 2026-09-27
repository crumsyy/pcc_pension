'use client';

import React from 'react';
import ReservationForm from './ReservationForm';
import BookingBreakfastSelector from '@/app/guest/rooms/BookingBreakfastSelector';

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
  breakfastOption = 'with',
  onChangeBreakfastOption,
  selectedBreakfastDates = [],
  onChangeBreakfastDates,
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
  const isFreeBreakfast = Boolean(
    selectedRoom &&
    selectedRoom.breakfastRate !== null &&
    selectedRoom.breakfastRate !== undefined &&
    parseFloat(selectedRoom.breakfastRate) === 0
  );

  React.useEffect(() => {
    if (isFreeBreakfast && breakfastOption !== 'with' && onChangeBreakfastOption) {
      onChangeBreakfastOption('with');
    }
  }, [isFreeBreakfast, breakfastOption, onChangeBreakfastOption]);

  const basePax = Math.max(1, parseInt(selectedRoom?.occupancyLimit || 4, 10));
  const guestCount = numGuests === '' ? 1 : (parseInt(numGuests, 10) || 1);

  let nightsCount = 1;
  if (checkInDate && checkOutDate) {
    const dIn = new Date(checkInDate + 'T00:00:00');
    const dOut = new Date(checkOutDate + 'T00:00:00');
    if (!isNaN(dIn.getTime()) && !isNaN(dOut.getTime()) && dOut > dIn) {
      nightsCount = Math.max(1, Math.round((dOut - dIn) / (1000 * 60 * 60 * 24)));
    }
  }

  const extraGuests = Math.max(0, guestCount - basePax);
  const extraGuestFee = extraGuests * 100 * nightsCount; // ₱100/night per extra guest

  const rateWithBfast = selectedRoom
    ? (parseFloat(selectedRoom.rateWithBreakfast) || (selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined ? parseFloat(selectedRoom.rate) + parseFloat(selectedRoom.breakfastRate) : parseFloat(selectedRoom.rate) || 0))
    : 0;
  const rateWithoutBfast = selectedRoom
    ? (parseFloat(selectedRoom.rateWithoutBreakfast) || parseFloat(selectedRoom.rate) || 0)
    : 0;

  const perGuestBreakfastRate = isFreeBreakfast
    ? 0
    : (selectedRoom && selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined
        ? parseFloat(selectedRoom.breakfastRate)
        : (selectedRoom && selectedRoom.rateWithBreakfast && selectedRoom.rateWithoutBreakfast
            ? Math.max(0, parseFloat(selectedRoom.rateWithBreakfast) - parseFloat(selectedRoom.rateWithoutBreakfast))
            : 250));

  const isWithBreakfast = breakfastOption === 'with';
  const breakfastMornings = isWithBreakfast
    ? (nightsCount > 1
        ? (Array.isArray(selectedBreakfastDates) ? selectedBreakfastDates.length : nightsCount)
        : 1)
    : 0;

  const totalBreakfastFee = isWithBreakfast ? (perGuestBreakfastRate * guestCount * breakfastMornings) : 0;
  const baseRoomAccommodation = rateWithoutBfast * nightsCount;
  const roomSubtotal = baseRoomAccommodation + totalBreakfastFee;
  const estimatedTotal = roomSubtotal + extraGuestFee;
  const requiredDownpayment = Math.round(roomSubtotal * 0.5 * 100) / 100;

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

      {/* Stay Duration Badge */}
      <div className="p-2.5 bg-primary-subtle border border-primary-subtle rounded-3 mb-3 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-1.5 text-primary fw-bold small">
          <i className="bi bi-moon-stars-fill"></i>
          <span>Stay Duration</span>
        </div>
        <span className="badge bg-primary text-white fs-6 px-3 py-1 shadow-xs">
          {nightsCount} {nightsCount === 1 ? 'Night' : 'Nights'}
        </span>
      </div>

      {/* Breakfast Inclusion & Number of Guests */}
      <div className="p-3 bg-white border rounded mb-3">
        <div className="row g-2 align-items-center mb-2">
          {/* Breakfast Inclusion */}
          <div className="col-md-6">
            <label className="form-label fw-bold mb-1 small text-dark d-flex justify-content-between">
              <span>Breakfast Inclusion *</span>
              {isFreeBreakfast && (
                <span className="text-success fw-semibold">(Complimentary)</span>
              )}
            </label>
            <select
              className="form-select form-select-sm fw-semibold"
              value={breakfastOption}
              onChange={(e) => onChangeBreakfastOption && onChangeBreakfastOption(e.target.value)}
              disabled={isFreeBreakfast}
            >
              <option value="with">
                With Breakfast (₱{rateWithBfast.toFixed(2)}/night{isFreeBreakfast ? ' - Free' : ''})
              </option>
              {!isFreeBreakfast && (
                <option value="without">
                  Without Breakfast (₱{rateWithoutBfast.toFixed(2)}/night)
                </option>
              )}
            </select>
          </div>

          {/* Guest Count */}
          <div className="col-md-6">
            <label className="form-label fw-bold mb-1 small text-dark">Number of Guests *</label>
            <input
              id="guestCountInput"
              type="number"
              className="form-control form-control-sm"
              min="1"
              max={basePax + 5}
              placeholder="e.g. 2"
              value={numGuests === '' ? '' : numGuests}
              onChange={(e) => onChangeNumGuests && onChangeNumGuests(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
              required
            />
            <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
              Standard Room Capacity: <strong>Up to {basePax} Pax</strong>
              {extraGuests > 0 && (
                <span className="text-primary fw-bold ms-1">
                  (+₱{extraGuestFee.toFixed(2)} for {extraGuests} extra guest{extraGuests > 1 ? 's' : ''} @ ₱100/night)
                </span>
              )}
            </div>
          </div>
        </div>

        {extraGuests > 0 && (
          <div className="alert alert-warning py-1.5 px-2.5 small mb-0 mt-2" style={{ fontSize: '0.78rem' }}>
            <i className="bi bi-info-circle-fill me-1"></i>
            Extra Guest Fee: <strong>₱100/night per extra guest</strong> applied for {extraGuests} guest(s) exceeding standard capacity ({basePax}). Total fee: ₱{extraGuestFee.toFixed(2)}.
          </div>
        )}

        {/* Night-by-Night Breakfast Selection for Multi-Night Stays */}
        {nightsCount > 1 && breakfastOption === 'with' && (
          <div className="mt-3">
            <BookingBreakfastSelector
              checkIn={checkInDate}
              checkOut={checkOutDate}
              guestCount={guestCount}
              breakfastRate={perGuestBreakfastRate}
              perGuestBreakfastRate={perGuestBreakfastRate}
              initialSelectedDates={selectedBreakfastDates}
              onChange={(data) => {
                onChangeBreakfastDates?.(data.selectedDates);
              }}
            />
          </div>
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

      {/* Billing Breakdown Preview */}
      <div className="p-3 bg-light rounded border mb-1" style={{ fontSize: '0.88rem' }}>
        <h6 className="fw-bold text-dark mb-2 pb-1 border-bottom" style={{ fontSize: '0.90rem' }}>
          Estimated Billing Breakdown Preview
        </h6>
        <div className="d-flex justify-content-between mb-1">
          <span className="text-muted">
            Base Room Accommodation ({nightsCount} night{nightsCount > 1 ? 's' : ''} @ ₱{rateWithoutBfast.toFixed(2)}/night):
          </span>
          <span className="fw-semibold">₱{baseRoomAccommodation.toFixed(2)}</span>
        </div>
        {isWithBreakfast && (
          <div className="d-flex justify-content-between mb-1 text-primary">
            <span>
              Breakfast Fee ({breakfastMornings} morning{breakfastMornings > 1 ? 's' : ''} for {guestCount} guest{guestCount > 1 ? 's' : ''}{perGuestBreakfastRate > 0 ? ` @ ₱${perGuestBreakfastRate}/morning` : ' - Free'}):
            </span>
            <span className="fw-semibold">{totalBreakfastFee > 0 ? `+₱${totalBreakfastFee.toFixed(2)}` : '₱0.00'}</span>
          </div>
        )}
        <div className="d-flex justify-content-between mb-1 text-success fw-bold">
          <span>Required Down Payment (50% of Room &amp; Breakfast):</span>
          <span>₱{requiredDownpayment.toFixed(2)}</span>
        </div>
        {extraGuests > 0 && (
          <div className="d-flex justify-content-between mb-1 text-primary">
            <span>Additional Guest Fee ({extraGuests} Extra Pax × {nightsCount} Night{nightsCount > 1 ? 's' : ''}):</span>
            <span className="fw-semibold">+₱{extraGuestFee.toFixed(2)} <small className="text-muted fw-normal">(Payable upon Check-in / Final Billing)</small></span>
          </div>
        )}
        <div className="d-flex justify-content-between pt-2 border-top fw-bold text-dark" style={{ fontSize: '1.02rem' }}>
          <span>Estimated Total Stay Cost:</span>
          <span className="text-primary">₱{estimatedTotal.toFixed(2)}</span>
        </div>
        <div className="mt-2 pt-2 border-top text-muted small" style={{ fontSize: '0.75rem' }}>
          <i className="bi bi-shield-check text-success me-1"></i>
          <strong>Courtesy Hold:</strong> ₱0.00 due now. 50% down payment required upon booking conversion; excess pax fee payable at check-in.
        </div>
      </div>

      {/* Stay Commitment & Early Check-out Policy Notice */}
      <div className="alert alert-info border-info-subtle mt-2 mb-0 d-flex align-items-start gap-2 py-2 px-3 small">
        <i className="bi bi-info-circle-fill text-info fs-6 mt-0.5 flex-shrink-0"></i>
        <div>
          <div className="fw-semibold text-dark">Stay Commitment &amp; Early Check-out Policy</div>
          <div className="text-secondary" style={{ fontSize: '0.78rem' }}>
            Confirmed booking dates guarantee your room reservation. In accordance with pension house policy, early check-out does not discount committed room nights; full accommodation charges for all reserved nights remain strictly payable.
          </div>
        </div>
      </div>
    </div>
  );
}
