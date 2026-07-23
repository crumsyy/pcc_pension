'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';
import ActionButtons from '../../components/ActionButtons';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'meals' | 'archived'
  const [loading, setLoading] = useState(true);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'edit' | null
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    productCategoryID: '',
    basePrice: 0,
    sellingPrice: 0,
    minStock: 5,
    itemType: 'Consumable',
    unit: 'pcs',
    description: '',
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

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const isArchivedQuery = activeTab === 'archived';
      const query = new URLSearchParams({
        search,
        catID: activeTab === 'meals' ? '3' : catFilter,
        itemType: activeTab === 'meals' ? 'Consumable' : typeFilter,
        archived: isArchivedQuery ? 'true' : 'false',
      }).toString();

      const res = await fetch(`/api/admin/products?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch products');

      setProducts(data.products || []);
      setCategories(data.categories || []);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, catFilter, typeFilter, activeTab]);

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

    showConfirm('Create Product', 'Are you sure you want to create this product?', async () => {
      try {
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            ...formData,
            name: formData.name.trim()
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create product');

        showAlert('success', 'Success', data.message || 'Product created successfully');
        setActiveModal(null);
        fetchProducts();
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

    showConfirm('Update Product', 'Are you sure you want to save changes to this product?', async () => {
      try {
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            productID: selectedProduct.productID,
            ...formData,
            name: formData.name.trim()
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update product');

        showAlert('success', 'Success', data.message || 'Product updated successfully');
        setActiveModal(null);
        fetchProducts();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleArchive = async (productID) => {
    showConfirm('Delete Product', 'Are you sure you want to delete this product? It will be hidden from active inventory.', async () => {
      try {
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'archive',
            productID
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete');

        showAlert('success', 'Success', data.message || 'Product deleted successfully');
        fetchProducts();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleRestore = async (productID) => {
    showConfirm('Restore Product', 'Are you sure you want to restore this product to active listings?', async () => {
      try {
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'restore',
            productID
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to restore');

        showAlert('success', 'Success', data.message || 'Product restored successfully');
        fetchProducts();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleToggleAvailability = (productID, currentAvailability) => {
    const actionText = currentAvailability ? 'make this product unavailable?' : 'make this product available?';
    showConfirm('Toggle Availability', `Are you sure you want to ${actionText}`, async () => {
      try {
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'toggle_availability',
            productID,
            isAvailable: !currentAvailability
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update availability');

        showAlert('success', 'Success', data.message || 'Product availability updated successfully.');
        fetchProducts();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const openCreateModal = () => {
    setFormData({
      name: '',
      productCategoryID: activeTab === 'meals' ? '3' : (categories.find(c => c.productCategoryID !== 3)?.productCategoryID || ''),
      basePrice: 0.00,
      sellingPrice: 0.00,
      minStock: activeTab === 'meals' ? 0 : 5,
      itemType: 'Consumable',
      unit: activeTab === 'meals' ? 'serving' : 'pcs',
      description: '',
    });
    setActiveModal('create');
  };

  const openEditModal = (product) => {
    setSelectedProduct(product);
    const isMeal = product.productCategoryID === 3;
    setFormData({
      name: product.name,
      productCategoryID: product.productCategoryID,
      basePrice: product.basePrice !== undefined ? product.basePrice : product.price,
      sellingPrice: product.sellingPrice !== undefined ? product.sellingPrice : product.price,
      minStock: isMeal ? 0 : (product.minStock !== undefined ? product.minStock : 5),
      itemType: isMeal ? 'Consumable' : (product.itemType || 'Consumable'),
      unit: product.unit || (isMeal ? 'serving' : 'pcs'),
      description: product.description || '',
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
          <h2 className="section-title mb-0">Products Management</h2>
        </div>
        <button className="btn btn-pcc-primary text-white" onClick={openCreateModal}>
          + Create Product
        </button>
      </div>

      {/* Tabs for Products, Cooked Meals, and Archived */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'products' ? 'active text-blue' : 'text-muted'}`}
            onClick={() => {
              setActiveTab('products');
              setCatFilter('');
            }}
          >
            Active Products
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'meals' ? 'active text-blue' : 'text-muted'}`}
            onClick={() => {
              setActiveTab('meals');
              setCatFilter('3');
            }}
          >
            Cooked Meals
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'archived' ? 'active text-blue' : 'text-muted'}`}
            onClick={() => {
              setActiveTab('archived');
              setCatFilter('');
            }}
          >
            Archived Items
          </button>
        </li>
      </ul>

      {/* Search & Filters */}
      <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="row g-2 align-items-end">
          <div className={activeTab === 'meals' ? 'col-md-10' : 'col-md-4'}>
            <input
              type="text"
              className="form-control"
              placeholder={activeTab === 'meals' ? "Search cooked meals..." : "Search product name or category..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {activeTab !== 'meals' && (
            <>
              <div className="col-md-3">
                <select
                  className="form-select"
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories
                    .filter(c => activeTab !== 'products' || c.productCategoryID !== 3)
                    .map((c) => (
                      <option key={c.productCategoryID} value={c.productCategoryID}>
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
            </>
          )}
          <div className="col-md-2 d-flex gap-2">
            <button className="btn btn-pcc-primary text-white w-100" onClick={() => { setSearch(''); setCatFilter(activeTab === 'meals' ? '3' : ''); setTypeFilter(''); }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card-module pcc-table-card" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
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
                  <th>Daily Availability</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filteredProducts = products.filter(p => {
                    if (activeTab === 'products') return p.productCategoryID !== 3;
                    if (activeTab === 'meals') return p.productCategoryID === 3;
                    return true;
                  });

                  if (filteredProducts.length === 0) {
                    return (
                      <tr>
                        <td colSpan="9" className="text-center text-muted py-4">
                          No items found.
                        </td>
                      </tr>
                    );
                  }

                  return filteredProducts.map((p, index) => (
                    <tr key={p.productID}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>{p.catName}</td>
                      <td>
                        <div className="small"><strong>Base:</strong> ₱{parseFloat(p.basePrice || p.price || 0).toFixed(2)}</div>
                        <div className="small text-muted"><strong>Sell:</strong> ₱{parseFloat(p.sellingPrice || p.price || 0).toFixed(2)}</div>
                      </td>
                      <td>
                        <span className={`badge ${p.itemType === 'Consumable' ? 'text-bg-info' : 'text-bg-secondary'}`}>
                          {p.itemType}
                        </span>
                      </td>
                      <td>{p.unit}</td>
                      <td className="text-truncate" style={{ maxWidth: '150px' }} title={p.description}>
                        {p.description || '—'}
                      </td>
                      <td>
                        {p.productCategoryID === 3 ? (
                          <div className="form-check form-switch mb-0">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              role="switch"
                              id={`avail-switch-${p.productID}`}
                              checked={!!p.isAvailable}
                              disabled={activeTab === 'archived'}
                              onChange={() => handleToggleAvailability(p.productID, !!p.isAvailable)}
                            />
                            <label className="form-check-label small text-muted ms-1" htmlFor={`avail-switch-${p.productID}`}>
                              {p.isAvailable ? 'Available' : 'Unavailable'}
                            </label>
                          </div>
                        ) : (
                          <span className="badge text-bg-light border text-muted">Always Available</span>
                        )}
                      </td>
                      <td>
                        <ActionButtons
                          onEdit={activeTab !== 'archived' ? () => openEditModal(p) : null}
                          onDelete={activeTab !== 'archived' ? () => handleArchive(p.productID) : null}
                          onRestore={activeTab === 'archived' ? () => handleRestore(p.productID) : null}
                        />
                      </td>
                    </tr>
                  ))
                })()}
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
                <h5 className="modal-title">{activeTab === 'meals' ? 'Create Cooked Meal' : 'Create Product'}</h5>
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
                  {activeTab !== 'meals' && (
                    <>
                      <div className="mb-3">
                        <label className="form-label">Category *</label>
                        <select
                          name="productCategoryID"
                          className="form-select"
                          required
                          value={formData.productCategoryID}
                          onChange={handleInputChange}
                        >
                          <option value="" disabled>Select category</option>
                          {categories.filter(c => c.productCategoryID !== 3).map(c => (
                            <option key={c.productCategoryID} value={c.productCategoryID}>{c.name}</option>
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
                    </>
                  )}
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
                  <div className="row g-2">
                    <div className={activeTab === 'meals' ? 'col-md-6' : 'col-md-4'}>
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
                    <div className={activeTab === 'meals' ? 'col-md-6' : 'col-md-4'}>
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
                    {activeTab !== 'meals' && (
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
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">{activeTab === 'meals' ? 'Create Cooked Meal' : 'Create Product'}</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* EDIT MODAL */}
      {activeModal === 'edit' && selectedProduct && (() => {
        const isMeal = selectedProduct.productCategoryID === 3;
        return (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                  <h5 className="modal-title">{isMeal ? 'Update Cooked Meal' : 'Update Product'}</h5>
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
                    {!isMeal && (
                      <>
                        <div className="mb-3">
                          <label className="form-label">Category *</label>
                          <select
                            name="productCategoryID"
                            className="form-select"
                            required
                            value={formData.productCategoryID}
                            onChange={handleInputChange}
                          >
                            {categories.filter(c => c.productCategoryID !== 3).map(c => (
                              <option key={c.productCategoryID} value={c.productCategoryID}>{c.name}</option>
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
                      </>
                    )}
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
                    <div className="row g-2">
                      <div className={isMeal ? 'col-md-6' : 'col-md-4'}>
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
                      <div className={isMeal ? 'col-md-6' : 'col-md-4'}>
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
                      {!isMeal && (
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
                      )}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="submit" className="btn btn-pcc-primary">{isMeal ? 'Update Cooked Meal' : 'Update Product'}</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
