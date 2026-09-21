'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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

const getTomorrowManila = () => {
  try {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch (e) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
};

const getNowManilaMinutes = () => {
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
    return parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10);
  } catch (e) {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
};

const CatalogItemCard = React.memo(function CatalogItemCard({ item, type, isCookedMeal, onAdd }) {
  const isAvailable = isCookedMeal || (item.quantity === undefined || item.quantity > 0);
  const badgeLabel = isCookedMeal ? 'Cooked Meal (Scheduled)' : type === 'Amenity' ? 'Amenity (Immediate)' : 'Minibar / Store (Immediate)';
  const badgeClass = isCookedMeal ? 'bg-warning-subtle text-dark border-warning-subtle' : type === 'Amenity' ? 'bg-secondary-subtle text-dark border-secondary-subtle' : 'bg-info-subtle text-dark border-info-subtle';
  const descText = isCookedMeal 
    ? 'Freshly prepared breakfast meal served during 6:00 AM – 10:30 AM delivery window.'
    : type === 'Amenity'
    ? 'Extra guest room amenity delivered immediately to the room.'
    : 'Snacks & beverages available for immediate delivery to guest room.';

  return (
    <div 
      className="card h-100 shadow-sm border border-secondary-subtle rounded-3 bg-white overflow-hidden d-flex flex-column justify-content-between order-item-card"
      tabIndex="0"
    >
      <div>
        {item.image ? (
          <div className="catalog-img-wrap" style={{ height: '140px', overflow: 'hidden', position: 'relative' }}>
            <img
              src={item.image}
              alt={`${item.name} - ${badgeLabel}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.parentElement?.querySelector('.image-fallback-err');
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="image-fallback image-fallback-err flex-column align-items-center justify-content-center bg-light text-muted border-bottom w-100 h-100" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'none' }}>
              <i className="bi bi-image fs-4 mb-1 opacity-50"></i>
              <span>No Image Available</span>
            </div>
          </div>
        ) : (
          <div className="image-fallback catalog-img-wrap d-flex flex-column align-items-center justify-content-center bg-light text-muted border-bottom" style={{ height: '140px', fontSize: '0.75rem', fontWeight: 600 }}>
            <i className="bi bi-image fs-4 mb-1 opacity-50"></i>
            <span>No Image Available</span>
          </div>
        )}
        <div className="p-3 pb-0 flex-grow-1 d-flex flex-column">
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-1 gap-1">
            <span className={`badge border small ${badgeClass}`} style={{ fontSize: '0.68rem' }}>{badgeLabel}</span>
            <span className="fw-bold text-success" style={{ fontSize: '0.90rem' }}>₱{parseFloat(item.price).toFixed(2)}</span>
          </div>
          <h6 className="fw-bold text-dark mb-1 catalog-item-title" title={item.name}>{item.name}</h6>
          <p className="text-muted small mb-2" style={{ fontSize: '0.76rem', lineHeight: '1.3' }}>
            {descText}
          </p>
          <div className="mb-2">
            <span className={`badge ${isAvailable ? 'bg-light text-muted border' : 'bg-danger text-white'}`} style={{ fontSize: '0.70rem' }}>
              {isCookedMeal ? 'Cooked to Order' : isAvailable ? `Stock: ${item.quantity} available` : 'Out of Stock'}
            </span>
          </div>
        </div>
      </div>
      <div className="p-3 pt-1 mt-auto">
        {isCookedMeal ? (
          <div className="mb-2 pt-1 border-top">
            <span className="badge bg-warning-subtle text-dark border border-warning-subtle small py-1 px-2 d-inline-block" style={{ fontSize: '0.68rem' }}>
              <i className="bi bi-clock-history me-1 text-warning-emphasis"></i>⏰ Scheduled Breakfast (6:00 AM – 10:30 AM)
            </span>
          </div>
        ) : null}
        <button
          type="button"
          className={`btn btn-sm w-100 fw-semibold d-flex align-items-center justify-content-center gap-1 shadow-xs catalog-add-btn ${isAvailable ? 'btn-primary text-white' : 'btn-secondary text-white'}`}
          style={{ backgroundColor: isAvailable ? 'var(--pcc-blue, #2155B5)' : undefined, borderColor: isAvailable ? 'var(--pcc-blue, #2155B5)' : undefined, borderRadius: '6px' }}
          disabled={!isAvailable}
          onClick={() => onAdd(item, type, isCookedMeal, isCookedMeal ? 'scheduled' : 'immediate')}
          aria-label={isAvailable ? `Add ${item.name} to Order Tray` : `${item.name} is Out of Stock`}
        >
          <i className="bi bi-cart-plus"></i>
          <span>{isAvailable ? 'Add to Order Tray' : 'Out of Stock'}</span>
        </button>
      </div>
    </div>
  );
});

function DeliveryTimeline({ deliveryType, currentStatus }) {
  const isScheduled = deliveryType === 'scheduled';
  const steps = isScheduled
    ? [
        { key: 'Placed', label: 'Placed' },
        { key: 'Scheduled', label: 'Scheduled' },
        { key: 'Preparing', label: 'Preparing' },
        { key: 'Out for Delivery', label: 'Out for Delivery' },
        { key: 'Completed', label: 'Completed' }
      ]
    : [
        { key: 'Placed', label: 'Placed' },
        { key: 'Preparing', label: 'Preparing' },
        { key: 'Out for Delivery', label: 'Out for Delivery' },
        { key: 'Completed', label: 'Completed' }
      ];

  const getStepIndex = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('cancel')) return -1;
    if (isScheduled) {
      if (s.includes('complete') || s === 'delivered') return 4;
      if (s.includes('out for delivery') || s === 'served') return 3;
      if (s.includes('prepar')) return 2;
      if (s.includes('schedul')) return 1;
      return 0;
    } else {
      if (s.includes('complete') || s === 'delivered') return 3;
      if (s.includes('out for delivery') || s === 'served') return 2;
      if (s.includes('prepar')) return 1;
      return 0;
    }
  };

  const currentIdx = getStepIndex(currentStatus);
  const isCanceled = (currentStatus || '').toLowerCase().includes('cancel');

  if (currentStatus === 'Pending Delivery') {
    return (
      <div className="py-2 text-center">
        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning px-3 py-1.5 rounded-pill" style={{ fontSize: '0.76rem' }}>
          <i className="bi bi-hourglass-split me-1"></i>Order Placed — Awaiting Guest Check-In &amp; Room Occupancy
        </span>
      </div>
    );
  }

  if (isCanceled) {
    return (
      <div className="py-2 text-center">
        <span className="badge bg-danger text-white px-3 py-1 rounded-pill" style={{ fontSize: '0.74rem' }}>
          <i className="bi bi-x-circle me-1"></i>Order Canceled
        </span>
      </div>
    );
  }

  return (
    <div className="py-2 px-1 w-100">
      <div className="d-flex align-items-center justify-content-between position-relative">
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '24px',
            right: '24px',
            height: '3px',
            backgroundColor: '#e2e8f0',
            zIndex: 1
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '24px',
            width: steps.length > 1 && currentIdx >= 0 ? `${(Math.min(currentIdx, steps.length - 1) / (steps.length - 1)) * 100}%` : '0%',
            maxWidth: 'calc(100% - 48px)',
            height: '3px',
            backgroundColor: '#2155B5',
            zIndex: 2,
            transition: 'width 0.4s ease'
          }}
        />

        {steps.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <div
              key={step.key}
              className="d-flex flex-column align-items-center text-center"
              style={{ zIndex: 3, minWidth: '56px' }}
            >
              <div
                className={`rounded-circle d-flex align-items-center justify-content-center fw-bold ${
                  isDone
                    ? 'bg-primary text-white'
                    : isCurrent
                    ? 'bg-primary text-white'
                    : 'bg-white text-muted border'
                }`}
                style={{
                  width: '24px',
                  height: '24px',
                  fontSize: '0.65rem',
                  border: isCurrent ? '2px solid #2155B5' : isDone ? 'none' : '2px solid #cbd5e1',
                  boxShadow: isCurrent ? '0 0 0 3px rgba(33,85,181,0.25)' : 'none'
                }}
              >
                {isDone ? '✓' : idx + 1}
              </div>
              <span
                className={`mt-1.5 text-center ${
                  isCurrent
                    ? 'fw-bold text-pcc-blue'
                    : isDone
                    ? 'fw-semibold text-dark'
                    : 'text-muted'
                }`}
                style={{ fontSize: '0.67rem', lineHeight: 1.15, maxWidth: '68px' }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReceptionistOrdersContent() {
  const searchParams = useSearchParams();
  const highlightOrderID = searchParams ? searchParams.get('highlightOrderID') : null;

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [cookedMeals, setCookedMeals] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Category and View State
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'meals' | 'products_amenities' | 'history'
  const [searchTerm, setSearchTerm] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'immediate' | 'scheduled' | 'pending'

  // Order Tray (Cart) State
  const [selectedGuestID, setSelectedGuestID] = useState('');
  const [cart, setCart] = useState([]); // Array of { itemID, type, name, price, quantity, isCookedMeal, image, deliveryType }
  const [deliveryDate, setDeliveryDate] = useState(getTomorrowManila());
  const [deliveryTime, setDeliveryTime] = useState('07:30 AM');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Modals
  const [viewingOrder, setViewingOrder] = useState(null);

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

    // Real-time polling every 8 seconds
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

  // Handle URL highlight param (?highlightOrderID=...)
  useEffect(() => {
    if (highlightOrderID && orders.length > 0) {
      setActiveCategory('history');
      setTimeout(() => {
        const el = document.getElementById(`order-card-${highlightOrderID}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('order-highlight-pulse');
          setTimeout(() => el.classList.remove('order-highlight-pulse'), 4500);
        }
      }, 350);
    }
  }, [highlightOrderID, orders]);

  // Delivery Slots Evaluation (between 06:00 AM and 10:30 AM)
  const allowedSlots = ['06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM', '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM'];
  const todayManila = getTodayManila();
  const isSelectedDateToday = Boolean(deliveryDate) && (deliveryDate === todayManila);
  const currentMins = getNowManilaMinutes();

  const evaluatedSlots = allowedSlots.map(slot => {
    const [timePart, meridiem] = slot.split(' ');
    const [h, m] = timePart.split(':');
    let hr = parseInt(h, 10);
    if (meridiem === 'PM' && hr !== 12) hr += 12;
    if (meridiem === 'AM' && hr === 12) hr = 0;
    const slotMin = hr * 60 + parseInt(m, 10);
    const isPast = isSelectedDateToday && (slotMin <= currentMins);
    return { slot, isPast };
  });

  const allTodaySlotsPassed = isSelectedDateToday && evaluatedSlots.every(s => s.isPast);

  const hasScheduledItemsInCart = useMemo(() => cart.some(item => item.deliveryType === 'scheduled'), [cart]);

  const handleAddToCart = useCallback((item, type, isCookedMeal = false, chosenDeliveryType = null) => {
    const itemID = type === 'Product' ? item.productID : item.amenityID;
    const defaultDeliveryType = isCookedMeal ? 'scheduled' : (chosenDeliveryType || 'immediate');

    setCart(prev => {
      const existsIndex = prev.findIndex(c => c.itemID === itemID && c.type === type);
      if (existsIndex >= 0) {
        if (!isCookedMeal && item.quantity !== undefined && prev[existsIndex].quantity + 1 > item.quantity) {
          showAlert('warning', 'Inventory Limit', `Only ${item.quantity} units available in stock for ${item.name}.`);
          return prev;
        }
        const updated = [...prev];
        updated[existsIndex] = {
          ...updated[existsIndex],
          quantity: updated[existsIndex].quantity + 1,
          deliveryType: isCookedMeal ? 'scheduled' : (chosenDeliveryType || updated[existsIndex].deliveryType)
        };
        return updated;
      }
      return [
        ...prev,
        {
          itemID,
          type,
          name: item.name,
          price: parseFloat(item.price),
          quantity: 1,
          isCookedMeal,
          image: item.image,
          deliveryType: defaultDeliveryType
        }
      ];
    });
  }, []);

  const handleToggleItemDelivery = useCallback((index, newDeliveryType) => {
    setCart(prev => {
      const updated = [...prev];
      if (updated[index]) {
        if (updated[index].isCookedMeal) return prev;
        updated[index] = { ...updated[index], deliveryType: newDeliveryType };
      }
      return updated;
    });
  }, []);

  const handleUpdateQty = useCallback((index, newQty) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter((_, i) => i !== index));
      return;
    }
    setCart(prev => {
      const item = prev[index];
      if (!item) return prev;
      // Check stock limit for products/amenities
      if (!item.isCookedMeal) {
        const sourceItem = item.type === 'Product' 
          ? products.find(p => p.productID === item.itemID)
          : amenities.find(a => a.amenityID === item.itemID);
        if (sourceItem && sourceItem.quantity !== undefined && newQty > sourceItem.quantity) {
          showAlert('warning', 'Inventory Limit', `Only ${sourceItem.quantity} units available in stock for ${item.name}.`);
          return prev;
        }
      }
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: newQty };
      return updated;
    });
  }, [products, amenities]);

  const handleRemoveFromCart = useCallback((index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  }, []);

  const selectedBooking = useMemo(() => {
    return activeBookings.find(b => String(b.guestID) === String(selectedGuestID));
  }, [activeBookings, selectedGuestID]);

  const complimentaryBreakfastAvailable = useMemo(() => {
    if (!selectedBooking) return 0;
    const opt = (selectedBooking.breakfastOption || '').toLowerCase();
    const hasBreakfast = (opt.includes('with') && !opt.includes('without')) || selectedBooking.breakfastID === 2;
    if (!hasBreakfast) return 0;
    const used = parseInt(selectedBooking.complimentaryBreakfastUsed || 0);
    return Math.max(0, 2 - used);
  }, [selectedBooking]);

  const { cartSubtotal, complimentaryDeduction, cartTotal } = useMemo(() => {
    let subtotal = 0;
    let cookedCount = 0;
    let compDeduction = 0;

    for (const item of cart) {
      const itemPrice = parseFloat(item.price || 0);
      const itemQty = parseInt(item.quantity || 0);
      subtotal += itemPrice * itemQty;

      if (item.isCookedMeal && complimentaryBreakfastAvailable > 0) {
        const canComp = Math.max(0, complimentaryBreakfastAvailable - cookedCount);
        const freeInItem = Math.min(itemQty, canComp);
        compDeduction += freeInItem * itemPrice;
        cookedCount += freeInItem;
      }
    }

    return {
      cartSubtotal: subtotal,
      complimentaryDeduction: compDeduction,
      cartTotal: Math.max(0, subtotal - compDeduction)
    };
  }, [cart, complimentaryBreakfastAvailable]);

  const handleSubmitOrder = async (e) => {
    if (e) e.preventDefault();
    if (!selectedGuestID) {
      showAlert('warning', 'Guest Selection Required', 'Please select a room / guest to place this order.');
      return;
    }
    if (cart.length === 0) {
      showAlert('warning', 'Order Tray Empty', 'Your order tray is currently empty. Please add items to order.');
      return;
    }

    if (hasScheduledItemsInCart && allTodaySlotsPassed && isSelectedDateToday) {
      showAlert('warning', 'Delivery Time Passed', 'All breakfast delivery times have passed for today. Please select tomorrow or a future date.');
      return;
    }

    showConfirm('Confirm Guest Order', `Place order (₱${cartTotal.toFixed(2)}) for Room ${selectedBooking?.roomNumber || 'Selected Room'}?`, async () => {
      setSubmittingOrder(true);
      try {
        const targetDate = deliveryDate || getTomorrowManila();
        const res = await fetch('/api/receptionist/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            guestID: selectedGuestID,
            bookingID: selectedBooking?.bookingID,
            items: cart.map(item => ({
              itemID: item.itemID,
              type: item.type,
              quantity: item.quantity,
              name: item.name,
              isCookedMeal: item.isCookedMeal,
              deliveryType: item.deliveryType || (item.isCookedMeal ? 'scheduled' : 'immediate')
            })),
            deliveryDate: hasScheduledItemsInCart ? targetDate : null,
            deliveryTime: hasScheduledItemsInCart ? deliveryTime : null
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to place order');

        showAlert('success', 'Order Placed', 'Order placed successfully and recorded on the stay billing.');
        setCart([]);
        setDeliveryDate(getTomorrowManila());
        fetchData();
        setActiveCategory('history');
      } catch (err) {
        showAlert('error', 'Error', err.message);
      } finally {
        setSubmittingOrder(false);
      }
    });
  };

  const handleUpdateOrderStatus = (orderID, status) => {
    showConfirm('Update Order Status', `Mark order #${orderID} as ${status}?`, async () => {
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
        if (!res.ok) throw new Error(data.error || 'Failed to update order status');

        showAlert('success', 'Status Updated', `Order #${orderID} updated to ${status}.`);
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const filteredMeals = useMemo(() => {
    return cookedMeals.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [cookedMeals, searchTerm]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [products, searchTerm]);

  const filteredAmenities = useMemo(() => {
    return amenities.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [amenities, searchTerm]);

  const immediateOrders = useMemo(() => {
    return orders.filter(o => o.deliveryType === 'immediate' || (!o.deliveryType && !o.deliveryTime));
  }, [orders]);

  const scheduledOrders = useMemo(() => {
    return orders.filter(o => o.deliveryType === 'scheduled' || Boolean(o.deliveryTime));
  }, [orders]);

  const pendingDeliveryOrders = useMemo(() => {
    return orders.filter(o => o.orderStatus === 'Pending Delivery' || o.orderStatus === 'Pending');
  }, [orders]);

  const filteredHistoryOrders = useMemo(() => {
    if (historyFilter === 'immediate') return immediateOrders;
    if (historyFilter === 'scheduled') return scheduledOrders;
    if (historyFilter === 'pending') return pendingDeliveryOrders;
    return orders;
  }, [orders, historyFilter, immediateOrders, scheduledOrders, pendingDeliveryOrders]);

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('pending delivery')) return 'bg-warning-subtle text-warning-emphasis border border-warning';
    if (s.includes('cancel')) return 'bg-danger text-white';
    if (s.includes('complete') || s === 'delivered') return 'bg-success text-white';
    if (s.includes('out for delivery') || s === 'served') return 'bg-primary text-white';
    if (s.includes('prepar')) return 'bg-info text-dark';
    if (s.includes('schedul')) return 'bg-secondary text-white';
    return 'bg-warning text-dark';
  };

  const renderOrderTrayContent = () => {
    return (
      <div>
        {/* ROOM / GUEST SELECTOR */}
        <div className="mb-3">
          <label className="form-label fw-bold text-dark small mb-1">
            <i className="bi bi-door-closed text-primary me-1"></i>Select Room / Guest *
          </label>
          <SearchableSelect
            options={activeBookings.map(b => {
              const isCheckedIn = (b.bookingStatus === 'Checked In' || b.bookingStatus === 'Active Stay');
              return {
                value: String(b.guestID),
                label: `Room ${b.roomNumber} — ${b.lastName}, ${b.firstName} (${isCheckedIn ? 'Checked In' : 'Pending Check-in'})`
              };
            })}
            value={selectedGuestID}
            onChange={(val) => setSelectedGuestID(val)}
            placeholder="Type to search guest or room..."
          />
          {selectedBooking && !['Checked In', 'Active Stay'].includes(selectedBooking.bookingStatus) && (
            <div className="alert alert-warning py-1.5 px-2.5 mt-2 mb-0 small d-flex align-items-center gap-1.5" style={{ fontSize: '0.75rem' }}>
              <i className="bi bi-info-circle-fill text-warning-emphasis flex-shrink-0"></i>
              <span><strong>Guest not yet checked in:</strong> Order will be recorded as <strong>Pending Delivery</strong> and will automatically activate once checked in.</span>
            </div>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="text-center py-4 text-muted bg-light rounded-3 border">
            <i className="bi bi-cart-x fs-1 d-block mb-1 text-secondary opacity-50"></i>
            <small className="d-block fw-semibold">Order tray is currently empty.</small>
            <small className="text-muted" style={{ fontSize: '0.72rem' }}>Click "Add to Order Tray" on any item from the catalog.</small>
          </div>
        ) : (
          <div>
            {/* ITEMS LIST */}
            <div className="d-flex flex-column gap-2 mb-3" style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {cart.map((item, idx) => (
                <div key={idx} className="p-2.5 bg-light rounded-2 border d-flex flex-column gap-2" style={{ fontSize: '0.84rem' }}>
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-2">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="rounded border flex-shrink-0"
                          style={{ width: '36px', height: '36px', objectFit: 'cover' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fb = e.currentTarget.parentElement?.querySelector('.image-fallback-sm');
                            if (fb) fb.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="image-fallback-sm rounded border bg-light text-muted flex-column align-items-center justify-content-center text-center p-0.5 flex-shrink-0" style={{ width: '36px', height: '36px', fontSize: '0.52rem', lineHeight: 1.1, display: item.image ? 'none' : 'flex' }}>
                        <i className="bi bi-image" style={{ fontSize: '0.65rem' }}></i>
                        No Image
                      </div>
                      <div>
                        <div className="fw-bold text-dark">{item.name}</div>
                        <div className="text-muted small">
                          ₱{item.price.toFixed(2)} each {item.isCookedMeal && <span className="badge bg-warning-subtle text-dark ms-1" style={{ fontSize: '0.65rem' }}>Meal</span>}
                          {item.isCookedMeal && (
                            <div className="text-success fw-semibold" style={{ fontSize: '0.68rem' }}>
                              * Up to 2 pax free if room package includes breakfast
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div className="input-group input-group-sm" style={{ width: '90px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary text-white px-2"
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
                          className="btn btn-secondary text-white px-2"
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

                  {/* PER-ITEM DELIVERY TIMING SELECTOR */}
                  {item.isCookedMeal ? (
                    <div className="d-flex align-items-center justify-content-between pt-1.5 border-top" style={{ fontSize: '0.74rem' }}>
                      <span className="text-muted fw-semibold">Delivery Window:</span>
                      <span className="badge bg-warning-subtle text-dark border border-warning-subtle py-1 px-2 fw-semibold" style={{ fontSize: '0.70rem' }}>
                        <i className="bi bi-clock-history me-1 text-warning-emphasis"></i>Scheduled Breakfast (6:00–10:30 AM)
                      </span>
                    </div>
                  ) : (
                    <div className="d-flex align-items-center justify-content-between pt-1.5 border-top flex-wrap gap-1" style={{ fontSize: '0.74rem' }}>
                      <div className="form-check form-check-inline mb-0" style={{ fontSize: '0.73rem' }}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`tray-bundle-${idx}`}
                          checked={item.deliveryType === 'scheduled'}
                          onChange={(e) => handleToggleItemDelivery(idx, e.target.checked ? 'scheduled' : 'immediate')}
                        />
                        <label className="form-check-label text-muted user-select-none fw-semibold" htmlFor={`tray-bundle-${idx}`}>
                          Deliver with breakfast (6:00–10:30 AM)
                        </label>
                      </div>
                      <span className={`badge ${item.deliveryType === 'scheduled' ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-success-subtle text-success border border-success-subtle'} py-0.5 px-2`} style={{ fontSize: '0.68rem' }}>
                        {item.deliveryType === 'scheduled' ? '⏰ With Breakfast' : '⚡ Immediate'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* SCHEDULED BREAKFAST DELIVERY TIME PICKER */}
            {hasScheduledItemsInCart ? (
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
                    min={todayManila}
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    required
                  />
                  <small className="text-muted" style={{ fontSize: '0.70rem' }}>
                    Schedule delivery for today or advance orders for tomorrow.
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
                </div>

                {allTodaySlotsPassed && isSelectedDateToday && (
                  <div className="alert alert-warning py-1.5 px-2 mt-2 mb-0 d-flex align-items-center gap-1 text-dark" style={{ fontSize: '0.74rem' }}>
                    <i className="bi bi-exclamation-circle-fill text-warning"></i>
                    <span>Today&apos;s breakfast slots have passed. Please select tomorrow for advance breakfast delivery.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2.5 bg-success-subtle border border-success-subtle rounded-3 mb-3 d-flex align-items-center gap-2 text-success small">
                <i className="bi bi-lightning-charge-fill fs-5 text-success"></i>
                <div>
                  <div className="fw-bold">Immediate Room Delivery</div>
                  <div className="text-muted" style={{ fontSize: '0.72rem' }}>All items in tray will be prepared and dispatched immediately.</div>
                </div>
              </div>
            )}

            {/* TOTAL SUMMARY */}
            <div className="p-3 bg-light rounded-2 border mb-3">
              <div className="d-flex justify-content-between mb-1 small text-muted">
                <span>Subtotal:</span>
                <span>₱{cartSubtotal.toFixed(2)}</span>
              </div>
              {complimentaryDeduction > 0 && (
                <div className="d-flex justify-content-between mb-1 small text-success">
                  <span>
                    <i className="bi bi-gift-fill me-1"></i>Complimentary Breakfast:
                  </span>
                  <span className="fw-bold">-₱{complimentaryDeduction.toFixed(2)}</span>
                </div>
              )}
              <div className="d-flex justify-content-between mb-1 small text-muted">
                <span>Delivery / Service Fee:</span>
                <span className="text-success fw-bold">FREE</span>
              </div>
              <div className="d-flex justify-content-between pt-2 border-top fw-bold text-dark">
                <span>Total Charge to Room:</span>
                <span className="text-primary fs-5">₱{cartTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="button"
              className="btn btn-primary w-100 py-2.5 fw-bold shadow-sm"
              style={{ backgroundColor: 'var(--pcc-blue, #2155B5)', borderColor: 'var(--pcc-blue, #2155B5)', borderRadius: '8px' }}
              disabled={submittingOrder || cart.length === 0 || !selectedGuestID || (hasScheduledItemsInCart && allTodaySlotsPassed && isSelectedDateToday)}
              onClick={handleSubmitOrder}
            >
              {submittingOrder ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  <span>Placing Room Order...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-send-fill me-1.5"></i>
                  <span>Submit Room Order (₱{cartTotal.toFixed(2)})</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container-fluid py-3 px-3 px-md-4">
      {/* TOP HEADER */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2 border-bottom pb-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge text-white px-2.5 py-1 fw-bold" style={{ backgroundColor: 'var(--pcc-blue, #2155B5)' }}>
              Receptionist Portal
            </span>
            <span className="badge bg-success text-white px-2 py-1">Room Orders &amp; Store</span>
          </div>
          <h2 className="fw-bold mb-0 text-pcc-blue" style={{ color: 'var(--pcc-blue, #2155B5)' }}>
            Room Orders Workspace
          </h2>
          <p className="text-muted small mb-0">
            Record guest orders, schedule breakfast meals, dispatch store items, and manage real-time delivery tracking.
          </p>
        </div>
      </div>

      {/* NAVIGATION TABS & SEARCH BAR */}
      <div className="row g-3 align-items-center mb-4">
        <div className="col-md-8">
          <div className="btn-group flex-wrap shadow-xs" role="group">
            <button
              type="button"
              className={`btn btn-sm px-3 fw-semibold ${activeCategory === 'meals' ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
              onClick={() => setActiveCategory('meals')}
            >
              🍳 Cooked Meals ({cookedMeals.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm px-3 fw-semibold ${activeCategory === 'products_amenities' ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
              onClick={() => setActiveCategory('products_amenities')}
            >
              🛍️ Products &amp; Amenities ({products.length + amenities.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm px-3 fw-semibold ${activeCategory === 'all' ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
              onClick={() => setActiveCategory('all')}
            >
              All Catalog Items
            </button>
            <button
              type="button"
              className={`btn btn-sm px-3 fw-semibold ${activeCategory === 'history' ? 'btn-dark text-white' : 'btn-outline-secondary'}`}
              onClick={() => setActiveCategory('history')}
            >
              📋 Order Records &amp; Status ({orders.length})
            </button>
          </div>
        </div>
        <div className="col-md-4">
          <div className="input-group input-group-sm">
            <span className="input-group-text bg-white border-end-0"><i className="bi bi-search"></i></span>
            <input
              type="text"
              className="form-control border-start-0"
              placeholder="Search catalog items by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="row g-4">
        {/* CATALOG COLUMN (or HISTORY VIEW) */}
        <div className={activeCategory === 'history' ? 'col-12' : 'col-12 col-lg-7 col-xl-8'}>
          {activeCategory === 'history' ? (
            /* ORDER HISTORY / MANAGEMENT TABLE */
            <div className="card border-0 shadow-sm rounded-3 bg-white p-4">
              <div className="border-bottom pb-3 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div>
                  <h5 className="fw-bold text-dark mb-0 d-flex align-items-center">
                    <i className="bi bi-clock-history me-2 text-primary"></i>All Guest Orders
                  </h5>
                  <span className="text-muted small">Real-time status tracking for immediate dispatches and scheduled meals.</span>
                </div>
                <div className="btn-group btn-group-sm flex-wrap" role="group">
                  <button
                    type="button"
                    className={`btn btn-sm ${historyFilter === 'all' ? 'btn-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setHistoryFilter('all')}
                  >
                    All Orders ({orders.length})
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${historyFilter === 'immediate' ? 'btn-success text-white fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setHistoryFilter('immediate')}
                  >
                    ⚡ Immediate ({immediateOrders.length})
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${historyFilter === 'scheduled' ? 'btn-info text-white fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setHistoryFilter('scheduled')}
                  >
                    ⏰ Scheduled Breakfast ({scheduledOrders.length})
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${historyFilter === 'pending' ? 'btn-warning text-dark fw-bold' : 'btn-outline-secondary'}`}
                    onClick={() => setHistoryFilter('pending')}
                  >
                    ⏳ Pending Delivery ({pendingDeliveryOrders.length})
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading orders...</span>
                  </div>
                </div>
              ) : filteredHistoryOrders.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-inbox fs-1 d-block mb-2 opacity-50"></i>
                  No order records found under this filter.
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {filteredHistoryOrders.map(o => {
                    const isScheduled = o.deliveryType === 'scheduled' || Boolean(o.deliveryTime);
                    const items = o.items || [];
                    const orderSubtotal = items.reduce((sum, it) => sum + (parseFloat(it.price || it.unitPrice || 0) * it.quantity), 0);
                    const orderComplimentaryDeduction = items.reduce((sum, it) => {
                      const isComp = it.isComplimentary === 1 || it.isComplimentary === true || String(it.isComplimentary) === '1';
                      if (isComp) {
                        return sum + (parseFloat(it.price || it.unitPrice || 0) * it.quantity);
                      }
                      return sum;
                    }, 0);
                    const orderNetTotal = Math.max(0, orderSubtotal - orderComplimentaryDeduction);

                    return (
                      <div key={o.orderID} id={`order-card-${o.orderID}`} className="card order-card border shadow-xs rounded-3 overflow-hidden">
                        <div className="card-header bg-white py-2.5 px-3 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-2">
                          <div className="d-flex align-items-center gap-2">
                            <span className="fw-bold text-dark" style={{ fontSize: '0.92rem' }}>Order #{o.orderID}</span>
                            <span className="text-muted small">
                              • Room <strong>{o.roomNumber || 'N/A'}</strong> ({o.firstName} {o.lastName})
                            </span>
                            <span className="text-muted small">
                              • {new Date(o.orderDateTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            {o.orderStatus === 'Pending Delivery' ? (
                              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1" style={{ fontSize: '0.74rem' }}>
                                <i className="bi bi-hourglass-split me-1"></i>Pending Delivery (Awaiting Check-in)
                              </span>
                            ) : isScheduled ? (
                              <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style={{ fontSize: '0.74rem' }}>
                                <i className="bi bi-clock-history me-1"></i>{o.deliveryDate ? `${o.deliveryDate} ` : ''}{o.deliveryTime || 'Breakfast'}
                              </span>
                            ) : (
                              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1" style={{ fontSize: '0.74rem' }}>
                                <i className="bi bi-lightning-charge me-1"></i>Immediate Delivery
                              </span>
                            )}
                            <span className={`badge ${getStatusBadge(o.orderStatus)} px-2.5 py-1 rounded-pill`} style={{ fontSize: '0.75rem' }}>
                              {o.orderStatus}
                            </span>
                          </div>
                        </div>

                        <div className="card-body p-3">
                          <div className="mb-3 p-2.5 bg-light rounded-3 border">
                            <DeliveryTimeline deliveryType={isScheduled ? 'scheduled' : 'immediate'} currentStatus={o.orderStatus} />
                          </div>

                          <div className="table-responsive">
                            <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.82rem' }}>
                              <thead className="table-light">
                                <tr>
                                  <th>Item</th>
                                  <th className="text-center">Delivery Mode</th>
                                  <th className="text-center">Status</th>
                                  <th className="text-end">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((it, idx) => {
                                  const itDelType = it.deliveryType || (isScheduled ? 'scheduled' : 'immediate');
                                  const itStatus = it.itemStatus || o.orderStatus;
                                  const isComp = it.isComplimentary === 1 || it.isComplimentary === true || String(it.isComplimentary) === '1';
                                  const unitRate = parseFloat(it.price || it.unitPrice || 0);
                                  const lineSubtotal = unitRate * it.quantity;

                                  return (
                                    <tr key={idx}>
                                      <td>
                                        <div className="d-flex align-items-center flex-wrap gap-1">
                                          <span className="fw-semibold text-dark">{it.quantity}x {it.name}</span>
                                          {isComp && (
                                            <span className="badge bg-success-subtle text-success border border-success-subtle py-0.5 px-1.5" style={{ fontSize: '0.67rem' }}>
                                              <i className="bi bi-gift-fill me-1"></i>Free Breakfast
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                                          {isComp ? (
                                            <span>
                                              <s>₱{unitRate.toFixed(2)} each</s> <strong className="text-success ms-1">₱0.00 (Included in Stay)</strong>
                                            </span>
                                          ) : (
                                            `₱${unitRate.toFixed(2)} each`
                                          )}
                                        </div>
                                      </td>
                                      <td className="text-center">
                                        <span className="badge bg-light text-muted border px-2 py-0.5" style={{ fontSize: '0.68rem' }}>
                                          {itDelType === 'scheduled' ? '⏰ With Breakfast' : '⚡ Deliver Now'}
                                        </span>
                                      </td>
                                      <td className="text-center">
                                        <span className={`badge ${getStatusBadge(itStatus)} px-2 py-0.5 rounded-pill`} style={{ fontSize: '0.70rem' }}>
                                          {itStatus}
                                        </span>
                                      </td>
                                      <td className="text-end">
                                        {isComp ? (
                                          <div>
                                            <s className="text-muted small">₱{lineSubtotal.toFixed(2)}</s>
                                            <div className="fw-bold text-success">₱0.00</div>
                                          </div>
                                        ) : (
                                          <span className="fw-bold text-dark">₱{lineSubtotal.toFixed(2)}</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="card-footer bg-light py-2 px-3 border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
                          <div className="d-flex align-items-center gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary fw-semibold d-flex align-items-center gap-1.5 shadow-xs px-2.5 py-1"
                              style={{ fontSize: '0.78rem', borderRadius: '6px' }}
                              onClick={() => setViewingOrder(o)}
                            >
                              <i className="bi bi-eye"></i>
                              <span>View Order Details</span>
                            </button>

                            {['Preparing', 'Scheduled', 'Placed', 'Pending', 'Pending Delivery', 'Out for Delivery'].includes(o.orderStatus) && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-success text-white fw-semibold d-flex align-items-center gap-1.5 shadow-xs px-2.5 py-1"
                                  style={{ fontSize: '0.78rem', borderRadius: '6px' }}
                                  onClick={() => handleUpdateOrderStatus(o.orderID, 'Delivered')}
                                  title="Confirm delivery to room"
                                >
                                  <i className="bi bi-check2-circle"></i>
                                  <span>Confirm Delivered</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger fw-semibold d-flex align-items-center gap-1 shadow-xs px-2.5 py-1"
                                  style={{ fontSize: '0.78rem', borderRadius: '6px' }}
                                  onClick={() => handleUpdateOrderStatus(o.orderID, 'Canceled')}
                                >
                                  <i className="bi bi-x-lg"></i>
                                  <span>Cancel</span>
                                </button>
                              </>
                            )}
                          </div>
                          <div className="text-end">
                            {orderComplimentaryDeduction > 0 ? (
                              <div className="d-flex flex-column align-items-end" style={{ fontSize: '0.80rem' }}>
                                <div className="text-muted small">
                                  Items Subtotal: <span className="fw-semibold text-dark">₱{orderSubtotal.toFixed(2)}</span>
                                </div>
                                <div className="text-success fw-semibold small">
                                  <i className="bi bi-gift-fill me-1"></i>Free Breakfast: <span>-₱{orderComplimentaryDeduction.toFixed(2)}</span>
                                </div>
                                <div className="mt-0.5">
                                  <span className="text-muted small me-1">Net Charged to Stay:</span>
                                  <strong className="text-primary fs-6">₱{orderNetTotal.toFixed(2)}</strong>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="text-muted small me-2">Order Total:</span>
                                <strong className="text-primary fs-6">₱{orderNetTotal.toFixed(2)}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* CATALOG SECTIONS */
            loading ? (
              <div className="row g-2 g-md-3">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <div key={n} className="col-6 col-md-6 col-xl-4">
                    <div className="card h-100 shadow-sm border rounded-3 p-3 bg-white text-center py-5">
                      <div className="spinner-border spinner-border-sm text-primary mx-auto mb-2" role="status"></div>
                      <span className="text-muted small">Loading catalog items...</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {/* COOKED MEALS SECTION */}
                {(activeCategory === 'all' || activeCategory === 'meals') && filteredMeals.length > 0 && (
                  <div className="card shadow-sm border border-secondary-subtle rounded-3 p-3 p-md-4 bg-white mb-2">
                    <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                      <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                        <span className="p-1.5 px-2.5 rounded bg-warning-subtle text-warning-emphasis small fw-bold d-flex align-items-center gap-1.5">
                          <i className="bi bi-egg-fried"></i> Breakfast
                        </span>
                        <span>Cooked Meals (Scheduled Delivery)</span>
                      </h5>
                      <small className="text-muted d-none d-sm-inline">Serving Window: 6:00 AM – 10:30 AM</small>
                    </div>
                    <div className="row g-2 g-md-3">
                      {filteredMeals.map(m => (
                        <div key={m.productID} className="col-6 col-sm-6 col-xl-4">
                          <CatalogItemCard
                            item={m}
                            type="Product"
                            isCookedMeal={true}
                            onAdd={handleAddToCart}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PRODUCTS SECTION */}
                {(activeCategory === 'all' || activeCategory === 'products_amenities') && filteredProducts.length > 0 && (
                  <div className="card shadow-sm border border-secondary-subtle rounded-3 p-3 p-md-4 bg-white mb-2">
                    <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                      <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                        <span className="p-1.5 px-2.5 rounded bg-info-subtle text-info-emphasis small fw-bold d-flex align-items-center gap-1.5">
                          <i className="bi bi-cup-straw"></i> Minibar &amp; Store
                        </span>
                        <span>Beverages &amp; Snacks (Immediate Delivery)</span>
                      </h5>
                      <small className="text-muted d-none d-sm-inline">Immediate room service</small>
                    </div>
                    <div className="row g-2 g-md-3">
                      {filteredProducts.map(p => (
                        <div key={p.productID} className="col-6 col-sm-6 col-xl-4">
                          <CatalogItemCard
                            item={p}
                            type="Product"
                            isCookedMeal={false}
                            onAdd={handleAddToCart}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AMENITIES SECTION */}
                {(activeCategory === 'all' || activeCategory === 'products_amenities') && filteredAmenities.length > 0 && (
                  <div className="card shadow-sm border border-secondary-subtle rounded-3 p-3 p-md-4 bg-white mb-2">
                    <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                      <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                        <span className="p-1.5 px-2.5 rounded bg-primary-subtle text-primary small fw-bold d-flex align-items-center gap-1.5">
                          <i className="bi bi-box2-heart"></i> Guest Service
                        </span>
                        <span>Hotel Amenities</span>
                      </h5>
                      <small className="text-muted d-none d-sm-inline">Towels, toiletries &amp; extra accessories</small>
                    </div>
                    <div className="row g-2 g-md-3">
                      {filteredAmenities.map(a => (
                        <div key={a.amenityID} className="col-6 col-sm-6 col-xl-4">
                          <CatalogItemCard
                            item={a}
                            type="Amenity"
                            isCookedMeal={false}
                            onAdd={handleAddToCart}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* ORDER TRAY COLUMN (Shown when in catalog mode) */}
        {activeCategory !== 'history' && (
          <div className="col-12 col-lg-5 col-xl-4">
            <div className="card border border-secondary-subtle shadow-sm rounded-3 bg-white p-3 p-md-4 sticky-top d-flex flex-column" style={{ top: '20px', maxHeight: 'calc(100vh - 40px)' }}>
              <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3 flex-shrink-0">
                <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-cart3 text-primary"></i>
                  <span>Order Tray</span>
                </h5>
                <span className="badge bg-primary rounded-pill text-white px-2.5 py-1">
                  {cart.reduce((s, it) => s + it.quantity, 0)} Items
                </span>
              </div>
              <div className="flex-grow-1 overflow-auto pe-1" style={{ minHeight: 0 }}>
                {renderOrderTrayContent()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VIEW ORDER DETAILS MODAL */}
      {viewingOrder && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '14px' }}>
              <div className="modal-header text-white" style={{ background: 'var(--pcc-blue, #2155B5)' }}>
                <h5 className="modal-title fw-bold">Order Details — #{viewingOrder.orderID}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setViewingOrder(null)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="p-3 bg-light rounded border mb-3">
                  <div className="row g-2">
                    <div className="col-sm-6">
                      <span className="text-muted small d-block">Order Number:</span>
                      <strong className="text-dark">#{viewingOrder.orderID}</strong>
                    </div>
                    <div className="col-sm-6">
                      <span className="text-muted small d-block">Guest &amp; Target Room:</span>
                      <strong className="text-pcc-blue">Room {viewingOrder.roomNumber || 'N/A'} — {viewingOrder.firstName} {viewingOrder.lastName}</strong>
                    </div>
                    <div className="col-sm-6">
                      <span className="text-muted small d-block">Order Placed Date &amp; Time:</span>
                      <span>{new Date(viewingOrder.orderDateTime || Date.now()).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                    <div className="col-sm-6">
                      <span className="text-muted small d-block">Delivery Type / Time:</span>
                      <strong className="text-primary">{viewingOrder.deliveryDate ? `${viewingOrder.deliveryDate} ` : ''}{viewingOrder.deliveryTime || 'Immediate'}</strong>
                    </div>
                    <div className="col-12 mt-2 pt-2 border-top d-flex align-items-center justify-content-between">
                      <span className="text-muted small">Current Order Status:</span>
                      <span className={`badge ${getStatusBadge(viewingOrder.orderStatus)} px-3 py-1.5 rounded-pill`}>
                        {viewingOrder.orderStatus}
                      </span>
                    </div>
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
                      {(() => {
                        const modalItems = viewingOrder.items || [];
                        return modalItems.map((it, i) => {
                          const isComp = it.isComplimentary === 1 || it.isComplimentary === true || String(it.isComplimentary) === '1';
                          const unitRate = parseFloat(it.price || it.unitPrice || 0);
                          const lineSubtotal = unitRate * it.quantity;

                          return (
                            <tr key={i}>
                              <td className="fw-semibold text-dark">
                                <div className="d-flex align-items-center gap-2">
                                  {it.image ? (
                                    <img
                                      src={it.image}
                                      alt={it.name}
                                      className="rounded border flex-shrink-0"
                                      style={{ width: '32px', height: '32px', objectFit: 'cover' }}
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const fb = e.currentTarget.parentElement?.querySelector('.image-fallback-sm');
                                        if (fb) fb.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className="image-fallback-sm rounded border bg-light text-muted flex-column align-items-center justify-content-center text-center p-0.5 flex-shrink-0" style={{ width: '32px', height: '32px', fontSize: '0.52rem', lineHeight: 1.1, display: it.image ? 'none' : 'flex' }}>
                                    <i className="bi bi-image" style={{ fontSize: '0.65rem' }}></i>
                                    No Image
                                  </div>
                                  <div>
                                    <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                      <span>{it.name}</span>
                                      {isComp && (
                                        <span className="badge bg-success-subtle text-success border border-success-subtle py-0.5 px-1.5" style={{ fontSize: '0.65rem' }}>
                                          <i className="bi bi-gift-fill me-1"></i>Free Breakfast
                                        </span>
                                      )}
                                    </div>
                                    {isComp && (
                                      <div className="text-success small" style={{ fontSize: '0.70rem' }}>
                                        Included with Room Package (Complimentary)
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="text-center">
                                <span className={`badge ${it.deliveryType === 'scheduled' ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-success-subtle text-success border border-success-subtle'} px-2 py-0.5`} style={{ fontSize: '0.70rem' }}>
                                  {it.deliveryType === 'scheduled' ? '⏰ With Breakfast' : '⚡ Immediate'}
                                </span>
                              </td>
                              <td className="text-center">{it.quantity}x</td>
                              <td className="text-end">
                                {isComp ? (
                                  <div>
                                    <s className="text-muted small">₱{unitRate.toFixed(2)}</s>
                                    <div className="text-success fw-bold">₱0.00</div>
                                  </div>
                                ) : (
                                  `₱${unitRate.toFixed(2)}`
                                )}
                              </td>
                              <td className="text-end fw-bold">
                                {isComp ? (
                                  <div>
                                    <s className="text-muted small">₱{lineSubtotal.toFixed(2)}</s>
                                    <div className="text-success">₱0.00</div>
                                  </div>
                                ) : (
                                  `₱${lineSubtotal.toFixed(2)}`
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                {(() => {
                  const modalItems = viewingOrder.items || [];
                  const modalSubtotal = modalItems.reduce((sum, it) => sum + (parseFloat(it.price || it.unitPrice || 0) * it.quantity), 0);
                  const modalComplimentaryDeduction = modalItems.reduce((sum, it) => {
                    const isComp = it.isComplimentary === 1 || it.isComplimentary === true || String(it.isComplimentary) === '1';
                    if (isComp) {
                      return sum + (parseFloat(it.price || it.unitPrice || 0) * it.quantity);
                    }
                    return sum;
                  }, 0);
                  const modalNetTotal = Math.max(0, modalSubtotal - modalComplimentaryDeduction);

                  return (
                    <div className="p-3 bg-light rounded border d-flex flex-column gap-1.5">
                      <div className="d-flex justify-content-between align-items-center text-muted small">
                        <span>Items Subtotal:</span>
                        <span className="fw-semibold text-dark">₱{modalSubtotal.toFixed(2)}</span>
                      </div>
                      {modalComplimentaryDeduction > 0 && (
                        <div className="d-flex justify-content-between align-items-center text-success small fw-semibold">
                          <span><i className="bi bi-gift-fill me-1"></i>Complimentary Breakfast Deduction:</span>
                          <span>-₱{modalComplimentaryDeduction.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                        <span className="fw-bold text-dark fs-6">Net Charged to Stay / Room:</span>
                        <span className="fw-bold text-primary fs-5">₱{modalNetTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary text-white" onClick={() => setViewingOrder(null)}>
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

      <style jsx global>{`
        @keyframes orderHighlightPulse {
          0% { box-shadow: 0 0 0 0 rgba(33, 85, 181, 0.7); transform: scale(1); }
          50% { box-shadow: 0 0 0 10px rgba(33, 85, 181, 0.25); transform: scale(1.01); }
          100% { box-shadow: 0 0 0 0 rgba(33, 85, 181, 0); transform: scale(1); }
        }
        .order-highlight-pulse {
          animation: orderHighlightPulse 1.5s ease-in-out 3;
          border: 2px solid #2155B5 !important;
        }
      `}</style>
    </div>
  );
}

export default function ReceptionistOrders() {
  return (
    <Suspense fallback={
      <div className="p-4 text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <div className="text-muted mt-2 small">Loading Orders Workspace...</div>
      </div>
    }>
      <ReceptionistOrdersContent />
    </Suspense>
  );
}
