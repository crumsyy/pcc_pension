'use client';

import { useState, useEffect } from 'react';
import DateInput, { isValidDate, toDbDate, toUiDate } from '../components/DateInput';
import LoadingButton from '../components/LoadingButton';
import DynamicQrPhCode from '../components/DynamicQrPhCode';
import { calculateBillingTotals } from '@/lib/billingCalculator';

export default function ConfirmReservationModal({
  isOpen,
  onClose,
  selectedRes,
  rooms = [],
  paymentMethods = [],
  availableDiscounts = [],
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

  const [downPaymentOption, setDownPaymentOption] = useState('50');
  const [paymentMethodID, setPaymentMethodID] = useState('1');
  const [downPayment, setDownPayment] = useState('');
  const [isGcashSettled, setIsGcashSettled] = useState(false);
  const [gcashInlineError, setGcashInlineError] = useState('');
  const [settledPaymentRef, setSettledPaymentRef] = useState('');
  const [discountedGuests, setDiscountedGuests] = useState([]);

  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayDbDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const currentTimeStr = `${pad(today.getHours())}:${pad(today.getMinutes())}`;

  useEffect(() => {
    if (!selectedRes || !isOpen) return;

    // Populate guest form
    const fName = selectedRes.firstName || '';
    const lName = selectedRes.lastName || '';
    setGuestForm({
      firstName: fName,
      lastName: lName,
      contact: selectedRes.contact || '',
      email: selectedRes.guestEmail || selectedRes.email || '',
      dateOfBirth: selectedRes.dateOfBirth ? toUiDate(selectedRes.dateOfBirth) : ''
    });

    // Populate discounted guests with primary guest default
    setDiscountedGuests([
      {
        guestName: `${fName} ${lName}`.trim() || 'Primary Guest',
        discountID: '',
        discountIdNumber: ''
      }
    ]);

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
    setDownPaymentOption('50');
    setPaymentMethodID('1');
    setDownPayment('');
    setIsGcashSettled(false);
    setGcashInlineError('');
    setSettledPaymentRef('');
  }, [selectedRes, isOpen]);

  // Multi-window / 2nd monitor GCash payment settlement listener
  useEffect(() => {
    if (!isOpen || !selectedRes) return;

    const resGcashRef = `RES-${selectedRes.reservationID}`;

    const onPaymentReceived = (data) => {
      if (data?.type === 'PAYMENT_SETTLED') {
        const isMatch = String(data.bookingID) === String(resGcashRef) ||
                        String(data.bookingID) === String(selectedRes.reservationID) ||
                        (data.referenceNumber && String(data.referenceNumber).includes(String(selectedRes.reservationID))) ||
                        String(data.bookingID).startsWith('RES-');
        if (isMatch) {
          setIsGcashSettled(true);
          const refCode = data.referenceNumber || data.bookingID || `PM-AUTH-${Date.now().toString().slice(-6)}`;
          setSettledPaymentRef(refCode);
          setGcashInlineError('');
          if (data.amount && parseFloat(data.amount) > 0) {
            setDownPayment(parseFloat(data.amount).toFixed(2));
          }
          showAlert?.('success', 'Payment Settled', `GCash payment verified (${refCode}) from 2nd Monitor.`);
        }
      }
    };

    let channel = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('pcc_payment_sync');
        channel.onmessage = (event) => {
          if (event.data) {
            onPaymentReceived(event.data);
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    const handleStorage = (e) => {
      if (e.key === 'pcc_payment_sync_event' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) {
            onPaymentReceived(parsed);
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) {
        try { channel.close(); } catch (e) {}
      }
      window.removeEventListener('storage', handleStorage);
    };
  }, [isOpen, selectedRes, showAlert]);

  if (!isOpen || !selectedRes) return null;

  const selectedRoom = rooms.find(r => String(r.roomID) === String(selectedRes.roomID));
  let parsedBreakfastDates = [];
  try {
    parsedBreakfastDates = typeof selectedRes.breakfastDates === 'string'
      ? JSON.parse(selectedRes.breakfastDates || '[]')
      : (Array.isArray(selectedRes.breakfastDates) ? selectedRes.breakfastDates : []);
  } catch (e) {
    parsedBreakfastDates = [];
  }
  const hasCustomBreakfast = parsedBreakfastDates.length > 0;
  const isWithBk = (selectedRes.breakfastOption || 'with') === 'with';
  const rate = selectedRoom
    ? ((isWithBk && !hasCustomBreakfast)
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

  const selectedRoomObj = (rooms || []).find(r => String(r.roomID) === String(selectedRes.roomID));
  const roomBasePax = Math.max(1, parseInt(selectedRes.occupancyLimit || selectedRoomObj?.occupancyLimit || 4, 10));
  const totalPax = Math.max(1, parseInt(selectedRes.guestCount || 1, 10));
  const extraGuests = Math.max(0, totalPax - roomBasePax);
  const extraGuestFee = extraGuests * 100 * nights;

  let calculatedBreakfastFee = parseFloat(selectedRes.breakfastFee || 0);
  if (hasCustomBreakfast && calculatedBreakfastFee <= 0) {
    calculatedBreakfastFee = parsedBreakfastDates.length * 250;
  }

  const formattedDiscounts = (discountedGuests || [])
    .filter(g => g.discountID)
    .map(g => {
      const disc = availableDiscounts.find(d => String(d.discountID) === String(g.discountID));
      return {
        guestName: g.guestName,
        discountID: g.discountID,
        discountIdNumber: g.discountIdNumber,
        rate: disc ? (parseFloat(disc.percentage) / 100) : 0,
        discountType: disc?.name || 'Special Discount'
      };
    });

  const dpPctNum = parseInt(downPaymentOption, 10) || 50;

  const billing = calculateBillingTotals({
    roomRate: rate,
    nights,
    guestCount: totalPax,
    guestDiscounts: formattedDiscounts,
    extraGuestFee,
    breakfastFee: calculatedBreakfastFee,
    downPaymentPercentage: dpPctNum
  });

  const totalRoomCharge = billing.grossRoomCharge ?? billing.grossRoomSubtotal ?? 0;
  const perCapitaShare = billing.perCapitaShare ?? 0;
  const totalDiscount = billing.totalPerCapitaDiscount ?? 0;
  const netRoomStayCharge = billing.netRoomStayCharge ?? 0;
  const grossSubtotal = billing.grossSubtotal ?? 0;
  const netSubtotal = billing.netTotal ?? 0;
  const requiredDownpayment = billing.requiredDownpayment ?? 0;
  const remainingBal = Math.max(0, Math.round(((billing.netTotal ?? 0) - requiredDownpayment) * 100) / 100);
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

    for (let i = 0; i < discountedGuests.length; i++) {
      const g = discountedGuests[i];
      if (g.discountID) {
        if (!g.guestName || !g.guestName.trim()) {
          showAlert('error', 'Validation Error', `Please enter the qualifying guest full name for discount #${i + 1}.`);
          return;
        }
        if (!g.discountIdNumber || !g.discountIdNumber.trim()) {
          showAlert('error', 'Validation Error', `Numeric ID Number is required for qualifying guest "${g.guestName}".`);
          return;
        }
      }
    }

    const cashReceived = String(paymentMethodID) === '2' ? requiredDownpayment : parseFloat(downPayment || 0);

    if (String(paymentMethodID) === '1' && (isNaN(cashReceived) || cashReceived < requiredDownpayment)) {
      showAlert('error', 'Validation Error', `Minimum required down payment is ₱${(requiredDownpayment || 0).toFixed(2)} (${dpPctNum}% Tier).`);
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
        remainingBalance: remainingBal,
        discountedGuests: discountedGuests.filter(g => g.discountID),
        guestCount: totalPax
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
                    Max Pax: {selectedRoom?.occupancyLimit || 4} Guests
                  </span>
                </div>
              </div>

              {/* SPECIAL DISCOUNTS (SENIOR / PWD / STUDENT) */}
              <div className="p-3 mb-3 border rounded bg-white shadow-xs">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <h6 className="fw-bold text-pcc-primary mb-0 small d-flex align-items-center gap-1.5">
                      <i className="bi bi-tag-fill"></i>
                      Special Discounts (Senior Citizen / PWD / Student)
                    </h6>
                    <span className="small text-muted" style={{ fontSize: '0.78rem' }}>
                      Optional: Add details for any guest qualifying for an individual discount (Limit: {totalPax} guest{totalPax > 1 ? 's' : ''}).
                    </span>
                  </div>
                  {discountedGuests.length < totalPax && (
                    <button
                      type="button"
                      className="btn btn-sm btn-pcc-primary text-white fw-bold py-1 px-2.5"
                      style={{ fontSize: '0.78rem' }}
                      onClick={() => setDiscountedGuests(prev => [...prev, { guestName: '', discountID: '', discountIdNumber: '' }])}
                    >
                      + Add Discounted Guest
                    </button>
                  )}
                </div>

                {discountedGuests.length === 0 ? (
                  <div className="text-muted small fst-italic py-1">
                    No discounted guests added. Click "+ Add Discounted Guest" if any guest qualifies for a discount.
                  </div>
                ) : (
                  discountedGuests.map((g, idx) => (
                    <div key={idx} className="row g-2 align-items-center mb-2 p-2 border rounded bg-light">
                      <div className="col-md-4">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder={g.discountID ? "Qualifying Guest Full Name *" : "Qualifying Guest Full Name"}
                          value={g.guestName || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDiscountedGuests(prev => prev.map((item, i) => i === idx ? { ...item, guestName: val } : item));
                          }}
                          required={Boolean(g.discountID)}
                        />
                      </div>
                      <div className="col-md-4">
                        <select
                          className="form-select form-select-sm"
                          value={g.discountID}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDiscountedGuests(prev => prev.map((item, i) => i === idx ? { ...item, discountID: val } : item));
                          }}
                        >
                          <option value="">Select Discount Type (Optional)</option>
                          {availableDiscounts.map(d => (
                            <option key={d.discountID} value={String(d.discountID)}>{d.name} ({d.percentage}%)</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="form-control form-control-sm"
                          placeholder={g.discountID ? "Numeric ID No * (0-9)" : "Numeric ID No (0-9)"}
                          value={g.discountIdNumber}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setDiscountedGuests(prev => prev.map((item, i) => i === idx ? { ...item, discountIdNumber: val } : item));
                          }}
                          onKeyDown={(e) => {
                            if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          required={Boolean(g.discountID)}
                        />
                      </div>
                      <div className="col-md-1 text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-danger text-white fw-bold py-1 px-2 w-100"
                          onClick={() => {
                            if (discountedGuests.length <= 1) {
                              setDiscountedGuests([{ guestName: '', discountID: '', discountIdNumber: '' }]);
                            } else {
                              setDiscountedGuests(prev => prev.filter((_, i) => i !== idx));
                            }
                          }}
                          title="Remove / Clear discount"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
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
                    ₱{(rate || 0).toFixed(2)}/night ({isWithBk ? 'With Breakfast' : 'Without Breakfast'})
                  </span>
                </div>
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted">Stay Duration:</span>
                  <span className="fw-semibold">{nights} Night(s)</span>
                </div>
                <div className="d-flex justify-content-between border-top pt-1.5 mb-1 fw-bold text-pcc-blue" style={{ fontSize: '1rem' }}>
                  <span>Base Room Charge:</span>
                  <span>₱{(totalRoomCharge || 0).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between mb-1 text-muted" style={{ fontSize: '0.84rem' }}>
                  <span>Per-Capita Share ({totalPax} Guest{totalPax > 1 ? 's' : ''}):</span>
                  <span className="fw-semibold text-dark">₱{(perCapitaShare || 0).toFixed(2)}/pax</span>
                </div>
                {hasCustomBreakfast && calculatedBreakfastFee > 0 && (
                  <div className="d-flex justify-content-between mb-1 text-primary">
                    <span>Breakfast Fee ({parsedBreakfastDates.length} morning{parsedBreakfastDates.length > 1 ? 's' : ''}):</span>
                    <span className="fw-semibold">+₱{(calculatedBreakfastFee || 0).toFixed(2)}</span>
                  </div>
                )}

                {/* ITEMIZED APPLIED DISCOUNTS */}
                {billing.itemizedDiscounts && billing.itemizedDiscounts.length > 0 && (
                  <div className="my-2 p-2 bg-white rounded border border-success-subtle">
                    <div className="fw-bold text-success small mb-1 d-flex align-items-center justify-content-between">
                      <span><i className="bi bi-tag-fill me-1"></i>Applied Special Discounts:</span>
                      <span className="badge bg-success-subtle text-success border border-success-subtle">
                        {billing.itemizedDiscounts.length} Beneficiar{billing.itemizedDiscounts.length > 1 ? 'ies' : 'y'}
                      </span>
                    </div>
                    {billing.itemizedDiscounts.map((disc, idx) => (
                      <div key={idx} className="d-flex justify-content-between align-items-center small py-0.5 text-success">
                        <span>
                          <strong>{disc.guestName || `Guest #${idx + 1}`}</strong>: {disc.discountType} ({disc.percentage}%)
                          {disc.discountIdNumber && <span className="text-muted ms-1" style={{ fontSize: '0.75rem' }}>(ID: {disc.discountIdNumber})</span>}
                        </span>
                        <span className="fw-bold">-₱{(disc.discountAmount || 0).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="d-flex justify-content-between align-items-center fw-bold text-success border-top pt-1 mt-1 small">
                      <span>Total Special Discount:</span>
                      <span>-₱{(totalDiscount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {totalDiscount > 0 && (
                  <div className="d-flex justify-content-between text-dark fw-bold mb-1" style={{ fontSize: '0.92rem' }}>
                    <span>Net Room Stay Charge:</span>
                    <span>₱{(netRoomStayCharge || 0).toFixed(2)}</span>
                  </div>
                )}

                <div className="d-flex justify-content-between text-success fw-bold">
                  <span>Required Down Payment ({dpPctNum}% of Net Room Charge):</span>
                  <span className="fs-6">₱{(requiredDownpayment || 0).toFixed(2)}</span>
                </div>
                {extraGuests > 0 && (
                  <div className="d-flex justify-content-between text-primary small">
                    <span>Additional Guest Fee ({extraGuests} Extra Pax × {nights} Night{nights > 1 ? 's' : ''}):</span>
                    <span className="fw-semibold">+₱{(extraGuestFee || 0).toFixed(2)} <span className="text-muted fw-normal">(Payable at Check-in)</span></span>
                  </div>
                )}
                <div className="d-flex justify-content-between text-muted small pt-1 border-top">
                  <span>Remaining Balance at Check-in:</span>
                  <span className="fw-bold text-dark">₱{(remainingBal || 0).toFixed(2)}</span>
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
                      setIsGcashSettled(false);
                      setGcashInlineError('');
                      setSettledPaymentRef('');
                      if (String(val) === '2') {
                        setDownPayment((requiredDownpayment || 0).toFixed(2));
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
                        placeholder={`Min ₱${(requiredDownpayment || 0).toFixed(2)}`}
                        value={downPayment}
                        onChange={(e) => setDownPayment(e.target.value)}
                      />
                      <small className="text-muted d-block mt-1" style={{ fontSize: '0.74rem' }}>
                        Required: ₱{(requiredDownpayment || 0).toFixed(2)} ({dpPctNum}% Tier)
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
                  <>
                    <div className="col-md-8 d-flex align-items-end justify-content-start gap-2 pb-1">
                      <a
                        href={`/receptionist/qr-payment?amount=${(requiredDownpayment || 0).toFixed(2)}&ref=RES-${selectedRes?.reservationID || 'CONFIRM'}&roomNumber=${encodeURIComponent(selectedRoom?.roomNumber || '')}&guestName=${encodeURIComponent(`${guestForm.firstName || ''} ${guestForm.lastName || ''}`.trim() || 'Guest')}&roomType=${encodeURIComponent(selectedRoom?.roomType || 'Standard')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary fw-bold text-nowrap d-inline-flex align-items-center gap-1 shadow-sm"
                        title="Open guest payment terminal in a new window or second monitor"
                      >
                        <i className="fa-solid fa-up-right-from-square"></i> Open on 2nd Monitor
                      </a>
                      {!isGcashSettled ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-success fw-bold text-white text-nowrap d-inline-flex align-items-center gap-1 shadow-sm"
                          onClick={() => {
                            const authRef = `AUTH-RES-${Date.now().toString().slice(-6)}`;
                            setIsGcashSettled(true);
                            setSettledPaymentRef(authRef);
                            setDownPayment((requiredDownpayment || 0).toFixed(2));
                            setGcashInlineError('');
                            showAlert?.('success', 'Payment Authorized', `GCash payment settled (${authRef}). You may now confirm the reservation.`);
                          }}
                        >
                          <i className="fa-solid fa-circle-check"></i> Authorize Payment
                        </button>
                      ) : (
                        <span className="badge bg-success d-inline-flex align-items-center gap-1 py-2 px-2.5 shadow-sm">
                          <i className="fa-solid fa-circle-check"></i> Payment Authorized
                        </span>
                      )}
                    </div>

                    <div className="col-md-12 d-flex flex-column align-items-center justify-content-center">
                      {gcashInlineError && (
                        <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-2 w-100" style={{ maxWidth: '380px' }}>
                          <i className="bi bi-exclamation-octagon-fill"></i>
                          <span>{gcashInlineError}</span>
                        </div>
                      )}
                      {!isGcashSettled ? (
                        <div className="alert alert-warning py-1.5 px-2.5 small d-flex align-items-center gap-2 mb-2 w-100" style={{ maxWidth: '380px', fontSize: '0.78rem' }}>
                          <i className="bi bi-exclamation-triangle-fill text-warning"></i>
                          <span>GCash payment has not been settled yet. Scan QR code or authorize payment.</span>
                        </div>
                      ) : (
                        <div className="alert alert-success py-1.5 px-2.5 small d-flex align-items-center gap-2 mb-2 text-success fw-bold w-100" style={{ maxWidth: '380px', fontSize: '0.78rem' }}>
                          <i className="bi bi-check-circle-fill"></i>
                          <span>GCash payment verified and settled.</span>
                        </div>
                      )}
                      <DynamicQrPhCode 
                        amount={requiredDownpayment || 0}
                        refNumber={`RES-${selectedRes?.reservationID || 'CONFIRM'}`}
                        paymentStatus={isGcashSettled ? "Settled" : "Pending"}
                        showProceedBtn={false}
                        showCheckStatusBtn={false}
                        showTestPayBtn={false}
                        onPaymentSuccess={(pData) => {
                          setIsGcashSettled(true);
                          setGcashInlineError('');
                          if (pData?.referenceNumber) setSettledPaymentRef(pData.referenceNumber);
                          setDownPayment((requiredDownpayment || 0).toFixed(2));
                        }}
                      />
                    </div>
                  </>
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
