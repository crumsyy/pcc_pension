'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ReceptionistTestPaymentPage() {
  const [activeBookings, setActiveBookings] = useState([]);
  const [selectedBookingID, setSelectedBookingID] = useState('');
  const [selectedBookingDetails, setSelectedBookingDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const generateTestRef = () => {
    return `PM-TEST-${Math.floor(100000 + Math.random() * 900000)}`;
  };

  const fetchActiveBookings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/receptionist/payments');
      const data = await res.json();
      if (res.ok && data.activeBookings) {
        setActiveBookings(data.activeBookings);
      }
    } catch (e) {
      setFeedback({ type: 'danger', message: 'Failed to load active bookings: ' + e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveBookings();
    setRefNumber(generateTestRef());
  }, []);

  const handleSelectBooking = async (bookingID) => {
    setSelectedBookingID(bookingID);
    setReceipt(null);
    setFeedback({ type: '', message: '' });

    if (!bookingID) {
      setSelectedBookingDetails(null);
      setPayAmount('');
      return;
    }

    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/billing?bookingID=${bookingID}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedBookingDetails(data);
        const remBal = parseFloat(data.balancing?.remainingBalance || data.balance || 0);
        setPayAmount(remBal > 0 ? remBal.toFixed(2) : '500.00');
        setRefNumber(generateTestRef());
      } else {
        throw new Error(data.error || 'Failed to fetch booking billing details');
      }
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleTestPayAuthorization = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFeedback({ type: 'warning', message: 'Please enter a valid authorization amount greater than 0.' });
      return;
    }

    setProcessing(true);
    setFeedback({ type: '', message: '' });

    try {
      const res = await fetch('/api/payments/paymongo/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingID: selectedBookingID ? parseInt(selectedBookingID) : null,
          billingID: selectedBookingDetails?.billingID || null,
          guestID: selectedBookingDetails?.booking?.guestID || null,
          amount: amountNum,
          referenceNumber: refNumber || generateTestRef(),
          paymentMethodID: 2, // GCash / PayMongo
          transactionType: 'Receptionist Test Payment Authorization'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Test payment authorization failed.');
      }

      setReceipt(data);
      setFeedback({
        type: 'success',
        message: `Test Pay Authorization successful! Reference #${data.referenceNumber} has been settled and logged to billing audit.`
      });

      // Refresh booking details if a booking was selected
      if (selectedBookingID) {
        const refreshRes = await fetch(`/api/billing?bookingID=${selectedBookingID}`);
        const refreshData = await refreshRes.json();
        if (refreshRes.ok && refreshData.success) {
          setSelectedBookingDetails(refreshData);
          const newBal = parseFloat(refreshData.balancing?.remainingBalance || 0);
          setPayAmount(newBal > 0 ? newBal.toFixed(2) : '0.00');
        }
      }

      fetchActiveBookings();
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container-fluid py-4 px-md-5" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* HEADER */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-warning text-dark fw-bold px-2.5 py-1">TEST MODE</span>
            <span className="badge bg-primary text-white px-2.5 py-1">PayMongo Gateway</span>
          </div>
          <h2 className="fw-bold text-pcc-blue mb-1" style={{ color: 'var(--pcc-blue)' }}>
            PayMongo Test Payment Authorization
          </h2>
          <p className="text-muted mb-0 small">
            Simulate and authorize official PayMongo test mode payments for guest billing and down payments.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link href="/receptionist/payments" className="btn btn-outline-secondary fw-semibold btn-sm shadow-xs">
            <i className="bi bi-arrow-left me-1"></i>Back to Payments
          </Link>
          <Link href="/receptionist/dashboard" className="btn btn-outline-primary fw-semibold btn-sm shadow-xs">
            Receptionist Dashboard
          </Link>
        </div>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show shadow-xs mb-4`} role="alert">
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-5`}></i>
            <div>{feedback.message}</div>
          </div>
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', message: '' })}></button>
        </div>
      )}

      <div className="row g-4">
        {/* LEFT FORM COLUMN */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-3 bg-white p-4 h-100">
            <h5 className="fw-bold text-dark border-bottom pb-2 mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-credit-card-2-front text-primary"></i>
              Payment Authorization Form
            </h5>

            <form onSubmit={handleTestPayAuthorization}>
              {/* Select Active Booking */}
              <div className="mb-3">
                <label className="form-label fw-semibold small text-muted">Select Active Guest Stay / Booking</label>
                <select
                  className="form-select fw-semibold"
                  value={selectedBookingID}
                  onChange={(e) => handleSelectBooking(e.target.value)}
                  disabled={loading}
                >
                  <option value="">-- Standalone Simulation (No Booking Linked) --</option>
                  {activeBookings.map(b => (
                    <option key={b.bookingID} value={b.bookingID}>
                      Room {b.roomNumber} • {b.lastName}, {b.firstName} (Booking #{b.bookingID})
                    </option>
                  ))}
                </select>
                <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Selecting a booking will automatically apply this payment to its stay billing account.
                </small>
              </div>

              {/* Amount to Authorize */}
              <div className="mb-3">
                <label className="form-label fw-semibold small text-muted">Payment Amount (₱) *</label>
                <div className="input-group">
                  <span className="input-group-text fw-bold bg-light">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control fw-bold fs-5 text-success"
                    placeholder="0.00"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Reference Number */}
              <div className="mb-3">
                <label className="form-label fw-semibold small text-muted">PayMongo Reference Number *</label>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control font-monospace fw-semibold"
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setRefNumber(generateTestRef())}
                    title="Generate New Reference"
                  >
                    <i className="bi bi-shuffle me-1"></i>Regenerate
                  </button>
                </div>
              </div>

              {/* Payment Gateway Option */}
              <div className="mb-4">
                <label className="form-label fw-semibold small text-muted">Gateway Simulation Mode</label>
                <div className="p-3 bg-light rounded-3 border d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2.5">
                    <div className="bg-primary text-white rounded p-2 d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                      <i className="bi bi-shield-lock-fill fs-5"></i>
                    </div>
                    <div>
                      <div className="fw-bold text-dark small">PayMongo QRPh / GCash Sandbox</div>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                        Simulates instant PayMongo webhook authorization with status <code>Settled</code>.
                      </div>
                    </div>
                  </div>
                  <span className="badge bg-success text-white">READY</span>
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                className="btn btn-primary w-100 py-2.5 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
                style={{ backgroundColor: '#005CE6', borderColor: '#005CE6', fontSize: '1rem', borderRadius: '8px' }}
                disabled={processing || loadingDetails}
              >
                {processing ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>Simulating PayMongo Authorization...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-lightning-charge-fill text-warning"></i>
                    <span>Test Pay Authorization</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT DETAILS / RECEIPT COLUMN */}
        <div className="col-lg-5">
          {receipt ? (
            /* OFFICIAL AUTHORIZED TEST RECEIPT */
            <div className="card border-0 shadow-sm rounded-3 bg-white p-4 animate__animated animate__fadeIn">
              <div className="text-center pb-3 border-bottom mb-3">
                <div className="badge bg-success-subtle text-success border border-success px-3 py-1.5 rounded-pill fw-bold mb-2">
                  <i className="bi bi-patch-check-fill me-1"></i>PAYMENT SETTLED (TEST MODE)
                </div>
                <h5 className="fw-bold text-dark mb-0">PayMongo Authorization Receipt</h5>
                <small className="text-muted">PCC Home Suite Home Pension House</small>
              </div>

              <div className="p-3 bg-light rounded-3 border mb-3" style={{ fontSize: '0.85rem' }}>
                <div className="d-flex justify-content-between mb-1.5">
                  <span className="text-muted">Authorization Code:</span>
                  <strong className="font-monospace text-primary">{receipt.authorizationCode}</strong>
                </div>
                <div className="d-flex justify-content-between mb-1.5">
                  <span className="text-muted">Transaction Ref:</span>
                  <strong className="font-monospace text-dark">{receipt.referenceNumber}</strong>
                </div>
                <div className="d-flex justify-content-between mb-1.5">
                  <span className="text-muted">Amount Authorized:</span>
                  <strong className="text-success fs-6">₱{parseFloat(receipt.amount).toFixed(2)}</strong>
                </div>
                <div className="d-flex justify-content-between mb-1.5">
                  <span className="text-muted">Payment Status:</span>
                  <span className="badge bg-success text-white">Settled</span>
                </div>
                {receipt.bookingID && (
                  <div className="d-flex justify-content-between mb-1.5">
                    <span className="text-muted">Target Booking:</span>
                    <strong className="text-dark">Booking #{receipt.bookingID}</strong>
                  </div>
                )}
                {receipt.balanceAfter !== undefined && (
                  <div className="d-flex justify-content-between pt-2 border-top">
                    <span className="text-muted">Remaining Balance:</span>
                    <strong className={receipt.balanceAfter > 0 ? 'text-danger' : 'text-success'}>
                      ₱{parseFloat(receipt.balanceAfter).toFixed(2)}
                    </strong>
                  </div>
                )}
                <div className="d-flex justify-content-between text-muted small pt-2 border-top" style={{ fontSize: '0.72rem' }}>
                  <span>Timestamp:</span>
                  <span>{receipt.timestamp}</span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline-secondary w-100 btn-sm fw-semibold"
                onClick={() => setReceipt(null)}
              >
                Authorize Another Payment
              </button>
            </div>
          ) : selectedBookingDetails ? (
            /* SELECTED BOOKING LIVE BILL SUMMARY */
            <div className="card border-0 shadow-sm rounded-3 bg-white p-4">
              <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">
                <i className="bi bi-info-circle me-1.5 text-primary"></i>
                Booking Billing Overview
              </h6>

              <div className="p-3 bg-light rounded-3 border mb-3" style={{ fontSize: '0.84rem' }}>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">Room:</span>
                  <strong>Room {selectedBookingDetails.booking?.roomNumber} ({selectedBookingDetails.booking?.roomType})</strong>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">Guest:</span>
                  <strong>{selectedBookingDetails.booking?.firstName} {selectedBookingDetails.booking?.lastName}</strong>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">Nights:</span>
                  <span>{selectedBookingDetails.nights || selectedBookingDetails.chargesBreakdown?.room?.nights || 1} Night(s)</span>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">Total Charges:</span>
                  <span className="fw-bold text-dark">
                    ₱{parseFloat(selectedBookingDetails.balancing?.subtotal || selectedBookingDetails.subtotal || 0).toFixed(2)}
                  </span>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">Total Paid / Down Payment:</span>
                  <span className="text-success fw-bold">
                    ₱{parseFloat(selectedBookingDetails.balancing?.paidTotal || selectedBookingDetails.paidTotal || 0).toFixed(2)}
                  </span>
                </div>
                <div className="d-flex justify-content-between pt-2 border-top">
                  <span className="fw-bold text-dark">Remaining Balance Due:</span>
                  <strong className="text-danger fs-6">
                    ₱{parseFloat(selectedBookingDetails.balancing?.remainingBalance || selectedBookingDetails.balance || 0).toFixed(2)}
                  </strong>
                </div>
              </div>

              <div className="p-2.5 bg-primary-subtle text-primary border border-primary-subtle rounded small" style={{ fontSize: '0.76rem' }}>
                <i className="bi bi-check-circle me-1"></i>
                Clicking <strong>Test Pay Authorization</strong> will settle the entered amount directly on this guest's billing ledger.
              </div>
            </div>
          ) : (
            /* EMPTY HELPER CARD */
            <div className="card border-0 shadow-sm rounded-3 bg-white p-4 text-center py-5">
              <div className="display-6 text-muted mb-2"><i className="bi bi-wallet2"></i></div>
              <h6 className="fw-bold text-dark mb-1">No Booking Selected</h6>
              <p className="text-muted small mb-0">
                Select an active booking on the left to review its billing summary, or proceed with a standalone test authorization.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
