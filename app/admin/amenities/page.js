'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';

export default function AdminAmenities() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'edit' | null
  const [selectedItem, setSelectedItem] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    amenityCategoryID: '',
    price: 0,
    quantity: 0,
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

  const fetchAmenities = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search,
        catID: catFilter,
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
  }, [search, catFilter, showArchived]);

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
    if (parseFloat(formData.price) < 0) {
      showAlert('error', 'Validation Error', 'Price cannot be negative.');
      return;
    }
    if (parseInt(formData.quantity) < 0) {
      showAlert('error', 'Validation Error', 'Quantity cannot be negative.');
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
    if (parseFloat(formData.price) < 0) {
      showAlert('error', 'Validation Error', 'Price cannot be negative.');
      return;
    }
    if (parseInt(formData.quantity) < 0) {
      showAlert('error', 'Validation Error', 'Quantity cannot be negative.');
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

  const openCreateModal = () => {
    setFormData({
      name: '',
      amenityCategoryID: categories[0]?.amenityCategoryID || '',
      price: 0.00,
      quantity: 0,
    });
    setActiveModal('create');
  };

  const openEditModal = (item) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      amenityCategoryID: item.amenityCategoryID,
      price: item.price,
      quantity: item.quantity,
    });
    setActiveModal('edit');
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
            🛎️ Active Amenities
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${showArchived ? 'active text-blue' : 'text-muted'}`}
            onClick={() => setShowArchived(true)}
          >
            📦 Archived Amenities
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
              placeholder="Search by name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-md-4">
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
          <div className="col-md-3 d-flex gap-2">
            <button className="btn btn-pcc-outline w-100" onClick={() => { setSearch(''); setCatFilter(''); }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Amenities Table */}
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
                  <th>#</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Stock Alert</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted py-4">
                      No amenities found.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={item.amenityID} className={item.quantity <= 5 && !showArchived ? 'table-warning' : ''}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>{item.catName}</td>
                      <td>₱{parseFloat(item.price).toFixed(2)}</td>
                      <td>{item.quantity}</td>
                      <td>
                        {item.quantity <= 5 ? (
                          <span className="badge text-bg-warning">Low Stock</span>
                        ) : (
                          <span className="badge text-bg-success">OK</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <button
                            className="btn btn-sm btn-warning text-white"
                            onClick={() => openEditModal(item)}
                          >
                            Update
                          </button>
                          {showArchived ? (
                            <button
                              className="btn btn-sm btn-success text-white"
                              onClick={() => handleRestore(item.amenityID)}
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-danger text-white"
                              onClick={() => handleArchive(item.amenityID)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
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
                  <div className="row g-2">
                    <div className="col">
                      <label className="form-label">Price (₱) *</label>
                      <input
                        type="number"
                        name="price"
                        step="0.01"
                        className="form-control"
                        required
                        value={formData.price}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col">
                      <label className="form-label">Initial Stock *</label>
                      <input
                        type="number"
                        name="quantity"
                        className="form-control"
                        required
                        value={formData.quantity}
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
                  <div className="row g-2">
                    <div className="col">
                      <label className="form-label">Price (₱) *</label>
                      <input
                        type="number"
                        name="price"
                        step="0.01"
                        className="form-control"
                        required
                        value={formData.price}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="col">
                      <label className="form-label">Stock Qty *</label>
                      <input
                        type="number"
                        name="quantity"
                        className="form-control"
                        required
                        value={formData.quantity}
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
