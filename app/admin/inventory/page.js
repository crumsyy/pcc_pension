'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminInventory() {
  const [items, setItems] = useState([]);
  const [stockHistory, setStockHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('stocks'); // 'stocks' | 'history'
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchInventory = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        search,
        type: typeFilter,
      }).toString();

      const res = await fetch(`/api/admin/inventory?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch inventory');

      setItems(data.items || []);
      setStockHistory(data.stockHistory || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [search, typeFilter]);

  const lowStockItems = items.filter(item => item.quantity <= 5);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="section-eyebrow">Admin</div>
          <h2 className="section-title mb-0">Inventory Management</h2>
        </div>
        <Link href="/admin/purchase-orders" className="btn btn-pcc-primary">
          + Create Purchase Order
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Low Stock Banner Alert */}
      {!loading && lowStockItems.length > 0 && (
        <div className="alert alert-warning d-flex align-items-center gap-2 mb-3 shadow-sm" role="alert">
          <span>
            <strong>⚠ Low Stock Alert:</strong> {lowStockItems.length} item(s) are at or below 5 units.
          </span>
          <a href="#low-stock-section" className="ms-auto btn btn-sm btn-warning">
            View Items
          </a>
        </div>
      )}

      {/* Search & Filter */}
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
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="Amenity">Amenities</option>
              <option value="Product">Products</option>
            </select>
          </div>
          <div className="col-md-3 d-flex gap-2">
            <button className="btn btn-pcc-outline w-100" onClick={() => { setSearch(''); setTypeFilter(''); }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-4 d-print-none">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'stocks' ? 'active text-blue' : 'text-secondary'}`}
            style={{ borderBottom: activeTab === 'stocks' ? '3px solid var(--pcc-blue)' : '' }}
            onClick={() => setActiveTab('stocks')}
          >
            📋 Current Stock Levels
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'history' ? 'active text-blue' : 'text-secondary'}`}
            style={{ borderBottom: activeTab === 'history' ? '3px solid var(--pcc-blue)' : '' }}
            onClick={() => setActiveTab('history')}
          >
            🚚 Stock-In History &amp; Movement Log
          </button>
        </li>
      </ul>

      {activeTab === 'stocks' ? (
        <>
          {/* Stock Levels Table */}
          <div className="card-module mb-4" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
            <h4 className="mb-3 text-blue">Stock Levels</h4>
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
                      <th>Type</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock Qty</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-4">
                          No inventory items found.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr
                          key={`${item.itemType}-${item.itemID}`}
                          className={
                            item.quantity <= 5
                              ? 'table-warning'
                              : item.quantity <= 10
                              ? 'table-light'
                              : ''
                          }
                        >
                          <td>
                            <span className="badge text-bg-secondary">{item.itemType}</span>
                          </td>
                          <td>
                            <strong>{item.name}</strong>
                          </td>
                          <td>{item.category}</td>
                          <td>₱{parseFloat(item.price).toFixed(2)}</td>
                          <td>
                            <span
                              className="fw-bold"
                              style={{
                                color:
                                  item.quantity <= 5
                                    ? '#dc3545'
                                    : item.quantity <= 10
                                    ? '#f0a500'
                                    : '#1e6e34',
                              }}
                            >
                              {item.quantity}
                            </span>
                          </td>
                          <td>
                            {item.quantity <= 5 ? (
                              <span className="badge text-bg-danger">⚠ Low Stock</span>
                            ) : item.quantity <= 10 ? (
                              <span className="badge text-bg-warning">Moderate</span>
                            ) : (
                              <span className="badge text-bg-success">Sufficient</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Low Stock Items Section */}
          {!loading && lowStockItems.length > 0 && (
            <div
              id="low-stock-section"
              className="card-module border-danger"
              style={{
                backgroundColor: "#fff",
                padding: "1.25rem",
                borderRadius: "8px",
                border: "1px solid #dc3545",
              }}
            >
              <h4 className="mb-3 text-danger">⚠ Low Stock Items (Reorder Recommended)</h4>
              <div className="table-responsive">
                <table className="table table-danger table-striped align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Remaining Stock</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockItems.map((item) => (
                      <tr key={`low-${item.itemType}-${item.itemID}`}>
                        <td>
                          <span className="badge text-bg-secondary">{item.itemType}</span>
                        </td>
                        <td>
                          <strong>{item.name}</strong>
                        </td>
                        <td>{item.category}</td>
                        <td className="fw-bold text-danger">{item.quantity} units</td>
                        <td>
                          <Link href="/admin/purchase-orders" className="btn btn-sm btn-pcc-primary">
                            Create PO
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Tab 2: Stock History (Module G & I - REQ044/REQ062) */
        <div className="card-module mb-4" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
          <h4 className="mb-3 text-blue">Stock Movement History (Logs)</h4>
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
                    <th>Date &amp; Time Received</th>
                    <th>Item Name</th>
                    <th>Item Type</th>
                    <th>Source Purchase Order</th>
                    <th>Quantity Received</th>
                  </tr>
                </thead>
                <tbody>
                  {stockHistory.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">
                        No stock receipt transactions logged.
                      </td>
                    </tr>
                  ) : (
                    stockHistory.map((history) => (
                      <tr key={history.inventoryID}>
                        <td>{new Date(history.stockInDate.replace(' ', 'T')).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                        <td><strong>{history.itemName}</strong></td>
                        <td><span className="badge text-bg-secondary">{history.itemType}</span></td>
                        <td>
                          <span className="fw-semibold">PO #{history.purchaseOrderID}</span>
                        </td>
                        <td className="fw-bold text-success">+{history.quantityReceived} units</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
