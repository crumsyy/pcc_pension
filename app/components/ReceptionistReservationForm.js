'use client';

import React from 'react';
import SearchableSelect from './SearchableSelect';
import CalendarDatePicker from './CalendarDatePicker';
import ReservationCalendar from './ReservationCalendar';
import BookingBreakfastSelector from '@/app/guest/rooms/BookingBreakfastSelector';
import { getStayNights } from '@/lib/dateUtils';

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
  selectedBreakfastDates = [],
  setSelectedBreakfastDates,
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

  const basePax = parseInt(selectedRoom?.occupancyLimit || selectedRoom?.roomBasePax || 4, 10);
  const numGuests = guestCount === '' ? 1 : (parseInt(guestCount, 10) || 1);
  let nightsCount = 1;
  if (resDate && checkOutDate) {
    const inD = new Date(resDate + 'T00:00:00');
    const outD = new Date(checkOutDate + 'T00:00:00');
    if (!isNaN(inD.getTime()) && !isNaN(outD.getTime()) && outD > inD) {
      nightsCount = Math.max(1, Math.round((outD - inD) / (1000 * 60 * 60 * 24)));
    }
  }

  const extraGuests = Math.max(0, numGuests - basePax);
  const extraGuestFee = extraGuests * 100 * nightsCount; // ₱100/night per extra guest

  const perGuestBreakfastRate = selectedRoom?.breakfastRate !== null && selectedRoom?.breakfastRate !== undefined
    ? parseFloat(selectedRoom.breakfastRate)
    : (selectedRoom?.rateWithBreakfast && selectedRoom?.rateWithoutBreakfast
        ? Math.max(0, parseFloat(selectedRoom.rateWithBreakfast) - parseFloat(selectedRoom.rateWithoutBreakfast))
        : 250);

  const rateWithBfast = selectedRoom
    ? (parseFloat(selectedRoom.rateWithBreakfast) || (selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined ? parseFloat(selectedRoom.rate) + parseFloat(selectedRoom.breakfastRate) : parseFloat(selectedRoom.rate) || 0))
    : 0;
  const rateWithoutBfast = selectedRoom
    ? (parseFloat(selectedRoom.rateWithoutBreakfast) || parseFloat(selectedRoom.rate) || 0)
    : 0;

  let calculatedBreakfastFee = 0;
  if (breakfastOption === 'with') {
    calculatedBreakfastFee = perGuestBreakfastRate * nightsCount;
  } else if (breakfastOption === 'custom') {
    calculatedBreakfastFee = perGuestBreakfastRate * (selectedBreakfastDates?.length || 0);
  }

  const roomSubtotal = rateWithoutBfast * nightsCount;
  const totalRoomCharge = roomSubtotal + calculatedBreakfastFee;
  const estimatedTotal = totalRoomCharge + extraGuestFee;

  const isEarlyCheckIn = resTime && resTime < '14:00';
  const isLateCheckOut = checkOutTime && checkOutTime > '12:00';

  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const minLeadDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
  const minLeadDateStr = `${minLeadDate.getFullYear()}-${pad(minLeadDate.getMonth() + 1)}-${pad(minLeadDate.getDate())}`;
  const effectiveMinDate = (minDate && minDate > minLeadDateStr) ? minDate : minLeadDateStr;

  return (
    <div className={`receptionist-reservation-form ${className}`}>
      {/* Courtesy Hold Notice Banner */}
      <div className="alert alert-warning small fw-semibold mb-3" role="alert">
        <i className="bi bi-clock-history me-1.5 text-warning-emphasis"></i>
        Courtesy Hold: This room will be held for 48 hours without payment. 
        If not confirmed with payment, it will be automatically released after a 30-minute grace period.
      </div>

      {/* TOP: SELECT GUEST ACCOUNT (UID) */}
      <div className="p-3 mb-3 border rounded bg-light">
        <div className="d-flex align-items-center justify-content-between mb-1">
          <label className="form-label fw-bold text-dark mb-0">
            <i className="bi bi-person-badge text-primary me-1.5"></i>
            Select Guest Account (UID)
          </label>
          {formData.guestID && (
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
              <i className="bi bi-check-circle-fill me-1"></i> Auto-filled from Guest Account
            </span>
          )}
        </div>
        <SearchableSelect
          options={guests.map(g => ({
            value: String(g.guestID),
            label: `UID${g.userID || g.guestID} – ${g.firstName} ${g.lastName} (${g.contact || 'No contact'})`
          }))}
          value={formData.guestID || ''}
          onChange={(val) => {
            if (setFormData) setFormData(prev => ({ ...prev, guestID: val }));
            if (setWalkInForm) {
              if (!val) {
                // blank: walk-in
              } else {
                const selected = guests.find(g => String(g.guestID) === String(val));
                if (selected) {
                  setWalkInForm(prev => ({
                    ...prev,
                    firstName: selected.firstName || '',
                    lastName: selected.lastName || '',
                    contact: selected.contact || '',
                    birthdate: selected.dateOfBirth ? String(selected.dateOfBirth).substring(0, 10) : '',
                    email: selected.email || ''
                  }));
                }
              }
            }
          }}
          placeholder="Type UID, guest name or contact to search..."
        />
        <div className="form-text text-muted small mt-1">
          <i className="bi bi-info-circle me-1"></i>
          Leave blank for walk-in guest.
        </div>
        {formErrors.guestID && (
          <div className="text-danger small mt-1 fw-semibold">{formErrors.guestID}</div>
        )}
      </div>

      {/* GUEST DETAILS (ALWAYS VISIBLE) */}
      <div className="p-3 mb-3 border rounded bg-white shadow-xs">
        <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
          <h6 className="mb-0 text-primary fw-bold d-flex align-items-center gap-1.5">
            <i className="bi bi-person-lines-fill"></i>
            Guest Details
          </h6>
          <span className="badge bg-light text-muted border small">
            {formData.guestID ? 'Account Linked' : 'Walk-In Entry'}
          </span>
        </div>
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
            <label className="form-label small fw-semibold mb-1">Contact Number (11 digits) *</label>
            <input
              type="text"
              className={`form-control form-control-sm ${formErrors.contact ? 'is-invalid' : ''}`}
              placeholder="09XXXXXXXXX"
              value={walkInForm.contact || ''}
              onChange={(e) => {
                const sanitized = e.target.value.replace(/[^0-9]/g, "").slice(0, 11);
                if (setWalkInForm) setWalkInForm(prev => ({ ...prev, contact: sanitized }));
              }}
              required
            />
            {formErrors.contact && (
              <div className="invalid-feedback">{formErrors.contact}</div>
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold mb-1">Birthdate (18+) *</label>
            <input
              type="date"
              className={`form-control form-control-sm ${formErrors.birthdate ? 'is-invalid' : ''}`}
              value={walkInForm.birthdate || ''}
              onChange={(e) => setWalkInForm && setWalkInForm(prev => ({ ...prev, birthdate: e.target.value }))}
              required
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
                Required for sending courtesy hold expiry alerts and auto-release notifications.
              </div>
            )}
          </div>
        </div>
      </div>

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
              Room {rm.roomNumber} ({rm.roomType || 'Standard Room'}) – {rm.status} – ₱{parseFloat(rm.rate || 0).toFixed(2)}/night
            </option>
          ))}
        </select>
        {formErrors.roomID && (
          <div className="invalid-feedback">{formErrors.roomID}</div>
        )}
      </div>


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

        {/* SINGLE VISUAL CALENDAR WITH DUAL HIGHLIGHTING & ROOM STATUSES */}
        <div className="col-12 mt-2">
          <ReservationCalendar
            schedules={roomSchedules}
            selectedRoom={selectedRoom}
            selectedRoomId={selectedRoom?.roomID}
            checkInDate={resDate}
            checkOutDate={checkOutDate}
            title={selectedRoom ? `Room ${selectedRoom.roomNumber} Availability & Status Overview` : "Room Availability & Status Overview"}
          />
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
              onChange={(e) => {
                const val = e.target.value;
                setBreakfastOption && setBreakfastOption(val);
                if (val === 'without') {
                  setSelectedBreakfastDates && setSelectedBreakfastDates([]);
                } else if (val === 'with') {
                  const stayNights = getStayNights(resDate, checkOutDate);
                  setSelectedBreakfastDates && setSelectedBreakfastDates(stayNights.map(n => n.dateStr));
                }
              }}
              disabled={isFreeBreakfast}
            >
              <option value="with">
                With Breakfast (All Mornings)
              </option>
              <option value="custom">
                Customize Breakfast Mornings
              </option>
              {!isFreeBreakfast && (
                <option value="without">
                  Without Breakfast
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

        {/* Night-by-Night Breakfast Selection */}
        {breakfastOption === 'custom' && resDate && checkOutDate && (
          <div className="mt-3">
            <BookingBreakfastSelector
              checkIn={resDate}
              checkOut={checkOutDate}
              guestCount={numGuests}
              breakfastRate={perGuestBreakfastRate}
              perGuestBreakfastRate={perGuestBreakfastRate}
              initialSelectedDates={selectedBreakfastDates}
              onChange={(data) => {
                setSelectedBreakfastDates && setSelectedBreakfastDates(data.selectedDates);
              }}
            />
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
              Base Room Accommodation ({nightsCount} night{nightsCount > 1 ? 's' : ''} @ ₱{rateWithoutBfast.toFixed(2)}/night):
            </span>
            <span className="fw-semibold">₱{roomSubtotal.toFixed(2)}</span>
          </div>
          {calculatedBreakfastFee > 0 && (
            <div className="d-flex justify-content-between mb-1 text-success">
              <span>
                Breakfast Fee ({breakfastOption === 'custom' ? `${selectedBreakfastDates?.length || 0} morning(s)` : `${nightsCount} morning(s)`} @ ₱{perGuestBreakfastRate.toFixed(2)}):
              </span>
              <span className="fw-semibold">+₱{calculatedBreakfastFee.toFixed(2)}</span>
            </div>
          )}
          <div className="d-flex justify-content-between mb-1 text-success fw-bold">
            <span>Required Down Payment (50% of Room Charge):</span>
            <span>₱{(roomSubtotal * 0.5).toFixed(2)}</span>
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
      )}
    </div>
  );
}
