'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function QrPaymentContent() {
  const searchParams = useSearchParams();
  const bookingIdParam = searchParams.get('bookingId') || searchParams.get('bookingID');
  const amountParam = searchParams.get('amount');
  const refParam = searchParams.get('ref') || searchParams.get('refNumber');
  const roomNumberParam = searchParams.get('roomNumber');
  const roomTypeParam = searchParams.get('roomType');
  const guestNameParam = searchParams.get('guestName');

  const [booking, setBooking] = useState(null);
  const [paymentIntentID, setPaymentIntentID] = useState(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [paymongoQrUrl, setPaymongoQrUrl] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrError, setQrError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('Pending');
  const [statusMessage, setStatusMessage] = useState('');

  // Fetch booking details or initialize virtual walk-in session
  useEffect(() => {
    if (bookingIdParam) {
      const fetchBookingDetails = async () => {
        try {
          setLoadingBooking(true);
          const res = await fetch('/api/receptionist/bookings');
          const data = await res.json();
          if (res.ok && data.bookings) {
            const found = data.bookings.find(b => String(b.bookingID) === String(bookingIdParam));
            if (found) {
              setBooking(found);
              setPaymentStatus(found.status);
            }
          }
        } catch (err) {
          console.error('Failed to load booking details:', err);
        } finally {
          setLoadingBooking(false);
        }
      };

      fetchBookingDetails();
    } else if (amountParam && parseFloat(amountParam) > 0) {
      // Virtual walk-in or new booking session before DB save
      const names = (guestNameParam || 'Guest Walk-in').trim().split(' ');
      const fName = names[0] || 'Guest';
      const lName = names.slice(1).join(' ') || (names.length === 1 ? 'Walk-in' : '');
      const parsedAmt = parseFloat(amountParam) || 0;
      setBooking({
        bookingID: refParam || `NEW-${Date.now().toString().slice(-6)}`,
        firstName: fName,
        lastName: lName,
        roomNumber: roomNumberParam || 'TBD',
        roomType: roomTypeParam || 'Standard Room',
        remainingBalance: parsedAmt,
        finalBalance: parsedAmt,
        status: 'Pending Downpayment',
        isWalkIn: true
      });
      setPaymentStatus('Pending Downpayment');
      setLoadingBooking(false);
    } else {
      setLoadingBooking(false);
    }
  }, [bookingIdParam, amountParam, refParam, roomNumberParam, roomTypeParam, guestNameParam]);

  // Request PayMongo QR
  useEffect(() => {
    if (!booking) return;

    const amt = parseFloat(booking.remainingBalance || booking.finalBalance || 0);
    if (amt > 0) {
      setLoadingQr(true);
      setQrError('');
      fetch('/api/payments/paymongo-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          description: `Guest Payment Room ${booking.roomNumber} (Booking #${booking.bookingID})`
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.paymongoQrUrl) {
            setPaymongoQrUrl(data.paymongoQrUrl);
            if (data.paymentIntentID) {
              setPaymentIntentID(data.paymentIntentID);
            }
          } else {
            setQrError(data.error || 'Live PayMongo QR code unavailable.');
          }
        })
        .catch(() => {
          setQrError('Network connection issue loading QR code.');
        })
        .finally(() => {
          setLoadingQr(false);
        });
    }
  }, [booking]);

  const broadcastPaymentSettled = (bookingID, ref, amount) => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('pcc_payment_sync');
        channel.postMessage({
          type: 'PAYMENT_SETTLED',
          bookingID: String(bookingID),
          referenceNumber: ref,
          amount: parseFloat(amount) || 0,
          status: 'Payment Completed',
          timestamp: Date.now()
        });
        setTimeout(() => {
          try { channel.close(); } catch (e) {}
        }, 1000);
      }
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('pcc_payment_sync_event', JSON.stringify({
          type: 'PAYMENT_SETTLED',
          bookingID: String(bookingID),
          referenceNumber: ref,
          amount: parseFloat(amount) || 0,
          status: 'Payment Completed',
          timestamp: Date.now()
        }));
      }
    } catch (e) {
      console.warn('localStorage sync error:', e);
    }
  };

  // Automated polling for PayMongo status on secondary QR payment terminal
  useEffect(() => {
    if (!paymentIntentID || paymentStatus === 'Payment Completed' || paymentStatus === 'Completed' || paymentStatus === 'Paid') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/paymongo-qr?paymentIntentID=${paymentIntentID}`);
        if (res.ok) {
          const data = await res.json();
          if (data.isPaid || data.status === 'succeeded' || data.status === 'authorized' || data.status === 'paid' || data.status === 'settled') {
            clearInterval(interval);
            const ref = `PM-${paymentIntentID.slice(-8)}`;
            setPaymentStatus('Payment Completed');
            setStatusMessage('Payment verified and authorized successfully via QRPh! Booking status updated.');
            broadcastPaymentSettled(booking?.bookingID, ref, booking?.remainingBalance || booking?.finalBalance || 0);
          }
        }
      } catch (e) {
        // silent polling catch
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [paymentIntentID, paymentStatus, booking]);

  const handleAuthenticate = async () => {
    if (!booking) return;
    setProcessing(true);
    setStatusMessage('');
    try {
      const ref = `PM-AUTH-${Date.now().toString().slice(-8)}`;
      if (booking.isWalkIn) {
        setPaymentStatus('Payment Completed');
        setStatusMessage('Payment verified and settled successfully! Return to New Lodging Booking to complete submission.');
        broadcastPaymentSettled(booking.bookingID, ref, booking.remainingBalance || booking.finalBalance || 0);
        return;
      }
      const res = await fetch('/api/guest/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_authenticate',
          bookingID: booking.bookingID,
          amountToPay: parseFloat(booking.remainingBalance || booking.finalBalance || 0),
          referenceNumber: ref
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to authenticate payment.');
      }
      setPaymentStatus('Payment Completed');
      setStatusMessage('Payment verified and settled successfully! Status updated to Payment Completed.');
      broadcastPaymentSettled(booking.bookingID, ref, booking.remainingBalance || booking.finalBalance || 0);
    } catch (err) {
      setStatusMessage(`Authentication Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handlePaymentFailed = async () => {
    if (!booking) return;
    setProcessing(true);
    setStatusMessage('');
    try {
      if (booking.isWalkIn) {
        setPaymentStatus('Payment Declined');
        setStatusMessage('Payment authorization was declined in test mode.');
        return;
      }
      const res = await fetch('/api/guest/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_failed',
          bookingID: booking.bookingID
        })
      });
      const data = await res.json();
      setPaymentStatus('Payment Declined');
      setStatusMessage(data.error || 'Payment authorization was declined in test mode.');
    } catch (err) {
      setPaymentStatus('Payment Declined');
      setStatusMessage('Payment transaction declined by user.');
    } finally {
      setProcessing(false);
    }
  };

  const handleProceedToGCash = async () => {
    if (!booking) return;
    setProcessing(true);
    setStatusMessage('');
    try {
      const ref = `GCASH-TEST-${Date.now().toString().slice(-8)}`;
      if (booking.isWalkIn) {
        setPaymentStatus('Payment Completed');
        setStatusMessage('Simulated GCash authorization completed! Return to New Lodging Booking to complete submission.');
        broadcastPaymentSettled(booking.bookingID, ref, booking.remainingBalance || booking.finalBalance || 0);
        return;
      }
      const res = await fetch('/api/payments/paymongo/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingID: booking.bookingID,
          amount: parseFloat(booking.remainingBalance || booking.finalBalance || 0),
          referenceNumber: ref
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Sandbox connection error.');
      }
      setPaymentStatus('Payment Completed');
      setStatusMessage('Simulated GCash authorization completed! Booking status updated to Payment Completed.');
      broadcastPaymentSettled(booking.bookingID, ref, booking.remainingBalance || booking.finalBalance || 0);
    } catch (err) {
      setStatusMessage(`Sandbox Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loadingBooking) {
    return (
      <div className="min-vh-100 bg-light d-flex align-items-center justify-content-center p-3">
        <div className="qr-payment-container d-flex flex-column align-items-center justify-content-center">
          <div className="spinner-border text-primary mb-3" role="status"></div>
          <p className="text-muted mb-0">Loading guest payment session...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-vh-100 bg-light d-flex align-items-center justify-content-center p-3">
        <div className="qr-payment-container">
          <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
            <img src="/assets/images/logo.jpg" alt="PCC Logo" height="38" style={{ borderRadius: '6px' }} />
            <div>
              <h5 className="fw-bold mb-0 text-dark">PCC Home Suite Home</h5>
              <small className="text-muted" style={{ fontSize: '0.75rem' }}>Guest Payment Terminal</small>
            </div>
          </div>
          <i className="fa-solid fa-circle-exclamation text-warning fs-1 my-3"></i>
          <h4 className="fw-bold">No Active Stay Selected</h4>
          <p className="text-muted small mb-0">
            Please open this payment terminal from an active stay card in the Receptionist portal.
          </p>
        </div>
      </div>
    );
  }

  const amountDue = parseFloat(booking?.remainingBalance || booking?.finalBalance || 0);

  return (
    <div className="min-vh-100 bg-light d-flex flex-column align-items-center justify-content-center p-3 p-md-4">
      <div className="qr-payment-container">
        {/* Brand Header */}
        <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
          <img src="/assets/images/logo.jpg" alt="PCC Logo" height="38" style={{ borderRadius: '6px' }} />
          <div>
            <h5 className="fw-bold mb-0 text-dark">PCC Home Suite Home</h5>
            <small className="text-muted" style={{ fontSize: '0.75rem' }}>Guest Payment Terminal</small>
          </div>
        </div>

        {/* Guest & Room Details */}
        <div className="p-3 bg-light rounded-3 mb-3 text-start border">
          <div className="d-flex justify-content-between mb-1 small">
            <span className="text-muted">Guest:</span>
            <strong className="text-dark">{booking.firstName} {booking.lastName}</strong>
          </div>
          <div className="d-flex justify-content-between mb-1 small">
            <span className="text-muted">Room:</span>
            <strong className="text-dark">Room {booking.roomNumber} ({booking.roomType})</strong>
          </div>
          <div className="d-flex justify-content-between mb-1 small">
            <span className="text-muted">Stay Reference:</span>
            <span className="font-monospace text-secondary">#{booking.bookingID}</span>
          </div>
          <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
            <span className="fw-bold text-dark">Amount Due:</span>
            <span className="fw-bold fs-4 text-primary">
              ₱{amountDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Status Feedback Notice */}
        {statusMessage && (
          <div className={`alert ${paymentStatus === 'Payment Completed' ? 'alert-success' : 'alert-danger'} py-2 px-3 small mb-3 text-start`}>
            <div className="d-flex align-items-center gap-2">
              <i className={`fa-solid ${paymentStatus === 'Payment Completed' ? 'fa-circle-check text-success' : 'fa-circle-xmark text-danger'}`}></i>
              <div>{statusMessage}</div>
            </div>
          </div>
        )}

        {/* QR Section */}
        <h4 className="mb-1">Scan to Pay</h4>
        <p className="text-muted small mb-3">
          Scan this QR code with GCash, Maya, or any QRPh banking app
        </p>

        <div className="d-flex justify-content-center mb-4">
          {loadingQr ? (
            <div className="d-flex flex-column align-items-center justify-content-center p-4 border rounded bg-light" style={{ width: '240px', height: '240px' }}>
              <span className="spinner-border text-primary mb-2" role="status"></span>
              <small className="text-muted">Generating PayMongo QR...</small>
            </div>
          ) : paymongoQrUrl ? (
            <img src={paymongoQrUrl} alt="GCash QR Code" className="qr-image" />
          ) : (
            <div className="d-flex flex-column align-items-center justify-content-center p-3 border rounded bg-light" style={{ width: '240px', height: '240px' }}>
              <img src="/assets/images/logo.jpg" alt="PCC Logo" style={{ width: '80px', borderRadius: '8px', marginBottom: '8px' }} />
              <small className="text-muted px-2" style={{ fontSize: '0.75rem' }}>
                {qrError || 'PayMongo Test QR Ready'}
              </small>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="d-flex flex-column gap-3 w-100 mx-auto" style={{ maxWidth: '320px' }}>
          <button
            type="button"
            className="btn btn-success w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2"
            disabled={processing || paymentStatus === 'Payment Completed'}
            onClick={handleAuthenticate}
            aria-label="Authenticate Payment"
          >
            {processing ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status"></span>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-circle-check"></i>
                <span>Authenticate Payment</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="btn btn-danger w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2"
            disabled={processing}
            onClick={handlePaymentFailed}
            aria-label="Payment Failed"
          >
            <i className="fa-solid fa-circle-xmark"></i>
            <span>Payment Failed</span>
          </button>

          <button
            type="button"
            className="btn btn-primary w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2 text-white"
            style={{ backgroundColor: '#005ce6', borderColor: '#005ce6' }}
            disabled={processing || paymentStatus === 'Payment Completed'}
            onClick={handleProceedToGCash}
            aria-label="Proceed to GCash in Test Mode"
          >
            <i className="fa-solid fa-wallet"></i>
            <span>Proceed to GCash (Test Mode)</span>
          </button>
        </div>

        <small className="text-muted d-block mt-3" style={{ fontSize: '0.72rem' }}>
          PayMongo Test Sandbox Mode • Dual Monitor / Guest-Facing Display
        </small>
      </div>
    </div>
  );
}

export default function ReceptionistQrPaymentPage() {
  return (
    <Suspense fallback={
      <div className="qr-payment-container d-flex flex-column align-items-center justify-content-center p-4">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted mt-2">Initializing payment terminal...</p>
      </div>
    }>
      <QrPaymentContent />
    </Suspense>
  );
}
