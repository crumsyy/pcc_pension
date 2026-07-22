'use client';

import { useState, useEffect, useRef } from 'react';

export default function GuestChatBubble() {
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

  useEffect(() => {
    checkSession();
  }, []);

  // Polling every 3 seconds for real-time live chat responses when window is open
  useEffect(() => {
    let interval;
    if (isOpen) {
      fetchLiveInquiry();
      interval = setInterval(fetchLiveInquiry, 3000);
    }
    return () => clearInterval(interval);
  }, [isOpen, currentUser, requestForm.email]);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [botMessages, liveMessages, activeTabMode, isOpen, showRequestForm]);

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
             "Late check-out fee: ₱150/hr after 12:00 PM.",
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
                 "You can reserve a room directly via our Booking portal or by requesting assistance from our Receptionist staff below!"
  };

  const getBotReply = (msg) => {
    const text = msg.toLowerCase();
    if (text.includes('rate') || text.includes('price') || text.includes('cost') || text.includes('how much')) {
      return knowledgeBase.rates;
    }
    if (text.includes('checkin') || text.includes('checkout') || text.includes('check-in') || text.includes('check-out') || text.includes('time')) {
      return knowledgeBase.checkin;
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
    return "I can answer questions about room rates, check-in times, amenities, and location. If you need further help, click 'Request Receptionist' below to speak directly with our staff!";
  };

  const handleSendBotMessage = (text) => {
    if (!text.trim()) return;

    setBotMessages(prev => [...prev, { sender: 'user', text }]);
    setInput('');

    setTimeout(() => {
      const reply = getBotReply(text);
      setBotMessages(prev => [...prev, { sender: 'bot', text: reply }]);
    }, 350);
  };

  const handleQuickOption = (key, label) => {
    setBotMessages(prev => [...prev, { sender: 'user', text: label }]);
    setTimeout(() => {
      const reply = knowledgeBase[key];
      setBotMessages(prev => [...prev, { sender: 'bot', text: reply }]);
    }, 350);
  };

  const handleOpenRequestForm = () => {
    setShowRequestForm(true);
  };

  const handleCreateInquiryTicket = async (e) => {
    e.preventDefault();
    if (!requestForm.message.trim()) return;
    setSubmittingRequest(true);

    try {
      const payload = {
        name: requestForm.name.trim() || (currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Guest Visitor'),
        email: requestForm.email.trim() || (currentUser ? currentUser.email : 'visitor@pcc.com'),
        contactNumber: requestForm.contactNumber.trim() || null,
        message: requestForm.message.trim()
      };

      if (typeof window !== 'undefined' && payload.email) {
        localStorage.setItem('pcc_guest_email', payload.email);
      }

      const res = await fetch('/api/guest/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send inquiry');

      setDbInquiry(data.inquiry);
      if (data.messages) {
        setLiveMessages(data.messages);
      }

      setBotMessages(prev => [...prev, {
        sender: 'bot',
        text: 'Your request has been sent. A receptionist will respond shortly.'
      }]);

      setShowRequestForm(false);
      setRequestForm(prev => ({ ...prev, message: '' }));
      setActiveTabMode('live');
    } catch (err) {
      alert(err.message || 'Failed to send request. Please try again.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleSendLiveMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const msgToSend = input.trim();
    setInput('');

    // Optimistic update
    const tempMsg = {
      messageID: Date.now(),
      senderType: 'Guest',
      senderName: requestForm.name || 'You',
      message: msgToSend,
      timestamp: new Date().toISOString(),
      isRead: 0
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
    }
  };

  return (
    <>
      {/* FLOATING ACTION TRIGGER BUTTON */}
      <button 
        className="chatbot-toggle shadow-lg" 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
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
          zIndex: 1050,
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(33,85,181,0.35)'
        }}
        title="Guest Assistant & Live Chat"
      >
        {isOpen ? '✕' : (dbInquiry && dbInquiry.unreadGuest > 0 ? '🔔' : '💬')}
      </button>

      {/* CHAT CONTAINER WINDOW */}
      <div 
        className={`chatbot-window card border-0 shadow-lg ${isOpen ? 'active d-flex' : 'd-none'}`}
        style={{
          position: 'fixed',
          bottom: '92px',
          right: '24px',
          width: '360px',
          height: '510px',
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
            <span style={{ fontSize: '1.3rem' }}>{activeTabMode === 'live' ? '💬' : '🤖'}</span>
            <div>
              <div className="fw-bold small" style={{ lineHeight: 1.2 }}>
                {activeTabMode === 'live' ? 'Receptionist Live Chat' : 'PCC Virtual Assistant'}
              </div>
              <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>
                {activeTabMode === 'live' ? 'Connected • Reception Desk' : 'Online • Automated Assistant'}
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
              {activeTabMode === 'live' ? 'Bot Help' : 'Live Chat 💬'}
            </button>
            <button 
              type="button" 
              className="btn-close btn-close-white" 
              onClick={() => setIsOpen(false)}
              style={{ fontSize: '0.75rem' }}
            ></button>
          </div>
        </div>

        {/* INQUIRY STATUS BAR (IF ACTIVE) */}
        {dbInquiry && (
          <div className="p-2 px-3 bg-light border-bottom d-flex justify-content-between align-items-center" style={{ fontSize: '0.75rem' }}>
            <span className="text-muted fw-semibold">Status:</span>
            <span className={`badge ${
              dbInquiry.status === 'Responded' ? 'bg-success text-white' :
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
                    className="btn btn-sm btn-pcc-primary text-white fw-bold"
                    disabled={submittingRequest}
                  >
                    {submittingRequest ? 'Sending...' : 'Send Request 📩'}
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
                  className="btn btn-sm btn-outline-primary rounded-pill"
                  onClick={() => setShowRequestForm(true)}
                >
                  Request Receptionist Now
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
                    className="p-2.5 px-3 rounded shadow-sm"
                    style={{
                      maxWidth: '85%',
                      fontSize: '0.82rem',
                      lineHeight: '1.4',
                      whiteSpace: 'pre-line',
                      backgroundColor: m.senderType === 'Guest' ? 'var(--pcc-blue)' : (m.senderType === 'System' ? '#f1f5f9' : '#ffffff'),
                      color: m.senderType === 'Guest' ? '#ffffff' : '#1e293b',
                      border: m.senderType === 'Receptionist' ? '1px solid #e2e8f0' : 'none',
                      borderRadius: m.senderType === 'Guest' ? '12px 12px 2px 12px' : '12px 12px 12px 2px'
                    }}
                  >
                    {m.message}
                  </div>
                </div>
              ))
            )
          ) : (
            /* AUTOMATED CHATBOT MESSAGES THREAD */
            botMessages.map((m, idx) => (
              <div 
                key={idx}
                className={`d-flex ${m.sender === 'user' ? 'justify-content-end' : 'justify-content-start'}`}
              >
                <div 
                  className="p-2.5 px-3 rounded shadow-sm"
                  style={{
                    maxWidth: '85%',
                    fontSize: '0.82rem',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-line',
                    backgroundColor: m.sender === 'user' ? 'var(--pcc-blue)' : '#ffffff',
                    color: m.sender === 'user' ? '#fff' : '#1e293b',
                    border: m.sender === 'bot' ? '1px solid #e2e8f0' : 'none',
                    borderRadius: m.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px'
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))
          )}
        </div>

        {/* BOTTOM AREA */}
        {!showRequestForm && (
          <div className="bg-white border-top">
            {activeTabMode === 'bot' && (
              /* CHATBOT QUICK REPLIES AND REQUEST RECEPTIONIST BUTTON */
              <div className="p-2 bg-light border-bottom d-flex flex-wrap gap-1" style={{ fontSize: '0.72rem' }}>
                <button 
                  className="btn btn-xs btn-outline-secondary py-1 px-2 rounded-pill"
                  onClick={() => handleQuickOption('rates', 'Room Rates')}
                  style={{ fontSize: '0.72rem' }}
                >
                  Room Rates
                </button>
                <button 
                  className="btn btn-xs btn-outline-secondary py-1 px-2 rounded-pill"
                  onClick={() => handleQuickOption('checkin', 'Check-In Times')}
                  style={{ fontSize: '0.72rem' }}
                >
                  Check-In Times
                </button>
                <button 
                  className="btn btn-xs btn-outline-secondary py-1 px-2 rounded-pill"
                  onClick={() => handleQuickOption('amenities', 'Amenities')}
                  style={{ fontSize: '0.72rem' }}
                >
                  Amenities
                </button>
                <button 
                  className="btn btn-xs btn-outline-secondary py-1 px-2 rounded-pill"
                  onClick={() => handleQuickOption('location', 'Location')}
                  style={{ fontSize: '0.72rem' }}
                >
                  Location
                </button>
                <button 
                  className="btn btn-xs btn-pcc-primary py-1 px-2 rounded-pill text-white fw-bold w-100 mt-1"
                  onClick={handleOpenRequestForm}
                  style={{ fontSize: '0.75rem' }}
                >
                  Request Receptionist 👤
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
                placeholder={activeTabMode === 'live' ? "Type message to Receptionist..." : "Type your question here..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                style={{ fontSize: '0.8rem' }}
              />
              <button 
                type="submit" 
                className="btn btn-sm btn-pcc-primary px-3 text-white fw-semibold"
                style={{ fontSize: '0.8rem' }}
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
