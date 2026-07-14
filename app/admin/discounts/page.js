'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';
import ActionButtons from '../../components/ActionButtons';
import DateInput, { isValidDate, toDbDate, toUiDate } from '../../components/DateInput';

export default function AdminDiscounts() {
  const [discounts, setDiscounts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [discountTypes, setDiscountTypes] = useState([]);
  const [eligibilityTypes, setEligibilityTypes] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);

  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'create_disc' | 'edit_disc' | 'create_promo' | 'edit_promo' | null
  const [selectedDisc, setSelectedDisc] = useState(null);
  const [selectedPromo, setSelectedPromo] = useState(null);

  // Form states
  const [discFormData, setDiscFormData] = useState({
    name: '',
    description: '',
    percentage: 0,
    requiredBookings: 0,
    discountTypeID: '',
    eligibilityTypeID: '',
  });

  const [promoFormData, setPromoFormData] = useState({
    name: '',
    description: '',
    percentage: 0,
    roomID: '',
    roomTypeID: '',
    startDate: '',
    endDate: '',
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

  const fetchData = async (isSilent = false, isInitial = false) => {
    if (!isSilent) setLoading(true);
    try {
      const query = new URLSearchParams({
        search,
        archived: showArchived ? 'true' : 'false',
        lookups: isInitial ? 'true' : 'false'
      }).toString();
      const res = await fetch(`/api/admin/discounts?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch data');

      setDiscounts(data.discounts || []);
      setPromotions(data.promotions || []);
      if (isInitial) {
        setDiscountTypes(data.discountTypes || []);
        setEligibilityTypes(data.eligibilityTypes || []);
        setRooms(data.rooms || []);
        setRoomTypes(data.roomTypes || []);
      }
    } catch (err) {
      if (!isSilent) showAlert('error', 'Error', err.message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(false, true);
  }, [search, showArchived]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true, false);
    }, 5000);
    return () => clearInterval(interval);
  }, [search, showArchived]);

  const handleDiscInputChange = (e) => {
    const { name, value } = e.target;
    setDiscFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePromoInputChange = (e) => {
    const { name, value } = e.target;
    setPromoFormData(prev => ({ ...prev, [name]: value }));
  };

  // Discount Handlers
  const handleCreateDiscSubmit = async (e) => {
    e.preventDefault();
    if (!discFormData.name.trim()) {
      showAlert('error', 'Validation Error', 'Name is required and cannot be empty.');
      return;
    }
    const pct = parseFloat(discFormData.percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      showAlert('error', 'Validation Error', 'Percentage must be a number between 0 and 100.');
      return;
    }
    if (parseInt(discFormData.requiredBookings || 0) < 0) {
      showAlert('error', 'Validation Error', 'Required bookings cannot be negative.');
      return;
    }

    showConfirm('Create Discount', 'Are you sure you want to create this discount?', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_discount',
            ...discFormData,
            name: discFormData.name.trim()
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create discount');
        showAlert('success', 'Success', data.message || 'Discount created successfully');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleEditDiscSubmit = async (e) => {
    e.preventDefault();
    if (!discFormData.name.trim()) {
      showAlert('error', 'Validation Error', 'Name is required and cannot be empty.');
      return;
    }
    const pct = parseFloat(discFormData.percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      showAlert('error', 'Validation Error', 'Percentage must be a number between 0 and 100.');
      return;
    }
    if (parseInt(discFormData.requiredBookings || 0) < 0) {
      showAlert('error', 'Validation Error', 'Required bookings cannot be negative.');
      return;
    }

    showConfirm('Update Discount', 'Are you sure you want to save changes to this discount?', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_discount',
            discountID: selectedDisc.discountID,
            ...discFormData,
            name: discFormData.name.trim()
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update discount');
        showAlert('success', 'Success', data.message || 'Discount updated successfully');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleArchiveDisc = async (discountID) => {
    showConfirm('Delete Discount', 'Are you sure you want to delete this discount? It will be hidden from active inventory.', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'archive_discount', discountID }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete');
        showAlert('success', 'Success', data.message || 'Discount deleted successfully');
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleRestoreDisc = async (discountID) => {
    showConfirm('Restore Discount', 'Are you sure you want to restore this discount to active listings?', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore_discount', discountID }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to restore');
        showAlert('success', 'Success', data.message || 'Discount restored successfully');
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  // Promo Handlers
  const handleCreatePromoSubmit = async (e) => {
    e.preventDefault();
    if (!promoFormData.name.trim()) {
      showAlert('error', 'Validation Error', 'Name is required and cannot be empty.');
      return;
    }
    const pct = parseFloat(promoFormData.percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      showAlert('error', 'Validation Error', 'Percentage must be a number between 0 and 100.');
      return;
    }
    if (!promoFormData.startDate || !isValidDate(promoFormData.startDate)) {
      showAlert('error', 'Validation Error', 'Please enter a valid Start Date (MM/DD/YYYY).');
      return;
    }
    if (!promoFormData.endDate || !isValidDate(promoFormData.endDate)) {
      showAlert('error', 'Validation Error', 'Please enter a valid End Date (MM/DD/YYYY).');
      return;
    }
    if (toDbDate(promoFormData.endDate) < toDbDate(promoFormData.startDate)) {
      showAlert('error', 'Validation Error', 'End Date cannot be earlier than Start Date.');
      return;
    }

    showConfirm('Create Promotion', 'Are you sure you want to create this promotion?', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_promo',
            ...promoFormData,
            startDate: toDbDate(promoFormData.startDate),
            endDate: toDbDate(promoFormData.endDate),
            name: promoFormData.name.trim()
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create promo');
        showAlert('success', 'Success', data.message || 'Promotion created successfully');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleEditPromoSubmit = async (e) => {
    e.preventDefault();
    if (!promoFormData.name.trim()) {
      showAlert('error', 'Validation Error', 'Name is required and cannot be empty.');
      return;
    }
    const pct = parseFloat(promoFormData.percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      showAlert('error', 'Validation Error', 'Percentage must be a number between 0 and 100.');
      return;
    }
    if (!promoFormData.startDate || !isValidDate(promoFormData.startDate)) {
      showAlert('error', 'Validation Error', 'Please enter a valid Start Date (MM/DD/YYYY).');
      return;
    }
    if (!promoFormData.endDate || !isValidDate(promoFormData.endDate)) {
      showAlert('error', 'Validation Error', 'Please enter a valid End Date (MM/DD/YYYY).');
      return;
    }
    if (toDbDate(promoFormData.endDate) < toDbDate(promoFormData.startDate)) {
      showAlert('error', 'Validation Error', 'End Date cannot be earlier than Start Date.');
      return;
    }

    showConfirm('Update Promotion', 'Are you sure you want to save changes to this promotion?', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_promo',
            promotionID: selectedPromo.promotionID,
            ...promoFormData,
            startDate: toDbDate(promoFormData.startDate),
            endDate: toDbDate(promoFormData.endDate),
            name: promoFormData.name.trim()
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update promo');
        showAlert('success', 'Success', data.message || 'Promotion updated successfully');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleArchivePromo = async (promotionID) => {
    showConfirm('Delete Promotion', 'Are you sure you want to delete this promotion? It will be hidden from active inventory.', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'archive_promo', promotionID }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete');
        showAlert('success', 'Success', data.message || 'Promotion deleted successfully');
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleRestorePromo = async (promotionID) => {
    showConfirm('Restore Promotion', 'Are you sure you want to restore this promotion to active listings?', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore_promo', promotionID }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to restore');
        showAlert('success', 'Success', data.message || 'Promotion restored successfully');
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const openCreateDiscModal = () => {
    setDiscFormData({
      name: '',
      description: '',
      percentage: 5,
      requiredBookings: 0,
      discountTypeID: discountTypes[0]?.discountTypeID || '',
      eligibilityTypeID: eligibilityTypes[0]?.eligibilityTypeID || '',
    });
    setActiveModal('create_disc');
  };

  const openEditDiscModal = (d) => {
    setSelectedDisc(d);
    setDiscFormData({
      name: d.name,
      description: d.description || '',
      percentage: d.percentage,
      requiredBookings: d.requiredBookings || 0,
      discountTypeID: d.discountTypeID,
      eligibilityTypeID: d.eligibilityTypeID,
    });
    setActiveModal('edit_disc');
  };

  const openCreatePromoModal = () => {
    setPromoFormData({
      name: '',
      description: '',
      percentage: 5,
      roomID: '',
      roomTypeID: '',
      startDate: '',
      endDate: '',
    });
    setActiveModal('create_promo');
  };

  const openEditPromoModal = (p) => {
    setSelectedPromo(p);
    setPromoFormData({
      name: p.name,
      description: p.description || '',
      percentage: p.percentage,
      roomID: p.roomID || '',
      roomTypeID: p.roomTypeID || '',
      startDate: p.startDate ? toUiDate(p.startDate) : '',
      endDate: p.endDate ? toUiDate(p.endDate) : '',
    });
    setActiveModal('edit_promo');
  };

  const isPromoActive = (startDate, endDate) => {
    const today = new Date().toISOString().substring(0, 10);
    const start = new Date(startDate).toISOString().substring(0, 10);
    const end = new Date(endDate).toISOString().substring(0, 10);
    return today >= start && today <= end;
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
          <h2 className="section-title mb-0">Discounts &amp; Promotions</h2>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <button className="btn btn-pcc-primary ms-2" onClick={openCreateDiscModal}>
            + Create Discount
          </button>
          <button className="btn btn-pcc-primary" onClick={openCreatePromoModal}>
            + Create Promotion
          </button>
        </div>
      </div>

      {/* Tabs for Active vs Archived */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${!showArchived ? 'active text-blue' : 'text-muted'}`}
            onClick={() => setShowArchived(false)}
          >
            🏷️ Active Discounts &amp; Promos
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${showArchived ? 'active text-blue' : 'text-muted'}`}
            onClick={() => setShowArchived(true)}
          >
            📦 Archived Discounts &amp; Promos
          </button>
        </li>
      </ul>

      {/* Search Filter */}
      <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="row g-2 align-items-end">
          <div className="col-md-9">
            <input
              type="text"
              className="form-control"
              placeholder="Search by discount/promo name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <button className="btn btn-pcc-outline w-100" onClick={() => setSearch('')}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Discounts Section */}
          <div className="card-module mb-4" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
            <h4 className="mb-3 text-blue">🏷 Discounts</h4>
            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Eligibility</th>
                    <th>%</th>
                    <th>Req. Bookings</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {discounts.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-3">
                        No discounts configured.
                      </td>
                    </tr>
                  ) : (
                    discounts.map((d) => (
                      <tr key={d.discountID}>
                        <td>
                          <strong>{d.name}</strong>
                          <br />
                          <small className="text-muted">{d.description}</small>
                        </td>
                        <td>{d.discType}</td>
                        <td>{d.eligibility}</td>
                        <td>
                          <span className="badge text-bg-success">{d.percentage}%</span>
                        </td>
                        <td>{d.requiredBookings > 0 ? `${d.requiredBookings} stays` : '—'}</td>
                        <td>
                          <ActionButtons
                            onEdit={!showArchived ? () => openEditDiscModal(d) : null}
                            onDelete={!showArchived ? () => handleArchiveDisc(d.discountID) : null}
                            onRestore={showArchived ? () => handleRestoreDisc(d.discountID) : null}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Promotions Section */}
          <div className="card-module" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
            <h4 className="mb-3 text-blue">🔥 Promotions</h4>
            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>%</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Applicability</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promotions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-3">
                        No promotions configured.
                      </td>
                    </tr>
                  ) : (
                    promotions.map((p) => {
                      const active = isPromoActive(p.startDate, p.endDate);
                      return (
                        <tr key={p.promotionID}>
                          <td>
                            <strong>{p.name}</strong>
                            <br />
                            <small className="text-muted">{p.description}</small>
                          </td>
                          <td>
                            <span className="badge text-bg-success">{p.percentage}%</span>
                          </td>
                          <td>
                            {new Date(p.startDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td>
                            {new Date(p.endDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td>{p.roomNumber ? `Room ${p.roomNumber}` : p.roomTypeName ? `Room Type: ${p.roomTypeName}` : 'All Rooms'}</td>
                          <td>
                            {active ? (
                              <span className="badge text-bg-success">Active</span>
                            ) : (
                              <span className="badge text-bg-secondary">Inactive</span>
                            )}
                          </td>
                          <td>
                            <ActionButtons
                              onEdit={!showArchived ? () => openEditPromoModal(p) : null}
                              onDelete={!showArchived ? () => handleArchivePromo(p.promotionID) : null}
                              onRestore={showArchived ? () => handleRestorePromo(p.promotionID) : null}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ==========================================
          MODALS — DISCOUNTS
          ========================================== */}

      {/* CREATE DISCOUNT MODAL */}
      {activeModal === 'create_disc' && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Create Discount</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCreateDiscSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Name *</label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      required
                      value={discFormData.name}
                      onChange={handleDiscInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      name="description"
                      className="form-control"
                      rows="2"
                      value={discFormData.description}
                      onChange={handleDiscInputChange}
                    ></textarea>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col">
                      <label className="form-label">Percentage (1-100) *</label>
                      <input
                        type="number"
                        name="percentage"
                        className="form-control"
                        min="1"
                        max="100"
                        required
                        value={discFormData.percentage}
                        onChange={handleDiscInputChange}
                      />
                    </div>
                    <div className="col">
                      <label className="form-label">Req. Bookings (Conditional)</label>
                      <input
                        type="number"
                        name="requiredBookings"
                        className="form-control"
                        min="0"
                        value={discFormData.requiredBookings}
                        onChange={handleDiscInputChange}
                      />
                    </div>
                  </div>
                  <div className="row g-2">
                    <div className="col">
                      <label className="form-label">Discount Type *</label>
                      <select
                        name="discountTypeID"
                        className="form-select"
                        required
                        value={discFormData.discountTypeID}
                        onChange={handleDiscInputChange}
                      >
                        <option value="" disabled>Select</option>
                        {discountTypes.map(t => (
                          <option key={t.discountTypeID} value={t.discountTypeID}>{t.type}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col">
                      <label className="form-label">Eligibility *</label>
                      <select
                        name="eligibilityTypeID"
                        className="form-select"
                        required
                        value={discFormData.eligibilityTypeID}
                        onChange={handleDiscInputChange}
                      >
                        <option value="" disabled>Select</option>
                        {eligibilityTypes.map(e => (
                          <option key={e.eligibilityTypeID} value={e.eligibilityTypeID}>{e.eligibility}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Create Discount</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT DISCOUNT MODAL */}
      {activeModal === 'edit_disc' && selectedDisc && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Update Discount</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleEditDiscSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Name *</label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      required
                      value={discFormData.name}
                      onChange={handleDiscInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      name="description"
                      className="form-control"
                      rows="2"
                      value={discFormData.description}
                      onChange={handleDiscInputChange}
                    ></textarea>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col">
                      <label className="form-label">Percentage *</label>
                      <input
                        type="number"
                        name="percentage"
                        className="form-control"
                        min="1"
                        max="100"
                        required
                        value={discFormData.percentage}
                        onChange={handleDiscInputChange}
                      />
                    </div>
                    <div className="col">
                      <label className="form-label">Req. Bookings</label>
                      <input
                        type="number"
                        name="requiredBookings"
                        className="form-control"
                        min="0"
                        value={discFormData.requiredBookings}
                        onChange={handleDiscInputChange}
                      />
                    </div>
                  </div>
                  <div className="row g-2">
                    <div className="col">
                      <label className="form-label">Discount Type *</label>
                      <select
                        name="discountTypeID"
                        className="form-select"
                        required
                        value={discFormData.discountTypeID}
                        onChange={handleDiscInputChange}
                      >
                        {discountTypes.map(t => (
                          <option key={t.discountTypeID} value={t.discountTypeID}>{t.type}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col">
                      <label className="form-label">Eligibility *</label>
                      <select
                        name="eligibilityTypeID"
                        className="form-select"
                        required
                        value={discFormData.eligibilityTypeID}
                        onChange={handleDiscInputChange}
                      >
                        {eligibilityTypes.map(e => (
                          <option key={e.eligibilityTypeID} value={e.eligibilityTypeID}>{e.eligibility}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Update Discount</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODALS — PROMOTIONS
          ========================================== */}

      {/* CREATE PROMO MODAL */}
      {activeModal === 'create_promo' && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Create Promotion</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCreatePromoSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Name *</label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      required
                      value={promoFormData.name}
                      onChange={handlePromoInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      name="description"
                      className="form-control"
                      rows="2"
                      value={promoFormData.description}
                      onChange={handlePromoInputChange}
                    ></textarea>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-md-4">
                      <label className="form-label">Percentage (1-100) *</label>
                      <input
                        type="number"
                        name="percentage"
                        className="form-control"
                        min="1"
                        max="100"
                        required
                        value={promoFormData.percentage}
                        onChange={handlePromoInputChange}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Room Limit (Optional)</label>
                      <select
                        name="roomID"
                        className="form-select"
                        value={promoFormData.roomID}
                        onChange={(e) => {
                          handlePromoInputChange(e);
                          if (e.target.value) {
                            setPromoFormData(prev => ({ ...prev, roomTypeID: '' }));
                          }
                        }}
                      >
                        <option value="">All Rooms</option>
                        {rooms.map(rm => (
                          <option key={rm.roomID} value={rm.roomID}>Room {rm.roomNumber}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Room Type Limit (Optional)</label>
                      <select
                        name="roomTypeID"
                        className="form-select"
                        value={promoFormData.roomTypeID}
                        onChange={(e) => {
                          handlePromoInputChange(e);
                          if (e.target.value) {
                            setPromoFormData(prev => ({ ...prev, roomID: '' }));
                          }
                        }}
                      >
                        <option value="">All Room Types</option>
                        {roomTypes.map(rt => (
                          <option key={rt.roomTypeID} value={rt.roomTypeID}>{rt.type}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="row g-2">
                    <div className="col">
                      <label className="form-label">Start Date *</label>
                      <DateInput
                        name="startDate"
                        className="form-control"
                        required
                        value={promoFormData.startDate}
                        onChange={handlePromoInputChange}
                      />
                    </div>
                    <div className="col">
                      <label className="form-label">End Date *</label>
                      <DateInput
                        name="endDate"
                        className="form-control"
                        required
                        value={promoFormData.endDate}
                        onChange={handlePromoInputChange}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Create Promotion</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PROMO MODAL */}
      {activeModal === 'edit_promo' && selectedPromo && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Update Promotion</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleEditPromoSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Name *</label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      required
                      value={promoFormData.name}
                      onChange={handlePromoInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      name="description"
                      className="form-control"
                      rows="2"
                      value={promoFormData.description}
                      onChange={handlePromoInputChange}
                    ></textarea>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-md-4">
                      <label className="form-label">Percentage *</label>
                      <input
                        type="number"
                        name="percentage"
                        className="form-control"
                        min="1"
                        max="100"
                        required
                        value={promoFormData.percentage}
                        onChange={handlePromoInputChange}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Room Limit</label>
                      <select
                        name="roomID"
                        className="form-select"
                        value={promoFormData.roomID}
                        onChange={(e) => {
                          handlePromoInputChange(e);
                          if (e.target.value) {
                            setPromoFormData(prev => ({ ...prev, roomTypeID: '' }));
                          }
                        }}
                      >
                        <option value="">All Rooms</option>
                        {rooms.map(rm => (
                          <option key={rm.roomID} value={rm.roomID}>Room {rm.roomNumber}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Room Type Limit</label>
                      <select
                        name="roomTypeID"
                        className="form-select"
                        value={promoFormData.roomTypeID}
                        onChange={(e) => {
                          handlePromoInputChange(e);
                          if (e.target.value) {
                            setPromoFormData(prev => ({ ...prev, roomID: '' }));
                          }
                        }}
                      >
                        <option value="">All Room Types</option>
                        {roomTypes.map(rt => (
                          <option key={rt.roomTypeID} value={rt.roomTypeID}>{rt.type}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="row g-2">
                    <div className="col">
                      <label className="form-label">Start Date *</label>
                      <DateInput
                        name="startDate"
                        className="form-control"
                        required
                        value={promoFormData.startDate}
                        onChange={handlePromoInputChange}
                      />
                    </div>
                    <div className="col">
                      <label className="form-label">End Date *</label>
                      <DateInput
                        name="endDate"
                        className="form-control"
                        required
                        value={promoFormData.endDate}
                        onChange={handlePromoInputChange}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Update Promotion</button>
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
