'use client';

import React from 'react';

/**
 * GuestBookingForm Component
 * Provides down payment selection with radio buttons:
 * - 25%
 * - 50% (default)
 * - 100% (Full Payment)
 */
export default function GuestBookingForm({
  paymentOption = '50',
  setPaymentOption,
  baseRoomCharge = 0,
  extraGuestFee = 0,
  totalAmount = 0,
  className = ''
}) {
  const options = [
    { value: '25', label: '25% Down Payment' },
    { value: '50', label: '50% (Default)' },
    { value: '100', label: '100% (Full Payment)' }
  ];

  const effectiveBase = baseRoomCharge > 0 ? baseRoomCharge : totalAmount;
  const pct = parseInt(paymentOption || '50', 10);
  const dpAmount = Math.round(effectiveBase * (pct / 100) * 100) / 100;
  const remainingAmount = Math.max(0, Math.round(((effectiveBase + extraGuestFee) - dpAmount) * 100) / 100);

  return (
    <div className={`guest-booking-form-payment mb-3 ${className}`}>
      <label className="form-label fw-bold">Select Down Payment Percentage *</label>
      <div className="btn-group w-100" role="group" aria-label="Down payment options">
        {options.map((opt) => (
          <React.Fragment key={opt.value}>
            <input
              type="radio"
              className="btn-check"
              name="payPct"
              id={`pct${opt.value}`}
              value={opt.value}
              checked={String(paymentOption) === opt.value}
              onChange={(e) => setPaymentOption && setPaymentOption(e.target.value)}
            />
            <label
              className={`btn btn-outline-primary fw-bold ${String(paymentOption) === opt.value ? 'active' : ''}`}
              htmlFor={`pct${opt.value}`}
            >
              {opt.label}
            </label>
          </React.Fragment>
        ))}
      </div>
      {effectiveBase > 0 && (
        <div className="mt-2.5 p-2.5 bg-light rounded border small">
          <div className="d-flex justify-content-between mb-1">
            <span className="text-muted">Required Down Payment ({pct}% of Room Charge):</span>
            <strong className="text-success">₱{dpAmount.toFixed(2)}</strong>
          </div>
          {extraGuestFee > 0 && (
            <div className="d-flex justify-content-between mb-1 text-primary">
              <span>Additional Guest Fee (Payable upon Check-in / Final Billing):</span>
              <strong>+₱{extraGuestFee.toFixed(2)}</strong>
            </div>
          )}
          <div className="d-flex justify-content-between pt-1 border-top">
            <span className="text-muted">Estimated Balance at Check-in:</span>
            <strong className="text-dark">₱{remainingAmount.toFixed(2)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
