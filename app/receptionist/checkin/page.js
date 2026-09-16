'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ModalDialog from '../../components/ModalDialog';

function CheckInClient() {
  const searchParams = useSearchParams();
  const targetBookingID = searchParams.get('bookingID');

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const [finalBillModal, setFinalBillModal] = useState({
    isOpen: false,
    booking: null,
    singleDesc: '',
    singleAmount: ''
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
        return 'bg-info text-white fw-bold';
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
      'Verify Room Condition',
      `Mark Room ${roomNumber} (${guestName}) as verified by staff? This confirms housekeeping/front desk inspection is complete.`,
      async () => {
        try {
          const res = await fetch('/api/receptionist/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify_room', bookingID: id })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to verify room');

          showAlert('success', 'Room Verified', data.message || `Room ${roomNumber} marked as verified.`);
          fetchBookings();
        } catch (err) {
          showAlert('error', 'Error', err.message);
        }
      }
    );
  };

  const handleSaveFinalBill = async (e) => {
    if (e) e.preventDefault();
    if (!finalBillModal.booking) return;

    try {
      const payload = {
        action: 'update_final_billing',
        bookingID: finalBillModal.booking.bookingID,
        incidentals: []
      };
      if (finalBillModal.singleDesc.trim() && parseFloat(finalBillModal.singleAmount) > 0) {
        payload.incidentals.push({
          description: finalBillModal.singleDesc.trim(),
          amount: parseFloat(finalBillModal.singleAmount)
        });
      }
      const res = await fetch('/api/receptionist/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update final billing');

      showAlert('success', 'Final Billing Updated', data.message || 'Billing updated. Guest has been notified.');
      setFinalBillModal({ isOpen: false, booking: null, singleDesc: '', singleAmount: '' });
      fetchBookings();
    } catch (err) {
      showAlert('error', 'Error', err.message);
    }
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
    setModalConfig({
      isOpen: true,
      type,
      title,
      message,
      confirmText: 'OK',
      onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false })),
      onCancel: null
    });
  };

  const showConfirm = (title, message, onConfirmCallback) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        await onConfirmCallback();
      },
      onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/receptionist/bookings');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch bookings');
      setBookings(data.bookings || []);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
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

  const handleCheckIn = (id, guestName) => {
    const performCheckIn = async (isEarlyConfirmed = false) => {
      try {
        const res = await fetch('/api/receptionist/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'checkin',
            bookingID: id,
            confirmEarlyCheckIn: isEarlyConfirmed
          })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to check in');

        if (data.requiresEarlyCheckInConfirmation) {
          showConfirm(
            'Early Check-In Confirmation',
            `Standard check-in time is 2:00 PM. Are you sure you want to proceed with Early Check-In for ${guestName}? An additional early check-in fee of ₱${parseFloat(data.earlyFee).toFixed(2)} (${data.earlyHours} hour(s) @ ₱50/hr) will be automatically added to the guest's bill.`,
            async () => {
              await performCheckIn(true);
            }
          );
          return;
        }

        showAlert('success', 'Success', data.message || `${guestName} checked in successfully.`);
        fetchBookings();
      } catch (err) {
        showAlert('error', 'Error', err.message);
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
      
      const balance = parseFloat(dataBill.chargesSummary?.balance || 0);
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

      showConfirm('Process Check-Out', `Check out ${guestName} and release the room?`, async () => {
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
    'Pending Room Verification',
    'Pending Checkout',
    'Room Verified',
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
    <>
      <div className="mb-4">
        <div className="section-eyebrow">Receptionist</div>
        <h2 className="section-title mb-0">Front Desk (Check-In & Check-Out)</h2>
      </div>

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

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted mt-2">Loading data...</p>
          </div>
        ) : (
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
                    <div key={b.bookingID} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3 mb-2 border rounded">
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
                      >
                        <i className="fa-solid fa-right-to-bracket"></i> Check In
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
                  {filterList(departures).map(b => (
                    <div key={b.bookingID} className="list-group-item list-group-item-action p-3 mb-2 border rounded">
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
                          {b.status}
                        </span>
                      </div>

                      {/* WORKFLOW ACTION BUTTONS */}
                      <div className="d-flex flex-wrap align-items-center gap-2 mt-2 pt-2 border-top">
                        {(b.status === 'Pending Room Verification' || b.status === 'Pending Checkout') && (
                          <button
                            type="button"
                            className="btn btn-sm btn-warning text-dark fw-bold d-inline-flex align-items-center gap-1"
                            onClick={() => handleVerifyRoom(b.bookingID, b.roomNumber, b.firstName + ' ' + b.lastName)}
                            aria-label="Verify Room Condition"
                          >
                            <i className="fa-solid fa-clipboard-check"></i> Verify Room
                          </button>
                        )}

                        {b.status === 'Room Verified' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-info text-white fw-bold d-inline-flex align-items-center gap-1"
                            onClick={() => setFinalBillModal({ isOpen: true, booking: b, singleDesc: '', singleAmount: '' })}
                          >
                            <i className="fa-solid fa-file-invoice-dollar"></i> Add Incidentals &amp; Finalize Bill
                          </button>
                        )}

                        {b.status === 'Final Billing Updated' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary fw-bold d-inline-flex align-items-center gap-1"
                              onClick={() => setFinalBillModal({ isOpen: true, booking: b, singleDesc: '', singleAmount: '' })}
                            >
                              <i className="fa-solid fa-plus"></i> Add Extra Incidentals
                            </button>
                            <a
                              href={`/receptionist/qr-payment?bookingId=${b.bookingID}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-primary text-white fw-bold d-inline-flex align-items-center gap-1"
                              title="Open Guest-Facing QR Payment Tab"
                              aria-label="Show QR Code"
                            >
                              <i className="fa-solid fa-qrcode"></i> Show QR Code
                            </a>
                          </>
                        )}

                        {(b.status === 'Payment Completed' || b.status === 'Checked In' || b.status === 'Active Stay') && (
                          <button
                            type="button"
                            className={`btn btn-sm ${b.status === 'Payment Completed' ? 'btn-success' : 'btn-outline-danger'} fw-bold d-inline-flex align-items-center gap-1`}
                            onClick={() => handleCheckOut(b.bookingID, b.firstName + ' ' + b.lastName)}
                          >
                            <i className="fa-solid fa-right-from-bracket"></i> {b.status === 'Payment Completed' ? 'Complete Check-Out' : 'Check Out'}
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
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                          title="View Full Billing Ledger"
                        >
                          <i className="fa-solid fa-eye"></i> Billing Ledger
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* UPDATE CHECK-OUT DATE & TIME MODAL */}
      {updateModal.isOpen && updateModal.booking && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1080 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-bottom px-4 py-3">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="fa-solid fa-clock-rotate-left text-primary"></i> Update Check-Out Date &amp; Time
                </h5>
                <button type="button" className="btn-close" onClick={() => setUpdateModal({ isOpen: false, booking: null, newCheckOut: '' })}></button>
              </div>
              <div className="modal-body p-4">
                <div className="alert alert-info py-2 small mb-3">
                  <strong>Guest:</strong> {updateModal.booking.firstName} {updateModal.booking.lastName} (User ID: #{updateModal.booking.userID || updateModal.booking.guestID})<br/>
                  <strong>Room:</strong> Room {updateModal.booking.roomNumber} ({updateModal.booking.roomType})
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold text-dark small">New Check-Out Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={updateModal.newCheckOut}
                    onChange={(e) => setUpdateModal(prev => ({ ...prev, newCheckOut: e.target.value }))}
                    required
                  />
                  <small className="text-muted d-block mt-1">Select the new scheduled check-out date and time for this stay.</small>
                </div>
              </div>
              <div className="modal-footer border-top px-4 py-3 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary text-white" onClick={() => setUpdateModal({ isOpen: false, booking: null, newCheckOut: '' })}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary fw-bold text-white" onClick={handleSaveUpdateCheckOut}>
                  Save Check-Out Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INCIDENTAL CHARGES & FINALIZE BILLING MODAL */}
      {finalBillModal.isOpen && finalBillModal.booking && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1080 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '16px' }}>
              <form onSubmit={handleSaveFinalBill}>
                <div className="modal-header border-bottom px-4 py-3 bg-light">
                  <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="fa-solid fa-file-invoice-dollar text-primary"></i> Room Inspection &amp; Final Billing
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setFinalBillModal({ isOpen: false, booking: null, singleDesc: '', singleAmount: '' })}
                  ></button>
                </div>
                <div className="modal-body p-4">
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <div className="card bg-light border-0 p-3 h-100">
                        <span className="text-muted small text-uppercase fw-semibold">Guest &amp; Room Info</span>
                        <div className="fw-bold text-dark fs-5 mt-1">
                          {finalBillModal.booking.firstName} {finalBillModal.booking.lastName}
                        </div>
                        <div className="text-muted small">
                          Room {finalBillModal.booking.roomNumber} ({finalBillModal.booking.roomType})
                        </div>
                        <div className="text-muted small mt-1">
                          Booking ID: #{finalBillModal.booking.bookingID}
                        </div>
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="card bg-primary-subtle border border-primary-subtle p-3 h-100">
                        <span className="text-primary small text-uppercase fw-semibold">Current Balance Due</span>
                        <div className="fw-bold text-primary fs-4 mt-1">
                          ₱{Number(finalBillModal.booking.remainingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-muted small mt-1">
                          Status: <span className={`badge ${getStatusBadgeClass(finalBillModal.booking.status)}`}>{finalBillModal.booking.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Existing Incidental Charges */}
                  {finalBillModal.booking.incidentals && finalBillModal.booking.incidentals.length > 0 && (
                    <div className="mb-4">
                      <label className="form-label fw-bold text-dark small mb-1">Previously Logged Incidentals</label>
                      <div className="table-responsive border rounded">
                        <table className="table table-sm table-striped mb-0 small">
                          <thead className="table-light">
                            <tr>
                              <th>Description</th>
                              <th className="text-muted">Recorded At</th>
                              <th className="text-end">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {finalBillModal.booking.incidentals.map((inc, idx) => (
                              <tr key={idx}>
                                <td>{inc.description}</td>
                                <td className="text-muted">{inc.createdAt}</td>
                                <td className="text-end fw-semibold">₱{Number(inc.amount).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Add Incidental Charge */}
                  <div className="p-3 border rounded bg-white mb-3">
                    <label className="form-label fw-bold text-dark small d-flex align-items-center gap-1 mb-2">
                      <i className="fa-solid fa-plus-circle text-primary"></i> Add New Incidental Charge (Optional)
                    </label>
                    <p className="text-muted small mb-3">
                      Add any charges incurred during stay (minibar, damaged linens/items, extra amenities, laundry). Leave blank if no charges apply.
                    </p>
                    <div className="row g-2">
                      <div className="col-12 col-sm-8">
                        <label className="form-label small text-muted">Description / Reason</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g., Minibar beverages, extra towel, broken glass"
                          value={finalBillModal.singleDesc}
                          onChange={(e) => setFinalBillModal(prev => ({ ...prev, singleDesc: e.target.value }))}
                        />
                      </div>
                      <div className="col-12 col-sm-4">
                        <label className="form-label small text-muted">Amount (₱)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control"
                          placeholder="0.00"
                          value={finalBillModal.singleAmount}
                          onChange={(e) => setFinalBillModal(prev => ({ ...prev, singleAmount: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 mb-0">
                    <i className="fa-solid fa-circle-info text-warning fs-5"></i>
                    <div>
                      Submitting will lock incidental charges, recalculate the final balance, update the booking status to <strong>Final Billing Updated</strong>, and notify the guest on their mobile portal with payment options.
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top px-4 py-3 d-flex justify-content-end gap-2 bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary text-white"
                    onClick={() => setFinalBillModal({ isOpen: false, booking: null, singleDesc: '', singleAmount: '' })}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary fw-bold text-white d-inline-flex align-items-center gap-1">
                    <i className="fa-solid fa-check"></i> Finalize Bill &amp; Notify Guest
                  </button>
                </div>
              </form>
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
    </>
  );
}

export default function ReceptionistCheckIn() {
  return (
    <Suspense fallback={
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted mt-2">Loading check-in desk...</p>
      </div>
    }>
      <CheckInClient />
    </Suspense>
  );
}
