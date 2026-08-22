'use client';

import React, { useState, useEffect } from 'react';

/**
 * Dynamic QR Ph / PayMongo QR Code Component
 * - Displays official PayMongo QR Ph code (fetched via PayMongo API).
 * - On Receptionist Panel (showProceedBtn=false): Hides "Proceed to GCash" button. Displays centered QR code, Amount to Pay, Payment Status (Pending), and Check Payment Status button.
 * - On Guest Panel (showProceedBtn=true): Shows both Option A (Scan QR) and Option B ("Proceed to GCash" direct PayMongo checkout button).
 */
export default function DynamicQrPhCode({
  amount = 0,
  merchantName = "JOHN LLOYD CASPILLO",
  accountNumber = "0948-825-1444",
  refNumber = "",
  size = 210,
  paymentStatus = "Pending",
  showProceedBtn = true, // Set to false on Receptionist Panel!
  onProceedToGCash = null,
  isRedirecting = false,
  showCheckStatusBtn = false,
  onCheckStatus = null
}) {
  const parsedAmount = parseFloat(amount) || 0;
  const cleanRef = refNumber || `PCC-${Math.floor(100000 + Math.random() * 900000)}`;

  const [paymongoQrUrl, setPaymongoQrUrl] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);

  // Fetch official PayMongo QR Ph image dynamically when amount changes
  useEffect(() => {
    let isMounted = true;
    if (parsedAmount > 0) {
      setLoadingQr(true);
      fetch('/api/payments/paymongo-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsedAmount, refNumber: cleanRef })
      })
        .then(res => res.json())
        .then(data => {
          if (isMounted && data.success && data.paymongoQrUrl) {
            setPaymongoQrUrl(data.paymongoQrUrl);
          }
        })
        .catch(err => {
          console.log("PayMongo QR fetch notice:", err.message);
        })
        .finally(() => {
          if (isMounted) setLoadingQr(false);
        });
    }
    return () => { isMounted = false; };
  }, [parsedAmount, cleanRef]);

  // EMVCo / QR Ph Dynamic payload format fallback
  const cleanPhone = accountNumber.replace(/[^0-9]/g, '');
  const qrPayload = `00020101021226580009ph.qrph0111${cleanPhone}52045999530360854${parsedAmount > 0 ? String(parsedAmount.toFixed(2)).length.toString().padStart(2, '0') + parsedAmount.toFixed(2) : ''}5802PH5918${merchantName.slice(0, 18)}6009Koronadal62200516${cleanRef}6304`;
  const fallbackQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&data=${encodeURIComponent(qrPayload)}`;

  const displayQrUrl = paymongoQrUrl || fallbackQrUrl;

  return (
    <div className="card border-0 shadow-sm p-3 bg-white rounded-3 mx-auto my-2 text-center w-100" style={{ maxWidth: '380px' }}>
      {/* Official PayMongo / QR Ph Header */}
      <div className="d-flex align-items-center justify-content-center gap-2 mb-2 w-100 py-1.5 px-3 rounded-2 text-white shadow-xs" style={{ backgroundColor: '#005CE6', fontWeight: 600, fontSize: '0.88rem' }}>
        <span className="badge bg-danger text-white fw-bold" style={{ fontSize: '0.65rem', padding: '3px 6px' }}>QR Ph</span>
        <span>{paymongoQrUrl ? 'PayMongo QR Ph Payment' : 'GCash QR Ph Payment'}</span>
      </div>

      {/* Centered QR Code Frame */}
      <div className="d-flex flex-column align-items-center justify-content-center my-2">
        <div 
          className="p-2.5 bg-white rounded-3 border shadow-xs d-flex align-items-center justify-content-center position-relative" 
          style={{ border: '2.5px solid #005CE6', width: `${size + 24}px`, height: `${size + 24}px`, maxWidth: '100%' }}
        >
          {loadingQr ? (
            <div className="d-flex flex-column align-items-center justify-content-center">
              <span className="spinner-border spinner-border-sm text-primary mb-1" role="status"></span>
              <small className="text-muted" style={{ fontSize: '0.7rem' }}>Generating PayMongo QR...</small>
            </div>
          ) : (
            <img
              src={displayQrUrl}
              alt="PayMongo QR Ph Code"
              width={size}
              height={size}
              className="img-fluid rounded"
              style={{ display: 'block', objectFit: 'contain', maxWidth: '100%', height: 'auto' }}
            />
          )}
        </div>
        <small className="text-muted fw-semibold mt-2" style={{ fontSize: '0.76rem' }}>
          {showProceedBtn ? 'Option A: Scan this QR code using your GCash app' : 'Scan this QR code using GCash / Maya app'}
        </small>
      </div>

      {/* Option B: Proceed to GCash Button (GUEST PANEL ONLY!) */}
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
              } else {
                const infoText = `Account: ${accountNumber} | Name: ${merchantName} | Amount: ₱${parsedAmount.toFixed(2)}`;
                if (navigator.clipboard) navigator.clipboard.writeText(infoText);
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                if (isMobile) {
                  window.location.href = `intent://qrph?payload=${encodeURIComponent(qrPayload)}#Intent;scheme=gcash;package=com.gcash;end`;
                  setTimeout(() => { window.location.href = 'gcash://'; }, 600);
                } else {
                  alert(`Payment details copied to clipboard!\nAccount: ${accountNumber} (${merchantName})\nAmount: ₱${parsedAmount.toFixed(2)}\n\nPlease open your GCash app to complete payment.`);
                }
              }
            }}
          >
            {isRedirecting ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                <span>Redirecting to GCash...</span>
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-up-right fs-6"></i>
                <span>Proceed to GCash (₱{parsedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Payment Details Summary */}
      <div className="w-100 text-start bg-light p-2.5 rounded-2 border mt-2" style={{ fontSize: '0.78rem' }}>
        <div className="d-flex justify-content-between mb-1">
          <span className="text-muted">Account Name:</span>
          <span className="fw-bold text-dark">{merchantName}</span>
        </div>
        <div className="d-flex justify-content-between mb-1">
          <span className="text-muted">GCash Number:</span>
          <span className="fw-bold text-primary">{accountNumber}</span>
        </div>
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
          <span>QR Ref ID:</span>
          <span className="font-monospace text-dark">{cleanRef}</span>
        </div>
      </div>

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
