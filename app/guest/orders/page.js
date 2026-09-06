'use client';

import React, { useState, useEffect } from 'react';
import GuestLayout from '../GuestLayout';

export default function GuestOrdersPage({ guest: initialGuest = null } = {}) {
  const [guest, setGuest] = useState(initialGuest);
  const [products, setProducts] = useState([]);
  const [cookedMeals, setCookedMeals] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Active Category Filter: 'all' | 'meals' | 'products' | 'amenities' | 'history'
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Cart / Order Tray State: array of { itemID, type, name, price, quantity, isCookedMeal }
  const [cart, setCart] = useState([]);

  // Delivery Scheduling State for Cooked Meals (Safely populated on client mount to prevent Vercel prerender errors)
  const [todayStr, setTodayStr] = useState('');
  const [tomorrowStr, setTomorrowStr] = useState('');
  const [currentMins, setCurrentMins] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('07:30 AM');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isClientMounted, setIsClientMounted] = useState(false);

  useEffect(() => {
    try {
      const dateFmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const timeFmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const now = new Date();
      const today = dateFmt.format(now);
      const tParts = timeFmt.formatToParts(now);
      const p = {};
      tParts.forEach(({ type, value }) => { p[type] = value; });
      const mins = parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10);

      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      const tomorrow = dateFmt.format(d);

      setTodayStr(today);
      setTomorrowStr(tomorrow);
      setCurrentMins(mins);
      setDeliveryDate(mins > 630 ? tomorrow : today);
      setIsClientMounted(true);
    } catch (e) {
      const d = new Date();
      const today = d.toISOString().split('T')[0];
      setTodayStr(today);
      setDeliveryDate(today);
      setIsClientMounted(true);
    }
  }, []);

  const fetchCatalogAndOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/guest/orders');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load guest orders');

      setProducts(data.products || []);
      setCookedMeals(data.cookedMeals || []);
      setAmenities(data.amenities || []);
      setOrderHistory(data.orders || []);
      if (data.guest) setGuest(data.guest);
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogAndOrders();
  }, []);

  const hasCookedMealsInCart = cart.some(item => item.isCookedMeal);

  const handleAddToCart = (item, type, isCookedMeal = false) => {
    const itemID = type === 'Product' ? item.productID : item.amenityID;
    const existsIndex = cart.findIndex(c => c.itemID === itemID && c.type === type);

    if (existsIndex >= 0) {
      const updated = [...cart];
      if (!isCookedMeal && item.availableQty && updated[existsIndex].quantity + 1 > item.availableQty) {
        setFeedback({ type: 'warning', message: `Only ${item.availableQty} units available in inventory for ${item.name}.` });
        return;
      }
      updated[existsIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart(prev => [
        ...prev,
        {
          itemID,
          type,
          name: item.name,
          price: parseFloat(item.price),
          quantity: 1,
          isCookedMeal
        }
      ]);
    }
    setFeedback({ type: 'success', message: `Added 1x ${item.name} to your Order Tray.` });
  };

  const handleUpdateQty = (index, newQty) => {
    if (newQty <= 0) {
      handleRemoveFromCart(index);
      return;
    }
    const updated = [...cart];
    updated[index].quantity = newQty;
    setCart(updated);
  };

  const handleRemoveFromCart = (index) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Delivery Slots Evaluation (between 06:00 AM and 10:30 AM)
  const allowedSlots = ['06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM', '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM'];
  const isSelectedDateToday = isClientMounted && Boolean(todayStr) && (deliveryDate === todayStr);

  const evaluatedSlots = allowedSlots.map(slot => {
    if (!isClientMounted) return { slot, isPast: false };
    const [timePart, meridiem] = slot.split(' ');
    const [h, m] = timePart.split(':');
    let hr = parseInt(h, 10);
    if (meridiem === 'PM' && hr !== 12) hr += 12;
    if (meridiem === 'AM' && hr === 12) hr = 0;
    const slotMin = hr * 60 + parseInt(m, 10);
    // Disable slot ONLY if delivery is scheduled for TODAY and time has elapsed
    const isPast = isSelectedDateToday && (slotMin <= currentMins);
    return { slot, isPast };
  });

  const allTodaySlotsPassed = isClientMounted && isSelectedDateToday && evaluatedSlots.every(s => s.isPast);

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setFeedback({ type: 'warning', message: 'Your Order Tray is empty. Please add items to order.' });
      return;
    }

    if (hasCookedMealsInCart) {
      if (allTodaySlotsPassed && isSelectedDateToday) {
        setFeedback({
          type: 'danger',
          message: 'All breakfast delivery times have passed for today. Please change your delivery date to tomorrow or a future date.'
        });
        return;
      }
    }

    setSubmitting(true);
    setFeedback({ type: '', message: '' });

    try {
      const targetDate = deliveryDate || todayStr;
      const res = await fetch('/api/guest/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({
            itemID: item.itemID,
            type: item.type,
            quantity: item.quantity,
            name: item.name
          })),
          deliveryDate: hasCookedMealsInCart ? targetDate : null,
          deliveryTime: hasCookedMealsInCart ? deliveryTime : null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');

      setFeedback({
        type: 'success',
        message: 'Order placed successfully! Your items have been added to your stay billing.'
      });
      setCart([]);
      fetchCatalogAndOrders();
      setActiveCategory('history');
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message });
    } finally {
      setSubmitting(false);
    }
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

  const filteredMeals = cookedMeals.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredAmenities = amenities.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <GuestLayout activeTab="orders" guest={guest}>
      <div className="container-fluid py-4 px-3 px-md-4 px-lg-5">
        {/* TOP HEADER */}
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2 border-bottom pb-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge text-white px-2.5 py-1 fw-bold" style={{ backgroundColor: 'var(--pcc-blue)' }}>
                Room Service & Store
              </span>
              <span className="badge bg-success text-white px-2 py-1">Guest Portal</span>
            </div>
            <h2 className="fw-bold mb-0 text-pcc-blue" style={{ color: 'var(--pcc-blue)' }}>
              Room Orders & Cooked Meals
            </h2>
            <p className="text-muted small mb-0">
              Order fresh breakfast meals, refreshments, beverages, and extra amenities directly to your room.
            </p>
          </div>
        </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show shadow-xs mb-4`} role="alert">
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-5`}></i>
            <div>{feedback.message}</div>
          </div>
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', message: '' })}></button>
        </div>
      )}

      {/* NAVIGATION TABS & SEARCH BAR */}
      <div className="row g-3 align-items-center mb-4">
        <div className="col-md-8">
          <div className="btn-group flex-wrap shadow-xs" role="group">
            <button
              type="button"
              className={`btn btn-sm px-3 fw-semibold ${activeCategory === 'all' ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
              onClick={() => setActiveCategory('all')}
            >
              All Items
            </button>
            <button
              type="button"
              className={`btn btn-sm px-3 fw-semibold ${activeCategory === 'meals' ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
              onClick={() => setActiveCategory('meals')}
            >
              🍳 Cooked Meals ({cookedMeals.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm px-3 fw-semibold ${activeCategory === 'products' ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
              onClick={() => setActiveCategory('products')}
            >
              🥤 Products & Drinks ({products.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm px-3 fw-semibold ${activeCategory === 'amenities' ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
              onClick={() => setActiveCategory('amenities')}
            >
              🛎️ Amenities ({amenities.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm px-3 fw-semibold ${activeCategory === 'history' ? 'btn-primary' : 'btn-outline-secondary bg-white'}`}
              onClick={() => setActiveCategory('history')}
            >
              📋 My Orders ({orderHistory.length})
            </button>
          </div>
        </div>
        <div className="col-md-4">
          <div className="input-group input-group-sm">
            <span className="input-group-text bg-white border-end-0"><i className="bi bi-search"></i></span>
            <input
              type="text"
              className="form-control border-start-0"
              placeholder="Search items by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA: CATALOG + CART */}
      <div className="row g-4">
        {/* CATALOG COLUMN */}
        <div className="col-12 col-md-7 col-lg-7 col-xl-8">
          {activeCategory === 'history' ? (
            /* ORDER HISTORY VIEW */
            <div className="card border-0 shadow-sm rounded-3 bg-white p-4">
              <h5 className="fw-bold text-dark border-bottom pb-2 mb-3 d-flex align-items-center justify-content-between">
                <span><i className="bi bi-clock-history me-2 text-primary"></i>My Order History</span>
                <span className="badge bg-light text-muted fw-normal">{orderHistory.length} total orders</span>
              </h5>

              {orderHistory.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-receipt fs-1 d-block mb-2 text-secondary opacity-50"></i>
                  <h6 className="fw-bold">No orders recorded yet</h6>
                  <p className="small">Items you order during your stay will appear here with real-time preparation tracking.</p>
                  <button className="btn btn-sm btn-outline-primary fw-semibold mt-1" onClick={() => setActiveCategory('all')}>
                    Browse Catalog
                  </button>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle mb-0" style={{ fontSize: '0.86rem' }}>
                    <thead className="table-light">
                      <tr>
                        <th>Order #</th>
                        <th>Date & Time</th>
                        <th>Items</th>
                        <th>Scheduled Delivery</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderHistory.map(o => {
                        const totalAmt = (o.items || []).reduce((sum, it) => sum + (parseFloat(it.price) * it.quantity), 0);
                        return (
                          <tr key={o.orderID}>
                            <td className="fw-bold text-muted">#{o.orderID}</td>
                            <td>{new Date(o.orderDateTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                            <td>
                              <div className="d-flex flex-column gap-0.5">
                                {(o.items || []).map((it, idx) => (
                                  <div key={idx} className="small">
                                    <span className="fw-bold text-dark">{it.quantity}x</span> {it.name}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td>
                              {o.deliveryTime ? (
                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style={{ fontSize: '0.74rem' }}>
                                  <i className="bi bi-clock me-1"></i>{o.deliveryDate ? `${o.deliveryDate} ` : ''}{o.deliveryTime}
                                </span>
                              ) : (
                                <span className="text-muted small">Standard Immediate Delivery</span>
                              )}
                            </td>
                            <td className="fw-bold text-success">₱{totalAmt.toFixed(2)}</td>
                            <td>
                              <span className={`badge ${getStatusBadge(o.orderStatus)} px-2.5 py-1 rounded-pill`} style={{ fontSize: '0.75rem' }}>
                                {o.orderStatus}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* CATALOG ITEMS GRID */
            <div className="d-flex flex-column gap-4">
              {/* COOKED MEALS SECTION */}
              {(activeCategory === 'all' || activeCategory === 'meals') && filteredMeals.length > 0 && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                      <span className="p-1 px-2 rounded bg-warning-subtle text-dark small fw-bold">Breakfast</span>
                      <span>Cooked Meals (Scheduled Delivery)</span>
                    </h5>
                    <small className="text-muted">Available slots: 6:00 AM – 10:30 AM</small>
                  </div>
                  <div className="row g-3">
                    {filteredMeals.map(m => (
                      <div key={m.productID} className="col-12 col-sm-6 col-xl-4">
                        <div className="card h-100 border-0 shadow-sm rounded-3 bg-white p-3 d-flex flex-column justify-content-between">
                          <div>
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <span className="badge bg-warning-subtle text-dark border border-warning-subtle small">Cooked Meal</span>
                              <span className="fw-bold text-success fs-6">₱{parseFloat(m.price).toFixed(2)}</span>
                            </div>
                            <h6 className="fw-bold text-dark mb-1">{m.name}</h6>
                            <p className="text-muted small mb-3" style={{ fontSize: '0.76rem' }}>
                              Freshly prepared breakfast meal served with scheduled room delivery tracking.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary w-100 fw-semibold d-flex align-items-center justify-content-center gap-1 shadow-xs"
                            style={{ backgroundColor: 'var(--pcc-blue)', borderColor: 'var(--pcc-blue)', borderRadius: '6px' }}
                            onClick={() => handleAddToCart(m, 'Product', true)}
                          >
                            <i className="bi bi-cart-plus"></i>Add to Order Tray
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PRODUCTS SECTION */}
              {(activeCategory === 'all' || activeCategory === 'products') && filteredProducts.length > 0 && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                      <span className="p-1 px-2 rounded bg-info-subtle text-dark small fw-bold">Minibar / Store</span>
                      <span>Beverages & Snacks</span>
                    </h5>
                    <small className="text-muted">Immediate room delivery</small>
                  </div>
                  <div className="row g-3">
                    {filteredProducts.map(p => (
                      <div key={p.productID} className="col-12 col-sm-6 col-xl-4">
                        <div className="card h-100 border-0 shadow-sm rounded-3 bg-white p-3 d-flex flex-column justify-content-between">
                          <div>
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <span className="badge bg-light text-muted border small">Stock: {p.availableQty || 0}</span>
                              <span className="fw-bold text-success fs-6">₱{parseFloat(p.price).toFixed(2)}</span>
                            </div>
                            <h6 className="fw-bold text-dark mb-1">{p.name}</h6>
                            <p className="text-muted small mb-3" style={{ fontSize: '0.76rem' }}>
                              Available for prompt delivery to your hotel room.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary w-100 fw-semibold d-flex align-items-center justify-content-center gap-1 shadow-xs"
                            style={{ borderRadius: '6px' }}
                            disabled={p.availableQty <= 0}
                            onClick={() => handleAddToCart(p, 'Product', false)}
                          >
                            <i className="bi bi-cart-plus"></i>{p.availableQty > 0 ? 'Add to Order Tray' : 'Out of Stock'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AMENITIES SECTION */}
              {(activeCategory === 'all' || activeCategory === 'amenities') && filteredAmenities.length > 0 && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                      <span className="p-1 px-2 rounded bg-secondary-subtle text-dark small fw-bold">Guest Service</span>
                      <span>Hotel Amenities</span>
                    </h5>
                    <small className="text-muted">Towels, toiletries & extra amenities</small>
                  </div>
                  <div className="row g-3">
                    {filteredAmenities.map(a => (
                      <div key={a.amenityID} className="col-12 col-sm-6 col-xl-4">
                        <div className="card h-100 border-0 shadow-sm rounded-3 bg-white p-3 d-flex flex-column justify-content-between">
                          <div>
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <span className="badge bg-light text-muted border small">Available: {a.availableQty || 0}</span>
                              <span className="fw-bold text-success fs-6">₱{parseFloat(a.price).toFixed(2)}</span>
                            </div>
                            <h6 className="fw-bold text-dark mb-1">{a.name}</h6>
                            <p className="text-muted small mb-3" style={{ fontSize: '0.76rem' }}>
                              Extra guest room amenity delivered directly by front desk staff.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary w-100 fw-semibold d-flex align-items-center justify-content-center gap-1 shadow-xs"
                            style={{ borderRadius: '6px' }}
                            disabled={a.availableQty <= 0}
                            onClick={() => handleAddToCart(a, 'Amenity', false)}
                          >
                            <i className="bi bi-cart-plus"></i>{a.availableQty > 0 ? 'Add to Order Tray' : 'Unavailable'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ORDER TRAY / CART COLUMN */}
        <div className="col-12 col-md-5 col-lg-5 col-xl-4">
          <div className="card border-0 shadow-sm rounded-3 bg-white p-4 sticky-top" style={{ top: '20px' }}>
            <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
              <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                <i className="bi bi-cart3 text-primary"></i>
                <span>Order Tray</span>
              </h5>
              <span className="badge bg-primary rounded-pill text-white px-2.5 py-1">
                {cart.reduce((s, it) => s + it.quantity, 0)} Items
              </span>
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <i className="bi bi-cart-x fs-1 d-block mb-1 text-secondary opacity-50"></i>
                <small className="d-block">Your order tray is currently empty.</small>
                <small className="text-muted" style={{ fontSize: '0.72rem' }}>Click "Add to Order Tray" on any item to build your room order.</small>
              </div>
            ) : (
              <form onSubmit={handleSubmitOrder}>
                {/* ITEMS LIST */}
                <div className="d-flex flex-column gap-2 mb-3" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {cart.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-light rounded-2 border d-flex align-items-center justify-content-between" style={{ fontSize: '0.84rem' }}>
                      <div>
                        <div className="fw-bold text-dark">{item.name}</div>
                        <div className="text-muted small">
                          ₱{item.price.toFixed(2)} each {item.isCookedMeal && <span className="badge bg-warning-subtle text-dark ms-1" style={{ fontSize: '0.65rem' }}>Meal</span>}
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <div className="input-group input-group-sm" style={{ width: '90px' }}>
                          <button
                            type="button"
                            className="btn btn-outline-secondary px-2"
                            onClick={() => handleUpdateQty(idx, item.quantity - 1)}
                          >
                            -
                          </button>
                          <input
                            type="text"
                            readOnly
                            className="form-control text-center fw-bold bg-white"
                            value={item.quantity}
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary px-2"
                            onClick={() => handleUpdateQty(idx, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="btn btn-link text-danger p-0 ms-1"
                          onClick={() => handleRemoveFromCart(idx)}
                          title="Remove item"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* COOKED MEAL DELIVERY TIME RESTRICTION & PICKER */}
                {hasCookedMealsInCart && (
                  <div className="p-3 bg-primary-subtle border border-primary-subtle rounded-3 mb-3">
                    <div className="d-flex align-items-center gap-1.5 mb-2 text-primary fw-bold small">
                      <i className="bi bi-clock-history"></i>
                      <span>Breakfast Delivery Scheduling</span>
                    </div>

                    <div className="mb-2">
                      <label className="form-label mb-1 text-muted small fw-semibold">Delivery Date *</label>
                      <input
                        type="date"
                        className="form-control form-control-sm fw-semibold"
                        min={todayStr}
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        required
                      />
                      <small className="text-muted" style={{ fontSize: '0.70rem' }}>
                        Advance orders can be scheduled for tomorrow morning.
                      </small>
                    </div>

                    <div className="mb-1">
                      <label className="form-label mb-1 text-muted small fw-semibold">Delivery Time Slot (6:00 AM – 10:30 AM) *</label>
                      <select
                        className="form-select form-select-sm fw-semibold"
                        value={deliveryTime}
                        onChange={(e) => setDeliveryTime(e.target.value)}
                        required
                      >
                        {evaluatedSlots.map(({ slot, isPast }) => (
                          <option key={slot} value={slot} disabled={isPast}>
                            {slot} {isPast ? '(Passed)' : ''}
                          </option>
                        ))}
                      </select>
                      <small className="text-muted" style={{ fontSize: '0.70rem' }}>
                        Cooked meals are prepared and delivered between 6:00 AM and 10:30 AM.
                      </small>
                    </div>

                    {allTodaySlotsPassed && (
                      <div className="alert alert-warning py-1.5 px-2 mt-2 mb-0 d-flex align-items-center gap-1 text-dark" style={{ fontSize: '0.74rem' }}>
                        <i className="bi bi-exclamation-circle-fill text-warning"></i>
                        <span>Today's breakfast slots have passed. Please select tomorrow to schedule advance breakfast.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* TOTAL SUMMARY */}
                <div className="p-3 bg-light rounded-2 border mb-3">
                  <div className="d-flex justify-content-between mb-1 small text-muted">
                    <span>Subtotal:</span>
                    <span>₱{cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1 small text-muted">
                    <span>Delivery / Room Service Fee:</span>
                    <span className="text-success fw-bold">FREE</span>
                  </div>
                  <div className="d-flex justify-content-between pt-2 border-top fw-bold text-dark">
                    <span>Total Charge to Room:</span>
                    <span className="text-primary fs-5">₱{cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* SUBMIT BUTTON */}
                <button
                  type="submit"
                  className="btn btn-primary w-100 py-2.5 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
                  style={{ backgroundColor: 'var(--pcc-blue)', borderColor: 'var(--pcc-blue)', borderRadius: '8px' }}
                  disabled={submitting || (hasCookedMealsInCart && allTodaySlotsPassed && isSelectedDateToday)}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Placing Room Order...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-fill"></i>
                      <span>Submit Room Order</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
    </GuestLayout>
  );
}
