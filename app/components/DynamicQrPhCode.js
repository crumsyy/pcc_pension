'use client';

import React, { useState, useEffect } from 'react';

/**
 * Official PayMongo QRPh Component
 * - Uses ONLY the actual QRPh image URL generated and returned by PayMongo's servers.
 * - Zero custom payload generators or external QR encoding APIs.
 * - Receptionist Panel (showProceedBtn=false): Displays centered PayMongo QR, Amount, Status (Pending), and Check Status button.
 * - Guest Panel (showProceedBtn=true): Displays Option 1 (PayMongo QRPh) + Option 2 (Proceed to GCash direct checkout).
 */
export default function DynamicQrPhCode({
  amount = 0,
  refNumber = "",
  paymentStatus = "Pending",
  showProceedBtn = true, // Set to false on Receptionist Panel!
  onProceedToGCash = null,
  isRedirecting = false,
  showCheckStatusBtn = false,
  onCheckStatus = null,
  showTestPayBtn = true,
  onSimulateTestPay = null
}) {
  const parsedAmount = parseFloat(amount) || 0;
  const cleanRef = refNumber || `PCC-${Math.floor(100000 + Math.random() * 900000)}`;

  const [paymongoQrUrl, setPaymongoQrUrl] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrError, setQrError] = useState(null);

  // Fetch official PayMongo QRPh image directly from PayMongo API via backend
  useEffect(() => {
    let isMounted = true;
    if (parsedAmount > 0) {
      setLoadingQr(true);
      setQrError(null);
      fetch('/api/payments/paymongo-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsedAmount, description: `Downpayment Ref #${cleanRef}` })
      })
        .then(res => res.json())
        .then(data => {
          if (!isMounted) return;
          if (data.success && data.paymongoQrUrl) {
            setPaymongoQrUrl(data.paymongoQrUrl);
          } else {
            setQrError(data.error || 'Unable to retrieve PayMongo QRPh code.');
          }
        })
        .catch(err => {
          if (isMounted) setQrError('Connection error loading PayMongo QRPh.');
        })
        .finally(() => {
          if (isMounted) setLoadingQr(false);
        });
    }
    return () => { isMounted = false; };
  }, [parsedAmount, cleanRef]);

  return (
    <div className="card border-0 shadow-sm p-3 bg-white rounded-3 mx-auto my-2 text-center w-100" style={{ maxWidth: '380px' }}>
      {/* PayMongo Official Header Badge */}
      <div className="d-flex align-items-center justify-content-center gap-2 mb-2 w-100 py-1.5 px-3 rounded-2 text-white shadow-xs" style={{ backgroundColor: '#005CE6', fontWeight: 600, fontSize: '0.88rem' }}>
        <span className="badge bg-warning text-dark fw-bold" style={{ fontSize: '0.65rem', padding: '3px 6px' }}>TEST MODE</span>
        <span className="badge bg-danger text-white fw-bold" style={{ fontSize: '0.65rem', padding: '3px 6px' }}>QR Ph</span>
        <span>PayMongo QRPh Test Payment</span>
      </div>

      {/* Option 1: Centered PayMongo QR Code Frame */}
      <div className="d-flex flex-column align-items-center justify-content-center my-2">
        <div 
          className="p-2.5 bg-white rounded-3 border shadow-xs d-flex align-items-center justify-content-center position-relative overflow-hidden" 
          style={{ border: '2.5px solid #005CE6', width: '234px', height: '234px', maxWidth: '100%' }}
        >
          {loadingQr ? (
            <div className="d-flex flex-column align-items-center justify-content-center">
              <span className="spinner-border spinner-border-sm text-primary mb-2" role="status"></span>
              <small className="text-muted fw-semibold" style={{ fontSize: '0.74rem' }}>Requesting PayMongo QRPh...</small>
            </div>
          ) : qrError ? (
            <div className="p-2 text-danger small">
              <i className="bi bi-exclamation-triangle-fill d-block fs-5 mb-1"></i>
              {qrError}
            </div>
          ) : paymongoQrUrl ? (
            <img
              src={paymongoQrUrl}
              alt="Official PayMongo QRPh Code"
              width={210}
              height={210}
              className="img-fluid rounded"
              style={{ display: 'block', objectFit: 'contain', maxWidth: '100%', height: 'auto' }}
            />
          ) : (
            <div className="text-muted small">PayMongo QR unavailable</div>
          )}
        </div>
        <small className="text-muted fw-semibold mt-2" style={{ fontSize: '0.76rem' }}>
          {showProceedBtn ? 'Option 1: Scan this QR code using your payment app' : 'Scan this PayMongo QRPh code using GCash, Maya, or any bank app'}
        </small>
      </div>

      {/* Option 2: Proceed to GCash Button (GUEST PANEL ONLY!) */}
      {showProceedBtn && (
        <div className="my-2 w-100">
          <div className="d-flex align-items-center justify-content-center gap-2 text-muted small mb-1" style={{ fontSize: '0.72rem' }}>
            <hr className="flex-grow-1 my-0" />
            <span className="fw-bold text-uppercase">OR</span>
            <hr className="flex-grow-1 my-0" />
          </div>

          <button
            type="button"
            className="btn btn-primary w-100 fw-bold py-2.5 d-flex align-items-center justify-content-center gap-2 shadow-sm"
            style={{ backgroundColor: '#005CE6', borderColor: '#005CE6', borderRadius: '8px', fontSize: '0.9rem' }}
            disabled={isRedirecting}
            onClick={() => {
              if (onProceedToGCash) {
                onProceedToGCash();
              }
            }}
          >
            {isRedirecting ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                <span>Connecting to PayMongo... Redirecting to GCash...</span>
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-up-right fs-6"></i>
                <span>Option 2: Proceed to GCash (₱{parsedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Payment Details Summary */}
      <div className="w-100 text-start bg-light p-2.5 rounded-2 border mt-2" style={{ fontSize: '0.78rem' }}>
        <div className="d-flex justify-content-between mb-1">
          <span className="text-muted">Amount to Pay:</span>
          <span className="fw-bold text-success" style={{ fontSize: '0.92rem' }}>
            ₱{parsedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="d-flex justify-content-between mb-1">
          <span className="text-muted">Payment Status:</span>
          <span className={`badge ${paymentStatus === 'Paid' || paymentStatus === 'Completed' || paymentStatus === 'Settled' ? 'bg-success text-white' : 'bg-warning text-dark'}`} style={{ fontSize: '0.72rem' }}>
            {paymentStatus}
          </span>
        </div>
        <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.72rem' }}>
          <span>Transaction Ref:</span>
          <span className="font-monospace text-dark">{cleanRef}</span>
        </div>
      </div>

      {/* Test Pay Simulation Button (PayMongo Test Mode) */}
      {showTestPayBtn && (
        <button
          type="button"
          className="btn btn-warning btn-sm w-100 fw-bold mt-2 text-dark shadow-xs d-flex align-items-center justify-content-center gap-1"
          style={{ fontSize: '0.82rem', borderRadius: '6px' }}
          onClick={async () => {
            const simRef = `TEST-${Date.now().toString().slice(-8)}`;
            if (onSimulateTestPay) {
              onSimulateTestPay(simRef);
            } else {
              try {
                const res = await fetch('/api/payments/paymongo-qr', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'simulate_test_pay', amount: parsedAmount, refNumber: simRef })
                });
                const d = await res.json();
                if (d.success && onCheckStatus) {
                  onCheckStatus();
                }
              } catch (e) {
                console.error(e);
              }
            }
          }}
        >
          <i className="bi bi-play-circle-fill me-1"></i> Test Pay (Simulate Payment)
        </button>
      )}

      {/* Receptionist Check Payment Status Button */}
      {showCheckStatusBtn && onCheckStatus && (
        <button
          type="button"
          className="btn btn-outline-primary btn-sm w-100 fw-bold mt-2"
          style={{ fontSize: '0.78rem' }}
          onClick={onCheckStatus}
        >
          <i className="bi bi-arrow-clockwise me-1"></i> Check Payment Status
        </button>
      )}
    </div>
  );
}
