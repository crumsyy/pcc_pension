'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';
import SearchableSelect from '../../components/SearchableSelect';


export default function ReceptionistOrders() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [cookedMeals, setCookedMeals] = useState([]);
  const [activeItemCategory, setActiveItemCategory] = useState('Product'); // 'Product' | 'Amenity' | 'Meal'
  const [amenities, setAmenities] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'view_order' | null
  const [viewingOrder, setViewingOrder] = useState(null);
  
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
      onConfirm: async () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        await onConfirmCallback();
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
      setCookedMeals(data.cookedMeals || []);
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
      setActiveItemCategory('Product');
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
      details = products.find(p => p.productID === itemID) || cookedMeals.find(p => p.productID === itemID);
    } else {
      details = amenities.find(a => a.amenityID === itemID);
    }

    if (!details) return;

    // Flexible meal scheduling allowed at any time (6-10:30 AM restriction removed)

    // Check stock
    const currentQtyInForm = existsIndex >= 0 ? newOrderForm.items[existsIndex].quantity : 0;
    if (details.productCategoryID !== 3 && details.quantity < currentQtyInForm + qty) {
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
            items: newOrderForm.items,
            deliveryTime: newOrderForm.deliveryTime || '07:30 AM'
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
      <div className="container-fluid py-3 d-flex flex-column" style={{ backgroundColor: '#f8f9fa', height: 'calc(100vh - 150px)', overflow: 'hidden' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="fw-bold mb-1 text-pcc-blue" style={{ color: 'var(--pcc-blue)' }}>
              Guest Orders
            </h2>
            <p className="text-muted mb-0">
              Record and track orders for beverages, meals, and guest amenities.
            </p>
          </div>
          <button className="btn btn-pcc-primary text-white" onClick={() => setActiveModal('create')}>
            + New Order
          </button>
        </div>

        <div className="card shadow-sm border-0 flex-grow-1 d-flex flex-column overflow-hidden mb-3" style={{ borderRadius: '8px', minHeight: 0 }}>
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
          <div className="card-body p-0 d-flex flex-column flex-grow-1 overflow-hidden">
            <div className="table-responsive flex-grow-1" style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
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
                                  <span className="text-muted ms-2">(₱{parseFloat(item.price).toFixed(2)})</span>
                                </div>
                              ))}
                            </div>
                            {o.deliveryTime && (
                              <div className="mt-1">
                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5" style={{ fontSize: '0.73rem' }}>
                                  <i className="bi bi-clock me-1"></i>Scheduled Delivery: {o.deliveryTime}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="fw-bold text-dark">
                            ₱{totalAmt.toFixed(2)}
                          </td>
                          <td>
                            <span className={`badge ${getStatusBadge(o.orderStatus)} px-3 py-1 rounded-pill`} style={{ fontSize: '0.78rem' }}>
                              {o.orderStatus}
                            </span>
                          </td>
                          <td className="text-end px-4">
                            <div className="actions-wrapper d-flex justify-content-end gap-1">
                              <button 
                                type="button"
                                className="action-btn action-btn-view" 
                                data-bs-toggle="tooltip"
                                data-bs-placement="top"
                                title="View Order Details"
                                aria-label="View Order Details"
                                onClick={() => { setViewingOrder(o); setActiveModal('view_order'); }}
                              >
                                <i className="fa-solid fa-eye"></i>
                              </button>
                              {o.orderStatus === 'Preparing' && (
                                <>
                                  <button 
                                    type="button"
                                    className="action-btn action-btn-activate" 
                                    data-bs-toggle="tooltip"
                                    data-bs-placement="top"
                                    title="Serve Order"
                                    aria-label="Serve Order"
                                    onClick={() => handleUpdateOrderStatus(o.orderID, 'Completed')}
                                  >
                                    <i className="fa-solid fa-check"></i>
                                  </button>
                                  <button 
                                    type="button"
                                    className="action-btn action-btn-delete" 
                                    data-bs-toggle="tooltip"
                                    data-bs-placement="top"
                                    title="Cancel Order"
                                    aria-label="Cancel Order"
                                    onClick={() => handleUpdateOrderStatus(o.orderID, 'Canceled')}
                                  >
                                    <i className="fa-solid fa-xmark"></i>
                                  </button>
                                </>
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

      {/* CREATE ORDER MODAL */}
      {activeModal === 'create' && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">+ Record New Guest Order</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCreateOrderSubmit}>
                <div className="modal-body px-4 py-3">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Select Room / Guest *</label>
                    <SearchableSelect
                      options={activeBookings.map(b => ({
                        value: String(b.guestID),
                        label: `Room ${b.roomNumber} — ${b.lastName}, ${b.firstName}`
                      }))}
                      value={newOrderForm.guestID}
                      onChange={(val) => setNewOrderForm(prev => ({ ...prev, guestID: val }))}
                      placeholder="Type to search guest or room..."
                    />
                  </div>

                  <div className="row g-2 mb-3 bg-light p-3 border rounded">
                    <div className="col-md-12 mb-2">
                      <label className="form-label small fw-bold text-muted uppercase tracking-wider mb-1">Item Category *</label>
                      <select
                        className="form-select form-select-sm"
                        value={activeItemCategory}
                        onChange={(e) => {
                          const val = e.target.value;
                          setActiveItemCategory(val);
                          setSelectedItemToAdd({ idAndType: '', quantity: 1 });
                          if (val === 'Meal' && !newOrderForm.deliveryTime) {
                            setNewOrderForm(prev => ({ ...prev, deliveryTime: '07:30 AM' }));
                          }
                        }}
                      >
                        <option value="Product">Products (Deliverable Anytime)</option>
                        <option value="Amenity">Amenities (Deliverable Anytime)</option>
                        <option value="Meal">Cooked Meals (Scheduled Delivery Tracking)</option>
                      </select>
                    </div>

                    <div className="col-md-7">
                      <label className="form-label fw-semibold">Select Item to Add</label>
                      <SearchableSelect
                        options={
                          activeItemCategory === 'Product'
                            ? products.map(p => ({
                                value: `${p.productID}-Product`,
                                label: `${p.name} (₱${parseFloat(p.price).toFixed(2)} | Stock: ${p.quantity})`
                              }))
                            : activeItemCategory === 'Amenity'
                            ? amenities.map(a => ({
                                value: `${a.amenityID}-Amenity`,
                                label: `${a.name} (₱${parseFloat(a.price).toFixed(2)} | Stock: ${a.quantity})`
                              }))
                            : cookedMeals.map(m => ({
                                value: `${m.productID}-Product`,
                                label: `${m.name} (₱${parseFloat(m.price).toFixed(2)} | Available)`
                              }))
                        }
                        value={selectedItemToAdd.idAndType}
                        onChange={(val) => setSelectedItemToAdd(prev => ({ ...prev, idAndType: val }))}
                        placeholder={`Search ${activeItemCategory === 'Product' ? 'products' : activeItemCategory === 'Amenity' ? 'amenities' : 'cooked meals'}...`}
                      />
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

                  {(activeItemCategory === 'Meal' || newOrderForm.items.some(item => cookedMeals.some(m => m.productID === item.itemID))) && (() => {
                    const slots = ['06:30 AM', '07:00 AM', '07:30 AM', '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM'];
                    let currentMinutes = 0;
                    try {
                      const manilaFormatter = new Intl.DateTimeFormat('en-US', {
                        timeZone: 'Asia/Manila',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      });
                      const parts = manilaFormatter.formatToParts(new Date());
                      const p = {};
                      parts.forEach(({ type, value }) => { p[type] = value; });
                      currentMinutes = parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10);
                    } catch (e) {
                      const d = new Date();
                      currentMinutes = d.getHours() * 60 + d.getMinutes();
                    }

                    const evaluatedSlots = slots.map(slot => {
                      const [timePart, meridiem] = slot.split(' ');
                      const [h, m] = timePart.split(':');
                      let hr = parseInt(h, 10);
                      if (meridiem === 'PM' && hr !== 12) hr += 12;
                      if (meridiem === 'AM' && hr === 12) hr = 0;
                      const slotMin = hr * 60 + parseInt(m, 10);
                      return { slot, isPast: slotMin <= currentMinutes };
                    });

                    return (
                      <div className="mb-3 p-3 bg-primary-subtle border border-primary-subtle rounded">
                        <label className="form-label fw-bold text-primary small mb-1">
                          Scheduled Breakfast Delivery Time (6:30 AM - 10:30 AM) *
                        </label>
                        <select
                          className="form-select form-select-sm fw-semibold"
                          value={newOrderForm.deliveryTime || '07:30 AM'}
                          onChange={(e) => setNewOrderForm(prev => ({ ...prev, deliveryTime: e.target.value }))}
                        >
                          {evaluatedSlots.map(({ slot, isPast }) => (
                            <option key={slot} value={slot} disabled={isPast}>
                              {slot} {isPast ? '(Passed)' : ''}
                            </option>
                          ))}
                        </select>
                        <small className="text-muted d-block mt-1" style={{ fontSize: '0.72rem' }}>
                          Advance breakfast orders can be placed for scheduled delivery between 6:30 AM and 10:30 AM. Past time slots are disabled.
                        </small>
                      </div>
                    );
                  })()}

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
                              <td className="ps-3 fw-bold">{item.name}</td>
                              <td><span className="badge bg-secondary-subtle text-secondary">{item.type}</span></td>
                              <td>₱{item.price.toFixed(2)}</td>
                              <td>{item.quantity}</td>
                              <td className="fw-bold">₱{(item.price * item.quantity).toFixed(2)}</td>
                              <td className="text-end pe-3">
                                <button type="button" className="btn btn-sm btn-danger text-white py-0 px-2" onClick={() => handleRemoveItemFromOrder(idx)}>
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="modal-footer border-top-0">
                  <button type="submit" className="btn btn-pcc-primary text-white" disabled={newOrderForm.items.length === 0 || !newOrderForm.guestID}>
                    Place Order
                  </button>
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ORDER DETAILS MODAL */}
      {activeModal === 'view_order' && viewingOrder && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ background: '#2155B5' }}>
                <h5 className="modal-title fw-bold">Order Details — #{viewingOrder.orderID}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => { setActiveModal(null); setViewingOrder(null); }}></button>
              </div>
              <div className="modal-body p-4">
                <div className="p-3 bg-light rounded border mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Order Number:</span>
                    <strong className="text-dark">#{viewingOrder.orderID}</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Guest Name:</span>
                    <strong className="text-dark">{viewingOrder.firstName} {viewingOrder.lastName}</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Target Room:</span>
                    <strong className="text-pcc-blue">Room {viewingOrder.roomNumber || 'N/A'} ({viewingOrder.roomType || 'Standard'})</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Order Date & Time:</span>
                    <span>{new Date(viewingOrder.orderDateTime || Date.now()).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                    <span className="text-muted">Status:</span>
                    <span className={`badge ${getStatusBadge(viewingOrder.orderStatus)} px-3 py-1.5 rounded-pill`}>
                      {viewingOrder.orderStatus}
                    </span>
                  </div>
                </div>

                <h6 className="fw-bold text-dark mb-2">Itemized Order Breakdown</h6>
                <div className="table-responsive border rounded mb-3">
                  <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead className="table-light">
                      <tr>
                        <th>Item Description</th>
                        <th className="text-center">Qty</th>
                        <th className="text-end">Unit Price</th>
                        <th className="text-end">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingOrder.items.map((it, i) => (
                        <tr key={i}>
                          <td className="fw-semibold text-dark">{it.name}</td>
                          <td className="text-center">{it.quantity}x</td>
                          <td className="text-end">₱{parseFloat(it.price).toFixed(2)}</td>
                          <td className="text-end fw-bold">₱{(parseFloat(it.price) * it.quantity).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="d-flex justify-content-between align-items-center p-3 bg-light rounded border">
                  <span className="fw-bold text-dark fs-6">Grand Total Amount:</span>
                  <span className="fw-bold text-primary fs-5">
                    ₱{viewingOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary text-white" onClick={() => { setActiveModal(null); setViewingOrder(null); }}>
                  Close
                </button>
              </div>
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
