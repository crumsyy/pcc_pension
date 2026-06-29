'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ModalDialog from '../../components/ModalDialog';

export default function ReceptionistReservations() {
  const [reservations, setReservations] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'convert' | null
  const [selectedRes, setSelectedRes] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    guestID: '',
    roomID: '',
    reservationDateTime: '',
  });

  const [convertData, setConvertData] = useState({
    checkInDateTime: '',
    checkOutDateTime: '',
    status: 'Checked In'
  });

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
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    showConfirm('Create Reservation', 'Are you sure you want to create this reservation?', async () => {
      try {
        const res = await fetch('/api/receptionist/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            ...formData
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
    // Default dates: checkin today, checkout tomorrow
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const formatDateTimeLocal = (date) => {
      const pad = (num) => String(num).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T14:00`;
    };

    const formatDateTimeLocalOut = (date) => {
      const pad = (num) => String(num).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T12:00`;
    };

    setConvertData({
      checkInDateTime: formatDateTimeLocal(today),
      checkOutDateTime: formatDateTimeLocalOut(tomorrow),
      status: 'Checked In'
    });
    setActiveModal('convert');
  };

  const handleConvertSubmit = async (e) => {
    e.preventDefault();
    showConfirm('Convert to Booking', 'Convert this reservation into an active booking?', async () => {
      try {
        const res = await fetch('/api/receptionist/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'convert_to_booking',
            reservationID: selectedRes.reservationID,
            checkInDateTime: convertData.checkInDateTime.replace('T', ' ') + ':00',
            checkOutDateTime: convertData.checkOutDateTime.replace('T', ' ') + ':00',
            status: convertData.status
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to convert reservation');

        showAlert('success', 'Success', 'Reservation successfully converted to Booking.');
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
      case 'Canceled': return 'text-bg-danger';
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
                      <div className="fw-semibold text-dark">{r.firstName} {r.lastName}</div>
                      <small className="text-muted">{r.contact}</small>
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">Room {r.roomNumber}</div>
                      <small className="text-muted">{r.roomType}</small>
                    </td>
                    <td>{new Date(r.reservationDateTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(r.status)}`}>{r.status}</span>
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-1">
                        {r.status === 'Pending' && (
                          <button className="btn btn-sm btn-pcc-primary text-white" onClick={() => handleConfirm(r.reservationID)}>
                            Confirm
                          </button>
                        )}
                        {r.status === 'Confirmed' && (
                          <button className="btn btn-sm btn-success text-white" onClick={() => openConvertModal(r)}>
                            Convert to Booking
                          </button>
                        )}
                        {r.status !== 'Canceled' && (
                          <button className="btn btn-sm btn-outline-danger" onClick={() => handleCancel(r.reservationID)}>
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
                <h5 className="modal-title">New Reservation</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCreateSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Guest *</label>
                    <select name="guestID" className="form-select" required value={formData.guestID} onChange={handleInputChange}>
                      <option value="" disabled>Select Guest</option>
                      {guests.map(g => (
                        <option key={g.guestID} value={g.guestID}>{g.lastName}, {g.firstName} ({g.contact})</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Room *</label>
                    <select name="roomID" className="form-select" required value={formData.roomID} onChange={handleInputChange}>
                      <option value="" disabled>Select Room</option>
                      {rooms.map(rm => (
                        <option key={rm.roomID} value={rm.roomID}>Room {rm.roomNumber} - {rm.roomType} ({rm.status})</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Reservation Date & Time *</label>
                    <input
                      type="datetime-local"
                      name="reservationDateTime"
                      className="form-control"
                      required
                      value={formData.reservationDateTime}
                      onChange={handleInputChange}
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
      {activeModal === 'convert' && selectedRes && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Convert Reservation to Booking</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleConvertSubmit}>
                <div className="modal-body">
                  <p className="small text-muted mb-3">
                    Converting reservation for <strong>{selectedRes.firstName} {selectedRes.lastName}</strong> in <strong>Room {selectedRes.roomNumber}</strong>.
                  </p>
                  <div className="mb-3">
                    <label className="form-label">Check-In Date & Time *</label>
                    <input
                      type="datetime-local"
                      name="checkInDateTime"
                      className="form-control"
                      required
                      value={convertData.checkInDateTime}
                      onChange={handleConvertChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Check-Out Date & Time *</label>
                    <input
                      type="datetime-local"
                      name="checkOutDateTime"
                      className="form-control"
                      required
                      value={convertData.checkOutDateTime}
                      onChange={handleConvertChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Initial Booking Status *</label>
                    <select name="status" className="form-select" required value={convertData.status} onChange={handleConvertChange}>
                      <option value="Checked In">Checked In (Arrived / Check-in now)</option>
                      <option value="Confirmed">Confirmed (Booked / Check-in later)</option>
                    </select>
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
