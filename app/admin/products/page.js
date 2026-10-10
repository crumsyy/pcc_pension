'use client';

import { useState, useEffect, useRef } from 'react';
import ModalDialog from '../../components/ModalDialog';
import ModalPortal from '../../components/ModalPortal';
import ActionButtons from '../../components/ActionButtons';
import AdminPagination, { ADMIN_PAGE_SIZE, paginate } from '../../components/AdminPagination';
import { Tabs, TabList, Tab } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import clientCache, { CACHE_TTL } from '@/lib/clientCache';
import { toast } from '@/components/ui/toast';

export default function AdminProducts() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimer = useRef(null);
  const [catFilter, setCatFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'meals' | 'archived'
  const [page, setPage] = useState(1);

  const baseCacheKey = `admin-products:${search}_${catFilter}_${typeFilter}_${activeTab}`;
  const cached = clientCache.get(baseCacheKey);
  const [products, setProducts] = useState(cached?.data?.products || []);
  const [categories, setCategories] = useState(cached?.data?.categories || []);
  const [shouldAnimate, setShouldAnimate] = useState(!cached);

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

  const fetchProducts = async (isBackground = false) => {
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

      const productsData = data.products || [];
      const categoriesData = data.categories || [];

      setProducts(productsData);
      setCategories(categoriesData);

      clientCache.set(baseCacheKey, {
        products: productsData,
        categories: categoriesData
      }, CACHE_TTL.PRODUCTS);
    } catch (err) {
      if (!isBackground) showAlert('error', 'Error', err.message);
      else console.warn('Background products refresh error:', err.message);
    }
  };

  useEffect(() => {
    const entry = clientCache.get(baseCacheKey);
    if (!entry) {
      fetchProducts(false);
    } else {
      setProducts(entry.data.products || []);
      setCategories(entry.data.categories || []);
      if (entry.isStale) {
        fetchProducts(true);
      }
    }
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
        clientCache.invalidate('admin-products');
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
        clientCache.invalidate('admin-products');
        fetchProducts();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleArchive = async (productID) => {
    showConfirm('Archive Product', 'Are you sure you want to archive this product? It will be hidden from active inventory.', async () => {
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
        if (!res.ok) throw new Error(data.error || 'Failed to archive');

        showAlert('success', 'Success', data.message || 'Product archived successfully');
        clientCache.invalidate('admin-products');
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
        clientCache.invalidate('admin-products');
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
        clientCache.invalidate('admin-products');
        fetchProducts();
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
      dataForm.append('type', activeTab === 'meals' ? 'meals' : 'products');

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
      productCategoryID: activeTab === 'meals' ? '3' : (categories.find(c => c.productCategoryID !== 3)?.productCategoryID || ''),
      basePrice: 0.00,
      sellingPrice: 0.00,
      minStock: activeTab === 'meals' ? 0 : 5,
      itemType: 'Consumable',
      unit: activeTab === 'meals' ? 'serving' : 'pcs',
      description: '',
      image: '',
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
      image: product.image || '',
    });
    setActiveModal('edit');
  };

  const filteredProducts = products.filter(p => {
    if (activeTab === 'products') return p.productCategoryID !== 3;
    if (activeTab === 'meals') return p.productCategoryID === 3;
    return true;
  });
  const { totalPages, safePage, rows: pagedProducts, start, end, total } = paginate(filteredProducts, page, ADMIN_PAGE_SIZE);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); }, 350);
  };

  const handleCatFilterChange = (e) => {
    setCatFilter(e.target.value);
    setPage(1);
  };

  const handleTypeFilterChange = (e) => {
    setTypeFilter(e.target.value);
    setPage(1);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCatFilter(tab === 'meals' ? '3' : '');
    setPage(1);
  };

  const handleClearFilters = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearch('');
    setSearchInput('');
    setCatFilter(activeTab === 'meals' ? '3' : '');
    setTypeFilter('');
    setPage(1);
  };

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

      <div className="d-flex justify-content-between align-items-center mb-2">
        {/* Tabs for Products, Cooked Meals, and Archived */}
        <Tabs selectedKey={activeTab} onSelectionChange={(key) => handleTabChange(key)}>
          <TabList aria-label="Product lists">
            <Tab id="products">Active Products</Tab>
            <Tab id="meals">Cooked Meals</Tab>
            <Tab id="archived">Archived Items</Tab>
          </TabList>
        </Tabs>
        {activeTab !== 'archived' && (
          <button className="btn btn-pcc-primary text-white" onClick={openCreateModal}>
            {activeTab === 'meals' ? '+ Create Meal' : '+ Create Product'}
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="row g-2 align-items-end">
          <div className={activeTab === 'meals' ? 'col-md-10' : 'col-md-4'}>
            <input
              type="text"
              className="form-control"
              placeholder={activeTab === 'meals' ? "Search cooked meals..." : "Search product name or category..."}
              value={searchInput}
              onChange={handleSearchChange}
            />
          </div>
          {activeTab !== 'meals' && (
            <>
              <div className="col-md-3">
                <select
                  className="form-select"
                  value={catFilter}
                  onChange={handleCatFilterChange}
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
                  onChange={handleTypeFilterChange}
                >
                  <option value="">All Types</option>
                  <option value="Consumable">Consumable</option>
                  <option value="Non-Consumable">Non-Consumable</option>
                </select>
              </div>
            </>
          )}
          <div className="col-md-2 d-flex gap-2">
            <button className="btn btn-pcc-primary text-white w-100" onClick={handleClearFilters}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card-module pcc-table-card" style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
          <div className={`table-responsive ${shouldAnimate ? 'pcc-content-reveal' : ''}`} style={{ maxHeight: 'max(200px, calc(100vh - 300px))', overflowY: 'auto' }}>
            <Table className="table align-middle mb-0">
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead>Item Type</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Daily Availability</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  if (pagedProducts.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan="9" className="text-center text-muted py-4">
                          No items found.
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return pagedProducts.map((p, index) => (
                    <TableRow key={p.productID}>
                      <TableCell>{start + index}</TableCell>
                      <TableCell>
                        <div className="d-flex align-items-center gap-2">
                          {p.image ? (
                            <img src={p.image} alt={p.name} style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px' }} />
                          ) : (
                            <div className="bg-light text-muted d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px', borderRadius: '4px', fontSize: '0.85rem' }}>
                              {p.productCategoryID === 3 ? '🍳' : '🥤'}
                            </div>
                          )}
                          <strong>{p.name}</strong>
                        </div>
                      </TableCell>
                      <TableCell>{p.catName}</TableCell>
                      <TableCell>
                        <div className="small"><strong>Base:</strong> ₱{parseFloat(p.basePrice || p.price || 0).toFixed(2)}</div>
                        <div className="small text-muted"><strong>Sell:</strong> ₱{parseFloat(p.sellingPrice || p.price || 0).toFixed(2)}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`badge ${p.itemType === 'Consumable' ? 'text-bg-info' : 'text-bg-secondary'}`}>
                          {p.itemType}
                        </span>
                      </TableCell>
                      <TableCell>{p.unit}</TableCell>
                      <TableCell className="text-truncate" style={{ maxWidth: '150px' }} title={p.description}>
                        {p.description || '—'}
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>
                        <ActionButtons
                          onEdit={activeTab !== 'archived' ? () => openEditModal(p) : null}
                          onArchive={activeTab !== 'archived' ? () => handleArchive(p.productID) : null}
                          onRestore={activeTab === 'archived' ? () => handleRestore(p.productID) : null}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                })()}
              </TableBody>
            </Table>
          </div>
          <AdminPagination page={safePage} totalPages={totalPages} onPage={setPage} start={start} end={end} total={total} label={activeTab === 'meals' ? 'meals' : 'products'} />
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
                <h5 className="modal-title">{activeTab === 'meals' ? 'Create Cooked Meal' : 'Create Product'}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCreateSubmit}>
                <div className="modal-body p-3">
                  {activeTab !== 'meals' ? (
                    <>
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
                    </>
                  ) : (
                    <div className="row g-2 mb-2">
                      <div className="col-md-8">
                        <label className="form-label small fw-semibold mb-1">Meal Name <span className="required-asterisk">*</span></label>
                        <input
                          type="text"
                          name="name"
                          className="form-control"
                          required
                          value={formData.name}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small fw-semibold mb-1">Unit <span className="required-asterisk">*</span></label>
                        <input
                          type="text"
                          name="unit"
                          className="form-control"
                          placeholder="e.g. serving, plate"
                          required
                          value={formData.unit}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  )}

                  <div className="row g-2 mb-2">
                    <div className={activeTab === 'meals' ? 'col-md-6' : 'col-md-4'}>
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
                    <div className={activeTab === 'meals' ? 'col-md-6' : 'col-md-4'}>
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
                    {activeTab !== 'meals' && (
                      <div className="col-md-4">
                        <label className="form-label small fw-semibold mb-1">Min Stock <span className="required-asterisk">*</span></label>
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

                  <div className="row g-2 mb-1">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold mb-1">Item Photo</label>
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
                            alt="Item preview"
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
          <div className="modal show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '640px' }}>
              <div className="modal-content">
                <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                  <h5 className="modal-title">{isMeal ? 'Update Cooked Meal' : 'Update Product'}</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
                </div>
                <form onSubmit={handleEditSubmit}>
                  <div className="modal-body p-3">
                    {!isMeal ? (
                      <>
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
                      </>
                    ) : (
                      <div className="row g-2 mb-2">
                        <div className="col-md-8">
                          <label className="form-label small fw-semibold mb-1">Meal Name <span className="required-asterisk">*</span></label>
                          <input
                            type="text"
                            name="name"
                            className="form-control"
                            required
                            value={formData.name}
                            onChange={handleInputChange}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small fw-semibold mb-1">Unit <span className="required-asterisk">*</span></label>
                          <input
                            type="text"
                            name="unit"
                            className="form-control"
                            placeholder="e.g. serving, plate"
                            required
                            value={formData.unit}
                            onChange={handleInputChange}
                          />
                        </div>
                      </div>
                    )}

                    <div className="row g-2 mb-2">
                      <div className={isMeal ? 'col-md-6' : 'col-md-4'}>
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
                      <div className={isMeal ? 'col-md-6' : 'col-md-4'}>
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
                      {!isMeal && (
                        <div className="col-md-4">
                          <label className="form-label small fw-semibold mb-1">Min Stock <span className="required-asterisk">*</span></label>
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

                    <div className="row g-2 mb-1">
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold mb-1">Item Photo</label>
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
                              alt="Item preview"
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
                    <button type="submit" className="btn btn-pcc-primary">{isMeal ? 'Update Cooked Meal' : 'Update Product'}</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })()}
        </ModalPortal>
      )}
    </div>
  );
}
