'use client';

import { useState, useEffect } from 'react';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'edit' | null
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    productCategoryID: '',
    price: 0,
    quantity: 0,
  });

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        search,
        catID: catFilter,
      }).toString();

      const res = await fetch(`/api/admin/products?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch products');

      setProducts(data.products || []);
      setCategories(data.categories || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, catFilter]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const showToast = (msg, isSuccess = true) => {
    if (isSuccess) {
      setSuccess(msg);
      setTimeout(() => setSuccess(''), 4000);
    } else {
      setError(msg);
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...formData
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create product');

      showToast(data.message || 'Product created successfully');
      setActiveModal(null);
      fetchProducts();
    } catch (err) {
      showToast(err.message, false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          productID: selectedProduct.productID,
          ...formData
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update product');

      showToast(data.message || 'Product updated successfully');
      setActiveModal(null);
      fetchProducts();
    } catch (err) {
      showToast(err.message, false);
    }
  };

  const handleArchive = async (productID) => {
    if (!confirm('Archive this product (stock quantity will be set to 0)?')) return;

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

      showToast(data.message || 'Product archived successfully');
      fetchProducts();
    } catch (err) {
      showToast(err.message, false);
    }
  };

  const openCreateModal = () => {
    setFormData({
      name: '',
      productCategoryID: categories[0]?.productCategoryID || '',
      price: 0.00,
      quantity: 0,
    });
    setActiveModal('create');
  };

  const openEditModal = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      productCategoryID: product.productCategoryID,
      price: product.price,
      quantity: product.quantity,
    });
    setActiveModal('edit');
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="section-eyebrow">Admin</div>
          <h2 className="section-title mb-0">Products Management</h2>
        </div>
        <button className="btn btn-pcc-primary" onClick={openCreateModal}>
          + Add Product
        </button>
      </div>

      {/* Alerts */}
      {success && (
        <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
          {success}
          <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
        </div>
      )}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="row g-2 align-items-end">
          <div className="col-md-5">
            <input
              type="text"
              className="form-control"
              placeholder="Search product name or category..."
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
                <option key={c.productCategoryID} value={c.productCategoryID}>
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

      {/* Products Table */}
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
                  <th>Alert</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted py-4">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  products.map((p, index) => (
                    <tr key={p.productID} className={p.quantity <= 5 ? 'table-warning' : ''}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>{p.catName}</td>
                      <td>₱{parseFloat(p.price).toFixed(2)}</td>
                      <td>{p.quantity}</td>
                      <td>
                        {p.quantity <= 5 ? (
                          <span className="badge text-bg-warning">Low Stock</span>
                        ) : (
                          <span className="badge text-bg-success">OK</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => openEditModal(p)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleArchive(p.productID)}
                          >
                            Archive
                          </button>
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
                <h5 className="modal-title">Add Product</h5>
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
                      name="productCategoryID"
                      className="form-select"
                      required
                      value={formData.productCategoryID}
                      onChange={handleInputChange}
                    >
                      <option value="" disabled>Select category</option>
                      {categories.map(c => (
                        <option key={c.productCategoryID} value={c.productCategoryID}>{c.name}</option>
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
                  <button type="submit" className="btn btn-pcc-primary">Add Product</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {activeModal === 'edit' && selectedProduct && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Edit Product</h5>
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
                      name="productCategoryID"
                      className="form-select"
                      required
                      value={formData.productCategoryID}
                      onChange={handleInputChange}
                    >
                      {categories.map(c => (
                        <option key={c.productCategoryID} value={c.productCategoryID}>{c.name}</option>
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
                  <button type="submit" className="btn btn-pcc-primary">Save Changes</button>
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
