'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ModalDialog from '../../components/ModalDialog';
import DateInput, { isValidDate, toDbDate } from '../../components/DateInput';
import SearchableSelect from '../../components/SearchableSelect';

function ReservationsClient() {
  const searchParams = useSearchParams();
  const [reservations, setReservations] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'convert' | null
  const [selectedRes, setSelectedRes] = useState(null);
  const [minDateTime, setMinDateTime] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    guestID: '',
    roomID: '',
    reservationDateTime: '',
  });

  const [resDate, setResDate] = useState('');
  const [resTime, setResTime] = useState('');

  const [isWalkIn, setIsWalkIn] = useState(false);
  const [walkInForm, setWalkInForm] = useState({
    firstName: '',
    lastName: '',
    contact: '',
    email: '',
    gender: 'Male'
  });

  const [selectedRoomType, setSelectedRoomType] = useState('');

  const [convertData, setConvertData] = useState({
    checkInDateTime: '',
    checkOutDateTime: '',
    status: 'Checked In'
  });

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [downPayment, setDownPayment] = useState('');
  const [paymentMethodID, setPaymentMethodID] = useState('1');

  const [convInDate, setConvInDate] = useState('');
  const [convInTime, setConvInTime] = useState('');
  const [convOutDate, setConvOutDate] = useState('');
  const [convOutTime, setConvOutTime] = useState('12:00');

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/receptionist/reservations');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch reservations');

      setReservations(data.reservations || []);
      setGuests(data.guests || []);
      setRooms(data.rooms || []);
      setPaymentMethods(data.paymentMethods || []);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!loading && searchParams.get('action') === 'new') {
      const qCheckIn = searchParams.get('checkIn');
      const qRoomID = searchParams.get('roomID');
      const qFirstName = searchParams.get('firstName');
      const qLastName = searchParams.get('lastName');
      const qEmail = searchParams.get('email');
      const qContact = searchParams.get('contact');

      if (qCheckIn) {
        const formatParamDate = (dStr) => {
          const parts = dStr.split('-');
          if (parts.length === 3) {
            return `${parts[1]}/${parts[2]}/${parts[0]}`;
          }
          return '';
        };

        setResDate(formatParamDate(qCheckIn));
        setResTime("14:00");
        setIsWalkIn(true);
        setWalkInForm({
          firstName: qFirstName || '',
          lastName: qLastName || '',
          email: qEmail || '',
          contact: qContact || '',
          gender: 'Male'
        });
        setFormData({
          guestID: '',
          roomID: qRoomID || ''
        });
        setActiveModal('create');
      }
    }
  }, [loading, searchParams]);

  useEffect(() => {
    if (activeModal === 'create') {
      const today = new Date();
      const pad = (num) => String(num).padStart(2, '0');
      const todayDateStr = `${pad(today.getMonth() + 1)}/${pad(today.getDate())}/${today.getFullYear()}`;
      const timeStr = `${pad(today.getHours())}:${pad(today.getMinutes())}`;

      setResDate(todayDateStr);
      setResTime(timeStr);

      setFormData({
        guestID: guests[0]?.guestID || '',
        roomID: '',
      });
    } else if (!activeModal) {
      setResDate('');
      setResTime('');
      setFormData({
        guestID: '',
        roomID: '',
      });
      setIsWalkIn(false);
      setWalkInForm({
        firstName: '',
        lastName: '',
        contact: '',
        email: '',
        gender: 'Male'
      });
      setSelectedRoomType('');
    }
  }, [activeModal, guests]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleConvertChange = (e) => {
    const { name, value } = e.target;
    setConvertData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    if (!isValidDate(resDate)) {
      showAlert('error', 'Validation Error', 'Please enter a valid Reservation Date (MM/DD/YYYY).');
      return;
    }
    if (!resTime) {
      showAlert('error', 'Validation Error', 'Please select a Reservation Time.');
      return;
    }

    const resDateTimeStr = toDbDate(resDate) + 'T' + resTime;
    const resDateObj = new Date(resDateTimeStr);
    const now = new Date();
    now.setMinutes(now.getMinutes() - 5);

    if (resDateObj < now) {
      showAlert('error', 'Validation Error', 'Reservation date and time cannot be in the past.');
      return;
    }

    if (isWalkIn) {
      if (!walkInForm.firstName.trim() || !walkInForm.lastName.trim()) {
        showAlert('error', 'Validation Error', 'First name and Last name are required.');
        return;
      }
      if (!walkInForm.contact || walkInForm.contact.length !== 11) {
        showAlert('error', 'Validation Error', 'Contact number must be exactly 11 digits.');
        return;
      }
    }

    showConfirm('Create Reservation', 'Are you sure you want to create this reservation?', async () => {
      try {
        const res = await fetch('/api/receptionist/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            isWalkIn,
            ...(isWalkIn ? walkInForm : { guestID: formData.guestID }),
            roomID: formData.roomID,
            reservationDateTime: toDbDate(resDate) + ' ' + resTime + ':00'
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create reservation');

        showAlert('success', 'Success', 'Reservation created successfully.');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleConfirm = (id) => {
    showConfirm('Confirm Reservation', 'Mark this reservation as Confirmed?', async () => {
      try {
        const res = await fetch('/api/receptionist/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'confirm',
            reservationID: id
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to confirm reservation');

        showAlert('success', 'Success', 'Reservation confirmed.');
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleCancel = (id) => {
    showConfirm('Cancel Reservation', 'Are you sure you want to cancel this reservation?', async () => {
      try {
        const res = await fetch('/api/receptionist/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'cancel',
            reservationID: id
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to cancel reservation');

        showAlert('success', 'Success', 'Reservation canceled.');
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const openConvertModal = (res) => {
    setSelectedRes(res);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const pad = (num) => String(num).padStart(2, '0');
    const todayStr = `${pad(today.getMonth() + 1)}/${pad(today.getDate())}/${today.getFullYear()}`;
    const tomorrowStr = `${pad(tomorrow.getMonth() + 1)}/${pad(tomorrow.getDate())}/${tomorrow.getFullYear()}`;

    setConvInDate(todayStr);
    setConvInTime("14:00");
    setConvOutDate(tomorrowStr);
    setConvOutTime("12:00");

    const rate = parseFloat(res.rate || 0);
    setDownPayment((rate * 0.5).toFixed(2));
    setPaymentMethodID('1');

    setConvertData({
      status: 'Pending Check-in'
    });
    setActiveModal('convert');
  };

  const handleConvertSubmit = async (e) => {
    e.preventDefault();

    if (!isValidDate(convInDate)) {
      showAlert('error', 'Validation Error', 'Please enter a valid Check-In Date (MM/DD/YYYY).');
      return;
    }
    if (!isValidDate(convOutDate)) {
      showAlert('error', 'Validation Error', 'Please enter a valid Check-Out Date (MM/DD/YYYY).');
      return;
    }
    if (!convInTime) {
      showAlert('error', 'Validation Error', 'Please select a Check-In Time.');
      return;
    }
    if (!convOutTime) {
      showAlert('error', 'Validation Error', 'Please select a Check-Out Time.');
      return;
    }

    const checkInStr = toDbDate(convInDate) + 'T' + convInTime;
    const checkOutStr = toDbDate(convOutDate) + 'T' + convOutTime;
    const checkIn = new Date(checkInStr);
    const checkOut = new Date(checkOutStr);

    if (checkOut <= checkIn) {
      showAlert('error', 'Validation Error', 'Check-out date and time must be after check-in date and time.');
      return;
    }

    const dpAmount = parseFloat(downPayment);
    if (isNaN(dpAmount) || dpAmount <= 0) {
      showAlert('error', 'Validation Error', 'Please enter a valid down payment amount.');
      return;
    }

    showConfirm('Confirm Reservation & Create Booking', 'Confirm this reservation and record down payment?', async () => {
      try {
        const res = await fetch('/api/receptionist/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'confirm',
            reservationID: selectedRes.reservationID,
            checkInDateTime: toDbDate(convInDate) + ' ' + convInTime + ':00',
            checkOutDateTime: toDbDate(convOutDate) + ' ' + convOutTime + ':00',
            downPaymentAmount: dpAmount,
            paymentMethodID: parseInt(paymentMethodID)
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to confirm reservation');

        showAlert('success', 'Success', 'Reservation confirmed and booking created with down payment.');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Confirmed': return 'text-bg-success';
      case 'Pending': return 'text-bg-warning';
      case 'Cancelled': return 'text-bg-danger';
      case 'Expired': return 'text-bg-secondary';
      default: return 'text-bg-secondary';
    }
  };

  const filteredReservations = reservations.filter(r => {
    const fullName = `${r.firstName} ${r.lastName}`.toLowerCase();
    const room = r.roomNumber.toLowerCase();
    const query = search.toLowerCase();
    const matchesSearch = fullName.includes(query) || room.includes(query);
    const matchesStatus = statusFilter ? r.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <div className="section-eyebrow">Receptionist</div>
          <h2 className="section-title mb-0">Reservations Management</h2>
        </div>
        <button className="btn btn-pcc-primary text-white" onClick={() => {
          setFormData({
            guestID: guests[0]?.guestID || '',
            roomID: rooms[0]?.roomID || '',
            reservationDateTime: new Date().toISOString().substring(0, 16),
          });
          setActiveModal('create');
        }}>
          + Create Reservation
        </button>
      </div>

      <div className="card-module p-4 mb-4" style={{ backgroundColor: "#fff", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        {/* Filters */}
        <div className="row g-3 mb-4">
          <div className="col-md-6">
            <input
              type="text"
              placeholder="Search by guest name or room number..."
              className="form-control"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-md-4">
            <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
          <div className="col-md-2">
            <button className="btn btn-secondary w-100 text-white" onClick={() => { setSearch(''); setStatusFilter(''); }}>
              Clear
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted mt-2">Loading reservations...</p>
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="text-center py-5 text-muted">No reservations found matching the filters.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: "0.9rem" }}>
              <thead>
                <tr className="table-light">
                  <th>Guest Name</th>
                  <th>Room</th>
                  <th>Reservation Date & Time</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReservations.map((r) => (
                  <tr key={r.reservationID}>
                    <td>
                      <div className="fw-semibold text-dark">
                        {r.middleName ? `${r.firstName} ${r.middleName.charAt(0).toUpperCase()}. ${r.lastName}` : `${r.firstName} ${r.lastName}`}
                      </div>
                      <small className="text-muted">{r.contact}</small>
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">Room {r.roomNumber}</div>
                      <small className="text-muted">{r.roomType}</small>
                    </td>
                    <td>{new Date(r.reservationDateTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td>
                      {r.bookingID ? (
                        <span className="badge bg-success text-white">Booked</span>
                      ) : (
                        <span className={`badge ${getStatusBadge(r.status)}`}>{r.status}</span>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-1">
                        {!r.bookingID && r.status === 'Pending' && (
                          <button className="btn btn-sm btn-pcc-primary text-white" onClick={() => openConvertModal(r)}>
                            Confirm & Book
                          </button>
                        )}
                        {!r.bookingID && r.status !== 'Cancelled' && r.status !== 'Expired' && (
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleCancel(r.reservationID)}>
                            Cancel
                          </button>
                        )}
                        {r.bookingID && (
                          <span className="text-muted small italic">✓ Converted to Booking</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {activeModal === 'create' && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">New Reservation</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCreateSubmit}>
                <div className="modal-body">
                  <div className="form-check form-switch mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="walkInToggle"
                      checked={isWalkIn}
                      onChange={(e) => setIsWalkIn(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="walkInToggle">
                      Walk-In Guest (No Account / Quick Book)
                    </label>
                  </div>

                  {!isWalkIn ? (
                    <div className="mb-3">
                      <label className="form-label">Guest *</label>
                      <SearchableSelect
                        options={guests.map(g => ({
                          value: String(g.guestID),
                          label: `${g.lastName}, ${g.firstName} (${g.contact})`
                        }))}
                        value={formData.guestID}
                        onChange={(val) => setFormData(prev => ({ ...prev, guestID: val }))}
                        placeholder="Type to search guest..."
                        disabled={isWalkIn}
                      />
                    </div>
                  ) : (
                    <div className="p-3 mb-3 border rounded bg-light">
                      <h6 className="mb-3 text-pcc-primary fw-bold">Walk-In Guest Details</h6>
                      <div className="row g-2">
                        <div className="col-md-6 mb-2">
                          <label className="form-label">First Name *</label>
                          <input
                            type="text"
                            className="form-control"
                            required={isWalkIn}
                            value={walkInForm.firstName}
                            onChange={(e) => setWalkInForm(prev => ({ ...prev, firstName: e.target.value }))}
                          />
                        </div>
                        <div className="col-md-6 mb-2">
                          <label className="form-label">Last Name *</label>
                          <input
                            type="text"
                            className="form-control"
                            required={isWalkIn}
                            value={walkInForm.lastName}
                            onChange={(e) => setWalkInForm(prev => ({ ...prev, lastName: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="mb-2">
                        <label className="form-label">Contact Number</label>
                        <input
                          type="text"
                          className="form-control"
                          value={walkInForm.contact}
                          onChange={(e) => {
                            const sanitized = e.target.value.replace(/[^0-9]/g, "").slice(0, 11);
                            setWalkInForm(prev => ({ ...prev, contact: sanitized }));
                          }}
                        />
                      </div>
                      <div className="mb-2">
                        <label className="form-label">Email (Optional)</label>
                        <input
                          type="email"
                          className="form-control"
                          value={walkInForm.email}
                          onChange={(e) => setWalkInForm(prev => ({ ...prev, email: e.target.value }))}
                        />
                      </div>
                      <div className="mb-2">
                        <label className="form-label">Gender</label>
                        <select
                          className="form-select"
                          value={walkInForm.gender}
                          onChange={(e) => setWalkInForm(prev => ({ ...prev, gender: e.target.value }))}
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {/* Room Type and Room filtering */}
                  <div className="mb-3">
                    <label className="form-label">Room Type *</label>
                    <select
                      className="form-select"
                      required
                      value={selectedRoomType}
                      onChange={(e) => {
                        setSelectedRoomType(e.target.value);
                        setFormData(prev => ({ ...prev, roomID: '' }));
                      }}
                    >
                      <option value="" disabled>Select Room Type</option>
                      {[...new Set(rooms.map(rm => rm.roomType))].map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Room *</label>
                    <SearchableSelect
                      options={rooms
                        .filter(rm => rm.roomType === selectedRoomType && rm.status === 'Available')
                        .map(rm => ({
                          value: String(rm.roomID),
                          label: `Room ${rm.roomNumber}`
                        }))
                      }
                      value={formData.roomID}
                      onChange={(val) => setFormData(prev => ({ ...prev, roomID: val }))}
                      placeholder={selectedRoomType ? "Type to search room..." : "Choose Room Type first"}
                      disabled={!selectedRoomType}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Reservation Date *</label>
                    <DateInput
                      value={resDate}
                      onChange={(e) => setResDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Reservation Time *</label>
                    <input
                      type="time"
                      className="form-control"
                      value={resTime}
                      onChange={(e) => setResTime(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary text-white">Save Reservation</button>
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CONVERT MODAL */}
      {activeModal === 'convert' && selectedRes && (() => {
        const rate = parseFloat(selectedRes.rate || 0);
        let nights = 0;
        if (convInDate && convOutDate && convInTime && convOutTime) {
          const checkInStr = toDbDate(convInDate) + 'T' + convInTime;
          const checkOutStr = toDbDate(convOutDate) + 'T' + convOutTime;
          const inDate = new Date(checkInStr);
          const outDate = new Date(checkOutStr);
          if (outDate > inDate) {
            const diffTime = Math.abs(outDate - inDate);
            nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
        }
        const totalRoomCharge = rate * nights;
        const requiredDownPayment = totalRoomCharge * 0.5;

        return (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered modal-md">
              <div className="modal-content">
                <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                  <h5 className="modal-title">Confirm Reservation & Book</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
                </div>
                <form onSubmit={handleConvertSubmit}>
                  <div className="modal-body">
                    <p className="small text-muted mb-3">
                      Confirming reservation for <strong>{selectedRes.firstName} {selectedRes.lastName}</strong> in <strong>Room {selectedRes.roomNumber}</strong>.
                    </p>
                    <div className="row g-2 mb-3">
                      <div className="col-md-6">
                        <label className="form-label small fw-bold">Check-In Date *</label>
                        <DateInput
                          value={convInDate}
                          onChange={(e) => setConvInDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-bold">Check-In Time *</label>
                        <input
                          type="time"
                          className="form-control form-control-sm"
                          value={convInTime}
                          onChange={(e) => setConvInTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="row g-2 mb-3">
                      <div className="col-md-6">
                        <label className="form-label small fw-bold">Check-Out Date *</label>
                        <DateInput
                          value={convOutDate}
                          onChange={(e) => setConvOutDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-bold">Check-Out Time *</label>
                        <input
                          type="time"
                          className="form-control form-control-sm"
                          value={convOutTime}
                          onChange={(e) => setConvOutTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-light rounded border mb-3">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="small text-muted">Room Base Rate:</span>
                        <span className="small fw-semibold">₱{rate.toFixed(2)}/night</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="small text-muted">Stay Nights:</span>
                        <span className="small fw-semibold">{nights} Night(s)</span>
                      </div>
                      <div className="d-flex justify-content-between border-top pt-1 mb-1">
                        <span className="small fw-bold">Total Room Rent:</span>
                        <span className="small fw-bold">₱{totalRoomCharge.toFixed(2)}</span>
                      </div>
                      <div className="d-flex justify-content-between text-success">
                        <span className="small fw-bold">Required Down Payment (50%):</span>
                        <span className="small fw-bold">₱{requiredDownPayment.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-bold">Payment Method *</label>
                      <select
                        className="form-select form-select-sm"
                        required
                        value={paymentMethodID}
                        onChange={(e) => setPaymentMethodID(e.target.value)}
                      >
                        {paymentMethods.map(pm => (
                          <option key={pm.paymentMethodID} value={pm.paymentMethodID}>
                            {pm.paymentMethod}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-bold">Down Payment Received (₱) *</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control form-control-sm fw-bold text-success"
                        required
                        value={downPayment}
                        onChange={(e) => setDownPayment(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="submit" className="btn btn-pcc-primary text-white">Process Booking</button>
                    <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirmation & Alert dialog */}
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

export default function ReceptionistReservations() {
  return (
    <Suspense fallback={
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted mt-2">Loading reservations...</p>
      </div>
    }>
      <ReservationsClient />
    </Suspense>
  );
}
