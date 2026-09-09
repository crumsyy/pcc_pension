'use client';

import React from 'react';
import SearchableSelect from './SearchableSelect';

/**
 * ReceptionistReservationForm Component
 * Specialized reservation form for Front Desk / Receptionists:
 * - Walk-in guest vs Existing registered guest account
 * - Courtesy Hold (Walk-in/Phone) toggle with 24h, 48h, 72h durations
 * - Date/time scheduling, breakfast options, guest counts
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
  isCourtesyHold = false,
  setIsCourtesyHold,
  holdDurationHours = 48,
  setHoldDurationHours,
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
  className = ''
}) {
  return (
    <div className={`receptionist-reservation-form ${className}`}>
      {/* COURTESY HOLD TOGGLE */}
      <div className="card border mb-3 shadow-xs bg-light">
        <div className="card-body p-3">
          <div className="form-check form-switch d-flex align-items-center justify-content-between mb-0">
            <div>
              <label className="form-check-label fw-bold text-dark mb-0 d-block" htmlFor="receptionistCourtesyHoldToggle">
                <i className="bi bi-clock-history text-warning me-1.5"></i>
                Courtesy Hold (Walk-in / Phone Inquiries)
              </label>
              <small className="text-muted d-block" style={{ fontSize: '0.74rem' }}>
                Temporarily lock the room without immediate down payment. Automatically releases if not confirmed.
              </small>
            </div>
            <input
              className="form-check-input ms-3"
              type="checkbox"
              id="receptionistCourtesyHoldToggle"
              style={{ width: '2.5em', height: '1.25em', cursor: 'pointer' }}
              checked={isCourtesyHold}
              onChange={(e) => setIsCourtesyHold && setIsCourtesyHold(e.target.checked)}
              aria-label="Courtesy Hold (Walk-in/Phone)"
            />
          </div>

          {/* Hold Duration Options */}
          {isCourtesyHold && (
            <div className="mt-3 p-2.5 bg-white rounded border border-warning-subtle">
              <label className="form-label fw-semibold small text-dark mb-1 d-flex justify-content-between align-items-center" id="rec-hold-duration-label">
                <span>Hold Expiration Timer *</span>
                <span className="badge bg-warning-subtle text-dark" style={{ fontSize: '0.7rem' }}>+30m Grace Period</span>
              </label>

              <div className="d-flex gap-2" role="radiogroup" aria-labelledby="rec-hold-duration-label">
                {[24, 48, 72].map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    className={`btn btn-sm flex-fill py-1.5 ${
                      holdDurationHours === dur ? 'btn-warning text-dark fw-bold shadow-xs' : 'btn-outline-secondary'
                    }`}
                    onClick={() => setHoldDurationHours && setHoldDurationHours(dur)}
                    aria-label={`${dur} Hours Hold`}
                  >
                    {dur} Hours {dur === 48 && <span className="d-block" style={{ fontSize: '0.65rem' }}>(Default)</span>}
                  </button>
                ))}
              </div>

              <div className="small text-muted mt-2 d-flex align-items-center gap-1" style={{ fontSize: '0.73rem' }}>
                <i className="bi bi-info-circle text-warning-emphasis"></i>
                Room will show as "Reserved" (Courtesy Hold) for {holdDurationHours} hours. If unconfirmed, the automated scheduler releases it back to "Available".
              </div>
            </div>
          )}
        </div>
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
          style={{ width: '2.4em', height: '1.2em' }}
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
        </div>
      ) : (
        <div className="p-3 mb-3 border rounded bg-light">
          <h6 className="mb-3 text-primary fw-bold">Walk-In Guest Details</h6>
          <div className="row g-2 mb-2">
            <div className="col-md-6">
              <label className="form-label small fw-semibold mb-1">First Name *</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={walkInForm.firstName || ''}
                onChange={(e) => setWalkInForm && setWalkInForm(prev => ({ ...prev, firstName: e.target.value }))}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold mb-1">Last Name *</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={walkInForm.lastName || ''}
                onChange={(e) => setWalkInForm && setWalkInForm(prev => ({ ...prev, lastName: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label small fw-semibold mb-1">Contact Number</label>
              <input
                type="text"
                className="form-control form-control-sm"
                value={walkInForm.contact || ''}
                onChange={(e) => setWalkInForm && setWalkInForm(prev => ({ ...prev, contact: e.target.value }))}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold mb-1">
                Email Address {isCourtesyHold ? <span className="text-danger fw-bold">* (Required for Courtesy Hold)</span> : <span className="text-muted">(Optional)</span>}
              </label>
              <input
                type="email"
                className={`form-control form-control-sm ${isCourtesyHold && !walkInForm.email ? 'border-warning' : ''}`}
                placeholder={isCourtesyHold ? "Required for expiry alerts" : "Optional email"}
                value={walkInForm.email || ''}
                required={isCourtesyHold}
                onChange={(e) => setWalkInForm && setWalkInForm(prev => ({ ...prev, email: e.target.value }))}
              />
              {isCourtesyHold && (
                <div className="form-text text-muted" style={{ fontSize: '0.70rem' }}>
                  Required to dispatch 12h/6h expiration alerts and release notices.
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
          className="form-select"
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
      </div>

      {/* DATES & TIMES */}
      <div className="row g-2 mb-3">
        <div className="col-md-6">
          <label className="form-label fw-semibold small">Check-in Date *</label>
          <input
            type="date"
            className="form-control"
            value={resDate}
            onChange={(e) => setResDate && setResDate(e.target.value)}
            required
          />
        </div>
        <div className="col-md-6">
          <label className="form-label fw-semibold small">Check-in Time *</label>
          <input
            type="time"
            className="form-control"
            value={resTime}
            onChange={(e) => setResTime && setResTime(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-6">
          <label className="form-label fw-semibold small">Check-out Date *</label>
          <input
            type="date"
            className="form-control"
            value={checkOutDate}
            min={resDate}
            onChange={(e) => setCheckOutDate && setCheckOutDate(e.target.value)}
            required
          />
        </div>
        <div className="col-md-6">
          <label className="form-label fw-semibold small">Check-out Time *</label>
          <input
            type="time"
            className="form-control"
            value={checkOutTime}
            onChange={(e) => setCheckOutTime && setCheckOutTime(e.target.value)}
            required
          />
        </div>
      </div>

      {/* GUEST COUNT & BREAKFAST */}
      <div className="row g-2 mb-3">
        <div className="col-md-6">
          <label className="form-label fw-semibold small">Number of Guests *</label>
          <input
            type="number"
            className="form-control"
            min="1"
            value={guestCount}
            onChange={(e) => setGuestCount && setGuestCount(Math.max(1, parseInt(e.target.value) || 1))}
            required
          />
        </div>
        <div className="col-md-6">
          <label className="form-label fw-semibold small">Breakfast Option</label>
          <select
            className="form-select"
            value={breakfastOption}
            onChange={(e) => setBreakfastOption && setBreakfastOption(e.target.value)}
          >
            <option value="with">With Breakfast</option>
            <option value="without">Without Breakfast</option>
          </select>
        </div>
      </div>

      {/* SPECIAL REQUESTS */}
      <div className="mb-3">
        <label className="form-label fw-semibold small">Special Requests</label>
        <textarea
          className="form-control"
          rows="2"
          placeholder="e.g. Extra pillows, late arrival"
          value={specialRequests}
          onChange={(e) => setSpecialRequests && setSpecialRequests(e.target.value)}
        ></textarea>
      </div>
    </div>
  );
}
