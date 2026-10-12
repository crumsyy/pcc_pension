'use client';

import { useState, useEffect, useRef } from 'react';
import { clientCache, CACHE_TTL } from '@/lib/clientCache';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs';
import PaymentTerminal from './PaymentTerminal';
import ModalDialog from '../../components/ModalDialog';
import { toast } from '@/components/ui/toast';
import ModalPortal from '../../components/ModalPortal';
import SearchableSelect from '../../components/SearchableSelect';
import LoadingButton from '../../components/LoadingButton';
import { formatCurrency } from '@/lib/formatters';

export default function ReceptionistBilling() {
  const [activeBookings, setActiveBookings] = useState([]);
  const [selectedBookingID, setSelectedBookingID] = useState('');

  // Keep ?bookingID in the URL so sibling tabs/deep-links share the selection.
  const syncBookingToUrl = (bID) => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (bID) params.set('bookingID', bID);
      else params.delete('bookingID');
      const qs = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    } catch (e) {}
  };
  const [billDetails, setBillDetails] = useState(null);
  const [billDialogTab, setBillDialogTab] = useState('billing'); // 'billing' | 'payments'
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
  const [isSubmittingDamageReport, setIsSubmittingDamageReport] = useState(false);
  const [selectedBorrowItem, setSelectedBorrowItem] = useState(null);
  const [damageForm, setDamageForm] = useState({ status: 'Lost', amount: '', remarks: '' });

  // Discount editing state
  const [applyingDiscount, setApplyingDiscount] = useState(false);
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
    toast.add({
      type: type || 'info',
      title: title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notification'),
      description: message || ''
    });
    if (typeof onOk === 'function') {
      onOk();
    }
  };

  const showConfirm = (title, message, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning') => {
    setModalConfig({
      isOpen: true,
      type,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm: async () => {
        try {
          if (onConfirm) await onConfirm();
        } finally {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      },
      onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const [shouldAnimate, setShouldAnimate] = useState(true);
  const isFirstMount = useRef(true);
  const selectedBookingIDRef = useRef('');
  selectedBookingIDRef.current = selectedBookingID;

  const fetchActiveBookings = async (isBackground = false) => {
    if (!isBackground && !clientCache.has('RECEPTIONIST_BILLING')) {
      setLoadingList(true);
    }
    try {
      const res = await fetch('/api/receptionist/payments');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch active bookings');
      
      // Load full stays list with settled and active statuses
      setActiveBookings(data.allBillingStays || data.activeBookings || []);
      if (data.paymentMethods) {
        setPaymentMethods(data.paymentMethods);
      }

      clientCache.set('RECEPTIONIST_BILLING', data, CACHE_TTL.RECEPTIONIST_BILLING);
    } catch (err) {
      if (!isBackground) showAlert('error', 'Error', err.message);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchBillingDetails = async (bookingID, silent = true) => {
    if (!bookingID) {
      setBillDetails(null);
      return;
    }
    // Silent background refreshes must not flash the loading placeholder —
    // that unmount/remount is what throws the modal scroll back to the top.
    if (!silent) setLoadingBill(true);
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
    if (billDetails.discountList && billDetails.discountList.length > 0) {
      setDiscountBeneficiaries(billDetails.discountList.map(bd => ({
        discountID: bd.discountID ? `disc-${bd.discountID}` : (bd.promotionID ? `promo-${bd.promotionID}` : ''),
        beneficiaryName: bd.guestName || bd.fullName || '',
        discountIdNumber: bd.discountIdNumber && bd.discountIdNumber !== 'N/A' ? bd.discountIdNumber : ''
      })));
    } else if (billDetails.guestsList && billDetails.guestsList.length > 0) {
      setDiscountBeneficiaries(billDetails.guestsList.map(g => ({
        discountID: g.discountID ? `disc-${g.discountID}` : (g.promotionID ? `promo-${g.promotionID}` : ''),
        beneficiaryName: g.fullName || '',
        discountIdNumber: g.discountIdNumber && g.discountIdNumber !== 'N/A' ? g.discountIdNumber : ''
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
      const cleanId = String(b.discountID || '').replace('disc-', '').replace('promo-', '');
      const selDisc = (billDetails?.discounts || []).find(d =>
        String(d.discountID) === String(b.discountID) ||
        String(d.discountID).replace('disc-', '').replace('promo-', '') === cleanId
      );
      const isOpenRow = selDisc?.eligibility === 'Open';
      if (!isOpenRow && !b.beneficiaryName.trim()) {
        showAlert('warning', 'Validation Error', `Beneficiary #${i + 1}: Full name is required.`);
        return;
      }
      if (!isOpenRow && !b.discountIdNumber.trim()) {
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
    if (isSubmittingDamageReport) return;
    setIsSubmittingDamageReport(true);
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
    } finally {
      setIsSubmittingDamageReport(false);
    }
  };

  // Any open bill surface suspends background refresh (see polling effect).
  const isBillingModalOpen = Boolean(
    (selectedBookingID && billDetails) ||
    isEditingDiscounts ||
    isAddingIncidental ||
    isReportingDamage
  );

  useEffect(() => {
    const entry = clientCache.get('RECEPTIONIST_BILLING');
    if (entry) {
      const data = entry.data;
      setActiveBookings(data.allBillingStays || data.activeBookings || []);
      if (data.paymentMethods) setPaymentMethods(data.paymentMethods);
      setLoadingList(false);
      setShouldAnimate(false);
      if (entry.isStale) fetchActiveBookings(true);
    } else {
      if (!isFirstMount.current) setShouldAnimate(true);
      fetchActiveBookings(false);
    }
    isFirstMount.current = false;

    const params = new URLSearchParams(window.location.search);
    const bID = params.get('bookingID');
    if (bID) {
      setSelectedBookingID(bID);
      setBillDialogTab('billing');
      fetchBillingDetails(bID, false);
    }

    // Real-time background sync polling every 6 seconds.
    // Suspended while any bill dialog is open so background refreshes can't
    // steal modal scroll position mid-edit; mutations refetch explicitly.
    const interval = setInterval(() => {
      if (isBillingModalOpen) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchActiveBookings(true);
        if (selectedBookingIDRef.current) {
          fetchBillingDetails(selectedBookingIDRef.current);
        }
      }
    }, 6000);

    const handleFocus = () => {
      if (isBillingModalOpen) return;
      fetchActiveBookings(true);
      if (selectedBookingIDRef.current) fetchBillingDetails(selectedBookingIDRef.current);
    };
    const handleCustomRefresh = () => {
      fetchActiveBookings(true);
      if (selectedBookingIDRef.current) fetchBillingDetails(selectedBookingIDRef.current);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('pcc-refresh-billing', handleCustomRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pcc-refresh-billing', handleCustomRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBillingModalOpen]);

  const handleBookingChange = (e) => {
    const bID = e.target.value;
    setSelectedBookingID(bID);
    syncBookingToUrl(bID);
    fetchBillingDetails(bID);
  };

  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'booked' | 'occupied' | 'completed'

  const BOOKED_STATUS_LIST = [
    'Booked'
  ];

  const OCCUPIED_STATUS_LIST = [
    'Occupied',
    'Late Checkout',
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

    if (statusFilter === 'occupied') {
      return OCCUPIED_STATUS_LIST.includes(b.status);
    } else if (statusFilter === 'booked') {
      return BOOKED_STATUS_LIST.includes(b.status);
    } else if (statusFilter === 'completed') {
      return b.status === 'Completed' || b.status === 'Checked Out';
    }
    return true; // 'all'
  });

  const appliedDiscountsList = (billDetails?.guestsList || []).filter(g => {
    const dId = g.discountID;
    const pId = g.promotionID;
    const hasValidDiscount = dId && dId !== 'none' && dId !== 'N/A' && dId !== 'null' && String(dId).trim() !== '' && dId !== 0 && dId !== '0';
    const hasValidPromo = pId && pId !== 'none' && pId !== 'N/A' && pId !== 'null' && String(pId).trim() !== '' && pId !== 0 && pId !== '0';
    return hasValidDiscount || hasValidPromo;
  });

  const SectionHeader = ({ num, icon, title, editable, hint, action }) => (
    <div className="d-flex justify-content-between align-items-start gap-2 mb-2 pb-2 border-bottom">
      <div className="d-flex align-items-start gap-2" style={{ minWidth: 0 }}>
        <span className="badge text-white rounded-circle d-inline-flex align-items-center justify-content-center flex-shrink-0" style={{ backgroundColor: 'var(--pcc-blue, #0d6efd)', width: '22px', height: '22px', fontSize: '0.70rem' }}>{num}</span>
        <div style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="fw-bold text-dark" style={{ fontSize: '0.84rem' }}><i className={`${icon} me-1 text-primary`}></i>{title}</span>
            <span className={`badge border fw-semibold ${editable ? 'bg-success-subtle text-success border-success-subtle' : 'bg-secondary-subtle text-secondary border-secondary-subtle'}`} style={{ fontSize: '0.65rem' }}>{editable ? 'Editable — you can change this' : 'View only'}</span>
          </div>
          {hint && <div className="text-muted" style={{ fontSize: '0.70rem' }}>{hint}</div>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );

  return (
    <>
      <div className={`container-fluid py-3 d-flex flex-column ${shouldAnimate ? 'pcc-content-reveal' : ''}`} style={{ backgroundColor: '#f8f9fa', height: 'calc(100vh - 150px)', overflow: 'hidden' }}>
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
                <Tabs selectedKey={statusFilter} onSelectionChange={(key) => setStatusFilter(key)}>
                  <TabList aria-label="Stay filters">
                    <Tab id="all">All</Tab>
                    <Tab id="booked">Booked</Tab>
                    <Tab id="occupied">Occupied</Tab>
                    <Tab id="completed">Completed</Tab>
                  </TabList>
                </Tabs>
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
                      <td colSpan="6" className="text-center py-5 text-muted">
                        Loading bill details…
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
                            (b.status === 'Occupied') ? 'bg-primary text-white' :
                            (b.status === 'Booked') ? 'bg-info text-white' :
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
                                setBillDialogTab('billing');
                                syncBookingToUrl(b.bookingID);
                                fetchBillingDetails(b.bookingID, false);
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
        <ModalPortal>
          <div className="modal show d-block animate__animated animate__fadeIn" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.32)', backdropFilter: 'blur(10px) saturate(125%)', WebkitBackdropFilter: 'blur(10px) saturate(125%)', zIndex: 99999 }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable" style={{ maxWidth: '90%' }}>
            <div className="modal-content border-0 shadow-lg" style={{ height: '85vh', borderRadius: '12px', overflow: 'hidden' }}>
              <div className="modal-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold text-dark m-0" style={{ fontSize: '1.1rem' }}>
                  Guest Bill — Room {billDetails.booking.roomNumber} ({billDetails.booking.roomType})
                </h5>
                <button type="button" className="btn-close" onClick={() => { setSelectedBookingID(''); syncBookingToUrl(''); setBillDetails(null); }}></button>
              </div>

              <Tabs selectedKey={billDialogTab} onSelectionChange={setBillDialogTab} style={{ flex: '1 1 auto', minHeight: 0 }}>
                <div className="px-4 pt-3 bg-white border-bottom" style={{ flexShrink: 0 }}>
                  <TabList aria-label="Bill details">
                    <Tab id="billing">Billing</Tab>
                    <Tab id="payments">Payments</Tab>
                  </TabList>
                </div>
                <TabPanel id="billing" style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body p-4 bg-light overflow-auto" style={{ flex: '1 1 auto', minHeight: 0 }}>
                {loadingBill ? (
                  <div className="bg-white p-4 rounded shadow-sm">
                    <div className="text-center py-5 text-muted">
                      Loading bill details…
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
                          <SectionHeader num="1" icon="bi bi-person-badge" title="Guest & Booking Details" editable={false} hint="Booking record — cannot edit here. To correct guest info, update the booking." />
                          <div className="row mb-3 bg-light p-2 rounded g-2 border" style={{ fontSize: '0.78rem' }}>
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
                          <SectionHeader num="2" icon="bi bi-house-door" title="Room Rent Charges" editable={false} hint="Auto-computed from rate × nights. Nothing to edit here." />
                          <div className="table-responsive mb-2">
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
                                {/* Discount apportionment moved to its own Section 5 below — no longer a table row. */}
                                <tr className="table-light">
                                  <td colSpan="3" className="fw-semibold">Net Room Stay Charges</td>
                                  <td className="text-end fw-bold text-dark">₱{parseFloat(billDetails.chargesSummary.room).toFixed(2)}</td>
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
                                {parseFloat(billDetails.chargesSummary?.breakfastFee || billDetails.booking?.breakfastFee || 0) > 0 && (
                                  <tr>
                                    <td colSpan="3">
                                      <div className="d-flex align-items-center gap-2">
                                        <span>Breakfast Package / Add-on Fee</span>
                                        {billDetails.chargesSummary?.breakfastDates && billDetails.chargesSummary.breakfastDates.length > 0 && (
                                          <span className="badge bg-light text-secondary border font-monospace" style={{ fontSize: '0.68rem' }}>
                                            {billDetails.chargesSummary.breakfastDates.length} Morning{billDetails.chargesSummary.breakfastDates.length > 1 ? 's' : ''}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="text-end fw-semibold text-dark">
                                      +₱{parseFloat(billDetails.chargesSummary?.breakfastFee || billDetails.booking?.breakfastFee || 0).toFixed(2)}
                                    </td>
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
                              </tbody>
                            </table>
                          </div>

                          {/* Discount apportionment — standalone section, no longer a table row */}
                          {appliedDiscountsList.length > 0 && billDetails.chargesSummary.totalDiscount > 0 && (
                            <div className="mb-3 p-2.5 rounded border bg-warning-subtle border-warning-subtle" style={{ fontSize: '0.78rem' }}>
                              <div className="fw-bold text-dark mb-1">How the discount was split per guest:</div>
                              <ul className="mb-1 ps-3" style={{ listStyleType: 'square' }}>
                                <li>Total Registered Guests: <strong>{billDetails.chargesSummary.totalGuests} Pax</strong></li>
                                <li>Individual Guest Share: <strong>₱{parseFloat(billDetails.chargesSummary.sharePerGuest).toFixed(2)}</strong></li>
                                <li>Applied Discounts/Promotions: <strong>{appliedDiscountsList.length} Guest(s)</strong> (configured discount percentage applied to their individual share)</li>
                              </ul>
                              <div className="text-end fw-bold text-success">-₱{parseFloat(billDetails.chargesSummary.totalDiscount).toFixed(2)}</div>
                            </div>
                          )}

                          {/* Room Occupancy & Capacity Summary (Replaces legacy registered guests list) */}
                          <SectionHeader num="3" icon="bi bi-people-fill" title="Occupancy & Capacity" editable={true} hint="Check headcount here. To change discounts, click Apply / Edit Discounts." action={(<button type="button" className="btn btn-sm btn-pcc-primary text-white" style={{ fontSize: '0.74rem', padding: '4px 12px', borderRadius: '15px' }} onClick={openEditDiscountsModal}><i className="fa-solid fa-percent me-1"></i> Apply / Edit Discounts</button>)} />
                          <div className="mb-3 bg-light p-3 rounded-3 border animate__animated animate__fadeIn" style={{ fontSize: '0.80rem' }}>

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

                              {/* Scheduled Breakfast Add-ons (Night-by-Night Selection) */}
                              {(() => {
                                let dates = [];
                                try {
                                  const raw = billDetails?.booking?.breakfastDates || billDetails?.chargesSummary?.breakfastDates || billDetails?.chargesBreakdown?.breakfastSummary?.breakfastDates;
                                  dates = typeof raw === 'string'
                                    ? JSON.parse(raw || '[]')
                                    : (Array.isArray(raw) ? raw : []);
                                } catch (e) {
                                  dates = [];
                                }

                                if (!dates.length) return null;

                                return (
                                  <div className="col-12 mt-2">
                                    <div className="p-2.5 bg-light rounded-3 border">
                                      <div className="fw-bold text-dark mb-1" style={{ fontSize: '0.80rem' }}>4 · Breakfast Schedule ({dates.length} Day{dates.length > 1 ? 's' : ''}) <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle ms-1" style={{ fontSize: '0.65rem' }}>View only</span></div>
                                      <div className="text-muted mb-2" style={{ fontSize: '0.70rem' }}>From booking package — nothing to edit here.</div>
                                      <div className="d-flex flex-wrap gap-1.5">
                                        {dates.map((d) => (
                                          <span key={d} className="badge bg-white text-dark border px-2 py-1 fw-medium small d-flex align-items-center gap-1 shadow-2xs" style={{ fontSize: '0.73rem' }}>
                                            <i className="bi bi-calendar-check text-success"></i>
                                            Morning of {new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Applied Discounts breakdown if any */}
                            <SectionHeader num="5" icon="bi bi-tag-fill" title="Applied Discounts" editable={true} hint="Who gets a discount. To add or change, use Apply / Edit Discounts in Section 3." />
                            {appliedDiscountsList.length > 0 && billDetails.chargesSummary.totalDiscount > 0 ? (
                              <div className="mt-2.5 pt-2 border-top">
                                <div className="fw-semibold text-success mb-1" style={{ fontSize: '0.76rem' }}>
                                  <i className="bi bi-tag-fill me-1"></i>{appliedDiscountsList.length} Beneficiar{appliedDiscountsList.length > 1 ? 'ies' : 'y'} — Total Savings: -₱{parseFloat(billDetails.chargesSummary.totalDiscount).toFixed(2)}:
                                </div>
                                <div className="d-flex flex-wrap gap-2">
                                  {appliedDiscountsList.map((b, idx) => (
                                    <div key={idx} className="badge bg-white text-dark border p-2 text-start font-monospace shadow-sm" style={{ fontSize: '0.74rem', fontWeight: 'normal' }}>
                                      <strong className="text-primary">{b.fullName}</strong> — {b.discountName || 'Special Discount'} {b.discountIdNumber ? `(${b.discountIdNumber})` : ''}
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
                          <SectionHeader num="6" icon="bi bi-cart-check-fill" title="Orders & Room Service" editable={false} hint="Charged from the Orders tab — view only here." />
                          <div className="d-flex justify-content-end mb-2">
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
                          <SectionHeader num="7" icon="bi bi-clipboard-check" title="Room Check-Out Inspection" editable={true} hint="Tick returned items. Untick missing/damaged to auto-bill replacement." />
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
                          <SectionHeader num="8" icon="bi bi-receipt" title="Incidental & Damage Charges" editable={true} hint="Add or remove extra charges here." action={(<button type="button" className="btn btn-sm btn-danger text-white" style={{ fontSize: '0.72rem', padding: '3px 10px' }} onClick={() => { setIncidentalForm({ description: '', amount: '' }); setIsAddingIncidental(true); }}>+ Add Incidental Charge</button>)} />
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
                              <SectionHeader num="9" icon="bi bi-bag" title="Borrowed Room Items & Amenities" editable={true} hint="Mark returned or report lost/damaged here." />
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
                          <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.95rem' }}>Bill Totals Summary (Read-Only)</h5>
                          <small className="text-muted">Pay or complete checkout in the Payments tab.</small>
                        </div>
                        <div className="card-body p-4" style={{ fontSize: '0.78rem' }}>
                          {(() => {
                            const cs = billDetails.chargesSummary || {};
                            const baseRoomCharge = parseFloat(cs.baseRoomCharge || cs.originalRoomCharge || billDetails.booking.originalRoomCharge || billDetails.booking.roomCharge || 0);
                            const extraGuestFee = parseFloat(cs.extraGuestFee || 0);
                            const earlyCheckIn = parseFloat(cs.earlyCheckIn || 0);
                            const lateCheckOut = parseFloat(cs.lateCheckOut || 0);
                            const breakfastFee = parseFloat(cs.breakfastFee || billDetails.booking?.breakfastFee || 0);
                            const ordersTotal = parseFloat(billDetails.ordersSummary?.totalAmount ?? cs.orders ?? 0);
                            const incidentalsTotal = parseFloat(cs.incidentals || 0);

                            const grossSubtotal = parseFloat(cs.grossSubtotal || (baseRoomCharge + extraGuestFee + earlyCheckIn + lateCheckOut + breakfastFee + ordersTotal + incidentalsTotal));
                            const appliedDiscountsSummaryList = (billDetails.discountList && billDetails.discountList.length > 0)
                              ? billDetails.discountList.filter(d => d.discountID && d.discountID !== 'none' && d.discountID !== 'N/A' && d.discountID !== 'null' && String(d.discountID).trim() !== '' && d.discountID !== 0 && d.discountID !== '0')
                              : [];
                            const discountTotal = appliedDiscountsSummaryList.length > 0 ? parseFloat(cs.discountTotal ?? cs.totalDiscount ?? 0) : 0;
                            const netTotal = parseFloat(cs.netTotal ?? Math.max(0, grossSubtotal - discountTotal));
                            const vatRate = parseFloat(cs.vatRate || 0);
                            const vatAmount = parseFloat(cs.vatAmount || 0);
                            const grandTotal = netTotal;
                            const paidTotal = parseFloat(cs.paid || 0);
                            const downPaymentPaid = parseFloat(cs.downPaymentPaid || 0);
                            const otherPayments = Math.max(0, paidTotal - downPaymentPaid);
                            const balance = parseFloat(cs.balance || 0);

                            return (
                              <>
                                <div className="d-flex justify-content-between mb-2">
                                  <span className="text-muted">Room Base Rent ({cs.breakfastOption === 'with' ? 'With Breakfast' : 'Room Only'}):</span>
                                  <span className="fw-semibold text-dark">₱{baseRoomCharge.toFixed(2)}</span>
                                </div>

                                {extraGuestFee > 0 && (
                                  <div className="d-flex justify-content-between mb-2 text-secondary align-items-center">
                                    <span>
                                      Extra Guests Fee ({cs.extraGuests} Pax @ ₱100/night):
                                      <span className="badge bg-secondary-subtle text-secondary ms-1.5" style={{ fontSize: '0.68rem' }}>Final Billing Only</span>
                                    </span>
                                    <span className="fw-semibold text-dark">+₱{extraGuestFee.toFixed(2)}</span>
                                  </div>
                                )}

                                {earlyCheckIn > 0 && (
                                  <div className="d-flex justify-content-between mb-2 text-primary">
                                    <span>Early Check-in Fee (₱50/hr):</span>
                                    <span className="fw-semibold">₱{earlyCheckIn.toFixed(2)}</span>
                                  </div>
                                )}

                                {lateCheckOut > 0 && (
                                  <div className="d-flex justify-content-between mb-2 text-primary">
                                    <span>Late Check-out Fee:</span>
                                    <span className="fw-semibold">₱{lateCheckOut.toFixed(2)}</span>
                                  </div>
                                )}

                                {breakfastFee > 0 && (
                                  <div className="d-flex justify-content-between mb-2">
                                    <span className="text-muted">Breakfast Package / Add-on Fee:</span>
                                    <span className="fw-semibold text-dark">+₱{breakfastFee.toFixed(2)}</span>
                                  </div>
                                )}

                                <div className="d-flex justify-content-between mb-2">
                                  <span className="text-muted">Orders:</span>
                                  <span className="fw-semibold text-dark">
                                    ₱{ordersTotal.toFixed(2)}
                                  </span>
                                </div>

                                {incidentalsTotal > 0 && (
                                  <div className="d-flex justify-content-between mb-2 text-danger">
                                    <span>Incidental Charges (Damages/Penalties):</span>
                                    <span className="fw-semibold">₱{incidentalsTotal.toFixed(2)}</span>
                                  </div>
                                )}

                                <div className="d-flex justify-content-between align-items-center mb-2 pt-2 border-top">
                                  <span className="fw-bold text-secondary" style={{ fontSize: '0.88rem' }}>Gross Subtotal:</span>
                                  <span className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>
                                    ₱{grossSubtotal.toFixed(2)}
                                  </span>
                                </div>

                                {/* Applied Discounts Card */}
                                <div className="mb-3 p-2.5 rounded bg-primary-subtle border border-primary-subtle">
                                  <div className="d-flex justify-content-between align-items-center mb-1 text-primary fw-bold" style={{ fontSize: '0.84rem' }}>
                                    <span className="d-flex align-items-center gap-1">
                                      <i className="fa-solid fa-tags"></i>
                                      <span>Applied Discounts:</span>
                                    </span>
                                    <span className="fs-6">{discountTotal > 0 ? `-₱${discountTotal.toFixed(2)}` : '₱0.00'}</span>
                                  </div>
                                  {appliedDiscountsSummaryList.length > 0 ? (
                                    <div className="d-flex flex-column gap-1.5 mt-1.5 mb-2">
                                      {appliedDiscountsSummaryList.map((disc, idx) => (
                                        <div key={idx} className="d-flex justify-content-between align-items-start gap-2 px-2.5 py-1.5 rounded bg-white border" style={{ fontSize: '0.74rem', lineHeight: '1.4' }}>
                                          <div className="d-flex align-items-start gap-1.5 text-start" style={{ minWidth: 0 }}>
                                            <i className="fa-solid fa-user-check text-primary mt-0.5"></i>
                                            <div>
                                              <strong className="text-dark">{disc.guestName || disc.fullName}</strong>
                                              <div className="text-muted">{disc.discountName || 'Discount'} {disc.discountPercentage || disc.percentage || 20}% • ID: {disc.discountIdNumber || 'N/A'}</div>
                                            </div>
                                          </div>
                                          <span className="fw-bold text-success text-nowrap">-₱{parseFloat(disc.discountAmount || disc.discount || 0).toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="small text-muted fst-italic mb-0">No discounts applied.</div>
                                  )}
                                  <div className="small text-muted mt-2" style={{ fontSize: '0.70rem' }}>To modify discounts, use Apply / Edit Discounts in the Billing statement (Section 3).</div>
                                </div>

                                {/* Net Total Amount Due */}
                                <div className="d-flex justify-content-between align-items-center p-2.5 mb-3 rounded" style={{ background: '#e0f2fe', border: '1px solid #bae6fd' }}>
                                  <span className="fw-bold text-primary" style={{ fontSize: '0.90rem' }}>
                                    <i className="fa-solid fa-calculator me-1"></i>Net Total Amount Due:
                                  </span>
                                  <span className="fw-bold text-primary fs-6">₱{netTotal.toFixed(2)}</span>
                                </div>

                                {vatAmount > 0 && (
                                  <div className="d-flex justify-content-between mb-2 text-muted" style={{ fontSize: '0.82rem' }}>
                                    <span className="fst-italic">Inclusive of VAT ({vatRate}%):</span>
                                    <span>₱{vatAmount.toFixed(2)}</span>
                                  </div>
                                )}

                                <div className="d-flex justify-content-between mb-1.5 text-success">
                                  <span className="fw-semibold">Total Payments Settled:</span>
                                  <span className="fw-bold">-₱{paidTotal.toFixed(2)}</span>
                                </div>

                                {downPaymentPaid > 0 && (
                                  <div className="d-flex justify-content-between mb-1 text-muted ps-2" style={{ fontSize: '0.73rem' }}>
                                    <span>• Down Payment Paid ({cs.downPaymentPercentage}%):</span>
                                    <span className="fw-semibold">₱{downPaymentPaid.toFixed(2)}</span>
                                  </div>
                                )}

                                {otherPayments > 0 && (
                                  <div className="d-flex justify-content-between mb-1 text-muted ps-2" style={{ fontSize: '0.73rem' }}>
                                    <span>• Counter / Subsequent Payments:</span>
                                    <span className="fw-semibold">₱{otherPayments.toFixed(2)}</span>
                                  </div>
                                )}

                                <div className="d-flex justify-content-between align-items-center p-3 bg-danger-subtle rounded border border-danger-subtle mb-4 mt-2">
                                  <div>
                                    <span className="fw-bold text-danger d-block">Total Balance Due:</span>
                                    <span className="text-muted" style={{ fontSize: '0.70rem' }}>Grand Total Due - Total Payments Settled</span>
                                  </div>
                                  <span className="fw-bold text-danger" style={{ fontSize: '1.3rem' }}>
                                    ₱{balance.toFixed(2)}
                                  </span>
                                </div>
                              </>
                            );
                          })()}

                          {(() => {
                            const balance = parseFloat(billDetails.chargesSummary?.balance || 0);
                            const rawBalance = parseFloat(billDetails.chargesSummary?.rawBalance ?? balance);
                            const isSettled = Math.round(rawBalance * 100) === 0;
                            const isOverpaid = rawBalance < 0;
                            const isCheckedOut = ['Checked Out', 'Completed'].includes(billDetails.booking?.status);

                            if (isCheckedOut) {
                              return (
                                <div className="alert alert-secondary text-center py-2.5 mb-0 fw-semibold">
                                  <i className="bi bi-check-circle-fill me-1 text-success"></i> Bill fully settled &amp; Guest Checked Out. Room is Available.
                                </div>
                              );
                            }

                            // Overpaid: block checkout, flag for review (never auto-clear)
                            if (isOverpaid) {
                              return (
                                <div className="d-flex flex-column gap-2">
                                  <div className="alert alert-danger py-2.5 px-3 small d-flex align-items-center gap-2 mb-0 border-0 rounded-3 fw-semibold">
                                    <i className="bi bi-exclamation-triangle-fill fs-5 flex-shrink-0"></i>
                                    <div>
                                      <div className="fw-bold">Overpayment flagged for review (PHP {Math.abs(rawBalance).toFixed(2)})</div>
                                      <div className="small fw-normal">Checkout is blocked until a supervisor reviews and resolves the discrepancy.</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            // If remaining balance is not exactly ₱0.00, point at
                            // the Payments tab (paying happens there, not here).
                            if (!isSettled) {
                              return (
                                <div className="d-flex flex-column gap-2">
                                  <div className="alert alert-warning py-2.5 px-3 small d-flex align-items-center gap-2 mb-0 border-0 bg-warning-subtle text-warning-emphasis rounded-3 fw-semibold">
                                    <i className="bi bi-clock-history fs-5 flex-shrink-0"></i>
                                    <div>
                                      <div className="fw-bold">Balance Due — Ready for Settlement</div>
                                      <div className="small fw-normal text-muted" style={{ fontSize: '0.74rem' }}>
                                        Switch to the Payments tab to settle this bill.
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            // Balance is exactly ₱0.00: Bill fully settled!
                            return (
                              <div className="d-flex flex-column gap-2">
                                <div className="alert alert-success text-center py-2 mb-0 fw-semibold">
                                  ✓ Bill Fully Settled (₱0.00 Balance). Complete checkout in the Payments tab.
                                </div>
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
                </TabPanel>
                <TabPanel id="payments" style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
                  <div className="modal-body p-4 bg-light overflow-auto" style={{ flex: '1 1 auto', minHeight: 0 }}>
                    <PaymentTerminal
                      bookingID={selectedBookingID}
                      locked
                      paymentMethods={paymentMethods}
                      onPaid={() => {
                        fetchActiveBookings(true);
                        fetchBillingDetails(selectedBookingID);
                      }}
                      onCompleted={() => {
                        fetchActiveBookings(true);
                        fetchBillingDetails(selectedBookingID);
                      }}
                    />
                  </div>
                </TabPanel>
              </Tabs>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* EDIT DISCOUNTS MODAL */}
      {isEditingDiscounts && billDetails && (
        <ModalPortal>
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.32)', backdropFilter: 'blur(10px) saturate(125%)', WebkitBackdropFilter: 'blur(10px) saturate(125%)', zIndex: 99999 }}>
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

                  {discountBeneficiaries.map((b, idx) => {
                    const cleanRowId = String(b.discountID || '').replace('disc-', '').replace('promo-', '');
                    const rowDisc = (billDetails.discounts || []).find(d =>
                      String(d.discountID) === String(b.discountID) ||
                      String(d.discountID).replace('disc-', '').replace('promo-', '') === cleanRowId
                    );
                    const rowOpen = rowDisc?.eligibility === 'Open';
                    return (
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
                                {d.name} ({d.percentage}% Off{d.eligibility === 'Booking Count' ? `, ≥${d.requiredBookings || 0} stays` : d.eligibility === 'Open' ? ', Open' : ''})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-4">
                          <label className="form-label fw-semibold small mb-1">Beneficiary Full Name {rowOpen ? '(optional for Open)' : '*'}</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            required={!rowOpen}
                            placeholder={rowOpen ? 'Not needed for Open discount' : 'e.g. Juan Dela Cruz'}
                            value={b.beneficiaryName}
                            onChange={(e) => handleUpdateBeneficiaryField(idx, 'beneficiaryName', e.target.value)}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label fw-semibold small mb-1">Government / ID No. {rowOpen ? '(not needed)' : '*'}</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="form-control form-control-sm"
                            required={!rowOpen}
                            placeholder={rowOpen ? 'Not needed for Open discount' : 'e.g. 12345678 (Numeric Only)'}
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
                    );
                  })}

                  {discountBeneficiaries.length < (billDetails.chargesSummary?.totalGuests || 1) && (
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm w-100 mb-3"
                      style={{ borderStyle: 'dashed' }}
                      onClick={handleAddBeneficiaryRow}
                    >
                      <i className="bi bi-plus-circle me-1"></i>Add Another Senior / PWD Discount (Up to {billDetails.chargesSummary?.totalGuests || 1} Pax)
                    </button>
                  )}

                  {(() => {
                    const grossRoomCharge = parseFloat(billDetails.chargesSummary?.baseRoomCharge ?? billDetails.chargesSummary?.roomCharge ?? 0);
                    const totalPax = Math.max(1, parseInt(billDetails.chargesSummary?.totalGuests ?? 1, 10));
                    const perCapitaShare = grossRoomCharge / totalPax;

                    let totalEstDiscount = 0;
                    const itemizedPreview = [];

                    discountBeneficiaries.forEach((b, idx) => {
                      if (b.discountID) {
                        const cleanBId = String(b.discountID).replace('disc-', '').replace('promo-', '');
                        const disc = (billDetails.discounts || []).find(d => 
                          String(d.discountID) === String(b.discountID) ||
                          String(d.discountID).replace('disc-', '').replace('promo-', '') === cleanBId
                        );
                        if (disc) {
                          const pct = parseFloat(disc.percentage) || 0;
                          const isOpenRow = disc.eligibility === 'Open';
                          const amt = isOpenRow
                            ? Math.round(grossRoomCharge * (pct / 100) * 100) / 100
                            : Math.round(perCapitaShare * (pct / 100) * 100) / 100;
                          totalEstDiscount += amt;
                          itemizedPreview.push({
                            name: isOpenRow ? 'Open Discount' : (b.beneficiaryName || `Beneficiary #${idx + 1}`),
                            discountName: disc.name,
                            percentage: pct,
                            amount: amt
                          });
                        }
                      }
                    });

                    totalEstDiscount = Math.min(totalEstDiscount, grossRoomCharge);
                    const estNetRoomStay = Math.max(0, grossRoomCharge - totalEstDiscount);

                    return (
                      <div className="p-3 bg-light rounded border mb-2" style={{ fontSize: '0.85rem' }}>
                        <div className="fw-bold text-dark mb-1 d-flex justify-content-between">
                          <span>Live Accounting Preview:</span>
                          <span className="badge bg-secondary-subtle text-secondary border">Per-Capita Formula</span>
                        </div>
                        <div className="d-flex justify-content-between text-muted mb-1">
                          <span>Base Room Stay Charge:</span>
                          <span className="fw-semibold text-dark">₱{grossRoomCharge.toFixed(2)}</span>
                        </div>
                        <div className="d-flex justify-content-between text-muted mb-1">
                          <span>Per-Capita Share ({totalPax} Guest{totalPax > 1 ? 's' : ''}):</span>
                          <span className="fw-semibold text-dark">₱{perCapitaShare.toFixed(2)}/pax</span>
                        </div>
                        {itemizedPreview.length > 0 && (
                          <div className="border-top border-bottom py-1 my-1">
                            {itemizedPreview.map((item, i) => (
                              <div key={i} className="d-flex justify-content-between text-success small py-0.5">
                                <span>{item.name}: {item.discountName} ({item.percentage}%)</span>
                                <span className="fw-semibold">-₱{item.amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="d-flex justify-content-between text-success fw-bold mb-1">
                          <span>Total Discount Savings:</span>
                          <span>-₱{totalEstDiscount.toFixed(2)}</span>
                        </div>
                        <div className="d-flex justify-content-between text-dark fw-bold border-top pt-1">
                          <span>Estimated Net Room Charge:</span>
                          <span className="text-pcc-blue">₱{estNetRoomStay.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}
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
        </ModalPortal>
      )}

      {/* ADD INCIDENTAL MODAL */}
      {isAddingIncidental && (
        <ModalPortal>
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.32)', backdropFilter: 'blur(10px) saturate(125%)', WebkitBackdropFilter: 'blur(10px) saturate(125%)', zIndex: 99999 }}>
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
        </ModalPortal>
      )}

      {/* REPORT DAMAGE MODAL */}
      {isReportingDamage && selectedBorrowItem && (
        <ModalPortal>
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.32)', backdropFilter: 'blur(10px) saturate(125%)', WebkitBackdropFilter: 'blur(10px) saturate(125%)', zIndex: 99999 }}>
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
                  <button type="button" className="btn btn-secondary text-white" disabled={isSubmittingDamageReport} onClick={() => setIsReportingDamage(false)}>Cancel</button>
                  <LoadingButton
                    type="submit"
                    isLoading={isSubmittingDamageReport}
                    loadingText="Processing Report..."
                    className="btn btn-danger text-white fw-bold"
                  >
                    Process Report
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        </div>
        </ModalPortal>
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
