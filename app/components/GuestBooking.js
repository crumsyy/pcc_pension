'use client';

import React from 'react';

/**
 * Calculates required down payment based on room price and down payment rate.
 * @param {number} roomPrice - Base room price pulled from admin room table.
 * @param {number} downPaymentRate - Decimal rate (e.g., 0.30 for 30%, 0.50 for 50%, 1.00 for 100%).
 * @returns {number} Down payment amount.
 */
export function calculateDownPayment(roomPrice, downPaymentRate = 0.30) {
  const price = parseFloat(roomPrice) || 0;
  const rate = parseFloat(downPaymentRate) || 0.30;
  return Math.round(price * rate * 100) / 100;
}

/**
 * Calculates full booking charges breakdown from admin rates and incidentals.
 */
export function calculateBookingBreakdown({
  roomPrice = 0,
  nights = 1,
  downPaymentRate = 0.30,
  downPaymentPaid = 0,
  extraGuestFees = 0,
  incidentals = 0,
  earlyCheckInFee = 0,
  lateCheckOutFee = 0,
  ordersTotal = 0,
  totalDiscount = 0,
  subsequentPayments = 0
}) {
  const baseRoomCharge = Math.round(parseFloat(roomPrice) * Math.max(1, parseInt(nights)) * 100) / 100;
  const netRoomCharge = Math.max(0, Math.round((baseRoomCharge - totalDiscount) * 100) / 100);
  const requiredDownPayment = calculateDownPayment(baseRoomCharge, downPaymentRate);
  const effectiveDownPayment = parseFloat(downPaymentPaid) || 0;

  const additionalCharges = Math.round(
    (parseFloat(extraGuestFees) +
      parseFloat(incidentals) +
      parseFloat(earlyCheckInFee) +
      parseFloat(lateCheckOutFee) +
      parseFloat(ordersTotal)) * 100
  ) / 100;

  const subtotal = Math.round((netRoomCharge + additionalCharges) * 100) / 100;
  const totalPaid = Math.round((effectiveDownPayment + parseFloat(subsequentPayments)) * 100) / 100;
  const totalBalance = Math.max(0, Math.round((subtotal - totalPaid) * 100) / 100);

  return {
    baseRoomCharge,
    netRoomCharge,
    requiredDownPayment,
    effectiveDownPayment,
    additionalCharges,
    subtotal,
    totalPaid,
    totalBalance
  };
}

export default function GuestBookingSummaryCard({
  room,
  nights = 1,
  downPaymentRate = 0.30,
  additionalCharges = 0
}) {
  const roomPrice = parseFloat(room?.rate || room?.price || 0);
  const breakdown = calculateBookingBreakdown({
    roomPrice,
    nights,
    downPaymentRate,
    additionalCharges
  });

  return (
    <div className="card shadow-sm border-0 p-3 bg-white rounded-3 mb-3">
      <h6 className="fw-bold text-dark border-bottom pb-2 mb-2">
        <i className="bi bi-receipt me-1.5 text-primary"></i>Booking Rate &amp; Down Payment Summary
      </h6>
      <div className="d-flex justify-content-between mb-1 small">
        <span className="text-muted">Room Rate ({nights} night(s)):</span>
        <strong className="text-dark">₱{breakdown.baseRoomCharge.toFixed(2)}</strong>
      </div>
      <div className="d-flex justify-content-between mb-1 small text-primary">
        <span>Required Down Payment ({(downPaymentRate * 100).toFixed(0)}%):</span>
        <strong className="fw-bold">₱{breakdown.requiredDownPayment.toFixed(2)}</strong>
      </div>
      {additionalCharges > 0 && (
        <div className="d-flex justify-content-between mb-1 small text-muted">
          <span>Additional Charges:</span>
          <strong>₱{parseFloat(additionalCharges).toFixed(2)}</strong>
        </div>
      )}
      <div className="d-flex justify-content-between pt-2 border-top fw-bold text-danger">
        <span>Balance Due at Check-In:</span>
        <span>₱{(breakdown.baseRoomCharge - breakdown.requiredDownPayment).toFixed(2)}</span>
      </div>
    </div>
  );
}
