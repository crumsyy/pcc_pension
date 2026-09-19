'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export function generateReceiptPNG(receipt) {
  if (!receipt || typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  const dpr = 2;
  const width = 360;
  const height = 520;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(8, 8, width - 16, height - 16);

  // Header Banner
  ctx.fillStyle = '#005ce6';
  ctx.fillRect(8, 8, width - 16, 42);

  // Header text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PCC HOME SUITE HOME', width / 2, 34);

  // Subtitle
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11.5px sans-serif';
  ctx.fillText('OFFICIAL GCASH ONLINE RECEIPT', width / 2, 70);

  ctx.fillStyle = '#64748b';
  ctx.font = '9.5px sans-serif';
  ctx.fillText('PayMongo Sandbox Test Mode', width / 2, 85);

  // Dashed line
  ctx.strokeStyle = '#cbd5e1';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(24, 98);
  ctx.lineTo(width - 24, 98);
  ctx.stroke();
  ctx.setLineDash([]);

  // Info items
  const items = [
    ['Receipt No:', receipt.receiptNumber || `REC-${receipt.paymentID || 'N/A'}`],
    ['Date & Time:', new Date(receipt.timestamp || Date.now()).toLocaleString()],
    ['Booking Ref:', `#${receipt.bookingID}`],
    ['Guest Name:', receipt.guestName || 'Guest'],
    ['Room Number:', receipt.roomNumber ? `Room ${receipt.roomNumber}` : 'N/A'],
    ['Payment Method:', receipt.paymentMethod || 'GCash Online'],
    ['Reference No:', receipt.referenceNumber || 'N/A'],
  ];

  let currentY = 120;
  items.forEach(([label, value]) => {
    ctx.fillStyle = '#64748b';
    ctx.font = '10.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, 26, currentY);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10.5px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(value), width - 26, currentY);

    currentY += 20;
  });

  // Divider
  ctx.strokeStyle = '#cbd5e1';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(24, currentY + 6);
  ctx.lineTo(width - 24, currentY + 6);
  ctx.stroke();
  ctx.setLineDash([]);

  currentY += 28;

  // Amount Paid Row
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL AMOUNT PAID:', 26, currentY);

  ctx.fillStyle = '#16a34a';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`₱${parseFloat(receipt.amountPaid || 0).toFixed(2)}`, width - 26, currentY);

  currentY += 24;

  // Remaining Balance Row
  ctx.fillStyle = '#64748b';
  ctx.font = '10.5px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Remaining Balance:', 26, currentY);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`₱${parseFloat(receipt.remainingBalance || 0).toFixed(2)}`, width - 26, currentY);

  currentY += 28;

  // Status Stamp Box
  ctx.fillStyle = '#ecfdf5';
  ctx.fillRect(26, currentY, width - 52, 30);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1;
  ctx.strokeRect(26, currentY, width - 52, 30);

  ctx.fillStyle = '#047857';
  ctx.font = 'bold 11.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✓ PAYMENT COMPLETED & SETTLED', width / 2, currentY + 19);

  currentY += 52;

  // Footer Note
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Thank you for staying with PCC Home Suite Home!', width / 2, currentY);
  ctx.fillText('Osmeña Street, Zone 1, Koronadal City, South Cotabato', width / 2, currentY + 14);

  // Download
  const image = canvas.toDataURL('image/png');
  const downloadLink = document.createElement('a');
  downloadLink.href = image;
  downloadLink.download = `Receipt_Booking_${receipt.bookingID || 'PCC'}.png`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

function PayMongoTestContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const bookingID = searchParams.get('bookingID');
  const paramAmount = searchParams.get('amount');

  const [loadingBooking, setLoadingBooking] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [actionStatus, setActionStatus] = useState(null); // 'completed' | 'declined'
  const [statusMessage, setStatusMessage] = useState('');
  const [receiptData, setReceiptData] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  useEffect(() => {
    if (bookingID) {
      setLoadingBooking(true);
      fetch(`/api/billing?bookingID=${bookingID}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setBookingDetails(data);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingBooking(false));
    }
  }, [bookingID]);

  const displayAmount = paramAmount 
    ? parseFloat(paramAmount) 
    : parseFloat(bookingDetails?.balancing?.remainingBalance ?? bookingDetails?.remainingBalance ?? bookingDetails?.balance ?? 500);

  const handleAuthorize = async () => {
    if (!bookingID) {
      alert('Missing Booking ID for payment authorization.');
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch('/api/guest/payments/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingID: parseInt(bookingID, 10),
          amount: displayAmount,
          referenceNumber: `PM-AUTH-${Math.floor(100000 + Math.random() * 900000)}`
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authorization failed.');
      }

      setActionStatus('completed');
      setStatusMessage('Payment Completed');
      setReceiptData(data.receipt);

      // Smooth auto redirect back to PCC payment page after short preview
      setTimeout(() => {
        router.push(`/guest/dashboard?paymentStatus=completed&bookingID=${bookingID}`);
      }, 2500);
    } catch (err) {
      alert(err.message || 'Error authorizing payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleFail = async () => {
    if (!bookingID) {
      alert('Missing Booking ID for payment failure simulation.');
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch('/api/guest/payments/fail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingID: parseInt(bookingID, 10)
        })
      });
      const data = await res.json();
      setActionStatus('declined');
      setStatusMessage(data.message || 'Payment Declined, Try Again');

      // Redirect back to PCC payment page with status Payment Declined, Try Again
      setTimeout(() => {
        router.push(`/guest/dashboard?paymentStatus=declined&bookingID=${bookingID}`);
      }, 1500);
    } catch (err) {
      // Still redirect with declined status on network error
      router.push(`/guest/dashboard?paymentStatus=declined&bookingID=${bookingID}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-vh-100 bg-light py-5 d-flex align-items-center justify-content-center">
      <div className="container" style={{ maxWidth: '560px' }}>
        {/* Brand Card */}
        <div className="card shadow-lg border-0 rounded-4 overflow-hidden bg-white">
          {/* PayMongo Top Header */}
          <div className="p-4 text-white text-center" style={{ backgroundColor: '#005ce6' }}>
            <div className="d-inline-flex align-items-center gap-2 px-3 py-1 bg-white bg-opacity-25 rounded-pill mb-2">
              <span className="badge bg-warning text-dark fw-bold" style={{ fontSize: '0.68rem' }}>SANDBOX</span>
              <span className="small fw-semibold" style={{ fontSize: '0.80rem' }}>PayMongo Payment Gateway Test Mode</span>
            </div>
            <h4 className="fw-bold mb-0">GCash Payment Simulator</h4>
            <small className="opacity-75">Simulate test authorization or failure without real charges</small>
          </div>

          <div className="card-body p-4">
            {/* Booking Payment Overview */}
            <div className="bg-light p-3 rounded-3 border mb-4">
              <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                <span className="text-muted small">Merchant:</span>
                <span className="fw-bold text-dark">PCC Home Suite Home</span>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                <span className="text-muted small">Booking Reference:</span>
                <span className="badge bg-primary text-white px-2.5 py-1">
                  {bookingID ? `#${bookingID}` : 'N/A'}
                </span>
              </div>
              {bookingDetails?.booking?.roomNumber && (
                <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                  <span className="text-muted small">Room:</span>
                  <span className="fw-semibold text-dark">
                    Room {bookingDetails.booking.roomNumber} ({bookingDetails.booking.roomType})
                  </span>
                </div>
              )}
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="fw-bold text-dark">Amount to Pay:</span>
                  <div className="text-muted small" style={{ fontSize: '0.72rem' }}>GCash Test Transaction</div>
                </div>
                <div className="fs-4 fw-bold text-primary">
                  ₱{displayAmount.toFixed(2)}
                </div>
              </div>
            </div>

            {/* ACTION STATUS MESSAGES */}
            {actionStatus === 'completed' && (
              <div className="alert alert-success p-3 rounded-3 mb-4 text-center">
                <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                  <i className="bi bi-check-circle-fill text-success fs-4"></i>
                  <h5 className="fw-bold mb-0 text-success">Payment Completed</h5>
                </div>
                <p className="small mb-3 text-dark">
                  Your GCash payment simulation was authorized and settled successfully. Returning you to the PCC payment page...
                </p>
                <div className="d-flex flex-wrap gap-2 justify-content-center">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm fw-bold px-3 py-1.5"
                    onClick={() => setShowReceiptModal(true)}
                  >
                    <i className="bi bi-eye me-1.5"></i>View Receipt
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-sm fw-bold px-3 py-1.5 text-white"
                    onClick={() => generateReceiptPNG(receiptData)}
                  >
                    <i className="bi bi-download me-1.5"></i>Download Receipt (PNG)
                  </button>
                  <Link
                    href={`/guest/dashboard?paymentStatus=completed&bookingID=${bookingID}`}
                    className="btn btn-primary btn-sm fw-bold px-3 py-1.5"
                  >
                    Return Now
                  </Link>
                </div>
              </div>
            )}

            {actionStatus === 'declined' && (
              <div className="alert alert-danger p-3 rounded-3 mb-4 text-center">
                <div className="d-flex align-items-center justify-content-center gap-2 mb-1">
                  <i className="bi bi-x-circle-fill text-danger fs-4"></i>
                  <h5 className="fw-bold mb-0 text-danger">{statusMessage}</h5>
                </div>
                <p className="small mb-2 text-dark">
                  The payment authorization was declined in simulation mode. Redirecting back to PCC payment page to try again...
                </p>
                <Link
                  href={`/guest/dashboard?paymentStatus=declined&bookingID=${bookingID}`}
                  className="btn btn-danger btn-sm fw-bold px-3 py-1.5"
                >
                  Return to PCC Payment Page
                </Link>
              </div>
            )}

            {/* SIMULATION BUTTONS */}
            {!actionStatus && (
              <div className="d-flex flex-column gap-3">
                <div className="text-center text-muted small mb-1">
                  Select a simulation action below to test payment authorization:
                </div>

                {/* Authorize Payment Button */}
                <button
                  type="button"
                  id="paymongo-authorize-btn"
                  className="btn btn-success btn-lg w-100 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 py-3 text-white"
                  style={{ borderRadius: '10px' }}
                  disabled={processing}
                  onClick={handleAuthorize}
                >
                  {processing ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Processing Authorization...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle-fill fs-5"></i>
                      <span>Authorize Payment</span>
                    </>
                  )}
                </button>

                {/* Fail Payment Button */}
                <button
                  type="button"
                  id="paymongo-fail-btn"
                  className="btn btn-danger btn-lg w-100 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 py-3 text-white"
                  style={{ borderRadius: '10px' }}
                  disabled={processing}
                  onClick={handleFail}
                >
                  {processing ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Declining Payment...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-x-circle-fill fs-5"></i>
                      <span>Fail Payment</span>
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="mt-4 pt-3 border-top text-center text-muted" style={{ fontSize: '0.75rem' }}>
              <i className="bi bi-shield-lock me-1"></i>
              Simulated PayMongo sandbox gateway for PCC Pension House reservation &amp; stay settlements.
            </div>
          </div>
        </div>

        {/* Cancel / Back Link */}
        <div className="text-center mt-3">
          <Link href="/guest/dashboard" className="text-muted text-decoration-none small">
            <i className="bi bi-arrow-left me-1"></i>Back to Guest Portal
          </Link>
        </div>
      </div>

      {/* VIEW RECEIPT MODAL */}
      {showReceiptModal && receiptData && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1080 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '14px' }}>
              <div className="modal-header text-white" style={{ backgroundColor: '#005ce6' }}>
                <h5 className="modal-title fw-bold mb-0">Official Online Receipt</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowReceiptModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="text-center mb-3">
                  <h6 className="fw-bold text-dark mb-0">PCC HOME SUITE HOME</h6>
                  <small className="text-muted">Osmeña Street, Koronadal City, South Cotabato</small>
                </div>

                <div className="p-3 bg-light rounded-3 border mb-3" style={{ fontSize: '0.85rem' }}>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Receipt No:</span>
                    <span className="fw-bold text-dark">{receiptData.receiptNumber}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Booking Reference:</span>
                    <span className="fw-bold text-dark">#{receiptData.bookingID}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Guest Name:</span>
                    <span className="fw-bold text-dark">{receiptData.guestName}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Payment Method:</span>
                    <span className="fw-bold text-dark">{receiptData.paymentMethod}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Reference No:</span>
                    <span className="font-monospace text-primary fw-bold">{receiptData.referenceNumber}</span>
                  </div>
                  <div className="d-flex justify-content-between pt-2 border-top text-success fw-bold fs-6">
                    <span>Amount Paid:</span>
                    <span>₱{parseFloat(receiptData.amountPaid || 0).toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between text-muted small">
                    <span>Remaining Balance:</span>
                    <span>₱0.00</span>
                  </div>
                </div>

                <div className="d-flex gap-2 justify-content-end">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowReceiptModal(false)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-sm text-white fw-bold d-inline-flex align-items-center gap-1.5"
                    onClick={() => generateReceiptPNG(receiptData)}
                  >
                    <i className="bi bi-download"></i>
                    <span>Download Receipt (PNG)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PayMongoTestPage() {
  return (
    <Suspense fallback={
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    }>
      <PayMongoTestContent />
    </Suspense>
  );
}
