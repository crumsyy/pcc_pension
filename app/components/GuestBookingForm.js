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
  totalAmount = 0,
  className = ''
}) {
  const options = [
    { value: '25', label: '25% Down Payment' },
    { value: '50', label: '50% (Default)' },
    { value: '100', label: '100% (Full Payment)' }
  ];

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
      {totalAmount > 0 && (
        <div className="mt-2 small text-muted d-flex justify-content-between">
          <span>Down Payment: <strong>₱{(totalAmount * (parseInt(paymentOption || '50', 10) / 100)).toFixed(2)}</strong></span>
          <span>Remaining: <strong>₱{(totalAmount * (1 - (parseInt(paymentOption || '50', 10) / 100))).toFixed(2)}</strong></span>
        </div>
      )}
    </div>
  );
}
