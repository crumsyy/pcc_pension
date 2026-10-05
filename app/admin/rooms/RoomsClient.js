'use client';

import { useState, useEffect, useRef } from 'react';
import ModalDialog from '../../components/ModalDialog';
import ModalPortal from '../../components/ModalPortal';
import ActionButtons from '../../components/ActionButtons';
import { SkeletonTable } from '@/app/components/skeletons/Skeleton';
import clientCache, { CACHE_TTL } from '@/lib/clientCache';

export default function RoomsClient() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false); // Active vs Archived rooms

  const baseCacheKey = `admin-rooms:${search}_${typeFilter}_${showArchived}`;
  const cached = clientCache.get(baseCacheKey);
  const [rooms, setRooms] = useState(cached?.data?.rooms || []);
  const [floors, setFloors] = useState(cached?.data?.floors || []);
  const [roomTypes, setRoomTypes] = useState(cached?.data?.roomTypes || []);
  const [roomRates, setRoomRates] = useState(cached?.data?.roomRates || []);
  const [loading, setLoading] = useState(!cached);
  const [shouldAnimate, setShouldAnimate] = useState(!cached);
  const [uploadingImage, setUploadingImage] = useState(false);
  const parseRoomImages = (imgVal) => {
    if (!imgVal) return [];
    if (Array.isArray(imgVal)) return imgVal;
    if (typeof imgVal === 'string') {
      const trimmed = imgVal.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch (e) {}
      }
      return trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };

  const optimizeImageForUpload = async (file) => {
    // Files under 4MB can be uploaded directly
    if (file.size <= 4 * 1024 * 1024) {
      return file;
    }
    // For photos over 4MB (up to 25MB), downscale/compress via canvas so Vercel 4.5MB serverless payload limit is respected
    return new Promise((resolve) => {
      try {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          const maxDim = 2560; // crisp 2.5K resolution
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const targetMime = file.type === 'image/png' ? 'image/png' : 'image/webp';
          canvas.toBlob((blob) => {
            if (blob && blob.size < file.size) {
              const baseName = file.name.replace(/\.[^/.]+$/, "");
              const ext = targetMime === 'image/webp' ? '.webp' : (targetMime === 'image/png' ? '.png' : '.jpg');
              const optimized = new File([blob], `${baseName}${ext}`, {
                type: targetMime,
                lastModified: Date.now()
              });
              resolve(optimized);
            } else {
              resolve(file);
            }
          }, targetMime, 0.88);
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
        };
        img.src = objectUrl;
      } catch (err) {
        resolve(file);
      }
    });
  };

  const handleFileChange = async (e) => {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    const currentList = parseRoomImages(formData.image);
    if (currentList.length >= 5) {
      showAlert('warning', 'Photo Limit Reached', 'Maximum 5 photos allowed per room. Please remove an existing photo first.');
      e.target.value = '';
      return;
    }

    const availableSlots = 5 - currentList.length;
    let filesToUpload = rawFiles;
    if (rawFiles.length > availableSlots) {
      showAlert('info', 'Photo Limit Notice', `Only ${availableSlots} more photo(s) can be added (5 photos max per room). Extra photos were skipped.`);
      filesToUpload = rawFiles.slice(0, availableSlots);
    }

    setUploadingImage(true);
    try {
      const uploadedUrls = [];
      for (const file of filesToUpload) {
        if (file.size > 25 * 1024 * 1024) {
          showAlert('error', 'File Too Large', `"${file.name}" exceeds the 25MB limit. Please select an image under 25MB.`);
          continue;
        }

        const readyFile = await optimizeImageForUpload(file);
        const dataForm = new FormData();
        dataForm.append('file', readyFile);
        dataForm.append('type', 'rooms');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: dataForm
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload image');
        if (data.url) uploadedUrls.push(data.url);
      }

      setFormData(prev => {
        const cur = parseRoomImages(prev.image);
        const newList = [...cur, ...uploadedUrls].slice(0, 5);
        return { ...prev, image: JSON.stringify(newList) };
      });

      showAlert('success', 'Photos Uploaded', `${uploadedUrls.length} room photo(s) added successfully!`);
    } catch (err) {
      showAlert('error', 'Upload Failed', err.message);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const removePhotoFromForm = (urlToRemove) => {
    setFormData(prev => {
      const currentList = parseRoomImages(prev.image);
      const newList = currentList.filter(u => u !== urlToRemove);
      return { ...prev, image: JSON.stringify(newList) };
    });
  };

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'edit' | null
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    roomNumber: '',
    floorID: '',
    roomTypeID: '',
    status: 'Available',
    rateWithoutBreakfast: '',
    rateWithBreakfast: '',
    description: '',
    occupancyLimit: '4',
    image: '',
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
      onConfirm: async () => {
        try {
          await onConfirmCallback();
        } finally {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      },
      onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const fetchRooms = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const query = new URLSearchParams({
        search,
        roomTypeID: typeFilter,
        archived: showArchived ? 'true' : 'false'
      }).toString();

      const res = await fetch(`/api/admin/rooms?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch rooms');

      const roomsData = data.rooms || [];
      const floorsData = data.floors || [];
      const roomTypesData = data.roomTypes || [];
      const roomRatesData = data.roomRates || [];

      setRooms(roomsData);
      setFloors(floorsData);
      setRoomTypes(roomTypesData);
      setRoomRates(roomRatesData);

      clientCache.set(baseCacheKey, {
        rooms: roomsData,
        floors: floorsData,
        roomTypes: roomTypesData,
        roomRates: roomRatesData
      }, CACHE_TTL.ROOMS);
    } catch (err) {
      if (!isBackground) showAlert('error', 'Error', err.message);
      else console.warn('Background rooms refresh error:', err.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    const entry = clientCache.get(baseCacheKey);
    if (!entry) {
      fetchRooms(false);
    } else {
      setRooms(entry.data.rooms || []);
      setFloors(entry.data.floors || []);
      setRoomTypes(entry.data.roomTypes || []);
      setRoomRates(entry.data.roomRates || []);
      setLoading(false);
      if (entry.isStale) {
        fetchRooms(true);
      }
    }
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
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'floorID' || name === 'roomTypeID') {
        const rates = getSelectedRates(next.floorID, next.roomTypeID);
        if (rates) {
          next.rateWithoutBreakfast = rates.withoutBreakfast;
          next.rateWithBreakfast = rates.withBreakfast;
        } else {
          next.rateWithoutBreakfast = '';
          next.rateWithBreakfast = '';
        }
      }
      return next;
    });
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!formData.roomNumber.trim()) {
      showAlert('error', 'Validation Error', 'Room Number is required and cannot be empty.');
      return;
    }
    if (parseFloat(formData.rateWithoutBreakfast) < 0 || parseFloat(formData.rateWithBreakfast) < 0) {
      showAlert('error', 'Validation Error', 'Room rates cannot be negative.');
      return;
    }

    showConfirm('Create Room', 'Are you sure you want to create this room and set these rates?', async () => {
      try {
        const res = await fetch('/api/admin/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            ...formData,
            roomNumber: formData.roomNumber.trim()
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create room');

        showAlert('success', 'Success', data.message || 'Room and rates created successfully');
        setActiveModal(null);
        clientCache.invalidate('admin-rooms');
        fetchRooms();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!formData.roomNumber.trim()) {
      showAlert('error', 'Validation Error', 'Room Number is required and cannot be empty.');
      return;
    }
    if (parseFloat(formData.rateWithoutBreakfast) < 0 || parseFloat(formData.rateWithBreakfast) < 0) {
      showAlert('error', 'Validation Error', 'Room rates cannot be negative.');
      return;
    }

    showConfirm('Update Room', `Save changes to Room ${selectedRoom.roomNumber} and update rates?`, async () => {
      try {
        const res = await fetch('/api/admin/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            roomID: selectedRoom.roomID,
            ...formData,
            roomNumber: formData.roomNumber.trim()
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update room');

        showAlert('success', 'Success', data.message || 'Room and rates updated successfully');
        setActiveModal(null);
        clientCache.invalidate('admin-rooms');
        fetchRooms();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleArchive = (room) => {
    if (room.status === 'Occupied') {
      showAlert('error', 'Action Restricted', 'Occupied rooms cannot be deleted or archived.');
      return;
    }
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
          clientCache.invalidate('admin-rooms');
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
          clientCache.invalidate('admin-rooms');
          fetchRooms();
        } catch (err) {
          showAlert('error', 'Error', err.message);
        }
      }
    );
  };

  const openCreateModal = () => {
    const floorID = floors[0]?.floorID || '';
    const roomTypeID = roomTypes[0]?.roomTypeID || '';
    const rates = getSelectedRates(floorID, roomTypeID);
    setFormData({
      roomNumber: '',
      floorID,
      roomTypeID,
      status: 'Available',
      rateWithoutBreakfast: rates ? rates.withoutBreakfast : '',
      rateWithBreakfast: rates ? rates.withBreakfast : '',
      description: '',
      occupancyLimit: '4',
      image: '',
    });
    setActiveModal('create');
  };

  const openEditModal = (room) => {
    if (room.status === 'Occupied') {
      showAlert('error', 'Action Restricted', 'Occupied rooms cannot be edited.');
      return;
    }
    setSelectedRoom(room);
    const rates = getSelectedRates(room.floorID, room.roomTypeID);
    setFormData({
      roomNumber: room.roomNumber,
      floorID: room.floorID,
      roomTypeID: room.roomTypeID,
      status: room.status,
      rateWithoutBreakfast: rates ? rates.withoutBreakfast : '',
      rateWithBreakfast: rates ? rates.withBreakfast : '',
      description: room.description || '',
      occupancyLimit: room.occupancyLimit ? room.occupancyLimit.toString() : '4',
      image: room.image || '',
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
    <div className="pcc-page-container pcc-content-reveal">
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
            Active Rooms
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${showArchived ? 'active text-blue' : 'text-muted'}`}
            onClick={() => setShowArchived(true)}
          >
            Archived Rooms
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
            <button className="btn btn-pcc-primary text-white w-100" onClick={() => { setSearch(''); setTypeFilter(''); }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Rooms Table */}
      <div className="card-module pcc-table-card" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        {loading ? (
          <SkeletonTable columns={9} rows={7} colWidths={['9%', '11%', '13%', '10%', '13%', '13%', '11%', '10%', '10%']} />
        ) : (
          <div className={`table-responsive ${shouldAnimate ? 'pcc-content-reveal' : ''}`} style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Room No.</th>
                  <th>Floor</th>
                  <th>Type</th>
                  <th>Occupancy Limit</th>
                  <th>Price (w/o Breakfast)</th>
                  <th>Price (w/ Breakfast)</th>
                  <th>Breakfast Fee</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center text-muted py-4">
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
                        <td>{rm.occupancyLimit || 4} Pax</td>
                        <td>₱{Number(rm.rateWithoutBreakfast || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>₱{Number(rm.rateWithBreakfast || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>
                          {(() => {
                            const withoutBk = parseFloat(rm.rateWithoutBreakfast) || 0;
                            const withBk = parseFloat(rm.rateWithBreakfast) || 0;
                            const diff = Math.max(0, withBk - withoutBk);
                            if (diff <= 0) {
                              return (
                                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                                  <i className="bi bi-cup-hot me-1"></i>Included
                                </span>
                              );
                            }
                            return (
                              <span className="fw-semibold text-dark">
                                +₱{diff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            );
                          })()}
                        </td>
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
                          <ActionButtons
                            onEdit={!showArchived ? () => openEditModal(rm) : null}
                            onArchive={!showArchived ? () => handleArchive(rm) : null}
                            onRestore={showArchived ? () => handleRestore(rm) : null}
                            disabledEdit={isOccupied}
                            editTooltip="Occupied rooms cannot be edited."
                          />
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
      {activeModal && (
        <ModalPortal>
          {/* CREATE MODAL */}
          {activeModal === 'create' && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
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
                  <div className="mb-3">
                    <label className="form-label">Occupancy Limit (Pax) *</label>
                    <input
                      type="number"
                      name="occupancyLimit"
                      className="form-control"
                      required
                      min="1"
                      placeholder="e.g. 4"
                      value={formData.occupancyLimit}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <label className="form-label">Rate W/O Breakfast (₱) *</label>
                      <input
                        type="number"
                        name="rateWithoutBreakfast"
                        className="form-control"
                        required
                        step="0.01"
                        min="0"
                        value={formData.rateWithoutBreakfast}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Rate W/ Breakfast (₱) *</label>
                      <input
                        type="number"
                        name="rateWithBreakfast"
                        className="form-control"
                        required
                        step="0.01"
                        min="0"
                        value={formData.rateWithBreakfast}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
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
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Room Photos</label>
                    <input
                      type="file"
                      className="form-control"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      disabled={uploadingImage}
                    />
                    <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
                      Supports JPG, PNG, WEBP up to 25MB (max 5 photos per room).
                    </small>
                    {uploadingImage && (
                      <small className="text-primary d-block mt-1">
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        Uploading photo(s)...
                      </small>
                    )}

                    {parseRoomImages(formData.image).length > 0 && (
                      <div className="mt-2 p-2.5 bg-light rounded border">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <small className="fw-semibold text-muted">
                            Attached Room Photos ({parseRoomImages(formData.image).length}/5 max):
                          </small>
                          <button
                            type="button"
                            className="btn btn-link text-danger p-0 text-decoration-none"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                          >
                            Remove All
                          </button>
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          {parseRoomImages(formData.image).map((imgUrl, idx) => (
                            <div key={idx} className="position-relative d-inline-block border rounded p-1 bg-white shadow-sm">
                              <img
                                src={imgUrl}
                                alt={`Room photo ${idx + 1}`}
                                className="rounded"
                                style={{ width: '85px', height: '60px', objectFit: 'cover' }}
                                onError={(e) => { e.currentTarget.src = '/assets/images/logo.jpg'; }}
                              />
                              <button
                                type="button"
                                className="btn btn-danger btn-xs position-absolute top-0 end-0 translate-middle badge rounded-circle p-1"
                                style={{ width: '20px', height: '20px', fontSize: '0.65rem', lineHeight: '10px' }}
                                onClick={() => removePhotoFromForm(imgUrl)}
                                title="Remove photo"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
                      You can select up to 5 photos per room. Selected photos will display on the Landing Page and Guest Portal.
                    </small>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description / Remarks (Optional)</label>
                    <textarea
                      name="description"
                      className="form-control"
                      rows="3"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Enter room details, features, or description..."
                    />
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
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
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
                  <div className="mb-3">
                    <label className="form-label">Occupancy Limit (Pax) *</label>
                    <input
                      type="number"
                      name="occupancyLimit"
                      className="form-control"
                      required
                      min="1"
                      placeholder="e.g. 4"
                      value={formData.occupancyLimit}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <label className="form-label">Rate W/O Breakfast (₱) *</label>
                      <input
                        type="number"
                        name="rateWithoutBreakfast"
                        className="form-control"
                        required
                        step="0.01"
                        min="0"
                        value={formData.rateWithoutBreakfast}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Rate W/ Breakfast (₱) *</label>
                      <input
                        type="number"
                        name="rateWithBreakfast"
                        className="form-control"
                        required
                        step="0.01"
                        min="0"
                        value={formData.rateWithBreakfast}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
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
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Room Photos</label>
                    <input
                      type="file"
                      className="form-control"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      disabled={uploadingImage}
                    />
                    <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
                      Supports JPG, PNG, WEBP up to 25MB (max 5 photos per room).
                    </small>
                    {uploadingImage && (
                      <small className="text-primary d-block mt-1">
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        Uploading photo(s)...
                      </small>
                    )}

                    {parseRoomImages(formData.image).length > 0 && (
                      <div className="mt-2 p-2.5 bg-light rounded border">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <small className="fw-semibold text-muted">
                            Attached Room Photos ({parseRoomImages(formData.image).length}/5 max):
                          </small>
                          <button
                            type="button"
                            className="btn btn-link text-danger p-0 text-decoration-none"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                          >
                            Remove All
                          </button>
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          {parseRoomImages(formData.image).map((imgUrl, idx) => (
                            <div key={idx} className="position-relative d-inline-block border rounded p-1 bg-white shadow-sm">
                              <img
                                src={imgUrl}
                                alt={`Room photo ${idx + 1}`}
                                className="rounded"
                                style={{ width: '85px', height: '60px', objectFit: 'cover' }}
                                onError={(e) => { e.currentTarget.src = '/assets/images/logo.jpg'; }}
                              />
                              <button
                                type="button"
                                className="btn btn-danger btn-xs position-absolute top-0 end-0 translate-middle badge rounded-circle p-1"
                                style={{ width: '20px', height: '20px', fontSize: '0.65rem', lineHeight: '10px' }}
                                onClick={() => removePhotoFromForm(imgUrl)}
                                title="Remove photo"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
                      You can select up to 5 photos per room. Selected photos will display on the Landing Page and Guest Portal.
                    </small>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description / Remarks (Optional)</label>
                    <textarea
                      name="description"
                      className="form-control"
                      rows="3"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Enter room details, features, or description..."
                    />
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
        </ModalPortal>
      )}
    </div>
  );
}
