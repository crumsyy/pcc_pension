'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';

export default function ReceptionistBilling() {
  const [activeBookings, setActiveBookings] = useState([]);
  const [selectedBookingID, setSelectedBookingID] = useState('');
  const [billDetails, setBillDetails] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingBill, setLoadingBill] = useState(false);

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

  useEffect(() => {
    fetchActiveBookings();
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
                  <select
                    className="form-select form-select-lg"
                    value={selectedBookingID}
                    onChange={handleBookingChange}
                    style={{ borderRadius: '6px' }}
                  >
                    <option value="">-- Choose Checked-In Guest --</option>
                    {activeBookings.map(b => (
                      <option key={b.bookingID} value={b.bookingID}>
                        Room {b.roomNumber} — {b.lastName}, {b.firstName} ({b.status})
                      </option>
                    ))}
                  </select>
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
                <div className="card-body p-4">
                  {/* Guest and stay details */}
                  <div className="row mb-4 bg-light p-3 rounded g-2" style={{ fontSize: '0.9rem' }}>
                    <div className="col-md-6">
                      <div className="text-muted">Guest Name</div>
                      <div className="fw-bold text-dark">{billDetails.booking.firstName} {billDetails.booking.lastName}</div>
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
                                <strong>Discount Apportionment (R.A. 9994 / R.A. 10754):</strong>
                                <ul className="mb-0 mt-1" style={{ listStyleType: 'square' }}>
                                  <li>Total Registered Guests: <strong>{billDetails.chargesSummary.totalGuests} Pax</strong></li>
                                  <li>Individual Guest Share: <strong>₱{parseFloat(billDetails.chargesSummary.sharePerGuest).toFixed(2)}</strong></li>
                                  <li>
                                    Seniors/PWDs: <strong>{billDetails.guestsList.filter(g => g.discountID).length} Guest(s)</strong> (VAT exempt + 20% discount applied to their individual share)
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
                        <span className="small text-muted font-monospace">Room Rent split equally</span>
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
                </div>
              </div>
            </div>

            {/* Bill Summary Panel */}
            <div className="col-lg-4">
              <div className="card shadow-sm border-0 mb-4 bg-white" style={{ borderRadius: '8px' }}>
                <div className="card-header bg-white border-0 py-3 border-bottom">
                  <h5 className="fw-bold mb-0 text-dark">Payment Summary</h5>
                </div>
                <div className="card-body p-4">
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
                  <div className="d-flex justify-content-between mb-3">
                    <span className="text-muted">Amenity charges:</span>
                    <span className="fw-semibold text-dark">₱{parseFloat(billDetails.chargesSummary.amenities).toFixed(2)}</span>
                  </div>
                  
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
