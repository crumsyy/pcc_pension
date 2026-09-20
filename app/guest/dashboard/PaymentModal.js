'use client';

import React, { useState, useEffect } from 'react';
import Button from '@/app/components/Button';
import LoadingButton from '@/app/components/LoadingButton';
import { normalizeBookingStatus } from '@/lib/bookingStatuses';

/**
 * PaymentModal Component for Guest Portal
 * - Zero-trust GCash Checkout via /api/guest/payments/create-checkout
 * - Supports official PayMongo dynamic QRPh code with pre-set amount
 * - Mobile-responsive layout with Back button positioned at the bottom below action buttons
 */
export default function PaymentModal({
  isOpen,
  onClose,
  booking,
  amount = 0,
  onPaymentSuccess = null,
  onPaymentFailed = null
}) {
  const [loadingQrph, setLoadingQrph] = useState(false);
  const [qrphData, setQrphData] = useState(null);
  const [qrphError, setQrphError] = useState('');
  const [actionError, setActionError] = useState('');
  const [redirectingCheckout, setRedirectingCheckout] = useState(false);

  const parsedAmount = parseFloat(amount || booking?.remainingBalance || 0);
  const bookingID = booking?.bookingID;
  const normalizedStatus = normalizeBookingStatus(booking?.status);
  const isCheckedInWithoutBill = normalizedStatus === 'Checked-In';
  const canGenerateQr = !isCheckedInWithoutBill;

  // Auto-fetch dynamic QRPh code when opening modal if eligible
  useEffect(() => {
    if (isOpen) {
      setActionError('');
      if (canGenerateQr && !qrphData && !loadingQrph) {
        fetchQrphCode();
      }
    }
  }, [isOpen, canGenerateQr]);

  if (!isOpen || !booking) return null;

  const fetchQrphCode = async () => {
    if (!canGenerateQr) {
      setQrphError("QRPh code can only be generated once the bill is ready.");
      return;
    }
    setLoadingQrph(true);
    setQrphError('');
    try {
      const res = await fetch('/api/guest/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_qrph',
          bookingID,
          amount: parsedAmount
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate official PayMongo QRPh code.');
      }
      setQrphData(data);
    } catch (err) {
      setQrphError(err.message || 'Error generating dynamic QRPh code.');
    } finally {
      setLoadingQrph(false);
    }
  };

  const handleProceedToGCashCheckout = async () => {
    try {
      setRedirectingCheckout(true);
      setActionError('');
      const res = await fetch('/api/guest/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingID,
          paymentType: 'full'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create GCash checkout.');
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout URL returned from payment gateway.');
      }
    } catch (err) {
      setActionError(err.message || 'Unable to proceed to GCash.');
      setRedirectingCheckout(false);
    }
  };

  return (
    <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '460px' }}>
        <div className="modal-content shadow-lg border-0" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          {/* MODAL HEADER */}
          <div className="modal-header text-white px-4 py-3" style={{ backgroundColor: '#005ce6' }}>
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-wallet2 fs-5"></i>
              <h5 className="modal-title fw-bold mb-0">GCash Payment (PayMongo)</h5>
            </div>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} disabled={redirectingCheckout}></button>
          </div>

          {/* MODAL BODY */}
          <div className="modal-body p-4 text-center">
            {actionError && (
              <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-exclamation-triangle-fill text-danger fs-6"></i>
                <div className="text-start">{actionError}</div>
              </div>
            )}

            <div className="mb-3">
              <div className="text-muted small">Booking #{bookingID}</div>
              <div className="fs-3 fw-bold text-dark">₱{parsedAmount.toFixed(2)}</div>
              <div className="text-muted small">Total Outstanding Balance</div>
            </div>

            {/* PAYMENT DETAILS / QR */}
            <div className="card border-0 shadow-sm p-3 bg-light rounded-3 mb-3 text-center">
              <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-qr-code-scan text-primary fs-5"></i>
                  <span className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>Pay via QRPh / GCash</span>
                </div>
                <span className="badge bg-primary text-white fw-semibold" style={{ fontSize: '0.72rem' }}>
                  Live Checkout
                </span>
              </div>

              {loadingQrph ? (
                <div className="py-4 text-center">
                  <div className="spinner-border text-primary" role="status"></div>
                  <div className="small text-muted mt-2">Loading PayMongo GCash checkout...</div>
                </div>
              ) : qrphData ? (
                <div className="d-flex flex-column align-items-center justify-content-center">
                  <div className="bg-white p-2 rounded shadow-sm border mb-2 position-relative" style={{ display: 'inline-block' }}>
                    <div className="position-relative d-inline-block">
                      <img
                        src={qrphData.qrCodeUrl}
                        alt="PayMongo Dynamic QRPh Code"
                        className="img-fluid rounded"
                        style={{ width: '200px', height: '200px', objectFit: 'contain' }}
                      />
                      {!qrphData.qrCodeUrl?.startsWith('data:image') && (
                        <div
                          className="position-absolute top-50 start-50 translate-middle bg-white p-1 rounded shadow-sm border border-danger d-flex align-items-center justify-content-center"
                          style={{ width: '36px', height: '36px', pointerEvents: 'none' }}
                        >
                          <span className="badge bg-danger text-white fw-bold" style={{ fontSize: '0.62rem', padding: '2px 4px', letterSpacing: '0.3px' }}>QR Ph</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="alert alert-info py-2 px-3 small mt-1 mb-2 text-center fw-medium" style={{ fontSize: '0.82rem' }}>
                    <i className="bi bi-info-circle-fill me-1.5 text-primary"></i>
                    <span>Scan with GCash or click Proceed to GCash below.</span>
                  </div>

                  <div className="text-muted small mt-2 d-flex flex-column gap-1 text-start px-2" style={{ fontSize: '0.74rem' }}>
                    <div><strong>Step 1:</strong> Open your GCash, Maya, or banking app.</div>
                    <div><strong>Step 2:</strong> Tap <em>Scan QR</em> to scan the dynamic code.</div>
                    <div><strong>Step 3:</strong> Confirm the pre-set payment of ₱{parsedAmount.toFixed(2)}.</div>
                  </div>
                </div>
              ) : qrphError ? (
                <div className="alert alert-warning py-2 small mb-0">
                  {qrphError}
                  {canGenerateQr && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary text-white fw-bold d-block mx-auto mt-2"
                      onClick={fetchQrphCode}
                    >
                      Retry Generating QR
                    </button>
                  )}
                </div>
              ) : (
                <div className="py-2 text-center text-muted small">
                  {isCheckedInWithoutBill ? (
                    <div>Payment is locked until front desk finalizes your checkout billing.</div>
                  ) : (
                    <div className="py-2">
                      <Button
                        type="button"
                        variant="primary"
                        className="btn-primary text-white fw-bold shadow-sm px-4 py-2"
                        style={{ backgroundColor: '#005ce6', borderColor: '#005ce6', borderRadius: '8px' }}
                        onClick={fetchQrphCode}
                      >
                        <i className="bi bi-qr-code-scan me-2"></i>
                        <span>Generate QRPh Code</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* MODAL FOOTER */}
          <div className="modal-footer bg-light px-4 py-3 border-top d-flex flex-column gap-2">
            <button
              type="button"
              className="btn btn-primary w-100 py-2 fw-bold shadow-sm text-white"
              style={{ backgroundColor: '#005ce6', borderColor: '#005ce6', borderRadius: '8px' }}
              disabled={redirectingCheckout}
              onClick={handleProceedToGCashCheckout}
            >
              {redirectingCheckout ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  <span>Connecting to GCash...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-wallet2 me-2"></i>
                  <span>Proceed to GCash</span>
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-danger text-white fw-bold w-100 py-2 shadow-sm mt-2"
              onClick={onClose}
              disabled={redirectingCheckout}
              style={{ borderRadius: '8px' }}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
