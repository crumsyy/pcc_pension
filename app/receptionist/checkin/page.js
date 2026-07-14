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
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        onConfirmCallback();
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
        if (target.status === 'Pending Check-in') {
          handleCheckIn(target.bookingID, target.firstName + ' ' + target.lastName);
        } else if (target.status === 'Checked In') {
          handleCheckOut(target.bookingID, target.firstName + ' ' + target.lastName);
        }
      }
    }
  }, [loading, targetBookingID, bookings]);

  const handleCheckIn = (id, guestName) => {
    showConfirm('Process Check-In', `Check in ${guestName} now?`, async () => {
      try {
        const res = await fetch('/api/receptionist/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'checkin',
            bookingID: id
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to check in');

        showAlert('success', 'Success', `${guestName} checked in successfully.`);
        fetchBookings();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
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

      showConfirm('Process Check-Out', `Check out ${guestName} and release the room?`, async () => {
        try {
          const res = await fetch('/api/receptionist/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'checkout',
              bookingID: id
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to check out');

          showAlert('success', 'Success', `${guestName} checked out successfully.`);
          fetchBookings();
        } catch (err) {
          showAlert('error', 'Error', err.message);
        }
      });
    } catch (err) {
      showAlert('error', 'Error', err.message);
    }
  };

  const arrivals = bookings.filter(b => b.status === 'Pending Check-in');
  const departures = bookings.filter(b => b.status === 'Checked In');

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
                        <div className="fw-bold text-dark">{b.firstName} {b.lastName}</div>
                        <small className="text-muted d-block">Room: <strong>{b.roomNumber}</strong> ({b.roomType})</small>
                        <small className="text-muted d-block">Schedule: {new Date(b.checkInDateTime).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</small>
                      </div>
                      <button className="btn btn-sm btn-pcc-primary text-white" onClick={() => handleCheckIn(b.bookingID, b.firstName + ' ' + b.lastName)}>
                        Check In
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
                    <div key={b.bookingID} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3 mb-2 border rounded">
                      <div>
                        <div className="fw-bold text-dark">{b.firstName} {b.lastName} (Stay #{b.bookingID})</div>
                        <small className="text-muted d-block">Room: <strong>{b.roomNumber}</strong> ({b.roomType})</small>
                        <small className="text-muted d-block">Check-out Schedule: {new Date(b.checkOutDateTime).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</small>
                        <small className="d-block mt-1">
                          Remaining Balance: <strong className={b.remainingBalance > 0 ? "text-danger" : "text-success"}>₱{parseFloat(b.remainingBalance || 0).toFixed(2)}</strong>
                        </small>
                      </div>
                      <div className="d-flex gap-2">
                        <a href={`/receptionist/billing?bookingID=${b.bookingID}`} className="btn btn-sm btn-outline-primary py-1 px-3">
                          View Billing
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
