'use client';

import React, { useState, useEffect } from 'react';

const ALLOWED_BREAKFAST_SLOTS = [
  '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM',
  '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM',
  '10:00 AM', '10:30 AM'
];

export default function ViewOrdersModal({ isOpen, order, onClose, onOrderUpdated }) {
  const [itemsState, setItemsState] = useState([]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('07:30 AM');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [todayStr, setTodayStr] = useState('');
  const [currentMins, setCurrentMins] = useState(0);

  // Initialize Manila date/time constraints
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
      const parts = timeFmt.formatToParts(now);
      const p = {};
      parts.forEach(({ type, value }) => { p[type] = value; });
      const mins = parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10);

      setTodayStr(today);
      setCurrentMins(mins);
    } catch (e) {
      const d = new Date().toISOString().split('T')[0];
      setTodayStr(d);
    }
  }, []);

  // Initialize form state when order changes
  useEffect(() => {
    if (order) {
      const initialItems = (order.items || []).map(it => {
        const isCookedMeal = it.productCategoryID === 3 || it.isCookedMeal || it.type === 'CookedMeal';
        return {
          ...it,
          isCookedMeal,
          deliveryType: isCookedMeal ? 'scheduled' : (it.deliveryType || 'immediate')
        };
      });
      setItemsState(initialItems);

      const defaultDate = order.deliveryDate || todayStr;
      setDeliveryDate(defaultDate);
      setDeliveryTime(order.deliveryTime || '07:30 AM');
      setFeedback({ type: '', message: '' });
    }
  }, [order, todayStr]);

  if (!isOpen || !order) return null;

  const orderStatus = (order.orderStatus || '').trim();
  // An order can only be modified if it has not yet reached Preparing, Served, Completed, or Canceled
  const isLocked = ['preparing', 'served', 'completed', 'delivered', 'canceled', 'cancelled']
    .some(s => orderStatus.toLowerCase().includes(s));

  const hasScheduledItems = itemsState.some(it => it.deliveryType === 'scheduled');

  const handleToggleItem = (itemID, type, checked) => {
    if (isLocked) return;
    setItemsState(prev => prev.map(it => {
      if (it.itemID === itemID && it.type === type) {
        // Cooked meals are strictly scheduled only
        if (it.isCookedMeal) return it;
        return {
          ...it,
          deliveryType: checked ? 'scheduled' : 'immediate'
        };
      }
      return it;
    }));
  };

  const getStatusBadgeClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('pending delivery')) return 'bg-warning-subtle text-warning-emphasis border border-warning';
    if (s.includes('cancel')) return 'bg-danger text-white';
    if (s.includes('complete') || s === 'delivered') return 'bg-success text-white';
    if (s === 'served') return 'bg-primary text-white';
    if (s.includes('prepar')) return 'bg-info text-dark';
    if (s.includes('schedul')) return 'bg-secondary text-white';
    return 'bg-warning text-dark';
  };

  const handleSaveChanges = async (e) => {
    e.preventDefault();
    if (isLocked) {
      setFeedback({ type: 'warning', message: 'This order is already being processed and cannot be modified.' });
      return;
    }

    // Validate delivery slot if scheduled items exist
    if (hasScheduledItems) {
      if (!deliveryDate) {
        setFeedback({ type: 'danger', message: 'Please select a delivery date for scheduled breakfast.' });
        return;
      }
      if (deliveryDate < todayStr) {
        setFeedback({ type: 'danger', message: 'Delivery date cannot be in the past.' });
        return;
      }
      if (deliveryDate === todayStr) {
        const [timePart, meridiem] = (deliveryTime || '07:30 AM').split(' ');
        const [hrStr, minStr] = timePart.split(':');
        let dHour = parseInt(hrStr, 10);
        if (meridiem === 'PM' && dHour !== 12) dHour += 12;
        if (meridiem === 'AM' && dHour === 12) dHour = 0;
        const slotMinutes = dHour * 60 + parseInt(minStr, 10);

        if (slotMinutes <= currentMins) {
          setFeedback({
            type: 'danger',
            message: `The time ${deliveryTime} has already passed today. Please pick a later slot or select tomorrow.`
          });
          return;
        }
      }
    }

    setSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      const res = await fetch('/api/guest/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderID: order.orderID,
          items: itemsState.map(it => ({
            itemID: it.itemID,
            type: it.type,
            deliveryType: it.isCookedMeal ? 'scheduled' : it.deliveryType
          })),
          deliveryDate: hasScheduledItems ? deliveryDate : null,
          deliveryTime: hasScheduledItems ? deliveryTime : null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order delivery settings.');

      setFeedback({ type: 'success', message: 'Order delivery preferences updated successfully!' });
      if (onOrderUpdated) {
        await onOrderUpdated();
      }
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const subtotal = itemsState.reduce((sum, it) => sum + (parseFloat(it.price || 0) * (it.quantity || 1)), 0);
  const complimentaryDeduction = itemsState.reduce((sum, it) => {
    const isComp = it.isComplimentary === 1 || it.isComplimentary === true || String(it.isComplimentary) === '1';
    if (isComp) {
      return sum + (parseFloat(it.price || 0) * (it.quantity || 1));
    }
    return sum;
  }, 0);
  const totalAmount = Math.max(0, subtotal - complimentaryDeduction);

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1060 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content shadow-lg border-0 rounded-3 overflow-hidden">
          {/* MODAL HEADER */}
          <div className="modal-header text-white py-3 px-4" style={{ backgroundColor: 'var(--pcc-blue, #2155B5)' }}>
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-receipt-cutoff fs-5"></i>
              <div>
                <h5 className="modal-title fw-bold mb-0" style={{ fontSize: '1.05rem' }}>
                  View / Modify Order #{order.orderID}
                </h5>
                <small className="opacity-75">
                  Placed on {new Date(order.orderDateTime || Date.now()).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </small>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              aria-label="Close"
              disabled={saving}
            />
          </div>

          <form onSubmit={handleSaveChanges}>
            <div className="modal-body p-3 p-md-4">
              {/* FEEDBACK ALERT */}
              {feedback.message && (
                <div className={`alert alert-${feedback.type} py-2 px-3 rounded-2 mb-3 small d-flex align-items-center gap-2`} role="alert">
                  <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-danger'} flex-shrink-0`}></i>
                  <div>{feedback.message}</div>
                </div>
              )}

              {/* ORDER SUMMARY STRIP */}
              <div className="d-flex flex-wrap align-items-center justify-content-between p-2.5 bg-light rounded-2 border mb-3 gap-2">
                <div className="d-flex align-items-center gap-3">
                  <div>
                    <span className="text-muted small d-block" style={{ fontSize: '0.72rem' }}>Room</span>
                    <strong className="text-dark" style={{ fontSize: '0.88rem' }}>Room {order.roomNumber || 'N/A'}</strong>
                  </div>
                  <div className="border-start ps-3">
                    <span className="text-muted small d-block" style={{ fontSize: '0.72rem' }}>Status</span>
                    <span className={`badge ${getStatusBadgeClass(order.orderStatus)} px-2.5 py-1 rounded-pill`} style={{ fontSize: '0.74rem' }}>
                      {order.orderStatus}
                    </span>
                  </div>
                  <div className="border-start ps-3">
                    <span className="text-muted small d-block" style={{ fontSize: '0.72rem' }}>Current Mode</span>
                    <span className={`badge ${order.deliveryType === 'scheduled' ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-success-subtle text-success border border-success-subtle'} px-2 py-0.5`} style={{ fontSize: '0.74rem' }}>
                      {order.deliveryType === 'scheduled' ? `⏰ Scheduled (${order.deliveryTime || 'Breakfast'})` : '⚡ Immediate'}
                    </span>
                  </div>
                </div>
                <div className="text-end">
                  {complimentaryDeduction > 0 ? (
                    <div>
                      <div className="text-muted small" style={{ fontSize: '0.70rem' }}>
                        Subtotal: ₱{subtotal.toFixed(2)}
                      </div>
                      <div className="text-success small fw-semibold" style={{ fontSize: '0.72rem' }}>
                        Free Breakfast: -₱{complimentaryDeduction.toFixed(2)}
                      </div>
                      <div>
                        <span className="text-muted small me-1">Net Charged:</span>
                        <strong className="text-primary fs-6">₱{totalAmount.toFixed(2)}</strong>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="text-muted small d-block" style={{ fontSize: '0.72rem' }}>Total Amount</span>
                      <strong className="text-primary fs-6">₱{totalAmount.toFixed(2)}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* NOTICE BANNER */}
              {isLocked ? (
                <div className="alert alert-secondary py-2 px-3 rounded-2 mb-3 small d-flex align-items-center gap-2" style={{ fontSize: '0.80rem' }}>
                  <i className="bi bi-lock-fill text-secondary flex-shrink-0"></i>
                  <span>
                    This order is already <strong>{order.orderStatus}</strong>. Delivery preferences are locked and can no longer be changed.
                  </span>
                </div>
              ) : (
                <div className="alert alert-info py-2 px-3 rounded-2 mb-3 small d-flex align-items-center gap-2 border-info-subtle" style={{ fontSize: '0.80rem' }}>
                  <i className="bi bi-info-circle-fill text-primary flex-shrink-0"></i>
                  <span>
                    You can modify the delivery mode for products and amenities below. Cooked meals remain locked to scheduled breakfast.
                  </span>
                </div>
              )}

              {/* ITEMS BREAKDOWN TABLE */}
              <h6 className="fw-bold text-dark mb-2 d-flex align-items-center justify-content-between" style={{ fontSize: '0.90rem' }}>
                <span>Order Items ({itemsState.length})</span>
                <span className="text-muted small fw-normal" style={{ fontSize: '0.75rem' }}>
                  Toggle "Deliver with breakfast" to schedule or dispatch immediately
                </span>
              </h6>

              <div className="table-responsive border rounded-2 mb-3 bg-white">
                <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.84rem' }}>
                  <thead className="table-light">
                    <tr>
                      <th className="ps-3 py-2">Item</th>
                      <th className="text-center py-2" style={{ minWidth: '220px' }}>Delivery Preference</th>
                      <th className="text-center py-2">Qty</th>
                      <th className="text-end pe-3 py-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsState.map((it, idx) => {
                      const isMeal = it.isCookedMeal;
                      const subtotal = parseFloat(it.price || 0) * (it.quantity || 1);

                      return (
                        <tr key={idx}>
                          <td className="ps-3 py-2.5">
                            <div className="d-flex align-items-center gap-2">
                              {it.image ? (
                                <img
                                  src={it.image}
                                  alt={it.name}
                                  className="rounded border flex-shrink-0"
                                  style={{ width: '34px', height: '34px', objectFit: 'cover' }}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : null}
                              <div>
                                <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                  <span className="fw-semibold text-dark">{it.name}</span>
                                  {(it.isComplimentary === 1 || it.isComplimentary === true || String(it.isComplimentary) === '1') && (
                                    <span className="badge bg-success-subtle text-success border border-success-subtle py-0.5 px-1.5" style={{ fontSize: '0.66rem' }}>
                                      <i className="bi bi-gift-fill me-1"></i>Free Breakfast
                                    </span>
                                  )}
                                </div>
                                <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                                  {(it.isComplimentary === 1 || it.isComplimentary === true || String(it.isComplimentary) === '1') ? (
                                    <span>
                                      <s>₱{parseFloat(it.price).toFixed(2)} each</s> <strong className="text-success ms-1">₱0.00 (Included)</strong>
                                    </span>
                                  ) : (
                                    `₱${parseFloat(it.price).toFixed(2)} each • `
                                  )}
                                  <span className="badge bg-light text-muted border p-0.5 px-1 ms-1">{it.type}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="text-center py-2.5">
                            {isMeal ? (
                              <div>
                                <span className="badge bg-warning-subtle text-dark border border-warning-subtle py-1 px-2 fw-semibold d-inline-block" style={{ fontSize: '0.72rem' }}>
                                  <i className="bi bi-clock-history me-1 text-warning-emphasis"></i>⏰ Scheduled Breakfast (6:00 AM – 10:30 AM)
                                </span>
                                <div className="text-muted small mt-0.5" style={{ fontSize: '0.67rem' }}>Cooked meals are locked to breakfast window</div>
                              </div>
                            ) : (
                              <div className="d-flex flex-column align-items-center">
                                <div className="form-check form-switch mb-0 d-inline-flex align-items-center gap-1.5" style={{ fontSize: '0.80rem' }}>
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id={`view-order-check-${it.type}-${it.itemID}`}
                                    checked={it.deliveryType === 'scheduled'}
                                    disabled={isLocked}
                                    onChange={(e) => handleToggleItem(it.itemID, it.type, e.target.checked)}
                                  />
                                  <label
                                    className={`form-check-label user-select-none fw-semibold ${it.deliveryType === 'scheduled' ? 'text-primary' : 'text-muted'}`}
                                    htmlFor={`view-order-check-${it.type}-${it.itemID}`}
                                    style={{ cursor: isLocked ? 'not-allowed' : 'pointer', fontSize: '0.76rem' }}
                                  >
                                    Deliver with breakfast (6:00–10:30 AM)
                                  </label>
                                </div>
                                <span
                                  className={`badge mt-1 ${it.deliveryType === 'scheduled' ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-success-subtle text-success border border-success-subtle'}`}
                                  style={{ fontSize: '0.68rem' }}
                                >
                                  {it.deliveryType === 'scheduled' ? '⏰ Scheduled Breakfast' : '⚡ Immediate Delivery'}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="text-center py-2.5 fw-semibold text-dark">
                            {it.quantity}x
                          </td>

                          <td className="text-end pe-3 py-2.5 fw-bold text-dark">
                            {(it.isComplimentary === 1 || it.isComplimentary === true || String(it.isComplimentary) === '1') ? (
                              <div>
                                <s className="text-muted small">₱{subtotal.toFixed(2)}</s>
                                <div className="text-success">₱0.00</div>
                              </div>
                            ) : (
                              `₱${subtotal.toFixed(2)}`
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* SCHEDULED BREAKFAST TIMING CONTROLS (Displayed only if order has scheduled items) */}
              {hasScheduledItems && (
                <div className="p-3 bg-primary-subtle border border-primary-subtle rounded-2 mb-3">
                  <div className="d-flex align-items-center gap-1.5 mb-2 text-primary fw-bold small">
                    <i className="bi bi-clock-history"></i>
                    <span>Breakfast Delivery Time Window</span>
                  </div>

                  <div className="row g-2">
                    <div className="col-12 col-sm-6">
                      <label className="form-label mb-1 text-muted small fw-semibold">Delivery Date *</label>
                      <input
                        type="date"
                        className="form-control form-control-sm fw-semibold bg-white"
                        min={todayStr}
                        value={deliveryDate}
                        disabled={isLocked}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        required={hasScheduledItems}
                      />
                    </div>
                    <div className="col-12 col-sm-6">
                      <label className="form-label mb-1 text-muted small fw-semibold">Delivery Time Slot (6:00 AM – 10:30 AM) *</label>
                      <select
                        className="form-select form-select-sm fw-semibold bg-white"
                        value={deliveryTime}
                        disabled={isLocked}
                        onChange={(e) => setDeliveryTime(e.target.value)}
                        required={hasScheduledItems}
                      >
                        {ALLOWED_BREAKFAST_SLOTS.map(slot => (
                          <option key={slot} value={slot}>{slot}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="modal-footer bg-light py-2.5 px-4 border-top d-flex justify-content-between align-items-center">
              <span className="text-muted small" style={{ fontSize: '0.78rem' }}>
                {isLocked ? 'Order is being processed' : 'Save changes to update delivery instructions'}
              </span>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary text-white fw-semibold px-3"
                  onClick={onClose}
                  disabled={saving}
                >
                  Close
                </button>
                {!isLocked && (
                  <button
                    type="submit"
                    className="btn btn-sm btn-primary text-white fw-semibold px-3 d-flex align-items-center gap-1.5"
                    style={{ backgroundColor: 'var(--pcc-blue, #2155B5)', borderColor: 'var(--pcc-blue, #2155B5)' }}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle"></i>
                        <span>Save Delivery Preferences</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
