'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ModalDialog from '../../components/ModalDialog';
import SearchableSelect from '../../components/SearchableSelect';
import DynamicQrPhCode from '../../components/DynamicQrPhCode';

function PaymentsClient() {
  const searchParams = useSearchParams();
  const initialBookingID = searchParams.get('bookingID');

  const [activeBookings, setActiveBookings] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedBookingID, setSelectedBookingID] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingBill, setLoadingBill] = useState(false);

  // Bill summary states
  const [billData, setBillData] = useState(null);

  // Payment states
  const [paymentForm, setPaymentForm] = useState({
    paymentMethodID: '1', // Default Cash
    discountID: '',
    cashReceived: '',
    shouldCheckout: true
  });

  const [receipt, setReceipt] = useState(null); // Receipt modal data if payment succeeds

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

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyMethodFilter, setHistoryMethodFilter] = useState('All');
  const [historyDateFilter, setHistoryDateFilter] = useState('');

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/receptionist/payments');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch payment details');

      setActiveBookings(data.activeBookings || []);
      setDiscounts(data.discounts || []);
      setPaymentMethods(data.paymentMethods || []);
      setPaymentHistory(data.paymentHistory || []);
      
      if (initialBookingID) {
        setSelectedBookingID(initialBookingID);
        fetchBillingDetails(initialBookingID);
      }
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBillingDetails = async (bookingID) => {
    if (!bookingID) {
      setBillData(null);
      return;
    }
    setLoadingBill(true);
    try {
      const res = await fetch(`/api/receptionist/billing?bookingID=${bookingID}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch billing calculations');
      setBillData(data);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoadingBill(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleBookingChange = (bID) => {
    setSelectedBookingID(bID);
    setPaymentForm(prev => ({
      ...prev,
      discountID: '',
      cashReceived: ''
    }));
    fetchBillingDetails(bID);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPaymentForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Calculations
  const subtotal = billData ? parseFloat(billData.chargesSummary.total) : 0;
  const balance = billData ? parseFloat(billData.chargesSummary.balance) : 0;
  const discountAmount = billData ? parseFloat(billData.chargesSummary.totalDiscount) : 0;
  const payableAmount = balance > 0 ? balance : 0;

  const cash = parseFloat(paymentForm.cashReceived) || 0;
  const change = cash - payableAmount > 0 ? cash - payableAmount : 0;

  const handleProcessPayment = async (e) => {
    e.preventDefault();

    if (!selectedBookingID || !billData || !billData.booking) {
      showAlert('warning', 'Warning', 'Please select a valid room/guest.');
      return;
    }

    if (payableAmount > 0 && paymentForm.paymentMethodID === '1' && cash < payableAmount) {
      showAlert('warning', 'Warning', `Insufficient cash received. Minimum amount needed: ₱${payableAmount.toFixed(2)}`);
      return;
    }

    const effectiveCash = payableAmount > 0 ? (paymentForm.paymentMethodID === '1' ? cash : payableAmount) : 0;
    const effectiveChange = payableAmount > 0 ? (paymentForm.paymentMethodID === '1' ? change : 0) : 0;

    showConfirm('Confirm Payment Process', 'Process payment and finalize checkout details?', async () => {
      try {
        const res = await fetch('/api/receptionist/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingID: selectedBookingID,
            guestID: billData.booking.guestID,
            amount: payableAmount,
            cashReceived: effectiveCash,
            change: effectiveChange,
            paymentMethodID: paymentForm.paymentMethodID,
            discountID: null,
            shouldCheckout: true
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to process payment');

        // Setup Receipt print layout modal
        setReceipt({
          guestName: billData.booking.firstName + ' ' + billData.booking.lastName,
          roomNumber: billData.booking.roomNumber,
          roomType: billData.booking.roomType,
          nights: billData.booking.nights,
          rate: billData.booking.rate,
          subtotal,
          earlyCheckIn: billData.chargesSummary.earlyCheckIn,
          lateCheckOut: billData.chargesSummary.lateCheckOut,
          discountName: discountAmount > 0 ? (billData.guestsList.filter(g => g.discountName).map(g => `${g.discountName} (${g.discountPercentage}%)`).join(', ') || 'Discount') : null,
          discountAmount,
          payableAmount,
          cashReceived: paymentForm.paymentMethodID === '1' ? cash : payableAmount,
          change: paymentForm.paymentMethodID === '1' ? change : 0,
          paymentMethodName: paymentMethods.find(m => m.paymentMethodID === parseInt(paymentForm.paymentMethodID))?.paymentMethod || 'Cash',
          checkoutChecked: data.checkoutChecked,
          date: new Date().toLocaleString()
        });

        // Reset forms
        setSelectedBookingID('');
        setBillData(null);
        setPaymentForm({
          paymentMethodID: '1',
          discountID: '',
          cashReceived: '',
          shouldCheckout: true
        });

        // Refresh lists
        fetchInitialData();
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
            .items-table { width: 100%; border-collapse: collapse; margin: 4px 0; }
            .items-table th, .items-table td { padding: 2px 0; font-size: 10px; }
            .items-table th { border-bottom: 1px solid #000; text-align: left; }
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

          <div class="section-header">PAYMENT SUMMARY</div>
          <table class="info-table">
            <tr><td>Room Charge:</td><td class="text-right">₱${parseFloat(receipt.subtotal).toFixed(2)}</td></tr>
            ${receipt.earlyCheckIn > 0 ? `<tr><td>Early Check-in Fee:</td><td class="text-right">+₱${parseFloat(receipt.earlyCheckIn).toFixed(2)}</td></tr>` : ''}
            ${receipt.lateCheckOut > 0 ? `<tr><td>Late Check-out Fee:</td><td class="text-right">+₱${parseFloat(receipt.lateCheckOut).toFixed(2)}</td></tr>` : ''}
            ${receipt.discountAmount > 0 ? `<tr><td>Discount (${receipt.discountName || 'Applied'}):</td><td class="text-right">-₱${parseFloat(receipt.discountAmount).toFixed(2)}</td></tr>` : ''}
            <tr class="double-divider"><td colspan="2"></td></tr>
            <tr class="total-row"><td>GRAND TOTAL:</td><td class="text-right">₱${parseFloat(receipt.payableAmount).toFixed(2)}</td></tr>
            <tr><td>Payment Received:</td><td class="text-right">₱${parseFloat(receipt.cashReceived).toFixed(2)}</td></tr>
            ${receipt.change > 0 ? `<tr><td>Change:</td><td class="text-right">₱${parseFloat(receipt.change).toFixed(2)}</td></tr>` : ''}
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

  // Filter payment history logs
  const filteredHistory = paymentHistory.filter(item => {
    const query = historySearch.toLowerCase();
    const guestName = `${item.firstName || ''} ${item.lastName || ''}`.toLowerCase();
    const trxID = `trx-${item.paymentID}`.toLowerCase();
    const rawID = String(item.paymentID).toLowerCase();
    
    const matchesQuery = 
      guestName.includes(query) ||
      trxID.includes(query) ||
      rawID.includes(query) ||
      (item.contact || '').toLowerCase().includes(query) ||
      (item.roomNumber || '').toLowerCase().includes(query) ||
      String(item.bookingID || '').includes(query);
      
    const matchesMethod = historyMethodFilter === 'All' || item.paymentMethod === historyMethodFilter;
    
    let matchesDate = true;
    if (historyDateFilter) {
      const itemDateStr = item.paymentDateTime ? item.paymentDateTime.split(' ')[0] : '';
      matchesDate = itemDateStr === historyDateFilter;
    }

    return matchesQuery && matchesMethod && matchesDate;
  });

  return (
    <>
      <div className="container-fluid py-3 d-flex flex-column" style={{ backgroundColor: '#f8f9fa', height: 'calc(100vh - 150px)', overflow: 'hidden' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h2 className="fw-bold mb-1 text-pcc-blue" style={{ color: 'var(--pcc-blue)', fontSize: '1.4rem' }}>
              Payment Management &amp; POS
            </h2>
            <p className="text-muted mb-0 small">Settle guest stays, accept GCash/Cash payments, and track transaction history.</p>
          </div>

          <button
            type="button"
            className="btn btn-pcc-primary text-white fw-bold px-3.5 py-2 shadow-sm"
            onClick={() => setShowHistoryModal(true)}
          >
            Payment History
          </button>
        </div>

        <div className="row g-4 flex-grow-1 overflow-hidden" style={{ minHeight: 0, paddingBottom: '15px' }}>
          {/* Left Payment form */}
          <div className="col-lg-6 h-100 d-flex flex-column overflow-hidden" style={{ minHeight: 0 }}>
            <div className="card shadow-sm border-0 bg-white flex-grow-1 d-flex flex-column overflow-hidden h-100" style={{ borderRadius: '8px', minHeight: 0 }}>
              <div className="card-header bg-white border-0 py-3 border-bottom">
                <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.95rem' }}>Payment Terminal</h5>
              </div>
              <form onSubmit={handleProcessPayment} className="d-flex flex-column overflow-hidden flex-grow-1">
                <div className="card-body p-3 overflow-y-auto flex-grow-1">
                  <div className="mb-2">
                    <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>Select Checked-In Guest *</label>
                    {loading ? (
                      <div>Loading guest records...</div>
                    ) : (
                      <SearchableSelect
                        options={activeBookings.map(b => ({
                          value: String(b.bookingID),
                          label: `Room ${b.roomNumber} (${b.roomType}) — ${b.lastName}, ${b.firstName}`
                        }))}
                        value={selectedBookingID}
                        onChange={handleBookingChange}
                        placeholder="Type to search guest or room..."
                      />
                    )}
                  </div>

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
                    <DynamicQrPhCode 
                      amount={payableAmount}
                      refNumber={`PAY-${selectedBookingID || 'POS'}`}
                      paymentStatus="Pending"
                      showProceedBtn={false}
                      showCheckStatusBtn={true}
                      onCheckStatus={fetchInitialData}
                    />
                  )}

                  <div className="alert alert-info py-2 px-3 mb-2 mt-2" style={{ fontSize: '0.78rem' }}>
                    ℹ Guest checkout and room release will occur automatically upon payment.
                  </div>

                  <button
                    type="submit"
                    className="btn btn-pcc-primary text-white w-100 py-2 fw-bold"
                    style={{ fontSize: '0.95rem' }}
                    disabled={!selectedBookingID || loadingBill}
                  >
                    Confirm & Settle Payment
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Calculations summary */}
          <div className="col-lg-6 h-100 d-flex flex-column overflow-hidden" style={{ minHeight: 0 }}>
            <div className="card shadow-sm border-0 flex-grow-1 d-flex flex-column overflow-hidden h-100 bg-white" style={{ borderRadius: '8px', minHeight: 0 }}>
              <div className="card-header bg-white border-0 py-3 border-bottom">
                <h5 className="fw-bold mb-0 text-dark">Checkout Calculations</h5>
              </div>
              <div className="card-body p-4 d-flex flex-column justify-content-between flex-grow-1" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', minHeight: 0, fontSize: '0.78rem' }}>
                {loadingBill ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-pcc-primary" role="status">
                      <span className="visually-hidden">Calculating bill...</span>
                    </div>
                  </div>
                ) : billData ? (
                  <div>
                    <h6 className="fw-bold text-dark mb-3">Room {billData.booking.roomNumber} ({billData.booking.roomType}) - {billData.booking.lastName}, {billData.booking.firstName}</h6>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Room Rent (Original):</span>
                      <span className="fw-semibold text-dark">₱{parseFloat(billData.chargesSummary.originalRoomCharge).toFixed(2)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="d-flex justify-content-between mb-2 text-danger">
                        <span>Applied Discounts:</span>
                        <span className="fw-semibold">-₱{discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Room Rent (Net):</span>
                      <span className="fw-semibold text-dark">₱{parseFloat(billData.chargesSummary.room).toFixed(2)}</span>
                    </div>
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
                      <span className="text-muted">Total Accrued Charges:</span>
                      <span className="fw-semibold text-dark">₱{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Paid to date:</span>
                      <span className="fw-semibold text-success">₱{parseFloat(billData.chargesSummary.paid).toFixed(2)}</span>
                    </div>
                    
                    <hr />

                    <div className="p-3 bg-light rounded mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-bold text-dark" style={{ fontSize: '1rem' }}>Net Amount Payable:</span>
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
      </div>

      {/* PAYMENT HISTORY SCROLLABLE MODAL DIALOG */}
      {showHistoryModal && (
        <div className="modal show d-block animate__animated animate__fadeIn" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1050 }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable" style={{ maxWidth: '92%' }}>
            <div className="modal-content border-0 shadow-lg" style={{ height: '85vh', borderRadius: '12px', overflow: 'hidden' }}>
              <div className="modal-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold text-dark m-0" style={{ fontSize: '1.1rem' }}>
                  Payment History
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowHistoryModal(false)}></button>
              </div>

              {/* Filters Toolbar */}
              <div className="px-4 py-3 bg-light border-bottom d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="d-flex flex-wrap align-items-center gap-3">
                  <div>
                    <label className="form-label small fw-bold mb-1 text-muted d-block" style={{ fontSize: '0.75rem' }}>Search Transaction ID / Guest Name / Room</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. TRX-1, Guest Name, Room #..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      style={{ width: '260px', borderRadius: '6px' }}
                    />
                  </div>

                  <div>
                    <label className="form-label small fw-bold mb-1 text-muted d-block" style={{ fontSize: '0.75rem' }}>Filter by Date</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={historyDateFilter}
                      onChange={(e) => setHistoryDateFilter(e.target.value)}
                      style={{ width: '160px', borderRadius: '6px' }}
                    />
                  </div>

                  <div>
                    <label className="form-label small fw-bold mb-1 text-muted d-block" style={{ fontSize: '0.75rem' }}>Payment Method</label>
                    <select
                      className="form-select form-select-sm"
                      value={historyMethodFilter}
                      onChange={(e) => setHistoryMethodFilter(e.target.value)}
                      style={{ width: '140px', borderRadius: '6px' }}
                    >
                      <option value="All">All Methods</option>
                      <option value="Cash">Cash</option>
                      <option value="GCash">GCash</option>
                    </select>
                  </div>

                  {(historySearch || historyDateFilter || historyMethodFilter !== 'All') && (
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-danger p-0 mt-3 align-self-end text-decoration-none fw-semibold"
                      style={{ fontSize: '0.8rem' }}
                      onClick={() => {
                        setHistorySearch('');
                        setHistoryDateFilter('');
                        setHistoryMethodFilter('All');
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                <span className="badge bg-secondary text-white px-3 py-2" style={{ fontSize: '0.78rem' }}>
                  Total Records: {filteredHistory.length}
                </span>
              </div>

              {/* Scrollable Table Body */}
              <div className="modal-body p-0 overflow-auto">
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-5 text-muted small">
                    No payment history records found matching search filters.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.86rem' }}>
                      <thead className="table-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                        <tr>
                          <th>Transaction ID</th>
                          <th>Date &amp; Time</th>
                          <th>Guest Name</th>
                          <th>Room / Booking</th>
                          <th>Method</th>
                          <th>Amount Paid</th>
                          <th>Processed By</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.map((h) => (
                          <tr key={h.paymentID}>
                            <td className="fw-bold text-pcc-blue font-monospace">#TRX-{String(h.paymentID).padStart(5, '0')}</td>
                            <td className="small text-muted">{new Date(h.paymentDateTime).toLocaleString()}</td>
                            <td>
                              <div className="fw-bold text-dark">{h.firstName} {h.lastName}</div>
                              <small className="text-muted" style={{ fontSize: '0.72rem' }}>Contact: {h.contact || 'N/A'}</small>
                            </td>
                            <td>
                              <span className="fw-semibold text-dark">
                                {h.roomNumber ? `Room ${h.roomNumber}` : 'Direct SOA'}
                              </span>
                              {h.bookingID && <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Booking #{h.bookingID}</small>}
                            </td>
                            <td>
                              <span className={`badge ${h.paymentMethod === 'GCash' ? 'bg-primary text-white' : 'bg-success text-white'} px-2 py-1`} style={{ fontSize: '0.72rem' }}>
                                {h.paymentMethod}
                              </span>
                            </td>
                            <td className="fw-bold text-success fs-6">₱{parseFloat(h.amount).toFixed(2)}</td>
                            <td><small className="text-muted">{h.processedBy || 'Front Desk'}</small></td>
                            <td>
                              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1" style={{ fontSize: '0.72rem' }}>
                                Settled
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="modal-footer bg-light border-top py-2 px-4">
                <button type="button" className="btn btn-secondary text-white fw-semibold" onClick={() => setShowHistoryModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT RECEIPT MODAL */}
      {receipt && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1060 }}>
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
                {/* Print receipt design */}
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
                    <span className="text-muted">Total Charges:</span>
                    <span>₱{receipt.subtotal.toFixed(2)}</span>
                  </div>
                  {receipt.earlyCheckIn > 0 && (
                    <div className="d-flex justify-content-between mb-1 text-danger">
                      <span>Early Check-In Fee:</span>
                      <span>+₱{receipt.earlyCheckIn.toFixed(2)}</span>
                    </div>
                  )}
                  {receipt.lateCheckOut > 0 && (
                    <div className="d-flex justify-content-between mb-1 text-danger">
                      <span>Late Check-Out Fee:</span>
                      <span>+₱{receipt.lateCheckOut.toFixed(2)}</span>
                    </div>
                  )}
                  {receipt.discountName && (
                    <div className="d-flex justify-content-between mb-1 text-danger">
                      <span>Discount ({receipt.discountName}):</span>
                      <span>-₱{receipt.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between mb-1 fw-bold text-dark pt-1 border-top">
                    <span>Paid Amount:</span>
                    <span>₱{receipt.payableAmount.toFixed(2)}</span>
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

export default function ReceptionistPayments() {
  return (
    <Suspense fallback={<div>Loading POS terminal...</div>}>
      <PaymentsClient />
    </Suspense>
  );
}
