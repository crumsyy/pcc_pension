'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import LoadingButton from '@/app/components/LoadingButton';
import ViewOrdersModal from './ViewOrdersModal';

// Fast client-side module cache so switching tabs preserves catalog and renders at 0ms
let cachedOrdersCatalog = null;
let cachedOrderHistory = null;

const CatalogItemCard = React.memo(function CatalogItemCard({ item, type, isCookedMeal, onAdd }) {
  const isAvailable = isCookedMeal || (item.availableQty === undefined || item.availableQty > 0);
  const badgeLabel = isCookedMeal ? 'Cooked Meal (Scheduled)' : type === 'Amenity' ? 'Amenity (Immediate)' : 'Minibar / Store (Immediate)';
  const badgeClass = isCookedMeal ? 'bg-warning-subtle text-dark border-warning-subtle' : type === 'Amenity' ? 'bg-secondary-subtle text-dark border-secondary-subtle' : 'bg-info-subtle text-dark border-info-subtle';
  const descText = isCookedMeal 
    ? 'Freshly prepared breakfast meal served during 6:00 AM – 10:30 AM delivery window.'
    : type === 'Amenity'
    ? 'Extra guest room amenity delivered immediately by front desk staff.'
    : 'Snacks & beverages available for immediate delivery to your room.';

  return (
    <div 
      className="card h-100 shadow-sm border border-secondary-subtle rounded-3 bg-white overflow-hidden d-flex flex-column justify-content-between order-item-card"
      tabIndex="0"
    >
      <div>
        {item.image ? (
          <div className="catalog-img-wrap">
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
              <i className="bi bi-image fs-5 fs-sm-4 mb-1 opacity-50"></i>
              <span className="d-none d-sm-inline">Image Unavailable</span>
              <span className="d-sm-none" style={{ fontSize: '0.6rem' }}>No Image</span>
            </div>
          </div>
        ) : (
          <div className="image-fallback catalog-img-wrap d-flex flex-column align-items-center justify-content-center bg-light text-muted border-bottom" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
            <i className="bi bi-image fs-5 fs-sm-4 mb-1 opacity-50"></i>
            <span className="d-none d-sm-inline">Image Unavailable</span>
            <span className="d-sm-none" style={{ fontSize: '0.6rem' }}>No Image</span>
          </div>
        )}
        <div className="p-2 p-sm-3 pb-0 flex-grow-1 d-flex flex-column">
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-1 gap-1">
            <span className={`badge border small ${badgeClass} d-none d-sm-inline-block`} style={{ fontSize: '0.68rem' }}>{badgeLabel}</span>
            <span className={`badge border ${badgeClass} d-sm-none p-1`} style={{ fontSize: '0.58rem' }}>
              {isCookedMeal ? 'Scheduled Meal' : 'Immediate'}
            </span>
            <span className="fw-bold text-success" style={{ fontSize: '0.88rem' }}>₱{parseFloat(item.price).toFixed(2)}</span>
          </div>
          <h6 className="fw-bold text-dark mb-1 catalog-item-title" title={item.name}>{item.name}</h6>
          <p className="text-muted small mb-2 d-none d-sm-block" style={{ fontSize: '0.76rem', lineHeight: '1.3' }}>
            {descText}
          </p>
        </div>
      </div>
      <div className="p-2 p-sm-3 pt-1 pt-sm-0 mt-auto">
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
          style={{ backgroundColor: isAvailable ? 'var(--pcc-blue)' : undefined, borderColor: isAvailable ? 'var(--pcc-blue)' : undefined, borderRadius: '6px' }}
          disabled={!isAvailable}
          onClick={() => onAdd(item, type, isCookedMeal, isCookedMeal ? 'scheduled' : 'immediate')}
          aria-label={isAvailable ? `Add ${item.name} to Order Tray` : `${item.name} is Out of Stock`}
        >
          <i className="bi bi-cart-plus"></i>
          <span className="d-none d-sm-inline">{isAvailable ? 'Add to Order Tray' : 'Out of Stock'}</span>
          <span className="d-sm-none">{isAvailable ? 'Add' : 'Out'}</span>
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
        { key: 'Delivered', label: 'Delivered' }
      ]
    : [
        { key: 'Placed', label: 'Placed' },
        { key: 'Preparing', label: 'Preparing' },
        { key: 'Delivered', label: 'Delivered' }
      ];

  const getStepIndex = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('cancel')) return -1;
    if (isScheduled) {
      if (s.includes('complete') || s === 'delivered') return 3;
      if (s.includes('out for delivery') || s === 'served') return 2;
      if (s.includes('prepar')) return 2;
      if (s.includes('schedul')) return 1;
      return 0;
    } else {
      if (s.includes('complete') || s === 'delivered') return 2;
      if (s.includes('out for delivery') || s === 'served') return 1;
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

const OrderHistoryTable = React.memo(function OrderHistoryTable({ orders, loading, onBrowse, onViewOrder }) {
  const [historyFilter, setHistoryFilter] = useState('all');

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('pending delivery')) return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
    if (s.includes('cancel')) return 'bg-danger text-white';
    if (s.includes('complete') || s === 'delivered') return 'bg-success text-white';
    if (s === 'served') return 'bg-primary text-white';
    if (s.includes('prepar')) return 'bg-info text-dark';
    if (s.includes('schedul')) return 'bg-secondary text-white';
    return 'bg-warning text-dark';
  };

  const getItemStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('pending delivery')) return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
    if (s.includes('cancel')) return 'bg-danger-subtle text-danger border border-danger-subtle';
    if (s.includes('complete') || s === 'delivered') return 'bg-success-subtle text-success border border-success-subtle';
    if (s === 'served') return 'bg-primary-subtle text-primary border border-primary-subtle';
    if (s.includes('prepar')) return 'bg-info-subtle text-info-emphasis border border-info-subtle';
    if (s.includes('schedul')) return 'bg-secondary-subtle text-secondary border border-secondary-subtle';
    return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
  };

  const pendingDeliveryOrders = useMemo(() => {
    return (orders || []).filter(o => o.orderStatus === 'Pending Delivery');
  }, [orders]);

  const immediateOrders = useMemo(() => {
    return (orders || []).filter(o => o.orderStatus !== 'Pending Delivery' && (o.deliveryType === 'immediate' || (!o.deliveryType && !o.deliveryTime)));
  }, [orders]);

  const scheduledOrders = useMemo(() => {
    return (orders || []).filter(o => o.orderStatus !== 'Pending Delivery' && (o.deliveryType === 'scheduled' || Boolean(o.deliveryTime)));
  }, [orders]);

  const renderOrderCard = (o) => {
    const isScheduled = o.deliveryType === 'scheduled' || Boolean(o.deliveryTime);
    const isImmediate = !isScheduled;
    const delDateStr = o.deliveryDate ? String(o.deliveryDate).substring(0, 10) : '';
    const cutoffTime = delDateStr ? new Date(`${delDateStr}T05:00:00+08:00`) : null;
    const isCutoffPassed = cutoffTime ? new Date() >= cutoffTime : false;
    const isCanceled = (o.orderStatus || '').toLowerCase().includes('cancel');
    const isCompleted = ['delivered', 'completed', 'served'].includes((o.orderStatus || '').toLowerCase());
    const isPreparing = (o.orderStatus || '').toLowerCase().includes('prepar');

    const canModify = isScheduled && !isCutoffPassed && !isCanceled && !isCompleted && !isPreparing;

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
      <div key={o.orderID} id={`order-item-${o.orderID}`} className="card order-card border shadow-xs rounded-3 mb-3 overflow-hidden">
        <div className="card-header bg-white py-2.5 px-3 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center gap-2">
            <span className="fw-bold text-dark" style={{ fontSize: '0.92rem' }}>Order #{o.orderID}</span>
            <span className="text-muted small">
              {new Date(o.orderDateTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {canModify ? (
              <button
                type="button"
                className="btn btn-sm btn-primary text-white py-0.5 px-2 fw-semibold d-flex align-items-center gap-1 shadow-xs"
                style={{ fontSize: '0.74rem', borderRadius: '5px' }}
                onClick={() => onViewOrder && onViewOrder(o)}
              >
                <i className="bi bi-pencil-square"></i>
                <span>Modify Order</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-sm btn-secondary text-white py-0.5 px-2 fw-semibold d-flex align-items-center gap-1 shadow-xs"
                style={{ fontSize: '0.74rem', borderRadius: '5px' }}
                onClick={() => onViewOrder && onViewOrder(o)}
              >
                <i className="bi bi-eye"></i>
                <span>View Order</span>
              </button>
            )}

            {isImmediate ? (
              <span className="badge bg-secondary text-white px-2 py-1" style={{ fontSize: '0.74rem' }}>
                <i className="bi bi-lightning-charge me-1"></i>Immediate Fulfillment — Non-cancellable
              </span>
            ) : isCutoffPassed && !isCanceled && !isCompleted ? (
              <span className="badge bg-warning text-dark px-2 py-1" style={{ fontSize: '0.74rem' }}>
                <i className="bi bi-lock-fill me-1"></i>Locked for Preparation (Cutoff 5:00 AM passed)
              </span>
            ) : isScheduled ? (
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style={{ fontSize: '0.74rem' }}>
                <i className="bi bi-clock-history me-1"></i>{o.deliveryDate ? `${o.deliveryDate} ` : ''}{o.deliveryTime || 'Breakfast'}
              </span>
            ) : null}

            {o.orderStatus === 'Pending Delivery' && (
              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1" style={{ fontSize: '0.74rem' }}>
                <i className="bi bi-hourglass-split me-1"></i>Pending Delivery (Awaiting Check-in)
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
                  <th className="text-center">Item Status</th>
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
                              <s>₱{unitRate.toFixed(2)} each</s> <strong className="text-success ms-1">₱0.00 (Included)</strong>
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
                        <span className={`badge ${getItemStatusBadge(itStatus)} px-2 py-0.5 rounded-pill`} style={{ fontSize: '0.70rem' }}>
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
              className="btn btn-sm btn-primary text-white fw-semibold d-flex align-items-center gap-1.5 shadow-xs px-2.5 py-1"
              style={{ fontSize: '0.78rem', borderRadius: '6px' }}
              onClick={() => onViewOrder && onViewOrder(o)}
            >
              <i className={canModify ? "bi bi-pencil-square" : "bi bi-eye"}></i>
              <span>{canModify ? "View / Modify Order" : "View Order Details"}</span>
            </button>
            {canModify && delDateStr && (
              <span className="text-muted small d-none d-sm-inline" style={{ fontSize: '0.75rem' }}>
                &bull; Modifications allowed until 5:00 AM on {delDateStr}
              </span>
            )}
            <small className="text-muted d-none d-sm-inline">&bull; Charged to Stay Billing</small>
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
  };

  return (
    <div className="card border-0 shadow-sm rounded-3 bg-white p-4">
      <div className="border-bottom pb-3 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>
          <h5 className="fw-bold text-dark mb-0 d-flex align-items-center">
            <i className="bi bi-clock-history me-2 text-primary"></i>My Order History
          </h5>
          <span className="text-muted small">Real-time status tracking for immediate dispatches and scheduled meals.</span>
        </div>
        <div className="pcc-segmented-tab-track flex-wrap" role="tablist">
          <button
            type="button"
            className={`pcc-segmented-tab-btn ${historyFilter === 'all' ? 'active' : ''}`}
            onClick={() => setHistoryFilter('all')}
          >
            All Orders ({orders.length})
          </button>
          <button
            type="button"
            className={`pcc-segmented-tab-btn ${historyFilter === 'immediate' ? 'active' : ''}`}
            onClick={() => setHistoryFilter('immediate')}
          >
            Immediate Deliveries ({immediateOrders.length})
          </button>
          <button
            type="button"
            className={`pcc-segmented-tab-btn ${historyFilter === 'scheduled' ? 'active' : ''}`}
            onClick={() => setHistoryFilter('scheduled')}
          >
            Scheduled Breakfast Deliveries ({scheduledOrders.length})
          </button>
          {pendingDeliveryOrders.length > 0 && (
            <button
              type="button"
              className={`pcc-segmented-tab-btn ${historyFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setHistoryFilter('pending')}
            >
              Pending Deliveries ({pendingDeliveryOrders.length})
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-5 text-center">
          <div className="spinner-border text-pcc-blue mb-2" role="status"></div>
          <div className="text-muted small">Loading your orders...</div>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-receipt fs-1 d-block mb-2 text-secondary opacity-50"></i>
          <h6 className="fw-bold">No orders recorded yet</h6>
          <p className="small">Items you order during your stay will appear here with real-time preparation tracking.</p>
          <button className="btn btn-sm btn-primary text-white fw-semibold mt-1" onClick={onBrowse}>
            Browse Catalog
          </button>
        </div>
      ) : (
        <div>
          {/* IMMEDIATE DELIVERIES SECTION */}
          {(historyFilter === 'all' || historyFilter === 'immediate') && immediateOrders.length > 0 && (
            <div className="mb-4">
              <div className="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom">
                <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-1.5">
                  <span className="badge bg-success-subtle text-success border border-success-subtle p-1 px-2">
                    <i className="bi bi-lightning-charge-fill me-1"></i>Immediate Deliveries
                  </span>
                  <span className="text-muted small fw-normal">({immediateOrders.length})</span>
                </h6>
                <small className="text-muted">Dispatched right away</small>
              </div>
              {immediateOrders.map(renderOrderCard)}
            </div>
          )}

          {/* SCHEDULED DELIVERIES SECTION */}
          {(historyFilter === 'all' || historyFilter === 'scheduled') && scheduledOrders.length > 0 && (
            <div className="mb-3">
              <div className="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom">
                <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-1.5">
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle p-1 px-2">
                    <i className="bi bi-clock-history me-1"></i>Scheduled Deliveries
                  </span>
                  <span className="text-muted small fw-normal">({scheduledOrders.length})</span>
                </h6>
                <small className="text-muted">Breakfast advance orders</small>
              </div>
              {scheduledOrders.map(renderOrderCard)}
            </div>
          )}

          {historyFilter !== 'all' && (
            historyFilter === 'immediate' ? immediateOrders.length === 0 : scheduledOrders.length === 0
          ) && (
            <div className="text-center py-4 text-muted">
              <small>No {historyFilter} orders found.</small>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default function GuestOrdersContent({ guest, activeBookingStay, initialCategory = 'all', showAlert }) {
  const [products, setProducts] = useState(cachedOrdersCatalog?.products || []);
  const [cookedMeals, setCookedMeals] = useState(cachedOrdersCatalog?.cookedMeals || []);
  const [amenities, setAmenities] = useState(cachedOrdersCatalog?.amenities || []);
  const [orderHistory, setOrderHistory] = useState(cachedOrderHistory || []);
  const [activeBooking, setActiveBooking] = useState(null);
  const [loading, setLoading] = useState(!cachedOrdersCatalog);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(Boolean(cachedOrderHistory));
  const [submitting, setSubmitting] = useState(false);

  // Active Category Filter: 'all' | 'meals' | 'products' | 'amenities' | 'history'
  const [activeCategory, setActiveCategory] = useState(initialCategory || 'all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  // Cart / Order Tray State: array of { itemID, type, name, price, quantity, isCookedMeal }
  const [cart, setCart] = useState([]);
  const [showMobileOrderModal, setShowMobileOrderModal] = useState(false);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState(null);

  // Delivery Scheduling State for Cooked Meals
  const [todayStr, setTodayStr] = useState('');
  const [tomorrowStr, setTomorrowStr] = useState('');
  const [currentMins, setCurrentMins] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('07:30 AM');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [orderSuccessModal, setOrderSuccessModal] = useState({
    isOpen: false,
    orderID: null,
    totalAmount: 0,
    summary: ''
  });

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

  const fetchCatalog = async () => {
    if (!cachedOrdersCatalog) {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/guest/orders');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load guest orders');

      const p = data.products || [];
      const m = data.cookedMeals || [];
      const a = data.amenities || [];
      setProducts(p);
      setCookedMeals(m);
      setAmenities(a);
      if (data.activeBooking) {
        setActiveBooking(data.activeBooking);
      }
      if (data.orders) {
        setOrderHistory(data.orders);
        cachedOrderHistory = data.orders;
        setHistoryLoaded(true);
      }
      cachedOrdersCatalog = { products: p, cookedMeals: m, amenities: a };
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/guest/orders?history=true');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load order history');
      const ordersList = data.orders || [];
      setOrderHistory(ordersList);
      cachedOrderHistory = ordersList;
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('pcc_guest_orders_cache', JSON.stringify(ordersList));
        }
      } catch (e) {}
      setHistoryLoaded(true);
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message });
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Restore cached orders from localStorage if available
  useEffect(() => {
    if (!cachedOrderHistory && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('pcc_guest_orders_cache');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setOrderHistory(parsed);
            cachedOrderHistory = parsed;
          }
        }
      } catch (e) {}
    }
  }, []);

  // Persist orders and reload from database when guest navigates or guestID changes
  useEffect(() => {
    fetchCatalog();
    fetchOrderHistory();
  }, [guest?.guestID, fetchOrderHistory]);

  const handleSelectCategory = useCallback((cat) => {
    setActiveCategory(cat);
    if (cat === 'history') {
      fetchOrderHistory();
    }
  }, [fetchOrderHistory]);

  const hasScheduledItemsInCart = useMemo(() => cart.some(item => item.deliveryType === 'scheduled'), [cart]);

  const handleAddToCart = useCallback((item, type, isCookedMeal = false, chosenDeliveryType = null) => {
    const itemID = type === 'Product' ? item.productID : item.amenityID;
    const defaultDeliveryType = isCookedMeal ? 'scheduled' : (chosenDeliveryType || 'immediate');
    setCart(prev => {
      const existsIndex = prev.findIndex(c => c.itemID === itemID && c.type === type);
      if (existsIndex >= 0) {
        if (!isCookedMeal && item.availableQty && prev[existsIndex].quantity + 1 > item.availableQty) {
          setFeedback({ type: 'warning', message: `Only ${item.availableQty} units available in inventory for ${item.name}.` });
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
        // Cooked meals are strictly scheduled only
        if (updated[index].isCookedMeal || updated[index].type === 'CookedMeal') {
          return prev;
        }
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
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: newQty };
      return updated;
    });
  }, []);

  const handleRemoveFromCart = useCallback((index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  }, []);

  const effectiveBooking = activeBooking || activeBookingStay;

  const hasBreakfastPackage = useMemo(() => {
    if (!effectiveBooking) return false;
    const opt = (effectiveBooking.breakfastOption || effectiveBooking.resBreakfastOption || '').toLowerCase();
    return (opt.includes('with') && !opt.includes('without')) || parseInt(effectiveBooking.breakfastID) === 2 || Boolean(effectiveBooking.roomHasBreakfast);
  }, [effectiveBooking]);

  const selectedDateStr = deliveryDate || todayStr;

  const availableFreeForSelectedDate = useMemo(() => {
    if (!effectiveBooking || !hasBreakfastPackage) return 0;
    const targetDateUsed = effectiveBooking?.dailyUsedCompMap?.[selectedDateStr] || 0;
    const remainingDailyForSelectedDate = Math.max(0, 2 - targetDateUsed);
    const remainingStayAllowance = effectiveBooking?.remainingStayAllowance !== undefined
      ? parseInt(effectiveBooking.remainingStayAllowance, 10)
      : Math.max(0, (effectiveBooking?.stayComplimentaryAllowance || (2 * (effectiveBooking.nights || 1))) - (effectiveBooking?.complimentaryBreakfastUsed || 0));

    return Math.min(remainingStayAllowance, remainingDailyForSelectedDate);
  }, [effectiveBooking, hasBreakfastPackage, selectedDateStr]);

  const { cartSubtotal, complimentaryDeduction, cartTotal, complimentaryCount } = useMemo(() => {
    let subtotal = 0;
    let cookedCount = 0;
    let compDeduction = 0;
    let freeCount = 0;

    for (const item of cart) {
      const itemPrice = parseFloat(item.price || 0);
      const itemQty = parseInt(item.quantity || 0);
      subtotal += itemPrice * itemQty;

      if (item.isCookedMeal && availableFreeForSelectedDate > 0) {
        const canComp = Math.max(0, availableFreeForSelectedDate - cookedCount);
        const freeInItem = Math.min(itemQty, canComp);
        compDeduction += freeInItem * itemPrice;
        cookedCount += freeInItem;
        freeCount += freeInItem;
      }
    }

    return {
      cartSubtotal: subtotal,
      complimentaryDeduction: compDeduction,
      cartTotal: Math.max(0, subtotal - compDeduction),
      complimentaryCount: freeCount
    };
  }, [cart, availableFreeForSelectedDate]);

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
    const isPast = isSelectedDateToday && (slotMin <= currentMins);
    return { slot, isPast };
  });

  const allTodaySlotsPassed = isClientMounted && isSelectedDateToday && evaluatedSlots.every(s => s.isPast);

  const activeStayStatuses = [
    'Checked In',
    'Active Stay',
    'Confirmed',
    'Booked',
    'Checkout Requested',
    'Pending Room Verification',
    'Pending Checkout',
    'Room Verified',
    'Final Billing Updated',
    'Bill Finalized',
    'Late Checkout'
  ];
  const isCheckedIn = Boolean(
    effectiveBooking && activeStayStatuses.includes(effectiveBooking.bookingStatus || effectiveBooking.status)
  );

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!isCheckedIn) {
      setFeedback({ type: 'danger', message: 'Orders can only be placed once you have an active stay or booking.' });
      return;
    }
    if (cart.length === 0) {
      setFeedback({ type: 'warning', message: 'Your Order Tray is empty. Please add items to order.' });
      return;
    }

    if (hasScheduledItemsInCart) {
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

      const placedTotal = cartTotal;
      const placedOrderID = data.orderID || data.orderIDs?.[0] || 'Confirmed';

      setFeedback({
        type: 'success',
        message: 'Order placed successfully! Your items have been added to your stay billing.'
      });
      setCart([]);
      setShowMobileOrderModal(false);
      fetchOrderHistory();
      setActiveCategory('history');
      // Invalidate client cache to refresh quantities
      cachedOrdersCatalog = null;
      fetchCatalog();

      // Dispatch order updated event so billing breakdown cache is immediately refreshed
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('guest-order-updated', {
          detail: { bookingID: activeBookingStay?.bookingID }
        }));
      }

      // Show dialog box "Order Submitted"
      setOrderSuccessModal({
        isOpen: true,
        orderID: placedOrderID,
        totalAmount: placedTotal,
        summary: data.summary || 'Your room order has been placed and received.'
      });
      if (typeof showAlert === 'function') {
        showAlert('success', 'Order Submitted', 'Your order has been submitted successfully and recorded. Front Desk has been notified.');
      }
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message });
      if (typeof showAlert === 'function') {
        showAlert('error', 'Order Failed', err.message || 'Failed to submit room order.');
      }
    } finally {
      setSubmitting(false);
    }
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

  const renderOrderTrayContent = (isMobileModal = false) => {
    if (cart.length === 0) {
      return (
        <div className="text-center py-4 text-muted">
          <i className="bi bi-cart-x fs-1 d-block mb-1 text-secondary opacity-50"></i>
          <small className="d-block">Your order tray is currently empty.</small>
          <small className="text-muted" style={{ fontSize: '0.72rem' }}>Click "Add to Order Tray" on any item to build your room order.</small>
          {isMobileModal && (
            <button
              type="button"
              className="btn btn-primary btn-sm rounded-pill mt-3 px-4 fw-bold"
              style={{ backgroundColor: 'var(--pcc-blue)' }}
              onClick={() => setShowMobileOrderModal(false)}
            >
              Browse Menu
            </button>
          )}
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmitOrder}>
        {/* CHECK-IN RESTRICTION BANNER */}
        {!isCheckedIn && (
          <div className="alert alert-warning py-2.5 px-3 rounded-3 mb-3 d-flex align-items-center gap-2 border-warning shadow-xs" style={{ fontSize: '0.82rem' }}>
            <i className="bi bi-info-circle-fill text-warning-emphasis fs-6 flex-shrink-0"></i>
            <div>
              <strong>Ordering Restricted:</strong> Ordering is available once you have an active stay or booking.
            </div>
          </div>
        )}

        {/* ITEMS LIST */}
        <div className="d-flex flex-column gap-2 mb-3" style={{ maxHeight: isMobileModal ? '350px' : '280px', overflowY: 'auto' }}>
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

              {/* PER-ITEM DELIVERY TIMING SELECTOR / BUNDLING CHECKBOX */}
              {item.isCookedMeal || item.type === 'CookedMeal' ? (
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

        {/* COOKED MEAL / SCHEDULED DELIVERY TIME RESTRICTION & PICKER */}
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
                Items marked "With breakfast" will be prepared and delivered during this time window.
              </small>
            </div>

            {hasBreakfastPackage && (
              <div className="mt-2.5 pt-2 border-top">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="badge bg-success-subtle text-success border border-success-subtle py-1 px-2 fw-semibold" style={{ fontSize: '0.73rem' }}>
                    <i className="bi bi-gift-fill me-1"></i>Complimentary Breakfast: {availableFreeForSelectedDate} free meal{availableFreeForSelectedDate === 1 ? '' : 's'} left for {selectedDateStr}
                  </span>
                </div>
                {availableFreeForSelectedDate === 0 && (
                  <div className="alert alert-info py-1.5 px-2 mt-1 mb-0 text-dark small" style={{ fontSize: '0.73rem' }}>
                    <i className="bi bi-info-circle-fill text-primary me-1"></i>
                    Daily complimentary breakfast quota (2 meals/day) has been reached for {selectedDateStr}. Additional meals are charged at catalog price.
                  </div>
                )}
              </div>
            )}

            {allTodaySlotsPassed && isSelectedDateToday && (
              <div className="alert alert-warning py-1.5 px-2 mt-2 mb-0 d-flex align-items-center gap-1 text-dark" style={{ fontSize: '0.74rem' }}>
                <i className="bi bi-exclamation-circle-fill text-warning"></i>
                <span>Today&apos;s breakfast slots have passed. Please select tomorrow to schedule advance breakfast.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-2.5 bg-success-subtle border border-success-subtle rounded-3 mb-3 d-flex align-items-center gap-2 text-success small">
            <i className="bi bi-lightning-charge-fill fs-5 text-success"></i>
            <div>
              <div className="fw-bold">Immediate Room Delivery</div>
              <div className="text-muted" style={{ fontSize: '0.72rem' }}>All items in tray will be prepared and dispatched immediately to your room.</div>
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
                <i className="bi bi-gift-fill me-1"></i>Complimentary Breakfast ({complimentaryCount} Free Meal{complimentaryCount > 1 ? 's' : ''}):
              </span>
              <span className="fw-bold">-₱{complimentaryDeduction.toFixed(2)}</span>
            </div>
          )}
          <div className="d-flex justify-content-between mb-1 small text-muted">
            <span>Delivery / Room Service Fee:</span>
            <span className="text-success fw-bold">FREE</span>
          </div>
          <div className="d-flex justify-content-between pt-2 border-top fw-bold text-dark">
            <span>Total Charge to Room:</span>
            <span className="text-primary fs-5">₱{cartTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* SUBMIT BUTTON WITH OCCUPANCY CHECK */}
        {!isCheckedIn && (
          <div className="alert alert-info py-2 px-3 small mb-2 d-flex align-items-center gap-2" style={{ fontSize: '0.76rem' }}>
            <i className="bi bi-lock-fill text-primary flex-shrink-0"></i>
            <span>Ordering is available once you have an active stay or booking.</span>
          </div>
        )}
        <LoadingButton
          type="submit"
          isLoading={submitting}
          loadingText="Placing Room Order..."
          className={`btn w-100 py-2.5 fw-bold shadow-sm ${isCheckedIn ? 'btn-primary' : 'btn-secondary text-white'}`}
          style={{ backgroundColor: isCheckedIn ? 'var(--pcc-blue)' : undefined, borderColor: isCheckedIn ? 'var(--pcc-blue)' : undefined, borderRadius: '8px' }}
          disabled={!isCheckedIn || (hasScheduledItemsInCart && allTodaySlotsPassed && isSelectedDateToday)}
        >
          <i className={`bi ${isCheckedIn ? 'bi-send-fill' : 'bi-lock-fill'} me-1.5`}></i>
          <span>{isCheckedIn ? 'Submit Room Order' : 'Ordering Locked (Active Stay Required)'}</span>
        </LoadingButton>
      </form>
    );
  };

  return (
    <div className="animate__animated animate__fadeIn">
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
          <div className="pcc-segmented-tab-track flex-wrap" role="tablist">
            <button
              type="button"
              className={`pcc-segmented-tab-btn ${activeCategory === 'meals' ? 'active' : ''}`}
              onClick={() => handleSelectCategory('meals')}
            >
              Cooked Meals (Scheduled: 6:00–10:30 AM) ({cookedMeals.length})
            </button>
            <button
              type="button"
              className={`pcc-segmented-tab-btn ${activeCategory === 'products_amenities' ? 'active' : ''}`}
              onClick={() => handleSelectCategory('products_amenities')}
            >
              Products & Amenities (Immediate) ({products.length + amenities.length})
            </button>
            <button
              type="button"
              className={`pcc-segmented-tab-btn ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => handleSelectCategory('all')}
            >
              All Items
            </button>
            <button
              type="button"
              className={`pcc-segmented-tab-btn ${activeCategory === 'history' ? 'active' : ''}`}
              onClick={() => handleSelectCategory('history')}
            >
              My Orders ({orderHistory.length})
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
        <div className={`col-12 col-md-7 col-lg-7 col-xl-8 ${cart.length > 0 ? 'pb-5 mb-4' : ''}`}>
          {activeCategory === 'history' ? (
            <OrderHistoryTable
              orders={orderHistory}
              loading={loadingHistory}
              onBrowse={() => handleSelectCategory('all')}
              onViewOrder={(order) => setSelectedOrderForModal(order)}
            />
          ) : (
            /* CATALOG ITEMS GRID */
            loading ? (
              <div className="row g-2 g-md-3">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <div key={n} className="col-4 col-sm-6 col-xl-4">
                    <div className="card h-100 shadow-sm border border-secondary-subtle rounded-3 overflow-hidden bg-white">
                      <div className="pcc-skeleton-box catalog-img-wrap" style={{ width: '100%' }}></div>
                      <div className="p-2 p-sm-3">
                        <div className="pcc-skeleton-box mb-1.5" style={{ height: '14px', width: '50%' }}></div>
                        <div className="pcc-skeleton-box mb-2" style={{ height: '18px', width: '80%' }}></div>
                        <div className="pcc-skeleton-box" style={{ height: '28px', width: '100%', borderRadius: '6px' }}></div>
                      </div>
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
                      <small className="text-muted d-none d-sm-inline">Available slots: 6:00 AM – 10:30 AM</small>
                    </div>
                    <div className="row g-2 g-md-3">
                      {filteredMeals.map(m => (
                        <div key={m.productID} className="col-4 col-sm-6 col-xl-4">
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
                {(activeCategory === 'all' || activeCategory === 'products_amenities' || activeCategory === 'products') && filteredProducts.length > 0 && (
                  <div className="card shadow-sm border border-secondary-subtle rounded-3 p-3 p-md-4 bg-white mb-2">
                    <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                      <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                        <span className="p-1.5 px-2.5 rounded bg-info-subtle text-info-emphasis small fw-bold d-flex align-items-center gap-1.5">
                          <i className="bi bi-cup-straw"></i> Minibar &amp; Store
                        </span>
                        <span>Beverages &amp; Snacks (Immediate Delivery)</span>
                      </h5>
                      <small className="text-muted d-none d-sm-inline">Immediate delivery or bundle with breakfast</small>
                    </div>
                    <div className="row g-2 g-md-3">
                      {filteredProducts.map(p => (
                        <div key={p.productID} className="col-4 col-sm-6 col-xl-4">
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
                {(activeCategory === 'all' || activeCategory === 'products_amenities' || activeCategory === 'amenities') && filteredAmenities.length > 0 && (
                  <div className="card shadow-sm border border-secondary-subtle rounded-3 p-3 p-md-4 bg-white mb-2">
                    <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                      <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                        <span className="p-1.5 px-2.5 rounded bg-primary-subtle text-primary small fw-bold d-flex align-items-center gap-1.5">
                          <i className="bi bi-box2-heart"></i> Guest Service
                        </span>
                        <span>Hotel Amenities</span>
                      </h5>
                      <small className="text-muted d-none d-sm-inline">Towels, toiletries &amp; extra amenities</small>
                    </div>
                    <div className="row g-2 g-md-3">
                      {filteredAmenities.map(a => (
                        <div key={a.amenityID} className="col-4 col-sm-6 col-xl-4">
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

        {/* ORDER TRAY / CART COLUMN (DESKTOP) */}
        <div className="col-12 col-md-5 col-lg-5 col-xl-4 d-none d-md-block">
          <div className="card border border-secondary-subtle shadow-sm rounded-3 bg-white p-4 sticky-top pcc-order-tray d-flex flex-column" style={{ top: '20px', maxHeight: 'calc(100vh - 40px)' }}>
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
              {renderOrderTrayContent(false)}
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE FLOATING "VIEW YOUR ORDER" BAR (Foodpanda Style) */}
      {cart.length > 0 && (
        <div
          className="fixed-bottom d-md-none px-3 py-2 animate__animated animate__fadeInUp"
          style={{
            bottom: '70px',
            zIndex: 1035
          }}
        >
          <button
            type="button"
            onClick={() => setShowMobileOrderModal(true)}
            className="btn w-100 py-2.5 px-3 rounded-pill shadow-lg d-flex align-items-center justify-content-between text-white border-0"
            style={{
              backgroundColor: 'var(--pcc-blue)',
              boxShadow: '0 4px 18px rgba(33, 85, 181, 0.45)',
              transition: 'all 0.2s ease'
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <span
                className="rounded-circle bg-white text-pcc-blue fw-bold d-inline-flex align-items-center justify-content-center"
                style={{
                  width: '28px',
                  height: '28px',
                  fontSize: '0.85rem',
                  color: 'var(--pcc-blue, #2155B5)',
                  backgroundColor: '#ffffff'
                }}
              >
                {cart.reduce((s, it) => s + it.quantity, 0)}
              </span>
              <span className="fw-bold" style={{ fontSize: '0.95rem' }}>View your order</span>
            </div>
            <span className="fw-bold fs-6">₱{cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* MOBILE ORDER MODAL DRAWER (Foodpanda Cart View) */}
      {showMobileOrderModal && (
        <div
          className="modal d-block tab-modal-backdrop d-md-none animate__animated animate__fadeIn"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-scrollable modal-fullscreen-sm-down m-0" style={{ minHeight: '100%' }}>
            <div className="modal-content border-0 rounded-0" style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
              {/* Header */}
              <div
                className="modal-header text-white px-3 py-3 border-0 sticky-top"
                style={{ backgroundColor: 'var(--pcc-blue)' }}
              >
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-white p-0 me-1 text-decoration-none"
                    onClick={() => setShowMobileOrderModal(false)}
                    aria-label="Back to Menu"
                  >
                    <i className="bi bi-arrow-left fs-5"></i>
                  </button>
                  <div>
                    <h6 className="modal-title fw-bold mb-0" style={{ fontSize: '1rem' }}>Your Room Order</h6>
                    <small className="text-white-50" style={{ fontSize: '0.72rem' }}>PCC Home Suite • Koronadal</small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowMobileOrderModal(false)}
                  aria-label="Close"
                ></button>
              </div>

              {/* Body */}
              <div className="modal-body p-3">
                {renderOrderTrayContent(true)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW / MODIFY ORDER MODAL */}
      {selectedOrderForModal && (
        <ViewOrdersModal
          isOpen={Boolean(selectedOrderForModal)}
          order={selectedOrderForModal}
          onClose={() => setSelectedOrderForModal(null)}
          onOrderUpdated={async () => {
            await fetchOrderHistory();
            await fetchCatalog();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('guest-order-updated', {
                detail: { bookingID: activeBookingStay?.bookingID }
              }));
            }
          }}
        />
      )}
      {/* ORDER SUBMITTED SUCCESS DIALOG MODAL */}
      {orderSuccessModal.isOpen && (
        <div
          className="modal d-block animate__animated animate__fadeIn"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1080 }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '460px' }}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
              <div className="modal-header border-0 text-white p-3 px-4" style={{ backgroundColor: 'var(--pcc-blue, #2155B5)' }}>
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-check-circle-fill fs-5 text-warning"></i>
                  <h5 className="modal-title fw-bold mb-0" style={{ fontSize: '1.05rem' }}>Order Submitted</h5>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Close"
                  onClick={() => setOrderSuccessModal(prev => ({ ...prev, isOpen: false }))}
                ></button>
              </div>
              <div className="modal-body text-center p-4">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 shadow-xs"
                  style={{ width: '72px', height: '72px', backgroundColor: '#e8f5e9', color: '#2e7d32' }}
                >
                  <i className="bi bi-send-check-fill" style={{ fontSize: '2.2rem' }}></i>
                </div>
                <h4 className="fw-bold text-dark mb-1">Order Submitted</h4>
                <p className="text-muted small mb-3">
                  Your room order has been placed and recorded successfully. It has been sent to Front Desk &amp; Room Service and added to your stay billing.
                </p>

                <div className="p-3 bg-light rounded-3 border text-start mb-3" style={{ fontSize: '0.84rem' }}>
                  <div className="d-flex justify-content-between mb-1.5 pb-1 border-bottom">
                    <span className="text-muted">Order Tracking Ref:</span>
                    <strong className="text-primary font-monospace">#{orderSuccessModal.orderID}</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1.5 pb-1 border-bottom">
                    <span className="text-muted">Total Charged:</span>
                    <strong className="text-dark">₱{orderSuccessModal.totalAmount.toFixed(2)}</strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Status:</span>
                    <span className="badge bg-warning-subtle text-warning-emphasis border border-warning">
                      Recorded / In Queue
                    </span>
                  </div>
                </div>

                <div className="alert alert-info py-2 px-3 small text-start d-flex align-items-center gap-2 mb-0" style={{ fontSize: '0.76rem' }}>
                  <i className="bi bi-info-circle-fill text-primary flex-shrink-0 fs-6"></i>
                  <div>You can track real-time delivery and preparation status anytime under <strong>Order History</strong>.</div>
                </div>
              </div>
              <div className="modal-footer border-0 p-3 pt-0 d-flex justify-content-center">
                <button
                  type="button"
                  className="btn btn-primary px-4 py-2 fw-bold text-white shadow-sm"
                  style={{ backgroundColor: 'var(--pcc-blue, #2155B5)', borderRadius: '8px' }}
                  onClick={() => {
                    setOrderSuccessModal(prev => ({ ...prev, isOpen: false }));
                    setActiveCategory('history');
                    fetchOrderHistory();
                  }}
                >
                  <i className="bi bi-clock-history me-1.5"></i>
                  <span>View in Order History</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
