'use client';

import React from 'react';
import SearchableSelect from './SearchableSelect';
import ReservationCalendar from './ReservationCalendar';

/**
 * ReceptionistReservationForm Component
 * Specialized reservation form for Front Desk / Receptionists:
 * - Walk-in guest vs Existing registered guest account
 * - Courtesy Hold (48 hours temporary hold without payment + 30m grace period)
 * - Schedule conflict warnings & visual ReservationCalendar overview
 * - Strict field validation (inline errors)
 * - Date/time scheduling with lead-time limits, breakfast options, and guest capacity
 */
export default function ReceptionistReservationForm({
  isWalkIn = false,
  setIsWalkIn,
  walkInForm = {},
  setWalkInForm,
  formData = {},
  setFormData,
  guests = [],
  rooms = [],
  resDate = '',
  setResDate,
  resTime = '14:00',
  setResTime,
  checkOutDate = '',
  setCheckOutDate,
  checkOutTime = '12:00',
  setCheckOutTime,
  breakfastOption = 'with',
  setBreakfastOption,
  guestCount = 1,
  setGuestCount,
  specialRequests = '',
  setSpecialRequests,
  roomSchedules = [],
  formErrors = {},
  hasConflict = false,
  minDate = '',
  maxDate = '',
  className = ''
}) {
  const selectedRoom = rooms.find(r => String(r.roomID) === String(formData.roomID));

  const isFreeBreakfast = Boolean(
    selectedRoom &&
    selectedRoom.breakfastRate !== null &&
    selectedRoom.breakfastRate !== undefined &&
    parseFloat(selectedRoom.breakfastRate) === 0
  );

  React.useEffect(() => {
    if (isFreeBreakfast && breakfastOption !== 'with' && setBreakfastOption) {
      setBreakfastOption('with');
    }
  }, [isFreeBreakfast, breakfastOption, setBreakfastOption]);

  const basePax = parseInt(selectedRoom?.roomBasePax || selectedRoom?.occupancyLimit || 2, 10);
  const numGuests = guestCount === '' ? 1 : (parseInt(guestCount, 10) || 1);
  const extraGuests = Math.max(0, numGuests - basePax);
  const extraGuestFee = extraGuests * 100; // Flat ₱100 per extra guest

  let nightsCount = 1;
  if (resDate && checkOutDate) {
    const inD = new Date(resDate + 'T00:00:00');
    const outD = new Date(checkOutDate + 'T00:00:00');
    if (!isNaN(inD.getTime()) && !isNaN(outD.getTime()) && outD > inD) {
      nightsCount = Math.max(1, Math.round((outD - inD) / (1000 * 60 * 60 * 24)));
    }
  }

  const rateWithBfast = selectedRoom
    ? (parseFloat(selectedRoom.rateWithBreakfast) || (selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined ? parseFloat(selectedRoom.rate) + parseFloat(selectedRoom.breakfastRate) : parseFloat(selectedRoom.rate) || 0))
    : 0;
  const rateWithoutBfast = selectedRoom
    ? (parseFloat(selectedRoom.rateWithoutBreakfast) || parseFloat(selectedRoom.rate) || 0)
    : 0;
  const activeRate = breakfastOption === 'with' ? rateWithBfast : rateWithoutBfast;
  const roomSubtotal = activeRate * nightsCount;
  const estimatedTotal = roomSubtotal + extraGuestFee;

  const isEarlyCheckIn = resTime && resTime < '14:00';
  const isLateCheckOut = checkOutTime && checkOutTime > '12:00';

  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const effectiveMinDate = minDate || todayStr;

  return (
    <div className={`receptionist-reservation-form ${className}`}>
      {/* Courtesy Hold Notice Banner */}
      <div className="alert alert-warning small fw-semibold mb-3" role="alert">
        <i className="bi bi-clock-history me-1.5 text-warning-emphasis"></i>
        Courtesy Hold: This room will be held for 48 hours without payment. 
        If not confirmed with payment, it will be automatically released after a 30-minute grace period.
      </div>

      {/* WALK-IN TOGGLE */}
      <div className="form-check form-switch p-2.5 mb-3 border rounded bg-light d-flex align-items-center justify-content-between">
        <label className="form-check-label fw-bold mb-0 text-dark me-3" htmlFor="walkInToggleForm">
          Walk-In Guest (No Registered Account)
        </label>
        <input
          className="form-check-input ms-0"
          type="checkbox"
          id="walkInToggleForm"
          style={{ width: '2.4em', height: '1.2em', cursor: 'pointer' }}
          checked={isWalkIn}
          onChange={(e) => setIsWalkIn && setIsWalkIn(e.target.checked)}
        />
      </div>

      {/* GUEST DETAILS */}
      {!isWalkIn ? (
        <div className="mb-3">
          <label className="form-label fw-semibold">Select Guest Account *</label>
          <SearchableSelect
            options={guests.map(g => ({
              value: String(g.guestID),
              label: `UID${g.userID || g.guestID} – ${g.firstName} ${g.lastName} (${g.contact || 'No contact'})`
            }))}
            value={formData.guestID}
            onChange={(val) => setFormData && setFormData(prev => ({ ...prev, guestID: val }))}
            placeholder="Type guest name or contact..."
          />
          {formErrors.guestID && (
            <div className="text-danger small mt-1 fw-semibold">{formErrors.guestID}</div>
          )}
        </div>
      ) : (
        <div className="p-3 mb-3 border rounded bg-light">
          <h6 className="mb-3 text-primary fw-bold">Walk-In Guest Details</h6>
          <div className="row g-2 mb-2">
            <div className="col-md-6">
              <label className="form-label small fw-semibold mb-1">First Name *</label>
              <input
                type="text"
                className={`form-control form-control-sm ${formErrors.firstName ? 'is-invalid' : ''}`}
                value={walkInForm.firstName || ''}
                onChange={(e) => setWalkInForm && setWalkInForm(prev => ({ ...prev, firstName: e.target.value }))}
                required
              />
              {formErrors.firstName && (
                <div className="invalid-feedback">{formErrors.firstName}</div>
              )}
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold mb-1">Last Name *</label>
              <input
                type="text"
                className={`form-control form-control-sm ${formErrors.lastName ? 'is-invalid' : ''}`}
                value={walkInForm.lastName || ''}
                onChange={(e) => setWalkInForm && setWalkInForm(prev => ({ ...prev, lastName: e.target.value }))}
                required
              />
              {formErrors.lastName && (
                <div className="invalid-feedback">{formErrors.lastName}</div>
              )}
            </div>
          </div>
          <div className="row g-2 mb-2">
            <div className="col-md-6">
              <label className="form-label small fw-semibold mb-1">Contact Number (11 digits)</label>
              <input
                type="text"
                className={`form-control form-control-sm ${formErrors.contact ? 'is-invalid' : ''}`}
                placeholder="09XXXXXXXXX"
                value={walkInForm.contact || ''}
                onChange={(e) => setWalkInForm && setWalkInForm(prev => ({ ...prev, contact: e.target.value }))}
              />
              {formErrors.contact && (
                <div className="invalid-feedback">{formErrors.contact}</div>
              )}
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold mb-1">Birthdate (Must be 18+)</label>
              <input
                type="date"
                className={`form-control form-control-sm ${formErrors.birthdate ? 'is-invalid' : ''}`}
                value={walkInForm.birthdate || ''}
                onChange={(e) => setWalkInForm && setWalkInForm(prev => ({ ...prev, birthdate: e.target.value }))}
              />
              {formErrors.birthdate && (
                <div className="invalid-feedback">{formErrors.birthdate}</div>
              )}
            </div>
          </div>
          <div className="row g-2">
            <div className="col-12">
              <label className="form-label small fw-semibold mb-1">
                Email Address <span className="text-danger fw-bold">* (Required for Courtesy Hold)</span>
              </label>
              <input
                type="email"
                className={`form-control form-control-sm ${formErrors.email ? 'is-invalid' : (!walkInForm.email ? 'border-warning' : '')}`}
                placeholder="guest@example.com"
                value={walkInForm.email || ''}
                required={true}
                onChange={(e) => setWalkInForm && setWalkInForm(prev => ({ ...prev, email: e.target.value }))}
              />
              {formErrors.email ? (
                <div className="invalid-feedback d-block">{formErrors.email}</div>
              ) : (
                <div className="form-text text-muted" style={{ fontSize: '0.70rem' }}>
                  Required for sending hold expiry alerts and release notifications.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ROOM SELECTION */}
      <div className="mb-3">
        <label className="form-label fw-semibold">Select Room *</label>
        <select
          className={`form-select ${formErrors.roomID ? 'is-invalid' : ''}`}
          value={formData.roomID || ''}
          onChange={(e) => setFormData && setFormData(prev => ({ ...prev, roomID: e.target.value }))}
          required
        >
          <option value="">-- Choose Room --</option>
          {rooms.map(rm => (
            <option key={rm.roomID} value={rm.roomID}>
              Room {rm.roomNumber} ({rm.roomType}) – {rm.status} – ₱{parseFloat(rm.rate || 0).toFixed(2)}/night
            </option>
          ))}
        </select>
        {formErrors.roomID && (
          <div className="invalid-feedback">{formErrors.roomID}</div>
        )}
      </div>

      {/* SELECTED ROOM CALENDAR OVERVIEW */}
      {selectedRoom && (
        <div className="mb-3">
          <ReservationCalendar
            schedules={roomSchedules}
            selectedRoom={selectedRoom}
            selectedRoomId={selectedRoom?.roomID}
            title={`Availability Overview for Room ${selectedRoom.roomNumber}`}
          />
        </div>
      )}

      {/* SCHEDULE CONFLICT ALERT */}
      {hasConflict && (
        <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-1.5 fw-bold"></i>
          <strong>Schedule Conflict:</strong> Room {selectedRoom?.roomNumber} is already reserved, held, or booked for the selected date(s). Please select an alternative date or room.
        </div>
      )}

      {/* DATES & TIMES */}
      <div className="row g-2 mb-3">
        <div className="col-md-6">
          <label className="form-label fw-semibold small">Check-in Date *</label>
          <input
            type="date"
            className={`form-control ${formErrors.resDate ? 'is-invalid' : ''}`}
            value={resDate}
            min={effectiveMinDate}
            max={maxDate}
            onChange={(e) => setResDate && setResDate(e.target.value)}
            required
          />
          {formErrors.resDate && (
            <div className="invalid-feedback">{formErrors.resDate}</div>
          )}
        </div>
        <div className="col-md-6">
          <label className="form-label fw-semibold small d-flex justify-content-between">
            <span>Check-in Time *</span>
            <small className="text-muted" style={{ fontSize: '0.72rem' }}>Std: 2:00 PM</small>
          </label>
          <input
            type="time"
            className="form-control"
            value={resTime}
            onChange={(e) => setResTime && setResTime(e.target.value)}
            required
          />
          {isEarlyCheckIn && (
            <small className="text-warning-emphasis d-block mt-0.5 fw-semibold" style={{ fontSize: '0.73rem' }}>
              ℹ Early Check-in prior to 2:00 PM fee may apply.
            </small>
          )}
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-6">
          <label className="form-label fw-semibold small">Check-out Date *</label>
          <input
            type="date"
            className={`form-control ${formErrors.checkOutDate ? 'is-invalid' : ''}`}
            value={checkOutDate}
            min={resDate || effectiveMinDate}
            onChange={(e) => setCheckOutDate && setCheckOutDate(e.target.value)}
            required
          />
          {formErrors.checkOutDate && (
            <div className="invalid-feedback">{formErrors.checkOutDate}</div>
          )}
        </div>
        <div className="col-md-6">
          <label className="form-label fw-semibold small d-flex justify-content-between">
            <span>Check-out Time *</span>
            <small className="text-muted" style={{ fontSize: '0.72rem' }}>Std: 12:00 PM</small>
          </label>
          <input
            type="time"
            className="form-control"
            value={checkOutTime}
            onChange={(e) => setCheckOutTime && setCheckOutTime(e.target.value)}
            required
          />
          {isLateCheckOut && (
            <small className="text-warning-emphasis d-block mt-0.5 fw-semibold" style={{ fontSize: '0.73rem' }}>
              ℹ Late Check-out past 12:00 PM fee may apply.
            </small>
          )}
        </div>
      </div>

      {/* STAY DURATION SUMMARY */}
      <div className="p-2.5 bg-primary-subtle border border-primary-subtle rounded-3 mb-3 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-1.5 text-primary fw-bold small">
          <i className="bi bi-moon-stars-fill"></i>
          <span>Stay Duration</span>
        </div>
        <span className="badge bg-primary text-white fs-6 px-3 py-1 shadow-xs">
          {nightsCount} {nightsCount === 1 ? 'Night' : 'Nights'}
        </span>
      </div>

      {/* GUEST COUNT & BREAKFAST */}
      <div className="p-3 bg-white border rounded mb-3">
        <div className="row g-2 align-items-center mb-2">
          <div className="col-md-6">
            <label className="form-label fw-bold small text-dark d-flex justify-content-between">
              <span>Breakfast Inclusion *</span>
              {isFreeBreakfast && (
                <span className="text-success fw-semibold">(Complimentary)</span>
              )}
            </label>
            <select
              className="form-select form-select-sm fw-semibold"
              value={breakfastOption}
              onChange={(e) => setBreakfastOption && setBreakfastOption(e.target.value)}
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

          <div className="col-md-6">
            <label className="form-label fw-bold small text-dark">Number of Guests *</label>
            <input
              type="number"
              className="form-control form-control-sm"
              min="1"
              max={basePax + 5}
              value={guestCount}
              onChange={(e) => setGuestCount && setGuestCount(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
              required
            />
            <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
              Standard Room Capacity: <strong>Up to {basePax} Pax</strong>
              {extraGuests > 0 && (
                <span className="text-primary fw-bold ms-1">
                  (+₱{extraGuestFee.toFixed(2)} for {extraGuests} extra guest{extraGuests > 1 ? 's' : ''} @ ₱100 flat)
                </span>
              )}
            </div>
          </div>
        </div>

        {extraGuests > 0 && (
          <div className="alert alert-warning py-1.5 px-2.5 small mb-0 mt-2" style={{ fontSize: '0.78rem' }}>
            <i className="bi bi-info-circle-fill me-1"></i>
            Extra Guest Fee: <strong>₱100 flat per extra guest</strong> applied for {extraGuests} guest(s) exceeding capacity ({basePax}). Total fee: ₱{extraGuestFee.toFixed(2)}.
          </div>
        )}
      </div>

      {/* SPECIAL REQUESTS */}
      <div className="mb-3">
        <label className="form-label fw-semibold small">Special Requests</label>
        <textarea
          className="form-control form-control-sm"
          rows="2"
          placeholder="e.g. Extra pillows, late arrival"
          value={specialRequests}
          onChange={(e) => setSpecialRequests && setSpecialRequests(e.target.value)}
        ></textarea>
      </div>

      {/* BILLING BREAKDOWN PREVIEW */}
      {selectedRoom && (
        <div className="p-3 bg-light rounded border mb-1" style={{ fontSize: '0.88rem' }}>
          <h6 className="fw-bold text-dark mb-2 pb-1 border-bottom" style={{ fontSize: '0.90rem' }}>
            Estimated Billing Breakdown Preview
          </h6>
          <div className="d-flex justify-content-between mb-1">
            <span className="text-muted">
              Room Stay ({nightsCount} night{nightsCount > 1 ? 's' : ''} @ ₱{activeRate.toFixed(2)}/night):
            </span>
            <span className="fw-semibold">₱{roomSubtotal.toFixed(2)}</span>
          </div>
          {extraGuests > 0 && (
            <div className="d-flex justify-content-between mb-1 text-primary">
              <span>Extra Guest Fee ({extraGuests} Extra Pax @ ₱100 flat):</span>
              <span className="fw-semibold">+₱{extraGuestFee.toFixed(2)}</span>
            </div>
          )}
          <div className="d-flex justify-content-between pt-2 border-top fw-bold text-dark" style={{ fontSize: '1.02rem' }}>
            <span>Estimated Total:</span>
            <span className="text-primary">₱{estimatedTotal.toFixed(2)}</span>
          </div>
          <div className="mt-2 pt-2 border-top text-muted small" style={{ fontSize: '0.75rem' }}>
            <i className="bi bi-shield-check text-success me-1"></i>
            <strong>Courtesy Hold:</strong> ₱0.00 due now. Total payable upon booking conversion or check-in.
          </div>
        </div>
      )}
    </div>
  );
}
