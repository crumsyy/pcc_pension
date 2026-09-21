'use client';

import { useState, useEffect } from 'react';
import DateInput, { isValidDate, toDbDate, toUiDate } from '../components/DateInput';
import LoadingButton from '../components/LoadingButton';
import DynamicQrPhCode from '../components/DynamicQrPhCode';

export default function ConfirmReservationModal({
  isOpen,
  onClose,
  selectedRes,
  rooms = [],
  paymentMethods = [],
  onSubmit,
  isSubmitting = false,
  showAlert,
  showConfirm
}) {
  const [guestForm, setGuestForm] = useState({
    firstName: '',
    lastName: '',
    contact: '',
    email: '',
    dateOfBirth: ''
  });

  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [useCurrentTimeIn, setUseCurrentTimeIn] = useState(false);

  const [downPaymentOption, setDownPaymentOption] = useState('30');
  const [paymentMethodID, setPaymentMethodID] = useState('1');
  const [downPayment, setDownPayment] = useState('');
  const [isGcashSettled, setIsGcashSettled] = useState(false);
  const [gcashInlineError, setGcashInlineError] = useState('');
  const [settledPaymentRef, setSettledPaymentRef] = useState('');

  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayDbDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const currentTimeStr = `${pad(today.getHours())}:${pad(today.getMinutes())}`;

  useEffect(() => {
    if (!selectedRes || !isOpen) return;

    // Populate guest form
    setGuestForm({
      firstName: selectedRes.firstName || '',
      lastName: selectedRes.lastName || '',
      contact: selectedRes.contact || '',
      email: selectedRes.guestEmail || selectedRes.email || '',
      dateOfBirth: selectedRes.dateOfBirth ? toUiDate(selectedRes.dateOfBirth) : ''
    });

    // Populate dates
    const inDateOnly = selectedRes.reservationDateTime ? String(selectedRes.reservationDateTime).substring(0, 10) : todayDbDate;
    const inTimeOnly = selectedRes.reservationDateTime && String(selectedRes.reservationDateTime).length >= 16
      ? String(selectedRes.reservationDateTime).substring(11, 16)
      : '14:00';

    const outDateOnly = selectedRes.checkOutDateTime ? String(selectedRes.checkOutDateTime).substring(0, 10) : '';
    const outTimeOnly = selectedRes.checkOutDateTime && String(selectedRes.checkOutDateTime).length >= 16
      ? String(selectedRes.checkOutDateTime).substring(11, 16)
      : '12:00';

    setCheckInDate(toUiDate(inDateOnly));
    setCheckInTime(inTimeOnly);

    if (outDateOnly) {
      setCheckOutDate(toUiDate(outDateOnly));
      setCheckOutTime(outTimeOnly);
    } else {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setCheckOutDate(toUiDate(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`));
      setCheckOutTime('12:00');
    }

    setUseCurrentTimeIn(false);
    setDownPaymentOption('30');
    setPaymentMethodID('1');
    setDownPayment('');
    setIsGcashSettled(false);
    setGcashInlineError('');
    setSettledPaymentRef('');
  }, [selectedRes, isOpen]);

  if (!isOpen || !selectedRes) return null;

  const selectedRoom = rooms.find(r => String(r.roomID) === String(selectedRes.roomID));
  const isWithBk = (selectedRes.breakfastOption || 'with') === 'with';
  const rate = selectedRoom
    ? (isWithBk
      ? (parseFloat(selectedRoom.rateWithBreakfast) || parseFloat(selectedRoom.rate) || 0)
      : (parseFloat(selectedRoom.rateWithoutBreakfast) || parseFloat(selectedRoom.rate) || 0))
    : parseFloat(selectedRes.rate || 0);

  let nights = 1;
  if (checkInDate && checkOutDate && isValidDate(checkInDate) && isValidDate(checkOutDate)) {
    const inD = new Date(toDbDate(checkInDate) + 'T00:00:00');
    const outD = new Date(toDbDate(checkOutDate) + 'T00:00:00');
    if (outD > inD) {
      nights = Math.max(1, Math.round((outD - inD) / (1000 * 60 * 60 * 24)));
    }
  }

  const totalRoomCharge = rate * nights;
  const dpPctNum = parseInt(downPaymentOption, 10) || 30;
  const requiredDownpayment = totalRoomCharge * (dpPctNum / 100);
  const remainingBal = Math.max(0, totalRoomCharge - requiredDownpayment);
  const isCheckInToday = checkInDate && toDbDate(checkInDate) === todayDbDate;

  const handleToggleCurrentIn = (checked) => {
    setUseCurrentTimeIn(checked);
    if (checked) {
      const now = new Date();
      setCheckInDate(toUiDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`));
      setCheckInTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
    } else {
      if (selectedRes.reservationDateTime) {
        const dateOnly = String(selectedRes.reservationDateTime).substring(0, 10);
        const timeOnly = String(selectedRes.reservationDateTime).length >= 16 ? String(selectedRes.reservationDateTime).substring(11, 16) : '14:00';
        setCheckInDate(toUiDate(dateOnly));
        setCheckInTime(timeOnly);
      } else {
        setCheckInDate(toUiDate(todayDbDate));
        setCheckInTime('14:00');
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!guestForm.firstName.trim() || !guestForm.lastName.trim()) {
      showAlert('error', 'Validation Error', 'Guest First Name and Last Name are required.');
      return;
    }

    if (!guestForm.email || !guestForm.email.trim()) {
      showAlert('error', 'Validation Error', 'Guest Email Address is required for all bookings.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestForm.email.trim())) {
      showAlert('error', 'Validation Error', 'Please enter a valid guest email address.');
      return;
    }

    if (!isValidDate(checkInDate) || !isValidDate(checkOutDate)) {
      showAlert('error', 'Validation Error', 'Please enter valid Check-In and Check-Out dates (MM/DD/YYYY).');
      return;
    }

    const inDateObj = new Date(toDbDate(checkInDate) + 'T' + checkInTime + ':00');
    const outDateObj = new Date(toDbDate(checkOutDate) + 'T' + checkOutTime + ':00');

    if (outDateObj <= inDateObj) {
      showAlert('error', 'Validation Error', 'Check-Out date & time must be strictly after Check-In date & time.');
      return;
    }

    const cashReceived = String(paymentMethodID) === '2' ? requiredDownpayment : parseFloat(downPayment || 0);

    if (String(paymentMethodID) === '1' && (isNaN(cashReceived) || cashReceived < requiredDownpayment)) {
      showAlert('error', 'Validation Error', `Minimum required down payment is ₱${requiredDownpayment.toFixed(2)} (${dpPctNum}% Tier).`);
      return;
    }

    if (String(paymentMethodID) === '2' && !isGcashSettled) {
      setGcashInlineError('Cannot proceed: GCash payment not settled. Please scan and verify the QR payment before saving.');
      showAlert('error', 'Payment Unsettled', 'Cannot proceed: GCash payment not settled. Please scan and verify the QR payment before saving.');
      return;
    }

    const change = Math.max(0, cashReceived - requiredDownpayment);
    const actionTitle = useCurrentTimeIn ? 'Confirm & Check-In Guest Now' : 'Confirm & Save Booking';
    const actionMsg = useCurrentTimeIn
      ? `Are you sure you want to convert Reservation #${selectedRes.reservationID} into a booking and check in the guest immediately at current time?`
      : `Are you sure you want to confirm Reservation #${selectedRes.reservationID} and record the down payment?`;

    showConfirm(actionTitle, actionMsg, () => {
      onSubmit({
        action: 'convert_to_booking',
        reservationID: selectedRes.reservationID,
        checkInDateTime: toDbDate(checkInDate) + ' ' + checkInTime + ':00',
        checkOutDateTime: toDbDate(checkOutDate) + ' ' + checkOutTime + ':00',
        downPaymentAmount: requiredDownpayment,
        cashReceived,
        change,
        paymentMethodID: parseInt(paymentMethodID, 10),
        checkInNow: useCurrentTimeIn,
        paymentStatus: 'Settled',
        isGcashSettled,
        referenceNumber: settledPaymentRef || null,
        email: guestForm.email.trim().toLowerCase(),
        firstName: guestForm.firstName.trim(),
        lastName: guestForm.lastName.trim(),
        contact: guestForm.contact.trim(),
        remainingBalance: remainingBal
      });
    });
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header text-white" style={{ background: 'var(--pcc-blue)' }}>
            <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
              <i className="bi bi-calendar-check-fill"></i>
              Confirm Reservation & Record Booking
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <form onSubmit={handleFormSubmit}>
            <div className="modal-body" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
              
              {/* GUEST DETAILS CARD PANEL (MATCHING BOOKING FORM) */}
              <div className="p-3 mb-3 border rounded bg-white shadow-xs">
                <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                  <h6 className="mb-0 text-pcc-primary fw-bold d-flex align-items-center gap-1.5">
                    <i className="bi bi-person-lines-fill"></i>
                    Guest Details
                  </h6>
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                    Reservation #{selectedRes.reservationID} Linked
                  </span>
                </div>

                <div className="row g-2 mb-2">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold mb-1">First Name *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      required
                      value={guestForm.firstName}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold mb-1">Last Name *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      required
                      value={guestForm.lastName}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="row g-2">
                  <div className="col-md-4 mb-2">
                    <label className="form-label small fw-semibold mb-1">Contact Number (11 digits)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="09XXXXXXXXX"
                      value={guestForm.contact}
                      onChange={(e) => {
                        const sanitized = e.target.value.replace(/[^0-9]/g, "").slice(0, 11);
                        setGuestForm(prev => ({ ...prev, contact: sanitized }));
                      }}
                    />
                  </div>
                  <div className="col-md-4 mb-2">
                    <label className="form-label small fw-semibold mb-1">Birthdate (18+)</label>
                    <DateInput
                      className="form-control form-control-sm"
                      value={guestForm.dateOfBirth}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-4 mb-2">
                    <label className="form-label small fw-semibold mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      className="form-control form-control-sm"
                      placeholder="name@example.com"
                      required
                      value={guestForm.email}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* ROOM SUMMARY BADGE */}
              <div className="p-3 mb-3 bg-light rounded border">
                <div className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-3">
                    <div className="rounded border bg-white text-pcc-blue d-flex align-items-center justify-content-center shadow-sm" style={{ width: '45px', height: '45px' }}>
                      <i className="bi bi-door-closed fs-4"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold text-dark mb-0">
                        Room {selectedRes.roomNumber} ({selectedRes.roomType || 'Standard'})
                      </h6>
                      <div className="small text-muted">
                        Inclusion: <strong>{isWithBk ? 'With Breakfast' : 'Without Breakfast'}</strong> &bull; Base Rate: <strong>₱{rate.toFixed(2)}/night</strong>
                      </div>
                    </div>
                  </div>
                  <span className="badge bg-primary px-3 py-1.5 rounded-pill fs-6">
                    Max Pax: {selectedRoom?.occupancyLimit || 2} Guests
                  </span>
                </div>
              </div>

              {/* STAY SCHEDULE & CALENDAR DATES (MATCHING BOOKING FORM EXACTLY) */}
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Check-In Date *</label>
                  <input
                    type="date"
                    className="form-control form-control-sm mb-2"
                    value={toDbDate(checkInDate)}
                    min={todayDbDate}
                    onChange={(e) => setCheckInDate(toUiDate(e.target.value))}
                    disabled={Boolean(useCurrentTimeIn)}
                    required
                  />
                  <div className="mt-2">
                    <label className="form-label small fw-semibold d-flex justify-content-between">
                      <span>Check-In Time *</span>
                      <small className="text-muted" style={{ fontSize: '0.72rem' }}>Std: 2:00 PM</small>
                    </label>
                    <input
                      type="time"
                      className={`form-control form-control-sm ${useCurrentTimeIn ? 'bg-light text-muted' : ''}`}
                      value={checkInTime}
                      min={isCheckInToday && !useCurrentTimeIn ? currentTimeStr : undefined}
                      onChange={(e) => setCheckInTime(e.target.value)}
                      disabled={Boolean(useCurrentTimeIn)}
                      required
                    />
                    <div className="form-check mt-1">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="confUseCurrentTimeIn"
                        checked={Boolean(useCurrentTimeIn)}
                        onChange={(e) => handleToggleCurrentIn(e.target.checked)}
                      />
                      <label className="form-check-label small text-muted user-select-none fw-semibold text-dark" htmlFor="confUseCurrentTimeIn" style={{ fontSize: '0.75rem' }}>
                        Check-In Now (use current time)
                      </label>
                      <div className="form-text text-muted small mt-0.5" style={{ fontSize: '0.73rem' }}>
                        <i className="bi bi-info-circle me-1"></i>
                        Checked In immediately when selected; defaults to scheduled reservation time when unselected.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Check-Out Date *</label>
                  <input
                    type="date"
                    className="form-control form-control-sm mb-2"
                    value={toDbDate(checkOutDate)}
                    min={checkInDate ? toDbDate(checkInDate) : todayDbDate}
                    onChange={(e) => setCheckOutDate(toUiDate(e.target.value))}
                    required
                  />
                  <div className="mt-2">
                    <label className="form-label small fw-semibold d-flex justify-content-between">
                      <span>Check-Out Time *</span>
                      <small className="text-muted" style={{ fontSize: '0.72rem' }}>Std: 12:00 PM</small>
                    </label>
                    <input
                      type="time"
                      className="form-control form-control-sm"
                      value={checkOutTime}
                      onChange={(e) => setCheckOutTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* REQUIRED DOWN PAYMENT TIER */}
              <div className="mb-3">
                <label className="form-label fw-bold">Required Down Payment Tier *</label>
                <div className="btn-group w-100" role="group">
                  <button
                    type="button"
                    className={`btn ${downPaymentOption === '30' ? 'btn-pcc-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setDownPaymentOption('30')}
                  >
                    30% Down Payment
                  </button>
                  <button
                    type="button"
                    className={`btn ${downPaymentOption === '50' ? 'btn-pcc-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setDownPaymentOption('50')}
                  >
                    50% Down Payment
                  </button>
                  <button
                    type="button"
                    className={`btn ${downPaymentOption === '100' ? 'btn-pcc-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setDownPaymentOption('100')}
                  >
                    Full Payment (100%)
                  </button>
                </div>
              </div>

              {/* DYNAMIC BREAKDOWN MATH */}
              <div className="p-3 bg-light rounded border mb-3" style={{ fontSize: '0.88rem' }}>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">Room Base Rate:</span>
                  <span className="fw-bold text-dark">
                    ₱{rate.toFixed(2)}/night ({isWithBk ? 'With Breakfast' : 'Without Breakfast'})
                  </span>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">Stay Duration:</span>
                  <span className="fw-semibold">{nights} Night(s)</span>
                </div>
                <div className="d-flex justify-content-between border-top pt-1.5 mb-1 fw-bold text-pcc-blue" style={{ fontSize: '1rem' }}>
                  <span>Net Total Booking Amount:</span>
                  <span>₱{totalRoomCharge.toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between text-success fw-bold">
                  <span>Required Down Payment ({dpPctNum}% Tier):</span>
                  <span className="fs-6">₱{requiredDownpayment.toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between text-muted small">
                  <span>Remaining Balance at Check-in:</span>
                  <span>₱{remainingBal.toFixed(2)}</span>
                </div>
              </div>

              {/* PAYMENT METHOD & RECEIVED */}
              <div className="row g-2 mb-3">
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Payment Method *</label>
                  <select
                    className="form-select form-select-sm"
                    required
                    value={paymentMethodID}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPaymentMethodID(val);
                      if (String(val) === '2') {
                        setDownPayment(requiredDownpayment.toFixed(2));
                      }
                    }}
                  >
                    {paymentMethods.map(pm => (
                      <option key={pm.paymentMethodID} value={pm.paymentMethodID}>
                        {pm.paymentMethod}
                      </option>
                    ))}
                  </select>
                </div>

                {String(paymentMethodID) === '1' ? (
                  <>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Payment Received (₱) *</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control form-control-sm fw-bold text-success"
                        required
                        placeholder={`Min ₱${requiredDownpayment.toFixed(2)}`}
                        value={downPayment}
                        onChange={(e) => setDownPayment(e.target.value)}
                      />
                      <small className="text-muted d-block mt-1" style={{ fontSize: '0.74rem' }}>
                        Required: ₱{requiredDownpayment.toFixed(2)} ({dpPctNum}% Tier)
                      </small>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Change to Give (₱)</label>
                      <input
                        type="text"
                        readOnly
                        className={`form-control form-control-sm fw-bold ${
                          (parseFloat(downPayment || 0) - requiredDownpayment) >= 0 ? 'text-primary' : 'text-danger'
                        }`}
                        value={`₱${Math.max(0, (parseFloat(downPayment || 0) - requiredDownpayment)).toFixed(2)}`}
                      />
                      <small className="text-muted d-block mt-1" style={{ fontSize: '0.74rem' }}>
                        Auto-calculated change
                      </small>
                    </div>
                  </>
                ) : (
                  <div className="col-md-8">
                    {gcashInlineError && (
                      <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-2">
                        <i className="bi bi-exclamation-octagon-fill"></i>
                        <span>{gcashInlineError}</span>
                      </div>
                    )}
                    {!isGcashSettled ? (
                      <div className="alert alert-warning py-1.5 px-2.5 small d-flex align-items-center gap-2 mb-2" style={{ fontSize: '0.78rem' }}>
                        <i className="bi bi-exclamation-triangle-fill text-warning"></i>
                        <span>GCash payment has not been settled yet. Scan QR code or confirm auto-settlement below.</span>
                      </div>
                    ) : (
                      <div className="alert alert-success py-1.5 px-2.5 small d-flex align-items-center gap-2 mb-2 text-success fw-bold" style={{ fontSize: '0.78rem' }}>
                        <i className="bi bi-check-circle-fill"></i>
                        <span>GCash payment verified and settled.</span>
                      </div>
                    )}
                    <DynamicQrPhCode 
                      amount={requiredDownpayment}
                      refNumber={`RES-${selectedRes?.reservationID || 'CONFIRM'}`}
                      paymentStatus={isGcashSettled ? "Settled" : "Pending"}
                      showProceedBtn={false}
                      showCheckStatusBtn={false}
                      showTestPayBtn={true}
                      onSimulateTestPay={(simRef) => {
                        setIsGcashSettled(true);
                        setGcashInlineError('');
                        setSettledPaymentRef(simRef);
                        setDownPayment(requiredDownpayment.toFixed(2));
                        showAlert('success', 'Test Pay Simulation', `Simulated GCash payment verified (${simRef}). Down payment settled.`);
                      }}
                      onPaymentSuccess={(pData) => {
                        setIsGcashSettled(true);
                        setGcashInlineError('');
                        if (pData?.referenceNumber) setSettledPaymentRef(pData.referenceNumber);
                        setDownPayment(requiredDownpayment.toFixed(2));
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary text-white" onClick={onClose}>
                Cancel
              </button>
              <LoadingButton
                type="submit"
                isLoading={isSubmitting}
                loadingText="Processing Booking..."
                className="btn btn-pcc-primary text-white fw-bold px-4"
              >
                Confirm & Save Booking
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
