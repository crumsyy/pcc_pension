'use client';

import { useState, useEffect, useRef } from 'react';
import ModalDialog from '../../components/ModalDialog';
import ModalPortal from '../../components/ModalPortal';
import ActionButtons from '../../components/ActionButtons';
import AdminPagination, { ADMIN_PAGE_SIZE, paginate } from '../../components/AdminPagination';
import { Tabs, TabList, Tab } from '@/components/ui/tabs';
import {
  DialogTrigger,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import clientCache, { CACHE_TTL } from '@/lib/clientCache';
import { toast } from '@/components/ui/toast';

export default function RoomsClient() {
  const readSearchParam = () => {
    try {
      if (typeof window === 'undefined') return '';
      return new URLSearchParams(window.location.search).get('search') || '';
    } catch (e) {
      return '';
    }
  };
  const [search, setSearch] = useState(readSearchParam);
  const [searchInput, setSearchInput] = useState(readSearchParam);
  const searchTimer = useRef(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' | 'types' | 'floors' | 'archived'
  const showArchived = activeTab === 'archived';
  const [typeSearch, setTypeSearch] = useState('');
  const [floorSearch, setFloorSearch] = useState('');
  const [page, setPage] = useState(1);
  const [typePage, setTypePage] = useState(1);
  const [floorPage, setFloorPage] = useState(1);

  const handleSearchChange = (e) => { const v = e.target.value; setSearchInput(v); if (searchTimer.current) clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => { setSearch(v); setPage(1); }, 350); };
  const handleTypeFilterChange = (e) => { setTypeFilter(e.target.value); setPage(1); };
  const handleTabChange = (key) => {
    setActiveTab(key);
    setPage(1);
    setTypePage(1);
    setFloorPage(1);
  };
  const handleShowActive = () => { setActiveTab('rooms'); setPage(1); };
  const handleShowArchivedTab = () => { setActiveTab('archived'); setPage(1); };
  const handleClearFilters = () => { if (searchTimer.current) clearTimeout(searchTimer.current); setSearchInput(''); setSearch(''); setTypeFilter(''); setPage(1); };
  const handleClearTypeFilters = () => { setTypeSearch(''); setTypePage(1); };
  const handleClearFloorFilters = () => { setFloorSearch(''); setFloorPage(1); };

  const baseCacheKey = `admin-rooms:${search}_${typeFilter}_${showArchived}`;
  const cached = clientCache.get(baseCacheKey);
  const [rooms, setRooms] = useState(cached?.data?.rooms || []);
  const [floors, setFloors] = useState(cached?.data?.floors || []);
  const [roomTypes, setRoomTypes] = useState(cached?.data?.roomTypes || []);
  const [roomRates, setRoomRates] = useState(cached?.data?.roomRates || []);
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
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'edit' | 'createType' | 'editType' | 'createFloor' | 'editFloor' | null
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Room type / floor lookup management
  const [typeForm, setTypeForm] = useState({ roomTypeID: '', type: '', description: '', minOccupancy: '1', maxOccupancy: '2', extraFoam: '0' });
  const [floorForm, setFloorForm] = useState({ floorID: '', name: '' });
  const [savingLookup, setSavingLookup] = useState(false);

  const postLookup = async (action, payload, okMsg) => {
    setSavingLookup(true);
    try {
      const res = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operation failed');
      showAlert('success', 'Success', data.message || okMsg);
      setActiveModal(null);
      clientCache.invalidate('admin-rooms');
      await fetchRooms();
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setSavingLookup(false);
    }
  };

  const openCreateTypeModal = () => {
    setTypeForm({ roomTypeID: '', type: '', description: '', minOccupancy: '1', maxOccupancy: '2', extraFoam: '0' });
    setActiveModal('createType');
  };

  const openEditTypeModal = (rt) => {
    setTypeForm({
      roomTypeID: rt.roomTypeID,
      type: rt.type || '',
      description: rt.description || '',
      minOccupancy: String(rt.minOccupancy ?? 1),
      maxOccupancy: String(rt.maxOccupancy ?? rt.minOccupancy ?? 2),
      extraFoam: String(rt.extraFoam ?? 0)
    });
    setActiveModal('editType');
  };

  const handleSaveType = (e) => {
    e.preventDefault();
    if (!typeForm.type.trim()) {
      showAlert('error', 'Validation Error', 'Room type name is required.');
      return;
    }
    if (typeForm.roomTypeID) {
      postLookup('update_room_type', { ...typeForm }, 'Room type updated.');
    } else {
      postLookup('create_room_type', { ...typeForm }, 'Room type created.');
    }
  };

  const handleDeleteType = (rt) => {
    showConfirm('Delete Room Type', `Delete room type "${rt.type}"? Blocked while any room uses it.`, async () => {
      await postLookup('delete_room_type', { roomTypeID: rt.roomTypeID }, 'Room type deleted.');
    });
  };

  const getNextFloorName = (existingFloors = []) => {
    const regex = /(\d+)(?:st|nd|rd|th)?\s*floor/i;
    const wordMap = {
      ground: 1,
      first: 1,
      second: 2,
      third: 3,
      fourth: 4,
      fifth: 5,
      sixth: 6,
      seventh: 7,
      eighth: 8,
      ninth: 9,
      tenth: 10
    };
    
    let maxNum = 0;
    for (const f of existingFloors) {
      const name = (f.name || '').trim().toLowerCase();
      const match = name.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      } else {
        for (const [word, val] of Object.entries(wordMap)) {
          if (name.includes(word)) {
            if (val > maxNum) maxNum = val;
            break;
          }
        }
      }
    }

    const nextNum = Math.max(maxNum + 1, existingFloors.length + 1);
    const s = ['th', 'st', 'nd', 'rd'];
    const v = nextNum % 100;
    const ordinal = nextNum + (s[(v - 20) % 10] || s[v] || s[0]);
    return `${ordinal} Floor`;
  };

  const openCreateFloorModal = () => {
    const nextName = getNextFloorName(floors);
    showConfirm('Add Floor', `Add "${nextName}" to building floors?`, async () => {
      await postLookup('create_floor', { name: nextName }, `Floor "${nextName}" added successfully.`);
    });
  };

  const openEditFloorModal = (f) => {
    setFloorForm({ floorID: f.floorID, name: f.name || '' });
    setActiveModal('editFloor');
  };

  const handleSaveFloor = (e) => {
    e.preventDefault();
    if (!floorForm.name.trim()) {
      showAlert('error', 'Validation Error', 'Floor name is required.');
      return;
    }
    if (floorForm.floorID) {
      postLookup('update_floor', { ...floorForm }, 'Floor updated.');
    } else {
      postLookup('create_floor', { ...floorForm }, 'Floor created.');
    }
  };

  const handleDeleteFloor = (f) => {
    showConfirm('Delete Floor', `Delete floor "${f.name}"? Blocked while any room uses it.`, async () => {
      await postLookup('delete_floor', { floorID: f.floorID }, 'Floor deleted.');
    });
  };

  // Form state
  const [formData, setFormData] = useState({
    roomNumber: '',
    floorID: '',
    roomTypeID: '',
    status: 'Available',
    rate: '',
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
    toast.add({
      type: type || 'info',
      title: title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notification'),
      description: message || ''
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
    }
  };

  useEffect(() => {
    const entry = clientCache.get(baseCacheKey);
    if (!entry) {
      fetchRooms(false);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRooms(entry.data.rooms || []);
      setFloors(entry.data.floors || []);
      setRoomTypes(entry.data.roomTypes || []);
      setRoomRates(entry.data.roomRates || []);
      if (entry.isStale) {
        fetchRooms(true);
      }
    }
  }, [search, typeFilter, showArchived]);

  const getSelectedRates = (floorID, roomTypeID) => {
    if (!floorID || !roomTypeID) return null;
    const match = roomRates.find(
      r => r.floorID === parseInt(floorID) && r.roomTypeID === parseInt(roomTypeID) && r.breakfastID === 1
    );
    return {
      rate: match ? match.rate : 0
    };
  };

  const handleInputChange = (e) => {
    const { name } = e.target;
    let { value } = e.target;
    if (name === 'roomNumber') {
      value = String(value).replace(/[^0-9]/g, '');
    }
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'floorID' || name === 'roomTypeID') {
        const rates = getSelectedRates(next.floorID, next.roomTypeID);
        if (rates) {
          next.rate = rates.rate;
        } else {
          next.rate = '';
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
    if (!/^\d+$/.test(formData.roomNumber.trim())) {
      showAlert('error', 'Validation Error', 'Room Number must contain numbers only (no letters).');
      return;
    }
    if (isNaN(parseFloat(formData.rate)) || parseFloat(formData.rate) < 0) {
      showAlert('error', 'Validation Error', 'Room rate must be a valid non-negative number.');
      return;
    }

    showConfirm('Create Room', 'Are you sure you want to create this room and set this rate?', async () => {
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
    if (!/^\d+$/.test(formData.roomNumber.trim())) {
      showAlert('error', 'Validation Error', 'Room Number must contain numbers only (no letters).');
      return;
    }
    if (isNaN(parseFloat(formData.rate)) || parseFloat(formData.rate) < 0) {
      showAlert('error', 'Validation Error', 'Room rate must be a valid non-negative number.');
      return;
    }

    showConfirm('Update Room', `Save changes to Room ${selectedRoom.roomNumber} and update rate?`, async () => {
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
      rate: rates ? rates.rate : '',
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
      rate: rates ? rates.rate : (room.rate || room.rateWithoutBreakfast || ''),
      description: room.description || '',
      occupancyLimit: room.occupancyLimit ? room.occupancyLimit.toString() : '4',
      image: room.image || '',
    });
    setActiveModal('edit');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available': return '#3FA34D';
      case 'Booked': return '#0dcaf0';
      case 'Occupied': return '#2155B5';
      case 'Reserved': return '#f0a500';
      case 'Under Maintenance': return '#dc3545';
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

  const { totalPages, safePage, rows: pagedRooms, start, end, total } = paginate(rooms, page, ADMIN_PAGE_SIZE);

  const filteredRoomTypes = roomTypes.filter(rt => {
    if (!typeSearch.trim()) return true;
    const q = typeSearch.toLowerCase();
    return (
      (rt.type && rt.type.toLowerCase().includes(q)) ||
      (rt.description && rt.description.toLowerCase().includes(q))
    );
  });

  const filteredFloors = floors.filter(f => {
    if (!floorSearch.trim()) return true;
    const q = floorSearch.toLowerCase();
    return f.name && f.name.toLowerCase().includes(q);
  });

  const { totalPages: typeTotalPages, safePage: safeTypePage, rows: pagedRoomTypes, start: typeStart, end: typeEnd, total: typeTotal } = paginate(filteredRoomTypes, typePage, ADMIN_PAGE_SIZE);
  const { totalPages: floorTotalPages, safePage: safeFloorPage, rows: pagedFloors, start: floorStart, end: floorEnd, total: floorTotal } = paginate(filteredFloors, floorPage, ADMIN_PAGE_SIZE);

  return (
    <div className="pcc-page-container table-compact pcc-content-reveal">
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

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        {/* Tabs for Rooms, Room Types, Floors, Archived */}
        <Tabs selectedKey={activeTab} onSelectionChange={handleTabChange}>
          <TabList aria-label="Room management sections">
            <Tab id="rooms">
              Rooms <span className="badge bg-secondary-subtle text-secondary ms-1 rounded-pill">{rooms.length}</span>
            </Tab>
            <Tab id="types">
              Room Types <span className="badge bg-secondary-subtle text-secondary ms-1 rounded-pill">{roomTypes.length}</span>
            </Tab>
            <Tab id="floors">
              Floors <span className="badge bg-secondary-subtle text-secondary ms-1 rounded-pill">{floors.length}</span>
            </Tab>
            <Tab id="archived">
              Archived Rooms
            </Tab>
          </TabList>
        </Tabs>
        <div className="d-flex gap-2">
          {activeTab === 'rooms' && (
            <button className="btn btn-pcc-primary text-white fw-semibold" onClick={openCreateModal}>
              <i className="bi bi-plus-lg me-1"></i>Create Room
            </button>
          )}
          {activeTab === 'types' && (
            <button className="btn btn-pcc-primary text-white fw-semibold" onClick={openCreateTypeModal}>
              <i className="bi bi-plus-lg me-1"></i>Add Room Type
            </button>
          )}
          {activeTab === 'floors' && (
            <button className="btn btn-pcc-primary text-white fw-semibold" onClick={openCreateFloorModal}>
              <i className="bi bi-plus-lg me-1"></i>Add Floor
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters for Rooms / Archived */}
      {(activeTab === 'rooms' || activeTab === 'archived') && (
        <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
          <div className="row g-2 align-items-end">
            <div className="col-md-5">
              <input
                type="text"
                className="form-control"
                placeholder="Search room number or type..."
                value={searchInput}
                onChange={handleSearchChange}
              />
            </div>
            <div className="col-md-4">
              <select
                className="form-select"
                value={typeFilter}
                onChange={handleTypeFilterChange}
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
              <button className="btn btn-pcc-primary text-white w-100" onClick={handleClearFilters}>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters for Room Types */}
      {activeTab === 'types' && (
        <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
          <div className="row g-2 align-items-center">
            <div className="col-md-9">
              <input
                type="text"
                className="form-control"
                placeholder="Search room type name or description..."
                value={typeSearch}
                onChange={(e) => { setTypeSearch(e.target.value); setTypePage(1); }}
              />
            </div>
            <div className="col-md-3 d-flex gap-2">
              <button className="btn btn-pcc-primary text-white w-100" onClick={handleClearTypeFilters}>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters for Floors */}
      {activeTab === 'floors' && (
        <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
          <div className="row g-2 align-items-center">
            <div className="col-md-9">
              <input
                type="text"
                className="form-control"
                placeholder="Search floor name (e.g. Ground Floor, Second Floor)..."
                value={floorSearch}
                onChange={(e) => { setFloorSearch(e.target.value); setFloorPage(1); }}
              />
            </div>
            <div className="col-md-3 d-flex gap-2">
              <button className="btn btn-pcc-primary text-white w-100" onClick={handleClearFloorFilters}>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rooms Table (Active & Archived) */}
      {(activeTab === 'rooms' || activeTab === 'archived') && (
        <div className="card-module pcc-table-card" style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
          <div className={`table-responsive ${shouldAnimate ? 'pcc-content-reveal' : ''}`} style={{ maxHeight: 'max(200px, calc(100vh - 300px))', overflowY: 'auto' }}>
            <Table className="table align-middle mb-0">
              <TableHeader>
                <TableRow>
                  <TableHead>Room No.</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Occupancy Limit</TableHead>
                  <TableHead>Price (₱)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan="7" className="text-center text-muted py-5">
                      <div className="d-flex flex-column align-items-center justify-content-center">
                        <div className="rounded-circle bg-light d-flex align-items-center justify-content-center mb-3" style={{ width: '56px', height: '56px' }}>
                          <i className="bi bi-door-closed text-secondary fs-3"></i>
                        </div>
                        <h6 className="fw-bold text-dark mb-1">{showArchived ? 'No Archived Rooms' : 'No Rooms Found'}</h6>
                        <p className="small text-muted mb-3" style={{ maxWidth: '320px' }}>
                          {searchInput || typeFilter
                            ? 'No rooms match your search or filter criteria.'
                            : showArchived
                            ? 'Rooms archived from the active catalog will appear here.'
                            : 'Get started by creating your first guest room.'}
                        </p>
                        {!showArchived && !searchInput && !typeFilter && (
                          <button className="btn btn-sm btn-pcc-primary text-white fw-semibold" onClick={openCreateModal}>
                            <i className="bi bi-plus-lg me-1"></i> Create Room
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedRooms.map((rm) => {
                    const isOccupied = rm.status === 'Occupied';
                    return (
                      <TableRow key={rm.roomID}>
                        <TableCell>
                          <strong>{rm.roomNumber}</strong>
                        </TableCell>
                        <TableCell>{rm.floorName}</TableCell>
                        <TableCell>{rm.typeName}</TableCell>
                        <TableCell>{rm.occupancyLimit || 4} Pax</TableCell>
                        <TableCell>
                          <strong>₱{Number(rm.rate || rm.rateWithoutBreakfast || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                          <ActionButtons
                            onEdit={!showArchived ? () => openEditModal(rm) : null}
                            onArchive={!showArchived ? () => handleArchive(rm) : null}
                            onRestore={showArchived ? () => handleRestore(rm) : null}
                            disabledEdit={isOccupied}
                            editTooltip="Occupied rooms cannot be edited."
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <AdminPagination page={safePage} totalPages={totalPages} onPage={setPage} start={start} end={end} total={total} label={showArchived ? "archived rooms" : "rooms"} />
        </div>
      )}

      {/* Room Types Table */}
      {activeTab === 'types' && (
        <div className="card-module pcc-table-card" style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
          <div className={`table-responsive ${shouldAnimate ? 'pcc-content-reveal' : ''}`} style={{ maxHeight: 'max(200px, calc(100vh - 300px))', overflowY: 'auto' }}>
            <Table className="table align-middle mb-0">
              <TableHeader>
                <TableRow>
                  <TableHead>Room Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Occupancy Range</TableHead>
                  <TableHead>Extra Foam (₱)</TableHead>
                  <TableHead>Active Rooms</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoomTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan="6" className="text-center py-5">
                      <div className="d-flex flex-column align-items-center justify-content-center text-muted">
                        <div className="rounded-circle bg-light d-flex align-items-center justify-content-center mb-3" style={{ width: '56px', height: '56px' }}>
                          <i className="bi bi-tag text-secondary fs-3"></i>
                        </div>
                        <h6 className="fw-bold text-dark mb-1">No Room Types Found</h6>
                        <p className="small text-muted mb-3" style={{ maxWidth: '320px' }}>
                          {typeSearch ? `No room types match "${typeSearch}".` : 'Get started by creating your first room type.'}
                        </p>
                        {!typeSearch && (
                          <button className="btn btn-sm btn-pcc-primary text-white fw-semibold" onClick={openCreateTypeModal}>
                            <i className="bi bi-plus-lg me-1"></i> Add Room Type
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedRoomTypes.map((rt) => {
                    const roomCount = Number(rt.roomCount ?? (rooms.filter(r => r.roomTypeID === rt.roomTypeID && !r.isArchived).length));
                    const isUsed = roomCount > 0;
                    return (
                      <TableRow key={rt.roomTypeID}>
                        <TableCell>
                          <div className="d-flex align-items-center gap-2">
                            <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary" style={{ width: '32px', height: '32px', fontSize: '0.875rem' }}>
                              <i className="bi bi-tag-fill"></i>
                            </span>
                            <strong>{rt.type}</strong>
                          </div>
                        </TableCell>
                        <TableCell style={{ maxWidth: '300px' }}>
                          {rt.description ? (
                            <span className="text-muted small text-truncate d-inline-block" style={{ maxWidth: '280px' }} title={rt.description}>
                              {rt.description}
                            </span>
                          ) : (
                            <span className="text-muted fst-italic small">No description</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="badge bg-light text-dark border px-2 py-1">
                            <i className="bi bi-people me-1 text-muted"></i>
                            {rt.minOccupancy ?? 1} – {rt.maxOccupancy ?? rt.minOccupancy ?? 2} Pax
                          </span>
                        </TableCell>
                        <TableCell>
                          {Number(rt.extraFoam || 0) > 0 ? (
                            <span className="fw-semibold text-dark">
                              ₱{Number(rt.extraFoam).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`badge ${isUsed ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-light text-muted border'} px-2 py-1`}>
                            <i className="bi bi-door-closed me-1"></i>
                            {roomCount} {roomCount === 1 ? 'Room' : 'Rooms'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ActionButtons
                            onEdit={() => openEditTypeModal(rt)}
                            onDelete={() => handleDeleteType(rt)}
                            disabledDelete={isUsed}
                            deleteTooltip={isUsed ? `Cannot delete: ${roomCount} active room(s) use this type.` : 'Delete Room Type'}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <AdminPagination page={safeTypePage} totalPages={typeTotalPages} onPage={setTypePage} start={typeStart} end={typeEnd} total={typeTotal} label="room types" />
        </div>
      )}

      {/* Floors Table */}
      {activeTab === 'floors' && (
        <div className="card-module pcc-table-card" style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
          <div className={`table-responsive ${shouldAnimate ? 'pcc-content-reveal' : ''}`} style={{ maxHeight: 'max(200px, calc(100vh - 300px))', overflowY: 'auto' }}>
            <Table className="table align-middle mb-0">
              <TableHeader>
                <TableRow>
                  <TableHead>Floor Name</TableHead>
                  <TableHead>Active Rooms</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFloors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan="3" className="text-center py-5">
                      <div className="d-flex flex-column align-items-center justify-content-center text-muted">
                        <div className="rounded-circle bg-light d-flex align-items-center justify-content-center mb-3" style={{ width: '56px', height: '56px' }}>
                          <i className="bi bi-layers text-secondary fs-3"></i>
                        </div>
                        <h6 className="fw-bold text-dark mb-1">No Floors Found</h6>
                        <p className="small text-muted mb-3" style={{ maxWidth: '320px' }}>
                          {floorSearch ? `No floors match "${floorSearch}".` : 'Get started by creating your first building floor.'}
                        </p>
                        {!floorSearch && (
                          <button className="btn btn-sm btn-pcc-primary text-white fw-semibold" onClick={openCreateFloorModal}>
                            <i className="bi bi-plus-lg me-1"></i> Add Floor
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedFloors.map((f) => {
                    const roomCount = Number(f.roomCount ?? (rooms.filter(r => r.floorID === f.floorID && !r.isArchived).length));
                    const isUsed = roomCount > 0;
                    return (
                      <TableRow key={f.floorID}>
                        <TableCell>
                          <div className="d-flex align-items-center gap-2">
                            <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success-subtle text-success" style={{ width: '32px', height: '32px', fontSize: '0.875rem' }}>
                              <i className="bi bi-layers-fill"></i>
                            </span>
                            <strong>{f.name}</strong>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`badge ${isUsed ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-light text-muted border'} px-2 py-1`}>
                            <i className="bi bi-door-closed me-1"></i>
                            {roomCount} {roomCount === 1 ? 'Room' : 'Rooms'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ActionButtons
                            onEdit={() => openEditFloorModal(f)}
                            onDelete={() => handleDeleteFloor(f)}
                            disabledDelete={isUsed}
                            deleteTooltip={isUsed ? `Cannot delete: ${roomCount} active room(s) use this floor.` : 'Delete Floor'}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <AdminPagination page={safeFloorPage} totalPages={floorTotalPages} onPage={setFloorPage} start={floorStart} end={floorEnd} total={floorTotal} label="floors" />
        </div>
      )}

      {/* ==========================================
          MODALS
          ========================================== */}
      {activeModal && (
        <ModalPortal>
          {/* CREATE MODAL */}
          {activeModal === 'create' && (
          <DialogTrigger isOpen={true}>
            <Dialog isDismissable={false} showCloseButton={false} aria-label="Create Room" style={{ maxWidth: '680px' }}>
              <DialogHeader>
                <div className="d-flex justify-content-between align-items-center w-100">
                  <DialogTitle>Create Room</DialogTitle>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)} aria-label="Close"></button>
                </div>
              </DialogHeader>
              <form onSubmit={handleCreateSubmit}>
                <DialogBody>
                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Room Number <span className="required-asterisk">*</span></label>
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
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Floor <span className="required-asterisk">*</span></label>
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
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Room Type <span className="required-asterisk">*</span></label>
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
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Occupancy Limit (Pax) <span className="required-asterisk">*</span></label>
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
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Standard Rate (₱) <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        name="rate"
                        className="form-control"
                        required
                        step="0.01"
                        min="0"
                        placeholder="e.g. 1500.00"
                        value={formData.rate}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Status</label>
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

                  <div className="row g-2 mb-2">
                    <div className="col-12">
                      <label className="form-label small fw-semibold mb-1">Room Photos</label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        disabled={uploadingImage}
                      />
                      <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>
                        JPG/PNG/WEBP (up to 5 photos, max 25MB).
                      </small>
                      {uploadingImage && (
                        <small className="text-primary d-block mt-1">
                          <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                          Uploading photo(s)...
                        </small>
                      )}
                    </div>
                  </div>

                  {parseRoomImages(formData.image).length > 0 && (
                    <div className="mb-2 p-2 bg-light rounded border">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className="fw-semibold text-muted" style={{ fontSize: '0.75rem' }}>
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
                              style={{ width: '70px', height: '50px', objectFit: 'cover' }}
                              onError={(e) => { e.currentTarget.src = '/assets/images/logo.jpg'; }}
                            />
                            <button
                              type="button"
                              className="btn btn-danger btn-xs position-absolute top-0 end-0 translate-middle badge rounded-circle p-1"
                              style={{ width: '18px', height: '18px', fontSize: '0.6rem', lineHeight: '8px' }}
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

                  <div className="mb-1">
                    <label className="form-label small fw-semibold mb-1">Description / Remarks (Optional)</label>
                    <textarea
                      name="description"
                      className="form-control"
                      rows="2"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Enter room details, features, or description..."
                    />
                  </div>
                </DialogBody>
                <DialogFooter>
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-pcc-primary text-white">Create Room</button>
                </DialogFooter>
              </form>
            </Dialog>
          </DialogTrigger>
      )}

      {/* EDIT MODAL */}
      {activeModal === 'edit' && selectedRoom && (
          <DialogTrigger isOpen={true}>
            <Dialog isDismissable={false} showCloseButton={false} aria-label="Update Room" style={{ maxWidth: '680px' }}>
              <DialogHeader>
                <div className="d-flex justify-content-between align-items-center w-100">
                  <DialogTitle>Update Room {selectedRoom.roomNumber}</DialogTitle>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)} aria-label="Close"></button>
                </div>
              </DialogHeader>
              <form onSubmit={handleEditSubmit}>
                <DialogBody>
                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Room Number <span className="required-asterisk">*</span></label>
                      <input
                        type="text"
                        name="roomNumber"
                        className="form-control"
                        required
                        value={formData.roomNumber}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Floor <span className="required-asterisk">*</span></label>
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
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Room Type <span className="required-asterisk">*</span></label>
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
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Occupancy Limit (Pax) <span className="required-asterisk">*</span></label>
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
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Standard Rate (₱) <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        name="rate"
                        className="form-control"
                        required
                        step="0.01"
                        min="0"
                        placeholder="e.g. 1500.00"
                        value={formData.rate}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Status</label>
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

                  <div className="row g-2 mb-2">
                    <div className="col-12">
                      <label className="form-label small fw-semibold mb-1">Room Photos</label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        disabled={uploadingImage}
                      />
                      <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>
                        JPG/PNG/WEBP (up to 5 photos, max 25MB).
                      </small>
                      {uploadingImage && (
                        <small className="text-primary d-block mt-1">
                          <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                          Uploading photo(s)...
                        </small>
                      )}
                    </div>
                  </div>

                  {parseRoomImages(formData.image).length > 0 && (
                    <div className="mb-2 p-2 bg-light rounded border">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className="fw-semibold text-muted" style={{ fontSize: '0.75rem' }}>
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
                              style={{ width: '70px', height: '50px', objectFit: 'cover' }}
                              onError={(e) => { e.currentTarget.src = '/assets/images/logo.jpg'; }}
                            />
                            <button
                              type="button"
                              className="btn btn-danger btn-xs position-absolute top-0 end-0 translate-middle badge rounded-circle p-1"
                              style={{ width: '18px', height: '18px', fontSize: '0.6rem', lineHeight: '8px' }}
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

                  <div className="mb-1">
                    <label className="form-label small fw-semibold mb-1">Description / Remarks (Optional)</label>
                    <textarea
                      name="description"
                      className="form-control"
                      rows="2"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Enter room details, features, or description..."
                    />
                  </div>
                </DialogBody>
                <DialogFooter>
                  <button type="submit" className="btn btn-pcc-primary text-white">Update Room</button>
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                </DialogFooter>
              </form>
            </Dialog>
          </DialogTrigger>
      )}
          {/* ROOM TYPE MODAL */}
          {(activeModal === 'createType' || activeModal === 'editType') && (
            <DialogTrigger isOpen={true}>
              <Dialog isDismissable={false} showCloseButton={false} aria-label={activeModal === 'editType' ? 'Edit Room Type' : 'Add Room Type'} style={{ maxWidth: '520px' }}>
                <DialogHeader>
                  <div className="d-flex justify-content-between align-items-center w-100">
                    <DialogTitle>{activeModal === 'editType' ? 'Edit Room Type' : 'Add Room Type'}</DialogTitle>
                    <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)} aria-label="Close"></button>
                  </div>
                </DialogHeader>
                <form onSubmit={handleSaveType}>
                  <DialogBody>
                    <div className="mb-3">
                      <label className="form-label small fw-semibold mb-1">Room Type Name <span className="required-asterisk">*</span></label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        placeholder="e.g. Deluxe Matrimonial"
                        value={typeForm.type}
                        onChange={(e) => setTypeForm(prev => ({ ...prev, type: e.target.value }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label small fw-semibold mb-1">Description <span className="text-muted fw-normal">(Optional)</span></label>
                      <textarea
                        className="form-control"
                        rows={2}
                        placeholder="Brief description of the room type..."
                        value={typeForm.description}
                        onChange={(e) => setTypeForm(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                    <div className="row g-2 mb-2">
                      <div className="col-4">
                        <label className="form-label small fw-semibold mb-1">Min Pax <span className="required-asterisk">*</span></label>
                        <input
                          type="number"
                          min="1"
                          className="form-control"
                          required
                          value={typeForm.minOccupancy}
                          onChange={(e) => setTypeForm(prev => ({ ...prev, minOccupancy: e.target.value }))}
                        />
                      </div>
                      <div className="col-4">
                        <label className="form-label small fw-semibold mb-1">Max Pax <span className="required-asterisk">*</span></label>
                        <input
                          type="number"
                          min="1"
                          className="form-control"
                          required
                          value={typeForm.maxOccupancy}
                          onChange={(e) => setTypeForm(prev => ({ ...prev, maxOccupancy: e.target.value }))}
                        />
                      </div>
                      <div className="col-4">
                        <label className="form-label small fw-semibold mb-1">Extra Foam</label>
                        <input
                          type="number"
                          min="0"
                          className="form-control"
                          value={typeForm.extraFoam}
                          onChange={(e) => setTypeForm(prev => ({ ...prev, extraFoam: e.target.value }))}
                        />
                      </div>
                    </div>
                  </DialogBody>
                  <DialogFooter>
                    <button type="button" className="btn btn-light border fw-semibold" onClick={() => setActiveModal(null)}>Cancel</button>
                    <button type="submit" className="btn btn-pcc-primary text-white fw-bold px-4" disabled={savingLookup}>
                      {savingLookup ? 'Saving...' : (activeModal === 'editType' ? 'Save Changes' : 'Create Room Type')}
                    </button>
                  </DialogFooter>
                </form>
              </Dialog>
            </DialogTrigger>
          )}

          {/* RENAME FLOOR MODAL */}
          {activeModal === 'editFloor' && (
            <DialogTrigger isOpen={true}>
              <Dialog isDismissable={false} showCloseButton={false} aria-label="Rename Floor" style={{ maxWidth: '440px' }}>
                <DialogHeader>
                  <div className="d-flex justify-content-between align-items-center w-100">
                    <DialogTitle>Rename Floor</DialogTitle>
                    <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)} aria-label="Close"></button>
                  </div>
                </DialogHeader>
                <form onSubmit={handleSaveFloor}>
                  <DialogBody>
                    <div className="mb-2">
                      <label className="form-label small fw-semibold mb-1">Floor Name <span className="required-asterisk">*</span></label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        placeholder="e.g. Ground Floor"
                        value={floorForm.name}
                        onChange={(e) => setFloorForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                  </DialogBody>
                  <DialogFooter>
                    <button type="button" className="btn btn-light border fw-semibold" onClick={() => setActiveModal(null)}>Cancel</button>
                    <button type="submit" className="btn btn-pcc-primary text-white fw-bold px-4" disabled={savingLookup}>
                      {savingLookup ? 'Saving...' : 'Save Changes'}
                    </button>
                  </DialogFooter>
                </form>
              </Dialog>
            </DialogTrigger>
          )}
        </ModalPortal>
      )}
    </div>
  );
}
