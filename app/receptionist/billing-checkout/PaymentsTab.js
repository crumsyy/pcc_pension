'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import ModalPortal from '../../components/ModalPortal';
import PaymentTerminal from './PaymentTerminal';
import clientCache, { CACHE_TTL } from '@/lib/clientCache';
import { toast } from '@/components/ui/toast';

function PaymentsClient() {
  const searchParams = useSearchParams();
  const initialBookingID = searchParams.get('bookingID');

  const [activeBookings, setActiveBookings] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedBookingID, setSelectedBookingID] = useState('');
  const [loading, setLoading] = useState(true);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyMethodFilter, setHistoryMethodFilter] = useState('All');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const isFirstMount = useRef(true);

  const showAlert = (type, title, message) => {
    toast.add({
      type: type || 'info',
      title: title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notification'),
      description: message || ''
    });
  };

  // Keep ?bookingID in the URL so sibling tabs/deep-links share the selection.
  const syncBookingToUrl = (bID) => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (bID) params.set('bookingID', bID);
      else params.delete('bookingID');
      const qs = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    } catch (e) {}
  };

  const fetchInitialData = async (isBackground = false) => {
    if (!isBackground && !clientCache.has('RECEPTIONIST_PAYMENTS')) {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/receptionist/payments');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch payment details');

      setActiveBookings(data.activeBookings || []);
      setPaymentMethods(data.paymentMethods || []);
      setPaymentHistory(data.paymentHistory || []);

      clientCache.set('RECEPTIONIST_PAYMENTS', data, CACHE_TTL.RECEPTIONIST_PAYMENTS);

      if (initialBookingID && isFirstMount.current) {
        setSelectedBookingID(initialBookingID);
      }
    } catch (err) {
      if (!isBackground) showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = clientCache.get('RECEPTIONIST_PAYMENTS');
    if (cached) {
      setActiveBookings(cached.activeBookings || []);
      setPaymentMethods(cached.paymentMethods || []);
      setPaymentHistory(cached.paymentHistory || []);
      setLoading(false);
      if (initialBookingID) {
        setSelectedBookingID(initialBookingID);
      }
      fetchInitialData(true);
    } else {
      fetchInitialData(false);
    }
    isFirstMount.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Adopt a booking carried over from the Billing tab (?bookingID=) while mounted.
  const urlBookingID = searchParams.get('bookingID');
  useEffect(() => {
    if (urlBookingID && urlBookingID !== selectedBookingID) {
      setSelectedBookingID(urlBookingID);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlBookingID]);

  const handleBookingChange = (bID) => {
    setSelectedBookingID(bID || '');
    syncBookingToUrl(bID || '');
  };

  const bookingOptions = activeBookings.map(b => {
    const userTag = b.userID ? `UID-${b.userID}` : '';
    const guestTag = b.guestID ? `Guest-${b.guestID}` : '';
    const firstLast = `${b.firstName || ''} ${b.lastName || ''}`.trim();
    const lastFirst = `${b.lastName || ''}, ${b.firstName || ''}`.trim();
    const statusTag = (b.status && b.status !== 'Checked In' && b.status !== 'Active Stay') ? ` [${b.status}]` : '';
    const searchKW = `${firstLast} ${lastFirst} ${userTag} ${b.userID || ''} ${guestTag} ${b.guestID || ''} Room ${b.roomNumber} ${b.roomType || ''} ${b.contact || ''} BK-${b.bookingID} ${b.status || ''}`;

    return {
      value: String(b.bookingID),
      label: `Room ${b.roomNumber} (${b.roomType}) — ${lastFirst}${b.userID ? ` (UID: ${b.userID})` : ''}${statusTag}`,
      searchKeywords: searchKW
    };
  });

  // Filter payment history logs
  const filteredHistory = paymentHistory.filter(item => {
    const query = historySearch.toLowerCase();
    const guestName = `${item.firstName || ''} ${item.lastName || ''}`.toLowerCase();
    const trxID = `trx-${item.paymentID}`.toLowerCase();
    const rawID = String(item.paymentID).toLowerCase();

    const matchesQuery =
      guestName.includes(query) ||
      trxID.includes(query) ||
      rawID.includes(query) ||
      (item.contact || '').toLowerCase().includes(query) ||
      (item.roomNumber || '').toLowerCase().includes(query) ||
      String(item.bookingID || '').includes(query);

    const matchesMethod = historyMethodFilter === 'All' || item.paymentMethod === historyMethodFilter;

    let matchesDate = true;
    if (historyDateFilter) {
      const itemDateStr = item.paymentDateTime ? item.paymentDateTime.split(' ')[0] : '';
      matchesDate = itemDateStr === historyDateFilter;
    }

    return matchesQuery && matchesMethod && matchesDate;
  });

  return (
    <>
      <div className={`container-fluid py-3 d-flex flex-column ${shouldAnimate ? 'pcc-content-reveal' : ''}`} style={{ backgroundColor: '#f8f9fa', height: 'calc(100vh - 150px)', overflow: 'hidden' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h2 className="fw-bold mb-1 text-pcc-blue" style={{ color: 'var(--pcc-blue)', fontSize: '1.4rem' }}>
              Payment Management &amp; POS
            </h2>
            <p className="text-muted mb-0 small">Settle guest stays, accept GCash/Cash payments, and track transaction history.</p>
          </div>

          <button
            type="button"
            className="btn btn-pcc-primary text-white fw-bold px-3.5 py-2 shadow-sm"
            onClick={() => setShowHistoryModal(true)}
          >
            Payment History
          </button>
        </div>

        <div className="flex-grow-1 overflow-auto" style={{ minHeight: 0, paddingBottom: '15px' }}>
          <PaymentTerminal
            bookingID={selectedBookingID}
            bookingOptions={bookingOptions}
            pickerLoading={loading}
            paymentMethods={paymentMethods}
            onBookingChange={handleBookingChange}
            onPaid={() => fetchInitialData(true)}
            onCompleted={() => {
              setSelectedBookingID('');
              syncBookingToUrl('');
              fetchInitialData(true);
            }}
          />
        </div>
      </div>

      {/* PAYMENT HISTORY SCROLLABLE MODAL DIALOG */}
      {showHistoryModal && (
        <ModalPortal>
          <div className="modal show d-block animate__animated animate__fadeIn" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.32)', backdropFilter: 'blur(10px) saturate(125%)', WebkitBackdropFilter: 'blur(10px) saturate(125%)', zIndex: 99999 }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable" style={{ maxWidth: '92%' }}>
            <div className="modal-content border-0 shadow-lg" style={{ height: '85vh', borderRadius: '12px', overflow: 'hidden' }}>
              <div className="modal-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                <h5 className="modal-title fw-bold text-dark m-0" style={{ fontSize: '1.1rem' }}>
                  Payment History
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowHistoryModal(false)}></button>
              </div>

              {/* Filters Toolbar */}
              <div className="px-4 py-3 bg-light border-bottom d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="d-flex flex-wrap align-items-center gap-3">
                  <div>
                    <label className="form-label small fw-bold mb-1 text-muted d-block" style={{ fontSize: '0.75rem' }}>Search Transaction ID / Guest Name / Room</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. TRX-1, Guest Name, Room #..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      style={{ width: '260px', borderRadius: '6px' }}
                    />
                  </div>

                  <div>
                    <label className="form-label small fw-bold mb-1 text-muted d-block" style={{ fontSize: '0.75rem' }}>Filter by Date</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={historyDateFilter}
                      onChange={(e) => setHistoryDateFilter(e.target.value)}
                      style={{ width: '160px', borderRadius: '6px' }}
                    />
                  </div>

                  <div>
                    <label className="form-label small fw-bold mb-1 text-muted d-block" style={{ fontSize: '0.75rem' }}>Payment Method</label>
                    <select
                      className="form-select form-select-sm"
                      value={historyMethodFilter}
                      onChange={(e) => setHistoryMethodFilter(e.target.value)}
                      style={{ width: '140px', borderRadius: '6px' }}
                    >
                      <option value="All">All Methods</option>
                      <option value="Cash">Cash</option>
                      <option value="GCash">GCash</option>
                    </select>
                  </div>

                  {(historySearch || historyDateFilter || historyMethodFilter !== 'All') && (
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-danger p-0 mt-3 align-self-end text-decoration-none fw-semibold"
                      style={{ fontSize: '0.8rem' }}
                      onClick={() => {
                        setHistorySearch('');
                        setHistoryDateFilter('');
                        setHistoryMethodFilter('All');
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                <span className="badge bg-secondary text-white px-3 py-2" style={{ fontSize: '0.78rem' }}>
                  Total Records: {filteredHistory.length}
                </span>
              </div>

              {/* Scrollable Table Body */}
              <div className="modal-body p-0 overflow-auto">
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-5 text-muted small">
                    No payment history records found matching search filters.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.86rem' }}>
                      <thead className="table-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                        <tr>
                          <th>Transaction ID</th>
                          <th>Date &amp; Time</th>
                          <th>Guest Name</th>
                          <th>Room / Booking</th>
                          <th>Method</th>
                          <th>Amount Paid</th>
                          <th>Processed By</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.map((h) => (
                          <tr key={h.paymentID}>
                            <td className="fw-bold text-pcc-blue font-monospace">#TRX-{String(h.paymentID).padStart(5, '0')}</td>
                            <td className="small text-muted">{new Date(h.paymentDateTime).toLocaleString()}</td>
                            <td>
                              <div className="fw-bold text-dark">{h.firstName} {h.lastName}</div>
                              <small className="text-muted" style={{ fontSize: '0.72rem' }}>Contact: {h.contact || 'N/A'}</small>
                            </td>
                            <td>
                              <span className="fw-semibold text-dark">
                                {h.roomNumber ? `Room ${h.roomNumber}` : 'Direct SOA'}
                              </span>
                              {h.bookingID && <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Booking #{h.bookingID}</small>}
                            </td>
                            <td>
                              <span className={`badge ${h.paymentMethod === 'GCash' ? 'bg-primary text-white' : 'bg-success text-white'} px-2 py-1 me-1`} style={{ fontSize: '0.72rem' }}>
                                {h.paymentMethod}
                              </span>
                              {h.paymentMethod === 'GCash' && (
                                <span className="badge bg-warning text-dark font-mono px-1.5 py-0.5" style={{ fontSize: '0.68rem' }}>
                                  TEST
                                </span>
                              )}
                            </td>
                            <td className="fw-bold text-success fs-6">₱{parseFloat(h.amount).toFixed(2)}</td>
                            <td><small className="text-muted">{h.processedBy || 'Front Desk'}</small></td>
                            <td>
                              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1" style={{ fontSize: '0.72rem' }}>
                                Settled
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="modal-footer bg-light border-top py-2 px-4">
                <button type="button" className="btn btn-secondary text-white fw-semibold" onClick={() => setShowHistoryModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}

export default function ReceptionistPayments() {
  return (
    <PaymentsClient />
  );
}
