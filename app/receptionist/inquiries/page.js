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
      // Use lightweight endpoint to prevent slow load times
      const res = await fetch('/api/receptionist/bookings?discountsOnly=true');
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

  const handleCreateBookingRedirect = () => {
    const selectedRoom = availRooms.find(r => String(r.roomID) === quoteGuest.roomID);
    if (!selectedRoom) return;

    const query = new URLSearchParams({
      firstName: quoteGuest.firstName,
      lastName: quoteGuest.lastName,
      email: quoteGuest.email,
      contact: quoteGuest.contact,
      roomID: quoteGuest.roomID,
      roomType: selectedRoom.roomType,
      discountID: quoteGuest.discountID,
      checkIn: availForm.checkIn,
      checkOut: availForm.checkOut
    }).toString();

    window.location.href = `/receptionist/bookings?${query}`;
  };

  const handleCreateReservationRedirect = () => {
    const selectedRoom = availRooms.find(r => String(r.roomID) === quoteGuest.roomID);
    if (!selectedRoom) return;

    const query = new URLSearchParams({
      firstName: quoteGuest.firstName,
      lastName: quoteGuest.lastName,
      email: quoteGuest.email,
      contact: quoteGuest.contact,
      roomID: quoteGuest.roomID,
      roomType: selectedRoom.roomType,
      checkIn: availForm.checkIn,
      checkOut: availForm.checkOut
    }).toString();

    window.location.href = `/receptionist/reservations?${query}`;
  };

  // Messenger avatar helper functions
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = ['#0d6efd', '#198754', '#dc3545', '#ffc107', '#0dcaf0', '#6610f2', '#fd7e14'];
    if (!name) return colors[0];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  };

  // Calculations for quotation preview
  const selectedRoom = availRooms.find(r => String(r.roomID) === quoteGuest.roomID);
  let nights = 0;
  let rate = 0;
  let originalRoomCharge = 0;
  let totalDiscount = 0;
  let netRoomCharge = 0;
  let downPaymentRequired = 0;

  if (selectedRoom) {
    const cIn = new Date(availForm.checkIn);
    const cOut = new Date(availForm.checkOut);
    const diffTime = Math.abs(cOut - cIn);
    nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    rate = parseFloat(selectedRoom.rate);
    originalRoomCharge = rate * nights;

    const selectedDiscount = discounts.find(d => String(d.discountID) === quoteGuest.discountID);
    if (selectedDiscount) {
      totalDiscount = originalRoomCharge * (parseFloat(selectedDiscount.percentage) / 100);
    }
    netRoomCharge = originalRoomCharge - totalDiscount;
    downPaymentRequired = netRoomCharge * 0.5; // 50% downpayment quote
  }

  // Filter inquiries
  const filteredInquiries = inquiries.filter(inq => {
    const matchesSearch = 
      (inq.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (inq.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (inq.message || '').toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <>
      <div className="container-fluid py-4" style={{ backgroundColor: '#f8f9fa', minHeight: '85vh' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
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
            <div className="col-md-4">
              <div className="card shadow-sm border-0" style={{ borderRadius: '8px', height: '650px', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
                <div className="card-header bg-white py-3 border-0 border-bottom">
                  <h5 className="fw-bold mb-3 text-dark">Conversations</h5>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search inquiries..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ borderRadius: '20px', paddingLeft: '15px' }}
                  />
                </div>
                <div className="card-body p-0 overflow-auto flex-grow-1" style={{ maxHeight: '550px' }}>
                  {loading ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : filteredInquiries.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      <p className="mb-0">No conversations found.</p>
                    </div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {filteredInquiries.map(inq => {
                        const initials = getInitials(inq.name);
                        const avatarColor = getAvatarColor(inq.name);
                        const isSelected = selectedInquiry?.inquiryID === inq.inquiryID;
                        return (
                          <button
                            key={inq.inquiryID}
                            onClick={() => {
                              setSelectedInquiry(inq);
                              setReplyText('');
                            }}
                            className={`list-group-item list-group-item-action d-flex align-items-center gap-3 p-3 border-0 border-bottom ${isSelected ? 'bg-light border-start border-primary border-4' : ''}`}
                            style={{ transition: 'all 0.2s', borderLeft: isSelected ? '4px solid #0d6efd !important' : 'none' }}
                          >
                            <div 
                              className="d-flex align-items-center justify-content-center rounded-circle text-white fw-bold shadow-sm"
                              style={{ width: '42px', height: '42px', backgroundColor: avatarColor, minWidth: '42px', fontSize: '0.9rem' }}
                            >
                              {initials}
                            </div>
                            <div className="flex-grow-1 min-w-0">
                              <div className="d-flex justify-content-between align-items-baseline">
                                <h6 className={`mb-1 text-truncate ${inq.status === 'Pending' ? 'fw-bold text-dark' : 'text-secondary'}`} style={{ fontSize: '0.9rem' }}>
                                  {inq.name}
                                </h6>
                                <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                                  {new Date(inq.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </small>
                              </div>
                              <div className="text-truncate text-muted small" style={{ fontSize: '0.78rem' }}>
                                {inq.message}
                              </div>
                              <div className="d-flex gap-1 mt-1">
                                <span className={`badge rounded-pill ${inq.status === 'Responded' ? 'bg-success text-white' : 'bg-warning text-dark'}`} style={{ fontSize: '0.65rem' }}>
                                  {inq.status}
                                </span>
                                {inq.isChatbotForwarded === 1 && (
                                  <span className="badge bg-info text-white rounded-pill" style={{ fontSize: '0.65rem' }}>
                                    🤖 Chatbot
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Details Panel / Messenger Chat Box */}
            <div className="col-md-8">
              <div className="card shadow-sm border-0" style={{ borderRadius: '8px', height: '650px', display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
                {selectedInquiry ? (
                  <>
                    {/* Chat Header */}
                    <div className="card-header bg-white border-0 py-3 px-4 border-bottom d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center gap-3">
                        <div 
                          className="d-flex align-items-center justify-content-center rounded-circle text-white fw-bold shadow-sm"
                          style={{ width: '48px', height: '48px', backgroundColor: getAvatarColor(selectedInquiry.name), fontSize: '1rem' }}
                        >
                          {getInitials(selectedInquiry.name)}
                        </div>
                        <div>
                          <h5 className="fw-bold mb-1 text-dark">{selectedInquiry.name}</h5>
                          <div className="text-muted small" style={{ fontSize: '0.8rem' }}>
                            {selectedInquiry.email} {selectedInquiry.contact ? `• ${selectedInquiry.contact}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                        {/* Pre-fill booking link */}
                        <a 
                          href={`/receptionist/bookings?firstName=${encodeURIComponent(selectedInquiry.name.split(' ')[0] || '')}&lastName=${encodeURIComponent(selectedInquiry.name.split(' ').slice(1).join(' ') || '')}&email=${encodeURIComponent(selectedInquiry.email || '')}&contact=${encodeURIComponent(selectedInquiry.contact || '')}`}
                          className="btn btn-primary text-white px-3 py-2 fw-semibold"
                        >
                          💸 Book Stay
                        </a>
                        <a 
                          href={`/receptionist/reservations?firstName=${encodeURIComponent(selectedInquiry.name.split(' ')[0] || '')}&lastName=${encodeURIComponent(selectedInquiry.name.split(' ').slice(1).join(' ') || '')}&email=${encodeURIComponent(selectedInquiry.email || '')}&contact=${encodeURIComponent(selectedInquiry.contact || '')}`}
                          className="btn btn-success text-white px-3 py-2 fw-semibold"
                        >
                          📅 Reserve Stay
                        </a>
                      </div>
                    </div>

                    {/* Chat Message History Thread */}
                    <div className="card-body p-4 overflow-auto flex-grow-1 d-flex flex-column gap-3 bg-light" style={{ maxHeight: '420px' }}>
                      
                      {/* Date Separator */}
                      <div className="text-center my-2">
                        <span className="badge bg-secondary-subtle text-secondary px-3 py-1 rounded-pill" style={{ fontSize: '0.72rem' }}>
                          Inquiry Received on {new Date(selectedInquiry.createdAt).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
                        </span>
                      </div>

                      {/* Guest Inquiry Message bubble (Left side) */}
                      <div className="d-flex align-items-start gap-2 max-w-75 align-self-start">
                        <div 
                          className="d-flex align-items-center justify-content-center rounded-circle text-white fw-bold shadow-sm"
                          style={{ width: '32px', height: '32px', backgroundColor: getAvatarColor(selectedInquiry.name), minWidth: '32px', fontSize: '0.75rem' }}
                        >
                          {getInitials(selectedInquiry.name)}
                        </div>
                        <div>
                          <div className="p-3 bg-white text-dark shadow-xs border" style={{ borderRadius: '4px 18px 18px 18px', maxWidth: '100%', wordBreak: 'break-word' }}>
                            <p className="mb-0" style={{ whiteSpace: 'pre-line', fontSize: '0.9rem', lineHeight: '1.5' }}>
                              {selectedInquiry.message}
                            </p>
                          </div>
                          <small className="text-muted ms-2 mt-1 d-block" style={{ fontSize: '0.7rem' }}>
                            {new Date(selectedInquiry.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </small>
                        </div>
                      </div>

                      {/* Forwarded by Chatbot notice */}
                      {selectedInquiry.isChatbotForwarded === 1 && (
                        <div className="text-center my-1 align-self-center">
                          <span className="badge bg-info-subtle text-info border border-info-subtle px-3 py-1 rounded">
                            🤖 Forwarded from PCC Virtual Chatbot Assistant
                          </span>
                        </div>
                      )}

                      {/* Receptionist Response message bubble (Right side) */}
                      {selectedInquiry.response && (
                        <div className="d-flex align-items-end gap-2 max-w-75 align-self-end text-end">
                          <div>
                            <div className="p-3 bg-primary text-white shadow-xs" style={{ borderRadius: '18px 4px 18px 18px', textAlign: 'left', wordBreak: 'break-word' }}>
                              <p className="mb-0" style={{ whiteSpace: 'pre-line', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                {selectedInquiry.response}
                              </p>
                            </div>
                            <small className="text-muted me-2 mt-1 d-block" style={{ fontSize: '0.7rem' }}>
                              ✓✓ Sent • {selectedInquiry.responseCreatedAt ? new Date(selectedInquiry.responseCreatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'Responded'}
                            </small>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Chat Input Footer Form */}
                    <div className="card-footer bg-white border-0 p-3 border-top">
                      <form onSubmit={handleReplySubmit} className="d-flex gap-2">
                        <textarea
                          className="form-control flex-grow-1"
                          rows="2"
                          placeholder={selectedInquiry.status === 'Responded' ? "Type another response to the guest..." : "Type your response to reply..."}
                          required
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          style={{ borderRadius: '12px', resize: 'none', padding: '10px 15px' }}
                        ></textarea>
                        <button type="submit" className="btn btn-primary text-white px-4 d-flex align-items-center justify-content-center fw-bold" style={{ borderRadius: '12px', minWidth: '120px' }}>
                          Send ✉
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className="card-body d-flex align-items-center justify-content-center text-muted">
                    <div className="text-center">
                      <span style={{ fontSize: '3.5rem' }}>💬</span>
                      <h5 className="mt-3 fw-bold">No conversation selected</h5>
                      <p className="small">Select a guest from the left sidebar to view message history and send replies.</p>
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

                  <button type="submit" className="btn btn-primary text-white w-100 py-2 fw-bold" disabled={checkingAvail}>
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
                          className="btn btn-primary text-white w-100 mb-2 py-2 fw-bold"
                          disabled={!quoteGuest.firstName || !quoteGuest.lastName}
                          onClick={handleCreateBookingRedirect}
                        >
                          💸 Proceed to Settle & Book Stay
                        </button>
                        <button
                          type="button"
                          className="btn btn-success text-white w-100 py-2 fw-bold"
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
