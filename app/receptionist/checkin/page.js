'use client';

import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { clientCache, CACHE_TTL } from '@/lib/clientCache';
import ModalDialog from '../../components/ModalDialog';
import { toast } from '@/components/ui/toast';
import ReservationCalendar from '../../components/ReservationCalendar';

function CheckInClient() {
  const searchParams = useSearchParams();
  const targetBookingID = searchParams.get('bookingID');
  const highlightBookingID = searchParams.get('highlightBookingID') || searchParams.get('highlightStayID');

  const initialCheckinCache = typeof window !== 'undefined' ? clientCache.get('RECEPTIONIST_CHECKIN') : null;
  const [bookings, setBookings] = useState(initialCheckinCache?.data?.bookings || []);
  const [roomSchedules, setRoomSchedules] = useState(initialCheckinCache?.data?.roomSchedules || []);
  const [rooms, setRooms] = useState(initialCheckinCache?.data?.rooms || []);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [processingCheckInId, setProcessingCheckInId] = useState(null);

  // Custom Modal dialog state
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null,
    confirmText: 'OK',
    cancelText: 'Cancel'
  });

  const [updateModal, setUpdateModal] = useState({
    isOpen: false,
    booking: null,
    newCheckOut: ''
  });



  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Pending':
      case 'Pending Check-in':
        return 'bg-warning-subtle text-warning-emphasis border border-warning';
      case 'Confirmed':
      case 'Booked':
        return 'bg-primary-subtle text-primary border border-primary';
      case 'Checked In':
      case 'Active Stay':
        return 'bg-info-subtle text-info-emphasis border border-info';
      case 'Pending Room Verification':
      case 'Pending Checkout':
        return 'bg-warning text-dark fw-bold';
      case 'Room Verified':
      case 'Pending Bill':
        return 'bg-warning text-dark fw-bold border border-warning';
      case 'Bill Finalized':
      case 'Final Billing Updated':
        return 'bg-primary text-white fw-bold';
      case 'Payment Completed':
      case 'Paid':
        return 'bg-success text-white fw-bold';
      case 'Checked Out':
      case 'Completed':
        return 'bg-secondary-subtle text-secondary border';
      case 'Cancelled':
      case 'No Show':
        return 'bg-danger-subtle text-danger border border-danger';
      default:
        return 'bg-secondary-subtle text-secondary';
    }
  };

  const handleVerifyRoom = (id, roomNumber, guestName) => {
    showConfirm(
      'Inspect Room Condition',
      `Mark Room ${roomNumber} (${guestName}) as inspected? This will transition the stay to 'Pending Bill' for final ledger settlement.`,
      async () => {
        try {
          const res = await fetch('/api/receptionist/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify_room', bookingID: id })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to inspect room');

          showAlert('success', 'Room Inspected — Pending Bill', data.message || `Room ${roomNumber} inspected. Proceed to Billing Ledger to finalize folio.`);
          fetchBookings();
        } catch (err) {
          showAlert('error', 'Error', err.message);
        }
      }
    );
  };



  const handleOpenUpdateModal = (b) => {
    const dt = b.checkOutDateTime ? new Date(String(b.checkOutDateTime).replace(' ', 'T')) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const formattedLocal = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    
    setUpdateModal({
      isOpen: true,
      booking: b,
      newCheckOut: formattedLocal
    });
  };

  const handleSaveUpdateCheckOut = async () => {
    if (!updateModal.newCheckOut || !updateModal.booking) return;

    const inDateObj = new Date(String(updateModal.booking.checkInDateTime).replace(' ', 'T'));
    const outDateObj = new Date(String(updateModal.newCheckOut).replace(' ', 'T'));

    if (outDateObj <= inDateObj) {
      showAlert('error', 'Validation Error', 'Check-out time must be later than check-in time.');
      return;
    }

    try {
      const formattedForDb = updateModal.newCheckOut.replace('T', ' ') + ':00';

      const res = await fetch('/api/receptionist/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_checkout',
          bookingID: updateModal.booking.bookingID,
          newCheckOutDateTime: formattedForDb
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update check-out date & time');

      showAlert('success', 'Check-Out Schedule Updated', 'Check-out schedule updated successfully. The guest and front desk have been notified.');
      setUpdateModal({ isOpen: false, booking: null, newCheckOut: '' });
      fetchBookings();
    } catch (err) {
      showAlert('error', 'Error', err.message);
    }
  };

  const showAlert = (type, title, message) => {
    toast.add({
      type: type || 'info',
      title: title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notification'),
      description: message || ''
    });
  };

  const showConfirm = (title, message, onConfirmCallback, confirmText = 'Confirm', cancelText = 'Cancel') => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      confirmText,
      cancelText,
      onConfirm: async () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        try {
          if (onConfirmCallback) await onConfirmCallback();
        } catch (e) {
          console.error("Confirmation action error:", e);
        }
      },
      onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const [shouldAnimate, setShouldAnimate] = useState(!initialCheckinCache);
  const isFirstMount = useRef(true);

  const fetchBookings = async (isBackground = true) => {
    try {
      const res = await fetch('/api/receptionist/bookings');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch bookings');
      setBookings(data.bookings || []);
      setRoomSchedules(data.roomSchedules || []);
      setRooms(data.rooms || []);

      clientCache.set('RECEPTIONIST_CHECKIN', data, CACHE_TTL.RECEPTIONIST_CHECKIN);
    } catch (err) {
      if (!isBackground) showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const entry = clientCache.get('RECEPTIONIST_CHECKIN');
    if (entry) {
      setBookings(entry.data?.bookings || []);
      setRoomSchedules(entry.data?.roomSchedules || []);
      setRooms(entry.data?.rooms || []);
      setLoading(false);
      setShouldAnimate(false);
      if (entry.isStale) fetchBookings(true);
    } else {
      if (!isFirstMount.current) setShouldAnimate(true);
      fetchBookings(true);
    }
    isFirstMount.current = false;
  }, []);

  // Handle auto-action from dashboard redirect query param
  useEffect(() => {
    if (!loading && targetBookingID && bookings.length > 0) {
      const target = bookings.find(b => b.bookingID === parseInt(targetBookingID));
      if (target) {
        if (['Pending Check-in', 'Pending', 'Confirmed', 'Booked', 'Overdue Check-In'].includes(target.status)) {
          handleCheckIn(target.bookingID, target.firstName + ' ' + target.lastName);
        } else if (target.status === 'Checked In' || target.status === 'Active Stay') {
          handleCheckOut(target.bookingID, target.firstName + ' ' + target.lastName);
        }
      }
    }
  }, [loading, targetBookingID, bookings]);

  // Handle locating and highlighting stay from notification click (?highlightBookingID=...)
  useEffect(() => {
    if (!loading && highlightBookingID && bookings.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`departure-booking-${highlightBookingID}`) || 
                   document.getElementById(`arrival-booking-${highlightBookingID}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('stay-highlight-pulse');
          setTimeout(() => {
            el.classList.remove('stay-highlight-pulse');
          }, 6000);
        }
      }, 350);
    }
  }, [loading, highlightBookingID, bookings]);

  const handleCheckIn = (id, guestName) => {
    const performCheckIn = async (isEarlyConfirmed = false) => {
      setProcessingCheckInId(id);
      try {
        const res = await fetch('/api/receptionist/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'checkin',
            bookingID: id,
            confirmEarlyCheckIn: isEarlyConfirmed,
            confirmAdvanceCheckIn: isEarlyConfirmed
          })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to check in');

        if (data.requiresAdvanceCheckInConfirmation) {
          showConfirm(
            data.title || 'Advance & Early Check-In Notice',
            data.message || `This guest is checking in ${data.advanceNights} day(s) ahead of schedule. Room ${data.roomNumber} is available. Checking in today will add ${data.advanceNights} additional night charge(s) (₱${parseFloat(data.additionalRoomCharge || 0).toFixed(2)}) and early check-in fees to the bill.`,
            async () => {
              await performCheckIn(true);
            },
            'Confirm & Add Charges',
            'Cancel'
          );
          return;
        }

        if (data.requiresEarlyCheckInConfirmation) {
          showConfirm(
            'Early Check-In Confirmation',
            `Standard check-in time is 2:00 PM. Are you sure you want to proceed with Early Check-In for ${guestName}? An additional early check-in fee of ₱${parseFloat(data.earlyFee).toFixed(2)} (${data.earlyHours} hour(s) @ ₱50/hr) will be automatically added to the guest's bill.`,
            async () => {
              await performCheckIn(true);
            },
            'Confirm & Add Charges',
            'Cancel'
          );
          return;
        }

        showAlert('success', 'Guest Checked In', data.message || `${guestName} checked in successfully.`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pcc-refresh-dashboard'));
        }
        fetchBookings();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      } finally {
        setProcessingCheckInId(null);
      }
    };

    showConfirm('Process Check-In', `Check in ${guestName} now?`, async () => {
      await performCheckIn(false);
    });
  };

  const handleCheckOut = async (id, guestName) => {
    try {
      const resBill = await fetch(`/api/receptionist/billing?bookingID=${id}`);
      const dataBill = await resBill.json();
      if (!resBill.ok) throw new Error(dataBill.error || 'Failed to fetch guest billing details');
      
      const rawPreBalance = parseFloat(dataBill.chargesSummary?.rawBalance ?? dataBill.chargesSummary?.balance ?? 0);
      const balance = parseFloat(dataBill.chargesSummary?.balance || 0);
      if (rawPreBalance < 0) {
        showAlert('error', 'Overpayment Review Required', `Guest ${guestName} has an overpayment of PHP ${Math.abs(rawPreBalance).toFixed(2)} flagged for staff review. Checkout is blocked until resolved.`);
        return;
      }
      if (balance > 0) {
        showAlert('warning', 'Outstanding Balance Found', `Guest ${guestName} has an unpaid balance of ₱${balance.toFixed(2)}. Redirecting to the Payments page to settle the bill before check-out.`);
        setTimeout(() => {
          window.location.href = `/receptionist/payments?bookingID=${id}`;
        }, 3000);
        return;
      }

      const performCheckOut = async (confirmEarly = false) => {
        try {
          const res = await fetch('/api/receptionist/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'checkout',
              bookingID: id,
              confirmEarlyCheckOut: confirmEarly
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to check out');

          if (data.requiresEarlyCheckOutConfirmation) {
            showConfirm(
              'Early Check-Out Confirmation',
              data.message,
              async () => {
                await performCheckOut(true);
              }
            );
            return;
          }

          showAlert('success', 'Success', `${guestName} checked out successfully.`);
          fetchBookings();
        } catch (err) {
          showAlert('error', 'Error', err.message);
        }
      };

      const preTotal = parseFloat(dataBill.chargesSummary?.grandTotal ?? dataBill.chargesSummary?.netTotal ?? 0).toFixed(2);
      const prePaid = parseFloat(dataBill.chargesSummary?.paid ?? 0).toFixed(2);
      showConfirm('Process Check-Out', `Check out ${guestName}? Final bill: ₱${preTotal} | Verified payments: ₱${prePaid} | Remaining: ₱0.00. The booking will be marked Completed and the room freed to Available.`, async () => {
        await performCheckOut(false);
      });
    } catch (err) {
      showAlert('error', 'Error', err.message);
    }
  };

  const arrivals = bookings.filter(b => [
    'Pending Check-in',
    'Pending',
    'Confirmed',
    'Booked',
    'Overdue Check-In'
  ].includes(b.status));

  const departures = bookings.filter(b => [
    'Checked In',
    'Active Stay',
    'Checkout Requested',
    'Pending Room Verification',
    'Pending Checkout',
    'Room Verified',
    'Pending Bill',
    'Bill Finalized',
    'Final Billing Updated',
    'Payment Completed',
    'Paid',
    'Late Checkout'
  ].includes(b.status));

  const filterList = (list) => {
    return list.filter(b => {
      const fullName = `${b.firstName} ${b.lastName}`.toLowerCase();
      const room = String(b.roomNumber).toLowerCase();
      const bookingNum = String(b.bookingID).toLowerCase();
      const query = search.toLowerCase();
      return fullName.includes(query) || room.includes(query) || bookingNum.includes(query);
    });
  };

  return (
    <div className={shouldAnimate ? 'pcc-content-reveal' : ''}>

      <div className="card-module p-4 mb-4" style={{ backgroundColor: "#fff", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by guest name or room number..."
            className="form-control"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

          <div className="row g-4">
            {/* Arriving Guests (Check-In) */}
            <div className="col-lg-6">
              <div className="p-3 rounded mb-3 text-white" style={{ backgroundColor: 'var(--pcc-blue)' }}>
                <h5 className="mb-0 fw-bold">Arriving Guests (Check-In)</h5>
                <small className="opacity-75">Pending arrivals scheduled for today</small>
              </div>

              {filterList(arrivals).length === 0 ? (
                <p className="text-muted text-center py-4 small">No pending arrivals found.</p>
              ) : (
                <div className="list-group">
                  {filterList(arrivals).map(b => (
                    <div key={b.bookingID} id={`arrival-booking-${b.bookingID}`} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3 mb-2 border rounded">
                      <div>
                        <div className="fw-bold text-dark">
                          {b.firstName} {b.lastName} <span className="badge bg-secondary font-monospace text-white ms-1" style={{ fontSize: '0.7rem' }}>User ID: #{b.userID || b.guestID}</span>
                        </div>
                        <small className="text-muted d-block">Room: <strong>{b.roomNumber}</strong> ({b.roomType})</small>
                        <small className="text-muted d-block">
                          Schedule: {new Date(b.checkInDateTime).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                          {new Date(b.checkInDateTime) < new Date() && (
                            <span className="badge bg-warning text-dark ms-2" style={{ fontSize: '0.7rem' }}>Overdue Check-In</span>
                          )}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-success text-white fw-bold d-inline-flex align-items-center gap-1"
                        data-bs-toggle="tooltip"
                        data-bs-placement="top"
                        title="Process Check In"
                        aria-label="Process Check In"
                        onClick={() => handleCheckIn(b.bookingID, b.firstName + ' ' + b.lastName)}
                        disabled={processingCheckInId === b.bookingID}
                      >
                        {processingCheckInId === b.bookingID ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                            Processing...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-right-to-bracket"></i> Check In
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* In-House Guests (Check-Out) */}
            <div className="col-lg-6">
              <div className="p-3 rounded mb-3 text-white" style={{ backgroundColor: '#2b5e52' }}>
                <h5 className="mb-0 fw-bold">In-House Guests (Check-Out)</h5>
                <small className="opacity-75">Guests currently checked into rooms</small>
              </div>

              {filterList(departures).length === 0 ? (
                <p className="text-muted text-center py-4 small">No checked-in guests found.</p>
              ) : (
                <div className="list-group">
                  {filterList(departures).map(b => {
                    const isTargetStay = highlightBookingID && String(highlightBookingID) === String(b.bookingID);
                    const isCheckoutActionRequired = ['Pending Room Verification', 'Pending Checkout', 'Checkout Requested'].includes(b.status);

                    return (
                      <div key={b.bookingID} id={`departure-booking-${b.bookingID}`} className={`list-group-item list-group-item-action p-3 mb-2 border rounded transition-all ${isTargetStay ? 'stay-highlight-pulse' : ''}`}>
                        {isCheckoutActionRequired && (
                          <div className="mb-2">
                            <span className="badge bg-warning text-dark border border-warning-subtle py-1 px-2 fw-bold d-inline-flex align-items-center gap-1">
                              <i className="fa-solid fa-bell animate__animated animate__swing animate__infinite"></i>
                              Action Required: Guest Requested Checkout
                            </span>
                          </div>
                        )}
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <div className="fw-bold text-dark">
                              {b.firstName} {b.lastName} <span className="badge bg-secondary font-monospace text-white ms-1" style={{ fontSize: '0.7rem' }}>User ID: #{b.userID || b.guestID}</span>
                            </div>
                            <small className="text-muted d-block">Room: <strong>{b.roomNumber}</strong> ({b.roomType}) • Stay #{b.bookingID}</small>
                            <small className="text-muted d-block">Check-out Schedule: {new Date(b.checkOutDateTime).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</small>
                            <small className="d-block mt-1">
                              Remaining Balance: <strong className={b.remainingBalance > 0 ? "text-danger" : "text-success"}>₱{parseFloat(b.remainingBalance || 0).toFixed(2)}</strong>
                            </small>
                          </div>
                          <span className={`booking-status-pill ${getStatusBadgeClass(b.status)}`}>
                            {b.status === 'Room Verified' ? 'Pending Bill' : b.status}
                          </span>
                        </div>

                      {/* WORKFLOW ACTION BUTTONS */}
                      <div className="d-flex flex-wrap align-items-center gap-2 mt-2 pt-2 border-top">
                        {(b.status === 'Pending Room Verification' || b.status === 'Pending Checkout' || b.status === 'Checkout Requested') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-warning text-dark fw-bold d-inline-flex align-items-center gap-1 shadow-xs"
                            onClick={() => handleVerifyRoom(b.bookingID, b.roomNumber, b.firstName + ' ' + b.lastName)}
                            aria-label="Inspect Room Condition"
                          >
                            <i className="fa-solid fa-clipboard-check"></i> Inspect Room
                          </button>
                        )}

                        {(b.status === 'Final Billing Updated' || b.status === 'Bill Finalized') && (
                          <a
                            href={`/receptionist/payments?bookingID=${b.bookingID}`}
                            className="btn btn-sm btn-success text-white fw-bold d-inline-flex align-items-center gap-1"
                            title="Settle Outstanding Balance"
                          >
                            <i className="fa-solid fa-cash-register"></i> Settle Bill
                          </a>
                        )}

                        {(b.status === 'Payment Completed' || b.status === 'Paid') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-success fw-bold d-inline-flex align-items-center gap-1"
                            onClick={() => handleCheckOut(b.bookingID, b.firstName + ' ' + b.lastName)}
                          >
                            <i className="fa-solid fa-right-from-bracket"></i> Complete Check-Out
                          </button>
                        )}

                        {(b.status === 'Checked In' || b.status === 'Active Stay') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger fw-bold d-inline-flex align-items-center gap-1"
                            onClick={() => handleCheckOut(b.bookingID, b.firstName + ' ' + b.lastName)}
                          >
                            <i className="fa-solid fa-right-from-bracket"></i> Check Out
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 ms-auto"
                          title="Update Check-Out Date & Time"
                          onClick={() => handleOpenUpdateModal(b)}
                        >
                          <i className="fa-solid fa-clock-rotate-left"></i>
                        </button>

                        <a
                          href={`/receptionist/billing?bookingID=${b.bookingID}`}
                          className={`btn btn-sm ${(b.status === 'Room Verified' || b.status === 'Pending Bill') ? 'btn-primary text-white fw-bold shadow-sm' : 'btn-outline-primary'} d-inline-flex align-items-center gap-1`}
                          title="View Full Billing Ledger"
                        >
                          <i className="fa-solid fa-file-invoice-dollar"></i> Billing Ledger
                        </a>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          </div>
      </div>

      {/* UPDATE CHECK-OUT DATE & TIME MODAL */}
      {updateModal.isOpen && updateModal.booking && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1080 }}>
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-bottom px-4 py-3">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="fa-solid fa-clock-rotate-left text-primary"></i> Update Check-Out Date &amp; Time
                </h5>
                <button type="button" className="btn-close" onClick={() => setUpdateModal({ isOpen: false, booking: null, newCheckOut: '' })}></button>
              </div>
              <div className="modal-body p-3 p-md-4">
                <div className="row g-4">
                  <div className="col-lg-5 col-md-12 d-flex flex-column justify-content-between">
                    <div>
                      <div className="alert alert-info py-2.5 px-3 small mb-3 border-info-subtle shadow-xs" style={{ borderRadius: '10px' }}>
                        <div className="fw-bold text-dark mb-1" style={{ fontSize: '0.92rem' }}>
                          <i className="fa-solid fa-user me-1 text-primary"></i>
                          {updateModal.booking.firstName} {updateModal.booking.lastName}
                          <span className="text-muted ms-1 fw-normal">(User ID: #{updateModal.booking.userID || updateModal.booking.guestID})</span>
                        </div>
                        <div className="d-flex align-items-center gap-2 text-muted">
                          <span><i className="fa-solid fa-door-closed me-1"></i>Room <strong>{updateModal.booking.roomNumber}</strong> ({updateModal.booking.roomType})</span>
                        </div>
                      </div>

                      <div className="card border-0 bg-light p-3 mb-3 rounded-3">
                        <div className="d-flex justify-content-between mb-2 small">
                          <span className="text-muted">Current Check-In:</span>
                          <strong className="text-dark">
                            {updateModal.booking.checkInDateTime ? new Date(updateModal.booking.checkInDateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
                          </strong>
                        </div>
                        <div className="d-flex justify-content-between small">
                          <span className="text-muted">Current Check-Out:</span>
                          <strong className="text-dark">
                            {updateModal.booking.checkOutDateTime ? new Date(updateModal.booking.checkOutDateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
                          </strong>
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="form-label fw-bold text-dark small">New Check-Out Date &amp; Time *</label>
                        <input
                          type="datetime-local"
                          className="form-control form-control-lg fw-semibold"
                          value={updateModal.newCheckOut}
                          onChange={(e) => setUpdateModal(prev => ({ ...prev, newCheckOut: e.target.value }))}
                          required
                        />
                        <small className="text-muted d-block mt-1">
                          Adjust the date or time. The calendar on the right displays real-time room availability to help prevent double bookings.
                        </small>
                      </div>

                      {(() => {
                        if (!updateModal.newCheckOut || !updateModal.booking?.checkInDateTime) return null;
                        const inD = new Date(String(updateModal.booking.checkInDateTime).replace(' ', 'T'));
                        const outD = new Date(String(updateModal.newCheckOut).replace(' ', 'T'));
                        if (isNaN(inD) || isNaN(outD)) return null;
                        const diffMs = outD - inD;
                        if (diffMs <= 0) {
                          return (
                            <div className="alert alert-danger py-2 small mb-0">
                              <i className="fa-solid fa-triangle-exclamation me-1"></i>
                              Check-out date &amp; time must be after check-in date &amp; time.
                            </div>
                          );
                        }
                        const totalHours = Math.round(diffMs / (1000 * 60 * 60));
                        const totalNights = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
                        return (
                          <div className="p-2.5 bg-primary-subtle border border-primary-subtle rounded-2 small text-primary fw-semibold">
                            <i className="fa-solid fa-calendar-days me-1"></i>
                            Stay Duration: {totalNights} Night(s) (~{totalHours} Total Hours)
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="col-lg-7 col-md-12">
                    <div className="border rounded-3 p-3 bg-white shadow-xs">
                      <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                        <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-1.5">
                          <i className="fa-solid fa-calendar-check text-primary"></i>
                          <span>Real-Time Room Calendar</span>
                        </h6>
                        <span className="badge bg-light text-muted border">
                          Room {updateModal.booking.roomNumber}
                        </span>
                      </div>
                      <ReservationCalendar
                        schedules={roomSchedules}
                        selectedRoomId={updateModal.booking.roomID}
                        selectedRoom={rooms.find(r => r.roomID === updateModal.booking.roomID)}
                        checkInDate={updateModal.booking.checkInDateTime}
                        checkOutDate={updateModal.newCheckOut}
                        title={`Room ${updateModal.booking.roomNumber} Availability & Schedules`}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-top px-4 py-3 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary text-white" onClick={() => setUpdateModal({ isOpen: false, booking: null, newCheckOut: '' })}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary fw-bold text-white px-4" onClick={handleSaveUpdateCheckOut}>
                  <i className="fa-solid fa-save me-1"></i> Save Check-Out Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      <ModalDialog
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
      />

      <style jsx global>{`
        @keyframes stayHighlightPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
            border-color: #f59e0b !important;
          }
          50% {
            box-shadow: 0 0 0 12px rgba(245, 158, 11, 0.25);
            border-color: #d97706 !important;
            background-color: #fffbeb !important;
          }
          100% {
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
            border-color: #f59e0b !important;
          }
        }
        .stay-highlight-pulse {
          animation: stayHighlightPulse 2s ease-in-out infinite;
          border: 2px solid #f59e0b !important;
          position: relative;
          z-index: 10;
        }
      `}</style>
    </div>
  );
}

export default function ReceptionistCheckIn() {
  return (
    <Suspense fallback={null}>
      <CheckInClient />
    </Suspense>
  );
}
