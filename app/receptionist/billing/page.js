'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';
import SearchableSelect from '../../components/SearchableSelect';

export default function ReceptionistBilling() {
  const [activeBookings, setActiveBookings] = useState([]);
  const [selectedBookingID, setSelectedBookingID] = useState('');
  const [billDetails, setBillDetails] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingBill, setLoadingBill] = useState(false);
  const [isEditingDiscounts, setIsEditingDiscounts] = useState(false);
  const [guestDiscountsForm, setGuestDiscountsForm] = useState([]);

  const [isAddingIncidental, setIsAddingIncidental] = useState(false);
  const [incidentalForm, setIncidentalForm] = useState({ description: '', amount: '' });

  const [isReportingDamage, setIsReportingDamage] = useState(false);
  const [selectedBorrowItem, setSelectedBorrowItem] = useState(null);
  const [damageForm, setDamageForm] = useState({ status: 'Lost', amount: '', remarks: '' });

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

  const fetchActiveBookings = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/receptionist/payments');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch active bookings');
      
      // We can also fetch checked out bookings if they have unpaid balances, but here we load all active list
      setActiveBookings(data.activeBookings || []);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoadingList(false);
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
  const openEditDiscountsModal = () => {
    if (!billDetails) return;
    const form = billDetails.guestsList.map(g => ({
      bookingGuestID: g.bookingGuestID,
      fullName: g.fullName,
      age: g.age,
      discountID: g.discountID || '',
      discountIdNumber: g.discountIdNumber || ''
    }));
    setGuestDiscountsForm(form);
    setIsEditingDiscounts(true);
  };

  const handleSaveDiscountsSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/receptionist/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingID: selectedBookingID,
          guests: guestDiscountsForm
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update guest discounts');

      showAlert('success', 'Success', 'Guest discounts updated successfully.');
      setIsEditingDiscounts(false);
      fetchBillingDetails(selectedBookingID);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    }
  };

  const handleDeleteIncidentalSubmit = async (chargeID) => {
    showConfirm('Delete Incidental Charge', 'Are you sure you want to remove this charge?', async () => {
      try {
        const res = await fetch('/api/receptionist/billing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_incidental',
            chargeID
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete incidental charge');

        showAlert('success', 'Success', 'Incidental charge deleted.');
        fetchBillingDetails(selectedBookingID);
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleAddIncidentalSubmit = async (e) => {
    e.preventDefault();
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

      showAlert('success', 'Success', 'Incidental charge added.');
      setIsAddingIncidental(false);
      fetchBillingDetails(selectedBookingID);
    } catch (err) {
      showAlert('error', 'Error', err.message);
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

  return (
    <>
      <div className="container-fluid py-4" style={{ backgroundColor: '#f8f9fa', minHeight: '85vh' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="fw-bold mb-1 text-pcc-blue" style={{ color: 'var(--pcc-blue)' }}>Guest Billing</h2>
            <p className="text-muted mb-0">Select an active check-in to review room rents, added orders, and total balances.</p>
          </div>
        </div>

        <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '8px' }}>
          <div className="card-body py-4">
            <div className="row align-items-center">
              <div className="col-md-6">
                <label className="form-label fw-bold text-dark mb-2">Select Active Checked-In Room / Guest</label>
                {loadingList ? (
                  <div>Loading guests list...</div>
                ) : (
                  <SearchableSelect
                    options={activeBookings.map(b => ({
                      value: String(b.bookingID),
                      label: `Room ${b.roomNumber} (${b.roomType}) — ${b.lastName}, ${b.firstName} (${b.status})`
                    }))}
                    value={selectedBookingID}
                    onChange={(val) => {
                      setSelectedBookingID(val);
                      fetchBillingDetails(val);
                    }}
                    placeholder="Type to search guest or room..."
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {loadingBill ? (
          <div className="text-center py-5">
            <div className="spinner-border text-pcc-primary" role="status">
              <span className="visually-hidden">Calculating bill details...</span>
            </div>
          </div>
        ) : billDetails ? (
          <div className="row g-4">
            {/* Statement details */}
            <div className="col-lg-8">
              <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '8px' }}>
                <div className="card-header bg-white border-0 py-3 border-bottom d-flex justify-content-between align-items-center">
                  <h5 className="fw-bold mb-0 text-dark">Statement of Account</h5>
                  <span className="badge bg-light text-pcc-primary border border-pcc-primary px-3 py-2 rounded">
                    Room {billDetails.booking.roomNumber}
                  </span>
                </div>
                <div className="card-body p-4" style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
                  {/* Guest and stay details */}
                  <div className="row mb-4 bg-light p-3 rounded g-2" style={{ fontSize: '0.9rem' }}>
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
                  <h6 className="fw-bold text-dark mb-3 border-bottom pb-2">Room Rent Charges</h6>
                  <div className="table-responsive mb-3">
                    <table className="table table-sm mb-0">
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
                          <td>{billDetails.booking.roomType} (Room {billDetails.booking.roomNumber})</td>
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
                        {billDetails.chargesSummary.totalDiscount > 0 && (
                          <tr className="table-light">
                            <td colSpan="3" className="fw-semibold">Final Room Charge Due</td>
                            <td className="text-end fw-bold text-dark">₱{parseFloat(billDetails.chargesSummary.room).toFixed(2)}</td>
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
                            <td colSpan="3">Late Check-Out / Extension Fee (₱150/hr after 12:00 PM)</td>
                            <td className="text-end fw-semibold text-danger">₱{parseFloat(billDetails.chargesSummary.lateCheckOut).toFixed(2)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Registered Guests Pax breakdown list */}
                  {billDetails.guestsList && billDetails.guestsList.length > 0 && (
                    <div className="mb-4 bg-light p-3 rounded border animate__animated animate__fadeIn" style={{ fontSize: '0.82rem' }}>
                      <div className="fw-bold mb-2 text-dark d-flex justify-content-between align-items-center">
                        <span>👥 Registered Room Guests ({billDetails.guestsList.length} Pax)</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          style={{ fontSize: '0.78rem', padding: '2px 10px', borderRadius: '15px' }}
                          onClick={openEditDiscountsModal}
                        >
                          ✏️ Apply/Edit Discounts
                        </button>
                      </div>
                      <div className="row g-2">
                        {billDetails.guestsList.map((g, index) => (
                          <div key={index} className="col-md-6">
                            <div className="p-2 border rounded bg-white h-100 d-flex justify-content-between align-items-center shadow-sm">
                              <div>
                                <span className="fw-semibold text-dark">{g.fullName}</span> 
                                <span className="text-muted"> ({g.age} yrs)</span>
                                {g.discountName && (
                                  <div className="text-success fw-semibold" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                                    ✓ {g.discountName} {g.discountIdNumber ? `(${g.discountIdNumber})` : ''}
                                  </div>
                                )}
                              </div>
                              <div className="text-end font-monospace ms-2">
                                {g.discount > 0 ? (
                                  <>
                                    <div className="text-decoration-line-through text-muted" style={{ fontSize: '0.72rem' }}>₱{parseFloat(g.share).toFixed(2)}</div>
                                    <div className="text-success fw-bold">₱{parseFloat(g.netShare).toFixed(2)}</div>
                                  </>
                                ) : (
                                  <div className="text-dark fw-semibold">₱{parseFloat(g.share).toFixed(2)}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extra product orders */}
                  <h6 className="fw-bold text-dark mb-3 border-bottom pb-2">Product Charges (Drinks/Snacks/Meals)</h6>
                  <div className="table-responsive mb-4">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr className="table-light">
                          <th>Product Name</th>
                          <th>Unit Price</th>
                          <th>Qty</th>
                          <th className="text-end">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billDetails.productCharges.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="text-center py-3 text-muted small">No product orders recorded.</td>
                          </tr>
                        ) : (
                          billDetails.productCharges.map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.name}</td>
                              <td>₱{parseFloat(item.price).toFixed(2)}</td>
                              <td>{item.quantity}</td>
                              <td className="text-end fw-bold text-dark">₱{parseFloat(item.subtotal).toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Extra amenity orders */}
                  <h6 className="fw-bold text-dark mb-3 border-bottom pb-2">Amenity Charges (Extra Foam/Linen/Toiletries)</h6>
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr className="table-light">
                          <th>Amenity Name</th>
                          <th>Unit Price</th>
                          <th>Qty</th>
                          <th className="text-end">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billDetails.amenityCharges.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="text-center py-3 text-muted small">No extra amenity requests recorded.</td>
                          </tr>
                        ) : (
                          billDetails.amenityCharges.map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.name}</td>
                              <td>₱{parseFloat(item.price).toFixed(2)}</td>
                              <td>{item.quantity}</td>
                              <td className="text-end fw-bold text-dark">₱{parseFloat(item.subtotal).toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Incidental Charges */}
                  <div className="d-flex justify-content-between align-items-center mb-3 mt-4 border-bottom pb-2">
                    <h6 className="fw-bold text-dark mb-0">Incidental & Damage Charges</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => {
                        setIncidentalForm({ description: '', amount: '' });
                        setIsAddingIncidental(true);
                      }}
                    >
                      + Add Incidental Charge
                    </button>
                  </div>
                  <div className="table-responsive mb-4">
                    <table className="table table-sm mb-0">
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
                            <td colSpan="4" className="text-center py-3 text-muted small">No incidental charges recorded.</td>
                          </tr>
                        ) : (
                          billDetails.incidentalCharges.map((item) => (
                            <tr key={item.chargeID}>
                              <td>{item.description}</td>
                              <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                              <td className="text-end fw-semibold text-danger">₱{parseFloat(item.amount).toFixed(2)}</td>
                              <td className="text-end">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger py-0 px-2"
                                  onClick={() => handleDeleteIncidentalSubmit(item.chargeID)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Borrowed items list */}
                  <h6 className="fw-bold text-dark mb-3 border-bottom pb-2 mt-4">Borrowed Room Items & Amenities</h6>
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr className="table-light">
                          <th>Item Name</th>
                          <th>Qty</th>
                          <th>Borrow Date</th>
                          <th>Status</th>
                          <th>Condition / Remarks</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billDetails.borrowItems.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="text-center py-3 text-muted small">No borrowed items recorded for this stay.</td>
                          </tr>
                        ) : (
                          billDetails.borrowItems.map((item) => (
                            <tr key={item.borrowID}>
                              <td>{item.itemName}</td>
                              <td>{item.quantity}</td>
                              <td>{new Date(item.borrowDateTime).toLocaleDateString()}</td>
                              <td>
                                <span className={`badge ${
                                  item.status === 'Borrowed' ? 'bg-warning text-dark' : 
                                  item.status === 'Returned' ? 'bg-success' : 'bg-danger'
                                }`}>
                                  {item.status}
                                </span>
                              </td>
                              <td>{item.remarks || item.conditionUponReturn || '—'}</td>
                              <td className="text-end">
                                {item.status === 'Borrowed' && (
                                  <div className="d-flex justify-content-end gap-1">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger py-0 px-2"
                                      onClick={() => openReportDamageModal(item)}
                                    >
                                      Lost/Damaged
                                    </button>
                                  </div>
                                )}
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

            {/* Bill Summary Panel */}
            <div className="col-lg-4">
              <div className="card shadow-sm border-0 mb-4 bg-white" style={{ borderRadius: '8px' }}>
                <div className="card-header bg-white border-0 py-3 border-bottom">
                  <h5 className="fw-bold mb-0 text-dark">Payment Summary</h5>
                </div>
                <div className="card-body p-4" style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">Room Rent:</span>
                    <span className="fw-semibold text-dark">₱{parseFloat(billDetails.chargesSummary.room).toFixed(2)}</span>
                  </div>
                  {billDetails.chargesSummary.earlyCheckIn > 0 && (
                    <div className="d-flex justify-content-between mb-2 text-danger">
                      <span>Early Check-in Fee:</span>
                      <span>₱{parseFloat(billDetails.chargesSummary.earlyCheckIn).toFixed(2)}</span>
                    </div>
                  )}
                  {billDetails.chargesSummary.lateCheckOut > 0 && (
                    <div className="d-flex justify-content-between mb-2 text-danger">
                      <span>Late Check-out / Extension Fee:</span>
                      <span>₱{parseFloat(billDetails.chargesSummary.lateCheckOut).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">Product charges:</span>
                    <span className="fw-semibold text-dark">₱{parseFloat(billDetails.chargesSummary.products).toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">Amenity charges:</span>
                    <span className="fw-semibold text-dark">₱{parseFloat(billDetails.chargesSummary.amenities).toFixed(2)}</span>
                  </div>
                  {parseFloat(billDetails.chargesSummary.incidentals || 0) > 0 && (
                    <div className="d-flex justify-content-between mb-3 text-danger">
                      <span>Incidental charges:</span>
                      <span className="fw-semibold">₱{parseFloat(billDetails.chargesSummary.incidentals).toFixed(2)}</span>
                    </div>
                  )}
                  
                  <hr className="mt-0" />
                  
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>Grand Total Charges:</span>
                    <span className="fw-bold text-pcc-primary" style={{ fontSize: '1.25rem' }}>
                      ₱{parseFloat(billDetails.chargesSummary.total).toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="d-flex justify-content-between mb-3 text-success">
                    <span>Amount Paid:</span>
                    <span className="fw-semibold">₱{parseFloat(billDetails.chargesSummary.paid).toFixed(2)}</span>
                  </div>

                  <div className="d-flex justify-content-between align-items-center p-3 bg-danger-subtle rounded border border-danger-subtle mb-4">
                    <span className="fw-bold text-danger">Outstanding Balance:</span>
                    <span className="fw-bold text-danger" style={{ fontSize: '1.3rem' }}>
                      ₱{parseFloat(billDetails.chargesSummary.balance).toFixed(2)}
                    </span>
                  </div>

                  {billDetails.chargesSummary.balance > 0 ? (
                    <a
                      href={`/receptionist/payments?bookingID=${selectedBookingID}`}
                      className="btn btn-pcc-primary text-white w-100 py-2 fw-semibold"
                    >
                      💳 Go to Payment Checkout
                    </a>
                  ) : (
                    <div className="alert alert-success text-center py-2 mb-0 fw-semibold">
                      ✓ Bill fully settled.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card shadow-sm border-0" style={{ borderRadius: '8px' }}>
            <div className="card-body text-center py-5 text-muted">
              <span style={{ fontSize: '3rem' }}>🧾</span>
              <h5 className="mt-3">No stay selected</h5>
              <p className="small mb-0">Please choose a guest from the active checked-in list dropdown above to display their current billing breakdown.</p>
            </div>
          </div>
        )}
      </div>

      {/* EDIT DISCOUNTS MODAL */}
      {isEditingDiscounts && billDetails && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Apply Guest Discounts — Room {billDetails.booking.roomNumber}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setIsEditingDiscounts(false)}></button>
              </div>
              <form onSubmit={handleSaveDiscountsSubmit}>
                <div className="modal-body">
                  <p className="text-muted small">Specify Senior Citizen, PWD, or other applicable discounts for each registered guest below.</p>
                  
                  <div className="d-flex flex-column gap-3">
                    {guestDiscountsForm.map((g, idx) => (
                      <div key={g.bookingGuestID} className="p-3 border rounded bg-light">
                        <div className="row align-items-center g-2">
                          <div className="col-md-4">
                            <label className="fw-bold mb-0 text-dark" style={{ fontSize: '0.9rem' }}>{g.fullName}</label>
                            <div className="text-muted small">Age: {g.age} years</div>
                          </div>
                          <div className="col-md-4">
                            <label className="form-label small mb-1 fw-semibold">Select Discount</label>
                            <select
                              className="form-select form-select-sm"
                              value={g.discountID}
                              onChange={(e) => {
                                const newID = e.target.value;
                                const updated = [...guestDiscountsForm];
                                updated[idx].discountID = newID;
                                if (!newID) {
                                  updated[idx].discountIdNumber = '';
                                }
                                setGuestDiscountsForm(updated);
                              }}
                            >
                              <option value="">No Discount</option>
                              {billDetails.discounts.map(d => (
                                <option key={d.discountID} value={d.discountID}>
                                  {d.name} ({d.percentage}%)
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-md-4">
                            <label className="form-label small mb-1 fw-semibold">Discount ID Card Number</label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              required={!!g.discountID}
                              disabled={!g.discountID}
                              placeholder="e.g. OSCA-XXXXX"
                              value={g.discountIdNumber}
                              onChange={(e) => {
                                const updated = [...guestDiscountsForm];
                                updated[idx].discountIdNumber = e.target.value;
                                setGuestDiscountsForm(updated);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="modal-footer border-top-0">
                  <button type="submit" className="btn btn-pcc-primary text-white">Save & Recalculate Bill</button>
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setIsEditingDiscounts(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ADD INCIDENTAL MODAL */}
      {isAddingIncidental && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
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
                  <button type="submit" className="btn btn-danger text-white">Add Charge</button>
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setIsAddingIncidental(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* REPORT DAMAGE MODAL */}
      {isReportingDamage && selectedBorrowItem && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
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
