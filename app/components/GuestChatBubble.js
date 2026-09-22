'use client';

import { useState, useEffect, useRef } from 'react';

export default function GuestChatBubble({ inlineView = false, hideFloating = false, bottomOffset = '24px' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTabMode, setActiveTabMode] = useState('bot'); // 'bot' | 'live'
  const [input, setInput] = useState('');
  const [botMessages, setBotMessages] = useState([
    {
      sender: 'bot',
      text: 'Hello! I am your PCC Virtual Assistant. How can I help you with your stay today?'
    }
  ]);
  const [liveMessages, setLiveMessages] = useState([]);
  const [dbInquiry, setDbInquiry] = useState(null);
  const chatBodyRef = useRef(null);



  // Visitor Request Form States
  const [currentUser, setCurrentUser] = useState(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({
    name: '',
    contactNumber: '',
    email: '',
    message: ''
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/session-check');
      if (res.ok) {
        const data = await res.json();
        if (data.valid && data.session?.role === 'Guest') {
          setCurrentUser(data.session);
          setRequestForm(prev => ({
            ...prev,
            name: `${data.session.firstName || ''} ${data.session.lastName || ''}`.trim() || prev.name,
            email: data.session.email || prev.email
          }));
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error("Session check failed in chat bubble:", err);
      setCurrentUser(null);
    }
  };



  const fetchLiveInquiry = async () => {
    try {
      const queryEmail = currentUser?.email || requestForm.email || (typeof window !== 'undefined' ? localStorage.getItem('pcc_guest_email') : '');
      if (!queryEmail) return;

      const res = await fetch(`/api/guest/inquiries?email=${encodeURIComponent(queryEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.inquiry) {
          setDbInquiry(data.inquiry);
          if (data.messages && data.messages.length > 0) {
            setLiveMessages(data.messages);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching live guest inquiry:", err);
    }
  };

  const markThreadAsRead = async (inquiryID) => {
    if (!inquiryID) return;
    try {
      await fetch('/api/guest/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', inquiryID })
      });
      setDbInquiry(prev => prev ? { ...prev, unreadGuest: 0 } : null);
      setLiveMessages(prev => prev.map(m => m.senderType !== 'Guest' ? { ...m, isRead: 1, status: 'Read' } : m));
    } catch (err) {
      console.error("Failed to mark messages as read:", err);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchLiveInquiry();
    }
  }, [isOpen]);

  // Mark thread as read ONLY when user actively opens the live chat
  useEffect(() => {
    if (isOpen && activeTabMode === 'live' && dbInquiry?.inquiryID) {
      const hasUnread = dbInquiry.unreadGuest > 0 || liveMessages.some(m => m.senderType !== 'Guest' && m.status !== 'Read');
      if (hasUnread) {
        markThreadAsRead(dbInquiry.inquiryID);
      }
    }
  }, [isOpen, activeTabMode, dbInquiry?.inquiryID, dbInquiry?.unreadGuest, liveMessages]);

  // Polling for live chat responses with adaptive frequency
  useEffect(() => {
    fetchLiveInquiry();
    const intervalTime = !isOpen ? 25000 : (activeTabMode === 'live' ? 3500 : 15000);
    const interval = setInterval(fetchLiveInquiry, intervalTime);
    return () => clearInterval(interval);
  }, [currentUser, requestForm.email, isOpen, activeTabMode]);

  useEffect(() => {
    if (!chatBodyRef.current) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (chatBodyRef.current) {
          chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
      });
    });
  }, [botMessages, liveMessages, activeTabMode, isOpen, showRequestForm, isSendingMessage]);

  const knowledgeBase = {
    rates: "PCC Room Rates Per Night:\n" +
      "• Ground Floor:\n" +
      "  - Standard Matrimonial: ₱1,200 (₱1,500 w/ breakfast)\n" +
      "  - Twin Bed: ₱1,300 (₱1,800 w/ breakfast)\n" +
      "  - Deluxe Suite: ₱2,100 (₱2,500 w/ breakfast)\n" +
      "• Second Floor:\n" +
      "  - Standard Matrimonial: ₱1,500 (₱1,800 w/ breakfast)\n" +
      "  - Twin Bed: ₱1,800 (₱2,200 w/ breakfast)\n" +
      "  - Deluxe Suite: ₱2,200 (₱2,500 w/ breakfast)",
    checkin: "Check-In & Check-Out Policy:\n" +
      "• Standard Check-in: 2:00 PM\n" +
      "• Standard Check-out: 12:00 PM (noon)\n\n" +
      "Early check-in fee: ₱50/hr before 2:00 PM.\n" +
      "Late check-out fee: ₱100/hr after 12:00 PM.",
    amenities: "PCC Pension House Amenities:\n" +
      "• Free High-Speed Wi-Fi\n" +
      "• Air-conditioned Rooms\n" +
      "• Private Hot & Cold Showers\n" +
      "• Daily Housekeeping & Fresh Linens\n" +
      "• Dining Hall & Pre-ordered Breakfast\n" +
      "• 24/7 Front Desk Assistance",
    location: "Location & Directions:\n" +
      "📍 Osmeña Street, Zone 1, Koronadal City, South Cotabato, Philippines\n" +
      "📞 Contact: 09000000000 | Email: info@pccsuite.com",
    reservation: "Reservations:\n" +
      "You can reserve a room directly via our Booking portal or by requesting assistance from our Receptionist staff below!",
    orders: "Room Service & Orders:\n" +
      "To order breakfast meals, beverages, snacks, or extra room amenities, please go to the 'Room Service & Orders' tab on your dashboard."
  };

  const getBotReply = (msg) => {
    const text = msg.toLowerCase();
    if (text.includes('rate') || text.includes('price') || text.includes('cost') || text.includes('how much')) {
      return knowledgeBase.rates;
    }
    if (text.includes('checkin') || text.includes('checkout') || text.includes('check-in') || text.includes('check-out') || text.includes('time')) {
      return knowledgeBase.checkin;
    }
    if (text.includes('order') || text.includes('food') || text.includes('breakfast') || text.includes('meal') || text.includes('snack') || text.includes('drink') || text.includes('coffee') || text.includes('water')) {
      return knowledgeBase.orders;
    }
    if (text.includes('amenity') || text.includes('wifi') || text.includes('facility') || text.includes('shower')) {
      return knowledgeBase.amenities;
    }
    if (text.includes('location') || text.includes('where') || text.includes('address') || text.includes('contact')) {
      return knowledgeBase.location;
    }
    if (text.includes('reserve') || text.includes('book') || text.includes('reservation')) {
      return knowledgeBase.reservation;
    }
    return "I can help with room rates, check-in times, amenities, location, or reservations. For food and room service, please visit the Orders tab. You can also click 'Request Receptionist' to chat directly with our staff!";
  };

  const handleSendBotMessage = (text) => {
    if (!text.trim()) return;

    setBotMessages(prev => [...prev, { sender: 'user', text }]);
    setInput('');
    setIsSendingMessage(true);

    setTimeout(() => {
      const reply = getBotReply(text);
      setBotMessages(prev => [...prev, { sender: 'bot', text: reply }]);
      setIsSendingMessage(false);
    }, 400);
  };

  const handleDirectReceptionistRequest = async () => {
    setSubmittingRequest(true);

    try {
      const guestName = currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Guest Visitor' : 'Guest Visitor';
      const guestEmail = currentUser?.email || (typeof window !== 'undefined' ? localStorage.getItem('pcc_guest_email') : null) || 'guest@pccsuite.com';

      const payload = {
        name: guestName,
        email: guestEmail,
        contactNumber: currentUser?.contact || null,
        message: 'Guest requested live receptionist assistance.'
      };

      if (typeof window !== 'undefined' && guestEmail) {
        localStorage.setItem('pcc_guest_email', guestEmail);
      }

      const res = await fetch('/api/guest/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect to receptionist');

      setDbInquiry(data.inquiry);
      if (data.messages) {
        setLiveMessages(data.messages);
      }

      setBotMessages(prev => [...prev, {
        sender: 'bot',
        text: 'Live chat session initialized. You are now connected to the Front Desk Receptionist.'
      }]);

      setShowRequestForm(false);
      setActiveTabMode('live');
    } catch (err) {
      alert(err.message || 'Failed to connect to receptionist. Please try again.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleCreateInquiryTicket = async (e) => {
    if (e) e.preventDefault();
    setSubmittingRequest(true);

    try {
      const guestName = requestForm.name?.trim() || (currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : 'Guest Visitor');
      const guestEmail = requestForm.email?.trim() || currentUser?.email || (typeof window !== 'undefined' ? localStorage.getItem('pcc_guest_email') : null) || `visitor_${Date.now()}@pccsuite.com`;

      const payload = {
        name: guestName,
        email: guestEmail,
        contactNumber: requestForm.contactNumber?.trim() || null,
        message: requestForm.message?.trim() || 'Guest requested receptionist assistance.'
      };

      if (typeof window !== 'undefined' && guestEmail) {
        localStorage.setItem('pcc_guest_email', guestEmail);
      }

      const res = await fetch('/api/guest/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit inquiry ticket');

      setDbInquiry(data.inquiry);
      if (data.messages) {
        setLiveMessages(data.messages);
      }

      setShowRequestForm(false);
      setActiveTabMode('live');
    } catch (err) {
      alert(err.message || 'Failed to connect to receptionist. Please try again.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleOpenRequestForm = () => {
    if (currentUser && currentUser.email) {
      handleDirectReceptionistRequest();
    } else {
      setShowRequestForm(true);
    }
  };

  const handleSendLiveMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isSendingMessage) return;
    const msgToSend = input.trim();
    setInput('');
    setIsSendingMessage(true);

    // Optimistic update
    const tempMsg = {
      messageID: Date.now(),
      senderRole: 'guest',
      senderType: 'Guest',
      senderName: requestForm.name || (currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : 'You') || 'You',
      message: msgToSend,
      status: 'Delivered',
      isRead: 0,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };
    setLiveMessages(prev => [...prev, tempMsg]);

    try {
      const payload = {
        name: requestForm.name || (currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Guest Visitor'),
        email: requestForm.email || currentUser?.email || (typeof window !== 'undefined' ? localStorage.getItem('pcc_guest_email') : '') || 'visitor@pcc.com',
        contactNumber: requestForm.contactNumber || null,
        message: msgToSend
      };

      const res = await fetch('/api/guest/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.messages) {
        setLiveMessages(data.messages);
        setDbInquiry(data.inquiry);
      }
    } catch (err) {
      console.error("Failed to send live message:", err);
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (!inlineView && hideFloating) return null;

  return (
    <>
      {/* FLOATING ACTION TRIGGER BUTTON */}
      <button
        className={`chatbot-toggle shadow-lg ${isOpen ? 'd-none' : 'd-flex'}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: bottomOffset,
          '--chatbot-bottom': bottomOffset,
          right: 'max(16px, calc(env(safe-area-inset-right, 0px) + 16px))',
          width: '58px',
          height: '58px',
          borderRadius: '50%',
          backgroundColor: 'var(--pcc-blue)',
          border: 'none',
          color: '#fff',
          fontSize: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1060,
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(33,85,181,0.35)',
          touchAction: 'manipulation'
        }}
        aria-label="Guest Assistant & Live Chat"
        title="Guest Assistant & Live Chat"
      >
        {isOpen ? (
          <i className="bi bi-x-lg text-white fs-4" style={{ fontWeight: 'bold' }}></i>
        ) : dbInquiry && dbInquiry.unreadGuest > 0 ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        )}
      </button>

      {/* CHAT CONTAINER WINDOW */}
      <div
        className={`chatbot-window card border-0 shadow-lg ${isOpen ? 'active d-flex' : 'd-none'}`}
        style={{
          position: 'fixed',
          bottom: `calc(${bottomOffset} + 68px)`,
          right: '16px',
          width: 'min(360px, calc(100vw - 32px))',
          maxWidth: 'calc(100vw - 32px)',
          height: '520px',
          maxHeight: 'calc(100vh - 120px)',
          zIndex: 1050,
          borderRadius: '14px',
          backgroundColor: '#fff',
          overflow: 'hidden',
          flexDirection: 'column',
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)'
        }}
      >
        {/* HEADER */}
        <div
          className="chatbot-header p-3 text-white d-flex align-items-center justify-content-between"
          style={{ backgroundColor: 'var(--pcc-blue)' }}
        >
          <div className="d-flex align-items-center gap-2">
            <div>
              <div className="fw-bold small" style={{ lineHeight: 1.2 }}>
                {activeTabMode === 'live' ? 'Receptionist Live Chat' : 'PCC Virtual Assistant'}
              </div>
              <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>
                {activeTabMode === 'live' ? 'Connected • Front Desk Desk' : 'Online • Automated Assistant'}
              </div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className={`btn btn-xs px-2 py-0.5 rounded-pill text-white fw-bold ${activeTabMode === 'live' ? 'bg-success' : 'btn-outline-light'}`}
              style={{ fontSize: '0.65rem' }}
              onClick={() => setActiveTabMode(activeTabMode === 'live' ? 'bot' : 'live')}
            >
              {activeTabMode === 'live' ? 'Bot Help' : 'Live Chat'}
            </button>
            <button
              type="button"
              className="btn btn-link text-white p-0 d-flex align-items-center justify-content-center shadow-none"
              onClick={() => setIsOpen(false)}
              aria-label="Close Chat"
              title="Close Chat"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                textDecoration: 'none',
                cursor: 'pointer'
              }}
            >
              <i className="bi bi-x-lg text-white" style={{ fontSize: '0.9rem', fontWeight: 'bold' }}></i>
            </button>
          </div>
        </div>

        {/* INQUIRY STATUS BAR (IF ACTIVE) */}
        {dbInquiry && (
          <div className="p-2 px-3 bg-light border-bottom d-flex justify-content-between align-items-center" style={{ fontSize: '0.75rem' }}>
            <span className="text-muted fw-semibold">Inquiry Ticket Status:</span>
            <span className={`badge ${dbInquiry.status === 'Responded' ? 'bg-success text-white' :
                dbInquiry.status === 'Closed' ? 'bg-secondary text-white' : 'bg-warning text-dark'
              }`}>
              {dbInquiry.status === 'Pending' ? 'Waiting for Receptionist...' : dbInquiry.status}
            </span>
          </div>
        )}

        {/* BODY AREA */}
        <div
          className="chatbot-body p-3 flex-grow-1"
          ref={chatBodyRef}
          style={{
            overflowY: 'auto',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {showRequestForm ? (
            /* REQUEST RECEPTIONIST FORM */
            <div className="card border-0 shadow-sm p-3 bg-white text-start">
              <h6 className="fw-bold mb-2 text-dark" style={{ fontSize: '0.88rem' }}>Request Receptionist Assistance</h6>
              <p className="text-muted mb-3" style={{ fontSize: '0.75rem' }}>
                Fill out your information below to alert our Front Desk staff directly.
              </p>
              <form onSubmit={handleCreateInquiryTicket}>
                <div className="mb-2">
                  <label className="form-label mb-1 fw-semibold text-muted" style={{ fontSize: '0.75rem' }}>Your Name *</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Guest Name"
                    value={requestForm.name}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label mb-1 fw-semibold text-muted" style={{ fontSize: '0.75rem' }}>Contact Number (Optional)</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. 09171234567"
                    value={requestForm.contactNumber}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, contactNumber: e.target.value }))}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label mb-1 fw-semibold text-muted" style={{ fontSize: '0.75rem' }}>Email Address (Optional)</label>
                  <input
                    type="email"
                    className="form-control form-control-sm"
                    placeholder="guest@example.com"
                    value={requestForm.email}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label mb-1 fw-semibold text-muted" style={{ fontSize: '0.75rem' }}>Your Message *</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows="3"
                    placeholder="Type your question or request for the receptionist..."
                    value={requestForm.message}
                    onChange={(e) => setRequestForm(prev => ({ ...prev, message: e.target.value }))}
                    required
                  ></textarea>
                </div>
                <div className="d-flex gap-2 justify-content-end">
                  <button
                    type="button"
                    className="btn btn-sm btn-danger text-white"
                    onClick={() => setShowRequestForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-pcc-primary text-white fw-bold d-flex align-items-center gap-1.5"
                    disabled={submittingRequest}
                  >
                    {submittingRequest ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        Sending Request...
                      </>
                    ) : (
                      'Send Request'
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : activeTabMode === 'live' ? (
            /* LIVE RECEPTIONIST CHAT MESSAGES THREAD */
            liveMessages.length === 0 ? (
              <div className="text-center py-5 text-muted" style={{ fontSize: '0.8rem' }}>
                <p className="mb-2">No active live conversation ticket found.</p>
                <button
                  className="btn btn-sm btn-outline-primary rounded-pill fw-bold d-inline-flex align-items-center gap-1.5"
                  onClick={handleDirectReceptionistRequest}
                  disabled={submittingRequest}
                >
                  {submittingRequest ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      Connecting...
                    </>
                  ) : (
                    'Request Receptionist Now'
                  )}
                </button>
              </div>
            ) : (
              liveMessages.map((m) => (
                <div
                  key={m.messageID}
                  className={`d-flex flex-column ${m.senderType === 'Guest' ? 'align-items-end' : 'align-items-start'}`}
                >
                  <div className="text-muted small mb-0.5 px-1" style={{ fontSize: '0.65rem' }}>
                    {m.senderName} • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div
                    className={`p-2.5 px-3 rounded shadow-sm ${m.senderType !== 'Guest' ? 'chat-bubble-received' : 'chat-bubble-sent'}`}
                    style={{
                      maxWidth: '85%',
                      fontSize: '0.82rem',
                      lineHeight: '1.4',
                      whiteSpace: 'pre-line',
                      borderRadius: m.senderType === 'Guest' ? '12px 12px 2px 12px' : '12px 12px 12px 2px'
                    }}
                  >
                    {m.message}
                  </div>
                  {m.senderType === 'Guest' && (
                    <div className="text-end px-1 mt-0.5" style={{ fontSize: '0.65rem' }}>
                      {m.status === 'Read' || m.isRead === 1 ? (
                        <span className="text-primary fw-semibold d-inline-flex align-items-center gap-1" title="Read by Receptionist">
                          <i className="bi bi-check2-all text-primary"></i> Read {m.readAt ? new Date(m.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      ) : (
                        <span className="text-muted d-inline-flex align-items-center gap-1" title="Delivered to Receptionist">
                          <i className="bi bi-check2"></i> Delivered
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
            )
          ) : (
            /* AUTOMATED CHATBOT MESSAGES THREAD */
            botMessages.map((m, idx) => (
              <div
                key={idx}
                className={`d-flex flex-column ${m.sender === 'user' ? 'align-items-end' : 'align-items-start'}`}
              >
                <div
                  className={`p-2.5 px-3 rounded shadow-sm ${m.sender !== 'user' ? 'chat-bubble-received' : 'chat-bubble-sent'}`}
                  style={{
                    maxWidth: '85%',
                    fontSize: '0.82rem',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-line',
                    borderRadius: m.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px'
                  }}
                >
                  {m.text}
                </div>
                {m.sender === 'user' && (
                  <div className="text-end px-1 mt-0.5" style={{ fontSize: '0.65rem' }}>
                    <span className="text-muted">✓ Delivered</span>
                  </div>
                )}
              </div>
            ))
          )}

          {/* INTERACTIVE SENDING / TYPING ANIMATION */}
          {isSendingMessage && (
            <div className="d-flex align-items-center gap-1.5 p-2 px-3 rounded-pill bg-white shadow-sm border align-self-start animate__animated animate__fadeIn" style={{ width: 'fit-content', fontSize: '0.75rem' }}>
              <span className="spinner-grow spinner-grow-sm text-primary" style={{ width: '0.45rem', height: '0.45rem' }} role="status"></span>
              <span className="spinner-grow spinner-grow-sm text-primary" style={{ width: '0.45rem', height: '0.45rem', animationDelay: '0.15s' }} role="status"></span>
              <span className="spinner-grow spinner-grow-sm text-primary" style={{ width: '0.45rem', height: '0.45rem', animationDelay: '0.3s' }} role="status"></span>
              <span className="text-muted ms-1 small" style={{ fontSize: '0.72rem' }}>
                {activeTabMode === 'live' ? 'Sending message...' : 'Assistant is replying...'}
              </span>
            </div>
          )}


        </div>

        {/* BOTTOM AREA */}
        {!showRequestForm && (
          <div className="bg-white border-top">
            {activeTabMode === 'bot' && (
              /* CHATBOT QUICK REPLIES AND REQUEST RECEPTIONIST BUTTON */
              <div className="p-2 bg-light border-bottom d-flex flex-wrap gap-1" style={{ fontSize: '0.72rem' }}>
                <button
                  type="button"
                  className="btn btn-xs btn-outline-secondary py-1 px-2 rounded-pill"
                  onClick={() => handleQuickOption('rates', 'Room Rates')}
                  style={{ fontSize: '0.72rem' }}
                >
                  Room Rates
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-outline-secondary py-1 px-2 rounded-pill"
                  onClick={() => handleQuickOption('checkin', 'Check-In Times')}
                  style={{ fontSize: '0.72rem' }}
                >
                  Check-In Times
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-outline-secondary py-1 px-2 rounded-pill"
                  onClick={() => handleQuickOption('amenities', 'Amenities')}
                  style={{ fontSize: '0.72rem' }}
                >
                  Amenities
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-outline-secondary py-1 px-2 rounded-pill"
                  onClick={() => handleQuickOption('location', 'Location')}
                  style={{ fontSize: '0.72rem' }}
                >
                  Location
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-outline-secondary py-1 px-2 rounded-pill"
                  onClick={() => handleQuickOption('orders', 'Room Service Info')}
                  style={{ fontSize: '0.72rem' }}
                >
                  Room Service
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-pcc-primary py-1 px-2 rounded-pill text-white fw-bold w-100 mt-1 d-flex align-items-center justify-content-center gap-1.5"
                  onClick={handleOpenRequestForm}
                  disabled={submittingRequest}
                  style={{ fontSize: '0.75rem' }}
                >
                  {submittingRequest ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      Connecting to Receptionist...
                    </>
                  ) : (
                    'Request Receptionist'
                  )}
                </button>
              </div>
            )}

            {/* INPUT FORM FOR CHAT */}
            <form
              onSubmit={activeTabMode === 'live' ? handleSendLiveMessage : (e) => {
                e.preventDefault();
                handleSendBotMessage(input);
              }}
              className="p-2 d-flex gap-1"
            >
              <input
                type="text"
                className="form-control form-control-sm flex-grow-1"
                placeholder={activeTabMode === 'live' ? "Type message to Receptionist..." : "Type your inquiry..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                style={{ fontSize: '0.8rem' }}
              />
              <button
                type="submit"
                className="btn btn-sm btn-pcc-primary px-3 text-white fw-semibold d-flex align-items-center justify-content-center"
                disabled={isSendingMessage}
                style={{ fontSize: '0.8rem', minWidth: '60px' }}
              >
                {isSendingMessage ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ) : (
                  'Send'
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
