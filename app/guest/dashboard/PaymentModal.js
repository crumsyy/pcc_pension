'use client';

import React, { useState, useEffect } from 'react';
import Button from '@/app/components/Button';
import LoadingButton from '@/app/components/LoadingButton';
import { normalizeBookingStatus } from '@/lib/bookingStatuses';

/**
 * PaymentModal Component for Guest Portal
 * - Supports official PayMongo dynamic QRPh code with pre-set amount
 * - Supports in-modal payment authorization simulation without homepage redirects
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
  const [authorizing, setAuthorizing] = useState(false);
  const [failing, setFailing] = useState(false);
  const [actionError, setActionError] = useState('');

  const parsedAmount = parseFloat(amount || booking?.remainingBalance || 0);
  const bookingID = booking?.bookingID;
  const isBillReady = normalizeBookingStatus(booking?.status) === 'Bill Ready';

  // Auto-fetch dynamic QRPh code when opening modal if bill is ready
  useEffect(() => {
    if (isOpen) {
      setActionError('');
      if (isBillReady && !qrphData && !loadingQrph) {
        fetchQrphCode();
      }
    }
  }, [isOpen, isBillReady]);

  if (!isOpen || !booking) return null;

  const fetchQrphCode = async () => {
    if (!isBillReady) {
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

  const handleAuthorizePayment = async () => {
    setAuthorizing(true);
    setActionError('');
    try {
      const res = await fetch('/api/guest/payments/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingID,
          amount: parsedAmount,
          referenceNumber: `PM-AUTH-${Math.floor(100000 + Math.random() * 900000)}`
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Payment authorization failed.');
      }

      // Close modal immediately and return to PCC payment page state (no redirect to homepage)
      if (onPaymentSuccess) {
        onPaymentSuccess({
          bookingID,
          amount: parsedAmount,
          receipt: data.receipt,
          status: 'Paid'
        });
      }
      onClose();
    } catch (err) {
      setActionError(err.message || 'Failed to authorize payment.');
    } finally {
      setAuthorizing(false);
    }
  };

  const handleFailPayment = async () => {
    setFailing(true);
    setActionError('');
    try {
      const res = await fetch('/api/guest/payments/fail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingID })
      });
      const data = await res.json();

      if (onPaymentFailed) {
        onPaymentFailed({
          bookingID,
          error: data.message || 'Payment Declined, Try Again',
          status: 'Payment Declined, Try Again'
        });
      }
      onClose();
    } catch (err) {
      setActionError(err.message || 'Error simulating payment failure.');
    } finally {
      setFailing(false);
    }
  };

  return (
    <div
      className="modal d-block tab-modal-backdrop"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1070 }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '520px', margin: '1rem auto' }}>
        <div className="modal-content shadow-lg border-0" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          {/* TOP HEADER */}
          <div className="modal-header text-white px-4 py-3 d-flex justify-content-between align-items-center" style={{ backgroundColor: '#0d6efd' }}>
            <div>
              <div className="d-flex align-items-center gap-2">
                <h5 className="modal-title fw-bold mb-0" style={{ fontSize: '1.05rem' }}>
                  GCash Online Payment Options
                </h5>
                <span className="badge bg-warning text-dark font-mono px-2 py-0.5" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                  <i className="bi bi-flask me-1"></i>TEST MODE
                </span>
              </div>
              <div className="small text-white text-opacity-75 mt-0.5" style={{ fontSize: '0.78rem' }}>
                Booking #{booking.bookingID} • Room {booking.roomNumber} ({booking.roomType || 'Room'})
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>

          <div className="modal-body p-4">
            {/* AMOUNT DUE BANNER */}
            <div className="p-3 mb-3 bg-light rounded-3 border text-center">
              <div className="text-muted small" style={{ fontSize: '0.78rem' }}>Amount to Settle:</div>
              <div className="fw-bold fs-3 text-primary">₱{parsedAmount.toFixed(2)}</div>
              <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                Status: <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5">{booking.status || 'Active Stay'}</span>
              </div>
            </div>

            {/* ERROR ALERT */}
            {actionError && (
              <div className="alert alert-danger py-2 px-3 small mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill text-danger fs-6"></i>
                <span>{actionError}</span>
              </div>
            )}

            {/* OFFICIAL PAYMONGO DYNAMIC QRPH CODE ONLY */}
            <div className="text-center p-3 bg-white rounded-3 border">
              {!isBillReady ? (
                <div className="py-4">
                  <div className="alert alert-warning py-2.5 px-3 small mb-2 fw-medium">
                    <i className="bi bi-exclamation-circle-fill me-1.5 text-warning-emphasis"></i>
                    <span>QRPh code can only be generated once the booking status is <strong>Bill Ready</strong>.</span>
                  </div>
                  <small className="text-muted">Please wait for the receptionist to finalize your bill.</small>
                </div>
              ) : (
                <div>
                  {loadingQrph ? (
                    <div className="py-4 text-center text-muted">
                      <span className="spinner-border spinner-border-sm text-primary me-2"></span>
                      <span>Generating PayMongo dynamic QRPh code with pre-set amount...</span>
                    </div>
                  ) : qrphError ? (
                    <div className="py-3">
                      <div className="alert alert-danger py-2 px-3 small mb-2">{qrphError}</div>
                      <Button variant="primary" className="btn-sm fw-bold" onClick={fetchQrphCode}>
                        <i className="bi bi-arrow-clockwise me-1.5"></i>Retry Generating QRPh
                      </Button>
                    </div>
                  ) : qrphData?.qrphCodeUrl ? (
                    <div>
                      <div
                        className="p-3 bg-white border rounded-3 shadow-xs d-inline-block mb-2"
                        style={{ maxWidth: '270px' }}
                      >
                        <img
                          src={qrphData.qrphCodeUrl}
                          alt="PayMongo Dynamic QRPh Code"
                          className="img-fluid rounded"
                          style={{ width: '230px', height: '230px', objectFit: 'contain' }}
                        />
                      </div>

                      {/* Exact instructions required by prompt */}
                      <div className="alert alert-info py-2 px-3 small mt-2 mb-2 text-center fw-medium" style={{ fontSize: '0.82rem' }}>
                        <i className="bi bi-info-circle-fill me-1.5 text-primary"></i>
                        <span>Scan with GCash or any QRPh-compliant app. Amount is pre-set.</span>
                      </div>

                      <div className="text-muted small mt-2 d-flex flex-column gap-1 text-start px-2" style={{ fontSize: '0.74rem' }}>
                        <div><strong>Step 1:</strong> Open your GCash, Maya, or banking app.</div>
                        <div><strong>Step 2:</strong> Tap <em>Scan QR</em> to scan the dynamic code.</div>
                        <div><strong>Step 3:</strong> Confirm the pre-set payment of ₱{parsedAmount.toFixed(2)}.</div>
                      </div>

                      {/* Sandbox simulation buttons for test mode only */}
                      <div className="mt-3 pt-3 border-top d-flex flex-column gap-2">
                        <LoadingButton
                          type="button"
                          className="btn btn-primary w-100 fw-bold py-2 shadow-sm text-white"
                          style={{ backgroundColor: '#005ce6', borderColor: '#005ce6', borderRadius: '8px' }}
                          isLoading={authorizing}
                          loadingText="Authorizing Payment..."
                          disabled={failing}
                          onClick={handleAuthorizePayment}
                        >
                          <i className="bi bi-check-circle-fill me-2"></i>
                          <span>Authorize Payment (₱{parsedAmount.toFixed(2)})</span>
                        </LoadingButton>

                        <Button
                          type="button"
                          variant="outline-danger"
                          className="w-100 btn-sm fw-semibold"
                          style={{ borderRadius: '8px' }}
                          disabled={authorizing || failing}
                          onClick={handleFailPayment}
                        >
                          {failing ? 'Simulating Decline...' : 'Fail Payment'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-3">
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
              className="btn btn-danger text-white fw-bold w-100 py-2 shadow-sm mt-2"
              onClick={onClose}
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
