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
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'cancel_reason' | 'manage_guests' | null
  const [cancellingBookingID, setCancellingBookingID] = useState(null);
  const [cancelRemarks, setCancelRemarks] = useState('');

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
  const [availableDiscounts, setAvailableDiscounts] = useState([]);
  const [roomGuests, setRoomGuests] = useState([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
  const [managingBooking, setManagingBooking] = useState(null);
  const [managingGuests, setManagingGuests] = useState([]);

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
      setAvailableDiscounts(data.discounts || []);
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
      setRoomGuests([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
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
      setRoomGuests([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
      setManagingBooking(null);
      setManagingGuests([]);
    }
  }, [activeModal]);

  // Synchronize the first guest's name with the selected primary guest or walk-in input details
  useEffect(() => {
    if (activeModal === 'create') {
      let name = '';
      if (isWalkIn) {
        name = `${walkInForm.firstName} ${walkInForm.lastName}`.trim();
      } else if (formData.guestID) {
        const selected = guests.find(g => g.guestID === parseInt(formData.guestID));
        if (selected) {
          name = `${selected.firstName} ${selected.lastName}`;
        }
      }
      setRoomGuests(prev => {
        const copy = [...prev];
        if (copy.length > 0) {
          copy[0] = { ...copy[0], fullName: name };
        } else {
          copy.push({ fullName: name, age: '', discountID: '', discountIdNumber: '' });
        }
        return copy;
      });
    }
  }, [isWalkIn, walkInForm.firstName, walkInForm.lastName, formData.guestID, guests, activeModal]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddGuest = () => {
    if (!formData.roomID) {
      showAlert('warning', 'Warning', 'Please select a room first.');
      return;
    }
    const selectedRoom = rooms.find(r => r.roomID === parseInt(formData.roomID));
    const limit = selectedRoom ? parseInt(selectedRoom.occupancyLimit) || 4 : 4;

    if (roomGuests.length >= limit) {
      showAlert('warning', 'Warning', `This room has a maximum occupancy limit of ${limit} guest(s).`);
      return;
    }
    setRoomGuests(prev => [...prev, { fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
  };

  const handleRemoveGuest = (index) => {
    setRoomGuests(prev => prev.filter((_, i) => i !== index));
  };

  const handleGuestChange = (index, field, value) => {
    setRoomGuests(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === 'discountID' && !value) {
        copy[index].discountIdNumber = '';
      }
      return copy;
    });
  };

  const handleAddManagingGuest = () => {
    if (managingBooking) {
      const selectedRoom = rooms.find(r => r.roomID === managingBooking.roomID);
      const limit = selectedRoom ? parseInt(selectedRoom.occupancyLimit) || 4 : 4;

      if (managingGuests.length >= limit) {
        showAlert('warning', 'Warning', `This room has a maximum occupancy limit of ${limit} guest(s).`);
        return;
      }
    }
    setManagingGuests(prev => [...prev, { fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
  };

  const handleRemoveManagingGuest = (index) => {
    setManagingGuests(prev => prev.filter((_, i) => i !== index));
  };

  const handleManagingGuestChange = (index, field, value) => {
    setManagingGuests(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === 'discountID' && !value) {
        copy[index].discountIdNumber = '';
      }
      return copy;
    });
  };

  const handleUpdateGuestsSubmit = async (e) => {
    e.preventDefault();
    if (managingBooking) {
      const selectedRoom = rooms.find(r => r.roomID === managingBooking.roomID);
      const limit = selectedRoom ? parseInt(selectedRoom.occupancyLimit) || 4 : 4;
      if (managingGuests.length > limit) {
        showAlert('error', 'Validation Error', `This room exceeds the occupancy limit. Maximum allowed guests: ${limit}.`);
        return;
      }
    }
    for (const g of managingGuests) {
      if (!g.fullName.trim()) {
        showAlert('error', 'Validation Error', 'All registered guests must have a name.');
        return;
      }
      const age = parseInt(g.age);
      if (isNaN(age) || age <= 0) {
        showAlert('error', 'Validation Error', `Please enter a valid age for ${g.fullName}.`);
        return;
      }
      if (g.discountID) {
        if (!g.discountIdNumber || !g.discountIdNumber.trim()) {
          showAlert('error', 'Validation Error', `Discount card ID number is required for ${g.fullName}.`);
          return;
        }
        const disc = availableDiscounts.find(d => d.discountID === parseInt(g.discountID));
        if (disc) {
          const discName = disc.name.toLowerCase();
          if (discName.includes('senior') && age < 60) {
            showAlert('error', 'Validation Error', `Guest ${g.fullName} must be at least 60 years old to qualify for the Senior Citizen discount.`);
            return;
          }
        }
      }
    }

    showConfirm('Update Guest List', 'Save changes to this booking\'s guest list?', async () => {
      try {
        const res = await fetch('/api/receptionist/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_guests',
            bookingID: managingBooking.bookingID,
            guests: managingGuests.map(g => ({
              fullName: g.fullName,
              age: parseInt(g.age),
              discountID: g.discountID ? parseInt(g.discountID) : null,
              discountIdNumber: g.discountIdNumber || null
            }))
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update guests');

        showAlert('success', 'Success', 'Registered guests updated successfully.');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    const selectedRoom = rooms.find(r => r.roomID === parseInt(formData.roomID));
    const limit = selectedRoom ? parseInt(selectedRoom.occupancyLimit) || 4 : 4;
    if (roomGuests.length > limit) {
      showAlert('error', 'Validation Error', `This room exceeds the occupancy limit. Maximum allowed guests: ${limit}.`);
      return;
    }

    // Validate guests list
    for (const g of roomGuests) {
      if (!g.fullName.trim()) {
        showAlert('error', 'Validation Error', 'All registered guests must have a name.');
        return;
      }
      const age = parseInt(g.age);
      if (isNaN(age) || age <= 0) {
        showAlert('error', 'Validation Error', `Please enter a valid age for ${g.fullName}.`);
        return;
      }
      if (g.discountID) {
        if (!g.discountIdNumber || !g.discountIdNumber.trim()) {
          showAlert('error', 'Validation Error', `Discount ID number is required for ${g.fullName}.`);
          return;
        }
        const disc = availableDiscounts.find(d => d.discountID === parseInt(g.discountID));
        if (disc) {
          const discName = disc.name.toLowerCase();
          if (discName.includes('senior') && age < 60) {
            showAlert('error', 'Validation Error', `Guest ${g.fullName} must be at least 60 years old to qualify for the Senior Citizen discount.`);
            return;
          }
        }
      }
    }

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
            status: formData.status,
            guests: roomGuests.map(g => ({
              fullName: g.fullName,
              age: parseInt(g.age),
              discountID: g.discountID ? parseInt(g.discountID) : null,
              discountIdNumber: g.discountIdNumber || null
            }))
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

  const openCancelModal = (id) => {
    setCancellingBookingID(id);
    setCancelRemarks('');
    setActiveModal('cancel_reason');
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancelRemarks.trim()) return;

    try {
      const res = await fetch('/api/receptionist/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          bookingID: cancellingBookingID,
          cancelRemarks: cancelRemarks.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel booking');

      showAlert('success', 'Success', 'Booking canceled and room is now available.');
      setActiveModal(null);
      fetchData();
    } catch (err) {
      showAlert('error', 'Error', err.message);
    }
  };

  const handleRebook = (b) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const formatDateTimeLocal = (date, hour) => {
      const pad = (num) => String(num).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${hour}`;
    };

    if (b.guestID) {
      setIsWalkIn(false);
      setFormData({
        guestID: b.guestID,
        roomID: b.roomID || rooms[0]?.roomID || '',
        checkInDateTime: formatDateTimeLocal(today, '14:00'),
        checkOutDateTime: formatDateTimeLocal(tomorrow, '12:00'),
        status: 'Confirmed'
      });
    } else {
      setIsWalkIn(true);
      setFormData({
        guestID: '',
        roomID: b.roomID || rooms[0]?.roomID || '',
        checkInDateTime: formatDateTimeLocal(today, '14:00'),
        checkOutDateTime: formatDateTimeLocal(tomorrow, '12:00'),
        status: 'Confirmed'
      });
      setWalkInForm({
        firstName: b.firstName || '',
        lastName: b.lastName || '',
        contact: b.contact || '',
        email: b.email || '',
        gender: b.gender || 'Male'
      });
    }
    setActiveModal('create');
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
                      <div className="fw-semibold text-dark">
                        {b.middleName ? `${b.firstName} ${b.middleName.charAt(0).toUpperCase()}. ${b.lastName}` : `${b.firstName} ${b.lastName}`}
                      </div>
                      <div className="d-flex flex-wrap gap-1 mt-1 align-items-center">
                        <small className="text-muted mr-1">{b.contact}</small>
                        <span className="badge bg-secondary text-white" style={{ fontSize: '0.7rem' }}>
                          Pax: {b.registeredGuests?.length || 1}
                        </span>
                        {b.registeredGuests?.some(g => g.discountName?.toLowerCase().includes('senior')) && (
                          <span className="badge bg-warning text-dark" style={{ fontSize: '0.7rem' }}>
                            Senior
                          </span>
                        )}
                        {b.registeredGuests?.some(g => g.discountName?.toLowerCase().includes('pwd')) && (
                          <span className="badge bg-info text-white" style={{ fontSize: '0.7rem' }}>
                            PWD
                          </span>
                        )}
                      </div>
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
                      {b.status === 'Canceled' && b.cancelRemarks && (
                        <div className="text-danger small mt-1" style={{ fontSize: '0.75rem', maxWidth: '160px', fontStyle: 'italic' }}>
                          Reason: {b.cancelRemarks}
                        </div>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-1">
                        {b.status !== 'Canceled' && b.status !== 'Checked Out' && (
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                            setManagingBooking(b);
                            setManagingGuests(b.registeredGuests && b.registeredGuests.length > 0 ? b.registeredGuests.map(rg => ({ ...rg, discountID: rg.discountID || '' })) : [{ fullName: b.firstName + ' ' + b.lastName, age: 30, discountID: '', discountIdNumber: '' }]);
                            setActiveModal('manage_guests');
                          }}>
                            Guests
                          </button>
                        )}
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
                          <button className="btn btn-sm btn-outline-danger" onClick={() => openCancelModal(b.bookingID)}>
                            Cancel
                          </button>
                        )}
                        {b.status === 'Canceled' && (
                          <button className="btn btn-sm btn-pcc-outline d-flex align-items-center gap-1" onClick={() => handleRebook(b)}>
                            <span>🔄</span> Rebook
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

                  <div className="p-3 mb-3 border rounded bg-white" style={{ border: '1px solid var(--pcc-mist)' }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="mb-0 text-pcc-primary fw-bold">Registered Guests (Pax)</h6>
                      <button type="button" className="btn btn-sm btn-pcc-outline" onClick={handleAddGuest}>
                        + Add Guest
                      </button>
                    </div>
                    {roomGuests.map((g, idx) => (
                      <div key={idx} className="p-2 mb-2 rounded bg-light border position-relative">
                        <div className="d-flex justify-content-between mb-2">
                          <span className="small text-muted fw-bold">Guest #{idx + 1} {idx === 0 && "(Primary)"}</span>
                          {idx > 0 && (
                            <button type="button" className="btn-close" style={{ fontSize: '0.75rem' }} onClick={() => handleRemoveGuest(idx)}></button>
                          )}
                        </div>
                        <div className="row g-2">
                          <div className="col-8 mb-2">
                            <label className="form-label small mb-1">Full Name *</label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              required
                              value={g.fullName}
                              onChange={(e) => handleGuestChange(idx, 'fullName', e.target.value)}
                            />
                          </div>
                          <div className="col-4 mb-2">
                            <label className="form-label small mb-1">Age *</label>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              required
                              min="1"
                              value={g.age}
                              onChange={(e) => handleGuestChange(idx, 'age', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

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

      {/* CANCEL REASON MODAL */}
      {activeModal === 'cancel_reason' && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">Cancel Booking</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleConfirmCancel}>
                <div className="modal-body">
                  <div className="alert alert-warning d-flex align-items-start gap-2 mb-3" style={{ borderLeft: '4px solid #f0a500' }}>
                    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                    <div>
                      <strong className="d-block text-warning-dark" style={{ fontSize: '0.85rem' }}>PCC Non-Refundable Policy Applies</strong>
                      <span className="small text-muted" style={{ fontSize: '0.78rem' }}>
                        Cancellations are non-refundable under our strict client policy. Please document the mandatory reason for this cancellation below.
                      </span>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>Cancellation Reason *</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      required
                      placeholder="e.g. Guest requested cancellation via phone due to emergency..."
                      value={cancelRemarks}
                      onChange={(e) => setCancelRemarks(e.target.value)}
                      style={{ fontSize: '0.82rem' }}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-danger text-white fw-semibold">Confirm Cancel</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE GUESTS MODAL */}
      {activeModal === 'manage_guests' && managingBooking && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-md">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Registered Room Guests — Room {managingBooking.roomNumber}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleUpdateGuestsSubmit}>
                <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  <div className="alert alert-info py-2 px-3 small mb-3">
                    Specify all registered guests staying in this room. Room rent charges are divided equally among all registered guests, and 20% discounts are applied to qualified Senior and PWD shares.
                  </div>
                  
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="fw-semibold small text-secondary">Guests List ({managingGuests.length} Pax)</span>
                    <button type="button" className="btn btn-sm btn-pcc-outline" onClick={handleAddManagingGuest}>
                      + Add Guest
                    </button>
                  </div>

                  {managingGuests.map((g, idx) => (
                    <div key={idx} className="p-3 mb-2 rounded bg-light border position-relative">
                      <div className="d-flex justify-content-between mb-2 align-items-center">
                        <span className="small text-dark fw-bold">Guest #{idx + 1} {idx === 0 && "(Primary)"}</span>
                        {idx > 0 && (
                          <button type="button" className="btn-close" style={{ fontSize: '0.7rem' }} onClick={() => handleRemoveManagingGuest(idx)}></button>
                        )}
                      </div>
                      <div className="row g-2">
                        <div className="col-8 mb-2">
                          <label className="form-label small mb-1">Full Name *</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            required
                            value={g.fullName}
                            onChange={(e) => handleManagingGuestChange(idx, 'fullName', e.target.value)}
                          />
                        </div>
                        <div className="col-4 mb-2">
                          <label className="form-label small mb-1">Age *</label>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            required
                            min="1"
                            value={g.age}
                            onChange={(e) => handleManagingGuestChange(idx, 'age', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary text-white">Save Changes</button>
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
