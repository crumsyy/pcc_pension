'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';
import SearchableSelect from '../../components/SearchableSelect';
import { formatCurrency } from '@/lib/formatters';

export default function ReceptionistBilling() {
  const [activeBookings, setActiveBookings] = useState([]);
  const [selectedBookingID, setSelectedBookingID] = useState('');
  const [billDetails, setBillDetails] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingBill, setLoadingBill] = useState(false);
  const [isEditingDiscounts, setIsEditingDiscounts] = useState(false);
  const [guestDiscountsForm, setGuestDiscountsForm] = useState([]);

  const [isAddingIncidental, setIsAddingIncidental] = useState(false);
  const [submittingIncidental, setSubmittingIncidental] = useState(false);
  const [deletingIncidentalId, setDeletingIncidentalId] = useState(null);
  const [incidentalForm, setIncidentalForm] = useState({ description: '', amount: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const [isReportingDamage, setIsReportingDamage] = useState(false);
  const [selectedBorrowItem, setSelectedBorrowItem] = useState(null);
  const [damageForm, setDamageForm] = useState({ status: 'Lost', amount: '', remarks: '' });

  // Settle Bill / Record Payment State
  const [isSettlingBill, setIsSettlingBill] = useState(false);
  const [finalizingBill, setFinalizingBill] = useState(false);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [settleForm, setSettleForm] = useState({
    paymentMethodID: '1',
    amount: '',
    cashReceived: '',
    referenceNumber: '',
    finalizeBill: false
  });
  const [paymentMethods, setPaymentMethods] = useState([]);

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

  const showAlert = (type, title, message, onOk = null) => {
    setModalConfig({
      isOpen: true,
      type,
      title,
      message,
      confirmText: 'OK',
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        if (onOk) onOk();
      },
      onCancel: null
    });
  };

  const showConfirm = (title, message, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning') => {
    setModalConfig({
      isOpen: true,
      type,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        if (onConfirm) onConfirm();
      },
      onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const fetchActiveBookings = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/receptionist/payments');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch active bookings');
      
      // Load full stays list with settled and active statuses
      setActiveBookings(data.allBillingStays || data.activeBookings || []);
      if (data.paymentMethods) {
        setPaymentMethods(data.paymentMethods);
      }
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoadingList(false);
    }
  };

  const openRecordPaymentModal = () => {
    if (!billDetails) return;
    const bal = parseFloat(billDetails.chargesSummary?.balance || 0);
    setSettleForm({
      paymentMethodID: '1',
      amount: bal > 0 ? bal.toFixed(2) : '0.00',
      cashReceived: bal > 0 ? bal.toFixed(2) : '0.00',
      referenceNumber: '',
      finalizeBill: false
    });
    setIsSettlingBill(true);
  };
  const openSettleBillModal = openRecordPaymentModal;

  const handleFinalizeBill = () => {
    if (!billDetails || !selectedBookingID) return;
    showConfirm(
      'Finalize Folio',
      'Finalize folio and allow guest payment? This will lock the itemized charges and allow the guest to pay their remaining balance online via the guest portal.',
      async () => {
        setFinalizingBill(true);
        try {
          const res = await fetch('/api/receptionist/billing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'finalize_bill',
              bookingID: selectedBookingID
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to finalize bill');

          showAlert(
            'success',
            'Bill Finalized',
            'The bill has been successfully finalized. Payment is now unlocked and available on both the Guest Portal and Front Desk Counter.',
            () => {
              fetchActiveBookings();
              fetchBillingDetails(selectedBookingID);
            }
          );
        } catch (err) {
          showAlert('error', 'Error', err.message);
        } finally {
          setFinalizingBill(false);
        }
      },
      'Finalize & Unlock Payment',
      'Cancel',
      'warning'
    );
  };

  const handleSettleBillSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!billDetails || !selectedBookingID) return;

    const bal = parseFloat(billDetails.chargesSummary?.balance || 0);
    const amountToPay = parseFloat(settleForm.amount || bal);
    const cash = parseFloat(settleForm.cashReceived || 0);
    const methodID = parseInt(settleForm.paymentMethodID);

    if (amountToPay > 0 && methodID === 1 && cash < amountToPay) {
      showAlert('warning', 'Insufficient Cash', `Cash received (₱${cash.toFixed(2)}) is less than amount to pay (₱${amountToPay.toFixed(2)}).`);
      return;
    }

    const change = Math.max(0, cash - amountToPay);

    try {
      const res = await fetch('/api/receptionist/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingID: selectedBookingID,
          guestID: billDetails.booking.guestID,
          amount: amountToPay,
          cashReceived: methodID === 1 ? cash : amountToPay,
          change: methodID === 1 ? change : 0,
          paymentMethodID: methodID,
          referenceNumber: settleForm.referenceNumber || (methodID === 2 ? `GCASH-${selectedBookingID}` : `CASH-${Date.now().toString().slice(-6)}`),
          shouldCheckout: false
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record counter payment');

      showAlert('success', 'Payment Recorded', `Payment of ₱${amountToPay.toFixed(2)} recorded successfully.${methodID === 1 && change > 0 ? ` Change: ₱${change.toFixed(2)}.` : ''}`);
      setIsSettlingBill(false);
      fetchActiveBookings();
      fetchBillingDetails(selectedBookingID);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    }
  };

  const handleFinalizeBillOnly = async () => {
    if (!billDetails || !selectedBookingID) return;
    try {
      const res = await fetch('/api/receptionist/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'finalize_bill',
          bookingID: selectedBookingID,
          incidentals: []
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to finalize bill');

      showAlert('success', 'Bill Finalized', 'Bill has been finalized. Guest has been notified.');
      fetchActiveBookings();
      fetchBillingDetails(selectedBookingID);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    }
  };

  const fetchBillingDetails = async (bookingID) => {
    if (!bookingID) {
      setBillDetails(null);
      return;
    }
    setLoadingBill(true);
    try {
      const res = await fetch(`/api/receptionist/billing?bookingID=${bookingID}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch billing calculations');
      setBillDetails(data);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoadingBill(false);
    }
  };

  const [discountBeneficiaries, setDiscountBeneficiaries] = useState([]);

  const openEditDiscountsModal = () => {
    if (!billDetails) return;
    const existing = (billDetails.guestsList || []).filter(g => g.discountID || g.promotionID);
    if (existing.length > 0) {
      setDiscountBeneficiaries(existing.map(g => ({
        discountID: g.discountID ? `disc-${g.discountID}` : (g.promotionID ? `promo-${g.promotionID}` : ''),
        beneficiaryName: g.fullName || '',
        discountIdNumber: g.discountIdNumber || ''
      })));
    } else {
      setDiscountBeneficiaries([{
        discountID: '',
        beneficiaryName: `${billDetails.booking.firstName} ${billDetails.booking.lastName}`,
        discountIdNumber: ''
      }]);
    }
    setIsEditingDiscounts(true);
  };

  const handleAddBeneficiaryRow = () => {
    const maxPax = billDetails?.chargesSummary?.totalGuests || 1;
    if (discountBeneficiaries.length >= maxPax) {
      showAlert('warning', 'Limit Reached', `Cannot add more discounts than total stay guests (${maxPax} Pax).`);
      return;
    }
    setDiscountBeneficiaries(prev => [
      ...prev,
      { discountID: prev[0]?.discountID || '', beneficiaryName: '', discountIdNumber: '' }
    ]);
  };

  const handleRemoveBeneficiaryRow = (index) => {
    setDiscountBeneficiaries(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateBeneficiaryField = (index, field, value) => {
    setDiscountBeneficiaries(prev => {
      const copy = [...prev];
      const sanitized = field === 'discountIdNumber' ? value.replace(/\D/g, '') : value;
      copy[index] = { ...copy[index], [field]: sanitized };
      return copy;
    });
  };

  const handleSaveDiscountsSubmit = async (e) => {
    e.preventDefault();
    if (discountBeneficiaries.length === 0) {
      showAlert('warning', 'No Discounts', 'Please add at least one discount beneficiary or click Remove All.');
      return;
    }

    for (let i = 0; i < discountBeneficiaries.length; i++) {
      const b = discountBeneficiaries[i];
      if (!b.discountID) {
        showAlert('warning', 'Selection Required', `Beneficiary #${i + 1}: Please select a discount type.`);
        return;
      }
      if (!b.beneficiaryName.trim()) {
        showAlert('warning', 'Validation Error', `Beneficiary #${i + 1}: Full name is required.`);
        return;
      }
      if (!b.discountIdNumber.trim()) {
        showAlert('warning', 'Validation Error', `Beneficiary #${i + 1} (${b.beneficiaryName}): ID card number is required.`);
        return;
      }
    }

    setApplyingDiscount(true);
    try {
      const res = await fetch('/api/receptionist/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_manual_discounts',
          bookingID: selectedBookingID,
          discounts: discountBeneficiaries
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply discounts');

      showAlert('success', 'Discounts Applied', data.message || 'Discounts applied to billing statement successfully.');
      setIsEditingDiscounts(false);
      fetchBillingDetails(selectedBookingID);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setApplyingDiscount(false);
    }
  };

  const handleRemoveDiscountSubmit = async () => {
    showConfirm('Remove All Discounts', 'Are you sure you want to remove all applied discounts from this bill?', async () => {
      try {
        const res = await fetch('/api/receptionist/billing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'remove_discounts',
            bookingID: selectedBookingID
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to remove discounts');

        showAlert('success', 'Success', 'All discounts removed from billing.');
        setIsEditingDiscounts(false);
        fetchBillingDetails(selectedBookingID);
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleDeleteIncidentalSubmit = async (chargeID) => {
    showConfirm('Delete Incidental Charge', 'Are you sure you want to remove this charge?', async () => {
      setDeletingIncidentalId(chargeID);
      try {
        const res = await fetch('/api/receptionist/billing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_incidental',
            chargeID,
            bookingID: selectedBookingID
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete incidental charge');

        showAlert('success', 'Incidental Deleted', 'Incidental charge deleted.');
        await fetchBillingDetails(selectedBookingID);
      } catch (err) {
        showAlert('error', 'Error', err.message);
      } finally {
        setDeletingIncidentalId(null);
      }
    });
  };

  const handleCompleteBooking = async () => {
    const remainingBalance = parseFloat(billDetails?.chargesSummary?.remainingBalance ?? billDetails?.chargesSummary?.balance ?? 0);
    if (remainingBalance > 0.05) {
      showAlert('error', 'Action Blocked', `Cannot complete booking with an outstanding balance of ₱${remainingBalance.toFixed(2)}. Please settle the bill first.`);
      return;
    }
    showConfirm('Complete Booking', 'Are you sure you want to complete this booking? The guest will be checked out, the room released to Available status, and the folio finalized.', async () => {
      setCheckingOut(true);
      try {
        const res = await fetch('/api/receptionist/billing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete_booking',
            bookingID: selectedBookingID
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to complete booking');

        showAlert('success', 'Booking Completed', 'The booking has been successfully completed, the folio finalized, and the room is now Available.');
        fetchActiveBookings();
        fetchBillingDetails(selectedBookingID);
      } catch (err) {
        showAlert('error', 'Error', err.message);
      } finally {
        setCheckingOut(false);
      }
    });
  };
  const handleCheckOutGuest = handleCompleteBooking;

  const handleAddIncidentalSubmit = async (e) => {
    e.preventDefault();
    if (submittingIncidental) return;
    setSubmittingIncidental(true);
    try {
      const res = await fetch('/api/receptionist/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_incidental',
          bookingID: selectedBookingID,
          description: incidentalForm.description,
          amount: parseFloat(incidentalForm.amount)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add incidental charge');

      setIsAddingIncidental(false);
      setIncidentalForm({ description: '', amount: '' });
      showAlert('success', 'Incidental Added', 'Incidental charge added successfully.');
      await fetchBillingDetails(selectedBookingID);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setSubmittingIncidental(false);
    }
  };

  const handleReturnBorrowedItem = async (item) => {
    showConfirm('Return Borrowed Item', `Mark ${item.itemName} (Qty: ${item.quantity}) as returned in good condition?`, async () => {
      try {
        const res = await fetch('/api/receptionist/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'return_borrow',
            borrowID: item.borrowID,
            quantityReturned: item.quantity,
            status: 'Returned',
            remarks: 'Returned in good condition'
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to return borrowed item');

        showAlert('success', 'Success', 'Borrowed item returned successfully.');
        fetchBillingDetails(selectedBookingID);
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const openReportDamageModal = (item) => {
    setSelectedBorrowItem(item);
    setDamageForm({ status: 'Lost', amount: '', remarks: '' });
    setIsReportingDamage(true);
  };

  const handleReportDamageSubmit = async (e) => {
    e.preventDefault();
    try {
      const resOrder = await fetch('/api/receptionist/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'return_borrow',
          borrowID: selectedBorrowItem.borrowID,
          quantityReturned: selectedBorrowItem.quantity,
          status: damageForm.status,
          remarks: damageForm.remarks || `Reported as ${damageForm.status}`
        })
      });
      const dataOrder = await resOrder.json();
      if (!resOrder.ok) throw new Error(dataOrder.error || 'Failed to update borrow transaction');

      const fee = parseFloat(damageForm.amount || 0);
      if (fee > 0) {
        const resBill = await fetch('/api/receptionist/billing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_incidental',
            bookingID: selectedBookingID,
            description: `${damageForm.status} Room Item: ${selectedBorrowItem.itemName} (${damageForm.remarks || 'No remarks'})`,
            amount: fee
          })
        });
        const dataBill = await resBill.json();
        if (!resBill.ok) throw new Error(dataBill.error || 'Failed to add fee to billing');
      }

      showAlert('success', 'Success', `Item marked as ${damageForm.status} successfully.${fee > 0 ? ' Damage fee charged to guest.' : ''}`);
      setIsReportingDamage(false);
      fetchBillingDetails(selectedBookingID);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    }
  };

  useEffect(() => {
    fetchActiveBookings();
    const params = new URLSearchParams(window.location.search);
    const bID = params.get('bookingID');
    if (bID) {
      setSelectedBookingID(bID);
      fetchBillingDetails(bID);
    }
  }, []);

  const handleBookingChange = (e) => {
    const bID = e.target.value;
    setSelectedBookingID(bID);
    fetchBillingDetails(bID);
  };

  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'completed'

  const ACTIVE_STATUS_LIST = [
    'Active Stay',
    'Checked In',
    'Checked-In',
    'Pending Room Verification',
    'Pending Checkout',
    'Checkout Requested',
    'Room Verified',
    'Bill Finalized',
    'Final Billing Updated',
    'Payment Completed',
    'Paid'
  ];

  const filteredBookings = activeBookings.filter(b => {
    const fullName = `${b.firstName} ${b.lastName}`.toLowerCase();
    const room = String(b.roomNumber).toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = fullName.includes(query) || room.includes(query);
    if (!matchesSearch) return false;

    if (statusFilter === 'active') {
      return ACTIVE_STATUS_LIST.includes(b.status);
    } else if (statusFilter === 'completed') {
      return b.status === 'Completed' || b.status === 'Checked Out';
    }
    return true; // 'all'
  });

  const allCount = activeBookings.length;
  const activeCount = activeBookings.filter(b => ACTIVE_STATUS_LIST.includes(b.status)).length;
  const completedCount = activeBookings.filter(b => b.status === 'Completed' || b.status === 'Checked Out').length;

  return (
    <>
      <div className="container-fluid py-3 d-flex flex-column" style={{ backgroundColor: '#f8f9fa', height: 'calc(100vh - 150px)', overflow: 'hidden' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h2 className="fw-bold mb-1 text-pcc-blue" style={{ color: 'var(--pcc-blue)' }}>Guest Billing</h2>
            <p className="text-muted mb-0">Select an active stay to review statement details, damage reports, and outstanding balances.</p>
          </div>
        </div>

        {/* Search Bar & Status Filter Card */}
        <div className="card shadow-sm border-0 mb-3" style={{ borderRadius: '8px' }}>
          <div className="card-body py-3">
            <div className="row align-items-center g-2">
              <div className="col-md-6">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search guest name or room number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ borderRadius: '20px' }}
                />
              </div>
              <div className="col-md-6 text-md-end">
                <div className="btn-group btn-group-sm" role="group">
                  <button
                    type="button"
                    className={`btn fw-semibold ${statusFilter === 'all' ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    All Stays ({allCount})
                  </button>
                  <button
                    type="button"
                    className={`btn fw-semibold ${statusFilter === 'active' ? 'btn-info text-white' : 'btn-outline-secondary'}`}
                    onClick={() => setStatusFilter('active')}
                  >
                    Active Stays ({activeCount})
                  </button>
                  <button
                    type="button"
                    className={`btn fw-semibold ${statusFilter === 'completed' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                    onClick={() => setStatusFilter('completed')}
                  >
                    Completed Stays ({completedCount})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stays List Table Card */}
        <div className="card shadow-sm border-0 flex-grow-1 d-flex flex-column overflow-hidden mb-3" style={{ borderRadius: '8px', minHeight: 0 }}>
          <div className="card-body p-0 d-flex flex-column flex-grow-1 overflow-hidden">
            <div className="table-responsive flex-grow-1" style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
              <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr className="table-light">
                    <th>Room</th>
                    <th>Guest Name</th>
                    <th>Contact Info</th>
                    <th>Stay Schedule</th>
                    <th>Status</th>
                    <th className="text-end px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingList ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5">
                        <div className="spinner-border text-pcc-primary" role="status">
                          <span className="visually-hidden">Loading stays...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-muted">
                        No stay records found matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((b) => (
                      <tr key={b.bookingID}>
                        <td>
                          <div className="fw-bold text-dark">Room {b.roomNumber}</div>
                          <small className="text-muted">{b.roomType}</small>
                        </td>
                        <td>
                          <div className="fw-semibold text-dark">{b.lastName}, {b.firstName}</div>
                        </td>
                        <td>
                          <small className="text-muted">{b.contact}</small>
                        </td>
                        <td>
                          <small className="text-dark">
                            In: {new Date(b.checkInDateTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                          </small>
                          <br />
                          <small className="text-muted">
                            Out: {new Date(b.checkOutDateTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                          </small>
                        </td>
                        <td>
                          <span className={`badge ${
                            b.status === 'Completed' ? 'bg-success text-white' :
                            b.status === 'Checked In' ? 'bg-primary text-white' :
                            'bg-secondary text-white'
                          }`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="text-end px-4">
                          <div className="actions-wrapper d-flex justify-content-end">
                            <button
                              type="button"
                              className="action-btn action-btn-view"
                              data-bs-toggle="tooltip"
                              data-bs-placement="top"
                              title="View Billing Details"
                              aria-label="View Billing Details"
                              onClick={() => {
                                setSelectedBookingID(b.bookingID);
                                fetchBillingDetails(b.bookingID);
                              }}
                            >
                              <i className="fa-solid fa-eye"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW BILLING MODAL */}
      {selectedBookingID && billDetails && (
        <div className="modal show d-block animate__animated animate__fadeIn" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1050 }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable" style={{ maxWidth: '90%' }}>
            <div className="modal-content border-0 shadow-lg" style={{ height: '85vh', borderRadius: '12px', overflow: 'hidden' }}>
              <div className="modal-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold text-dark m-0" style={{ fontSize: '1.1rem' }}>
                  Billing Details — Room {billDetails.booking.roomNumber} ({billDetails.booking.roomType})
                </h5>
                <button type="button" className="btn-close" onClick={() => { setSelectedBookingID(''); setBillDetails(null); }}></button>
              </div>

              <div className="modal-body p-4 bg-light overflow-auto">
                {loadingBill ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-pcc-primary" role="status">
                      <span className="visually-hidden">Calculating bill details...</span>
                    </div>
                  </div>
                ) : (
                  <div className="row g-4">
                    {/* Statement details */}
                    <div className="col-lg-8">
                      <div className="card shadow-sm border-0 flex-grow-1 d-flex flex-column overflow-hidden bg-white" style={{ borderRadius: '8px' }}>
                        <div className="card-header bg-white border-0 py-2 border-bottom d-flex justify-content-between align-items-center">
                          <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.95rem' }}>Statement of Account</h5>
                          <span className="badge text-white px-3 py-2 rounded" style={{ backgroundColor: 'var(--pcc-blue, #0d6efd)', fontSize: '0.8rem' }}>
                            Room {billDetails.booking.roomNumber}
                          </span>
                        </div>
                        <div className="card-body p-4">
                          {/* Guest and stay details */}
                          <div className="row mb-2 bg-light p-2 rounded g-2" style={{ fontSize: '0.78rem' }}>
                            <div className="col-md-6">
                              <div className="text-muted">Guest Name</div>
                              <div className="fw-bold text-dark">{billDetails.booking.firstName} {billDetails.booking.lastName}</div>
                              <div className="text-muted mt-2">Room / Accommodation</div>
                              <div className="fw-semibold text-dark">
                                Room {billDetails.booking.roomNumber} ({billDetails.booking.roomType})
                              </div>
                              <div className="text-muted mt-2">Contact Info</div>
                              <div>{billDetails.booking.contact} {billDetails.booking.email ? `| ${billDetails.booking.email}` : ''}</div>
                            </div>
                            <div className="col-md-6">
                              <div className="text-muted">Stay Schedule</div>
                              <div className="fw-semibold text-dark">
                                {new Date(billDetails.booking.checkInDateTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                                <br />to<br />
                                {new Date(billDetails.booking.checkOutDateTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                              </div>
                              <div className="mt-1">
                                Total Nights: <strong className="text-dark">{billDetails.booking.nights}</strong>
                              </div>
                            </div>
                          </div>

                          {/* Room rent */}
                          <h6 className="fw-bold text-dark mb-1 border-bottom pb-1" style={{ fontSize: '0.82rem' }}>Room Rent Charges</h6>
                          <div className="table-responsive mb-3">
                            <table className="table table-hover table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                              <thead>
                                <tr className="table-light">
                                  <th>Description</th>
                                  <th>Daily Rate</th>
                                  <th>Nights</th>
                                  <th className="text-end">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>
                                    <div>{billDetails.booking.roomType} (Room {billDetails.booking.roomNumber})</div>
                                    <div className="text-muted small">
                                      {billDetails.chargesSummary.breakfastOption === 'with' ? 'Package: With Breakfast' : 'Package: Room Only'} • {billDetails.chargesSummary.totalGuests} Registered Pax
                                    </div>
                                  </td>
                                  <td>₱{parseFloat(billDetails.booking.rate).toFixed(2)}</td>
                                  <td>{billDetails.booking.nights}</td>
                                  <td className="text-end fw-bold text-dark">₱{parseFloat(billDetails.chargesSummary.originalRoomCharge || billDetails.booking.originalRoomCharge || billDetails.booking.roomCharge).toFixed(2)}</td>
                                </tr>
                                {billDetails.chargesSummary.totalDiscount > 0 && (
                                  <tr className="table-warning small">
                                    <td colSpan="3" className="ps-3 text-warning-dark">
                                      <div>
                                        <strong>Discount Apportionment:</strong>
                                        <ul className="mb-0 mt-1" style={{ listStyleType: 'square' }}>
                                          <li>Total Registered Guests: <strong>{billDetails.chargesSummary.totalGuests} Pax</strong></li>
                                          <li>Individual Guest Share: <strong>₱{parseFloat(billDetails.chargesSummary.sharePerGuest).toFixed(2)}</strong></li>
                                          <li>
                                          Applied Discounts/Promotions: <strong>{billDetails.guestsList.filter(g => g.discountID).length} Guest(s)</strong> (configured discount percentage applied to their individual share)
                                          </li>
                                        </ul>
                                      </div>
                                    </td>
                                    <td className="text-end fw-bold text-success align-bottom">
                                      -₱{parseFloat(billDetails.chargesSummary.totalDiscount).toFixed(2)}
                                    </td>
                                  </tr>
                                )}
                                <tr className="table-light">
                                  <td colSpan="3" className="fw-semibold">Net Room Stay Charges</td>
                                  <td className="text-end fw-bold text-dark">₱{parseFloat(billDetails.chargesSummary.room).toFixed(2)}</td>
                                </tr>
                                {billDetails.chargesSummary.downPaymentPaid > 0 && (
                                  <tr>
                                    <td colSpan="3" className="text-success fw-semibold">
                                      Down Payment Paid ({billDetails.chargesSummary.downPaymentPercentage}% of Room Charges)
                                    </td>
                                    <td className="text-end fw-bold text-success">
                                      -₱{parseFloat(billDetails.chargesSummary.downPaymentPaid).toFixed(2)}
                                    </td>
                                  </tr>
                                )}
                                <tr>
                                  <td colSpan="3" className="fw-bold text-pcc-blue">
                                    Remaining Room Balance
                                  </td>
                                  <td className="text-end fw-bold text-pcc-blue">
                                    ₱{parseFloat(billDetails.chargesSummary.roomBalance || 0).toFixed(2)}
                                  </td>
                                </tr>
                                {billDetails.chargesSummary.extraGuestFee > 0 && (
                                  <tr className="table-secondary-subtle">
                                    <td colSpan="3">
                                      <div className="d-flex align-items-center gap-2">
                                        <span className="fw-semibold">Additional Guest Fee ({billDetails.chargesSummary.extraGuests} Extra Pax × {billDetails.booking.nights} Night{billDetails.booking.nights > 1 ? 's' : ''} @ ₱100/night)</span>
                                        <span className="badge bg-secondary text-white font-monospace" style={{ fontSize: '0.68rem' }}>
                                          Final Billing Only
                                        </span>
                                      </div>
                                    </td>
                                    <td className="text-end fw-bold text-secondary">
                                      +₱{parseFloat(billDetails.chargesSummary.extraGuestFee).toFixed(2)}
                                    </td>
                                  </tr>
                                )}
                                {billDetails.chargesSummary.earlyCheckIn > 0 && (
                                  <tr>
                                    <td colSpan="3">Early Check-In Fee (₱50/hr before 2:00 PM)</td>
                                    <td className="text-end fw-semibold text-danger">₱{parseFloat(billDetails.chargesSummary.earlyCheckIn).toFixed(2)}</td>
                                  </tr>
                                )}
                                {billDetails.chargesSummary.lateCheckOut > 0 && (
                                  <tr>
                                    <td colSpan="3">
                                      <div className="d-flex align-items-center gap-2 mb-0.5">
                                        <span>Late Check-Out / Extension Fee ({billDetails.chargesSummary.lateHours || 1} hr{billDetails.chargesSummary.lateHours > 1 ? 's' : ''})</span>
                                        <span className="badge bg-warning text-dark font-monospace" style={{ fontSize: '0.68rem' }}>
                                          {billDetails.chargesSummary.lateCheckOutRule || '1-22 hrs: ₱100/hr | >22 hrs: Full room rate'}
                                        </span>
                                      </div>
                                      <div className="text-muted small" style={{ fontSize: '0.70rem' }}>
                                        * Policy: ₱100.00/hour for extensions up to 22 hours; exceeding 22 hours converts to standard daily room rate (₱{parseFloat(billDetails.booking.rate).toFixed(2)}).
                                      </div>
                                    </td>
                                    <td className="text-end fw-semibold text-danger">₱{parseFloat(billDetails.chargesSummary.lateCheckOut).toFixed(2)}</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Room Occupancy & Capacity Summary (Replaces legacy registered guests list) */}
                          <div className="mb-3 bg-light p-3 rounded-3 border animate__animated animate__fadeIn" style={{ fontSize: '0.80rem' }}>
                            <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                              <div className="d-flex align-items-center gap-2">
                                <i className="bi bi-people-fill text-primary fs-6"></i>
                                <span className="fw-bold text-dark">Stay Occupancy &amp; Capacity</span>
                              </div>
                              <button
                                type="button"
                                className="btn btn-sm btn-pcc-primary text-white"
                                style={{ fontSize: '0.74rem', padding: '4px 12px', borderRadius: '15px' }}
                                onClick={openEditDiscountsModal}
                              >
                                <i className="fa-solid fa-percent me-1"></i> Apply / Edit Discounts
                              </button>
                            </div>

                            <div className="row g-2 text-dark">
                              <div className="col-sm-6 col-md-4">
                                <div className="p-2 bg-white rounded border h-100">
                                  <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Number of Guests:</span>
                                  <span className="fw-bold fs-6 text-primary">{billDetails.chargesSummary.totalGuests} Pax</span>
                                  <span className="text-muted small ms-1">(from booking)</span>
                                </div>
                              </div>
                              <div className="col-sm-6 col-md-4">
                                <div className="p-2 bg-white rounded border h-100">
                                  <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Room Standard Capacity:</span>
                                  <span className="fw-bold fs-6 text-dark">{billDetails.booking.occupancyLimit || billDetails.booking.roomBasePax || 4} Pax Max</span>
                                </div>
                              </div>
                              <div className="col-sm-12 col-md-4">
                                <div className="p-2 bg-white rounded border h-100">
                                  <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Capacity Status:</span>
                                  {billDetails.chargesSummary.extraGuests > 0 ? (
                                    <span className="badge bg-warning-subtle text-warning-emphasis border border-warning fw-semibold" style={{ fontSize: '0.73rem' }}>
                                      +{billDetails.chargesSummary.extraGuests} Extra Pax (+₱{parseFloat(billDetails.chargesSummary.extraGuestFee).toFixed(2)})
                                    </span>
                                  ) : (
                                    <span className="badge bg-success-subtle text-success border border-success fw-semibold" style={{ fontSize: '0.73rem' }}>
                                      ✓ Within Standard Capacity
                                    </span>
                                  )}
                                </div>
                              </div>
                              {billDetails.chargesSummary.breakfastOption === 'with' && (() => {
                                const complimentaryBreakfastUsed = billDetails?.chargesBreakdown?.breakfastSummary?.complimentaryBreakfastUsed ?? billDetails?.chargesSummary?.complimentaryBreakfastUsed ?? billDetails?.complimentaryBreakfastUsed ?? 0;
                                const stayComplimentaryAllowance = billDetails?.chargesBreakdown?.breakfastSummary?.stayComplimentaryAllowance ?? billDetails?.chargesSummary?.stayComplimentaryAllowance ?? (2 * (billDetails?.booking?.nights || 1));
                                return (
                                  <div className="col-12 mt-1">
                                    <div className="p-2 bg-white rounded border d-flex justify-content-between align-items-center">
                                      <div className="d-flex align-items-center gap-2">
                                        <i className="bi bi-cup-hot-fill text-success fs-6"></i>
                                        <div>
                                          <span className="fw-bold text-success" style={{ fontSize: '0.74rem' }}>Complimentary Breakfast Package:</span>
                                          <span className="text-muted ms-1" style={{ fontSize: '0.70rem' }}>Up to 2 complimentary meals/day (Stay allowance: {stayComplimentaryAllowance} meals)</span>
                                        </div>
                                      </div>
                                      <span className="badge bg-success text-white font-monospace" style={{ fontSize: '0.72rem' }}>
                                        {complimentaryBreakfastUsed} / {stayComplimentaryAllowance} Claimed
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Applied Discounts breakdown if any */}
                            {((billDetails.guestsList || []).filter(g => g.discountID || g.promotionID)).length > 0 ? (
                              <div className="mt-2.5 pt-2 border-top">
                                <div className="fw-semibold text-success mb-1" style={{ fontSize: '0.76rem' }}>
                                  <i className="bi bi-tag-fill me-1"></i>Applied Discounts ({((billDetails.guestsList || []).filter(g => g.discountID || g.promotionID)).length} Beneficiar{((billDetails.guestsList || []).filter(g => g.discountID || g.promotionID)).length > 1 ? 'ies' : 'y'} — Total Savings: -₱{parseFloat(billDetails.chargesSummary.totalDiscount).toFixed(2)}):
                                </div>
                                <div className="d-flex flex-wrap gap-2">
                                  {(billDetails.guestsList || []).filter(g => g.discountID || g.promotionID).map((b, idx) => (
                                    <div key={idx} className="badge bg-white text-dark border p-2 text-start font-monospace shadow-sm" style={{ fontSize: '0.74rem', fontWeight: 'normal' }}>
                                      <strong className="text-primary">{b.fullName}</strong> — {b.discountName} ({b.discountIdNumber})
                                      <span className="text-success fw-bold ms-1">-₱{parseFloat(b.discount || 0).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 text-muted small" style={{ fontSize: '0.73rem' }}>
                                No senior citizen or PWD discounts currently applied. Click &quot;Apply / Edit Discounts&quot; to add qualifying beneficiaries.
                              </div>
                            )}
                          </div>

                          {/* Consolidated Orders & Room Service */}
                          <div className="d-flex justify-content-between align-items-center mb-2 border-bottom pb-1">
                            <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-1.5" style={{ fontSize: '0.84rem' }}>
                              <i className="bi bi-cart-check-fill text-pcc-primary"></i>
                              <span>Orders &amp; Room Service</span>
                            </h6>
                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle fw-bold" style={{ fontSize: '0.74rem' }}>
                              Total: ₱{parseFloat(billDetails.ordersSummary?.totalAmount ?? billDetails.chargesSummary?.orders ?? 0).toFixed(2)}
                            </span>
                          </div>

                          {(!billDetails.ordersSummary?.orders || billDetails.ordersSummary.orders.length === 0) && (!billDetails.productCharges || billDetails.productCharges.length === 0) && (!billDetails.amenityCharges || billDetails.amenityCharges.length === 0) ? (
                            <div className="p-3 text-center text-muted small bg-light rounded border mb-3">
                              No room service or product orders recorded for this stay.
                            </div>
                          ) : (
                            <div className="d-flex flex-column gap-2 mb-3">
                              {(billDetails.ordersSummary?.orders && billDetails.ordersSummary.orders.length > 0) ? (
                                billDetails.ordersSummary.orders.map((ord) => (
                                  <div key={ord.orderID} className="border rounded bg-white overflow-hidden shadow-xs">
                                    <div className="bg-light px-3 py-1.5 border-bottom d-flex justify-content-between align-items-center small">
                                      <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <span className="fw-bold text-dark">Order #{ord.orderID}</span>
                                        {ord.deliveryType === 'scheduled' || ord.deliveryTime ? (
                                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: '0.68rem' }}>
                                            Scheduled: {ord.deliveryDate} ({ord.deliveryTime || 'Breakfast'})
                                          </span>
                                        ) : (
                                          <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle" style={{ fontSize: '0.68rem' }}>
                                            Immediate Fulfillment
                                          </span>
                                        )}
                                        <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle" style={{ fontSize: '0.68rem' }}>
                                          {ord.orderStatus || 'Recorded'}
                                        </span>
                                      </div>
                                      <span className="fw-bold text-dark">
                                        ₱{parseFloat(ord.totalAmount || 0).toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="table-responsive">
                                      <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.76rem' }}>
                                        <thead>
                                          <tr className="text-secondary bg-white">
                                            <th className="ps-3">Item Description</th>
                                            <th className="text-center" style={{ width: '60px' }}>Qty</th>
                                            <th className="text-end" style={{ width: '90px' }}>Unit Price</th>
                                            <th className="text-end pe-3" style={{ width: '100px' }}>Subtotal</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(ord.items || []).map((it, itIdx) => {
                                            const isComp = Boolean(it.isComplimentary || it.isFreeBreakfast || parseFloat(it.price || it.unitPrice || 0) === 0);
                                            return (
                                              <tr key={itIdx}>
                                                <td className="ps-3">
                                                  <div className="fw-semibold text-dark">{it.name}</div>
                                                  {isComp && (
                                                    <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '0.65rem' }}>
                                                      Complimentary Breakfast (₱0.00)
                                                    </span>
                                                  )}
                                                  {it.notes && (
                                                    <div className="text-muted" style={{ fontSize: '0.70rem' }}>{it.notes}</div>
                                                  )}
                                                </td>
                                                <td className="text-center">{it.quantity}</td>
                                                <td className="text-end text-muted">
                                                  {isComp ? '₱0.00' : `₱${parseFloat(it.price || it.unitPrice || 0).toFixed(2)}`}
                                                </td>
                                                <td className="text-end pe-3 fw-bold">
                                                  {isComp ? (
                                                    <span className="text-success">₱0.00</span>
                                                  ) : (
                                                    `₱${parseFloat(it.subtotal || 0).toFixed(2)}`
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="table-responsive mb-2">
                                  <table className="table table-hover table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                                    <thead>
                                      <tr className="table-light">
                                        <th>Item Name</th>
                                        <th>Unit Price</th>
                                        <th>Qty</th>
                                        <th className="text-end">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[...(billDetails.productCharges || []), ...(billDetails.amenityCharges || [])].map((item, idx) => (
                                        <tr key={idx}>
                                          <td>{item.name}</td>
                                          <td>₱{parseFloat(item.price || 0).toFixed(2)}</td>
                                          <td>{item.quantity}</td>
                                          <td className="text-end fw-bold text-dark">₱{parseFloat(item.subtotal || 0).toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Non-Consumable Amenities Checkout Inspection */}
                          <h6 className="fw-bold text-dark mb-1 border-bottom pb-1 mt-3" style={{ fontSize: '0.82rem' }}>
                            Room Check-Out Inspection — Ordered Non-Consumable Amenities
                          </h6>
                          <p className="text-muted mb-2" style={{ fontSize: '0.75rem' }}>
                            Check items returned in good condition. Uncheck any item that is missing or damaged to automatically add replacement charges to the bill.
                          </p>
                          <div className="p-3 border rounded bg-white mb-3">
                            {(!billDetails.nonConsumableAmenities || billDetails.nonConsumableAmenities.length === 0) ? (
                              <div className="text-muted small text-center py-2">No ordered non-consumable amenities recorded for this stay.</div>
                            ) : (
                              <div className="row g-3">
                                {billDetails.nonConsumableAmenities.map((amenity) => (
                                  <div key={amenity.amenityID} className="col-md-6">
                                    <div 
                                      className={`p-2.5 border rounded ${amenity.isReturned ? 'bg-light' : 'bg-danger-subtle border-danger'}`}
                                    >
                                      <div className="d-flex align-items-center justify-content-between mb-1">
                                        <div className="form-check m-0 d-flex align-items-center">
                                          <input
                                            className="form-check-input mt-0"
                                            type="checkbox"
                                            id={`amenity-check-${amenity.amenityID}`}
                                            checked={amenity.isReturned}
                                            onChange={async (e) => {
                                              const newIsReturned = e.target.checked;
                                              try {
                                                const res = await fetch('/api/receptionist/billing', {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({
                                                    action: 'toggle_amenity_inspection',
                                                    bookingID: selectedBookingID,
                                                    amenityID: amenity.amenityID,
                                                    isReturned: newIsReturned,
                                                    lostQuantity: amenity.lostQty || 1
                                                  })
                                                });
                                                const data = await res.json();
                                                if (!res.ok) throw new Error(data.error || 'Failed to update amenity status');
                                                fetchBillingDetails(selectedBookingID);
                                              } catch (err) {
                                                alert(err.message);
                                              }
                                            }}
                                            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                          />
                                          <label className="form-check-label fw-bold text-dark ms-2 m-0" htmlFor={`amenity-check-${amenity.amenityID}`} style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                                            {amenity.name} {amenity.orderedQty > 1 ? `(${amenity.orderedQty} ordered)` : ''}
                                          </label>
                                        </div>
                                        <span className={`badge ${amenity.isReturned ? 'bg-success text-white' : 'bg-danger text-white'} px-2 py-1`} style={{ fontSize: '0.72rem' }}>
                                          {amenity.isReturned ? '✓ Returned & Good' : `+₱${parseFloat(amenity.replacementCost).toFixed(2)} Billed`}
                                        </span>
                                      </div>

                                      {!amenity.isReturned && (
                                        <div className="d-flex align-items-center gap-2 mt-2 pt-2 border-top border-danger-subtle">
                                          <label className="small text-danger fw-bold mb-0" style={{ fontSize: '0.74rem' }}>
                                            Lost/Damaged Qty:
                                          </label>
                                          <input
                                            type="number"
                                            className="form-control form-control-sm text-center font-weight-bold"
                                            style={{ width: '65px', height: '26px', fontSize: '0.8rem' }}
                                            min="1"
                                            max={amenity.orderedQty || 99}
                                            value={amenity.lostQty || 1}
                                            onChange={async (e) => {
                                              const newLostQty = parseInt(e.target.value) || 1;
                                              try {
                                                const res = await fetch('/api/receptionist/billing', {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({
                                                    action: 'toggle_amenity_inspection',
                                                    bookingID: selectedBookingID,
                                                    amenityID: amenity.amenityID,
                                                    isReturned: false,
                                                    lostQuantity: newLostQty
                                                  })
                                                });
                                                const data = await res.json();
                                                if (!res.ok) throw new Error(data.error || 'Failed to update lost quantity');
                                                fetchBillingDetails(selectedBookingID);
                                              } catch (err) {
                                                alert(err.message);
                                              }
                                            }}
                                          />
                                          <span className="small text-muted ms-auto" style={{ fontSize: '0.72rem' }}>
                                            @ ₱{parseFloat(amenity.unitCost).toFixed(2)} ea
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Incidental Charges */}
                          <div className="d-flex justify-content-between align-items-center mb-1 mt-3 border-bottom pb-1">
                            <h6 className="fw-bold text-dark mb-0" style={{ fontSize: '0.82rem' }}>Incidental & Damage Charges</h6>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger text-white"
                              style={{ fontSize: '0.72rem', padding: '3px 10px' }}
                              onClick={() => {
                                setIncidentalForm({ description: '', amount: '' });
                                setIsAddingIncidental(true);
                              }}
                            >
                              + Add Incidental Charge
                            </button>
                          </div>
                          <div className="table-responsive mb-2">
                            <table className="table table-hover table-sm mb-0" style={{ fontSize: '0.78rem' }}>
                              <thead>
                                <tr className="table-light">
                                  <th>Description</th>
                                  <th>Date Added</th>
                                  <th className="text-end">Amount</th>
                                  <th className="text-end">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {billDetails.incidentalCharges.length === 0 ? (
                                  <tr>
                                    <td colSpan="4" className="text-center py-3 text-muted small">No incidental/damage fees charged.</td>
                                  </tr>
                                ) : (
                                  billDetails.incidentalCharges.map((item, idx) => (
                                    <tr key={idx}>
                                      <td>{item.description}</td>
                                      <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                                      <td className="text-end fw-bold text-danger">₱{parseFloat(item.amount).toFixed(2)}</td>
                                      <td className="text-end">
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-danger text-white d-inline-flex align-items-center justify-content-center"
                                          style={{ width: '28px', height: '28px' }}
                                          title="Delete Incidental"
                                          disabled={deletingIncidentalId === item.chargeID}
                                          onClick={() => handleDeleteIncidentalSubmit(item.chargeID)}
                                        >
                                          {deletingIncidentalId === item.chargeID ? (
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '12px', height: '12px' }}></span>
                                          ) : (
                                            <i className="fa-solid fa-trash"></i>
                                          )}
                                        </button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Borrowed Amenities & Room Items check */}
                          {billDetails.borrowedItems && billDetails.borrowedItems.length > 0 && (
                            <div className="mt-3">
                              <h6 className="fw-bold text-dark mb-1 border-bottom pb-1" style={{ fontSize: '0.82rem' }}>Borrowed Room Items &amp; Amenities</h6>
                              <div className="table-responsive">
                                <table className="table table-hover table-sm align-middle mb-0" style={{ fontSize: '0.78rem' }}>
                                  <thead className="table-light">
                                    <tr>
                                      <th>Item Name</th>
                                      <th>Qty</th>
                                      <th>Date Borrowed</th>
                                      <th>Status</th>
                                      <th className="text-end">Report Issue</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {billDetails.borrowedItems.map((item, idx) => (
                                      <tr key={idx}>
                                        <td><strong>{item.itemName}</strong></td>
                                        <td>{item.quantity}</td>
                                        <td>{new Date(item.borrowDateTime).toLocaleDateString()}</td>
                                        <td>
                                          <span className={`badge ${item.status === 'Borrowed' ? 'bg-warning text-dark' : 'bg-secondary text-white'}`}>
                                            {item.status}
                                          </span>
                                        </td>
                                        <td className="text-end">
                                          {item.status === 'Borrowed' && (
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-danger text-white"
                                              onClick={() => openReportDamageModal(item)}
                                            >
                                              Report Lost/Damaged
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bill Summary Panel */}
                    <div className="col-lg-4">
                      <div className="card shadow-sm border-0 bg-white" style={{ borderRadius: '8px' }}>
                        <div className="card-header bg-white border-0 py-2 border-bottom">
                          <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.95rem' }}>Payment Summary</h5>
                        </div>
                        <div className="card-body p-4" style={{ fontSize: '0.78rem' }}>
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Room Base Rent ({billDetails.chargesSummary.breakfastOption === 'with' ? 'With Breakfast' : 'Room Only'}):</span>
                            <span className="fw-semibold text-dark">₱{parseFloat(billDetails.chargesSummary.baseRoomCharge || billDetails.chargesSummary.room).toFixed(2)}</span>
                          </div>
                          {billDetails.chargesSummary.totalDiscount > 0 && (
                            <div className="d-flex justify-content-between mb-2 text-success">
                              <span>Room Discounts Applied:</span>
                              <span className="fw-semibold">-₱{parseFloat(billDetails.chargesSummary.totalDiscount).toFixed(2)}</span>
                            </div>
                          )}
                          {billDetails.chargesSummary.downPaymentPaid > 0 && (
                            <div className="d-flex justify-content-between mb-2 text-success">
                              <span>Down Payment Paid ({billDetails.chargesSummary.downPaymentPercentage}%):</span>
                              <span className="fw-semibold">-₱{parseFloat(billDetails.chargesSummary.downPaymentPaid).toFixed(2)}</span>
                            </div>
                          )}
                          <div className="d-flex justify-content-between mb-2 pb-2 border-bottom">
                            <span className="fw-semibold text-dark">Remaining Room Balance:</span>
                            <span className="fw-bold text-dark">₱{parseFloat(billDetails.chargesSummary.roomBalance || 0).toFixed(2)}</span>
                          </div>

                          {billDetails.chargesSummary.extraGuestFee > 0 && (
                            <div className="d-flex justify-content-between mb-2 text-secondary align-items-center">
                              <span>
                                Extra Guests Fee ({billDetails.chargesSummary.extraGuests} Pax @ ₱100/night):
                                <span className="badge bg-secondary-subtle text-secondary ms-1.5" style={{ fontSize: '0.68rem' }}>Final Billing Only</span>
                              </span>
                              <span className="fw-semibold text-dark">+₱{parseFloat(billDetails.chargesSummary.extraGuestFee).toFixed(2)}</span>
                            </div>
                          )}
                          {billDetails.chargesSummary.earlyCheckIn > 0 && (
                            <div className="d-flex justify-content-between mb-2 text-primary">
                              <span>Early Check-in Fee (₱50/hr):</span>
                              <span className="fw-semibold">₱{parseFloat(billDetails.chargesSummary.earlyCheckIn).toFixed(2)}</span>
                            </div>
                          )}
                          {billDetails.chargesSummary.lateCheckOut > 0 && (
                            <div className="d-flex justify-content-between mb-2 text-primary">
                              <span>Late Check-out Fee:</span>
                              <span className="fw-semibold">₱{parseFloat(billDetails.chargesSummary.lateCheckOut).toFixed(2)}</span>
                            </div>
                          )}
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Orders &amp; Room Service:</span>
                            <span className="fw-semibold text-dark">
                              ₱{parseFloat(billDetails.ordersSummary?.totalAmount ?? billDetails.chargesSummary?.orders ?? 0).toFixed(2)}
                            </span>
                          </div>
                          {parseFloat(billDetails.chargesSummary.incidentals || 0) > 0 && (
                            <div className="d-flex justify-content-between mb-3 text-danger">
                              <span>Incidental Charges (Damages/Penalties):</span>
                              <span className="fw-semibold">₱{parseFloat(billDetails.chargesSummary.incidentals).toFixed(2)}</span>
                            </div>
                          )}

                          <hr className="mt-0" />

                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>Subtotal:</span>
                            <span className="fw-bold text-pcc-primary" style={{ fontSize: '1.2rem' }}>
                              ₱{parseFloat(billDetails.chargesSummary.total).toFixed(2)}
                            </span>
                          </div>

                          <div className="d-flex justify-content-between mb-3 text-success">
                            <span className="fw-semibold">Paid Total:</span>
                            <span className="fw-bold">₱{parseFloat(billDetails.chargesSummary.paid).toFixed(2)}</span>
                          </div>

                          <div className="d-flex justify-content-between align-items-center p-3 bg-danger-subtle rounded border border-danger-subtle mb-4">
                            <div>
                              <span className="fw-bold text-danger d-block">Total Balance Due:</span>
                              <span className="text-muted" style={{ fontSize: '0.70rem' }}>Room Bal + Extra Guests + Orders + Fees</span>
                            </div>
                            <span className="fw-bold text-danger" style={{ fontSize: '1.3rem' }}>
                              ₱{parseFloat(billDetails.chargesSummary.balance).toFixed(2)}
                            </span>
                          </div>

                          {(() => {
                            const balance = parseFloat(billDetails.chargesSummary?.balance || 0);
                            const isFinalized = billDetails.chargesBreakdown?.isBillFinalized ||
                                                billDetails.chargesSummary?.isBillFinalized === 1 ||
                                                billDetails.isBillFinalized === 1 ||
                                                billDetails.booking?.status === 'Bill Finalized';
                            const isCheckedOut = ['Checked Out', 'Completed'].includes(billDetails.booking?.status);

                            if (isCheckedOut) {
                              return (
                                <div className="alert alert-secondary text-center py-2.5 mb-0 fw-semibold">
                                  <i className="bi bi-check-circle-fill me-1 text-success"></i> Bill fully settled &amp; Guest Checked Out. Room is Available.
                                </div>
                              );
                            }

                            // If remaining balance > 0.05
                            if (balance > 0.05) {
                              if (!isFinalized) {
                                // Step 1: Finalize Bill & Allow Payment
                                return (
                                  <div className="d-flex flex-column gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-success fw-bold text-white shadow-sm w-100 py-2.5 d-flex align-items-center justify-content-center gap-2"
                                      disabled={finalizingBill}
                                      onClick={handleFinalizeBill}
                                    >
                                      {finalizingBill ? (
                                        <>
                                          <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                          Finalizing Bill...
                                        </>
                                      ) : (
                                        <>
                                          <i className="fa-solid fa-file-invoice-dollar me-1"></i> Finalize Bill &amp; Allow Payment
                                        </>
                                      )}
                                    </button>
                                    <a
                                      href={`/receptionist/payments?bookingID=${selectedBookingID}`}
                                      className="btn btn-outline-secondary w-100 py-2 fw-semibold text-center d-flex align-items-center justify-content-center gap-1 text-decoration-none small"
                                    >
                                      <i className="fa-solid fa-credit-card"></i> Open Payment Terminal
                                    </a>
                                  </div>
                                );
                              } else {
                                // Step 2: Bill Finalized — Awaiting Guest Settlement OR Counter Walk-in Payment
                                return (
                                  <div className="d-flex flex-column gap-2">
                                    <div className="alert alert-warning py-2.5 px-3 small d-flex align-items-center gap-2 mb-0 border-0 bg-warning-subtle text-warning-emphasis rounded-3 fw-semibold">
                                      <i className="bi bi-clock-history fs-5 flex-shrink-0"></i>
                                      <div>
                                        <div className="fw-bold">Bill Finalized — Awaiting Guest Settlement</div>
                                        <div className="small fw-normal text-muted" style={{ fontSize: '0.74rem' }}>
                                          Guest can pay online via their portal, or front desk can record a manual counter payment below.
                                        </div>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      className="btn btn-outline-primary fw-semibold w-100 py-2.5 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                                      onClick={openRecordPaymentModal}
                                    >
                                      <i className="fa-solid fa-cash-register me-1"></i> Record Walk-in Payment
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-secondary text-white w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
                                      disabled
                                      title="Complete Booking will unlock once the balance is ₱0.00"
                                    >
                                      <i className="fa-solid fa-lock me-1"></i> Complete Booking (Balance Due: ₱{balance.toFixed(2)})
                                    </button>
                                  </div>
                                );
                              }
                            }

                            // Balance <= 0.05: Bill fully settled!
                            return (
                              <div className="d-flex flex-column gap-2">
                                <div className="alert alert-success text-center py-2 mb-0 fw-semibold">
                                  ✓ Bill Fully Settled (₱0.00 Balance).
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-success text-white w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                                  disabled={checkingOut}
                                  onClick={handleCompleteBooking}
                                >
                                  {checkingOut ? (
                                    <>
                                      <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                      Completing Booking...
                                    </>
                                  ) : (
                                    <>
                                      <i className="fa-solid fa-check"></i> Complete Booking
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* AUDIT TRAIL CARD */}
                      <div className="card shadow-sm border-0 bg-white mt-3" style={{ borderRadius: '8px' }}>
                        <div className="card-header bg-white border-0 py-2 border-bottom d-flex justify-content-between align-items-center">
                          <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.86rem' }}>
                            <i className="bi bi-clock-history me-1.5 text-primary"></i> Audit Trail (Ledger)
                          </h6>
                          <span className="badge bg-secondary font-monospace" style={{ fontSize: '0.68rem' }}>
                            {billDetails.auditLogs?.length || 0} Events
                          </span>
                        </div>
                        <div className="card-body p-3" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                          {billDetails.auditLogs && billDetails.auditLogs.length > 0 ? (
                            <div className="d-flex flex-column gap-2">
                              {billDetails.auditLogs.map((log) => (
                                <div key={log.auditID} className="p-2.5 rounded border bg-light small" style={{ fontSize: '0.74rem' }}>
                                  <div className="d-flex justify-content-between align-items-center mb-1">
                                    <span className={`badge ${
                                      log.transactionType?.includes('Payment') || log.transactionType?.includes('Settlement') ? 'bg-success' :
                                      log.transactionType?.includes('Discount') ? 'bg-info text-dark' :
                                      log.transactionType?.includes('Incidental') ? 'bg-danger' :
                                      log.transactionType?.includes('Order') ? 'bg-warning text-dark' : 'bg-primary'
                                    }`}>
                                      {log.transactionType}
                                    </span>
                                    <span className="text-muted font-monospace" style={{ fontSize: '0.68rem' }}>{log.createdAt}</span>
                                  </div>
                                  <div className="fw-semibold text-dark">{log.description || 'Transaction record'}</div>
                                  <div className="d-flex justify-content-between align-items-center text-muted mt-1" style={{ fontSize: '0.70rem' }}>
                                    <span>Amount: <strong className="text-dark">₱{parseFloat(log.amount).toFixed(2)}</strong></span>
                                    <span>Bal: ₱{parseFloat(log.balanceBefore).toFixed(2)} → <strong className="text-primary">₱{parseFloat(log.balanceAfter).toFixed(2)}</strong></span>
                                  </div>
                                  {log.userName && (
                                    <div className="text-muted mt-0.5" style={{ fontSize: '0.68rem' }}>
                                      By: {log.userName} ({log.userRole || 'Staff'}) {log.referenceNumber ? `• Ref: ${log.referenceNumber}` : ''}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center text-muted py-3 small">
                              <i className="bi bi-journal-text fs-4 d-block mb-1 opacity-50"></i>
                              No audit events logged yet for this stay.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT DISCOUNTS MODAL */}
      {isEditingDiscounts && billDetails && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">
                  <i className="bi bi-percent me-2"></i>Apply Guest Discounts — Room {billDetails.booking.roomNumber}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setIsEditingDiscounts(false)}></button>
              </div>
              <form onSubmit={handleSaveDiscountsSubmit}>
                <div className="modal-body p-4">
                  <div className="alert alert-info py-2 small mb-3 d-flex align-items-center justify-content-between">
                    <div>
                      <i className="bi bi-info-circle me-1"></i>
                      Discounts (e.g. Senior Citizen, PWD) are calculated per beneficiary&apos;s proportionate share of room charges.
                    </div>
                    <span className="badge bg-primary text-white">
                      Stay Capacity: {billDetails.chargesSummary?.totalGuests || 1} Pax
                    </span>
                  </div>

                  {discountBeneficiaries.map((b, idx) => (
                    <div key={idx} className="card p-3 mb-3 border bg-light">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="badge bg-secondary">Beneficiary #{idx + 1}</span>
                        {discountBeneficiaries.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger py-0 px-2"
                            onClick={() => handleRemoveBeneficiaryRow(idx)}
                          >
                            <i className="bi bi-x-circle me-1"></i>Remove
                          </button>
                        )}
                      </div>
                      <div className="row g-2">
                        <div className="col-md-4">
                          <label className="form-label fw-semibold small mb-1">Discount Type *</label>
                          <select
                            className="form-select form-select-sm fw-bold text-pcc-blue"
                            required
                            value={b.discountID}
                            onChange={(e) => handleUpdateBeneficiaryField(idx, 'discountID', e.target.value)}
                          >
                            <option value="">-- Choose Discount --</option>
                            {billDetails.discounts.map(d => (
                              <option key={d.discountID} value={d.discountID}>
                                {d.name} ({d.percentage}% Off)
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-4">
                          <label className="form-label fw-semibold small mb-1">Beneficiary Full Name *</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            required
                            placeholder="e.g. Juan Dela Cruz"
                            value={b.beneficiaryName}
                            onChange={(e) => handleUpdateBeneficiaryField(idx, 'beneficiaryName', e.target.value)}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label fw-semibold small mb-1">Government / ID No. *</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="form-control form-control-sm"
                            required
                            placeholder="e.g. 12345678 (Numeric Only)"
                            value={b.discountIdNumber}
                            onChange={(e) => handleUpdateBeneficiaryField(idx, 'discountIdNumber', e.target.value.replace(/\D/g, ''))}
                            onKeyDown={(e) => {
                              if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {discountBeneficiaries.length < (billDetails.chargesSummary?.totalGuests || 1) && (
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm w-100 mb-2"
                      style={{ borderStyle: 'dashed' }}
                      onClick={handleAddBeneficiaryRow}
                    >
                      <i className="bi bi-plus-circle me-1"></i>Add Another Senior / PWD Discount (Up to {billDetails.chargesSummary?.totalGuests || 1} Pax)
                    </button>
                  )}
                </div>
                <div className="modal-footer border-top-0 d-flex justify-content-between">
                  {billDetails.guestsList?.some(g => g.discountID || g.promotionID) ? (
                    <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleRemoveDiscountSubmit}>
                      <i className="bi bi-trash me-1"></i>Remove All Discounts
                    </button>
                  ) : <div />}
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-secondary text-white" onClick={() => setIsEditingDiscounts(false)}>Cancel</button>
                    <button
                      type="submit"
                      className="btn btn-pcc-primary text-white fw-bold d-flex align-items-center gap-1"
                      disabled={applyingDiscount || discountBeneficiaries.length === 0}
                    >
                      {applyingDiscount ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Applying...
                        </>
                      ) : (
                        'Apply & Recalculate'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ADD INCIDENTAL MODAL */}
      {isAddingIncidental && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered modal-md">
            <div className="modal-content border-0">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Add Incidental Charge</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setIsAddingIncidental(false)}></button>
              </div>
              <form onSubmit={handleAddIncidentalSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Description of Lost/Damaged/Special Item *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      required
                      placeholder="e.g. Broken glass, lost towel, extra pillow laundry fee"
                      value={incidentalForm.description}
                      onChange={(e) => setIncidentalForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Charge Fee Amount (₱) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control form-control-sm fw-bold text-danger"
                      required
                      value={incidentalForm.amount}
                      onChange={(e) => setIncidentalForm(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="modal-footer border-top-0">
                  <button type="submit" className="btn btn-danger text-white d-inline-flex align-items-center gap-1.5" disabled={submittingIncidental}>
                    {submittingIncidental && (
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    )}
                    <span>{submittingIncidental ? 'Adding Charge...' : 'Add Charge'}</span>
                  </button>
                  <button type="button" className="btn btn-secondary text-white" disabled={submittingIncidental} onClick={() => setIsAddingIncidental(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* REPORT DAMAGE MODAL */}
      {isReportingDamage && selectedBorrowItem && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered modal-md">
            <div className="modal-content border-0">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Report Lost or Damaged Item</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setIsReportingDamage(false)}></button>
              </div>
              <form onSubmit={handleReportDamageSubmit}>
                <div className="modal-body">
                  <p className="small text-muted mb-3">
                    Reporting issue with borrowed item: <strong>{selectedBorrowItem.itemName}</strong> (Qty: {selectedBorrowItem.quantity}).
                  </p>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Reported Status *</label>
                    <select
                      className="form-select form-select-sm"
                      required
                      value={damageForm.status}
                      onChange={(e) => setDamageForm(prev => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="Lost">Lost Item</option>
                      <option value="Damaged">Damaged Item</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Remarks / Explanations *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      required
                      placeholder="e.g. Guest broke the pillow cover, guest lost the towel"
                      value={damageForm.remarks}
                      onChange={(e) => setDamageForm(prev => ({ ...prev, remarks: e.target.value }))}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Charge Fee Amount (₱) - Leave 0 for no fee</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control form-control-sm fw-bold text-danger"
                      value={damageForm.amount}
                      onChange={(e) => setDamageForm(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="modal-footer border-top-0">
                  <button type="submit" className="btn btn-danger text-white">Process Report</button>
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setIsReportingDamage(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SETTLE BILL MODAL */}
      {isSettlingBill && billDetails && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1080 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '16px' }}>
              <form onSubmit={handleSettleBillSubmit}>
                <div className="modal-header border-bottom px-4 py-3 bg-light">
                  <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="fa-solid fa-cash-register text-primary"></i> Record Walk-in Counter Payment
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setIsSettlingBill(false)}
                  ></button>
                </div>
                <div className="modal-body p-4">
                  <div className="alert alert-info py-2 px-3 small mb-3">
                    <div className="fw-bold text-dark">{billDetails.booking.firstName} {billDetails.booking.lastName}</div>
                    <div>Room <strong>{billDetails.booking.roomNumber}</strong> ({billDetails.booking.roomType}) • Stay #{billDetails.booking.bookingID}</div>
                    <div className="text-muted mt-1" style={{ fontSize: '0.72rem' }}>Manual counter payment settlement for cash, walk-in GCash, or card.</div>
                  </div>

                  <div className="card bg-danger-subtle border border-danger-subtle p-3 mb-3 text-center">
                    <span className="text-danger small fw-semibold text-uppercase">Total Outstanding Balance</span>
                    <span className="fs-3 fw-bold text-danger">₱{parseFloat(billDetails.chargesSummary?.balance || 0).toFixed(2)}</span>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold text-dark small">Payment Method</label>
                    <select
                      className="form-select"
                      value={settleForm.paymentMethodID}
                      onChange={(e) => setSettleForm(prev => ({ ...prev, paymentMethodID: e.target.value }))}
                    >
                      {paymentMethods && paymentMethods.length > 0 ? (
                        paymentMethods.map(m => (
                          <option key={m.paymentMethodID} value={m.paymentMethodID}>{m.paymentMethod}</option>
                        ))
                      ) : (
                        <>
                          <option value="1">Cash</option>
                          <option value="2">GCash</option>
                          <option value="3">Credit/Debit Card</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-bold text-dark small">Amount to Settle (₱)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="form-control"
                        value={settleForm.amount}
                        onChange={(e) => setSettleForm(prev => ({ ...prev, amount: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-bold text-dark small">
                        {settleForm.paymentMethodID === '1' ? 'Cash Received (₱)' : 'Ref Number (Optional)'}
                      </label>
                      {settleForm.paymentMethodID === '1' ? (
                        <input
                          type="number"
                          step="0.01"
                          min={settleForm.amount || "0"}
                          className="form-control"
                          value={settleForm.cashReceived}
                          onChange={(e) => setSettleForm(prev => ({ ...prev, cashReceived: e.target.value }))}
                          required
                        />
                      ) : (
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g., GCASH-12345"
                          value={settleForm.referenceNumber}
                          onChange={(e) => setSettleForm(prev => ({ ...prev, referenceNumber: e.target.value }))}
                        />
                      )}
                    </div>
                  </div>

                  {settleForm.paymentMethodID === '1' && (
                    <div className="p-3 bg-light rounded border d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-semibold text-muted small">Change to Return:</span>
                      <span className="fw-bold text-success fs-5">
                        ₱{Math.max(0, (parseFloat(settleForm.cashReceived || 0) - parseFloat(settleForm.amount || 0))).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="modal-footer border-top px-4 py-3 d-flex justify-content-end gap-2 bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary text-white"
                    onClick={() => setIsSettlingBill(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary fw-bold text-white d-inline-flex align-items-center gap-1 shadow-sm">
                    <i className="fa-solid fa-check"></i> Record Counter Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
