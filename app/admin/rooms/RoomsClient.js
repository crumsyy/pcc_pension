'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';

export default function RoomsClient() {
  const [rooms, setRooms] = useState([]);
  const [floors, setFloors] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [roomRates, setRoomRates] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false); // Active vs Archived rooms

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'edit' | null
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    roomNumber: '',
    floorID: '',
    roomTypeID: '',
    status: 'Available',
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

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search,
        roomTypeID: typeFilter,
        archived: showArchived ? 'true' : 'false'
      }).toString();

      const res = await fetch(`/api/admin/rooms?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch rooms');

      setRooms(data.rooms || []);
      setFloors(data.floors || []);
      setRoomTypes(data.roomTypes || []);
      setRoomRates(data.roomRates || []);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [search, typeFilter, showArchived]);

  const getSelectedRates = (floorID, roomTypeID) => {
    if (!floorID || !roomTypeID) return null;
    const withoutBreakfast = roomRates.find(
      r => r.floorID === parseInt(floorID) && r.roomTypeID === parseInt(roomTypeID) && r.breakfastID === 1
    );
    const withBreakfast = roomRates.find(
      r => r.floorID === parseInt(floorID) && r.roomTypeID === parseInt(roomTypeID) && r.breakfastID === 2
    );
    return {
      withoutBreakfast: withoutBreakfast ? withoutBreakfast.rate : 0,
      withBreakfast: withBreakfast ? withBreakfast.rate : 0
    };
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    showConfirm('Create Room', 'Are you sure you want to create this room?', async () => {
      try {
        const res = await fetch('/api/admin/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            ...formData
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create room');

        showAlert('success', 'Success', data.message || 'Room created successfully');
        setActiveModal(null);
        fetchRooms();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    showConfirm('Update Room', `Save changes to Room ${selectedRoom.roomNumber}?`, async () => {
      try {
        const res = await fetch('/api/admin/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            roomID: selectedRoom.roomID,
            ...formData
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update room');

        showAlert('success', 'Success', data.message || 'Room updated successfully');
        setActiveModal(null);
        fetchRooms();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleArchive = (room) => {
    showConfirm(
      'Archive Room',
      `Are you sure you want to archive Room ${room.roomNumber}? This will hide the room from active listings.`,
      async () => {
        try {
          const res = await fetch('/api/admin/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'delete', // backend 'delete' handles soft-delete archiving
              roomID: room.roomID
            }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to archive room');

          showAlert('success', 'Success', 'Room archived successfully.');
          fetchRooms();
        } catch (err) {
          showAlert('error', 'Error', err.message);
        }
      }
    );
  };

  const handleRestore = (room) => {
    showConfirm(
      'Restore Room',
      `Are you sure you want to restore Room ${room.roomNumber} back to active listing?`,
      async () => {
        try {
          const res = await fetch('/api/admin/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'restore',
              roomID: room.roomID
            }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to restore room');

          showAlert('success', 'Success', 'Room restored successfully.');
          fetchRooms();
        } catch (err) {
          showAlert('error', 'Error', err.message);
        }
      }
    );
  };

  const openCreateModal = () => {
    setFormData({
      roomNumber: '',
      floorID: floors[0]?.floorID || '',
      roomTypeID: roomTypes[0]?.roomTypeID || '',
      status: 'Available',
    });
    setActiveModal('create');
  };

  const openEditModal = (room) => {
    if (room.status === 'Occupied') {
      showAlert('error', 'Action Restricted', 'Occupied rooms cannot be edited.');
      return;
    }
    setSelectedRoom(room);
    setFormData({
      roomNumber: room.roomNumber,
      floorID: room.floorID,
      roomTypeID: room.roomTypeID,
      status: room.status,
    });
    setActiveModal('edit');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available': return '#3FA34D';
      case 'Occupied': return '#2155B5';
      case 'Reserved': return '#f0a500';
      case 'Under Maintenance': return '#dc3545';
      case 'Cleaning': return '#17a2b8';
      default: return '#6c757d';
    }
  };

  const getStatusOptions = (currentStatus) => {
    const baseOptions = ['Available', 'Under Maintenance'];
    if (currentStatus && !baseOptions.includes(currentStatus)) {
      return [currentStatus, ...baseOptions];
    }
    return baseOptions;
  };

  return (
    <div>
      {/* Custom Modal Dialog */}
      <ModalDialog
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
      />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="section-eyebrow">Admin</div>
          <h2 className="section-title mb-0">Room Management</h2>
        </div>
        <button className="btn btn-pcc-primary text-white" onClick={openCreateModal}>
          + Create Room
        </button>
      </div>

      {/* Tabs for Active vs Archived */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${!showArchived ? 'active text-blue' : 'text-muted'}`}
            onClick={() => setShowArchived(false)}
          >
            🛏 Active Rooms
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${showArchived ? 'active text-blue' : 'text-muted'}`}
            onClick={() => setShowArchived(true)}
          >
            📦 Archived Rooms
          </button>
        </li>
      </ul>

      {/* Search & Filters */}
      <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="row g-2 align-items-end">
          <div className="col-md-5">
            <input
              type="text"
              className="form-control"
              placeholder="Search room number or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-md-4">
            <select
              className="form-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              {roomTypes.map((rt) => (
                <option key={rt.roomTypeID} value={rt.roomTypeID}>
                  {rt.type}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3 d-flex gap-2">
            <button className="btn btn-pcc-outline w-100" onClick={() => { setSearch(''); setTypeFilter(''); }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Rooms Table */}
      <div className="card-module" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Room No.</th>
                  <th>Floor</th>
                  <th>Type</th>
                  <th>Price (w/o Breakfast)</th>
                  <th>Price (w/ Breakfast)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted py-4">
                      No rooms found.
                    </td>
                  </tr>
                ) : (
                  rooms.map((rm) => {
                    const isOccupied = rm.status === 'Occupied';
                    return (
                      <tr key={rm.roomID}>
                        <td>
                          <strong>{rm.roomNumber}</strong>
                        </td>
                        <td>{rm.floorName}</td>
                        <td>{rm.typeName}</td>
                        <td>₱{Number(rm.rateWithoutBreakfast || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>₱{Number(rm.rateWithBreakfast || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: getStatusColor(rm.status) + '22',
                              color: getStatusColor(rm.status),
                              border: `1px solid ${getStatusColor(rm.status)}44`,
                              padding: '0.4em 0.8em',
                            }}
                          >
                            {rm.status}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            {!showArchived ? (
                              <>
                                <button
                                  className="btn btn-sm btn-warning text-white"
                                  onClick={() => openEditModal(rm)}
                                  disabled={isOccupied}
                                  title={isOccupied ? "Occupied rooms cannot be edited." : ""}
                                  style={{ opacity: isOccupied ? 0.6 : 1 }}
                                >
                                  Update
                                </button>
                                <button
                                  className="btn btn-sm btn-danger text-white"
                                  onClick={() => handleArchive(rm)}
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              <button
                                className="btn btn-sm btn-success text-white"
                                onClick={() => handleRestore(rm)}
                              >
                                Restore
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==========================================
          MODALS
          ========================================== */}

      {/* CREATE MODAL */}
      {activeModal === 'create' && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Create Room</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCreateSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Room Number *</label>
                    <input
                      type="text"
                      name="roomNumber"
                      className="form-control"
                      required
                      placeholder="e.g. 101"
                      value={formData.roomNumber}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Floor *</label>
                    <select
                      name="floorID"
                      className="form-select"
                      required
                      value={formData.floorID}
                      onChange={handleInputChange}
                    >
                      <option value="" disabled>Select floor</option>
                      {floors.map(f => (
                        <option key={f.floorID} value={f.floorID}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Room Type *</label>
                    <select
                      name="roomTypeID"
                      className="form-select"
                      required
                      value={formData.roomTypeID}
                      onChange={handleInputChange}
                    >
                      <option value="" disabled>Select type</option>
                      {roomTypes.map(rt => (
                        <option key={rt.roomTypeID} value={rt.roomTypeID}>{rt.type}</option>
                      ))}
                    </select>
                  </div>
                  {(() => {
                    const previewRates = getSelectedRates(formData.floorID, formData.roomTypeID);
                    return previewRates ? (
                      <div className="mb-3 p-3 rounded" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                        <small className="text-muted d-block mb-2 fw-bold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Room Rate Preview</small>
                        <div className="d-flex justify-content-between text-muted mb-1" style={{ fontSize: '0.85rem' }}>
                          <span>Without Breakfast:</span>
                          <span className="fw-bold text-dark">₱{Number(previewRates.withoutBreakfast).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.85rem' }}>
                          <span>With Breakfast:</span>
                          <span className="fw-bold text-dark">₱{Number(previewRates.withBreakfast).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    ) : null;
                  })()}
                  <div className="mb-3">
                    <label className="form-label">Status</label>
                    <select
                      name="status"
                      className="form-select"
                      value={formData.status}
                      onChange={handleInputChange}
                    >
                      {getStatusOptions().map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary text-white">Create Room</button>
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {activeModal === 'edit' && selectedRoom && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Update Room {selectedRoom.roomNumber}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Room Number *</label>
                    <input
                      type="text"
                      name="roomNumber"
                      className="form-control"
                      required
                      value={formData.roomNumber}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Floor *</label>
                    <select
                      name="floorID"
                      className="form-select"
                      required
                      value={formData.floorID}
                      onChange={handleInputChange}
                    >
                      {floors.map(f => (
                        <option key={f.floorID} value={f.floorID}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Room Type *</label>
                    <select
                      name="roomTypeID"
                      className="form-select"
                      required
                      value={formData.roomTypeID}
                      onChange={handleInputChange}
                    >
                      {roomTypes.map(rt => (
                        <option key={rt.roomTypeID} value={rt.roomTypeID}>{rt.type}</option>
                      ))}
                    </select>
                  </div>
                  {(() => {
                    const previewRates = getSelectedRates(formData.floorID, formData.roomTypeID);
                    return previewRates ? (
                      <div className="mb-3 p-3 rounded" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                        <small className="text-muted d-block mb-2 fw-bold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Room Rate Preview</small>
                        <div className="d-flex justify-content-between text-muted mb-1" style={{ fontSize: '0.85rem' }}>
                          <span>Without Breakfast:</span>
                          <span className="fw-bold text-dark">₱{Number(previewRates.withoutBreakfast).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.85rem' }}>
                          <span>With Breakfast:</span>
                          <span className="fw-bold text-dark">₱{Number(previewRates.withBreakfast).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    ) : null;
                  })()}
                  <div className="mb-3">
                    <label className="form-label">Status</label>
                    <select
                      name="status"
                      className="form-select"
                      value={formData.status}
                      onChange={handleInputChange}
                    >
                      {getStatusOptions(selectedRoom.status).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary text-white">Update Room</button>
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
