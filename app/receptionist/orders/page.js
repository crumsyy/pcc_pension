'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';
import SearchableSelect from '../../components/SearchableSelect';


const getTodayManila = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch (e) {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }
};

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
  const [deliveryTab, setDeliveryTab] = useState('immediate'); // 'immediate' | 'scheduled' | 'all'

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'view_order' | null
  const [viewingOrder, setViewingOrder] = useState(null);
  
  // New Order Form state
  const [newOrderForm, setNewOrderForm] = useState({
    guestID: '',
    items: [], // array of { itemID, type, quantity, name, price }
    deliveryDate: getTodayManila(),
    deliveryTime: '07:30 AM'
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

  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
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
      if (!isBackground) showAlert('error', 'Error', err.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(false);

    // Real-time polling every 8 seconds so receptionist sees updated orders and delivery types
    const interval = setInterval(() => {
      fetchData(true);
    }, 8000);

    const handleFocus = () => {
      fetchData(true);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Reset modal state
  useEffect(() => {
    if (!activeModal) {
      setNewOrderForm({
        guestID: '',
        items: [],
        deliveryDate: getTodayManila(),
        deliveryTime: '07:30 AM'
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

    const isMeal = (type === 'Product' && details.productCategoryID === 3) || activeItemCategory === 'Meal';
    const initialDeliveryType = isMeal ? 'scheduled' : 'immediate';

    if (existsIndex >= 0) {
      const updated = [...newOrderForm.items];
      updated[existsIndex].quantity += qty;
      setNewOrderForm(prev => ({ ...prev, items: updated }));
    } else {
      setNewOrderForm(prev => ({
        ...prev,
        items: [
          ...prev.items,
          {
            itemID,
            type,
            name: details.name,
            price: parseFloat(details.price),
            quantity: qty,
            image: details.image || null,
            isCookedMeal: isMeal,
            deliveryType: initialDeliveryType
          }
        ]
      }));
    }

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
            deliveryDate: newOrderForm.deliveryDate || getTodayManila(),
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
      case 'Pending Delivery': return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      case 'Pending': return 'bg-warning text-dark';
      case 'Preparing': return 'bg-info text-white';
      case 'Served': return 'bg-primary text-white';
      case 'Completed': return 'bg-success text-white';
      case 'Canceled': return 'bg-danger text-white';
      default: return 'bg-secondary text-white';
    }
  };

  // Task list counts
  const immediateOrdersCount = orders.filter(o => (o.immediateItems && o.immediateItems.length > 0) || (o.deliveryType === 'immediate' && (!o.scheduledItems || o.scheduledItems.length === 0))).length;
  const scheduledOrdersCount = orders.filter(o => (o.scheduledItems && o.scheduledItems.length > 0) || o.deliveryType === 'scheduled' || Boolean(o.deliveryTime)).length;

  // Filter & Search
  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      (o.firstName + ' ' + o.lastName).toLowerCase().includes(search.toLowerCase()) ||
      (o.roomNumber || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === '' || o.orderStatus === statusFilter;

    let matchesDelivery = true;
    if (deliveryTab === 'immediate') {
      matchesDelivery = (o.immediateItems && o.immediateItems.length > 0) || (o.deliveryType === 'immediate' && (!o.scheduledItems || o.scheduledItems.length === 0));
    } else if (deliveryTab === 'scheduled') {
      matchesDelivery = (o.scheduledItems && o.scheduledItems.length > 0) || o.deliveryType === 'scheduled' || Boolean(o.deliveryTime);
    }

    return matchesSearch && matchesStatus && matchesDelivery;
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
            {/* TWO TASK LISTS TABS: IMMEDIATE VS SCHEDULED */}
            <div className="d-flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-bold shadow-xs ${
                  deliveryTab === 'immediate'
                    ? 'btn-success text-white'
                    : 'btn-outline-secondary bg-white text-dark'
                }`}
                onClick={() => setDeliveryTab('immediate')}
              >
                <i className="bi bi-lightning-charge-fill text-warning"></i>
                <span>⚡ Immediate Deliveries</span>
                <span className={`badge ${deliveryTab === 'immediate' ? 'bg-white text-success' : 'bg-success text-white'} ms-1`}>
                  {immediateOrdersCount}
                </span>
              </button>

              <button
                type="button"
                className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-bold shadow-xs ${
                  deliveryTab === 'scheduled'
                    ? 'btn-primary text-white'
                    : 'btn-outline-secondary bg-white text-dark'
                }`}
                onClick={() => setDeliveryTab('scheduled')}
              >
                <i className="bi bi-clock-history"></i>
                <span>⏰ Scheduled Breakfast Deliveries (6:00–10:30 AM)</span>
                <span className={`badge ${deliveryTab === 'scheduled' ? 'bg-white text-primary' : 'bg-primary text-white'} ms-1`}>
                  {scheduledOrdersCount}
                </span>
              </button>

              <button
                type="button"
                className={`btn btn-sm d-flex align-items-center gap-2 px-3 py-2 fw-semibold shadow-xs ${
                  deliveryTab === 'all'
                    ? 'btn-secondary text-white'
                    : 'btn-outline-secondary bg-white text-muted'
                }`}
                onClick={() => setDeliveryTab('all')}
              >
                <i className="bi bi-list-check"></i>
                <span>All Orders</span>
                <span className="badge bg-light text-dark ms-1">
                  {orders.length}
                </span>
              </button>
            </div>

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
                  <option value="Pending Delivery">Pending Delivery</option>
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
                            <div className="d-flex flex-column gap-2">
                              {/* Immediate Items Group */}
                              {((o.immediateItems && o.immediateItems.length > 0) || (!o.scheduledItems?.length && o.items.some(it => it.deliveryType !== 'scheduled'))) && (
                                <div className="p-1.5 rounded bg-success-subtle border border-success-subtle">
                                  <div className="d-flex align-items-center gap-1 text-success fw-bold mb-1" style={{ fontSize: '0.72rem' }}>
                                    <i className="bi bi-lightning-charge-fill text-warning"></i>
                                    <span>Immediate Delivery</span>
                                  </div>
                                  {(o.immediateItems || o.items.filter(it => it.deliveryType !== 'scheduled')).map((item, idx) => (
                                    <div key={idx} className="d-flex align-items-center gap-1.5" style={{ fontSize: '0.82rem' }}>
                                      <span className="fw-semibold text-dark">{item.quantity}x {item.name}</span>
                                      <span className="text-muted ms-1">(₱{parseFloat(item.price).toFixed(2)})</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Scheduled Items Group */}
                              {((o.scheduledItems && o.scheduledItems.length > 0) || o.items.some(it => it.deliveryType === 'scheduled')) && (
                                <div className="p-1.5 rounded bg-primary-subtle border border-primary-subtle">
                                  <div className="d-flex align-items-center justify-content-between text-primary fw-bold mb-1" style={{ fontSize: '0.72rem' }}>
                                    <span><i className="bi bi-clock-history me-1"></i>Scheduled Breakfast</span>
                                    <span className="badge bg-white text-primary border border-primary-subtle px-1.5 py-0.5" style={{ fontSize: '0.68rem' }}>
                                      {o.deliveryDate ? `${o.deliveryDate} ` : ''}{o.deliveryTime || '07:30 AM'}
                                    </span>
                                  </div>
                                  {(o.scheduledItems || o.items.filter(it => it.deliveryType === 'scheduled')).map((item, idx) => (
                                    <div key={idx} className="d-flex align-items-center gap-1.5" style={{ fontSize: '0.82rem' }}>
                                      <span className="fw-semibold text-dark">{item.quantity}x {item.name}</span>
                                      <span className="text-muted ms-1">(₱{parseFloat(item.price).toFixed(2)})</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
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
                      options={activeBookings.map(b => {
                        const isCheckedIn = (b.bookingStatus === 'Checked In');
                        return {
                          value: String(b.guestID),
                          label: `Room ${b.roomNumber} — ${b.lastName}, ${b.firstName} (${isCheckedIn ? 'Checked In' : 'Pending Check-in'})`
                        };
                      })}
                      value={newOrderForm.guestID}
                      onChange={(val) => setNewOrderForm(prev => ({ ...prev, guestID: val }))}
                      placeholder="Type to search guest or room..."
                    />
                    {(() => {
                      const selectedBooking = activeBookings.find(b => String(b.guestID) === String(newOrderForm.guestID));
                      if (selectedBooking && selectedBooking.bookingStatus !== 'Checked In') {
                        return (
                          <div className="alert alert-warning py-1.5 px-2.5 mt-2 mb-0 small d-flex align-items-center gap-1.5" style={{ fontSize: '0.76rem' }}>
                            <i className="bi bi-info-circle-fill text-warning-emphasis"></i>
                            <span><strong>Guest not yet checked in:</strong> Order will be recorded as <strong>Pending Delivery</strong> and will automatically activate once the guest checks in.</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
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

                    {(() => {
                      if (!selectedItemToAdd.idAndType) return null;
                      const [itemIDStr, type] = selectedItemToAdd.idAndType.split('-');
                      const id = parseInt(itemIDStr);
                      const found = type === 'Product' 
                        ? (products.find(p => p.productID === id) || cookedMeals.find(m => m.productID === id))
                        : amenities.find(a => a.amenityID === id);
                      if (!found) return null;
                      const fallback = type === 'Amenity' ? 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200&auto=format&fit=crop&q=80' : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&auto=format&fit=crop&q=80';
                      return (
                        <div className="col-12 mt-2">
                          <div className="d-flex align-items-center gap-3 p-2 bg-white rounded border">
                            {found.image ? (
                              <img
                                src={found.image}
                                alt={found.name}
                                className="rounded border flex-shrink-0"
                                style={{ width: '46px', height: '46px', objectFit: 'cover' }}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fb = e.currentTarget.parentElement?.querySelector('.image-fallback-card');
                                  if (fb) fb.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className="image-fallback-card rounded border bg-light text-muted flex-column align-items-center justify-content-center text-center flex-shrink-0" style={{ width: '46px', height: '46px', fontSize: '0.62rem', lineHeight: 1.1, display: found.image ? 'none' : 'flex' }}>
                              <i className="bi bi-image mb-0.5" style={{ fontSize: '0.75rem' }}></i>
                              No Image
                            </div>
                            <div>
                              <div className="fw-bold text-dark">{found.name}</div>
                              <div className="small text-muted">
                                Price: <strong className="text-pcc-blue">₱{parseFloat(found.price).toFixed(2)}</strong> | Stock: {found.quantity ?? 'Available'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {(activeItemCategory === 'Meal' || newOrderForm.items.some(item => item.deliveryType === 'scheduled' || cookedMeals.some(m => m.productID === item.itemID))) && (() => {
                    const slots = ['06:30 AM', '07:00 AM', '07:30 AM', '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM'];
                    const todayManila = getTodayManila();
                    const selectedDate = newOrderForm.deliveryDate || todayManila;
                    const isToday = selectedDate === todayManila;

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
                      // ONLY mark as passed if delivery is scheduled for TODAY and current time has elapsed
                      const isPast = isToday && (slotMin <= currentMinutes);
                      return { slot, isPast };
                    });

                    const allTodayPassed = isToday && evaluatedSlots.every(s => s.isPast);

                    return (
                      <div className="mb-3 p-3 bg-primary-subtle border border-primary-subtle rounded">
                        <div className="row g-2">
                          <div className="col-md-6">
                            <label className="form-label fw-bold text-primary small mb-1">
                              Delivery Date *
                            </label>
                            <input
                              type="date"
                              className="form-control form-control-sm fw-semibold"
                              min={todayManila}
                              value={newOrderForm.deliveryDate || todayManila}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                setNewOrderForm(prev => ({ ...prev, deliveryDate: newDate }));
                              }}
                            />
                            <small className="text-muted d-block mt-1" style={{ fontSize: '0.70rem' }}>
                              Select today or schedule advance delivery for tomorrow or future dates.
                            </small>
                          </div>
                          <div className="col-md-6">
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
                            <small className="text-muted d-block mt-1" style={{ fontSize: '0.70rem' }}>
                              Breakfast is prepared and delivered between 6:30 AM and 10:30 AM.
                            </small>
                          </div>
                        </div>
                        {allTodayPassed && (
                          <div className="alert alert-warning py-1.5 px-2.5 mt-2 mb-0 d-flex align-items-center gap-1.5" style={{ fontSize: '0.75rem' }}>
                            <i className="fa-solid fa-circle-info"></i>
                            <span>All breakfast slots have passed for today. Select tomorrow or a future date to schedule advance breakfast delivery.</span>
                          </div>
                        )}
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
                          <th>Delivery Mode</th>
                          <th>Price</th>
                          <th>Quantity</th>
                          <th>Total</th>
                          <th className="text-end pe-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newOrderForm.items.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="text-center py-4 text-muted small">
                              No items added to the bucket yet.
                            </td>
                          </tr>
                        ) : (
                          newOrderForm.items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="ps-3 fw-bold">
                                <div className="d-flex align-items-center gap-2">
                                  {item.image ? (
                                    <img
                                      src={item.image}
                                      alt={item.name}
                                      className="rounded border flex-shrink-0"
                                      style={{ width: '32px', height: '32px', objectFit: 'cover' }}
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const fb = e.currentTarget.parentElement?.querySelector('.image-fallback-sm');
                                        if (fb) fb.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className="image-fallback-sm rounded border bg-light text-muted flex-column align-items-center justify-content-center text-center p-0.5 flex-shrink-0" style={{ width: '32px', height: '32px', fontSize: '0.52rem', lineHeight: 1.1, display: item.image ? 'none' : 'flex' }}>
                                    <i className="bi bi-image" style={{ fontSize: '0.65rem' }}></i>
                                    No Image
                                  </div>
                                  <span>{item.name}</span>
                                </div>
                              </td>
                              <td><span className="badge bg-secondary-subtle text-secondary">{item.type}</span></td>
                              <td>
                                {item.isCookedMeal ? (
                                  <span className="badge bg-warning-subtle text-dark border border-warning-subtle" style={{ fontSize: '0.70rem' }}>
                                    ⏰ Scheduled (6:00–10:30 AM)
                                  </span>
                                ) : (
                                  <div className="form-check mb-0" style={{ fontSize: '0.72rem' }}>
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id={`rec-item-bundle-${idx}`}
                                      checked={item.deliveryType === 'scheduled'}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setNewOrderForm(prev => {
                                          const updated = [...prev.items];
                                          updated[idx] = { ...updated[idx], deliveryType: checked ? 'scheduled' : 'immediate' };
                                          return { ...prev, items: updated };
                                        });
                                      }}
                                    />
                                    <label className="form-check-label text-muted user-select-none fw-semibold" htmlFor={`rec-item-bundle-${idx}`}>
                                      Deliver with breakfast
                                    </label>
                                  </div>
                                )}
                              </td>
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
                  {viewingOrder.deliveryTime && (
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Scheduled Delivery:</span>
                      <strong className="text-primary">{viewingOrder.deliveryDate ? `${viewingOrder.deliveryDate} ` : ''}{viewingOrder.deliveryTime}</strong>
                    </div>
                  )}
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
                        <th className="text-center">Delivery Mode</th>
                        <th className="text-center">Qty</th>
                        <th className="text-end">Unit Price</th>
                        <th className="text-end">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingOrder.items.map((it, i) => (
                        <tr key={i}>
                          <td className="fw-semibold text-dark">
                            <div className="d-flex align-items-center gap-2">
                              {it.image ? (
                                <img
                                  src={it.image}
                                  alt={it.name}
                                  className="rounded border flex-shrink-0"
                                  style={{ width: '30px', height: '30px', objectFit: 'cover' }}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fb = e.currentTarget.parentElement?.querySelector('.image-fallback-sm');
                                    if (fb) fb.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className="image-fallback-sm rounded border bg-light text-muted flex-column align-items-center justify-content-center text-center p-0.5 flex-shrink-0" style={{ width: '30px', height: '30px', fontSize: '0.52rem', lineHeight: 1.1, display: it.image ? 'none' : 'flex' }}>
                                <i className="bi bi-image" style={{ fontSize: '0.65rem' }}></i>
                                No Image
                              </div>
                              <span>{it.name}</span>
                            </div>
                          </td>
                          <td className="text-center">
                            <span className={`badge ${it.deliveryType === 'scheduled' ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-success-subtle text-success border border-success-subtle'} px-2 py-0.5`} style={{ fontSize: '0.70rem' }}>
                              {it.deliveryType === 'scheduled' ? '⏰ With Breakfast' : '⚡ Immediate'}
                            </span>
                          </td>
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
