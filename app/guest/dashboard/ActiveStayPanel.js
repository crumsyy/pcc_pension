'use client';

import React, { useState } from 'react';
import Button from '@/app/components/Button';
import StatusBadge from '@/app/components/StatusBadge';
import './styles.css';

export default function ActiveStayPanel({
  activeBookingStay,
  detailedBill,
  loadingBill,
  onViewLiveBill,
  onPay,
  onRequestCheckout,
  formatBookingID,
  renderBookingStatusTimeline
}) {
  const [requestingCheckout, setRequestingCheckout] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState('');
  const [isCheckoutRequested, setIsCheckoutRequested] = useState(false);

  if (!activeBookingStay) return null;

  const remainingBal = parseFloat(
    activeBookingStay.remainingBalance ??
    detailedBill?.balance ??
    detailedBill?.remainingBalance ??
    detailedBill?.balancing?.remainingBalance ??
    0
  );

  const isAlreadyRequested = activeBookingStay.status === 'Checkout Requested' || isCheckoutRequested;

  const handleRequestCheckoutClick = async () => {
    if (onRequestCheckout) {
      return onRequestCheckout(activeBookingStay);
    }
    setRequestingCheckout(true);
    try {
      const res = await fetch('/api/guest/checkout-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingID: activeBookingStay.bookingID })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request checkout');
      setIsCheckoutRequested(true);
      setCheckoutNotice("Checkout request sent. Receptionist will finalize your bill.");
    } catch (err) {
      alert(err.message || 'Error sending checkout request');
    } finally {
      setRequestingCheckout(false);
    }
  };

  return (
    <div
      id="active-booking-card"
      className="card shadow-sm border-0 border-start border-4 border-primary p-3 mb-4 bg-white"
      style={{ borderRadius: '12px' }}
    >
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div className="w-100">
          {/* TOP HEADER */}
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
            <span className="badge bg-primary text-white px-3 py-1.5 fs-7 rounded-pill">
              Active Stay Booking ({formatBookingID ? formatBookingID(activeBookingStay.bookingID) : `#${activeBookingStay.bookingID}`})
            </span>
            <StatusBadge status={activeBookingStay.status || 'Active Stay'} />
          </div>

          <h5 className="fw-bold mb-1 text-dark">
            Room {activeBookingStay.roomNumber} <span className="text-muted fw-normal" style={{ fontSize: '0.90rem' }}>({activeBookingStay.roomType})</span>
          </h5>

          {/* DEDICATED BILLING & PAYMENTS ACTION SECTION */}
          <div className="billing-payments-section shadow-xs">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div>
                <div className="fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '0.92rem' }}>
                  <i className="bi bi-credit-card-2-front text-primary fs-5"></i>
                  <span>Billing &amp; Payments</span>
                </div>
                <small className="text-muted d-block mt-0.5" style={{ fontSize: '0.78rem' }}>
                  Review itemized room charges, meals, and request checkout
                </small>
              </div>

              <div className="billing-payments-actions">
                <Button
                  variant="primary"
                  className="btn-spaced shadow-sm"
                  onClick={onViewLiveBill}
                >
                  <i className="bi bi-receipt me-2"></i>Live Bill
                </Button>

                <Button
                  variant="warning"
                  className="btn-spaced shadow-sm fw-bold text-dark"
                  disabled={isAlreadyRequested || requestingCheckout || activeBookingStay.status === 'Completed'}
                  onClick={handleRequestCheckoutClick}
                >
                  <i className="bi bi-box-arrow-right me-2"></i>
                  {isAlreadyRequested ? 'Checkout Requested' : (requestingCheckout ? 'Sending Request...' : 'Request Checkout')}
                </Button>
              </div>
            </div>

            {checkoutNotice && (
              <div className="alert alert-warning py-2 px-3 small mt-2 mb-0 d-flex align-items-center gap-2 fw-semibold" role="alert">
                <i className="bi bi-info-circle-fill text-warning-emphasis"></i>
                <span>{checkoutNotice}</span>
              </div>
            )}
          </div>

          {/* GUEST BILLING BREAKDOWN CARD */}
          <div id="stay-billing-breakdown" className="card border rounded-3 p-3 bg-light-subtle my-3">
            <div className="d-flex justify-content-between align-items-center mb-2.5 pb-2 border-bottom">
              <div className="fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '0.90rem' }}>
                <i className="bi bi-receipt-cutoff text-primary fs-6"></i>
                <span>Stay Billing Breakdown</span>
              </div>
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1" style={{ fontSize: '0.74rem' }}>
                {detailedBill?.booking?.status || activeBookingStay.status}
              </span>
            </div>

            {loadingBill ? (
              <div className="text-center py-3 text-muted small">
                <span className="spinner-border spinner-border-sm text-primary me-2"></span>
                <span>Loading itemized billing details...</span>
              </div>
            ) : (
              <div className="d-flex flex-column gap-2" style={{ fontSize: '0.82rem' }}>
                {/* 1. Room Charges */}
                <div className="p-2.5 bg-white rounded border">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="fw-semibold text-dark">
                      <i className="bi bi-door-closed me-1.5 text-primary"></i>
                      {detailedBill?.booking?.roomType || activeBookingStay.roomType || 'Room'} ({detailedBill?.nights || detailedBill?.chargesBreakdown?.room?.nights || 1} Night(s))
                    </span>
                    <span className="fw-bold text-dark">
                      ₱{parseFloat(detailedBill?.chargesBreakdown?.room?.finalRoomCharge || detailedBill?.finalRoomCharge || (activeBookingStay.rate * (detailedBill?.nights || 1)) || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-muted small d-flex flex-wrap gap-2" style={{ fontSize: '0.74rem' }}>
                    <span>Rate: ₱{parseFloat(detailedBill?.chargesBreakdown?.room?.rate || activeBookingStay.rate || 0).toFixed(2)}/night</span>
                    <span>• Breakfast: <strong className="text-dark">{detailedBill?.booking?.breakfastOption === 'without' ? 'Without Breakfast' : 'With Breakfast Included'}</strong></span>
                    {(detailedBill?.chargesBreakdown?.additionalFees?.extraGuestsCount > 0) && (
                      <span>• Extra Pax: {detailedBill.chargesBreakdown.additionalFees.extraGuestsCount} (₱{parseFloat(detailedBill.chargesBreakdown.additionalFees.extraGuestFee).toFixed(2)})</span>
                    )}
                  </div>
                </div>

                {/* 2. Cooked Meals */}
                {((detailedBill?.chargesBreakdown?.orders?.products || []).some(p => p.productCategoryID === 3 || (p.name && p.name.toLowerCase().includes('breakfast')))) && (
                  <div className="p-2.5 bg-white rounded border">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-semibold text-dark">
                        <i className="bi bi-cup-hot me-1.5 text-warning"></i>Cooked Breakfast Meals
                      </span>
                      <span className="fw-bold text-dark">
                        ₱{parseFloat(
                          (detailedBill?.chargesBreakdown?.orders?.products || [])
                            .filter(p => p.productCategoryID === 3 || (p.name && p.name.toLowerCase().includes('breakfast')))
                            .reduce((sum, p) => sum + (parseFloat(p.price) * p.quantity), 0)
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="d-flex flex-column gap-0.5" style={{ fontSize: '0.74rem' }}>
                      {(detailedBill?.chargesBreakdown?.orders?.products || [])
                        .filter(p => p.productCategoryID === 3 || (p.name && p.name.toLowerCase().includes('breakfast')))
                        .map((m, idx) => (
                          <div key={idx} className="d-flex justify-content-between text-muted">
                            <span>{m.quantity}x {m.name}</span>
                            <span>₱{(parseFloat(m.price) * m.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 3. Products & Amenities */}
                {(((detailedBill?.chargesBreakdown?.orders?.products || []).some(p => p.productCategoryID !== 3 && (!p.name || !p.name.toLowerCase().includes('breakfast')))) ||
                  ((detailedBill?.chargesBreakdown?.orders?.amenities || []).length > 0)) && (
                  <div className="p-2.5 bg-white rounded border">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-semibold text-dark">
                        <i className="bi bi-bag-check me-1.5 text-info"></i>Products &amp; Amenities Ordered
                      </span>
                      <span className="fw-bold text-dark">
                        ₱{parseFloat(
                          ((detailedBill?.chargesBreakdown?.orders?.products || [])
                            .filter(p => p.productCategoryID !== 3 && (!p.name || !p.name.toLowerCase().includes('breakfast')))
                            .reduce((sum, p) => sum + (parseFloat(p.price) * p.quantity), 0)) +
                          ((detailedBill?.chargesBreakdown?.orders?.amenities || [])
                            .reduce((sum, a) => sum + (parseFloat(a.price) * a.quantity), 0))
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="d-flex flex-column gap-0.5" style={{ fontSize: '0.74rem' }}>
                      {(detailedBill?.chargesBreakdown?.orders?.products || [])
                        .filter(p => p.productCategoryID !== 3 && (!p.name || !p.name.toLowerCase().includes('breakfast')))
                        .map((p, idx) => (
                          <div key={`p-${idx}`} className="d-flex justify-content-between text-muted">
                            <span>{p.quantity}x {p.name}</span>
                            <span>₱{(parseFloat(p.price) * p.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      {(detailedBill?.chargesBreakdown?.orders?.amenities || []).map((a, idx) => (
                        <div key={`a-${idx}`} className="d-flex justify-content-between text-muted">
                          <span>{a.quantity}x {a.name}</span>
                          <span>₱{(parseFloat(a.price) * a.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Incidental Charges */}
                <div className="p-2.5 bg-white rounded border">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-semibold text-dark">
                      <i className="bi bi-shield-exclamation me-1.5 text-danger"></i>Incidental Fees &amp; Damages
                    </span>
                    <span className="fw-bold text-dark">
                      ₱{parseFloat(detailedBill?.chargesBreakdown?.incidentalFees?.total || detailedBill?.regularIncidentalTotal || 0).toFixed(2)}
                    </span>
                  </div>
                  {(detailedBill?.chargesBreakdown?.incidentalFees?.charges || []).length > 0 ? (
                    <div className="d-flex flex-column gap-0.5 mt-1" style={{ fontSize: '0.74rem' }}>
                      {(detailedBill?.chargesBreakdown?.incidentalFees?.charges || []).map((inc, idx) => (
                        <div key={idx} className="d-flex justify-content-between text-danger">
                          <span>• {inc.description}</span>
                          <span>₱{parseFloat(inc.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted small" style={{ fontSize: '0.72rem' }}>₱0.00 - No incidental damages or penalty charges.</div>
                  )}
                </div>

                {/* 5. Totals & Balance Due Summary */}
                <div className="p-3 bg-white rounded border mt-1">
                  <div className="d-flex justify-content-between mb-1 text-muted">
                    <span>Gross Total Charges:</span>
                    <span className="fw-semibold text-dark">
                      ₱{parseFloat(detailedBill?.balancing?.subtotal || detailedBill?.subtotal || 0).toFixed(2)}
                    </span>
                  </div>
                  {(parseFloat(detailedBill?.chargesBreakdown?.discounts?.total || detailedBill?.totalDiscount || 0) > 0) && (
                    <div className="d-flex justify-content-between mb-1 text-success">
                      <span>Discounts Applied:</span>
                      <span>-₱{parseFloat(detailedBill?.chargesBreakdown?.discounts?.total || detailedBill?.totalDiscount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Down Payment / Paid Total:</span>
                    <span className="text-success fw-bold">
                      ₱{parseFloat(detailedBill?.balancing?.paidTotal || detailedBill?.paidTotal || 0).toFixed(2)}
                      <span className="badge bg-success-subtle text-success ms-1.5" style={{ fontSize: '0.68rem' }}>Settled</span>
                    </span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                    <div>
                      <span className="fw-bold text-dark fs-6">Balance Due:</span>
                      <div className="text-muted small" style={{ fontSize: '0.70rem' }}>Payable online or upon checkout</div>
                    </div>
                    <div className="text-end">
                      <span className={`fw-bold fs-5 ${remainingBal > 0 ? 'text-danger' : 'text-success'}`}>
                        ₱{remainingBal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {remainingBal > 0 && (
                    <Button
                      variant="primary"
                      className="w-100 mt-2.5"
                      onClick={() => onPay(activeBookingStay)}
                      style={{ backgroundColor: 'var(--pcc-blue)', borderColor: 'var(--pcc-blue)' }}
                    >
                      <i className="bi bi-credit-card me-2"></i>
                      <span>Proceed to Pay (₱{remainingBal.toFixed(2)})</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* BOOKING STATUS TIMELINE */}
          {renderBookingStatusTimeline && renderBookingStatusTimeline(activeBookingStay.status)}
        </div>
      </div>
    </div>
  );
}
