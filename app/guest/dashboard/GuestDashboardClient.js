'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import NotificationBell from '../../components/NotificationBell';
import GuestChatBubble from '../../components/GuestChatBubble';
import ModalDialog from '../../components/ModalDialog';

export default function GuestDashboardClient({ initialGuest, initialReservations, initialBookings, initialActiveBill, initialAllRooms }) {
  const [guest, setGuest] = useState(initialGuest);
  const [reservations, setReservations] = useState(initialReservations || []);
  const [bookings, setBookings] = useState(initialBookings || []);
  const [activeBill, setActiveBill] = useState(initialActiveBill);
  const [allRooms, setAllRooms] = useState(initialAllRooms || []);
  const [discounts, setDiscounts] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Workflow Mode: 'dashboard' | 'select_room'
  const [viewMode, setViewMode] = useState('dashboard');
  const [flowAction, setFlowAction] = useState('reserve'); // 'reserve' | 'book'

  // Modal Workflow States: 'none' | 'reserve_form' | 'book_form' | 'payment' | 'receipt' | 'reservation_summary'
  const [activeModal, setActiveModal] = useState('none');
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Form States
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().substring(0, 10));
  const [checkOutDate, setCheckOutDate] = useState(new Date(Date.now() + 86400000).toISOString().substring(0, 10));
  const [numGuests, setNumGuests] = useState(1);
  const [specialRequests, setSpecialRequests] = useState('');

  const [paymentOption, setPaymentOption] = useState('50'); // '25' | '50' | '100'
  const [gcashRef, setGcashRef] = useState('');
  const [registeredGuests, setRegisteredGuests] = useState([
    { fullName: `${initialGuest.firstName} ${initialGuest.lastName}`, age: 30, discountID: '', discountIdNumber: '' }
  ]);
  const [reservationSummaryData, setReservationSummaryData] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Alert Dialog
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

  const showConfirm = (title, message, onConfirm) => {
    setModalConfig({
      isOpen: true,
      type: 'warning',
      title,
      message,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      },
      onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const fetchRoomsAndStatus = async () => {
    setLoadingRooms(true);
    try {
      const res = await fetch('/api/guest/reservations');
      const data = await res.json();
      if (res.ok) {
        setAllRooms(data.allRooms || []);
        if (data.reservations) setReservations(data.reservations);
      }
    } catch (err) {
      console.error("Failed to load room selection layout:", err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const fetchDiscounts = async () => {
    try {
      const res = await fetch('/api/receptionist/bookings?discountsOnly=true');
      const data = await res.json();
      if (data.discounts) setDiscounts(data.discounts);
    } catch (err) {
      console.error("Failed to load discounts:", err);
    }
  };

  useEffect(() => {
    fetchRoomsAndStatus();
    fetchDiscounts();
  }, []);

  // Near real-time background polling (every 4s) for room availability and status updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [resResp, bookResp] = await Promise.all([
          fetch('/api/guest/reservations'),
          fetch('/api/guest/bookings')
        ]);
        if (resResp.ok) {
          const rData = await resResp.json();
          if (rData.allRooms) setAllRooms(rData.allRooms);
          if (rData.reservations) setReservations(rData.reservations);
        }
        if (bookResp.ok) {
          const bData = await bookResp.json();
          if (bData.bookings) setBookings(bData.bookings);
        }
      } catch (err) {
        // silent polling error
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Calculations for Stay & Billing
  const calculateNights = () => {
    const cIn = new Date(checkInDate);
    const cOut = new Date(checkOutDate);
    const diff = Math.abs(cOut - cIn);
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) || 1;
  };

  const nightsCount = calculateNights();
  const roomRate = selectedRoom ? parseFloat(selectedRoom.rate) : 0;
  const originalTotal = roomRate * nightsCount;

  // Apportionment discount math
  let totalDiscount = 0;
  if (selectedRoom && registeredGuests.length > 0) {
    const sharePerGuest = originalTotal / registeredGuests.length;
    registeredGuests.forEach(g => {
      if (g.discountID) {
        const disc = discounts.find(d => String(d.discountID) === String(g.discountID));
        if (disc) {
          totalDiscount += sharePerGuest * (parseFloat(disc.percentage) / 100);
        }
      }
    });
  }

  const netTotalAmount = Math.max(0, originalTotal - totalDiscount);
  const paymentPctNumber = parseInt(paymentOption);
  const amountToPayNow = netTotalAmount * (paymentPctNumber / 100);
  const remainingBalanceAfterPay = netTotalAmount - amountToPayNow;

  // Triggers for Visual Room Layout Selection Page
  const handleStartReserveFlow = () => {
    setFlowAction('reserve');
    setViewMode('select_room');
    fetchRoomsAndStatus();
  };

  const handleStartBookFlow = () => {
    setFlowAction('book');
    setViewMode('select_room');
    fetchRoomsAndStatus();
  };

  const handleSelectRoomCard = (rm) => {
    if (rm.status !== 'Available') return; // Disabled non-available rooms

    setSelectedRoom(rm);
    if (flowAction === 'reserve') {
      setActiveModal('reserve_form');
    } else {
      setActiveModal('book_form');
    }
  };

  // Submission Handlers
  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (!selectedRoom) return;
    setProcessing(true);

    try {
      const res = await fetch('/api/guest/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomID: selectedRoom.roomID,
          checkInDate,
          checkOutDate,
          numGuests,
          specialRequests
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit reservation');

      setReservationSummaryData(data.summary);
      setActiveModal('reservation_summary');
      fetchRoomsAndStatus();
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleProceedToPayment = (e) => {
    e.preventDefault();
    if (registeredGuests.some(g => !g.fullName.trim())) {
      showAlert('warning', 'Missing Name', 'All registered room guests must have a full name.');
      return;
    }
    setActiveModal('payment');
  };

  const handleConfirmGCashBookingPayment = async (e) => {
    e.preventDefault();
    if (!gcashRef.trim()) {
      showAlert('warning', 'GCash Reference Required', 'Please enter your GCash payment reference number.');
      return;
    }
    setProcessing(true);

    try {
      // 1. Create Online Booking
      const bookRes = await fetch('/api/guest/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          roomID: selectedRoom.roomID,
          checkInDate,
          checkOutDate,
          registeredGuests
        })
      });

      const bookData = await bookRes.json();
      if (!bookRes.ok) throw new Error(bookData.error || 'Failed to create online booking');

      const bookingID = bookData.bookingID;

      // 2. Submit GCash Payment
      const payRes = await fetch('/api/guest/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingID,
          paymentPercentage: `${paymentPctNumber}%`,
          referenceNumber: gcashRef.trim(),
          amountToPay: amountToPayNow
        })
      });

      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.error || 'Failed to process payment');

      setReceiptData(payData.receipt);
      setActiveModal('receipt');
      fetchRoomsAndStatus();
    } catch (err) {
      showAlert('error', 'Payment Error', err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelReservation = (reservationID) => {
    showConfirm('Cancel Reservation', 'Are you sure you want to cancel this reservation request?', async () => {
      try {
        const res = await fetch('/api/guest/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel', reservationID })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to cancel reservation');

        showAlert('success', 'Canceled', data.message);
        fetchRoomsAndStatus();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleCancelBooking = (bookingID) => {
    showConfirm('Cancel Booking', 'Are you sure you want to cancel this booking request?', async () => {
      try {
        const res = await fetch('/api/guest/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel', bookingID })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to cancel booking');

        showAlert('success', 'Canceled', data.message);
        fetchRoomsAndStatus();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handlePrintReceipt = () => {
    if (!receiptData) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Payment Receipt - PCC Home Suite Home</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: auto; }
            .header { text-align: center; border-bottom: 2px solid #2155B5; padding-bottom: 12px; margin-bottom: 16px; }
            .header h2 { margin: 0; color: #2155B5; }
            .header p { margin: 2px 0; font-size: 0.85rem; color: #64748b; }
            .table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 0.9rem; }
            .table th, .table td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
            .table th { background: #f8fafc; }
            .total { font-size: 1.1rem; font-weight: bold; color: #2155B5; }
            .footer { text-align: center; margin-top: 24px; font-size: 0.8rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>PCC Home Suite Home</h2>
            <p>Osmeña Street, Zone 1, Koronadal City, South Cotabato, Philippines</p>
            <p>Contact: 09000000000 | Info: info@pccsuite.com</p>
          </div>
          <h3 style="text-align: center; margin-bottom: 16px;">OFFICIAL ONLINE GCASH RECEIPT</h3>
          <table class="table">
            <tr><td><strong>Receipt No:</strong></td><td>#REC-${receiptData.paymentID}</td></tr>
            <tr><td><strong>Booking ID:</strong></td><td>#${receiptData.bookingID}</td></tr>
            <tr><td><strong>Guest Name:</strong></td><td>${receiptData.guestName}</td></tr>
            <tr><td><strong>Payment Method:</strong></td><td>${receiptData.paymentMethod}</td></tr>
            <tr><td><strong>GCash Ref No:</strong></td><td>${receiptData.referenceNumber}</td></tr>
            <tr><td><strong>Payment Option:</strong></td><td>${receiptData.paymentPercentage}</td></tr>
            <tr><td><strong>Amount Paid:</strong></td><td class="total">₱${receiptData.amountPaid.toFixed(2)}</td></tr>
            <tr><td><strong>Remaining Balance:</strong></td><td>₱${receiptData.remainingBalance.toFixed(2)}</td></tr>
            <tr><td><strong>Date & Time:</strong></td><td>${new Date(receiptData.timestamp).toLocaleString()}</td></tr>
          </table>
          <div class="footer">
            <p>Thank you for booking with PCC Home Suite Home!</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const activeBookingsCount = bookings.filter(b => b.status === "Checked In").length;

  // Group rooms by Floor safely
  const groundFloorRooms = allRooms.filter(r => String(r.floorID) === '1' || r.floorName?.toLowerCase().includes('ground') || String(r.roomNumber).startsWith('1'));
  const secondFloorRooms = allRooms.filter(r => String(r.floorID) === '2' || r.floorName?.toLowerCase().includes('second') || r.floorName?.toLowerCase().includes('upper') || String(r.roomNumber).startsWith('2'));
  const fallbackRooms = allRooms.filter(r => !groundFloorRooms.some(g => g.roomID === r.roomID) && !secondFloorRooms.some(s => s.roomID === r.roomID));

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

      {/* NAVBAR */}
      <nav className="navbar navbar-expand-lg navbar-pcc guest-fixed-nav">
        <div className="container-fluid px-4">
          <Link href="/" className="navbar-brand d-flex align-items-center gap-2">
            <img src="/assets/images/logo.jpg" height="42" alt="PCC Logo" style={{ borderRadius: "4px" }} />
          </Link>
          <div className="d-flex align-items-center gap-3 ms-auto">
            <span className="text-muted d-none d-md-inline" style={{ fontSize: "0.9rem" }}>
              Hi, <strong className="text-blue">{guest.firstName}</strong>
            </span>
            <NotificationBell />
            <a href="/api/auth/logout" className="btn btn-pcc-outline btn-sm">Log Out</a>
          </div>
        </div>
      </nav>

      <div className="container py-4 guest-content-wrapper">
        {/* TOP HEADER & ACTION BUTTONS */}
        <div className="mb-4 d-flex justify-content-between align-items-center flex-wrap gap-3 p-3 bg-white rounded shadow-sm border">
          <div>
            <div className="section-eyebrow">Guest Portal</div>
            <h2 className="section-title mb-0">Welcome, {guest.firstName} {guest.lastName}!</h2>
            <p className="text-muted mb-0 small">Select an action below to view our interactive visual room layout and book or reserve stay dates.</p>
          </div>

          {/* TWO MAIN ACTION BUTTONS */}
          <div className="d-flex gap-2">
            <button 
              className="btn btn-success text-white fw-bold px-3 py-2 shadow-sm d-flex align-items-center gap-2"
              onClick={handleStartReserveFlow}
              style={{ backgroundColor: '#198754', borderColor: '#198754', borderRadius: '8px' }}
            >
              <span style={{ fontSize: '1.1rem' }}>🟢</span> Reserve a Room
            </button>
            <button 
              className="btn btn-primary text-white fw-bold px-3 py-2 shadow-sm d-flex align-items-center gap-2"
              onClick={handleStartBookFlow}
              style={{ backgroundColor: '#0d6efd', borderColor: '#0d6efd', borderRadius: '8px' }}
            >
              <span style={{ fontSize: '1.1rem' }}>🔵</span> Book a Room
            </button>
            {viewMode === 'select_room' && (
              <button 
                className="btn btn-outline-secondary fw-semibold px-3 py-2"
                onClick={() => setViewMode('dashboard')}
                style={{ borderRadius: '8px' }}
              >
                🏠 Back to Dashboard
              </button>
            )}
          </div>
        </div>

        {viewMode === 'select_room' ? (
          /* VISUAL ROOM LAYOUT & SELECTION SECTIONS */
          <div className="animate__animated animate__fadeIn">
            {/* COLOR CODING STATUS LEGEND BAR */}
            <div className="card shadow-sm border-0 p-3 mb-4 bg-white" style={{ borderRadius: '12px' }}>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <h5 className="fw-bold mb-1 text-dark">
                    {flowAction === 'reserve' ? '🟢 Select Room to Reserve' : '🔵 Select Room to Book'}
                  </h5>
                  <p className="text-muted mb-0 small">Click any Green (Available) room card to proceed with your request.</p>
                </div>

                {/* COLOR LEGEND */}
                <div className="d-flex align-items-center gap-3 p-2 bg-light rounded border flex-wrap" style={{ fontSize: '0.82rem' }}>
                  <div className="fw-bold text-dark">Status Legend:</div>
                  <div className="d-flex align-items-center gap-1">
                    <span className="badge bg-success rounded-circle p-1.5" style={{ width: '12px', height: '12px' }}></span>
                    <span className="fw-bold text-success">🟢 Green = Available (Selectable)</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <span className="badge bg-primary rounded-circle p-1.5" style={{ width: '12px', height: '12px' }}></span>
                    <span className="fw-semibold text-primary">🔵 Blue = Occupied</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <span className="badge bg-danger rounded-circle p-1.5" style={{ width: '12px', height: '12px' }}></span>
                    <span className="fw-semibold text-danger">🔴 Red = Under Maintenance</span>
                  </div>
                </div>
              </div>
            </div>

            {loadingRooms ? (
              <div className="text-center py-5">
                <div className="spinner-border text-pcc-primary" role="status">
                  <span className="visually-hidden">Loading visual room layout...</span>
                </div>
              </div>
            ) : (
              <>
                {/* GROUND FLOOR GRID */}
                <div className="mb-4">
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <h5 className="fw-bold text-pcc-blue mb-0">Ground Floor Layout</h5>
                    <span className="badge bg-light text-muted border">Floor 1</span>
                  </div>
                  <div className="row g-3">
                    {groundFloorRooms.map((rm) => {
                      const isAvailable = rm.status === 'Available';
                      const isOccupied = rm.status === 'Occupied';
                      const isMaintenance = rm.status === 'Under Maintenance' || rm.status === 'Reserved' || !isAvailable;

                      const cardBgColor = isAvailable ? '#ffffff' : (isOccupied ? '#f0f7ff' : '#fff5f5');
                      const borderLeftColor = isAvailable ? '#198754' : (isOccupied ? '#0d6efd' : '#dc3545');
                      const badgeClass = isAvailable ? 'bg-success text-white' : (isOccupied ? 'bg-primary text-white' : 'bg-danger text-white');

                      return (
                        <div key={rm.roomID} className="col-md-6 col-lg-4 col-xl-3">
                          <div 
                            className={`card h-100 shadow-sm border-0 p-3 transition-all ${isAvailable ? 'room-card-hover cursor-pointer' : 'opacity-75'}`}
                            onClick={() => handleSelectRoomCard(rm)}
                            style={{
                              borderRadius: '12px',
                              backgroundColor: cardBgColor,
                              borderLeft: `5px solid ${borderLeftColor} !important`,
                              cursor: isAvailable ? 'pointer' : 'not-allowed',
                              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                            }}
                          >
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div>
                                <h4 className="fw-bold mb-0 text-dark" style={{ fontSize: '1.35rem' }}>Room {rm.roomNumber}</h4>
                                <div className="text-muted small fw-semibold">{rm.roomType}</div>
                              </div>
                              <span className={`badge ${badgeClass} px-2 py-1`} style={{ fontSize: '0.75rem' }}>
                                {isAvailable ? '🟢 Available' : (isOccupied ? '🔵 Occupied' : '🔴 Maintenance')}
                              </span>
                            </div>

                            <div className="my-2 p-2 bg-light rounded" style={{ fontSize: '0.8rem', color: '#475569' }}>
                              <div className="d-flex justify-content-between">
                                <span>Max Capacity:</span>
                                <strong className="text-dark">Up to {rm.occupancyLimit} Pax</strong>
                              </div>
                              <div className="d-flex justify-content-between">
                                <span>Aircon:</span>
                                <strong>{rm.isAircon ? 'Yes' : 'Fan Only'}</strong>
                              </div>
                              <div className="d-flex justify-content-between">
                                <span>Hot Shower:</span>
                                <strong>{rm.hasHotShower ? 'Yes' : 'Standard'}</strong>
                              </div>
                            </div>

                            <div className="mt-auto pt-2 d-flex justify-content-between align-items-center">
                              <div>
                                <span className="text-muted" style={{ fontSize: '0.72rem' }}>Standard Rate:</span>
                                <div className="fw-bold text-pcc-blue" style={{ fontSize: '1.05rem' }}>₱{parseFloat(rm.rate).toFixed(2)}</div>
                              </div>
                              {isAvailable ? (
                                <button className={`btn btn-xs fw-bold px-3 ${flowAction === 'reserve' ? 'btn-success text-white' : 'btn-primary text-white'}`} style={{ borderRadius: '6px' }}>
                                  {flowAction === 'reserve' ? 'Reserve 🟢' : 'Book 🔵'}
                                </button>
                              ) : (
                                <span className="badge bg-secondary text-white" style={{ fontSize: '0.7rem' }}>Disabled</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SECOND FLOOR GRID */}
                <div className="mb-4">
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <h5 className="fw-bold text-pcc-blue mb-0">Second Floor Layout</h5>
                    <span className="badge bg-light text-muted border">Floor 2</span>
                  </div>
                  <div className="row g-3">
                    {secondFloorRooms.map((rm) => {
                      const isAvailable = rm.status === 'Available';
                      const isOccupied = rm.status === 'Occupied';

                      const cardBgColor = isAvailable ? '#ffffff' : (isOccupied ? '#f0f7ff' : '#fff5f5');
                      const borderLeftColor = isAvailable ? '#198754' : (isOccupied ? '#0d6efd' : '#dc3545');
                      const badgeClass = isAvailable ? 'bg-success text-white' : (isOccupied ? 'bg-primary text-white' : 'bg-danger text-white');

                      return (
                        <div key={rm.roomID} className="col-md-6 col-lg-4 col-xl-3">
                          <div 
                            className={`card h-100 shadow-sm border-0 p-3 transition-all ${isAvailable ? 'room-card-hover cursor-pointer' : 'opacity-75'}`}
                            onClick={() => handleSelectRoomCard(rm)}
                            style={{
                              borderRadius: '12px',
                              backgroundColor: cardBgColor,
                              borderLeft: `5px solid ${borderLeftColor} !important`,
                              cursor: isAvailable ? 'pointer' : 'not-allowed',
                              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                            }}
                          >
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div>
                                <h4 className="fw-bold mb-0 text-dark" style={{ fontSize: '1.35rem' }}>Room {rm.roomNumber}</h4>
                                <div className="text-muted small fw-semibold">{rm.roomType}</div>
                              </div>
                              <span className={`badge ${badgeClass} px-2 py-1`} style={{ fontSize: '0.75rem' }}>
                                {isAvailable ? '🟢 Available' : (isOccupied ? '🔵 Occupied' : '🔴 Maintenance')}
                              </span>
                            </div>

                            <div className="my-2 p-2 bg-light rounded" style={{ fontSize: '0.8rem', color: '#475569' }}>
                              <div className="d-flex justify-content-between">
                                <span>Max Capacity:</span>
                                <strong className="text-dark">Up to {rm.occupancyLimit} Pax</strong>
                              </div>
                              <div className="d-flex justify-content-between">
                                <span>Aircon:</span>
                                <strong>{rm.isAircon ? 'Yes' : 'Fan Only'}</strong>
                              </div>
                              <div className="d-flex justify-content-between">
                                <span>Hot Shower:</span>
                                <strong>{rm.hasHotShower ? 'Yes' : 'Standard'}</strong>
                              </div>
                            </div>

                            <div className="mt-auto pt-2 d-flex justify-content-between align-items-center">
                              <div>
                                <span className="text-muted" style={{ fontSize: '0.72rem' }}>Standard Rate:</span>
                                <div className="fw-bold text-pcc-blue" style={{ fontSize: '1.05rem' }}>₱{parseFloat(rm.rate).toFixed(2)}</div>
                              </div>
                              {isAvailable ? (
                                <button className={`btn btn-xs fw-bold px-3 ${flowAction === 'reserve' ? 'btn-success text-white' : 'btn-primary text-white'}`} style={{ borderRadius: '6px' }}>
                                  {flowAction === 'reserve' ? 'Reserve 🟢' : 'Book 🔵'}
                                </button>
                              ) : (
                                <span className="badge bg-secondary text-white" style={{ fontSize: '0.7rem' }}>Disabled</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {fallbackRooms.length > 0 && (
                  <div className="mb-4">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <h5 className="fw-bold text-pcc-blue mb-0">Additional Rooms</h5>
                      <span className="badge bg-light text-muted border">Rooms</span>
                    </div>
                    <div className="row g-3">
                      {fallbackRooms.map((rm) => {
                        const isAvailable = rm.status === 'Available';
                        const isOccupied = rm.status === 'Occupied';

                        const cardBgColor = isAvailable ? '#ffffff' : (isOccupied ? '#f0f7ff' : '#fff5f5');
                        const borderLeftColor = isAvailable ? '#198754' : (isOccupied ? '#0d6efd' : '#dc3545');
                        const badgeClass = isAvailable ? 'bg-success text-white' : (isOccupied ? 'bg-primary text-white' : 'bg-danger text-white');

                        return (
                          <div key={rm.roomID} className="col-md-6 col-lg-4 col-xl-3">
                            <div 
                              className={`card h-100 shadow-sm border-0 p-3 transition-all ${isAvailable ? 'room-card-hover cursor-pointer' : 'opacity-75'}`}
                              onClick={() => handleSelectRoomCard(rm)}
                              style={{
                                borderRadius: '12px',
                                backgroundColor: cardBgColor,
                                borderLeft: `5px solid ${borderLeftColor} !important`,
                                cursor: isAvailable ? 'pointer' : 'not-allowed',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                              }}
                            >
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                  <h4 className="fw-bold mb-0 text-dark" style={{ fontSize: '1.35rem' }}>Room {rm.roomNumber}</h4>
                                  <div className="text-muted small fw-semibold">{rm.roomType}</div>
                                </div>
                                <span className={`badge ${badgeClass} px-2 py-1`} style={{ fontSize: '0.75rem' }}>
                                  {isAvailable ? '🟢 Available' : (isOccupied ? '🔵 Occupied' : '🔴 Maintenance')}
                                </span>
                              </div>

                              <div className="my-2 p-2 bg-light rounded" style={{ fontSize: '0.8rem', color: '#475569' }}>
                                <div className="d-flex justify-content-between">
                                  <span>Max Capacity:</span>
                                  <strong className="text-dark">Up to {rm.occupancyLimit} Pax</strong>
                                </div>
                                <div className="d-flex justify-content-between">
                                  <span>Aircon:</span>
                                  <strong>{rm.isAircon ? 'Yes' : 'Fan Only'}</strong>
                                </div>
                                <div className="d-flex justify-content-between">
                                  <span>Hot Shower:</span>
                                  <strong>{rm.hasHotShower ? 'Yes' : 'Standard'}</strong>
                                </div>
                              </div>

                              <div className="mt-auto pt-2 d-flex justify-content-between align-items-center">
                                <div>
                                  <span className="text-muted" style={{ fontSize: '0.72rem' }}>Standard Rate:</span>
                                  <div className="fw-bold text-pcc-blue" style={{ fontSize: '1.05rem' }}>₱{parseFloat(rm.rate).toFixed(2)}</div>
                                </div>
                                {isAvailable ? (
                                  <button className={`btn btn-xs fw-bold px-3 ${flowAction === 'reserve' ? 'btn-success text-white' : 'btn-primary text-white'}`} style={{ borderRadius: '6px' }}>
                                    {flowAction === 'reserve' ? 'Reserve 🟢' : 'Book 🔵'}
                                  </button>
                                ) : (
                                  <span className="badge bg-secondary text-white" style={{ fontSize: '0.7rem' }}>Disabled</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* REGULAR DASHBOARD VIEW */
          <>
            {/* Quick stats */}
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <div className="key-tag text-center">
                  <div style={{ fontSize: "2rem", fontWeight: "700", color: "var(--pcc-blue)" }}>
                    {reservations.length}
                  </div>
                  <div className="room-meta">Reservations</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="key-tag text-center">
                  <div style={{ fontSize: "2rem", fontWeight: "700", color: "var(--pcc-blue)" }}>
                    {bookings.length}
                  </div>
                  <div className="room-meta">Bookings</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="key-tag text-center">
                  <div style={{ fontSize: "2rem", fontWeight: "700", color: "var(--pcc-green)" }}>
                    {activeBookingsCount}
                  </div>
                  <div className="room-meta">Currently Checked In</div>
                </div>
              </div>
            </div>

            <div className="row g-4">
              {/* Profile */}
              <div className="col-lg-4">
                <div className="key-tag h-100">
                  <div className="room-type mb-3">My Guest Profile</div>
                  <table className="table table-sm table-borderless mb-3" style={{ fontSize: "0.9rem" }}>
                    <tbody>
                      <tr>
                        <td className="text-muted">Name</td>
                        <td className="fw-semibold">{guest.firstName} {guest.lastName}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Email</td>
                        <td>{guest.email}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Contact</td>
                        <td>{guest.contact}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Gender</td>
                        <td>{guest.gender}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">City</td>
                        <td>{guest.city}, {guest.province}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Member Since</td>
                        <td>{formatDate(guest.createdAt)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <Link href="/guest/edit-profile" className="btn btn-pcc-outline btn-sm w-100">
                    Edit Profile
                  </Link>
                </div>
              </div>

              {/* Reservations & Bookings Lists */}
              <div className="col-lg-8">
                {/* Reservations List */}
                <div className="key-tag mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="room-type">My Reservations History</div>
                    <button className="btn btn-success btn-sm fw-bold" onClick={handleStartReserveFlow}>
                      🟢 + Reserve Room
                    </button>
                  </div>
                  {reservations.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: "0.9rem" }}>
                      No reservations yet. Click <strong>Reserve Room</strong> above to get started.
                    </p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle" style={{ fontSize: "0.88rem" }}>
                        <thead>
                          <tr>
                            <th>Room</th>
                            <th>Type</th>
                            <th>Target Date</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reservations.map((r, index) => (
                            <tr key={index}>
                              <td className="fw-bold text-pcc-blue">Room {r.roomNumber}</td>
                              <td>{r.roomType}</td>
                              <td>{formatDate(r.reservationDateTime)}</td>
                              <td>
                                <span
                                  className={`badge ${
                                    r.status === "Confirmed" ? "bg-success text-white" :
                                    r.status === "Pending" ? "bg-warning text-dark" : "bg-secondary text-white"
                                  }`}
                                >
                                  {r.status}
                                </span>
                              </td>
                              <td>
                                {r.status === 'Pending' || r.status === 'Confirmed' ? (
                                  <button
                                    className="btn btn-xs btn-danger text-white"
                                    onClick={() => handleCancelReservation(r.reservationID)}
                                    style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                                  >
                                    Cancel
                                  </button>
                                ) : (
                                  <span className="text-muted small">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Bookings List */}
                <div className="key-tag">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="room-type">My Online Bookings History</div>
                    <button className="btn btn-primary btn-sm fw-bold" onClick={handleStartBookFlow}>
                      🔵 + Book Room
                    </button>
                  </div>
                  {bookings.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: "0.9rem" }}>No bookings yet.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle" style={{ fontSize: "0.88rem" }}>
                        <thead>
                          <tr>
                            <th>Booking ID</th>
                            <th>Room</th>
                            <th>Check-In</th>
                            <th>Check-Out</th>
                            <th>Status</th>
                            <th>Balance</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookings.map((b, index) => (
                            <tr key={index}>
                              <td className="fw-bold">#{b.bookingID}</td>
                              <td>Room {b.roomNumber} ({b.roomType})</td>
                              <td>{formatDate(b.checkInDateTime)}</td>
                              <td>{formatDate(b.checkOutDateTime)}</td>
                              <td>
                                <span
                                  className={`badge ${
                                    b.status === "Confirmed" ? "bg-success text-white" :
                                    b.status === "Checked In" ? "bg-primary text-white" :
                                    b.status === "Checked Out" ? "bg-secondary text-white" :
                                    b.status === "Pending" ? "bg-warning text-dark" : "bg-danger text-white"
                                  }`}
                                >
                                  {b.status}
                                </span>
                              </td>
                              <td className="fw-bold text-dark">
                                ₱{parseFloat(b.remainingBalance || 0).toFixed(2)}
                              </td>
                              <td>
                                {b.status === 'Pending' || b.status === 'Confirmed' ? (
                                  <button
                                    className="btn btn-xs btn-danger text-white"
                                    onClick={() => handleCancelBooking(b.bookingID)}
                                    style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                                  >
                                    Cancel
                                  </button>
                                ) : (
                                  <span className="text-muted small">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Active Stay Statement of Account */}
                {activeBill && (
                  <div className="key-tag mt-4">
                    <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                      <div className="room-type">Active Stay Statement of Account</div>
                      <span className="badge text-bg-primary px-3 py-2">
                        Room {activeBill.booking.roomNumber} ({activeBill.booking.roomType})
                      </span>
                    </div>
                    
                    <div className="mb-4">
                      <div className="fw-bold text-dark mb-2" style={{ fontSize: '0.95rem' }}>Room Rent Charges</div>
                      <table className="table table-sm align-middle mb-3" style={{ fontSize: "0.85rem" }}>
                        <thead>
                          <tr className="table-light">
                            <th>Description</th>
                            <th>Rate</th>
                            <th>Nights</th>
                            <th className="text-end">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>{activeBill.booking.roomType} (Room {activeBill.booking.roomNumber})</td>
                            <td>₱{parseFloat(activeBill.booking.rate).toFixed(2)}</td>
                            <td>{activeBill.booking.nights}</td>
                            <td className="text-end fw-bold text-dark">₱{parseFloat(activeBill.summary.originalRoomCharge || activeBill.booking.originalRoomCharge || activeBill.booking.roomCharge).toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="p-3 bg-light rounded" style={{ fontSize: '0.9rem' }}>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Total Charges:</span>
                        <span className="fw-semibold text-dark">₱{parseFloat(activeBill.summary.total).toFixed(2)}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1 text-success">
                        <span>Total Amount Paid:</span>
                        <span>₱{parseFloat(activeBill.summary.paid).toFixed(2)}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center pt-2 mt-2 border-top border-secondary-subtle">
                        <span className="fw-bold text-danger">Outstanding Balance:</span>
                        <span className="fw-bold text-danger" style={{ fontSize: '1.15rem' }}>
                          ₱{parseFloat(activeBill.summary.balance).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL WORKFLOW: RESERVATION FORM */}
      {activeModal === 'reserve_form' && selectedRoom && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ backgroundColor: '#198754' }}>
                <h5 className="modal-title fw-bold">🟢 Reservation Request Form</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal('none')}></button>
              </div>
              <form onSubmit={handleCreateReservation}>
                <div className="modal-body">
                  <div className="p-3 bg-light rounded border mb-3">
                    <h6 className="fw-bold text-success mb-1">Room {selectedRoom.roomNumber} ({selectedRoom.roomType})</h6>
                    <div className="small text-muted">Floor: {selectedRoom.floorName} • Rate: ₱{parseFloat(selectedRoom.rate).toFixed(2)}/night</div>
                    <div className="small text-muted">Max Capacity: Up to {selectedRoom.occupancyLimit} Pax</div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-semibold small">Check-In Date *</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={checkInDate}
                        onChange={(e) => setCheckInDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold small">Check-Out Date *</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={checkOutDate}
                        onChange={(e) => setCheckOutDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Number of Guests *</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      min="1"
                      max={selectedRoom.occupancyLimit}
                      value={numGuests}
                      onChange={(e) => setNumGuests(parseInt(e.target.value) || 1)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Special Requests (Optional)</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows="2"
                      placeholder="e.g. Extra pillows, early arrival note, etc."
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-danger text-white" onClick={() => setActiveModal('none')}>Cancel</button>
                  <button type="submit" className="btn btn-success text-white fw-bold" disabled={processing}>
                    {processing ? 'Submitting...' : 'Submit Reservation Request 🟢'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WORKFLOW: RESERVATION SUMMARY MODAL */}
      {activeModal === 'reservation_summary' && reservationSummaryData && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 text-center p-3">
              <div className="modal-body py-3">
                <div className="text-success display-4 mb-2">🟢</div>
                <h4 className="fw-bold text-dark">Reservation Request Sent!</h4>
                <p className="text-muted small mb-3">Your reservation request has been received by Front Desk and is pending confirmation.</p>

                <div className="p-3 bg-light rounded text-start border mb-3" style={{ fontSize: '0.85rem' }}>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Reservation Reference:</span>
                    <span className="fw-bold text-success">#RES-{reservationSummaryData.reservationID}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Reserved Room:</span>
                    <span className="fw-bold text-dark">Room {reservationSummaryData.roomNumber} ({reservationSummaryData.roomType})</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Check-In Date:</span>
                    <span className="fw-semibold">{reservationSummaryData.checkInDate}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Check-Out Date:</span>
                    <span className="fw-semibold">{reservationSummaryData.checkOutDate}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Guests Count:</span>
                    <span className="fw-semibold">{reservationSummaryData.numGuests} Pax</span>
                  </div>
                  <div className="d-flex justify-content-between pt-2 border-top">
                    <span className="text-muted">Status:</span>
                    <span className="badge bg-warning text-dark">Pending Front Desk Review</span>
                  </div>
                </div>

                <button className="btn btn-pcc-primary text-white fw-bold w-100 py-2" onClick={() => { setActiveModal('none'); setViewMode('dashboard'); }}>
                  Done & Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WORKFLOW: BOOK ROOM STEP 1 (DETAILS & GUESTS) */}
      {activeModal === 'book_form' && selectedRoom && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ backgroundColor: '#0d6efd' }}>
                <h5 className="modal-title fw-bold">🔵 Online Booking Summary & Guest Details</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal('none')}></button>
              </div>
              <form onSubmit={handleProceedToPayment}>
                <div className="modal-body">
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <div className="p-3 bg-light rounded border h-100">
                        <h6 className="fw-bold text-primary mb-2">Room {selectedRoom.roomNumber} - {selectedRoom.roomType}</h6>
                        <div className="small text-muted mb-1">Floor: <strong>{selectedRoom.floorName}</strong></div>
                        <div className="small text-muted mb-1">Occupancy Limit: <strong>Up to {selectedRoom.occupancyLimit} Pax</strong></div>
                        <div className="small text-muted">Standard Rate: <strong>₱{parseFloat(selectedRoom.rate).toFixed(2)} / night</strong></div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="p-3 bg-light rounded border h-100">
                        <h6 className="fw-bold text-dark mb-2">Stay Schedule</h6>
                        <div className="mb-2">
                          <label className="form-label mb-0 small text-muted">Check-In Date *</label>
                          <input type="date" className="form-control form-control-sm" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} required />
                        </div>
                        <div className="mb-2">
                          <label className="form-label mb-0 small text-muted">Check-Out Date *</label>
                          <input type="date" className="form-control form-control-sm" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} required />
                        </div>
                        <div className="fw-bold text-primary small">Duration: {nightsCount} Night(s)</div>
                      </div>
                    </div>
                  </div>

                  {/* Registered Room Guests */}
                  <div className="p-3 bg-white border rounded mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="fw-bold text-dark mb-0">Registered Room Guests ({registeredGuests.length} Pax)</h6>
                      {registeredGuests.length < selectedRoom.occupancyLimit && (
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-primary"
                          onClick={() => setRegisteredGuests(prev => [...prev, { fullName: '', age: 25, discountID: '', discountIdNumber: '' }])}
                        >
                          + Add Guest
                        </button>
                      )}
                    </div>

                    {registeredGuests.map((g, idx) => (
                      <div key={idx} className="row g-2 align-items-center mb-2 p-2 border rounded bg-light">
                        <div className="col-md-4">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Full Name *"
                            value={g.fullName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRegisteredGuests(prev => prev.map((item, i) => i === idx ? { ...item, fullName: val } : item));
                            }}
                            required
                          />
                        </div>
                        <div className="col-md-2">
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            placeholder="Age"
                            value={g.age}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRegisteredGuests(prev => prev.map((item, i) => i === idx ? { ...item, age: val } : item));
                            }}
                          />
                        </div>
                        <div className="col-md-3">
                          <select
                            className="form-select form-select-sm"
                            value={g.discountID}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRegisteredGuests(prev => prev.map((item, i) => i === idx ? { ...item, discountID: val } : item));
                            }}
                          >
                            <option value="">No Discount</option>
                            {discounts.map(d => (
                              <option key={d.discountID} value={String(d.discountID)}>{d.name} ({d.percentage}%)</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-3 d-flex gap-1">
                          {g.discountID && (
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="ID Card No *"
                              value={g.discountIdNumber}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRegisteredGuests(prev => prev.map((item, i) => i === idx ? { ...item, discountIdNumber: val } : item));
                              }}
                              required
                            />
                          )}
                          {registeredGuests.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => setRegisteredGuests(prev => prev.filter((_, i) => i !== idx))}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary Breakdown */}
                  <div className="p-3 bg-light rounded border" style={{ fontSize: '0.88rem' }}>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Room Rent Subtotal ({nightsCount} nights):</span>
                      <span className="fw-semibold">₱{originalTotal.toFixed(2)}</span>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="d-flex justify-content-between mb-1 text-danger">
                        <span>Applied Discount Apportionment:</span>
                        <span className="fw-semibold">-₱{totalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="d-flex justify-content-between pt-2 border-top fw-bold text-primary" style={{ fontSize: '1.05rem' }}>
                      <span>Net Booking Amount Due:</span>
                      <span>₱{netTotalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-danger text-white" onClick={() => setActiveModal('none')}>Cancel</button>
                  <button type="submit" className="btn btn-primary text-white fw-bold">
                    Proceed to GCash Payment 💳
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WORKFLOW: STEP 2 (GCASH PAYMENT SELECTOR) */}
      {activeModal === 'payment' && selectedRoom && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ backgroundColor: '#0d6efd' }}>
                <h5 className="modal-title fw-bold">GCash Online Payment Options</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal('none')}></button>
              </div>
              <form onSubmit={handleConfirmGCashBookingPayment}>
                <div className="modal-body">
                  <div className="alert alert-info py-2 small mb-3">
                    ℹ Online payments are processed exclusively via <strong>GCash</strong>. Select your preferred downpayment percentage below.
                  </div>

                  {/* Payment Downpayment Selector */}
                  <div className="mb-3">
                    <label className="form-label fw-bold">Select Down Payment Percentage *</label>
                    <div className="btn-group w-100" role="group">
                      <input type="radio" className="btn-check" name="payPct" id="pct25" value="25" checked={paymentOption === '25'} onChange={(e) => setPaymentOption(e.target.value)} />
                      <label className="btn btn-outline-primary fw-bold" htmlFor="pct25">25% Down Payment</label>

                      <input type="radio" className="btn-check" name="payPct" id="pct50" value="50" checked={paymentOption === '50'} onChange={(e) => setPaymentOption(e.target.value)} />
                      <label className="btn btn-outline-primary fw-bold" htmlFor="pct50">50% Down Payment</label>

                      <input type="radio" className="btn-check" name="payPct" id="pct100" value="100" checked={paymentOption === '100'} onChange={(e) => setPaymentOption(e.target.value)} />
                      <label className="btn btn-outline-primary fw-bold" htmlFor="pct100">Full (100%) Payment</label>
                    </div>
                  </div>

                  {/* Real-time Math Calculation Breakdown */}
                  <div className="p-3 bg-light rounded border mb-3" style={{ fontSize: '0.88rem' }}>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Total Net Booking Amount:</span>
                      <span className="fw-semibold text-dark">₱{netTotalAmount.toFixed(2)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Selected Percentage:</span>
                      <span className="fw-semibold text-primary">{paymentPctNumber}%</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1 text-success fw-bold" style={{ fontSize: '1rem' }}>
                      <span>Amount to Pay Now via GCash:</span>
                      <span>₱{amountToPayNow.toFixed(2)}</span>
                    </div>
                    <div className="d-flex justify-content-between pt-2 border-top text-danger small">
                      <span>Remaining Balance at Check-in:</span>
                      <span className="fw-bold">₱{remainingBalanceAfterPay.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* GCash Merchant QR & Ref Input */}
                  <div className="p-3 border rounded bg-white text-center mb-3">
                    <div className="fw-bold text-primary mb-1">PCC Home Suite Home GCash Merchant</div>
                    <div className="small text-muted mb-2">Account No: <strong>0917-123-4567</strong></div>
                    <div className="mb-2">
                      <label className="form-label fw-semibold small">GCash Reference Number *</label>
                      <input
                        type="text"
                        className="form-control text-center fw-bold"
                        placeholder="e.g. 100293847561"
                        value={gcashRef}
                        onChange={(e) => setGcashRef(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-danger text-white" onClick={() => setActiveModal('book_form')}>Back</button>
                  <button type="submit" className="btn btn-success text-white fw-bold" disabled={processing || !gcashRef.trim()}>
                    {processing ? 'Processing Payment...' : `Submit GCash Payment (₱${amountToPayNow.toFixed(2)}) 🚀`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WORKFLOW: RECEIPT WINDOW */}
      {activeModal === 'receipt' && receiptData && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 text-center p-3">
              <div className="modal-body py-4">
                <div className="text-success display-4 mb-2">✅</div>
                <h4 className="fw-bold text-dark">Booking & Payment Confirmed!</h4>
                <p className="text-muted small mb-4">Your GCash payment has been verified and your booking is confirmed.</p>

                <div className="p-3 bg-light rounded text-start border mb-4" style={{ fontSize: '0.85rem' }}>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Receipt Number:</span>
                    <span className="fw-bold text-dark">#REC-{receiptData.paymentID}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Booking Reference:</span>
                    <span className="fw-bold text-pcc-blue">#{receiptData.bookingID}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">GCash Reference No:</span>
                    <span className="fw-bold text-dark">{receiptData.referenceNumber}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1 text-success fw-bold">
                    <span>Amount Paid ({receiptData.paymentPercentage}):</span>
                    <span>₱{receiptData.amountPaid.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between pt-2 border-top text-danger">
                    <span>Remaining Balance:</span>
                    <span className="fw-bold">₱{receiptData.remainingBalance.toFixed(2)}</span>
                  </div>
                </div>

                <div className="d-flex gap-2 justify-content-center">
                  <button className="btn btn-outline-primary fw-bold" onClick={handlePrintReceipt}>
                    🖨️ Print / Download Receipt
                  </button>
                  <button className="btn btn-pcc-primary text-white fw-bold" onClick={() => { setActiveModal('none'); setViewMode('dashboard'); }}>
                    Done & View Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHAT BUBBLE COMPONENT */}
      <GuestChatBubble />
    </>
  );
}
