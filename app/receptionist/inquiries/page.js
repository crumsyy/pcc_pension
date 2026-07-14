'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';

export default function ReceptionistInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [replyText, setReplyText] = useState('');

  // Tab State: 'inbox' | 'availability'
  const [activeTab, setActiveTab] = useState('inbox');

  // Availability & Quotation Form State
  const [availForm, setAvailForm] = useState({
    checkIn: new Date().toISOString().split('T')[0],
    checkOut: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    roomType: 'Any room type',
    breakfast: 'With Breakfast'
  });
  const [availRooms, setAvailRooms] = useState([]);
  const [checkingAvail, setCheckingAvail] = useState(false);

  // Quotation guest details
  const [quoteGuest, setQuoteGuest] = useState({
    firstName: '',
    lastName: '',
    email: '',
    contact: '',
    roomID: '',
    discountID: '',
    numGuests: '1'
  });
  const [discounts, setDiscounts] = useState([]);

  // Modal alert/confirm
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

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/receptionist/inquiries');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch inquiries');
      setInquiries(data.inquiries || []);
      if (data.inquiries?.length > 0 && !selectedInquiry) {
        setSelectedInquiry(data.inquiries[0]);
      }
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscounts = async () => {
    try {
      const res = await fetch('/api/receptionist/bookings');
      const data = await res.json();
      if (data.discounts) {
        setDiscounts(data.discounts);
      }
    } catch (err) {
      console.error("Failed to load discounts:", err);
    }
  };

  useEffect(() => {
    fetchInquiries();
    fetchDiscounts();
  }, []);

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    try {
      const res = await fetch('/api/receptionist/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond',
          inquiryID: selectedInquiry.inquiryID,
          response: replyText
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reply');

      showAlert('success', 'Success', 'Response recorded successfully.');
      setReplyText('');
      
      const updatedInquiry = {
        ...selectedInquiry,
        status: 'Responded',
        response: replyText
      };
      setSelectedInquiry(updatedInquiry);
      fetchInquiries();
    } catch (err) {
      showAlert('error', 'Error', err.message);
    }
  };

  const checkRoomAvailability = async (e) => {
    e.preventDefault();
    setCheckingAvail(true);
    setAvailRooms([]);
    setQuoteGuest(prev => ({ ...prev, roomID: '' })); // reset selected room
    try {
      const res = await fetch(
        `/api/rooms/availability?checkIn=${availForm.checkIn}&checkOut=${availForm.checkOut}&roomType=${encodeURIComponent(availForm.roomType)}&breakfast=${encodeURIComponent(availForm.breakfast)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to check room availability');
      setAvailRooms(data.rooms || []);
      if (data.rooms?.length === 0) {
        showAlert('warning', 'No Rooms Available', 'No vacant rooms match your specified dates and criteria.');
      }
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setCheckingAvail(false);
    }
  };

  const filteredInquiries = inquiries.filter(inq => 
    inq.name.toLowerCase().includes(search.toLowerCase()) ||
    inq.email.toLowerCase().includes(search.toLowerCase()) ||
    inq.message.toLowerCase().includes(search.toLowerCase())
  );

  // Quotation calculation details
  const selectedRoom = availRooms.find(r => r.roomID === parseInt(quoteGuest.roomID));
  const nights = Math.ceil((new Date(availForm.checkOut) - new Date(availForm.checkIn)) / (1000 * 60 * 60 * 24)) || 1;
  const rate = selectedRoom ? parseFloat(selectedRoom.rate || 0) : 0;
  const originalRoomCharge = rate * nights;

  const selectedDisc = discounts.find(d => d.discountID === parseInt(quoteGuest.discountID));
  const discountPercentage = selectedDisc ? parseFloat(selectedDisc.percentage) : 0;
  
  // Down payment 50%
  const individualShare = originalRoomCharge / parseInt(quoteGuest.numGuests || 1);
  const discountVal = individualShare * (discountPercentage / 100);
  const totalDiscount = discountVal; // only applying to 1 guest share in quote preview
  const netRoomCharge = originalRoomCharge - totalDiscount;
  const downPaymentRequired = netRoomCharge * 0.50;

  const handleCreateBookingRedirect = () => {
    if (!quoteGuest.roomID) return;
    const url = `/receptionist/bookings?action=new&checkIn=${availForm.checkIn}&checkOut=${availForm.checkOut}&roomID=${quoteGuest.roomID}&firstName=${encodeURIComponent(quoteGuest.firstName)}&lastName=${encodeURIComponent(quoteGuest.lastName)}&email=${encodeURIComponent(quoteGuest.email)}&contact=${encodeURIComponent(quoteGuest.contact)}&discountID=${quoteGuest.discountID}&breakfast=${encodeURIComponent(availForm.breakfast)}`;
    window.location.href = url;
  };

  const handleCreateReservationRedirect = () => {
    if (!quoteGuest.roomID) return;
    const url = `/receptionist/reservations?action=new&checkIn=${availForm.checkIn}&checkOut=${availForm.checkOut}&roomID=${quoteGuest.roomID}&firstName=${encodeURIComponent(quoteGuest.firstName)}&lastName=${encodeURIComponent(quoteGuest.lastName)}&email=${encodeURIComponent(quoteGuest.email)}&contact=${encodeURIComponent(quoteGuest.contact)}&discountID=${quoteGuest.discountID}&breakfast=${encodeURIComponent(availForm.breakfast)}`;
    window.location.href = url;
  };

  return (
    <>
      <div className="container-fluid py-4" style={{ backgroundColor: '#f8f9fa', minHeight: '85vh' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h2 className="fw-bold mb-1 text-pcc-blue" style={{ color: 'var(--pcc-blue)' }}>Guest Inquiries & Quotation Desk</h2>
            <p className="text-muted mb-0">Respond to message submissions or calculate stay quotations and schedule bookings.</p>
          </div>
        </div>

        {/* Tab selection */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button
              className={`nav-link fw-semibold ${activeTab === 'inbox' ? 'active text-primary' : 'text-secondary'}`}
              onClick={() => setActiveTab('inbox')}
              style={{ borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}
            >
              📥 Guest Messages Inbox
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link fw-semibold ${activeTab === 'availability' ? 'active text-primary' : 'text-secondary'}`}
              onClick={() => setActiveTab('availability')}
              style={{ borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}
            >
              🔍 Room Availability & Quotation Tool
            </button>
          </li>
        </ul>

        {activeTab === 'inbox' ? (
          <div className="row g-4 animate__animated animate__fadeIn">
            {/* List Sidebar */}
            <div className="col-md-5 col-lg-4">
              <div className="card shadow-sm border-0" style={{ borderRadius: '8px', height: '650px', display: 'flex', flexDirection: 'column' }}>
                <div className="card-header bg-white py-3 border-0">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search inquiries..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ borderRadius: '20px', paddingLeft: '15px' }}
                  />
                </div>
                <div className="card-body p-0 overflow-auto" style={{ flex: 1 }}>
                  {loading ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-pcc-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : filteredInquiries.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      <p className="mb-0">No inquiries found.</p>
                    </div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {filteredInquiries.map(inq => (
                        <button
                          key={inq.inquiryID}
                          onClick={() => {
                            setSelectedInquiry(inq);
                            setReplyText('');
                          }}
                          className={`list-group-item list-group-item-action p-3 text-start border-0 border-bottom ${selectedInquiry?.inquiryID === inq.inquiryID ? 'bg-light border-start border-primary border-4' : ''}`}
                          style={{ transition: 'all 0.2s' }}
                        >
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="fw-bold text-dark">{inq.name}</span>
                            <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                              {new Date(inq.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <div className="mb-2 text-truncate text-muted" style={{ fontSize: '0.85rem' }}>
                            {inq.message}
                          </div>
                          <div className="d-flex gap-1 flex-wrap">
                            <span className={`badge px-2 py-1 rounded-pill ${inq.status === 'Responded' ? 'bg-success text-white' : 'bg-warning text-dark'}`} style={{ fontSize: '0.7rem' }}>
                              {inq.status}
                            </span>
                            {inq.isChatbotForwarded === 1 && (
                              <span className="badge bg-info text-white px-2 py-1 rounded-pill" style={{ fontSize: '0.7rem' }}>
                                🤖 Chatbot
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Details Panel */}
            <div className="col-md-7 col-lg-8">
              <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '8px', minHeight: '650px', display: 'flex', flexDirection: 'column' }}>
                {selectedInquiry ? (
                  <>
                    <div className="card-header bg-white border-0 py-3 px-4 border-bottom">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <h4 className="fw-bold mb-0 text-dark">{selectedInquiry.name}</h4>
                          <span className="text-muted" style={{ fontSize: '0.88rem' }}>{selectedInquiry.email}</span>
                        </div>
                        <div className="d-flex gap-2">
                          {selectedInquiry.isChatbotForwarded === 1 && (
                            <span className="badge bg-light text-info border border-info px-3 py-2 rounded">
                              Forwarded by Chatbot
                            </span>
                          )}
                          <span className={`badge px-3 py-2 rounded ${selectedInquiry.status === 'Responded' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`} style={{ border: '1px solid currentColor' }}>
                            {selectedInquiry.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="card-body p-4 overflow-auto" style={{ flex: 1 }}>
                      <div className="p-3 mb-4 rounded border-0 bg-light" style={{ borderLeft: '4px solid var(--pcc-blue)', background: '#f1f3f5' }}>
                        <h6 className="fw-bold mb-2">Message:</h6>
                        <p className="mb-0 text-dark" style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                          {selectedInquiry.message}
                        </p>
                        <div className="text-end text-muted mt-2" style={{ fontSize: '0.78rem' }}>
                          Received: {new Date(selectedInquiry.createdAt).toLocaleString()}
                        </div>
                      </div>

                      {selectedInquiry.response && (
                        <div className="p-3 mb-4 rounded bg-success-subtle text-success border border-success-subtle">
                          <h6 className="fw-bold mb-2">Submitted Response:</h6>
                          <p className="mb-0 text-dark" style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                            {selectedInquiry.response}
                          </p>
                        </div>
                      )}

                      <form onSubmit={handleReplySubmit}>
                        <div className="mb-3">
                          <label className="form-label fw-bold text-dark">
                            {selectedInquiry.status === 'Responded' ? 'Send Another Response:' : 'Reply Response:'}
                          </label>
                          <textarea
                            className="form-control"
                            rows="6"
                            placeholder="Type your response to the guest..."
                            required
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            style={{ borderRadius: '6px' }}
                          ></textarea>
                        </div>
                        <div className="text-end">
                          <button type="submit" className="btn btn-pcc-primary text-white px-4">
                            Send Response
                          </button>
                        </div>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className="card-body d-flex align-items-center justify-content-center text-muted">
                    <div className="text-center">
                      <span style={{ fontSize: '3rem' }}>💬</span>
                      <h5 className="mt-3">No inquiry selected</h5>
                      <p className="small">Select an inquiry from the inbox sidebar list to view details.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="row g-4 animate__animated animate__fadeIn">
            {/* Availability search panel */}
            <div className="col-md-5 col-lg-4">
              <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '8px', minHeight: '550px' }}>
                <h5 className="fw-bold mb-3 text-dark">Check Room Vacancy</h5>
                <form onSubmit={checkRoomAvailability}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Check-In Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      required
                      value={availForm.checkIn}
                      onChange={(e) => setAvailForm(prev => ({ ...prev, checkIn: e.target.value }))}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Check-Out Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      required
                      value={availForm.checkOut}
                      onChange={(e) => setAvailForm(prev => ({ ...prev, checkOut: e.target.value }))}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Room Type</label>
                    <select
                      className="form-select"
                      value={availForm.roomType}
                      onChange={(e) => setAvailForm(prev => ({ ...prev, roomType: e.target.value }))}
                    >
                      <option value="Any room type">Any Room Type</option>
                      <option value="Single Room">Single Room</option>
                      <option value="Double Room">Double Room</option>
                      <option value="Suite">Suite</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold small">Breakfast Inclusion</label>
                    <select
                      className="form-select"
                      value={availForm.breakfast}
                      onChange={(e) => setAvailForm(prev => ({ ...prev, breakfast: e.target.value }))}
                    >
                      <option value="With Breakfast">With Breakfast</option>
                      <option value="Without Breakfast">Without Breakfast</option>
                    </select>
                  </div>

                  <button type="submit" className="btn btn-pcc-primary text-white w-100 py-2 fw-bold" disabled={checkingAvail}>
                    {checkingAvail ? (
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    ) : '🔍 Check Vacancy'}
                  </button>
                </form>

                {availRooms.length > 0 && (
                  <div className="mt-4">
                    <label className="form-label fw-bold text-dark small">Select Available Room *</label>
                    <div className="list-group overflow-auto" style={{ maxHeight: '180px' }}>
                      {availRooms.map(r => (
                        <button
                          key={r.roomID}
                          type="button"
                          onClick={() => setQuoteGuest(prev => ({ ...prev, roomID: String(r.roomID) }))}
                          className={`list-group-item list-group-item-action py-2 px-3 small border d-flex justify-content-between align-items-center ${quoteGuest.roomID === String(r.roomID) ? 'active' : ''}`}
                        >
                          <span>Room {r.roomNumber} ({r.roomType})</span>
                          <span className="fw-semibold">₱{parseFloat(r.rate).toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quotation preview & actions panel */}
            <div className="col-md-7 col-lg-8">
              <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '8px', minHeight: '550px' }}>
                <h5 className="fw-bold mb-3 text-dark">Quotation & Booking Details</h5>
                
                {quoteGuest.roomID && selectedRoom ? (
                  <div className="row g-3">
                    <div className="col-md-6 border-end pe-md-4">
                      <h6 className="fw-bold mb-3 text-secondary">Guest Information</h6>
                      <div className="mb-2">
                        <label className="form-label small mb-1">First Name *</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          required
                          placeholder="e.g. Juan"
                          value={quoteGuest.firstName}
                          onChange={(e) => setQuoteGuest(prev => ({ ...prev, firstName: e.target.value }))}
                        />
                      </div>
                      <div className="mb-2">
                        <label className="form-label small mb-1">Last Name *</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          required
                          placeholder="e.g. Dela Cruz"
                          value={quoteGuest.lastName}
                          onChange={(e) => setQuoteGuest(prev => ({ ...prev, lastName: e.target.value }))}
                        />
                      </div>
                      <div className="mb-2">
                        <label className="form-label small mb-1">Email Address</label>
                        <input
                          type="email"
                          className="form-control form-control-sm"
                          placeholder="e.g. juan@example.com"
                          value={quoteGuest.email}
                          onChange={(e) => setQuoteGuest(prev => ({ ...prev, email: e.target.value }))}
                        />
                      </div>
                      <div className="mb-2">
                        <label className="form-label small mb-1">Contact Number</label>
                        <input
                          type="text"
                          maxLength="11"
                          className="form-control form-control-sm"
                          placeholder="e.g. 09171234567"
                          value={quoteGuest.contact}
                          onChange={(e) => setQuoteGuest(prev => ({ ...prev, contact: e.target.value }))}
                        />
                      </div>
                      <div className="mb-2">
                        <label className="form-label small mb-1">Discount Choice</label>
                        <select
                          className="form-select form-select-sm"
                          value={quoteGuest.discountID}
                          onChange={(e) => setQuoteGuest(prev => ({ ...prev, discountID: e.target.value }))}
                        >
                          <option value="">No Discount</option>
                          {discounts.map(d => (
                            <option key={d.discountID} value={d.discountID}>{d.name} ({d.percentage}%)</option>
                          ))}
                        </select>
                      </div>
                      <div className="mb-2">
                        <label className="form-label small mb-1">No. of Occupying Guests</label>
                        <select
                          className="form-select form-select-sm"
                          value={quoteGuest.numGuests}
                          onChange={(e) => setQuoteGuest(prev => ({ ...prev, numGuests: e.target.value }))}
                        >
                          <option value="1">1 Person</option>
                          <option value="2">2 People</option>
                          <option value="3">3 People</option>
                          <option value="4">4 People</option>
                        </select>
                      </div>
                    </div>

                    <div className="col-md-6 ps-md-4 d-flex flex-column justify-content-between">
                      <div>
                        <h6 className="fw-bold mb-3 text-secondary">Price Quotation Summary</h6>
                        <div className="p-3 bg-light rounded border border-light-subtle">
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted small">Stay Duration:</span>
                            <span className="fw-semibold small">{nights} Night(s)</span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted small">Daily Room Rate:</span>
                            <span className="fw-semibold small">₱{rate.toFixed(2)}</span>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted small">Base Room Charge:</span>
                            <span className="fw-semibold small">₱{originalRoomCharge.toFixed(2)}</span>
                          </div>
                          {totalDiscount > 0 && (
                            <div className="d-flex justify-content-between mb-2 text-danger">
                              <span className="small">Applied Discount:</span>
                              <span className="fw-semibold small">-₱{totalDiscount.toFixed(2)}</span>
                            </div>
                          )}
                          <hr className="my-2" />
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="fw-bold text-dark small">Net Room Charge:</span>
                            <span className="fw-bold text-dark fs-6">₱{netRoomCharge.toFixed(2)}</span>
                          </div>
                          <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top border-secondary-subtle text-primary">
                            <span className="fw-semibold small">50% Down Payment:</span>
                            <span className="fw-bold fs-6">₱{downPaymentRequired.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-top">
                        <button
                          type="button"
                          className="btn btn-pcc-primary text-white w-100 mb-2 py-2 fw-bold"
                          disabled={!quoteGuest.firstName || !quoteGuest.lastName}
                          onClick={handleCreateBookingRedirect}
                        >
                          💸 Proceed to Settle & Book Stay
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary w-100 py-2 fw-bold"
                          disabled={!quoteGuest.firstName || !quoteGuest.lastName}
                          onClick={handleCreateReservationRedirect}
                        >
                          📅 Proceed to Create Reservation
                        </button>
                        <p className="text-muted text-center small mt-2 mb-0" style={{ fontSize: '0.72rem' }}>
                          * First Name and Last Name are required fields to proceed to booking or reservation
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="d-flex align-items-center justify-content-center text-muted h-100 my-auto py-5">
                    <div className="text-center">
                      <span style={{ fontSize: '3rem' }}>📋</span>
                      <h6 className="mt-3">No Room Selected</h6>
                      <p className="small">Please search room vacancy and choose an available room from the list on the left to generate quotation.</p>
                    </div>
                  </div>
                )}
              </div>
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
