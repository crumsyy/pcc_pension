'use client';

import { useState, useEffect } from 'react';
import ModalDialog from '../../components/ModalDialog';

export default function ReceptionistInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [replyText, setReplyText] = useState('');

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

  useEffect(() => {
    fetchInquiries();
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
      
      // Update selected inquiry in local state to show it is responded
      const updatedInquiry = {
        ...selectedInquiry,
        status: 'Responded',
        response: replyText
      };
      setSelectedInquiry(updatedInquiry);
      
      // Refresh list
      fetchInquiries();
    } catch (err) {
      showAlert('error', 'Error', err.message);
    }
  };

  const filteredInquiries = inquiries.filter(inq => 
    inq.name.toLowerCase().includes(search.toLowerCase()) ||
    inq.email.toLowerCase().includes(search.toLowerCase()) ||
    inq.message.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="container-fluid py-4" style={{ backgroundColor: '#f8f9fa', minHeight: '85vh' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="fw-bold mb-1 text-pcc-blue" style={{ color: 'var(--pcc-blue)' }}>Guest Inquiries</h2>
            <p className="text-muted mb-0">View and respond to guest inquiries and chatbot escalations.</p>
          </div>
        </div>

        <div className="row g-4">
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
