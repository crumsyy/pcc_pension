'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GuestChatBubble from '../../components/GuestChatBubble';
import ModalDialog from '../../components/ModalDialog';
import GuestBottomNav from './GuestBottomNav';
import GuestSidebarNav from './GuestSidebarNav';

export default function GuestDashboardClient({ initialGuest, initialReservations, initialBookings, initialActiveBill, initialAllRooms }) {
  const [guest, setGuest] = useState(initialGuest);
  const [reservations, setReservations] = useState(initialReservations || []);
  const [bookings, setBookings] = useState(initialBookings || []);
  const [activeBill, setActiveBill] = useState(initialActiveBill);
  const [allRooms, setAllRooms] = useState(initialAllRooms || []);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [discounts, setDiscounts] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Responsive Breakpoint State (1024px)
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(media.matches);

    const listener = (e) => setIsDesktop(e.matches);
    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      media.addListener(listener);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, []);

  // Active Navigation Tab: 'home' | 'rooms' | 'chat' | 'notifications' | 'account'
  const [activeTab, setActiveTab] = useState('home');

  // Workflow Mode: 'default' | 'select_room'
  const [viewMode, setViewMode] = useState('default');
  const [flowAction, setFlowAction] = useState('reserve'); // 'reserve' | 'book'

  // Modal Workflow States: 'none' | 'room_details' | 'reserve_form' | 'book_form' | 'payment' | 'receipt' | 'reservation_summary'
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
    { fullName: `${initialGuest.firstName || 'Guest'} ${initialGuest.lastName || ''}`.trim(), age: 30, discountID: '', discountIdNumber: '' }
  ]);
  const [reservationSummaryData, setReservationSummaryData] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Alert Dialog State
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
        if (data.allRooms) setAllRooms(data.allRooms);
        if (data.reservations) setReservations(data.reservations);
      }
    } catch (err) {
      console.error("Failed to load room data:", err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
        const unread = data.notifications.filter(n => !n.isRead).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      // silent
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
    fetchNotifications();
    fetchDiscounts();
  }, []);

  // 4-second background auto-polling for reservations, bookings, room availability, and notifications
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [resResp, bookResp, notifResp] = await Promise.all([
          fetch('/api/guest/reservations'),
          fetch('/api/guest/bookings'),
          fetch('/api/notifications')
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
        if (notifResp.ok) {
          const nData = await notifResp.json();
          if (nData.notifications) {
            setNotifications(nData.notifications);
            setUnreadCount(nData.notifications.filter(n => !n.isRead).length);
          }
        }
      } catch (err) {
        // silent polling
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

  // Triggers for Visual Room Selection
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

  const handleOpenRoomDetails = (rm) => {
    setSelectedRoom(rm);
    setActiveModal('room_details');
  };

  const handleConfirmLogout = () => {
    window.location.href = '/api/auth/logout';
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

  // Helper for Status Badge Styling (Exact 4-Color Legend)
  const getRoomStatusMeta = (status) => {
    if (status === 'Available') {
      return {
        badgeClass: 'bg-success text-white',
        label: '🟢 Available',
        bgColor: '#ffffff',
        borderLeft: '#198754',
        selectable: true
      };
    }
    if (status === 'Occupied') {
      return {
        badgeClass: 'bg-danger text-white',
        label: '🔴 Occupied',
        bgColor: '#fff5f5',
        borderLeft: '#dc3545',
        selectable: false
      };
    }
    if (status === 'Under Maintenance') {
      return {
        badgeClass: 'bg-warning text-dark',
        label: '🟠 Under Maintenance',
        bgColor: '#fffdf0',
        borderLeft: '#ffc107',
        selectable: false
      };
    }
    if (status === 'Reserved') {
      return {
        badgeClass: 'bg-secondary text-white',
        label: '⚪ Reserved',
        bgColor: '#f8fafc',
        borderLeft: '#6c757d',
        selectable: false
      };
    }
    return {
      badgeClass: 'bg-secondary text-white',
      label: `⚪ ${status}`,
      bgColor: '#f8fafc',
      borderLeft: '#6c757d',
      selectable: false
    };
  };

  // Group rooms by Floor safely
  const groundFloorRooms = allRooms.filter(r => String(r.floorID) === '1' || r.floorName?.toLowerCase().includes('ground') || String(r.roomNumber).startsWith('1'));
  const secondFloorRooms = allRooms.filter(r => String(r.floorID) === '2' || r.floorName?.toLowerCase().includes('second') || r.floorName?.toLowerCase().includes('upper') || String(r.roomNumber).startsWith('2'));
  const fallbackRooms = allRooms.filter(r => !groundFloorRooms.some(g => g.roomID === r.roomID) && !secondFloorRooms.some(s => s.roomID === r.roomID));

  const activeReservation = reservations.find(r => r.status === 'Pending' || r.status === 'Confirmed');
  const activeBookingStay = bookings.find(b => b.status === 'Pending' || b.status === 'Confirmed' || b.status === 'Checked In');

  return (
    <>
      {/* Custom Alert Modal Dialog */}
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

      {/* MODERN CENTERED LOGOUT CONFIRMATION DIALOG */}
      {showLogoutModal && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1080 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 text-center p-3" style={{ borderRadius: '16px' }}>
              <div className="modal-body py-4">
                <div className="rounded-circle bg-danger-subtle text-danger d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '64px', height: '64px', fontSize: '2rem' }}>
                  <i className="bi bi-power"></i>
                </div>
                <h4 className="fw-bold text-dark mb-2">Log Out Confirmation</h4>
                <p className="text-secondary small mb-4">Are you sure you want to log out of your guest account?</p>

                <div className="d-flex gap-2 justify-content-center">
                  <button className="btn btn-danger text-white px-4 py-2 fw-semibold" onClick={() => setShowLogoutModal(false)} style={{ borderRadius: '8px' }}>
                    Cancel
                  </button>
                  <button className="btn btn-danger text-white px-4 py-2 fw-bold" onClick={handleConfirmLogout} style={{ borderRadius: '8px' }}>
                    Logout <i className="bi bi-box-arrow-right ms-1"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESPONSIVE NAVIGATION: DESKTOP LEFT SIDEBAR vs MOBILE BOTTOM NAV */}
      {isDesktop ? (
        <GuestSidebarNav
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setViewMode('default');
          }}
          unreadNotificationsCount={unreadCount}
          guest={guest}
          onRequestLogout={() => setShowLogoutModal(true)}
        />
      ) : (
        /* TOP BRANDING BAR (Mobile/Tablet Only) */
        <nav className="navbar navbar-light bg-white border-bottom shadow-sm sticky-top px-3">
          <div className="container-fluid p-0 d-flex justify-content-between align-items-center">
            <Link href="/" className="navbar-brand d-flex align-items-center gap-2 m-0">
              <img src="/assets/images/logo.jpg" height="38" alt="PCC Logo" style={{ borderRadius: "6px" }} />
              <span className="fw-bold text-pcc-blue display-font d-none d-sm-inline" style={{ fontSize: '1.05rem' }}>PCC Home Suite</span>
            </Link>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-light text-pcc-blue border fw-bold px-2.5 py-1.5" style={{ fontSize: '0.8rem' }}>
                👤 {guest.firstName}
              </span>
              <button
                className="btn btn-logout-power"
                title="Log Out"
                onClick={() => setShowLogoutModal(true)}
              >
                <i className="bi bi-power fs-5"></i>
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* MAIN CONTAINER WRAPPER */}
      <div className={`container py-3 ${isDesktop ? 'guest-desktop-content' : 'guest-mobile-wrapper'}`}>
        {viewMode === 'select_room' ? (
          /* VISUAL ROOM LAYOUT SELECTION WORKSPACE */
          <div className="animate__animated animate__fadeIn">
            {/* BACK HEADER */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <button className="btn btn-sm btn-outline-secondary fw-semibold d-flex align-items-center gap-1" onClick={() => setViewMode('default')}>
                <i className="bi bi-arrow-left"></i> Back to Navigation
              </button>
              <span className="badge bg-pcc-blue text-white px-3 py-1.5 fw-bold" style={{ fontSize: '0.82rem' }}>
                {flowAction === 'reserve' ? '🟢 Reservation Mode' : '🔵 Booking Mode'}
              </span>
            </div>

            {/* EXACT 4-COLOR STATUS LEGEND BAR */}
            <div className="card shadow-sm border-0 p-3 mb-3 bg-white" style={{ borderRadius: '12px' }}>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <h5 className="fw-bold mb-1 text-dark">
                    {flowAction === 'reserve' ? '🟢 Select Room to Reserve' : '🔵 Select Room to Book'}
                  </h5>
                  <p className="text-muted mb-0 small">Click any Green (Available) room card to proceed with your stay request.</p>
                </div>

                {/* EXACT 4-COLOR LEGEND */}
                <div className="d-flex align-items-center gap-2 p-2 bg-light rounded border flex-wrap" style={{ fontSize: '0.78rem' }}>
                  <span className="fw-bold text-dark">Status Legend:</span>
                  <div className="d-flex align-items-center gap-1">
                    <span className="badge bg-success p-1"></span>
                    <span className="fw-bold text-success">🟢 Green (Available)</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <span className="badge bg-danger p-1"></span>
                    <span className="fw-semibold text-danger">🔴 Red (Occupied)</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <span className="badge bg-warning p-1"></span>
                    <span className="fw-semibold text-warning-emphasis">🟠 Orange (Maintenance)</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <span className="badge bg-secondary p-1"></span>
                    <span className="fw-semibold text-secondary">⚪ Gray (Reserved)</span>
                  </div>
                </div>
              </div>
            </div>

            {loadingRooms ? (
              /* SKELETON LOADER FOR ROOM CARDS */
              <div className="row g-3">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="col-12 col-md-6 col-lg-3">
                    <div className="card p-3 shadow-sm border-0" style={{ borderRadius: '12px' }}>
                      <div className="skeleton-box mb-2" style={{ height: '24px', width: '60%' }}></div>
                      <div className="skeleton-box mb-3" style={{ height: '16px', width: '40%' }}></div>
                      <div className="skeleton-box mb-2" style={{ height: '40px', width: '100%' }}></div>
                      <div className="skeleton-box" style={{ height: '32px', width: '100%' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : allRooms.length === 0 ? (
              /* FRIENDLY EMPTY STATE DESIGN */
              <div className="card shadow-sm border-0 p-5 text-center my-4 bg-white" style={{ borderRadius: '16px' }}>
                <div className="display-3 text-muted mb-3">🏨</div>
                <h5 className="fw-bold text-dark mb-1">No Rooms Available At The Moment</h5>
                <p className="text-muted small mb-3">Our rooms are currently being updated by Front Desk. Please check back shortly.</p>
                <button className="btn btn-outline-pcc-blue btn-sm m-auto" onClick={fetchRoomsAndStatus}>
                  🔄 Refresh Availability
                </button>
              </div>
            ) : (
              <>
                {/* GROUND FLOOR GRID */}
                <div className="mb-4">
                  <h6 className="fw-bold text-pcc-blue mb-2.5">Ground Floor Rooms</h6>
                  <div className="row g-3">
                    {groundFloorRooms.map((rm) => {
                      const meta = getRoomStatusMeta(rm.status);

                      return (
                        <div key={rm.roomID} className="col-12 col-md-6 col-lg-4 col-xl-3">
                          <div 
                            className={`card h-100 shadow-sm border-0 p-3 ${meta.selectable ? 'room-card-hover cursor-pointer' : 'opacity-75'}`}
                            onClick={() => handleSelectRoomCard(rm)}
                            style={{
                              borderRadius: '12px',
                              backgroundColor: meta.bgColor,
                              borderLeft: `5px solid ${meta.borderLeft} !important`,
                              cursor: meta.selectable ? 'pointer' : 'not-allowed'
                            }}
                          >
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div>
                                <h4 className="fw-bold mb-0 text-dark">Room {rm.roomNumber}</h4>
                                <div className="text-muted small fw-semibold">{rm.roomType}</div>
                              </div>
                              <span className={`badge ${meta.badgeClass} px-2 py-1`} style={{ fontSize: '0.75rem' }}>
                                {meta.label}
                              </span>
                            </div>

                            <div className="my-2 p-2 bg-light rounded" style={{ fontSize: '0.8rem' }}>
                              <div className="d-flex justify-content-between">
                                <span>Capacity:</span>
                                <strong className="text-dark">Up to {rm.occupancyLimit} Pax</strong>
                              </div>
                              <div className="d-flex justify-content-between">
                                <span>Rate:</span>
                                <strong className="text-pcc-blue">₱{parseFloat(rm.rate).toFixed(2)}/night</strong>
                              </div>
                            </div>

                            <div className="mt-auto pt-2 d-flex justify-content-between align-items-center">
                              <button
                                type="button"
                                className="btn btn-xs btn-outline-secondary py-1 px-2"
                                onClick={(e) => { e.stopPropagation(); handleOpenRoomDetails(rm); }}
                                style={{ fontSize: '0.75rem' }}
                              >
                                Details 👁️
                              </button>
                              {meta.selectable ? (
                                <button className={`btn btn-xs fw-bold px-3 ${flowAction === 'reserve' ? 'btn-success text-white' : 'btn-primary text-white'}`} style={{ borderRadius: '6px' }}>
                                  {flowAction === 'reserve' ? 'Reserve 🟢' : 'Book 🔵'}
                                </button>
                              ) : (
                                <span className="badge bg-secondary text-white">Disabled</span>
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
                  <h6 className="fw-bold text-pcc-blue mb-2.5">Second Floor Rooms</h6>
                  <div className="row g-3">
                    {secondFloorRooms.map((rm) => {
                      const meta = getRoomStatusMeta(rm.status);

                      return (
                        <div key={rm.roomID} className="col-12 col-md-6 col-lg-4 col-xl-3">
                          <div 
                            className={`card h-100 shadow-sm border-0 p-3 ${meta.selectable ? 'room-card-hover cursor-pointer' : 'opacity-75'}`}
                            onClick={() => handleSelectRoomCard(rm)}
                            style={{
                              borderRadius: '12px',
                              backgroundColor: meta.bgColor,
                              borderLeft: `5px solid ${meta.borderLeft} !important`,
                              cursor: meta.selectable ? 'pointer' : 'not-allowed'
                            }}
                          >
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div>
                                <h4 className="fw-bold mb-0 text-dark">Room {rm.roomNumber}</h4>
                                <div className="text-muted small fw-semibold">{rm.roomType}</div>
                              </div>
                              <span className={`badge ${meta.badgeClass} px-2 py-1`} style={{ fontSize: '0.75rem' }}>
                                {meta.label}
                              </span>
                            </div>

                            <div className="my-2 p-2 bg-light rounded" style={{ fontSize: '0.8rem' }}>
                              <div className="d-flex justify-content-between">
                                <span>Capacity:</span>
                                <strong className="text-dark">Up to {rm.occupancyLimit} Pax</strong>
                              </div>
                              <div className="d-flex justify-content-between">
                                <span>Rate:</span>
                                <strong className="text-pcc-blue">₱{parseFloat(rm.rate).toFixed(2)}/night</strong>
                              </div>
                            </div>

                            <div className="mt-auto pt-2 d-flex justify-content-between align-items-center">
                              <button
                                type="button"
                                className="btn btn-xs btn-outline-secondary py-1 px-2"
                                onClick={(e) => { e.stopPropagation(); handleOpenRoomDetails(rm); }}
                                style={{ fontSize: '0.75rem' }}
                              >
                                Details 👁️
                              </button>
                              {meta.selectable ? (
                                <button className={`btn btn-xs fw-bold px-3 ${flowAction === 'reserve' ? 'btn-success text-white' : 'btn-primary text-white'}`} style={{ borderRadius: '6px' }}>
                                  {flowAction === 'reserve' ? 'Reserve 🟢' : 'Book 🔵'}
                                </button>
                              ) : (
                                <span className="badge bg-secondary text-white">Disabled</span>
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
                    <h6 className="fw-bold text-pcc-blue mb-2.5">Additional Rooms</h6>
                    <div className="row g-3">
                      {fallbackRooms.map((rm) => {
                        const meta = getRoomStatusMeta(rm.status);

                        return (
                          <div key={rm.roomID} className="col-12 col-md-6 col-lg-4 col-xl-3">
                            <div 
                              className={`card h-100 shadow-sm border-0 p-3 ${meta.selectable ? 'room-card-hover cursor-pointer' : 'opacity-75'}`}
                              onClick={() => handleSelectRoomCard(rm)}
                              style={{
                                borderRadius: '12px',
                                backgroundColor: meta.bgColor,
                                borderLeft: `5px solid ${meta.borderLeft} !important`,
                                cursor: meta.selectable ? 'pointer' : 'not-allowed'
                              }}
                            >
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                  <h4 className="fw-bold mb-0 text-dark">Room {rm.roomNumber}</h4>
                                  <div className="text-muted small fw-semibold">{rm.roomType}</div>
                                </div>
                                <span className={`badge ${meta.badgeClass} px-2 py-1`} style={{ fontSize: '0.75rem' }}>
                                  {meta.label}
                                </span>
                              </div>

                              <div className="my-2 p-2 bg-light rounded" style={{ fontSize: '0.8rem' }}>
                                <div className="d-flex justify-content-between">
                                  <span>Capacity:</span>
                                  <strong className="text-dark">Up to {rm.occupancyLimit} Pax</strong>
                                </div>
                                <div className="d-flex justify-content-between">
                                  <span>Rate:</span>
                                  <strong className="text-pcc-blue">₱{parseFloat(rm.rate).toFixed(2)}/night</strong>
                                </div>
                              </div>

                              <div className="mt-auto pt-2 d-flex justify-content-between align-items-center">
                                <button
                                  type="button"
                                  className="btn btn-xs btn-outline-secondary py-1 px-2"
                                  onClick={(e) => { e.stopPropagation(); handleOpenRoomDetails(rm); }}
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  Details 👁️
                                </button>
                                {meta.selectable ? (
                                  <button className={`btn btn-xs fw-bold px-3 ${flowAction === 'reserve' ? 'btn-success text-white' : 'btn-primary text-white'}`} style={{ borderRadius: '6px' }}>
                                    {flowAction === 'reserve' ? 'Reserve 🟢' : 'Book 🔵'}
                                  </button>
                                ) : (
                                  <span className="badge bg-secondary text-white">Disabled</span>
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
          /* FIVE TAB WORKSPACE */
          <>
            {/* TAB 1: HOME TAB */}
            {activeTab === 'home' && (
              <div className="animate__animated animate__fadeIn">
                {/* HERO WELCOME CARD */}
                <div className="guest-hero-card p-4 mb-4 shadow-sm">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <span className="badge bg-white text-pcc-blue fw-bold mb-2">Hotel Guest Portal</span>
                      <h3 className="fw-bold mb-1">Welcome, {guest.firstName}!</h3>
                      <p className="mb-0 text-white-50 small">Experience comfort and convenience at PCC Home Suite Home.</p>
                    </div>
                  </div>
                </div>

                {/* ACTIVE STAY / STATUS CARDS */}
                {activeReservation && (
                  <div className="card shadow-sm border-0 border-start border-4 border-success p-3 mb-4 bg-white" style={{ borderRadius: '12px' }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <span className="badge bg-success text-white mb-1">🟢 Active Reservation Request</span>
                        <h6 className="fw-bold mb-0 text-dark">Room {activeReservation.roomNumber} ({activeReservation.roomType})</h6>
                        <div className="small text-muted">Check-in: {formatDate(activeReservation.reservationDateTime)}</div>
                      </div>
                      <button className="btn btn-xs btn-outline-danger" onClick={() => handleCancelReservation(activeReservation.reservationID)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {activeBookingStay && (
                  <div className="card shadow-sm border-0 border-start border-4 border-primary p-3 mb-4 bg-white" style={{ borderRadius: '12px' }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <span className="badge bg-primary text-white mb-1">🔵 Active Stay Booking (#{activeBookingStay.bookingID})</span>
                        <h6 className="fw-bold mb-0 text-dark">Room {activeBookingStay.roomNumber} ({activeBookingStay.roomType})</h6>
                        <div className="small text-muted">Status: <strong>{activeBookingStay.status}</strong></div>
                      </div>
                      <button className="btn btn-xs btn-outline-primary" onClick={() => setActiveTab('account')}>
                        View Bill
                      </button>
                    </div>
                  </div>
                )}

                {/* QUICK ACTION BUTTONS */}
                <h6 className="fw-bold text-dark mb-2.5">Quick Actions</h6>
                <div className="row g-2 mb-4">
                  <div className="col-6 col-lg-3">
                    <button
                      className="btn btn-success text-white w-100 touch-action-btn shadow-sm"
                      onClick={handleStartReserveFlow}
                      style={{ backgroundColor: '#198754', borderColor: '#198754' }}
                    >
                      <i className="bi bi-calendar-plus me-1.5"></i> Reserve Room
                    </button>
                  </div>
                  <div className="col-6 col-lg-3">
                    <button
                      className="btn btn-primary text-white w-100 touch-action-btn shadow-sm"
                      onClick={handleStartBookFlow}
                      style={{ backgroundColor: '#0d6efd', borderColor: '#0d6efd' }}
                    >
                      <i className="bi bi-credit-card me-1.5"></i> Book Room
                    </button>
                  </div>
                  <div className="col-6 col-lg-3">
                    <button
                      className="btn btn-outline-dark w-100 touch-action-btn"
                      onClick={() => setActiveTab('account')}
                    >
                      <i className="bi bi-journal-text me-1.5"></i> My Bookings
                    </button>
                  </div>
                  <div className="col-6 col-lg-3">
                    <button
                      className="btn btn-outline-pcc-blue w-100 touch-action-btn"
                      onClick={() => setActiveTab('notifications')}
                    >
                      <i className="bi bi-bell me-1.5"></i> Alerts ({unreadCount})
                    </button>
                  </div>
                </div>

                {/* ACTIVE PROMOTIONS & RECOMMENDED ROOMS */}
                <h6 className="fw-bold text-dark mb-2.5">Featured Rooms & Offers</h6>
                <div className="row g-3 mb-4">
                  {allRooms.slice(0, 4).map((rm) => (
                    <div key={rm.roomID} className="col-12 col-md-6 col-lg-3">
                      <div className="card shadow-sm border-0 h-100 room-card-hover overflow-hidden" style={{ borderRadius: '12px' }}>
                        <div style={{ height: '140px', background: '#e2e8f0' }} className="d-flex align-items-center justify-content-center text-muted fw-bold">
                          🏨 Room {rm.roomNumber} ({rm.roomType})
                        </div>
                        <div className="card-body p-3">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <div>
                              <h6 className="fw-bold mb-0 text-dark">Room {rm.roomNumber}</h6>
                              <span className="small text-muted">{rm.floorName}</span>
                            </div>
                            <span className="fw-bold text-pcc-blue" style={{ fontSize: '1rem' }}>₱{parseFloat(rm.rate).toFixed(2)}/night</span>
                          </div>
                          <p className="small text-muted mb-3">Aircon, Hot Shower, Free Wi-Fi, and 24/7 Front Desk Service.</p>
                          <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-outline-secondary w-50" onClick={() => handleOpenRoomDetails(rm)}>Details</button>
                            <button className="btn btn-sm btn-primary text-white w-50" onClick={handleStartBookFlow}>Book Now</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: ROOMS TAB */}
            {activeTab === 'rooms' && (
              <div className="animate__animated animate__fadeIn">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h4 className="fw-bold text-dark mb-0">Rooms Catalog</h4>
                    <span className="text-muted small">Explore our comfortable rooms and suites.</span>
                  </div>
                  <button className="btn btn-sm btn-primary text-white fw-bold" onClick={handleStartBookFlow}>
                    + Book Stay
                  </button>
                </div>

                <div className="row g-3">
                  {allRooms.map((rm) => {
                    const isAvailable = rm.status === 'Available';
                    return (
                      <div key={rm.roomID} className="col-12 col-md-6 col-lg-4">
                        <div className="card shadow-sm border-0 h-100 room-card-hover overflow-hidden" style={{ borderRadius: '12px' }}>
                          <div style={{ height: '150px', background: '#cbd5e1' }} className="d-flex align-items-center justify-content-center text-secondary fw-bold">
                            🛌 Room {rm.roomNumber} Image Placeholder
                          </div>
                          <div className="card-body p-3 d-flex flex-column">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div>
                                <h5 className="fw-bold mb-0 text-dark">Room {rm.roomNumber}</h5>
                                <div className="text-muted small">{rm.roomType} • {rm.floorName}</div>
                              </div>
                              <span className={`badge ${isAvailable ? 'bg-success' : 'bg-secondary'}`}>
                                {isAvailable ? 'Available' : rm.status}
                              </span>
                            </div>

                            <div className="my-2 p-2 bg-light rounded small">
                              <div className="d-flex justify-content-between">
                                <span>Max Occupancy:</span>
                                <strong className="text-dark">Up to {rm.occupancyLimit} Pax</strong>
                              </div>
                              <div className="d-flex justify-content-between">
                                <span>Rate per Night:</span>
                                <strong className="text-pcc-blue">₱{parseFloat(rm.rate).toFixed(2)}</strong>
                              </div>
                            </div>

                            <div className="mt-auto pt-2 d-flex gap-2">
                              <button className="btn btn-sm btn-outline-secondary w-50" onClick={() => handleOpenRoomDetails(rm)}>
                                View Details 👁️
                              </button>
                              {isAvailable ? (
                                <button className="btn btn-sm btn-primary text-white w-50 fw-bold" onClick={handleStartBookFlow}>
                                  Book Now 🔵
                                </button>
                              ) : (
                                <button className="btn btn-sm btn-secondary text-white w-50" disabled>Unavailable</button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: CHAT TAB */}
            {activeTab === 'chat' && (
              <div className="animate__animated animate__fadeIn">
                <div className="card shadow-sm border-0 p-3 mb-3 bg-white" style={{ borderRadius: '12px' }}>
                  <h5 className="fw-bold mb-1 text-dark">💬 Inquiry & Live Chat Workspace</h5>
                  <p className="text-muted mb-0 small">Interact with our AI Chatbot or talk directly to our Front Desk Receptionist.</p>
                </div>

                <div className="card shadow-sm border-0 p-3" style={{ borderRadius: '12px', minHeight: '400px' }}>
                  <GuestChatBubble inlineView={true} />
                </div>
              </div>
            )}

            {/* TAB 4: NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
              <div className="animate__animated animate__fadeIn">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h4 className="fw-bold text-dark mb-0">Notifications</h4>
                    <span className="text-muted small">Stay updated on your reservations, bookings, and payments.</span>
                  </div>
                  {unreadCount > 0 && (
                    <span className="badge bg-danger rounded-pill px-3 py-1.5">{unreadCount} Unread</span>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="card shadow-sm border-0 p-4 text-center text-muted" style={{ borderRadius: '12px' }}>
                    <i className="bi bi-bell-slash display-4 mb-2"></i>
                    <p className="mb-0">No notifications yet. Alerts will appear here in real time.</p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {notifications.map((n) => (
                      <div
                        key={n.notificationID}
                        className={`card shadow-sm border-0 p-3 ${!n.isRead ? 'border-start border-4 border-pcc-blue bg-light' : 'bg-white'}`}
                        style={{ borderRadius: '12px' }}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <h6 className="fw-bold text-dark mb-0">{n.title}</h6>
                          <span className="text-muted" style={{ fontSize: '0.72rem' }}>{formatDate(n.createdAt)}</span>
                        </div>
                        <p className="text-secondary small mb-0">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: ACCOUNT TAB */}
            {activeTab === 'account' && (
              <div className="animate__animated animate__fadeIn">
                {/* PROFILE CARD */}
                <div className="card shadow-sm border-0 p-4 mb-4 bg-white" style={{ borderRadius: '16px' }}>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center gap-3">
                      <div className="rounded-circle bg-pcc-blue text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: '56px', height: '56px', fontSize: '1.5rem' }}>
                        {guest.firstName ? guest.firstName.charAt(0) : 'G'}
                      </div>
                      <div>
                        <h5 className="fw-bold mb-0 text-dark">{guest.firstName} {guest.lastName}</h5>
                        <span className="text-muted small">{guest.email}</span>
                      </div>
                    </div>
                    {/* RED POWER LOGOUT BUTTON */}
                    <button
                      className="btn btn-logout-power"
                      title="Log Out"
                      onClick={() => setShowLogoutModal(true)}
                    >
                      <i className="bi bi-power fs-5"></i>
                    </button>
                  </div>

                  <table className="table table-sm table-borderless mb-0" style={{ fontSize: '0.88rem' }}>
                    <tbody>
                      <tr>
                        <td className="text-muted">Contact:</td>
                        <td className="fw-semibold">{guest.contact}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Gender:</td>
                        <td>{guest.gender}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Address:</td>
                        <td>{guest.city}, {guest.province}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Member Since:</td>
                        <td>{formatDate(guest.createdAt)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* MY BOOKINGS HISTORY */}
                <div className="card shadow-sm border-0 p-3 mb-4 bg-white" style={{ borderRadius: '12px' }}>
                  <h6 className="fw-bold text-dark mb-3">My Bookings History</h6>
                  {bookings.length === 0 ? (
                    <p className="text-muted small mb-0">No booking records found.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr className="table-light">
                            <th>Booking ID</th>
                            <th>Room</th>
                            <th>Status</th>
                            <th>Balance</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookings.map((b) => (
                            <tr key={b.bookingID}>
                              <td className="fw-bold">#{b.bookingID}</td>
                              <td>Room {b.roomNumber}</td>
                              <td>
                                <span className={`badge ${b.status === 'Confirmed' ? 'bg-success' : 'bg-primary'}`}>{b.status}</span>
                              </td>
                              <td className="fw-bold">₱{parseFloat(b.remainingBalance || 0).toFixed(2)}</td>
                              <td>
                                {(b.status === 'Pending' || b.status === 'Confirmed') && (
                                  <button className="btn btn-xs btn-danger text-white py-0 px-2" onClick={() => handleCancelBooking(b.bookingID)}>
                                    Cancel
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ACCOUNT ACTION BUTTONS */}
                <div className="d-flex flex-column gap-2 mb-4">
                  <Link href="/guest/edit-profile" className="btn btn-outline-pcc-blue text-start p-3 fw-bold d-flex justify-content-between align-items-center" style={{ borderRadius: '10px' }}>
                    <span>⚙️ Edit Profile Settings</span>
                    <i className="bi bi-chevron-right"></i>
                  </Link>
                  <button onClick={() => setShowLogoutModal(true)} className="btn btn-danger text-white text-start p-3 fw-bold d-flex justify-content-between align-items-center" style={{ borderRadius: '10px' }}>
                    <span><i className="bi bi-power me-2"></i> Log Out</span>
                    <i className="bi bi-box-arrow-right"></i>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (Mobile/Tablet Only) */}
      {!isDesktop && (
        <GuestBottomNav
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setViewMode('default');
          }}
          unreadNotificationsCount={unreadCount}
        />
      )}

      {/* FLOATING AI CHATBOT BUTTON */}
      <GuestChatBubble
        hideFloating={activeTab === 'chat'}
        bottomOffset={isDesktop ? '24px' : '85px'}
      />

      {/* MODAL WORKFLOW: ROOM DETAILS MODAL */}
      {activeModal === 'room_details' && selectedRoom && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ backgroundColor: '#2155B5' }}>
                <h5 className="modal-title fw-bold">🏨 Room {selectedRoom.roomNumber} Details</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal('none')}></button>
              </div>
              <div className="modal-body">
                <div className="p-3 bg-light rounded text-center mb-3">
                  <h4 className="fw-bold text-pcc-blue mb-1">Room {selectedRoom.roomNumber} ({selectedRoom.roomType})</h4>
                  <div className="text-muted small">Floor: {selectedRoom.floorName}</div>
                </div>

                <div className="p-3 border rounded mb-3" style={{ fontSize: '0.88rem' }}>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Standard Rate:</span>
                    <strong className="text-pcc-blue">₱{parseFloat(selectedRoom.rate).toFixed(2)} / night</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Maximum Occupancy:</span>
                    <strong className="text-dark">Up to {selectedRoom.occupancyLimit} Pax</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Air Conditioning:</span>
                    <strong>{selectedRoom.isAircon ? 'Included' : 'Fan Only'}</strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Hot Shower:</span>
                    <strong>{selectedRoom.hasHotShower ? 'Available' : 'Standard'}</strong>
                  </div>
                </div>

                <h6 className="fw-bold text-dark mb-1">Included Amenities & Policies</h6>
                <ul className="small text-muted mb-0">
                  <li>Free High-Speed Wi-Fi connection</li>
                  <li>Clean towels and basic toiletries included</li>
                  <li>Check-in: 2:00 PM | Check-out: 12:00 PM</li>
                  <li>No smoking allowed inside rooms</li>
                </ul>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal('none')}>Close</button>
                {selectedRoom.status === 'Available' && (
                  <button type="button" className="btn btn-primary text-white fw-bold" onClick={() => { setActiveModal('none'); handleStartBookFlow(); }}>
                    Book Room Now 🔵
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-semibold small">Check-In Date *</label>
                      <input type="date" className="form-control form-control-sm" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} required />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold small">Check-Out Date *</label>
                      <input type="date" className="form-control form-control-sm" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} required />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Number of Guests *</label>
                    <input type="number" className="form-control form-control-sm" min="1" max={selectedRoom.occupancyLimit} value={numGuests} onChange={(e) => setNumGuests(parseInt(e.target.value) || 1)} required />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Special Requests (Optional)</label>
                    <textarea className="form-control form-control-sm" rows="2" placeholder="e.g. Extra pillows, early arrival note" value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)}></textarea>
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

      {/* MODAL WORKFLOW: RESERVATION SUMMARY */}
      {activeModal === 'reservation_summary' && reservationSummaryData && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 text-center p-3">
              <div className="modal-body py-3">
                <div className="text-success display-4 mb-2">🟢</div>
                <h4 className="fw-bold text-dark">Reservation Request Sent!</h4>
                <p className="text-muted small mb-3">Front Desk will review your reservation request shortly.</p>

                <div className="p-3 bg-light rounded text-start border mb-3" style={{ fontSize: '0.85rem' }}>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Reservation Ref:</span>
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
                </div>

                <button className="btn btn-pcc-primary text-white fw-bold w-100 py-2" onClick={() => { setActiveModal('none'); setViewMode('default'); }}>
                  Done & Back to Portal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WORKFLOW: BOOKING FORM & GUESTS */}
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

                  {/* Registered Guests */}
                  <div className="p-3 bg-white border rounded mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="fw-bold text-dark mb-0">Registered Room Guests ({registeredGuests.length} Pax)</h6>
                      {registeredGuests.length < selectedRoom.occupancyLimit && (
                        <button type="button" className="btn btn-xs btn-outline-primary" onClick={() => setRegisteredGuests(prev => [...prev, { fullName: '', age: 25, discountID: '', discountIdNumber: '' }])}>
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
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setRegisteredGuests(prev => prev.filter((_, i) => i !== idx))}>
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

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

      {/* MODAL WORKFLOW: GCASH PAYMENT */}
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
                    ℹ Online payments are processed exclusively via <strong>GCash</strong>. Select downpayment percentage below.
                  </div>

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
                  <button className="btn btn-pcc-primary text-white fw-bold" onClick={() => { setActiveModal('none'); setViewMode('default'); setActiveTab('home'); }}>
                    Done & View Portal
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
