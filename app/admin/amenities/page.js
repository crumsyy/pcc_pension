'use client';

import { useState, useEffect, useRef } from 'react';
import ModalDialog from '../../components/ModalDialog';
import ModalPortal from '../../components/ModalPortal';
import ActionButtons from '../../components/ActionButtons';
import AdminPagination, { ADMIN_PAGE_SIZE, paginate } from '../../components/AdminPagination';
import { Tabs, TabList, Tab } from '@/components/ui/tabs';
import clientCache, { CACHE_TTL } from '@/lib/clientCache';
import { toast } from '@/components/ui/toast';

export default function AdminAmenities() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimer = useRef(null);
  const [catFilter, setCatFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); }, 350);
  };
  const handleCatFilterChange = (e) => { setCatFilter(e.target.value); setPage(1); };
  const handleTypeFilterChange = (e) => { setTypeFilter(e.target.value); setPage(1); };
  const handleShowActive = () => { setShowArchived(false); setPage(1); };
  const handleShowArchivedTab = () => { setShowArchived(true); setPage(1); };
  const handleClearFilters = () => { if (searchTimer.current) clearTimeout(searchTimer.current); setSearch(''); setSearchInput(''); setCatFilter(''); setTypeFilter(''); setPage(1); };

  const baseCacheKey = `admin-amenities:${search}_${catFilter}_${typeFilter}_${showArchived}`;
  const cached = clientCache.get(baseCacheKey);
  const [items, setItems] = useState(cached?.data?.items || []);
  const [categories, setCategories] = useState(cached?.data?.categories || []);
  const [shouldAnimate, setShouldAnimate] = useState(!cached);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'edit' | null
  const [selectedItem, setSelectedItem] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    amenityCategoryID: '',
    basePrice: 0,
    sellingPrice: 0,
    minStock: 5,
    itemType: 'Consumable',
    unit: 'pcs',
    description: '',
    image: '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);

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

  const fetchAmenities = async (isBackground = false) => {
    try {
      const query = new URLSearchParams({
        search,
        catID: catFilter,
        itemType: typeFilter,
        archived: showArchived ? 'true' : 'false',
      }).toString();

      const res = await fetch(`/api/admin/amenities?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch amenities');

      const itemsData = data.items || [];
      const categoriesData = data.categories || [];

      setItems(itemsData);
      setCategories(categoriesData);

      clientCache.set(baseCacheKey, {
        items: itemsData,
        categories: categoriesData
      }, CACHE_TTL.AMENITIES);
    } catch (err) {
      if (!isBackground) showAlert('error', 'Error', err.message);
      else console.warn('Background amenities refresh error:', err.message);
    }
  };

  useEffect(() => {
    const entry = clientCache.get(baseCacheKey);
    if (!entry) {
      fetchAmenities(false);
    } else {
      setItems(entry.data.items || []);
      setCategories(entry.data.categories || []);
      if (entry.isStale) {
        fetchAmenities(true);
      }
    }
  }, [search, catFilter, typeFilter, showArchived]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showAlert('error', 'Validation Error', 'Name is required and cannot be empty.');
      return;
    }
    if (parseFloat(formData.basePrice) < 0) {
      showAlert('error', 'Validation Error', 'Base Price cannot be negative.');
      return;
    }
    if (parseFloat(formData.sellingPrice) < 0) {
      showAlert('error', 'Validation Error', 'Selling Price cannot be negative.');
      return;
    }
    if (parseFloat(formData.sellingPrice) < parseFloat(formData.basePrice)) {
      showAlert('error', 'Validation Error', 'Selling Price must be greater than or equal to Base Price.');
      return;
    }

    showConfirm('Create Amenity', 'Are you sure you want to create this amenity?', async () => {
      try {
        const res = await fetch('/api/admin/amenities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            ...formData,
            name: formData.name.trim()
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create amenity');

        showAlert('success', 'Success', data.message || 'Amenity created successfully');
        setActiveModal(null);
        clientCache.invalidate('admin-amenities');
        fetchAmenities();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showAlert('error', 'Validation Error', 'Name is required and cannot be empty.');
      return;
    }
    if (parseFloat(formData.basePrice) < 0) {
      showAlert('error', 'Validation Error', 'Base Price cannot be negative.');
      return;
    }
    if (parseFloat(formData.sellingPrice) < 0) {
      showAlert('error', 'Validation Error', 'Selling Price cannot be negative.');
      return;
    }
    if (parseFloat(formData.sellingPrice) < parseFloat(formData.basePrice)) {
      showAlert('error', 'Validation Error', 'Selling Price must be greater than or equal to Base Price.');
      return;
    }

    showConfirm('Update Amenity', 'Are you sure you want to save changes to this amenity?', async () => {
      try {
        const res = await fetch('/api/admin/amenities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            amenityID: selectedItem.amenityID,
            ...formData,
            name: formData.name.trim()
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update amenity');

        showAlert('success', 'Success', data.message || 'Amenity updated successfully');
        setActiveModal(null);
        clientCache.invalidate('admin-amenities');
        fetchAmenities();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleArchive = async (amenityID) => {
    showConfirm('Archive Amenity', 'Are you sure you want to archive this amenity? It will be hidden from active inventory.', async () => {
      try {
        const res = await fetch('/api/admin/amenities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'archive',
            amenityID
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to archive');

        showAlert('success', 'Success', data.message || 'Amenity archived successfully');
        clientCache.invalidate('admin-amenities');
        fetchAmenities();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleRestore = async (amenityID) => {
    showConfirm('Restore Amenity', 'Are you sure you want to restore this amenity to active listings?', async () => {
      try {
        const res = await fetch('/api/admin/amenities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'restore',
            amenityID
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to restore');

        showAlert('success', 'Success', data.message || 'Amenity restored successfully');
        clientCache.invalidate('admin-amenities');
        fetchAmenities();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const dataForm = new FormData();
      dataForm.append('file', file);
      dataForm.append('type', 'amenities');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: dataForm
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload image');
      if (data.url) {
        setFormData(prev => ({ ...prev, image: data.url }));
      }
    } catch (err) {
      showAlert('error', 'Upload Failed', err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const openCreateModal = () => {
    setFormData({
      name: '',
      amenityCategoryID: categories[0]?.amenityCategoryID || '',
      basePrice: 0.00,
      sellingPrice: 0.00,
      minStock: 5,
      itemType: 'Consumable',
      unit: 'pcs',
      description: '',
      image: '',
    });
    setActiveModal('create');
  };

  const openEditModal = (item) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      amenityCategoryID: item.amenityCategoryID,
      basePrice: item.basePrice !== undefined ? item.basePrice : item.price,
      sellingPrice: item.sellingPrice !== undefined ? item.sellingPrice : item.price,
      minStock: item.minStock !== undefined ? item.minStock : 5,
      itemType: item.itemType || 'Consumable',
      unit: item.unit || 'pcs',
      description: item.description || '',
      image: item.image || '',
    });
    setActiveModal('edit');
  };

  const { totalPages, safePage, rows: pagedItems, start, end, total } = paginate(items, page, ADMIN_PAGE_SIZE);

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

      <div className="d-flex justify-content-end align-items-center mb-3">
        <button className="btn btn-pcc-primary text-white" onClick={openCreateModal}>
          + Create Amenity
        </button>
      </div>

      {/* Tabs for Active vs Archived */}
      <Tabs selectedKey={showArchived ? 'archived' : 'active'} onSelectionChange={(key) => { if (key === 'archived') handleShowArchivedTab(); else handleShowActive(); }} className="mb-3">
        <TabList aria-label="Amenity lists">
          <Tab id="active">Active Amenities</Tab>
          <Tab id="archived">Archived Amenities</Tab>
        </TabList>
      </Tabs>

      {/* Search & Filters */}
      <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <input
              type="text"
              className="form-control"
              placeholder="Search by name or category..."
              value={searchInput}
              onChange={handleSearchChange}
            />
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={catFilter}
              onChange={handleCatFilterChange}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.amenityCategoryID} value={c.amenityCategoryID}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={typeFilter}
              onChange={handleTypeFilterChange}
            >
              <option value="">All Types</option>
              <option value="Consumable">Consumable</option>
              <option value="Non-Consumable">Non-Consumable</option>
            </select>
          </div>
          <div className="col-md-2 d-flex gap-2">
            <button className="btn btn-pcc-primary text-white w-100" onClick={handleClearFilters}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Amenities Table */}
      <div className="card-module pcc-table-card" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
          <div className={`table-responsive ${shouldAnimate ? 'pcc-content-reveal' : ''}`} style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Pricing</th>
                  <th>Item Type</th>
                  <th>Unit</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center text-muted py-4">
                      No amenities found.
                    </td>
                  </tr>
                ) : (
                  pagedItems.map((item, index) => (
                    <tr key={item.amenityID}>
                      <td>{start + index}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          {item.image ? (
                            <img src={item.image} alt={item.name} style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px' }} />
                          ) : (
                            <div className="bg-light text-muted d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px', borderRadius: '4px', fontSize: '0.85rem' }}>
                              🛎️
                            </div>
                          )}
                          <strong>{item.name}</strong>
                        </div>
                      </td>
                      <td>{item.catName}</td>
                      <td>
                        <div className="small"><strong>Base:</strong> ₱{parseFloat(item.basePrice || item.price || 0).toFixed(2)}</div>
                        <div className="small text-muted"><strong>Sell:</strong> ₱{parseFloat(item.sellingPrice || item.price || 0).toFixed(2)}</div>
                      </td>
                      <td>
                        <span className={`badge ${item.itemType === 'Consumable' ? 'text-bg-info' : 'text-bg-secondary'}`}>
                          {item.itemType}
                        </span>
                      </td>
                      <td>{item.unit}</td>
                      <td className="text-truncate" style={{ maxWidth: '200px' }} title={item.description}>
                        {item.description || '—'}
                      </td>
                      <td>
                        <ActionButtons
                          onEdit={!showArchived ? () => openEditModal(item) : null}
                          onArchive={!showArchived ? () => handleArchive(item.amenityID) : null}
                          onRestore={showArchived ? () => handleRestore(item.amenityID) : null}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <AdminPagination page={safePage} totalPages={totalPages} onPage={setPage} start={start} end={end} total={total} label="amenities" />
      </div>

      {/* ==========================================
          MODALS
          ========================================== */}
      {activeModal && (
        <ModalPortal>
          {/* CREATE MODAL */}
          {activeModal === 'create' && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '640px' }}>
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Create Amenity</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCreateSubmit}>
                <div className="modal-body p-3">
                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Name <span className="required-asterisk">*</span></label>
                      <input
                        type="text"
                        name="name"
                        className="form-control"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Category <span className="required-asterisk">*</span></label>
                      <select
                        name="amenityCategoryID"
                        className="form-select"
                        required
                        value={formData.amenityCategoryID}
                        onChange={handleInputChange}
                      >
                        <option value="" disabled>Select category</option>
                        {categories.map(c => (
                          <option key={c.amenityCategoryID} value={c.amenityCategoryID}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Item Type <span className="required-asterisk">*</span></label>
                      <select
                        name="itemType"
                        className="form-select"
                        required
                        value={formData.itemType}
                        onChange={handleInputChange}
                      >
                        <option value="Consumable">Consumable</option>
                        <option value="Non-Consumable">Non-Consumable</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Unit <span className="required-asterisk">*</span></label>
                      <input
                        type="text"
                        name="unit"
                        className="form-control"
                        placeholder="e.g. pcs, pairs, bottles"
                        required
                        value={formData.unit}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold mb-1">Base Price (₱) <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        name="basePrice"
                        step="0.01"
                        className="form-control"
                        required
                        value={formData.basePrice}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold mb-1">Selling Price (₱) <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        name="sellingPrice"
                        step="0.01"
                        className="form-control"
                        required
                        value={formData.sellingPrice}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold mb-1">Min Stock Level <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        name="minStock"
                        className="form-control"
                        required
                        min="1"
                        value={formData.minStock}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-1">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Amenity Photo</label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                      />
                      {uploadingImage && <small className="text-primary d-block mt-1">Uploading image...</small>}
                      {formData.image && (
                        <div className="mt-2 d-flex align-items-center gap-2">
                          <img
                            src={formData.image}
                            alt="Amenity preview"
                            style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px' }}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Description (Optional)</label>
                      <textarea
                        name="description"
                        className="form-control"
                        rows="2"
                        value={formData.description}
                        onChange={handleInputChange}
                        placeholder="Enter description..."
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Create Amenity</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {activeModal === 'edit' && selectedItem && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '640px' }}>
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Update Amenity</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body p-3">
                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Name <span className="required-asterisk">*</span></label>
                      <input
                        type="text"
                        name="name"
                        className="form-control"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Category <span className="required-asterisk">*</span></label>
                      <select
                        name="amenityCategoryID"
                        className="form-select"
                        required
                        value={formData.amenityCategoryID}
                        onChange={handleInputChange}
                      >
                        {categories.map(c => (
                          <option key={c.amenityCategoryID} value={c.amenityCategoryID}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Item Type <span className="required-asterisk">*</span></label>
                      <select
                        name="itemType"
                        className="form-select"
                        required
                        value={formData.itemType}
                        onChange={handleInputChange}
                      >
                        <option value="Consumable">Consumable</option>
                        <option value="Non-Consumable">Non-Consumable</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Unit <span className="required-asterisk">*</span></label>
                      <input
                        type="text"
                        name="unit"
                        className="form-control"
                        placeholder="e.g. pcs, pairs, bottles"
                        required
                        value={formData.unit}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-2">
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold mb-1">Base Price (₱) <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        name="basePrice"
                        step="0.01"
                        className="form-control"
                        required
                        value={formData.basePrice}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold mb-1">Selling Price (₱) <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        name="sellingPrice"
                        step="0.01"
                        className="form-control"
                        required
                        value={formData.sellingPrice}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold mb-1">Min Stock Level <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        name="minStock"
                        className="form-control"
                        required
                        min="1"
                        value={formData.minStock}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-1">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Amenity Photo</label>
                      <input
                        type="file"
                        className="form-control"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                      />
                      {uploadingImage && <small className="text-primary d-block mt-1">Uploading image...</small>}
                      {formData.image && (
                        <div className="mt-2 d-flex align-items-center gap-2">
                          <img
                            src={formData.image}
                            alt="Amenity preview"
                            style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px' }}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Description (Optional)</label>
                      <textarea
                        name="description"
                        className="form-control"
                        rows="2"
                        value={formData.description}
                        onChange={handleInputChange}
                        placeholder="Enter description..."
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Update Amenity</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
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
