'use client';

import { useState, useEffect, useRef } from 'react';

export default function GuestChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Hello! I am your PCC Virtual Assistant. How can I help you with your stay today?'
    }
  ]);
  const [dbInquiry, setDbInquiry] = useState(null);
  const chatBodyRef = useRef(null);

  const fetchDbInquiry = async () => {
    try {
      const res = await fetch('/api/guest/inquiries');
      if (res.ok) {
        const data = await res.json();
        setDbInquiry(data.inquiry || null);
      }
    } catch (err) {
      console.error("Error fetching guest inquiry:", err);
    }
  };

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchDbInquiry();
    }
  }, [isOpen]);

  const knowledgeBase = {
    rates: "PCC room rates per night:\n" +
           "• Ground Floor:\n" +
           "  - Standard Matrimonial: ₱1,200 (₱1,500 w/ breakfast)\n" +
           "  - Twin Bed: ₱1,300 (₱1,800 w/ breakfast)\n" +
           "  - Deluxe Suite: ₱2,100 (₱2,500 w/ breakfast)\n" +
           "• Second Floor:\n" +
           "  - Standard Matrimonial: ₱1,500 (₱1,800 w/ breakfast)\n" +
           "  - Twin Bed: ₱1,800 (₱2,200 w/ breakfast)\n" +
           "  - Deluxe Suite: ₱2,200 (₱2,500 w/ breakfast)",
    checkin: "Check-in time is at 2:00 PM. Check-out time is at 12:00 PM (noon).\n\n" +
             "Early check-in fee is ₱50 per hour before 2:00 PM. Late check-out fee is ₱150 per hour after 12:00 PM.",
    breakfast: "Standard breakfast is served from 6:30 AM to 9:30 AM daily at the dining hall. Category 3 products can be pre-ordered from receptionist dashboard.",
    support: "If you need immediate assistance or would like to request services/amenities (like extra towels or toiletries), please type your message below and click 'Submit Request' to alert the Front Desk!"
  };

  const getBotReply = (msg) => {
    const text = msg.toLowerCase();
    if (text.includes('rate') || text.includes('price') || text.includes('cost') || text.includes('how much')) {
      return knowledgeBase.rates;
    }
    if (text.includes('checkin') || text.includes('checkout') || text.includes('check-in') || text.includes('check-out') || text.includes('time')) {
      return knowledgeBase.checkin;
    }
    if (text.includes('breakfast') || text.includes('meal') || text.includes('silog')) {
      return knowledgeBase.breakfast;
    }
    if (text.includes('service') || text.includes('towel') || text.includes('amenity') || text.includes('request') || text.includes('help')) {
      return knowledgeBase.support;
    }
    return "I'm not fully sure about that request, but I can help with room rates, check-in times, breakfast options, or submit a request to the Front Desk. Simply type your request and click 'Submit Request'.";
  };

  const handleSendMessage = (text) => {
    if (!text.trim()) return;

    setMessages(prev => [...prev, { sender: 'user', text }]);
    setInput('');

    setTimeout(() => {
      const reply = getBotReply(text);
      setMessages(prev => [...prev, { sender: 'bot', text: reply }]);
    }, 400);
  };

  const handleQuickOption = (key, label) => {
    setMessages(prev => [...prev, { sender: 'user', text: label }]);
    setTimeout(() => {
      const reply = knowledgeBase[key];
      setMessages(prev => [...prev, { sender: 'bot', text: reply }]);
    }, 400);
  };

  const handleForwardToStaff = async () => {
    if (messages.length < 2) return;
    
    // Find last user message
    const userMsgs = messages.filter(m => m.sender === 'user');
    if (userMsgs.length === 0) return;
    
    const lastMsg = userMsgs[userMsgs.length - 1].text;
    
    try {
      setMessages(prev => [...prev, { sender: 'bot', text: 'Submitting request to Front Desk staff...' }]);
      
      const res = await fetch('/api/guest/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: lastMsg })
      });
      
      if (!res.ok) throw new Error('Network error');
      
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: '🟢 Request submitted! Front Desk has been notified. A receptionist will respond shortly.' 
      }]);
      fetchDbInquiry();
    } catch (err) {
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: '❌ Failed to submit request. Please try again or visit the Front Desk.' 
      }]);
    }
  };

  return (
    <>
      {/* FLOATING ACTION TRIGGER */}
      <button 
        className="chatbot-toggle shadow-lg" 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
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
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* CHAT WINDOW */}
      <div 
        className={`chatbot-window card border-0 shadow-lg ${isOpen ? 'active d-flex' : 'd-none'}`}
        style={{
          position: 'fixed',
          bottom: '92px',
          right: '24px',
          width: '350px',
          height: '480px',
          zIndex: 1050,
          borderRadius: '12px',
          backgroundColor: '#fff',
          overflow: 'hidden',
          flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
        }}
      >
        {/* HEADER */}
        <div 
          className="chatbot-header p-3 text-white d-flex align-items-center justify-content-between"
          style={{ backgroundColor: 'var(--pcc-blue)' }}
        >
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: '1.25rem' }}>🤖</span>
            <div>
              <div className="fw-bold small" style={{ lineHeight: 1.2 }}>PCC Assistant</div>
              <div style={{ fontSize: '0.65rem', opacity: 0.85 }}>Online • Virtual Host</div>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-close btn-close-white" 
            onClick={() => setIsOpen(false)}
            style={{ fontSize: '0.75rem' }}
          ></button>
        </div>

        {/* BODY */}
        <div 
          className="chatbot-body p-3 flex-grow-1" 
          ref={chatBodyRef}
          style={{ 
            overflowY: 'auto', 
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {dbInquiry && (
            <div className="p-2 mb-2 rounded bg-white shadow-sm border text-start" style={{ fontSize: '0.75rem', borderLeft: '3px solid var(--pcc-green)' }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="fw-bold text-dark">🛎️ Staff Request Status</span>
                <span className={`badge ${dbInquiry.status === 'Pending' ? 'text-bg-warning text-dark' : 'text-bg-success text-white'}`}>
                  {dbInquiry.status}
                </span>
              </div>
              <div className="text-muted text-truncate" style={{ fontSize: '0.72rem' }}>
                <strong>Message:</strong> {dbInquiry.message}
              </div>
              {dbInquiry.response && (
                <div className="mt-1 p-1 px-2 bg-success-subtle text-success rounded" style={{ fontSize: '0.72rem', borderLeft: '2px solid #3FA34D' }}>
                  <strong>Response:</strong> {dbInquiry.response}
                </div>
              )}
            </div>
          )}
          {messages.map((m, idx) => (
            <div 
              key={idx}
              className={`d-flex ${m.sender === 'user' ? 'justify-content-end' : 'justify-content-start'}`}
            >
              <div 
                className="p-2.5 px-3 rounded"
                style={{
                  maxWidth: '85%',
                  fontSize: '0.82rem',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-line',
                  backgroundColor: m.sender === 'user' ? 'var(--pcc-blue)' : '#e2e8f0',
                  color: m.sender === 'user' ? '#fff' : '#1e293b',
                  borderRadius: m.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px'
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        {/* QUICK REPLIES */}
        <div className="p-2 bg-light border-top d-flex flex-wrap gap-1" style={{ fontSize: '0.72rem' }}>
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
            onClick={() => handleQuickOption('breakfast', 'Breakfast Options')}
            style={{ fontSize: '0.72rem' }}
          >
            Breakfast Options
          </button>
          <button 
            className="btn btn-xs btn-outline-secondary py-1 px-2 rounded-pill text-danger border-danger"
            onClick={() => handleQuickOption('support', 'Service Request')}
            style={{ fontSize: '0.72rem' }}
          >
            Request Service 🛎️
          </button>
        </div>

        {/* INPUT FORM */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(input);
          }}
          className="p-2 border-top d-flex gap-1"
        >
          <input 
            type="text"
            className="form-control form-control-sm flex-grow-1"
            placeholder="Type your request here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ fontSize: '0.8rem' }}
          />
          <button 
            type="submit" 
            className="btn btn-sm btn-primary px-3 text-white fw-semibold"
            style={{ fontSize: '0.8rem' }}
          >
            Send
          </button>
          {messages.some(m => m.sender === 'user') && (
            <button 
              type="button" 
              className="btn btn-sm btn-danger px-2 text-white fw-semibold"
              onClick={handleForwardToStaff}
              title="Submit request to staff"
              style={{ fontSize: '0.8rem' }}
            >
              Submit Request
            </button>
          )}
        </form>
      </div>
    </>
  );
}
