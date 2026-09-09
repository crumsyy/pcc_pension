'use client';

import React from 'react';

/**
 * Calculate down payment rate, amount and remaining balance
 */
export function calculateDownPaymentDetails(totalAmount, selectedOption = 50) {
  const downPaymentRate = (parseFloat(selectedOption) || 50) / 100;
  const downPaymentAmount = Math.round((parseFloat(totalAmount) || 0) * downPaymentRate * 100) / 100;
  const remainingBalance = Math.max(0, Math.round(((parseFloat(totalAmount) || 0) - downPaymentAmount) * 100) / 100);
  return { downPaymentRate, downPaymentAmount, remainingBalance };
}

/**
 * Accurate Guest Billing Breakdown Component
 * Renders:
 * - Room rate
 * - Down payment
 * - Additional charges (incidentals, fees, orders)
 * - Total balance
 * - Payment history link / modal trigger
 */
export default function Billing({ detailedBill, selectedOption, onOpenPaymentHistory }) {
  if (!detailedBill) return null;

  const nights = detailedBill.nights || 1;
  const roomRate = parseFloat(
    detailedBill.baseRoomCharge ||
    detailedBill.chargesSummary?.room ||
    detailedBill.chargesSummary?.roomRate * nights ||
    detailedBill.roomRate * nights ||
    0
  );

  const downPaymentPercentage =
    detailedBill.chargesSummary?.downPaymentPercentage ||
    detailedBill.storedDownPaymentPercentage ||
    detailedBill.downPaymentPercentage ||
    (selectedOption ? parseInt(selectedOption, 10) : 50);

  const downPaymentRate = downPaymentPercentage / 100;
  const downPaymentAmount = parseFloat(
    detailedBill.chargesSummary?.downPaymentPaid ||
    detailedBill.storedDownPaymentAmount ||
    detailedBill.downPaymentPaid ||
    detailedBill.downPaymentAmount ||
    (roomRate * downPaymentRate)
  );
  const downPaymentPaid = downPaymentAmount;

  // Standard Check-in and Check-out times
  const standardCheckInTime = detailedBill.standardCheckInTime || '14:00';
  const standardCheckOutTime = detailedBill.standardCheckOutTime || '12:00';

  const rawCheckInTime = detailedBill.checkInTime ||
    (detailedBill.checkInDateTime ? String(detailedBill.checkInDateTime).substring(11, 16) :
    (detailedBill.booking?.checkInDateTime ? String(detailedBill.booking.checkInDateTime).substring(11, 16) : ''));

  const rawCheckOutTime = detailedBill.checkOutTime ||
    (detailedBill.checkOutDateTime ? String(detailedBill.checkOutDateTime).substring(11, 16) :
    (detailedBill.booking?.checkOutDateTime ? String(detailedBill.booking.checkOutDateTime).substring(11, 16) : ''));

  // Additional Charges: Incidentals + Early Check-In + Late Check-Out + Cooked Meals/Orders + Extra Guests
  const incidentalTotal = parseFloat(
    detailedBill.regularIncidentalTotal ||
    detailedBill.incidentalTotal ||
    0
  );

  let earlyCheckInFee = parseFloat(
    detailedBill.earlyCheckInFee ||
    detailedBill.chargesSummary?.earlyCheckIn ||
    0
  );

  let lateCheckOutFee = parseFloat(
    detailedBill.lateCheckOutFee ||
    detailedBill.chargesSummary?.lateCheckOut ||
    0
  );

  // Dynamic time-based early check-in calculation if not explicitly provided
  if (!earlyCheckInFee && rawCheckInTime && rawCheckInTime < standardCheckInTime) {
    const [cHour, cMin] = rawCheckInTime.split(':').map(Number);
    const [sHour, sMin] = standardCheckInTime.split(':').map(Number);
    const earlyMinutes = ((sHour || 14) * 60 + (sMin || 0)) - ((cHour || 0) * 60 + (cMin || 0));
    if (earlyMinutes > 0) {
      const earlyHours = Math.max(1, Math.ceil(earlyMinutes / 60));
      earlyCheckInFee = earlyHours * (parseFloat(detailedBill.earlyCheckInHourlyRate) || 50);
    }
  }

  // Dynamic time-based late check-out calculation if not explicitly provided
  if (!lateCheckOutFee && rawCheckOutTime && rawCheckOutTime > standardCheckOutTime) {
    const [cHour, cMin] = rawCheckOutTime.split(':').map(Number);
    const [sHour, sMin] = standardCheckOutTime.split(':').map(Number);
    const lateMinutes = ((cHour || 0) * 60 + (cMin || 0)) - ((sHour || 12) * 60 + (sMin || 0));
    if (lateMinutes > 0) {
      const lateHours = Math.max(1, Math.ceil(lateMinutes / 60));
      lateCheckOutFee = lateHours * (parseFloat(detailedBill.lateCheckOutHourlyRate) || 100);
    }
  }

  const extraGuestFee = parseFloat(detailedBill.extraGuestFee || detailedBill.chargesSummary?.extraGuestFee || 0);
  const ordersTotal = parseFloat(detailedBill.ordersTotal || 0);

  const otherCharges = Math.round(
    (incidentalTotal + earlyCheckInFee + lateCheckOutFee + ordersTotal) * 100
  ) / 100;

  const additionalCharges = Math.round(
    (extraGuestFee + otherCharges) * 100
  ) / 100;

  const totalDiscount = parseFloat(
    detailedBill.totalDiscount ||
    detailedBill.chargesSummary?.totalDiscount ||
    0
  );

  const totalBalance = Math.max(
    0,
    Math.round((roomRate + extraGuestFee + otherCharges - totalDiscount - downPaymentPaid) * 100) / 100
  );

  return (
    <div className="billing-breakdown p-3 bg-light rounded-3 border mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
        <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-1.5">
          <i className="bi bi-file-earmark-text text-primary"></i>
          <span>Stay Billing Breakdown</span>
        </h6>
        <span className="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace" style={{ fontSize: '0.72rem' }}>
          #{detailedBill.bookingID || detailedBill.booking?.bookingID}
        </span>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-1.5 small">
        <span className="text-muted">Room Rate ({nights} night{nights > 1 ? 's' : ''}):</span>
        <strong className="text-dark">₱{roomRate.toFixed(2)}</strong>
      </div>

      {downPaymentPaid > 0 && (
        <div className="d-flex justify-content-between align-items-center mb-1.5 small text-primary">
          <span>Down Payment ({downPaymentPercentage}%):</span>
          <strong className="fw-semibold">-₱{downPaymentPaid.toFixed(2)}</strong>
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-1.5 small">
        <span className="text-muted">Additional Charges:</span>
        <strong className="text-dark">₱{additionalCharges.toFixed(2)}</strong>
      </div>

      {/* Additional Charges Details Collapsible or Sub-items */}
      {(extraGuestFee > 0 || incidentalTotal > 0 || earlyCheckInFee > 0 || lateCheckOutFee > 0 || ordersTotal > 0) && (
        <div className="ps-3 py-1 mb-1 border-start border-2 border-secondary small text-muted" style={{ fontSize: '0.75rem' }}>
          {extraGuestFee > 0 && (
            <p className="mb-1 text-dark d-flex justify-content-between">
              <span>• Extra Guest Fee:</span>
              <strong className="text-secondary">₱{extraGuestFee.toFixed(2)}</strong>
            </p>
          )}
          {incidentalTotal > 0 && (
            <div className="d-flex justify-content-between">
              <span>• Incidentals / Damages:</span>
              <span>₱{incidentalTotal.toFixed(2)}</span>
            </div>
          )}
          {earlyCheckInFee > 0 && (
            <div className="d-flex justify-content-between">
              <span>• Early Check-In Fee:</span>
              <span>₱{earlyCheckInFee.toFixed(2)}</span>
            </div>
          )}
          {lateCheckOutFee > 0 && (
            <div className="d-flex justify-content-between">
              <span>• Late Extension Fee:</span>
              <span>₱{lateCheckOutFee.toFixed(2)}</span>
            </div>
          )}
          {ordersTotal > 0 && (
            <div className="d-flex justify-content-between">
              <span>• Cooked Meals &amp; Store Orders:</span>
              <span>₱{ordersTotal.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {totalDiscount > 0 && (
        <div className="d-flex justify-content-between align-items-center mb-1.5 small text-success">
          <span>Applied Discounts:</span>
          <strong className="fw-semibold">-₱{totalDiscount.toFixed(2)}</strong>
        </div>
      )}

      <hr className="my-2" />

      <div className="d-flex justify-content-between align-items-center total-row">
        <span className="fw-bold text-danger fs-6">Total Remaining Balance:</span>
        <span className="fw-bold text-danger fs-5">₱{totalBalance.toFixed(2)}</span>
      </div>

      {onOpenPaymentHistory && (
        <div className="mt-2.5 pt-2 border-top d-flex justify-content-end">
          <button
            type="button"
            className="btn btn-link btn-sm p-0 text-primary fw-semibold d-inline-flex align-items-center gap-1"
            style={{ fontSize: '0.80rem' }}
            onClick={onOpenPaymentHistory}
          >
            <i className="bi bi-clock-history"></i>
            <span>View Payment History &amp; Audit Logs</span>
          </button>
        </div>
      )}
    </div>
  );
}
