'use client';

import { useState, useEffect } from 'react';

export default function AdminPurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'view' | 'stock_in' | null
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Form states
  const [poItems, setPoItems] = useState([
    { itemName: '', itemType: 'Amenity', quantity: 1, unitPrice: 0.00 }
  ]);
  const [receivedQtys, setReceivedQtys] = useState({}); // { [orderItemID]: quantity }

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ status: statusFilter }).toString();
      const res = await fetch(`/api/admin/purchase-orders?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch purchase orders');

      setOrders(data.orders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const showToast = (msg, isSuccess = true) => {
    if (isSuccess) {
      setSuccess(msg);
      setTimeout(() => setSuccess(''), 4000);
    } else {
      setError(msg);
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleStatusChange = async (poID, status, msg) => {
    if (!confirm(msg || `Are you sure you want to update status to ${status}?`)) return;

    try {
      const res = await fetch('/api/admin/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', poID, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      showToast(data.message);
      fetchOrders();
    } catch (err) {
      showToast(err.message, false);
    }
  };

  const handleCreatePOSubmit = async (e) => {
    e.preventDefault();
    if (poItems.some(item => !item.itemName.trim())) {
      showToast('Item Name is required for all rows', false);
      return;
    }

    try {
      const res = await fetch('/api/admin/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_po', items: poItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create PO');

      showToast(data.message);
      setActiveModal(null);
      fetchOrders();
    } catch (err) {
      showToast(err.message, false);
    }
  };

  const handleStockInSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stock_in',
          poID: selectedOrder.purchaseOrderID,
          received: receivedQtys
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete stock-in');

      showToast(data.message);
      setActiveModal(null);
      fetchOrders();
    } catch (err) {
      showToast(err.message, false);
    }
  };

  const openCreateModal = () => {
    setPoItems([{ itemName: '', itemType: 'Amenity', quantity: 1, unitPrice: 0.00 }]);
    setActiveModal('create');
  };

  const openViewModal = (po) => {
    setSelectedOrder(po);
    setActiveModal('view');
  };

  const openStockInModal = (po) => {
    setSelectedOrder(po);
    const initialQtys = {};
    po.items.forEach(item => {
      initialQtys[item.orderItemID] = item.quantity;
    });
    setReceivedQtys(initialQtys);
    setActiveModal('stock_in');
  };

  const addPORow = () => {
    setPoItems(prev => [...prev, { itemName: '', itemType: 'Amenity', quantity: 1, unitPrice: 0.00 }]);
  };

  const handlePORowChange = (index, field, value) => {
    setPoItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  };

  const handleReceivedQtyChange = (orderItemID, val) => {
    setReceivedQtys(prev => ({
      ...prev,
      [orderItemID]: val
    }));
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="section-eyebrow">Admin</div>
          <h2 className="section-title mb-0">Purchase Orders</h2>
        </div>
        <button className="btn btn-pcc-primary" onClick={openCreateModal}>
          + Create Purchase Order
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

      {/* Filter */}
      <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div className="col-md-3">
            <button className="btn btn-pcc-outline w-100" onClick={() => setStatusFilter('')}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Purchase Orders Table */}
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
                  <th>PO #</th>
                  <th>Date</th>
                  <th>Items count</th>
                  <th>Total Cost</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted py-4">
                      No purchase orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((po) => (
                    <tr key={po.purchaseOrderID}>
                      <td>
                        <strong>PO-{String(po.purchaseOrderID).padStart(4, '0')}</strong>
                      </td>
                      <td>
                        {new Date(po.orderDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td>{po.itemCount} item(s)</td>
                      <td>₱{parseFloat(po.total || 0).toFixed(2)}</td>
                      <td>
                        <span
                          className={`badge ${
                            po.status === 'Completed'
                              ? 'text-bg-success'
                              : po.status === 'Approved'
                              ? 'text-bg-primary'
                              : 'text-bg-warning'
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-1 flex-wrap">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => openViewModal(po)}
                          >
                            View
                          </button>
                          {po.status === 'Pending' && (
                            <>
                              <button
                                className="btn btn-sm btn-outline-success"
                                onClick={() =>
                                  handleStatusChange(
                                    po.purchaseOrderID,
                                    'Approved',
                                    'Approve this Purchase Order?'
                                  )
                                }
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() =>
                                  handleStatusChange(
                                    po.purchaseOrderID,
                                    'Completed',
                                    'Cancel this Purchase Order?'
                                  )
                                }
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {po.status === 'Approved' && (
                            <button
                              className="btn btn-sm btn-pcc-primary"
                              onClick={() => openStockInModal(po)}
                            >
                              Stock In
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

      {/* CREATE PO MODAL */}
      {activeModal === 'create' && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', overflowY: 'auto' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Create Purchase Order</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCreatePOSubmit}>
                <div className="modal-body">
                  <div id="poItemsList">
                    {poItems.map((item, idx) => (
                      <div className="row g-2 mb-2 align-items-center" key={idx}>
                        <div className="col-md-4">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Item name"
                            required
                            value={item.itemName}
                            onChange={(e) => handlePORowChange(idx, 'itemName', e.target.value)}
                          />
                        </div>
                        <div className="col-md-3">
                          <select
                            className="form-select form-select-sm"
                            value={item.itemType}
                            onChange={(e) => handlePORowChange(idx, 'itemType', e.target.value)}
                          >
                            <option value="Amenity">Amenity</option>
                            <option value="Product">Product</option>
                          </select>
                        </div>
                        <div className="col-md-2">
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            placeholder="Qty"
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) => handlePORowChange(idx, 'quantity', e.target.value)}
                          />
                        </div>
                        <div className="col-md-3">
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm"
                            placeholder="Unit Price ₱"
                            required
                            value={item.unitPrice}
                            onChange={(e) => handlePORowChange(idx, 'unitPrice', e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-secondary mt-2" onClick={addPORow}>
                    + Add Item
                  </button>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Create Purchase Order</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW PO DETAILS MODAL */}
      {activeModal === 'view' && selectedOrder && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">PO-{String(selectedOrder.purchaseOrderID).padStart(4, '0')} Details</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <div className="modal-body">
                <p>
                  <strong>Date:</strong>{' '}
                  {new Date(selectedOrder.orderDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  &nbsp; <strong>Status:</strong> {selectedOrder.status}
                </p>
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item) => (
                        <tr key={item.orderItemID}>
                          <td>{item.itemName}</td>
                          <td>{item.itemType}</td>
                          <td>{item.quantity}</td>
                          <td>₱{parseFloat(item.unitPrice).toFixed(2)}</td>
                          <td>₱{parseFloat(item.quantity * item.unitPrice).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="4" className="text-end fw-bold">Total:</td>
                        <td className="fw-bold">₱{parseFloat(selectedOrder.total || 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECORD STOCK-IN MODAL */}
      {activeModal === 'stock_in' && selectedOrder && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Record Stock-In — PO-{String(selectedOrder.purchaseOrderID).padStart(4, '0')}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleStockInSubmit}>
                <div className="modal-body">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Type</th>
                        <th>Ordered</th>
                        <th>Qty Received *</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item) => (
                        <tr key={item.orderItemID}>
                          <td>{item.itemName}</td>
                          <td>{item.itemType}</td>
                          <td>{item.quantity}</td>
                          <td>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              min="0"
                              max={item.quantity}
                              required
                              value={receivedQtys[item.orderItemID] || 0}
                              onChange={(e) => handleReceivedQtyChange(item.orderItemID, parseInt(e.target.value) || 0)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Confirm Stock-In</button>
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
