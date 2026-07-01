'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ModalDialog from '../../components/ModalDialog';

export default function ReceptionistBookings() {
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'create' | null

  // Form states
  const [formData, setFormData] = useState({
    guestID: '',
    roomID: '',
    checkInDateTime: '',
    checkOutDateTime: '',
    status: 'Confirmed'
  });

  const [isWalkIn, setIsWalkIn] = useState(false);
  const [walkInForm, setWalkInForm] = useState({
    firstName: '',
    lastName: '',
    contact: '',
    email: '',
    gender: 'Male'
  });

  const [selectedRoomType, setSelectedRoomType] = useState('');

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
      const res = await fetch('/api/receptionist/bookings');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch bookings');

      setBookings(data.bookings || []);
      setGuests(data.guests || []);
      setRooms(data.rooms || []);
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
    if (activeModal === 'create') {
      const today = new Date();
      today.setHours(14, 0, 0, 0);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);

      const offset = today.getTimezoneOffset();
      const localToday = new Date(today.getTime() - (offset * 60 * 1000)).toISOString().slice(0, 16);
      const localTomorrow = new Date(tomorrow.getTime() - (offset * 60 * 1000)).toISOString().slice(0, 16);

      setFormData({
        guestID: '',
        roomID: '',
        checkInDateTime: localToday,
        checkOutDateTime: localTomorrow,
        status: 'Confirmed'
      });
    } else if (!activeModal) {
      setFormData({
        guestID: '',
        roomID: '',
        checkInDateTime: '',
        checkOutDateTime: '',
        status: 'Confirmed'
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
  }, [activeModal]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    showConfirm('Create Booking', 'Are you sure you want to create this booking?', async () => {
      try {
        const res = await fetch('/api/receptionist/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            isWalkIn,
            ...(isWalkIn ? walkInForm : { guestID: formData.guestID }),
            roomID: formData.roomID,
            checkInDateTime: formData.checkInDateTime.replace('T', ' ') + ':00',
            checkOutDateTime: formData.checkOutDateTime.replace('T', ' ') + ':00',
            status: formData.status
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create booking');

        showAlert('success', 'Success', 'Booking created successfully.');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleCheckIn = (id) => {
    showConfirm('Process Check-In', 'Check in this guest now?', async () => {
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

        showAlert('success', 'Success', 'Guest checked in successfully.');
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleCheckOut = (id) => {
    showConfirm('Process Check-Out', 'Check out this guest now and free up the room?', async () => {
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

        showAlert('success', 'Success', 'Guest checked out successfully.');
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleCancel = (id) => {
    showConfirm('Cancel Booking', 'Are you sure you want to cancel this booking?', async () => {
      try {
        const res = await fetch('/api/receptionist/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'cancel',
            bookingID: id
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to cancel booking');

        showAlert('success', 'Success', 'Booking canceled.');
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Checked In': return 'text-bg-primary';
      case 'Checked Out': return 'text-bg-success';
      case 'Confirmed': return 'text-bg-info';
      case 'Canceled': return 'text-bg-danger';
      case 'Pending': return 'text-bg-warning';
      default: return 'text-bg-secondary';
    }
  };

  const filteredBookings = bookings.filter(b => {
    const fullName = `${b.firstName} ${b.lastName}`.toLowerCase();
    const room = b.roomNumber.toLowerCase();
    const query = search.toLowerCase();
    const matchesSearch = fullName.includes(query) || room.includes(query);
    const matchesStatus = statusFilter ? b.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <div className="section-eyebrow">Receptionist</div>
          <h2 className="section-title mb-0">Bookings & Lodging Log</h2>
        </div>
        <button className="btn btn-pcc-primary text-white" onClick={() => {
          const today = new Date();
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const formatDateTimeLocal = (date, hour) => {
            const pad = (num) => String(num).padStart(2, '0');
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${hour}`;
          };

          setFormData({
            guestID: guests[0]?.guestID || '',
            roomID: rooms[0]?.roomID || '',
            checkInDateTime: formatDateTimeLocal(today, '14:00'),
            checkOutDateTime: formatDateTimeLocal(tomorrow, '12:00'),
            status: 'Confirmed'
          });
          setActiveModal('create');
        }}>
          + Create Booking
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
              <option value="Confirmed">Confirmed</option>
              <option value="Checked In">Checked In</option>
              <option value="Checked Out">Checked Out</option>
              <option value="Canceled">Canceled</option>
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
            <p className="text-muted mt-2">Loading bookings...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-5 text-muted">No bookings found matching the filters.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: "0.9rem" }}>
              <thead>
                <tr className="table-light">
                  <th>Guest Name</th>
                  <th>Room</th>
                  <th>Check-In / Out Schedule</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b) => (
                  <tr key={b.bookingID}>
                    <td>
                      <div className="fw-semibold text-dark">{b.firstName} {b.lastName}</div>
                      <small className="text-muted">{b.contact}</small>
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">Room {b.roomNumber}</div>
                      <small className="text-muted">{b.roomType}</small>
                    </td>
                    <td>
                      <div className="text-dark" style={{ fontSize: '0.85rem' }}>
                        In: <strong>{new Date(b.checkInDateTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.82rem' }}>
                        Out: <strong>{new Date(b.checkOutDateTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(b.status)}`}>{b.status}</span>
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-1">
                        {b.status === 'Confirmed' && (
                          <button className="btn btn-sm btn-pcc-primary text-white" onClick={() => handleCheckIn(b.bookingID)}>
                            Check In
                          </button>
                        )}
                        {b.status === 'Checked In' && (
                          <button className="btn btn-sm btn-success text-white" onClick={() => handleCheckOut(b.bookingID)}>
                            Check Out
                          </button>
                        )}
                        {(b.status === 'Confirmed' || b.status === 'Pending') && (
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleCancel(b.bookingID)}>
                            Cancel
                          </button>
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
                <h5 className="modal-title">New Lodging Booking</h5>
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
                      <select name="guestID" className="form-select" required={!isWalkIn} value={formData.guestID} onChange={handleInputChange}>
                        <option value="" disabled>Select Guest</option>
                        {guests.map(g => (
                          <option key={g.guestID} value={g.guestID}>{g.lastName}, {g.firstName} ({g.contact})</option>
                        ))}
                      </select>
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
                          onChange={(e) => setWalkInForm(prev => ({ ...prev, contact: e.target.value }))}
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
                    <select 
                      name="roomID" 
                      className="form-select" 
                      required 
                      disabled={!selectedRoomType}
                      value={formData.roomID} 
                      onChange={handleInputChange}
                    >
                      <option value="" disabled>
                        {selectedRoomType ? "Select Room" : "Choose Room Type first"}
                      </option>
                      {rooms
                        .filter(rm => rm.roomType === selectedRoomType && rm.status === 'Available')
                        .map(rm => (
                          <option key={rm.roomID} value={rm.roomID}>Room {rm.roomNumber}</option>
                        ))
                      }
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Check-In DateTime *</label>
                    <input
                      type="datetime-local"
                      name="checkInDateTime"
                      className="form-control"
                      required
                      value={formData.checkInDateTime}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Check-Out DateTime *</label>
                    <input
                      type="datetime-local"
                      name="checkOutDateTime"
                      className="form-control"
                      required
                      value={formData.checkOutDateTime}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Status *</label>
                    <select name="status" className="form-select" required value={formData.status} onChange={handleInputChange}>
                      <option value="Confirmed">Confirmed (Booked / In later)</option>
                      <option value="Checked In">Checked In (Arrived / Check-in now)</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary text-white">Save Booking</button>
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
