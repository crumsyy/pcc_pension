'use client';

import { useState, useEffect, useRef } from 'react';
import ModalDialog from '../../components/ModalDialog';

export default function ReceptionistInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Pending' | 'Responded' | 'Closed'
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [replyText, setReplyText] = useState('');
  const chatMessagesRef = useRef(null);

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

  const fetchInquiries = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const selectedID = selectedInquiry?.inquiryID ? `?inquiryID=${selectedInquiry.inquiryID}` : '';
      const res = await fetch(`/api/receptionist/inquiries${selectedID}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch inquiries');

      setInquiries(data.inquiries || []);

      if (data.inquiries?.length > 0 && !selectedInquiry) {
        setSelectedInquiry(data.inquiries[0]);
      }

      if (data.selectedMessages) {
        setMessages(data.selectedMessages);
      }
    } catch (err) {
      if (!silent) showAlert('error', 'Error', err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchMessagesForInquiry = async (inquiryID) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/receptionist/inquiries?inquiryID=${inquiryID}`);
      const data = await res.json();
      if (res.ok && data.selectedMessages) {
        setMessages(data.selectedMessages);
      }
    } catch (err) {
      console.error("Failed to load inquiry thread:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchDiscounts = async () => {
    try {
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

  // Real-time polling every 3 seconds for active inquiry list and message thread updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchInquiries(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedInquiry?.inquiryID]);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages, selectedInquiry]);

  const handleSelectInquiry = (inq) => {
    setSelectedInquiry(inq);
    fetchMessagesForInquiry(inq.inquiryID);
    // Mark as read in state
    setInquiries(prev => prev.map(item => item.inquiryID === inq.inquiryID ? { ...item, unreadReceptionist: 0 } : item));
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedInquiry) return;
    const msgToSend = replyText.trim();
    setReplyText('');

    // Optimistic UI update
    const tempMsg = {
      messageID: Date.now(),
      inquiryID: selectedInquiry.inquiryID,
      senderType: 'Receptionist',
      senderName: 'Front Desk Staff',
      message: msgToSend,
      isRead: 1,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await fetch('/api/receptionist/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond',
          inquiryID: selectedInquiry.inquiryID,
          response: msgToSend
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reply');

      if (data.messages) {
        setMessages(data.messages);
      }

      setSelectedInquiry(prev => ({ ...prev, status: 'Responded', response: msgToSend }));
      fetchInquiries(true);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedInquiry) return;
    try {
      const res = await fetch('/api/receptionist/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          inquiryID: selectedInquiry.inquiryID,
          status: newStatus
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      setSelectedInquiry(prev => ({ ...prev, status: newStatus }));
      fetchInquiries(true);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    }
  };

  const handleAppendEmoji = (emoji) => {
    setReplyText(prev => prev + emoji);
  };

  const checkRoomAvailability = async (e) => {
    e.preventDefault();
    setCheckingAvail(true);
    setAvailRooms([]);
    setQuoteGuest(prev => ({ ...prev, roomID: '' }));
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

  // Filter inquiries by search & status
  const filteredInquiries = inquiries.filter(inq => {
    const matchesSearch = 
      (inq.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (inq.contactNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (inq.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (inq.message || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || inq.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      {/* Custom Modal Dialog */}
      <ModalDialog
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
      />

      <div className="container-fluid py-3 d-flex flex-column" style={{ backgroundColor: '#f8f9fa', height: 'calc(100vh - 70px)', overflow: 'hidden' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h2 className="fw-bold mb-0 text-pcc-blue" style={{ color: 'var(--pcc-blue)', fontSize: '1.5rem' }}>Guest Live Chat & Inquiry Management Desk</h2>
            <p className="text-muted mb-0 small">Real-time guest support live chat, inquiry ticket tracking, and stay quotation tools.</p>
          </div>
        </div>

        {/* Tab selection */}
        <ul className="nav nav-tabs mb-3 d-print-none">
          <li className="nav-item">
            <button
              className={`nav-link fw-bold ${activeTab === 'inbox' ? 'active text-pcc-blue border-bottom-3' : 'text-secondary'}`}
              onClick={() => setActiveTab('inbox')}
              style={{ borderBottom: activeTab === 'inbox' ? '3px solid var(--pcc-blue)' : '' }}
            >
              Live Chat Support Workspace
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link fw-bold ${activeTab === 'availability' ? 'active text-pcc-blue' : 'text-secondary'}`}
              onClick={() => setActiveTab('availability')}
              style={{ borderBottom: activeTab === 'availability' ? '3px solid var(--pcc-blue)' : '' }}
            >
              Room Availability & Quotation Calculator
            </button>
          </li>
        </ul>

        {activeTab === 'inbox' ? (
          <div className="row g-3 flex-grow-1 overflow-hidden" style={{ minHeight: 0, paddingBottom: '10px' }}>
            {/* LEFT PANEL: Conversation List */}
            <div className="col-lg-4 col-xl-4 h-100 d-flex flex-column overflow-hidden" style={{ minHeight: 0 }}>
              <div className="card shadow-sm border-0 bg-white flex-grow-1 d-flex flex-column overflow-hidden h-100" style={{ borderRadius: '10px', minHeight: 0 }}>
                {/* Search & Status Filters Header */}
                <div className="card-header bg-white py-3 border-0 border-bottom">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fw-bold mb-0 text-dark">Conversations</h6>
                    <span className="badge bg-primary rounded-pill">{filteredInquiries.length}</span>
                  </div>
                  <input
                    type="text"
                    className="form-control form-control-sm mb-2"
                    placeholder="Search name, phone, or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ borderRadius: '20px', paddingLeft: '14px' }}
                  />

                  {/* Status Filter Buttons */}
                  <div className="btn-group w-100" role="group">
                    {['All', 'Pending', 'Responded', 'Closed'].map(st => (
                      <button
                        key={st}
                        type="button"
                        className={`btn btn-xs ${statusFilter === st ? (st === 'Pending' ? 'btn-warning text-dark' : st === 'Responded' ? 'btn-success text-white' : st === 'Closed' ? 'btn-secondary text-white' : 'btn-pcc-primary text-white') : 'btn-outline-secondary'}`}
                        onClick={() => setStatusFilter(st)}
                        style={{ fontSize: '0.72rem', padding: '3px 6px', fontWeight: '600' }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conversation List Body */}
                <div className="card-body p-0 overflow-y-auto flex-grow-1">
                  {loading ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-pcc-primary" role="status">
                        <span className="visually-hidden">Loading conversations...</span>
                      </div>
                    </div>
                  ) : filteredInquiries.length === 0 ? (
                    <div className="text-center py-5 text-muted small">
                      <p className="mb-0">No conversations match criteria.</p>
                    </div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {filteredInquiries.map(inq => {
                        const isSelected = selectedInquiry?.inquiryID === inq.inquiryID;
                        return (
                          <button
                            key={inq.inquiryID}
                            onClick={() => handleSelectInquiry(inq)}
                            className={`list-group-item list-group-item-action d-flex align-items-center gap-2.5 p-3 border-0 border-bottom ${isSelected ? 'bg-light' : ''}`}
                            style={{ 
                              transition: 'all 0.2s', 
                              borderLeft: isSelected ? '4px solid var(--pcc-blue) !important' : '4px solid transparent' 
                            }}
                          >
                            <div className="flex-grow-1 min-w-0">
                              <div className="d-flex justify-content-between align-items-baseline mb-1">
                                <h6 className={`mb-0 text-truncate ${inq.status === 'Pending' ? 'fw-bold text-dark' : 'text-secondary'}`} style={{ fontSize: '0.88rem' }}>
                                  {inq.name}
                                </h6>
                                <small className="text-muted ms-1" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                                  {inq.lastMessageTime ? new Date(inq.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(inq.createdAt).toLocaleDateString()}
                                </small>
                              </div>
                              <div className="text-truncate text-muted small" style={{ fontSize: '0.76rem' }}>
                                {inq.lastMessage || inq.message}
                              </div>
                              <div className="d-flex align-items-center gap-1.5 mt-1.5">
                                <span className={`badge rounded-pill ${
                                  inq.status === 'Responded' ? 'bg-success text-white' : 
                                  inq.status === 'Closed' ? 'bg-secondary text-white' : 'bg-warning text-dark'
                                }`} style={{ fontSize: '0.65rem' }}>
                                  {inq.status}
                                </span>
                                {inq.unreadReceptionist > 0 && (
                                  <span className="badge rounded-pill bg-danger text-white" style={{ fontSize: '0.65rem' }}>
                                    {inq.unreadReceptionist} Unread
                                  </span>
                                )}
                                {inq.contactNumber && (
                                  <span className="badge bg-light text-muted border ms-auto" style={{ fontSize: '0.65rem' }}>
                                    {inq.contactNumber}
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

            {/* RIGHT PANEL: Live Conversation Window */}
            <div className="col-lg-8 col-xl-8 h-100 d-flex flex-column overflow-hidden" style={{ minHeight: 0 }}>
              <div className="card shadow-sm border-0 bg-white flex-grow-1 d-flex flex-column overflow-hidden h-100" style={{ borderRadius: '10px', minHeight: 0 }}>
                {selectedInquiry ? (
                  <>
                    {/* Header Details */}
                    <div className="card-header bg-white py-3 border-0 border-bottom d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '0.95rem' }}>{selectedInquiry.name}</h6>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {selectedInquiry.email} {selectedInquiry.contactNumber ? `• Contact: ${selectedInquiry.contactNumber}` : ''}
                        </div>
                      </div>

                      {/* Header Actions */}
                      <div className="d-flex align-items-center gap-2">
                        <span className={`badge rounded-pill px-3 py-1 ${
                          selectedInquiry.status === 'Responded' ? 'bg-success text-white' :
                          selectedInquiry.status === 'Closed' ? 'bg-secondary text-white' : 'bg-warning text-dark'
                        }`} style={{ fontSize: '0.75rem' }}>
                          Status: {selectedInquiry.status}
                        </span>

                        {selectedInquiry.status === 'Closed' ? (
                          <button
                            className="btn btn-sm btn-outline-primary fw-semibold"
                            onClick={() => handleUpdateStatus('Pending')}
                            style={{ fontSize: '0.78rem' }}
                          >
                            Reopen Chat 🔓
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm btn-outline-secondary fw-semibold"
                            onClick={() => handleUpdateStatus('Closed')}
                            style={{ fontSize: '0.78rem' }}
                          >
                            Close Inquiry 🔒
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Chat Messages Thread Body */}
                    <div 
                      className="card-body p-4 flex-grow-1 overflow-y-auto"
                      ref={chatMessagesRef}
                      style={{ backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px' }}
                    >
                      {loadingMessages ? (
                        <div className="text-center py-5">
                          <div className="spinner-border text-pcc-primary" role="status">
                            <span className="visually-hidden">Loading thread...</span>
                          </div>
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="p-3 bg-white border rounded text-start" style={{ fontSize: '0.85rem' }}>
                          <strong>Initial Request:</strong> {selectedInquiry.message}
                        </div>
                      ) : (
                        messages.map((m) => {
                          const isGuest = m.senderType === 'Guest';
                          const isSystem = m.senderType === 'System';
                          return (
                            <div 
                              key={m.messageID}
                              className={`d-flex flex-column ${isSystem ? 'align-items-center' : (isGuest ? 'align-items-start' : 'align-items-end')}`}
                            >
                              {!isSystem && (
                                <div className="text-muted small mb-0.5 px-1" style={{ fontSize: '0.68rem' }}>
                                  {m.senderName} • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                              <div 
                                className="p-3 rounded shadow-sm"
                                style={{
                                  maxWidth: '75%',
                                  fontSize: '0.88rem',
                                  lineHeight: '1.45',
                                  whiteSpace: 'pre-line',
                                  backgroundColor: isSystem ? '#e2e8f0' : (isGuest ? '#ffffff' : 'var(--pcc-blue)'),
                                  color: isSystem ? '#475569' : (isGuest ? '#1e293b' : '#ffffff'),
                                  border: isGuest ? '1px solid #cbd5e1' : 'none',
                                  borderRadius: isGuest ? '14px 14px 14px 2px' : (isSystem ? '8px' : '14px 14px 2px 14px')
                                }}
                              >
                                {m.message}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Bottom Chat Toolbar Input */}
                    <div className="card-footer bg-white p-3 border-0 border-top">
                      {selectedInquiry.status === 'Closed' ? (
                        <div className="alert alert-secondary mb-0 py-2 text-center small">
                          🔒 This conversation is marked as <strong>Closed</strong>. Reopen chat above to send replies.
                        </div>
                      ) : (
                        <form onSubmit={handleReplySubmit} className="d-flex flex-column gap-2">
                          {/* Fast Emoji Toolbar */}
                          <div className="d-flex align-items-center gap-1">
                            <span className="text-muted small me-2" style={{ fontSize: '0.72rem' }}>Quick Emojis:</span>
                            {['😊', '👍', '🏨', '🔑', '📋', '✨', '👋', '☕'].map(emo => (
                              <button
                                key={emo}
                                type="button"
                                className="btn btn-xs btn-light border"
                                onClick={() => handleAppendEmoji(emo)}
                                style={{ fontSize: '0.85rem', padding: '1px 6px' }}
                              >
                                {emo}
                              </button>
                            ))}
                          </div>

                          <div className="d-flex gap-2">
                            <textarea
                              className="form-control"
                              rows="2"
                              placeholder="Type your response to guest..."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleReplySubmit(e);
                                }
                              }}
                              style={{ borderRadius: '8px', fontSize: '0.88rem' }}
                            ></textarea>
                            <button
                              type="submit"
                              className="btn btn-pcc-primary text-white fw-bold px-4 d-flex align-items-center justify-content-center"
                              disabled={!replyText.trim()}
                              style={{ borderRadius: '8px', minWidth: '100px' }}
                            >
                              Send ✈️
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="d-flex align-items-center justify-content-center flex-grow-1 text-muted">
                    <p className="mb-0">Select a conversation from the left panel to view messages.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ROOM AVAILABILITY & QUOTATION CALCULATOR TAB (PRESERVED) */
          <div className="row g-4 animate__animated animate__fadeIn overflow-y-auto flex-grow-1">
            <div className="col-md-5">
              <div className="card shadow-sm border-0 p-4 bg-white" style={{ borderRadius: '10px' }}>
                <h5 className="fw-bold text-dark mb-3">Check Room Availability</h5>
                <form onSubmit={checkRoomAvailability}>
                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>Check-In Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        value={availForm.checkIn}
                        onChange={(e) => setAvailForm(prev => ({ ...prev, checkIn: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>Check-Out Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        value={availForm.checkOut}
                        onChange={(e) => setAvailForm(prev => ({ ...prev, checkOut: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>Room Type Filter</label>
                    <select
                      className="form-select"
                      value={availForm.roomType}
                      onChange={(e) => setAvailForm(prev => ({ ...prev, roomType: e.target.value }))}
                    >
                      <option value="Any room type">Any room type</option>
                      <option value="Standard Matrimonial">Standard Matrimonial</option>
                      <option value="Twin Bed">Twin Bed</option>
                      <option value="Deluxe Suite">Deluxe Suite</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>Breakfast Option</label>
                    <select
                      className="form-select"
                      value={availForm.breakfast}
                      onChange={(e) => setAvailForm(prev => ({ ...prev, breakfast: e.target.value }))}
                    >
                      <option value="With Breakfast">With Breakfast</option>
                      <option value="No Breakfast">No Breakfast</option>
                    </select>
                  </div>

                  <button type="submit" className="btn btn-pcc-primary text-white w-100 fw-bold py-2" disabled={checkingAvail}>
                    {checkingAvail ? 'Checking Availability...' : '🔍 Search Available Rooms'}
                  </button>
                </form>
              </div>

              {/* Quotation Guest Input Details */}
              {selectedRoom && (
                <div className="card shadow-sm border-0 p-4 bg-white mt-4" style={{ borderRadius: '10px' }}>
                  <h5 className="fw-bold text-dark mb-3">Guest Details for Schedule</h5>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="First Name *"
                        value={quoteGuest.firstName}
                        onChange={(e) => setQuoteGuest(prev => ({ ...prev, firstName: e.target.value }))}
                      />
                    </div>
                    <div className="col-6">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Last Name *"
                        value={quoteGuest.lastName}
                        onChange={(e) => setQuoteGuest(prev => ({ ...prev, lastName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-6">
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        placeholder="Email Address"
                        value={quoteGuest.email}
                        onChange={(e) => setQuoteGuest(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div className="col-6">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Contact Number *"
                        value={quoteGuest.contact}
                        onChange={(e) => setQuoteGuest(prev => ({ ...prev, contact: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold" style={{ fontSize: '0.8rem' }}>Applicable Discount (Optional)</label>
                    <select
                      className="form-select form-select-sm"
                      value={quoteGuest.discountID}
                      onChange={(e) => setQuoteGuest(prev => ({ ...prev, discountID: e.target.value }))}
                    >
                      <option value="">No Discount</option>
                      {discounts.map(d => (
                        <option key={d.discountID} value={String(d.discountID)}>
                          {d.name} ({d.percentage}%)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="col-md-7">
              <div className="card shadow-sm border-0 p-4 bg-white" style={{ borderRadius: '10px' }}>
                <h5 className="fw-bold text-dark mb-3">Matching Available Rooms & Quotations</h5>

                {availRooms.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <p className="mb-0">Select check-in & check-out dates to view available rooms and calculate stay charges.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle" style={{ fontSize: '0.88rem' }}>
                      <thead className="table-light">
                        <tr>
                          <th>Room</th>
                          <th>Type</th>
                          <th>Floor</th>
                          <th>Breakfast</th>
                          <th>Rate / Night</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {availRooms.map(r => {
                          const isSelected = quoteGuest.roomID === String(r.roomID);
                          return (
                            <tr key={r.roomID} className={isSelected ? 'table-primary' : ''}>
                              <td className="fw-bold text-pcc-blue">Room {r.roomNumber}</td>
                              <td>{r.roomType}</td>
                              <td>Floor {r.floorID}</td>
                              <td>{r.breakfastOption}</td>
                              <td className="fw-bold text-dark">₱{parseFloat(r.rate).toFixed(2)}</td>
                              <td>
                                <button
                                  type="button"
                                  className={`btn btn-xs fw-bold ${isSelected ? 'btn-success text-white' : 'btn-outline-primary'}`}
                                  onClick={() => setQuoteGuest(prev => ({ ...prev, roomID: String(r.roomID) }))}
                                  style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                                >
                                  {isSelected ? '✓ Selected' : 'Select Room'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Quotation Calculation Summary Breakdown */}
                {selectedRoom && (
                  <div className="p-3 mt-3 rounded bg-light border">
                    <h6 className="fw-bold text-dark mb-2">Calculated Quotation Breakdown</h6>
                    <div className="d-flex justify-content-between mb-1" style={{ fontSize: '0.85rem' }}>
                      <span className="text-muted">Selected Room:</span>
                      <span className="fw-semibold">Room {selectedRoom.roomNumber} ({selectedRoom.roomType})</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1" style={{ fontSize: '0.85rem' }}>
                      <span className="text-muted">Stay Duration:</span>
                      <span className="fw-semibold">{nights} Night(s) ({availForm.checkIn} to {availForm.checkOut})</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1" style={{ fontSize: '0.85rem' }}>
                      <span className="text-muted">Original Room Charge:</span>
                      <span className="fw-semibold">₱{originalRoomCharge.toFixed(2)}</span>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="d-flex justify-content-between mb-1 text-danger" style={{ fontSize: '0.85rem' }}>
                        <span>Applied Discount:</span>
                        <span className="fw-semibold">-₱{totalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="d-flex justify-content-between mb-1 text-primary fw-bold" style={{ fontSize: '0.9rem' }}>
                      <span>Net Total Stay Charge:</span>
                      <span>₱{netRoomCharge.toFixed(2)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-3 text-success fw-bold" style={{ fontSize: '0.9rem' }}>
                      <span>Required 50% Down Payment:</span>
                      <span>₱{downPaymentRequired.toFixed(2)}</span>
                    </div>

                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-pcc-primary text-white fw-bold flex-grow-1 py-2"
                        onClick={handleCreateBookingRedirect}
                        disabled={!quoteGuest.firstName || !quoteGuest.lastName || !quoteGuest.contact}
                      >
                        Convert to Booking & Check-In 🏨
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary fw-bold flex-grow-1 py-2"
                        onClick={handleCreateReservationRedirect}
                        disabled={!quoteGuest.firstName || !quoteGuest.lastName}
                      >
                        Schedule Reservation 📅
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
