'use client';

import { useState, useEffect, useRef } from 'react';
import ModalDialog from '../../components/ModalDialog';
import SearchableSelect from '../../components/SearchableSelect';

export default function ReceptionistInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Pending' | 'Responded' | 'Closed'
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const chatMessagesRef = useRef(null);

  // Reach Out to Guest Modal State
  const [isReachOutModalOpen, setIsReachOutModalOpen] = useState(false);
  const [registeredGuests, setRegisteredGuests] = useState([]);
  const [reachOutForm, setReachOutForm] = useState({ guestID: '', guestName: '', email: '', contactNumber: '', message: '' });

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

      if (data.selectedMessages && data.selectedMessages.length > 0) {
        setMessages(data.selectedMessages);
      }

      // If receptionist is actively viewing this inquiry thread in an active window, mark incoming as read
      if (selectedInquiry?.inquiryID && typeof document !== 'undefined' && document.hasFocus()) {
        const currentInq = (data.inquiries || []).find(i => i.inquiryID === selectedInquiry.inquiryID);
        if (currentInq && currentInq.unreadReceptionist > 0) {
          fetch('/api/receptionist/inquiries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_read', inquiryID: selectedInquiry.inquiryID })
          }).then(() => {
            setInquiries(prev => prev.map(item => item.inquiryID === selectedInquiry.inquiryID ? { ...item, unreadReceptionist: 0 } : item));
          }).catch(() => {});
        }
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

  const fetchRegisteredGuests = async () => {
    try {
      const res = await fetch('/api/receptionist/inquiries?action=guests');
      const data = await res.json();
      if (data.guests) setRegisteredGuests(data.guests);
    } catch (e) {
      console.error("Failed to load guests for reach out:", e);
    }
  };

  useEffect(() => {
    fetchInquiries();
    fetchRegisteredGuests();
  }, []);

  // Adaptive polling (1.5s active conversation, 4s idle) with visibility guard to prevent tab CPU/network leaks
  useEffect(() => {
    const pollInterval = selectedInquiry?.inquiryID ? 1500 : 4000;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetchInquiries(true);
    }, pollInterval);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchInquiries(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedInquiry?.inquiryID]);

  // Always start and align view at the bottom of the conversation when switching or receiving messages
  const lastInquiryIDRef = useRef(null);

  useEffect(() => {
    if (!chatMessagesRef.current) return;
    const container = chatMessagesRef.current;
    const isNewInquiry = lastInquiryIDRef.current !== selectedInquiry?.inquiryID;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;

    if (isNewInquiry || isNearBottom || loadingMessages) {
      // Use double requestAnimationFrame to scroll AFTER browser DOM calculation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
          }
        });
      });
    }
    lastInquiryIDRef.current = selectedInquiry?.inquiryID;
  }, [messages, selectedInquiry?.inquiryID, loadingMessages]);

  const handleSelectInquiry = async (inq) => {
    if (selectedInquiry?.inquiryID === inq.inquiryID) return;
    setSelectedInquiry(inq);
    setMessages([]); // Clear previous messages immediately to prevent flashing jitter
    setLoadingMessages(true);
    fetchMessagesForInquiry(inq.inquiryID);

    // Explicitly mark as read on user selection/click
    try {
      await fetch('/api/receptionist/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', inquiryID: inq.inquiryID })
      });
    } catch (readErr) {
      console.error("Failed to mark inquiry as read:", readErr);
    }

    setInquiries(prev => prev.map(item => item.inquiryID === inq.inquiryID ? { ...item, unreadReceptionist: 0 } : item));
  };

  const handleChatScroll = () => {
    if (chatMessagesRef.current) {
      const container = chatMessagesRef.current;
      const isUp = container.scrollHeight - container.scrollTop - container.clientHeight > 150;
      setShowScrollBottomBtn(isUp);
    }
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedInquiry) return;
    const msgToSend = replyText.trim();
    setReplyText('');

    // Optimistic UI update defaulting to Delivered
    const tempMsg = {
      messageID: Date.now(),
      inquiryID: selectedInquiry.inquiryID,
      senderRole: 'receptionist',
      senderType: 'Receptionist',
      senderName: 'Front Desk Staff',
      message: msgToSend,
      status: 'Delivered',
      isRead: 0,
      createdAt: new Date().toISOString(),
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

  const openReachOutModal = () => {
    setReachOutForm({ guestID: '', guestName: '', email: '', contactNumber: '', message: '' });
    setIsReachOutModalOpen(true);
    if (!registeredGuests || registeredGuests.length === 0) {
      fetchRegisteredGuests();
    }
  };

  const handleReachOutSubmit = async (e) => {
    e.preventDefault();
    if (!reachOutForm.guestName || !reachOutForm.message) {
      showAlert('error', 'Validation Error', 'Guest name and message content are required.');
      return;
    }
    try {
      const res = await fetch('/api/receptionist/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reach_out',
          ...reachOutForm
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reach out to guest');

      showAlert('success', 'Success', 'Direct reach-out message sent to guest.');
      setIsReachOutModalOpen(false);
      fetchInquiries();
    } catch (err) {
      showAlert('error', 'Error', err.message);
    }
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
            <p className="text-muted mb-0 small">Real-time guest live chat support and inquiry ticket tracking.</p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-pcc-primary text-white fw-bold shadow-sm d-inline-flex align-items-center"
            style={{ backgroundColor: '#2155B5' }}
            onClick={openReachOutModal}
          >
            <i className="fa-solid fa-paper-plane me-2"></i>Reach Out to Guest
          </button>
        </div>

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

          {/* RIGHT PANEL: Live Chat Thread Window */}
          <div className="col-lg-8 col-xl-8 h-100 d-flex flex-column overflow-hidden" style={{ minHeight: 0 }}>
            <div className="card shadow-sm border-0 bg-white flex-grow-1 d-flex flex-column overflow-hidden h-100" style={{ borderRadius: '10px', minHeight: 0 }}>
              {!selectedInquiry ? (
                <div className="text-center py-5 text-muted flex-grow-1 d-flex flex-column justify-content-center align-items-center">
                  <h5 className="mt-3 fw-bold text-dark">No Conversation Selected</h5>
                  <p className="small mb-0">Select a guest inquiry from the left panel to start chatting in real time.</p>
                </div>
              ) : (
                <>
                  {/* Chat Thread Header */}
                  <div className="card-header bg-white py-3 px-4 border-0 border-bottom d-flex justify-content-between align-items-center">
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <h5 className="fw-bold mb-0 text-dark" style={{ fontSize: '1.05rem' }}>
                          {selectedInquiry.name}
                        </h5>
                        <span className={`badge ${
                          selectedInquiry.status === 'Responded' ? 'bg-success text-white' : 
                          selectedInquiry.status === 'Closed' ? 'bg-secondary text-white' : 'bg-warning text-dark'
                        }`} style={{ fontSize: '0.72rem' }}>
                          {selectedInquiry.status}
                        </span>
                      </div>
                      <small className="text-muted d-block mt-0.5" style={{ fontSize: '0.76rem' }}>
                        📧 {selectedInquiry.email} {selectedInquiry.contactNumber ? `| 📞 ${selectedInquiry.contactNumber}` : ''}
                      </small>
                    </div>

                    {/* Quick Status Update Action Buttons */}
                    <div className="d-flex gap-1">
                      {selectedInquiry.status === 'Closed' ? (
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-primary fw-semibold"
                          onClick={() => handleUpdateStatus('Responded')}
                          style={{ fontSize: '0.72rem' }}
                        >
                          Reopen Ticket
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-secondary fw-semibold"
                          onClick={() => handleUpdateStatus('Closed')}
                          style={{ fontSize: '0.72rem' }}
                        >
                          Close Ticket
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Chat Messages Body Thread */}
                  <div 
                    className="card-body p-4 overflow-y-auto flex-grow-1 bg-light d-flex flex-column gap-3 position-relative"
                    ref={chatMessagesRef}
                    onScroll={handleChatScroll}
                  >
                    {/* Initial Guest Submission Ticket Box */}
                    <div className="card border-0 shadow-sm p-3 bg-white mb-2" style={{ borderLeft: '4px solid var(--pcc-blue)', borderRadius: '8px' }}>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>Initial Inquiry Message</span>
                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                          {new Date(selectedInquiry.createdAt).toLocaleString()}
                        </small>
                      </div>
                      <p className="mb-0 text-dark" style={{ fontSize: '0.86rem', whiteSpace: 'pre-line' }}>
                        {selectedInquiry.message}
                      </p>
                    </div>

                    {/* Messages List */}
                    {loadingMessages ? (
                      <div className="text-center py-4">
                        <div className="spinner-border text-pcc-primary spinner-border-sm" role="status"></div>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-3 text-muted small">
                        No responses recorded yet. Type below to reply to this guest.
                      </div>
                    ) : (
                      messages.map((m) => {
                        const isStaff = m.senderType === 'Receptionist' || m.senderType === 'System';
                        return (
                          <div 
                            key={m.messageID}
                            className={`d-flex flex-column ${isStaff ? 'align-items-end' : 'align-items-start'}`}
                          >
                            <div className="text-muted small mb-1 px-1" style={{ fontSize: '0.68rem' }}>
                              {m.senderName || (isStaff ? 'Front Desk Staff' : selectedInquiry.name)} • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div 
                              className="p-3 shadow-sm"
                              style={{
                                maxWidth: '80%',
                                fontSize: '0.88rem',
                                lineHeight: '1.45',
                                whiteSpace: 'pre-line',
                                backgroundColor: isStaff ? 'var(--pcc-blue)' : '#ffffff',
                                color: isStaff ? '#ffffff' : '#1e293b',
                                border: !isStaff ? '1px solid #e2e8f0' : 'none',
                                borderRadius: isStaff ? '12px 12px 2px 12px' : '12px 12px 12px 2px'
                              }}
                            >
                              {m.message}
                            </div>
                            {isStaff && m.senderType !== 'System' && (
                              <div className="text-end px-1 mt-0.5" style={{ fontSize: '0.65rem' }}>
                                {m.status === 'Read' || m.isRead === 1 ? (
                                  <span className="text-primary fw-semibold d-inline-flex align-items-center gap-1" title="Read by Guest">
                                    <i className="bi bi-check2-all text-primary"></i> Read {m.readAt ? new Date(m.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                  </span>
                                ) : (
                                  <span className="text-muted d-inline-flex align-items-center gap-1" title="Delivered to Guest">
                                    <i className="bi bi-check2"></i> Delivered
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {/* Floating Scroll to Bottom Circle Button */}
                    {showScrollBottomBtn && (
                      <button
                        type="button"
                        className="btn btn-pcc-primary rounded-circle shadow position-sticky start-50 translate-middle-x d-flex align-items-center justify-content-center transition-all mt-auto"
                        style={{
                          bottom: '15px',
                          width: '42px',
                          height: '42px',
                          zIndex: 20,
                          backgroundColor: 'var(--pcc-blue)',
                          borderColor: 'var(--pcc-blue)',
                          alignSelf: 'center'
                        }}
                        onClick={() => {
                          if (chatMessagesRef.current) {
                            chatMessagesRef.current.scrollTo({ top: chatMessagesRef.current.scrollHeight, behavior: 'smooth' });
                          }
                        }}
                        title="Scroll to bottom"
                      >
                        <i className="bi bi-arrow-down text-white fs-5"></i>
                      </button>
                    )}
                  </div>

                  {/* Chat Input Box */}
                  <div className="card-footer bg-white p-3 border-0 border-top">
                    <form onSubmit={handleReplySubmit} className="d-flex gap-2">
                      <input
                        type="text"
                        className="form-control form-control-sm flex-grow-1"
                        placeholder="Type reply to guest..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        style={{ fontSize: '0.88rem', padding: '8px 12px' }}
                      />
                      <button
                        type="submit"
                        className="btn btn-pcc-primary text-white fw-bold btn-sm px-4"
                        disabled={!replyText.trim()}
                      >
                        Send
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      {/* REACH OUT TO GUEST MODAL */}
      {isReachOutModalOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ background: '#2155B5' }}>
                <h5 className="modal-title fw-bold">
                  <i className="fa-solid fa-paper-plane me-2"></i>Reach Out to Guest
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setIsReachOutModalOpen(false)}></button>
              </div>
              <form onSubmit={handleReachOutSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Select Registered Guest Account (Optional)</label>
                    <SearchableSelect
                      options={registeredGuests.map(g => ({
                        value: String(g.guestID),
                        label: `UID${g.userID || g.guestID} – ${g.firstName} ${g.lastName} (${g.contact || g.email || 'No contact'})`
                      }))}
                      value={reachOutForm.guestID}
                      onChange={(val) => {
                        const g = registeredGuests.find(item => String(item.guestID) === String(val));
                        setReachOutForm(prev => ({
                          ...prev,
                          guestID: val,
                          guestName: g ? `${g.firstName} ${g.lastName}`.trim() : prev.guestName,
                          email: g?.email || prev.email,
                          contactNumber: g?.contact || prev.contactNumber
                        }));
                      }}
                      placeholder="Type UID, guest name or contact to search..."
                    />
                    <div className="form-text text-muted small mt-1">
                      <i className="bi bi-info-circle me-1"></i>
                      Search existing guest to auto-fill details, or enter info manually below.
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Guest Full Name *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      required
                      placeholder="e.g. Juan Cruz"
                      value={reachOutForm.guestName}
                      onChange={(e) => setReachOutForm({ ...reachOutForm, guestName: e.target.value })}
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Email Address</label>
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        placeholder="guest@example.com"
                        value={reachOutForm.email}
                        onChange={(e) => setReachOutForm({ ...reachOutForm, email: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Contact / Mobile Number</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="09171234567"
                        value={reachOutForm.contactNumber}
                        onChange={(e) => setReachOutForm({ ...reachOutForm, contactNumber: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Direct Message / Announcement *</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows="4"
                      required
                      placeholder="Type your message to the guest..."
                      value={reachOutForm.message}
                      onChange={(e) => setReachOutForm({ ...reachOutForm, message: e.target.value })}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer bg-light px-4 py-3 d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary btn-sm fw-bold text-white" onClick={() => setIsReachOutModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm text-white fw-bold" style={{ backgroundColor: '#2155B5' }}>
                    <i className="fa-solid fa-paper-plane me-1"></i>Send Reach-Out Message
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
