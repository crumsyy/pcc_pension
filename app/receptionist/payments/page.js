'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ModalDialog from '../../components/ModalDialog';
import SearchableSelect from '../../components/SearchableSelect';

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
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        onConfirmCallback();
      },
      onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/receptionist/payments');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch payment details');

      setActiveBookings(data.activeBookings || []);
      setDiscounts(data.discounts || []);
      setPaymentMethods(data.paymentMethods || []);
      
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

    if (!selectedBookingID) {
      showAlert('warning', 'Warning', 'Please select a room/guest.');
      return;
    }

    if (payableAmount > 0 && paymentForm.paymentMethodID === '1' && cash < payableAmount) {
      showAlert('warning', 'Warning', `Insufficient cash received. Minimum amount needed: ₱${payableAmount.toFixed(2)}`);
      return;
    }

    showConfirm('Confirm Payment Process', 'Process payment and finalize checkout details?', async () => {
      try {
        const res = await fetch('/api/receptionist/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingID: selectedBookingID,
            guestID: billData.booking.guestID,
            amount: payableAmount,
            cashReceived: paymentForm.paymentMethodID === '1' ? cash : payableAmount,
            change: paymentForm.paymentMethodID === '1' ? change : 0,
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
          discountName: discountAmount > 0 ? 'Senior / PWD Apportioned Discount' : null,
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
    window.print();
  };

  return (
    <>
      <div className="container-fluid py-3 d-flex flex-column" style={{ backgroundColor: '#f8f9fa', height: 'calc(100vh - 150px)', overflow: 'hidden' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="fw-bold mb-1 text-pcc-blue" style={{ color: 'var(--pcc-blue)' }}>Payment POS Terminal</h2>
            <p className="text-muted mb-0">Record payments, calculate change, apply PWD/Senior discounts, and issue guest receipts.</p>
          </div>
        </div>

        <div className="row g-4 flex-grow-1 overflow-hidden" style={{ minHeight: 0, paddingBottom: '15px' }}>
          {/* Left Payment form */}
          <div className="col-lg-6">
            <div className="card shadow-sm border-0 bg-white" style={{ borderRadius: '8px' }}>
              <div className="card-header bg-white border-0 py-3 border-bottom">
                <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.95rem' }}>Payment Terminal</h5>
              </div>
              <form onSubmit={handleProcessPayment}>
                <div className="card-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Select Checked-In Guest *</label>
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



                  <div className="mb-3">
                    <label className="form-label fw-semibold">Payment Method *</label>
                    <select
                      className="form-select"
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
                    <div className="mb-4">
                      <label className="form-label fw-semibold">Cash Received *</label>
                      <div className="input-group">
                        <span className="input-group-text">₱</span>
                        <input
                          type="number"
                          className="form-control form-control-lg"
                          name="cashReceived"
                          min="0"
                          step="0.01"
                          required={paymentForm.paymentMethodID === '1'}
                          placeholder="0.00"
                          value={paymentForm.cashReceived}
                          onChange={handleInputChange}
                          style={{ borderRadius: '0 6px 6px 0' }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="alert alert-info py-2 mb-4" style={{ fontSize: '0.85rem' }}>
                    ℹ Guest checkout and room release will occur automatically upon payment.
                  </div>

                  <button
                    type="submit"
                    className="btn btn-pcc-primary text-white w-100 py-3 fw-bold"
                    style={{ fontSize: '1.05rem' }}
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
                        <span>Senior/PWD Discounts:</span>
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
                    <span style={{ fontSize: '2.5rem' }}>🧾</span>
                    <p className="small mt-2 mb-0">Select an active check-in guest to preview POS checkout calculations.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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
