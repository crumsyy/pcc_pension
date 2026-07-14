'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';
import SearchableSelect from '../../components/SearchableSelect';


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

  const comboboxOptions = [
    ...products.map(p => ({
      idAndType: `${p.productID}-Product`,
      displayName: p.name,
      name: p.productCategoryID === 3 ? `${p.name} - ₱${p.price} (Prepared on Order)` : `${p.name} - ₱${p.price} (${p.quantity} left)`,
      type: 'Product',
      price: p.price,
      quantity: p.quantity,
      productCategoryID: p.productCategoryID
    })),
    ...amenities.map(a => ({
      idAndType: `${a.amenityID}-Amenity`,
      displayName: a.name,
      name: `${a.name} - ₱${a.price} (${a.quantity} left)`,
      type: 'Amenity',
      price: a.price,
      quantity: a.quantity
    }))
  ];

  return (
    <>
      <div className="container-fluid py-4" style={{ backgroundColor: '#f8f9fa', minHeight: '85vh' }}>
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
            <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
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
                            <div className="d-flex justify-content-end gap-1">
                              {o.orderStatus === 'Preparing' && (
                                <>
                                  <button 
                                    className="btn btn-sm btn-success text-white" 
                                    onClick={() => handleUpdateOrderStatus(o.orderID, 'Completed')}
                                    style={{ borderRadius: '20px' }}
                                  >
                                    ✓ Serve
                                  </button>
                                  <button 
                                    className="btn btn-sm btn-danger text-white" 
                                    onClick={() => handleUpdateOrderStatus(o.orderID, 'Canceled')}
                                    style={{ borderRadius: '20px' }}
                                  >
                                    Cancel
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
                    <div className="col-md-7">
                      <label className="form-label fw-semibold">Select Item to Add</label>
                      <SearchableSelect
                        options={comboboxOptions.map(opt => ({
                          value: opt.idAndType,
                          label: `${opt.displayName} (₱${opt.price} | ${opt.productCategoryID === 3 ? (opt.quantity > 0 ? 'Available' : 'Not Available') : `Stock: ${opt.quantity}`})`
                        }))}
                        value={selectedItemToAdd.idAndType}
                        onChange={(val) => setSelectedItemToAdd(prev => ({ ...prev, idAndType: val }))}
                        placeholder="Type to search product or amenity..."
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
