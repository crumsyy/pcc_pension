'use client';

import { useState, useEffect, useRef } from 'react';
import ModalDialog from '../../components/ModalDialog';
import ModalPortal from '../../components/ModalPortal';
import SearchableSelect from '../../components/SearchableSelect';
import DynamicQrPhCode from '../../components/DynamicQrPhCode';
import LoadingButton from '../../components/LoadingButton';
import { toast } from '@/components/ui/toast';

/**
 * Shared payment terminal (Cash/GCash) + checkout calculations for one booking.
 * Used by the page-level Payments tab (unlocked, with guest picker) and by the
 * billing View dialog (locked: guest + bill are pre-set, no re-select needed).
 */
export default function PaymentTerminal({
  bookingID = '',
  locked = false,
  bookingOptions = [],
  pickerLoading = false,
  paymentMethods = [],
  onBookingChange,
  onPaid,
  onCompleted
}) {
  const [billData, setBillData] = useState(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const paymentSuccessHandledRef = useRef(false);

  const [paymentForm, setPaymentForm] = useState({
    paymentMethodID: '1', // Default Cash
    cashReceived: '',
    shouldCheckout: true
  });

  const [receipt, setReceipt] = useState(null);

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
    toast.add({
      type: type || 'info',
      title: title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notification'),
      description: message || ''
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
        try {
          if (onConfirmCallback) await onConfirmCallback();
        } finally {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      },
      onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const fetchBillingDetails = async (bID) => {
    if (!bID) {
      setBillData(null);
      return;
    }
    setLoadingBill(true);
    try {
      const res = await fetch(`/api/receptionist/billing?bookingID=${bID}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch billing calculations');
      setBillData(data);
    } catch (err) {
      showAlert('error', 'Billing Notice', err.message);
    } finally {
      setLoadingBill(false);
    }
  };

  useEffect(() => {
    paymentSuccessHandledRef.current = false;
    setPaymentForm(prev => ({ ...prev, cashReceived: '' }));
    if (bookingID) {
      fetchBillingDetails(bookingID);
    } else {
      setBillData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingID]);

  const bIDSafe = () => bookingID || '';

  const handleBookingChange = (bID) => {
    if (typeof onBookingChange === 'function') onBookingChange(bID || '');
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPaymentForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Calculations
  const grossSubtotal = billData ? parseFloat(billData.chargesSummary?.grossTotal || billData.chargesSummary?.total || 0) : 0;
  const discountAmount = billData ? parseFloat(billData.chargesSummary?.totalDiscount || 0) : 0;
  const netSubtotal = billData ? parseFloat(billData.chargesSummary?.netSubtotal || Math.max(0, grossSubtotal - discountAmount)) : 0;
  const grandTotal = billData ? parseFloat(billData.chargesSummary?.netTotal || billData.chargesSummary?.grandTotal || netSubtotal) : 0;
  const totalPaid = billData ? parseFloat(billData.chargesSummary?.paid || 0) : 0;
  const balance = billData ? parseFloat(billData.chargesSummary?.balance || 0) : 0;
  const rawBalance = billData ? parseFloat(billData.chargesSummary?.rawBalance ?? balance) : 0;
  const isOverpaid = rawBalance < 0;
  const isSettled = Math.round(rawBalance * 100) === 0;
  const payableAmount = balance > 0 ? balance : 0;

  const cash = parseFloat(paymentForm.cashReceived) || 0;
  const change = cash - payableAmount > 0 ? cash - payableAmount : 0;

  const handleProcessPayment = async (e) => {
    e.preventDefault();

    if (!bIDSafe() || !billData || !billData.booking) {
      showAlert('warning', 'Warning', 'Please select a valid room/guest.');
      return;
    }

    if (payableAmount > 0 && paymentForm.paymentMethodID === '1' && cash < payableAmount) {
      showAlert('warning', 'Warning', `Insufficient cash received. Minimum amount needed: ₱${payableAmount.toFixed(2)}`);
      return;
    }

    const effectiveCash = payableAmount > 0 ? (paymentForm.paymentMethodID === '1' ? cash : payableAmount) : 0;
    const effectiveChange = payableAmount > 0 ? (paymentForm.paymentMethodID === '1' ? change : 0) : 0;

    showConfirm('Confirm Payment Process', 'Process payment and record transaction?', async () => {
      setIsProcessingPayment(true);
      try {
        const res = await fetch('/api/receptionist/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingID: bIDSafe(),
            guestID: billData.booking.guestID,
            amount: payableAmount,
            cashReceived: effectiveCash,
            change: effectiveChange,
            paymentMethodID: paymentForm.paymentMethodID,
            discountID: null,
            shouldCheckout: false
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to process payment');

        setReceipt({
          guestName: billData.booking.firstName + ' ' + billData.booking.lastName,
          roomNumber: billData.booking.roomNumber,
          roomType: billData.booking.roomType,
          nights: billData.booking.nights,
          rate: billData.booking.rate,
          subtotal: grossSubtotal,
          grossSubtotal,
          earlyCheckIn: billData.chargesSummary?.earlyCheckIn || 0,
          lateCheckOut: billData.chargesSummary?.lateCheckOut || 0,
          discountName: discountAmount > 0 ? (billData.guestsList?.filter(g => g.discountName).map(g => `${g.discountName} (${g.discountPercentage}%)`).join(', ') || 'Discount') : null,
          discountAmount,
          netSubtotal,
          vatRate: 0.00,
          vatAmount: 0.00,
          grandTotal,
          totalPaid,
          payableAmount,
          cashReceived: paymentForm.paymentMethodID === '1' ? cash : payableAmount,
          change: paymentForm.paymentMethodID === '1' ? change : 0,
          paymentMethodName: paymentMethods.find(m => String(m.paymentMethodID) === String(paymentForm.paymentMethodID))?.paymentMethod || 'Cash',
          checkoutChecked: false,
          date: new Date().toLocaleString()
        });

        setPaymentForm(prev => ({
          ...prev,
          cashReceived: '',
          shouldCheckout: false
        }));

        fetchBillingDetails(bIDSafe());
        if (typeof onPaid === 'function') onPaid();
        showAlert('success', 'Payment Recorded', 'Payment recorded successfully. Room remains Occupied until you click "Complete Booking (Zero Balance)".');
      } catch (err) {
        showAlert('error', 'Error', err.message);
      } finally {
        setIsProcessingPayment(false);
      }
    });
  };

  const handlePaymentAutoSuccess = (autoData) => {
    if (paymentSuccessHandledRef.current) return;
    paymentSuccessHandledRef.current = true;

    fetchBillingDetails(bIDSafe());
    if (typeof onPaid === 'function') onPaid();

    if (billData) {
      const settledAmt = parseFloat(autoData?.amount || payableAmount || 0);
      setReceipt({
        guestName: billData.booking.firstName + ' ' + billData.booking.lastName,
        roomNumber: billData.booking.roomNumber,
        roomType: billData.booking.roomType,
        nights: billData.booking.nights,
        rate: billData.booking.rate,
        subtotal: grossSubtotal,
        grossSubtotal,
        earlyCheckIn: billData.chargesSummary?.earlyCheckIn || 0,
        lateCheckOut: billData.chargesSummary?.lateCheckOut || 0,
        discountName: discountAmount > 0 ? (billData.guestsList?.filter(g => g.discountName).map(g => `${g.discountName} (${g.discountPercentage}%)`).join(', ') || 'Discount') : null,
        discountAmount,
        netSubtotal,
        vatRate: 0.00,
        vatAmount: 0.00,
        grandTotal,
        totalPaid: (totalPaid || 0) + settledAmt,
        payableAmount: 0,
        cashReceived: settledAmt,
        change: 0,
        paymentMethodName: 'GCash / PayMongo QR',
        checkoutChecked: false,
        date: new Date().toLocaleString()
      });
    }

    setPaymentForm(prev => ({
      ...prev,
      cashReceived: '',
      shouldCheckout: false
    }));

    showAlert('success', 'Payment Completed', 'Payment verified and recorded successfully. Click "Complete Booking (Zero Balance)" to finish checkout and release room.');
  };

  // Real-time synchronization with 2nd monitor and background authorization
  useEffect(() => {
    if (!bIDSafe()) return;

    const onPaymentReceived = (data) => {
      if (paymentSuccessHandledRef.current) return;
      if (String(data?.bookingID) === String(bIDSafe())) {
        handlePaymentAutoSuccess(data);
      }
    };

    let channel = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('pcc_payment_sync');
        channel.onmessage = (event) => {
          if (event.data && event.data.type === 'PAYMENT_SETTLED') {
            onPaymentReceived(event.data);
          }
        };
      }
    } catch (e) {}

    const handleStorage = (e) => {
      if (paymentSuccessHandledRef.current) return;
      if (e.key === 'pcc_payment_sync_event' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && parsed.type === 'PAYMENT_SETTLED') {
            onPaymentReceived(parsed);
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // Active polling fallback when GCash is selected and payment is pending
    let pollInterval = null;
    if (paymentForm.paymentMethodID === '2' && payableAmount > 0 && !paymentSuccessHandledRef.current) {
      pollInterval = setInterval(async () => {
        if (paymentSuccessHandledRef.current) {
          if (pollInterval) clearInterval(pollInterval);
          return;
        }
        try {
          const res = await fetch(`/api/receptionist/billing?bookingID=${bIDSafe()}`);
          if (res.ok) {
            const data = await res.json();
            const currentPayable = parseFloat(data.chargesSummary?.payableAmount || data.chargesSummary?.balance || 0);
            if (currentPayable <= 0.05) {
              if (pollInterval) clearInterval(pollInterval);
              if (!paymentSuccessHandledRef.current) {
                handlePaymentAutoSuccess({
                  bookingID: bIDSafe(),
                  amount: payableAmount,
                  referenceNumber: `GCASH-${bIDSafe()}`
                });
              }
            }
          }
        } catch (pollErr) {
          // silent error on poll
        }
      }, 2000);
    }

    return () => {
      if (channel) {
        try { channel.close(); } catch (e) {}
      }
      window.removeEventListener('storage', handleStorage);
      if (pollInterval) clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingID, paymentForm.paymentMethodID, payableAmount, billData]);

  const handleDirectCheckOut = async () => {
    if (!bIDSafe()) return;
    const cs = billData?.chargesSummary || {};
    const raw = parseFloat(cs.rawBalance ?? cs.balance ?? 0);
    if (Math.round(raw * 100) !== 0) {
      showAlert('error', 'Action Blocked', raw < 0
        ? `Overpayment of PHP ${Math.abs(raw).toFixed(2)} detected. Flagged for staff review — checkout blocked.`
        : `Outstanding balance of ₱${Number(raw).toFixed(2)} must be settled first.`);
      return;
    }
    const bk = billData?.booking || {};
    const guestName = `${bk.firstName || ''} ${bk.lastName || ''}`.trim() || 'Guest';
    const finalTotal = parseFloat(cs.grandTotal ?? cs.netTotal ?? 0).toFixed(2);
    const verifiedPaid = parseFloat(cs.paid ?? 0).toFixed(2);
    showConfirm('Complete Booking', `Check out ${guestName} (Room ${bk.roomNumber || '—'})? Final bill total: ₱${finalTotal} | Verified payments: ₱${verifiedPaid} | Remaining: ₱0.00. The booking will be marked Completed and the room freed to Available.`, async () => {
      try {
        const res = await fetch('/api/receptionist/billing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete_booking',
            bookingID: bIDSafe()
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to complete booking');

        showAlert('success', 'Booking Completed', 'Booking completed and room is now Available.');
        fetchBillingDetails(bIDSafe());
        if (typeof onCompleted === 'function') onCompleted();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handlePrintReceipt = () => {
    if (!receipt) return;
    const printWindow = window.open('', '_blank', 'width=450,height=700');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sales Invoice - PCC Home Suite Home</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace, sans-serif;
              width: 80mm;
              margin: 0 auto;
              padding: 12px 10px;
              color: #000;
              background: #fff;
              font-size: 11px;
              line-height: 1.3;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .logo { width: 48px; height: 48px; border-radius: 4px; margin-bottom: 4px; }
            .brand-name { font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 2px 0; }
            .address { font-size: 9px; color: #333; margin-bottom: 6px; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .double-divider { border-top: 2px solid #000; margin: 8px 0; }
            .section-header { font-weight: bold; text-transform: uppercase; font-size: 10px; margin: 6px 0 3px 0; background: #eee; padding: 2px 4px; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
            .info-table td { padding: 2px 0; vertical-align: top; }
            .total-row { font-size: 12px; font-weight: bold; }
            .footer { margin-top: 12px; text-align: center; font-size: 9px; color: #444; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <img src="/assets/images/logo.jpg" class="logo" alt="PCC Logo" />
            <div class="brand-name">PCC HOME SUITE HOME</div>
            <div class="address">
              Osmeña Street, Zone 1, Koronadal City<br/>
              South Cotabato, Philippines<br/>
              Tel: 09000000000 | Info: info@pccsuite.com
            </div>
          </div>

          <div class="divider"></div>
          <div class="text-center bold" style="font-size: 11px;">OFFICIAL SALES INVOICE</div>
          <div class="divider"></div>

          <table class="info-table">
            <tr><td>Date/Time:</td><td class="text-right">${receipt.date}</td></tr>
            <tr><td>Sales Invoice No:</td><td class="text-right">#INV-${Math.floor(Math.random() * 900000 + 100000)}</td></tr>
            <tr><td>Payment Method:</td><td class="text-right">${receipt.paymentMethodName}</td></tr>
            <tr><td>Guest Name:</td><td class="text-right bold">${receipt.guestName}</td></tr>
            <tr><td>Room:</td><td class="text-right">Room ${receipt.roomNumber} (${receipt.roomType})</td></tr>
            <tr><td>Stay Duration:</td><td class="text-right">${receipt.nights} Night(s)</td></tr>
          </table>

          <div class="section-header">ROOM CHARGES</div>
          <table class="info-table">
            <tr><td>Room Type:</td><td class="text-right">${receipt.roomType}</td></tr>
            <tr><td>Room Number:</td><td class="text-right">Room ${receipt.roomNumber}</td></tr>
            <tr><td>Room Charge (${receipt.nights} nights):</td><td class="text-right bold">₱${parseFloat(receipt.subtotal).toFixed(2)}</td></tr>
          </table>

          ${(receipt.earlyCheckIn > 0 || receipt.lateCheckOut > 0) ? `
            <div class="section-header">ADDITIONAL FEES</div>
            <table class="info-table">
              ${receipt.earlyCheckIn > 0 ? `<tr><td>Early Check-in Fee (₱50/hr):</td><td class="text-right">₱${parseFloat(receipt.earlyCheckIn).toFixed(2)}</td></tr>` : ''}
              ${receipt.lateCheckOut > 0 ? `<tr><td>Late Check-out Fee (₱100/hr):</td><td class="text-right">₱${parseFloat(receipt.lateCheckOut).toFixed(2)}</td></tr>` : ''}
            </table>
          ` : ''}

          <div class="section-header">ACCOUNTING & BILLING BREAKDOWN</div>
          <table class="info-table">
            <tr><td>Gross Subtotal:</td><td class="text-right">₱${parseFloat(receipt.grossSubtotal || receipt.subtotal).toFixed(2)}</td></tr>
            ${receipt.discountAmount > 0 ? `<tr><td>Special Discounts (${receipt.discountName || 'Applied'}):</td><td class="text-right">-₱${parseFloat(receipt.discountAmount).toFixed(2)}</td></tr>` : ''}
            <tr class="divider"><td colspan="2"></td></tr>
            <tr class="total-row"><td>NET TOTAL AMOUNT DUE:</td><td class="text-right">₱${parseFloat(receipt.netSubtotal || receipt.grandTotal || (receipt.subtotal - receipt.discountAmount)).toFixed(2)}</td></tr>
            <tr><td>Payment Received (${receipt.paymentMethodName}):</td><td class="text-right">₱${parseFloat(receipt.cashReceived).toFixed(2)}</td></tr>
            ${receipt.change > 0 ? `<tr><td>Change Returned:</td><td class="text-right">₱${parseFloat(receipt.change).toFixed(2)}</td></tr>` : ''}
            <tr><td>Balance After Payment:</td><td class="text-right bold">₱0.00</td></tr>
          </table>

          <div class="double-divider"></div>

          <div class="footer">
            <p class="bold" style="margin-bottom: 2px;">Thank you for staying at PCC Home Suite Home!</p>
            <p style="margin: 0;">We hope to see you again.</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <>
      {locked && billData?.booking && (
        <div className="alert alert-primary py-2 px-3 mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-person-circle fs-5"></i>
            <div>
              <div className="fw-bold text-dark" style={{ fontSize: '0.9rem' }}>
                {billData.booking.firstName} {billData.booking.lastName}
              </div>
              <small className="text-muted">
                Room {billData.booking.roomNumber} ({billData.booking.roomType}) • Booking #{bIDSafe()}
              </small>
            </div>
          </div>
          <span className="fw-bold" style={{ fontSize: '1rem' }}>
            Balance: ₱{payableAmount.toFixed(2)}
          </span>
        </div>
      )}

      <div className="row g-4" style={{ minHeight: 0, paddingBottom: '15px' }}>
        {/* Left Payment form */}
        <div className="col-lg-6 d-flex flex-column" style={{ minHeight: 0 }}>
          <div className="card shadow-sm border-0 bg-white d-flex flex-column h-100" style={{ borderRadius: '8px', minHeight: 0 }}>
            <div className="card-header bg-white border-0 py-3 border-bottom">
              <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.95rem' }}>Payment Terminal</h5>
            </div>
            <form onSubmit={handleProcessPayment} className="d-flex flex-column flex-grow-1">
              <div className="card-body p-3 flex-grow-1">
                {!locked && (
                  <div className="mb-2">
                    <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>Select Guest / Room *</label>
                    {pickerLoading ? (
                      <div className="form-control bg-light text-muted small d-flex align-items-center" style={{ height: '38px', borderRadius: '6px' }}>
                        Loading guests…
                      </div>
                    ) : (
                      <SearchableSelect
                        options={bookingOptions}
                        value={bIDSafe()}
                        onChange={handleBookingChange}
                        placeholder="Type guest name, room number, or User ID (UID)..."
                      />
                    )}
                  </div>
                )}

                <div className="mb-2">
                  <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>Payment Method *</label>
                  <select
                    className="form-select form-select-sm"
                    name="paymentMethodID"
                    value={paymentForm.paymentMethodID}
                    onChange={handleInputChange}
                    style={{ borderRadius: '6px' }}
                  >
                    {paymentMethods.map(m => (
                      <option key={m.paymentMethodID} value={m.paymentMethodID}>
                        {m.paymentMethod}
                      </option>
                    ))}
                  </select>
                </div>

                {paymentForm.paymentMethodID === '1' && (
                  <div className="mb-2">
                    <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>Cash Received *</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">₱</span>
                      <input
                        type="number"
                        className="form-control"
                        name="cashReceived"
                        min="0"
                        step="0.01"
                        required={paymentForm.paymentMethodID === '1' && payableAmount > 0}
                        placeholder="0.00"
                        value={paymentForm.cashReceived}
                        onChange={handleInputChange}
                        style={{ borderRadius: '0 6px 6px 0' }}
                      />
                    </div>
                  </div>
                )}

                {paymentForm.paymentMethodID === '2' && (
                  <div className="mb-2">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="small text-muted fw-semibold">PayMongo GCash QR Code</span>
                      {bIDSafe() && (
                        <a
                          href={`/receptionist/qr-payment?bookingId=${bIDSafe()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-primary fw-bold d-inline-flex align-items-center gap-1 shadow-xs py-0.5 px-2"
                          style={{ fontSize: '0.75rem' }}
                          title="Open on 2nd monitor for guest to scan"
                        >
                          <i className="fa-solid fa-up-right-from-square"></i> Open on 2nd Monitor
                        </a>
                      )}
                    </div>
                    <DynamicQrPhCode
                      amount={payableAmount}
                      refNumber={`PAY-${bIDSafe() || 'POS'}`}
                      paymentStatus="Pending"
                      showProceedBtn={false}
                      showCheckStatusBtn={false}
                      onCheckStatus={() => fetchBillingDetails(bIDSafe())}
                      onPaymentSuccess={handlePaymentAutoSuccess}
                      bookingID={bIDSafe()}
                      guestID={billData?.booking?.guestID}
                    />
                  </div>
                )}

                <div className="alert alert-info py-2 px-3 mb-2 mt-2" style={{ fontSize: '0.78rem' }}>
                  ℹ Payment records transaction settlement. Room remains Occupied until front desk clicks <strong>Complete Booking (Zero Balance)</strong>.
                </div>

                {isOverpaid && bIDSafe() ? (
                  <div className="alert alert-danger py-2 px-3 mb-2 mt-2 fw-semibold" style={{ fontSize: '0.78rem' }}>
                    Overpayment of PHP {Math.abs(rawBalance).toFixed(2)} flagged for review — checkout is blocked until resolved.
                  </div>
                ) : null}
                {isSettled && !isOverpaid && bIDSafe() ? (
                  <button
                    type="button"
                    className="btn btn-success text-white w-100 py-2.5 fw-bold shadow-sm"
                    onClick={handleDirectCheckOut}
                  >
                    ✓ Complete Booking (Zero Balance)
                  </button>
                ) : (
                  <LoadingButton
                    type="submit"
                    className="btn btn-pcc-primary text-white w-100 py-2 fw-bold"
                    style={{ fontSize: '0.95rem' }}
                    disabled={!bIDSafe() || loadingBill || paymentForm.paymentMethodID === '2'}
                    isLoading={isProcessingPayment}
                    loadingText="Processing Payment..."
                  >
                    {paymentForm.paymentMethodID === '2' ? 'Scan GCash QR Code Above' : 'Confirm & Settle Cash Payment'}
                  </LoadingButton>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right Calculations summary */}
        <div className="col-lg-6 d-flex flex-column" style={{ minHeight: 0 }}>
          <div className="card shadow-sm border-0 bg-white d-flex flex-column h-100" style={{ borderRadius: '8px', minHeight: 0 }}>
            <div className="card-header bg-white border-0 py-3 border-bottom">
              <h5 className="fw-bold mb-0 text-dark">Checkout Calculations</h5>
            </div>
            <div className="card-body p-4 d-flex flex-column justify-content-between flex-grow-1" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', minHeight: 0, fontSize: '0.78rem' }}>
              {loadingBill ? (
                <div className="text-center py-5 text-muted my-auto">
                  <p className="small mt-2 mb-0">Loading bill details…</p>
                </div>
              ) : billData ? (
                <div>
                  <h6 className="fw-bold text-dark mb-3">Room {billData.booking.roomNumber} ({billData.booking.roomType}) - {billData.booking.lastName}, {billData.booking.firstName}</h6>
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">Room Base Rent ({billData.chargesSummary.breakfastOption === 'with' ? 'With Breakfast' : 'Room Only'}):</span>
                    <span className="fw-semibold text-dark">₱{parseFloat(billData.chargesSummary.baseRoomCharge || billData.chargesSummary.room).toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="d-flex justify-content-between mb-2 text-danger">
                      <span>Room Discounts Applied:</span>
                      <span className="fw-semibold">-₱{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {billData.chargesSummary.downPaymentPaid > 0 && (
                    <div className="d-flex justify-content-between mb-2 text-success">
                      <span>Down Payment Paid ({billData.chargesSummary.downPaymentPercentage}%):</span>
                      <span className="fw-semibold">-₱{parseFloat(billData.chargesSummary.downPaymentPaid).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between mb-2 pb-2 border-bottom">
                    <span className="fw-semibold text-dark">Remaining Room Balance:</span>
                    <span className="fw-bold text-dark">₱{parseFloat(billData.chargesSummary.roomBalance || 0).toFixed(2)}</span>
                  </div>

                  {billData.chargesSummary.extraGuestFee > 0 && (
                    <div className="d-flex justify-content-between mb-2 text-secondary align-items-center">
                      <span>
                        Extra Guests Fee ({billData.chargesSummary.extraGuests} Pax @ ₱100/night):
                        <span className="badge bg-secondary-subtle text-secondary ms-1.5" style={{ fontSize: '0.68rem' }}>Final Billing Only</span>
                      </span>
                      <span className="fw-semibold text-dark">+₱{parseFloat(billData.chargesSummary.extraGuestFee).toFixed(2)}</span>
                    </div>
                  )}
                  {billData.chargesSummary.earlyCheckIn > 0 && (
                    <div className="d-flex justify-content-between mb-2 text-danger">
                      <span>Early Check-In Fee:</span>
                      <span className="fw-semibold">₱{parseFloat(billData.chargesSummary.earlyCheckIn).toFixed(2)}</span>
                    </div>
                  )}
                  {billData.chargesSummary.lateCheckOut > 0 && (
                    <div className="d-flex justify-content-between mb-2 text-danger">
                      <span>Late Check-Out Fee:</span>
                      <span className="fw-semibold">₱{parseFloat(billData.chargesSummary.lateCheckOut).toFixed(2)}</span>
                    </div>
                  )}
                  {parseFloat(billData.chargesSummary.breakfastFee || 0) > 0 && (
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Breakfast Package / Add-on Fee:</span>
                      <span className="fw-semibold text-dark">+₱{parseFloat(billData.chargesSummary.breakfastFee).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">Product Orders Total:</span>
                    <span className="fw-semibold text-dark">₱{parseFloat(billData.chargesSummary.products).toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">Amenity Orders Total:</span>
                    <span className="fw-semibold text-dark">₱{parseFloat(billData.chargesSummary.amenities).toFixed(2)}</span>
                  </div>
                  <hr className="my-2" />
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">Gross Charges Subtotal:</span>
                    <span className="fw-semibold text-dark">₱{grossSubtotal.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="d-flex justify-content-between mb-2 text-danger">
                      <span>Special Discounts:</span>
                      <span className="fw-semibold">-₱{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between mb-2 fw-bold text-dark pt-1 border-top">
                    <span>Net Total Amount Due:</span>
                    <span className="text-pcc-blue">₱{grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">Total Payments Settled:</span>
                    <span className="fw-semibold text-success">₱{totalPaid.toFixed(2)}</span>
                  </div>

                  <hr />

                  <div className="p-3 bg-light rounded mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <div>
                        <span className="fw-bold text-dark d-block" style={{ fontSize: '1rem' }}>Total Amount Payable:</span>
                        <span className="text-muted" style={{ fontSize: '0.70rem' }}>Net Total Due - Total Payments Settled</span>
                      </div>
                      <span className="fw-bold text-pcc-primary" style={{ fontSize: '1.25rem' }}>
                        ₱{payableAmount.toFixed(2)}
                      </span>
                    </div>
                    {paymentForm.paymentMethodID === '1' && (
                      <div className="d-flex justify-content-between align-items-center mt-2 text-success pt-2 border-top border-secondary-subtle">
                        <span className="fw-semibold">Change to return:</span>
                        <span className="fw-bold" style={{ fontSize: '1.15rem' }}>
                          ₱{change.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-5 text-muted my-auto">
                  <p className="small mt-2 mb-0">Select an active check-in guest to preview POS checkout calculations.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PRINT RECEIPT MODAL */}
      {receipt && (
        <ModalPortal>
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.32)', backdropFilter: 'blur(10px) saturate(125%)', WebkitBackdropFilter: 'blur(10px) saturate(125%)', zIndex: 99999 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0">
              <div className="modal-body p-4" id="print-area">
                <style>{`
                  @media print {
                    body * {
                      visibility: hidden;
                    }
                    #print-area, #print-area * {
                      visibility: visible;
                    }
                    #print-area {
                      position: absolute;
                      left: 0;
                      top: 0;
                      width: 100%;
                    }
                  }
                `}</style>
                <div className="text-center mb-4">
                  <h4 className="fw-bold text-pcc-blue mb-1" style={{ color: 'var(--pcc-blue)' }}>PCC Home Suite Home</h4>
                  <p className="small text-muted mb-0">Front Desk Receipt Statement</p>
                  <p className="small text-muted" style={{ fontSize: '0.78rem' }}>Date: {receipt.date}</p>
                </div>

                <div className="border-top border-bottom py-2 mb-3" style={{ fontSize: '0.88rem' }}>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Guest Name:</span>
                    <strong className="text-dark">{receipt.guestName}</strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Room / Category:</span>
                    <span className="text-dark">Room {receipt.roomNumber} ({receipt.roomType})</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Stay Duration:</span>
                    <span className="text-dark">{receipt.nights} Nights (Rate: ₱{parseFloat(receipt.rate).toFixed(2)})</span>
                  </div>
                </div>

                <div className="mb-3" style={{ fontSize: '0.88rem' }}>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Gross Subtotal:</span>
                    <span>₱{parseFloat(receipt.grossSubtotal || receipt.subtotal).toFixed(2)}</span>
                  </div>
                  {receipt.earlyCheckIn > 0 && (
                    <div className="d-flex justify-content-between mb-1 text-danger">
                      <span>Early Check-In Fee:</span>
                      <span>+₱{parseFloat(receipt.earlyCheckIn).toFixed(2)}</span>
                    </div>
                  )}
                  {receipt.lateCheckOut > 0 && (
                    <div className="d-flex justify-content-between mb-1 text-danger">
                      <span>Late Check-Out Fee:</span>
                      <span>+₱{parseFloat(receipt.lateCheckOut).toFixed(2)}</span>
                    </div>
                  )}
                  {receipt.discountAmount > 0 && (
                    <div className="d-flex justify-content-between mb-1 text-success">
                      <span>Special Discounts ({receipt.discountName || 'Applied'}):</span>
                      <span>-₱{parseFloat(receipt.discountAmount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between mb-1 fw-bold text-dark pt-1 border-top" style={{ fontSize: '0.95rem' }}>
                    <span>Net Total Amount Due:</span>
                    <span className="text-pcc-blue">₱{parseFloat(receipt.netSubtotal || receipt.grandTotal || (receipt.subtotal - receipt.discountAmount)).toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1 fw-semibold text-success">
                    <span>Amount Paid This Transaction:</span>
                    <span>₱{parseFloat(receipt.payableAmount).toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1 text-muted" style={{ fontSize: '0.82rem' }}>
                    <span>Payment Method:</span>
                    <span>{receipt.paymentMethodName}</span>
                  </div>
                  {receipt.paymentMethodName === 'Cash' && (
                    <>
                      <div className="d-flex justify-content-between mb-1 text-muted" style={{ fontSize: '0.82rem' }}>
                        <span>Cash Received:</span>
                        <span>₱{receipt.cashReceived.toFixed(2)}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1 text-success font-monospace" style={{ fontSize: '0.85rem' }}>
                        <span>Change Issued:</span>
                        <strong>₱{receipt.change.toFixed(2)}</strong>
                      </div>
                    </>
                  )}
                </div>

                <div className="alert alert-success text-center py-2 mb-3" style={{ fontSize: '0.85rem' }}>
                  Transaction Completed successfully.
                  {receipt.checkoutChecked && " Guest checked out successfully."}
                </div>

                <div className="text-center text-muted" style={{ fontSize: '0.75rem' }}>
                  Thank you for staying at PCC Home Suite Home!
                </div>
              </div>
              <div className="modal-footer border-top-0 d-print-none">
                <button type="button" className="btn btn-pcc-primary text-white" onClick={handlePrintReceipt}>Print Receipt</button>
                <button type="button" className="btn btn-secondary text-white" onClick={() => setReceipt(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
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
