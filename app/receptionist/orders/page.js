'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';

export default function ReceptionistOrders() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'create' | null
  
  // New Order Form state
  const [newOrderForm, setNewOrderForm] = useState({
    guestID: '',
    items: [] // array of { itemID, type, quantity, name, price }
  });

  const [selectedItemToAdd, setSelectedItemToAdd] = useState({
    idAndType: '', // format: "itemID-type"
    quantity: 1
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/receptionist/orders');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch orders data');

      setOrders(data.orders || []);
      setProducts(data.products || []);
      setAmenities(data.amenities || []);
      setActiveBookings(data.activeBookings || []);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bootstrap = window.bootstrap;
    if (!bootstrap) return;

    const tooltipElements = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipInstances = Array.from(tooltipElements).map(el => {
      return new bootstrap.Tooltip(el, {
        trigger: 'hover',
        boundary: 'viewport'
      });
    });

    return () => {
      tooltipInstances.forEach(instance => instance.dispose());
    };
  }, [orders, loading, search, statusFilter]);

  // Reset modal state
  useEffect(() => {
    if (!activeModal) {
      setNewOrderForm({
        guestID: '',
        items: []
      });
      setSelectedItemToAdd({
        idAndType: '',
        quantity: 1
      });
    }
  }, [activeModal]);

  const handleAddItemToOrder = () => {
    const { idAndType, quantity } = selectedItemToAdd;
    if (!idAndType) return;

    const [itemIDStr, type] = idAndType.split('-');
    const itemID = parseInt(itemIDStr);
    const qty = parseInt(quantity);

    if (!itemID || qty <= 0) return;

    // Check if item is already in list
    const existsIndex = newOrderForm.items.findIndex(it => it.itemID === itemID && it.type === type);

    let details;
    if (type === 'Product') {
      details = products.find(p => p.productID === itemID);
    } else {
      details = amenities.find(a => a.amenityID === itemID);
    }

    if (!details) return;

    // Check stock
    const currentQtyInForm = existsIndex >= 0 ? newOrderForm.items[existsIndex].quantity : 0;
    if (details.quantity < currentQtyInForm + qty) {
      showAlert('warning', 'Warning', `Only ${details.quantity} units available in inventory for: ${details.name}`);
      return;
    }

    const updatedItems = [...newOrderForm.items];
    if (existsIndex >= 0) {
      updatedItems[existsIndex].quantity += qty;
    } else {
      updatedItems.push({
        itemID,
        type,
        quantity: qty,
        name: details.name,
        price: parseFloat(details.price)
      });
    }

    setNewOrderForm(prev => ({
      ...prev,
      items: updatedItems
    }));

    setSelectedItemToAdd({
      idAndType: '',
      quantity: 1
    });
  };

  const handleRemoveItemFromOrder = (index) => {
    const updatedItems = [...newOrderForm.items];
    updatedItems.splice(index, 1);
    setNewOrderForm(prev => ({ ...prev, items: updatedItems }));
  };

  const handleCreateOrderSubmit = async (e) => {
    e.preventDefault();
    if (!newOrderForm.guestID) {
      showAlert('warning', 'Warning', 'Please select a room/guest.');
      return;
    }
    if (newOrderForm.items.length === 0) {
      showAlert('warning', 'Warning', 'Please add at least one item.');
      return;
    }

    showConfirm('Create Guest Order', 'Place this order on the guest\'s account?', async () => {
      try {
        const res = await fetch('/api/receptionist/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            guestID: newOrderForm.guestID,
            items: newOrderForm.items
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to place order');

        showAlert('success', 'Success', 'Order placed successfully.');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleUpdateOrderStatus = (orderID, status) => {
    showConfirm('Update Order Status', `Mark order as ${status}?`, async () => {
      try {
        const res = await fetch('/api/receptionist/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_status',
            orderID,
            status
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update order');

        showAlert('success', 'Success', `Order status marked as ${status}.`);
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending': return 'bg-warning text-dark';
      case 'Preparing': return 'bg-info text-white';
      case 'Served': return 'bg-primary text-white';
      case 'Completed': return 'bg-success text-white';
      case 'Canceled': return 'bg-danger text-white';
      default: return 'bg-secondary text-white';
    }
  };

  // Filter & Search
  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      (o.firstName + ' ' + o.lastName).toLowerCase().includes(search.toLowerCase()) ||
      (o.roomNumber || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === '' || o.orderStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <div className="container-fluid py-4" style={{ backgroundColor: '#f8f9fa', minHeight: '85vh' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="fw-bold mb-1 text-pcc-blue" style={{ color: 'var(--pcc-blue)' }}>Guest Orders</h2>
            <p className="text-muted mb-0">Record and track orders for beverages, meals, and guest amenities.</p>
          </div>
          <button className="btn btn-pcc-primary text-white" onClick={() => setActiveModal('create')}>
            + New Order
          </button>
        </div>

        <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '8px' }}>
          <div className="card-header bg-white py-3 border-0">
            <div className="row g-2 align-items-center">
              <div className="col-md-4">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by guest or room number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ borderRadius: '20px', paddingLeft: '15px' }}
                />
              </div>
              <div className="col-md-3">
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ borderRadius: '20px' }}
                >
                  <option value="">All Statuses</option>
                  <option value="Preparing">Preparing</option>
                  <option value="Completed">Completed</option>
                  <option value="Canceled">Canceled</option>
                </select>
              </div>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="px-4">Order ID</th>
                    <th>Room</th>
                    <th>Guest</th>
                    <th>Items Ordered</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th className="text-end px-4" style={{ width: '120px', minWidth: '120px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5">
                        <div className="spinner-border text-pcc-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5 text-muted">
                        No orders recorded.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(o => {
                      const totalAmt = o.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                      return (
                        <tr key={o.orderID}>
                          <td className="px-4 text-muted">#{o.orderID}</td>
                          <td>
                            <strong>Room {o.roomNumber || 'N/A'}</strong>
                          </td>
                          <td className="fw-semibold text-dark">
                            {o.firstName} {o.lastName}
                          </td>
                          <td>
                            <div className="d-flex flex-column gap-1">
                              {o.items.map((item, idx) => (
                                <div key={idx} style={{ fontSize: '0.85rem' }}>
                                  <span className="text-muted">{item.quantity}x</span> {item.name} 
                                  <span className="text-muted ms-1">({item.type === 'Product' ? '🛍️' : '🛏️'} ₱{item.price})</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="fw-bold text-pcc-primary">
                            ₱{totalAmt.toFixed(2)}
                          </td>
                          <td>
                            <span className={`badge px-2 py-1 rounded-pill ${getStatusBadge(o.orderStatus)}`}>
                              {o.orderStatus}
                            </span>
                          </td>
                          <td className="text-end px-4" style={{ width: '120px', minWidth: '120px' }}>
                            <div className="actions-wrapper justify-content-end gap-1">
                              {['Pending', 'Preparing', 'Served'].includes(o.orderStatus) && (
                                <button 
                                  type="button"
                                  className="action-btn action-btn-activate" 
                                  onClick={() => handleUpdateOrderStatus(o.orderID, 'Completed')}
                                  data-bs-toggle="tooltip"
                                  data-bs-placement="top"
                                  title="Complete"
                                  aria-label="Complete"
                                >
                                  <i className="bi bi-check-circle"></i>
                                </button>
                              )}
                              {['Pending', 'Preparing', 'Served'].includes(o.orderStatus) && (
                                <button 
                                  type="button"
                                  className="action-btn action-btn-suspend" 
                                  onClick={() => handleUpdateOrderStatus(o.orderID, 'Canceled')}
                                  data-bs-toggle="tooltip"
                                  data-bs-placement="top"
                                  title="Cancel"
                                  aria-label="Cancel"
                                >
                                  <i className="bi bi-x-circle"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* CREATE MODAL */}
      {activeModal === 'create' && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Record Guest Order</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCreateOrderSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Select Checked-In Guest *</label>
                    <select
                      className="form-select"
                      required
                      value={newOrderForm.guestID}
                      onChange={(e) => setNewOrderForm(prev => ({ ...prev, guestID: e.target.value }))}
                    >
                      <option value="">Select Room / Guest</option>
                      {activeBookings.map(b => (
                        <option key={b.guestID} value={b.guestID}>
                          Room {b.roomNumber} — {b.lastName}, {b.firstName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="row g-2 mb-3 bg-light p-3 border rounded">
                    <div className="col-md-7">
                      <label className="form-label fw-semibold">Select Item to Add</label>
                      <select
                        className="form-select"
                        value={selectedItemToAdd.idAndType}
                        onChange={(e) => setSelectedItemToAdd(prev => ({ ...prev, idAndType: e.target.value }))}
                      >
                        <option value="">Select Product or Amenity</option>
                        <optgroup label="🛍️ Products (Stock)">
                          {products.map(p => (
                            <option key={`prod-${p.productID}`} value={`${p.productID}-Product`}>
                              {p.name} - ₱{p.price} ({p.quantity} left)
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="🛏️ Amenities (Stock)">
                          {amenities.map(a => (
                            <option key={`amen-${a.amenityID}`} value={`${a.amenityID}-Amenity`}>
                              {a.name} - ₱{a.price} ({a.quantity} left)
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-semibold">Quantity</label>
                      <input
                        type="number"
                        className="form-control"
                        min="1"
                        value={selectedItemToAdd.quantity}
                        onChange={(e) => setSelectedItemToAdd(prev => ({ ...prev, quantity: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-2 d-flex align-items-end">
                      <button type="button" className="btn btn-pcc-primary text-white w-100" onClick={handleAddItemToOrder}>
                        Add
                      </button>
                    </div>
                  </div>

                  <h6 className="fw-bold text-dark mt-4 mb-2">Order Items Bucket:</h6>
                  <div className="table-responsive border rounded mb-3 bg-white" style={{ maxHeight: '200px' }}>
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="ps-3">Item Name</th>
                          <th>Type</th>
                          <th>Price</th>
                          <th>Quantity</th>
                          <th>Total</th>
                          <th className="text-end pe-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newOrderForm.items.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="text-center py-4 text-muted small">
                              No items added to the bucket yet.
                            </td>
                          </tr>
                        ) : (
                          newOrderForm.items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="ps-3 fw-semibold">{item.name}</td>
                              <td>{item.type}</td>
                              <td>₱{item.price.toFixed(2)}</td>
                              <td>{item.quantity}</td>
                              <td className="fw-bold">₱{(item.price * item.quantity).toFixed(2)}</td>
                              <td className="text-end pe-3">
                                <button type="button" className="btn btn-sm btn-outline-danger py-0" onClick={() => handleRemoveItemFromOrder(idx)}>
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {newOrderForm.items.length > 0 && (
                    <div className="text-end fw-bold text-dark px-3 py-2 bg-light rounded" style={{ fontSize: '1.15rem' }}>
                      Grand Total: ₱{newOrderForm.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                    </div>
                  )}
                </div>
                <div className="modal-footer border-top-0">
                  <button type="submit" className="btn btn-pcc-primary text-white px-4">Place Order</button>
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Alert dialog */}
      <ModalDialog
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
      />
    </>
  );
}
