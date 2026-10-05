'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';
import ActionButtons from '../../components/ActionButtons';
import { SkeletonTable } from '@/app/components/skeletons/Skeleton';

export default function AdminAmenities() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const fetchAmenities = async () => {
    setLoading(true);
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

      setItems(data.items || []);
      setCategories(data.categories || []);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAmenities();
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
        fetchAmenities();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleArchive = async (amenityID) => {
    showConfirm('Delete Amenity', 'Are you sure you want to delete this amenity? It will be hidden from active inventory.', async () => {
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
        if (!res.ok) throw new Error(data.error || 'Failed to delete');

        showAlert('success', 'Success', data.message || 'Amenity deleted successfully');
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

  return (
    <div className="pcc-page-container">
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
          <h2 className="section-title mb-0">Amenities Management</h2>
        </div>
        <button className="btn btn-pcc-primary text-white" onClick={openCreateModal}>
          + Create Amenity
        </button>
      </div>

      {/* Tabs for Active vs Archived */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${!showArchived ? 'active text-blue' : 'text-muted'}`}
            onClick={() => setShowArchived(false)}
          >
            Active Amenities
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${showArchived ? 'active text-blue' : 'text-muted'}`}
            onClick={() => setShowArchived(true)}
          >
            Archived Amenities
          </button>
        </li>
      </ul>

      {/* Search & Filters */}
      <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <input
              type="text"
              className="form-control"
              placeholder="Search by name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
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
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="Consumable">Consumable</option>
              <option value="Non-Consumable">Non-Consumable</option>
            </select>
          </div>
          <div className="col-md-2 d-flex gap-2">
            <button className="btn btn-pcc-primary text-white w-100" onClick={() => { setSearch(''); setCatFilter(''); setTypeFilter(''); }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Amenities Table */}
      <div className="card-module pcc-table-card" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        {loading ? (
          <SkeletonTable columns={8} rows={7} colWidths={['5%', '22%', '13%', '12%', '12%', '8%', '18%', '10%']} />
        ) : (
          <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
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
                  items.map((item, index) => (
                    <tr key={item.amenityID}>
                      <td>{index + 1}</td>
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
                <h5 className="modal-title">Create Amenity</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCreateSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Name *</label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Category *</label>
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
                  <div className="mb-3">
                    <label className="form-label">Item Type *</label>
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
                  <div className="mb-3">
                    <label className="form-label">Unit *</label>
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
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      name="description"
                      className="form-control"
                      rows="2"
                      value={formData.description}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Amenity Photo</label>
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
                          style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="row g-2">
                    <div className="col-md-4">
                      <label className="form-label">Base Price (₱) *</label>
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
                      <label className="form-label">Selling Price (₱) *</label>
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
                      <label className="form-label">Min Stock Level *</label>
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
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Update Amenity</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Name *</label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Category *</label>
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
                  <div className="mb-3">
                    <label className="form-label">Item Type *</label>
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
                  <div className="mb-3">
                    <label className="form-label">Unit *</label>
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
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      name="description"
                      className="form-control"
                      rows="2"
                      value={formData.description}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Amenity Photo</label>
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
                          style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="row g-2">
                    <div className="col-md-4">
                      <label className="form-label">Base Price (₱) *</label>
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
                      <label className="form-label">Selling Price (₱) *</label>
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
                      <label className="form-label">Min Stock Level *</label>
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
    </div>
  );
}
