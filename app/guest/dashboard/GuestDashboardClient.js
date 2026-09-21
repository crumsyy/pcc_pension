'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GuestChatBubble from '../../components/GuestChatBubble';
import ModalDialog from '../../components/ModalDialog';
import GuestBottomNav from './GuestBottomNav';
import GuestSidebarNav from './GuestSidebarNav';
import ThemeToggle from '../../components/ThemeToggle';
import DynamicQrPhCode from '../../components/DynamicQrPhCode';
import DatePicker from '../../components/DatePicker';
import ReservationCalendar from '../../components/ReservationCalendar';
import ReservationForm from '../../components/ReservationForm';
import GuestReservationForm from '../../components/GuestReservationForm';
import BookingForm from '../../components/BookingForm';
import GuestBookingForm from '../../components/GuestBookingForm';
import GuestOrdersContent from './GuestOrdersContent';
import ActiveStayPanel from './ActiveStayPanel';
import StatusBadge, { normalizeBookingStatus, normalizeReservationStatus } from '../../components/StatusBadge';
import './styles.css';
import HeaderProfile from '../../components/HeaderProfile';
import LoadingButton from '../../components/LoadingButton';
import { generateReceiptPNG } from '@/app/paymongo/test/page';
import { formatReservationID, formatBookingID, formatTransactionID, formatOrderID, formatRoomNumber } from '@/lib/formatters';

function getCourtesyHoldTimeInfo(expiryStr) {
  if (!expiryStr) return { expired: true, text: 'Expired', inGrace: false, hours: 0, mins: 0 };
  const expiryTime = new Date(expiryStr).getTime();
  const now = Date.now();
  const diffMs = expiryTime - now;

  if (diffMs > 0) {
    const totalMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const timeText = hours > 0 ? `${hours} hr${hours > 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}` : `${mins} min${mins !== 1 ? 's' : ''}`;
    return {
      expired: false,
      inGrace: false,
      hours,
      mins,
      text: timeText
    };
  }

  // Check 30-minute grace period
  const graceDiffMs = (expiryTime + 30 * 60 * 1000) - now;
  if (graceDiffMs > 0) {
    const graceMins = Math.ceil(graceDiffMs / 60000);
    return {
      expired: false,
      inGrace: true,
      graceMins,
      text: `${graceMins} minute${graceMins !== 1 ? 's' : ''} left in grace period`
    };
  }

  return { expired: true, inGrace: false, text: 'Expired' };
}
function parseRoomImages(imgVal) {
  if (!imgVal) return [];
  if (Array.isArray(imgVal)) return imgVal;
  if (typeof imgVal === 'string') {
    const trimmed = imgVal.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch (e) {}
    }
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function RoomImageCarousel({ images, fallbackImg, alt, height = '200px' }) {
  const [activeIdx, setActiveIdx] = useState(0);

  const list = images && images.length > 0 ? images.filter(Boolean) : (fallbackImg ? [fallbackImg] : []);

  useEffect(() => {
    if (!list || list.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % list.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [list]);

  if (list.length === 0) {
    return (
      <div className="image-fallback d-flex flex-column align-items-center justify-content-center bg-light text-muted border-bottom" style={{ height: height, width: '100%', fontSize: '0.82rem', fontWeight: 600 }}>
        <i className="bi bi-image fs-2 mb-1 opacity-50"></i>
        <span>Image Unavailable</span>
      </div>
    );
  }

  if (list.length === 1) {
    return (
      <div style={{ height: height, width: '100%', overflow: 'hidden', position: 'relative', backgroundColor: '#e2e8f0' }}>
        <img
          src={list[0]}
          alt={alt}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const fb = e.currentTarget.parentElement?.querySelector('.carousel-err-fb');
            if (fb) fb.style.display = 'flex';
          }}
        />
        <div className="carousel-err-fb d-flex flex-column align-items-center justify-content-center bg-light text-muted border-bottom" style={{ height: height, width: '100%', fontSize: '0.82rem', fontWeight: 600, display: 'none' }}>
          <i className="bi bi-image fs-2 mb-1 opacity-50"></i>
          <span>Image Unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className="position-relative overflow-hidden w-100" style={{ height: height }}>
      {list.map((img, idx) => (
        <img
          key={idx}
          src={img}
          alt={`${alt} slide ${idx + 1}`}
          className={`position-absolute top-0 start-0 w-100 h-100 ${idx === activeIdx ? 'opacity-100' : 'opacity-0'}`}
          style={{ objectFit: 'cover', transition: 'opacity 0.6s ease-in-out' }}
        />
      ))}
      <button
        type="button"
        className="btn btn-dark btn-xs position-absolute top-50 start-0 translate-middle-y ms-2 bg-dark bg-opacity-50 border-0 rounded-circle text-white p-1"
        style={{ width: '26px', height: '26px', zIndex: 5, fontSize: '0.8rem' }}
        onClick={(e) => { e.stopPropagation(); setActiveIdx(prev => (prev - 1 + list.length) % list.length); }}
      >
        ‹
      </button>
      <button
        type="button"
        className="btn btn-dark btn-xs position-absolute top-50 end-0 translate-middle-y me-2 bg-dark bg-opacity-50 border-0 rounded-circle text-white p-1"
        style={{ width: '26px', height: '26px', zIndex: 5, fontSize: '0.8rem' }}
        onClick={(e) => { e.stopPropagation(); setActiveIdx(prev => (prev + 1) % list.length); }}
      >
        ›
      </button>
      <div className="position-absolute bottom-0 start-50 translate-middle-x mb-2 d-flex gap-1" style={{ zIndex: 5 }}>
        {list.map((_, idx) => (
          <span
            key={idx}
            className={`rounded-circle ${idx === activeIdx ? 'bg-white' : 'bg-white bg-opacity-50'}`}
            style={{ width: '6px', height: '6px', cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); setActiveIdx(idx); }}
          ></span>
        ))}
      </div>
    </div>
  );
}

export default function GuestDashboardClient({ initialGuest, initialReservations, initialBookings, initialActiveBill, initialAllRooms, initialRoomSchedules }) {
  const [guest, setGuest] = useState(initialGuest);
  const [reservations, setReservations] = useState(initialReservations || []);
  const [bookings, setBookings] = useState(initialBookings || []);
  const [activeBill, setActiveBill] = useState(initialActiveBill);
  const [allRooms, setAllRooms] = useState(initialAllRooms || []);
  const [roomSchedules, setRoomSchedules] = useState(initialRoomSchedules || []);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [discounts, setDiscounts] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [resetBannerDismissed, setResetBannerDismissed] = useState(true);
  const [viewBillingBooking, setViewBillingBooking] = useState(null);

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem('pcc_guest_reset_banner_dismissed');
      setResetBannerDismissed(dismissed === '1');
    } catch (e) {
      setResetBannerDismissed(false);
    }
  }, []);

  // Responsive Breakpoint State (1024px)
  const [isDesktop, setIsDesktop] = useState(false);
  const [minReserveDateStr, setMinReserveDateStr] = useState('');
  const [maxReserveDateStr, setMaxReserveDateStr] = useState('');
  const [minBookDateStr, setMinBookDateStr] = useState('');

  useEffect(() => {
    const t = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
    setMinBookDateStr(todayStr);

    const minReserveD = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 2);
    setMinReserveDateStr(`${minReserveD.getFullYear()}-${pad(minReserveD.getMonth() + 1)}-${pad(minReserveD.getDate())}`);
    setMaxReserveDateStr('');
  }, []);

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

  // Active Navigation Tab: 'home' | 'rooms' | 'orders' | 'chat' | 'notifications' | 'account'
  const [activeTab, _setActiveTab] = useState('home');
  const activeTabRef = useRef('home');
  activeTabRef.current = activeTab;

  // Workflow Mode: 'default' | 'select_room'
  const [viewMode, _setViewMode] = useState('default');
  const viewModeRef = useRef('default');
  viewModeRef.current = viewMode;

  // Modal Workflow States: 'none' | 'room_details' | 'reserve_form' | 'book_form' | 'payment' | 'receipt' | 'reservation_summary'
  const [activeModal, _setActiveModal] = useState('none');
  const activeModalRef = useRef('none');
  activeModalRef.current = activeModal;
  const submittingBookingRef = useRef(false);

  const setActiveTab = (newTab, pushHistory = true) => {
    _setActiveTab(newTab);
    if (pushHistory && typeof window !== 'undefined' && ['home', 'rooms', 'orders', 'chat', 'notifications', 'account'].includes(newTab)) {
      const url = newTab === 'home' ? '/guest/dashboard' : `/guest/dashboard?tab=${newTab}`;
      try {
        window.history.pushState({ tab: newTab, viewMode: 'default', modal: 'none' }, '', url);
      } catch (e) {}
    }
  };

  const setViewMode = (newMode, pushHistory = true) => {
    _setViewMode(newMode);
    if (pushHistory && typeof window !== 'undefined' && newMode !== 'default') {
      try {
        window.history.pushState({ tab: activeTabRef.current, viewMode: newMode, modal: activeModalRef.current }, '', window.location.href);
      } catch (e) {}
    }
  };

  const setActiveModal = (newModal, pushHistory = true) => {
    _setActiveModal(newModal);
    if (pushHistory && typeof window !== 'undefined' && newModal !== 'none') {
      try {
        window.history.pushState({ tab: activeTabRef.current, viewMode: viewModeRef.current, modal: newModal }, '', window.location.href);
      } catch (e) {}
    }
  };

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      const validTabs = ['home', 'rooms', 'orders', 'chat', 'notifications', 'account'];
      const initialTab = (tabParam && validTabs.includes(tabParam)) ? tabParam : 'home';
      _setActiveTab(initialTab);
      if (typeof window !== 'undefined') {
        window.history.replaceState({ tab: initialTab, viewMode: 'default', modal: 'none' }, '', window.location.href);
      }
    } catch (e) {}

    const handlePopState = (event) => {
      // 1. If any modal was open, back closes the modal
      if (activeModalRef.current !== 'none') {
        _setActiveModal('none');
        return;
      }

      // 2. If selecting room workflow was active, back returns to default view
      if (viewModeRef.current !== 'default') {
        _setViewMode('default');
        return;
      }

      // 3. Tab navigation back
      const state = event.state;
      const validTabs = ['home', 'rooms', 'orders', 'chat', 'notifications', 'account'];
      if (state && state.tab && validTabs.includes(state.tab)) {
        _setActiveTab(state.tab);
      } else {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        if (tabParam && validTabs.includes(tabParam)) {
          _setActiveTab(tabParam);
        } else if (activeTabRef.current !== 'home') {
          _setActiveTab('home');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Room Search & Filtering States
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [selectedFloorFilter, setSelectedFloorFilter] = useState('All');
  const [selectedRoomTypeFilter, setSelectedRoomTypeFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  const [flowAction, setFlowAction] = useState('reserve'); // 'reserve' | 'book'
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Form States
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().substring(0, 10));
  const [checkOutDate, setCheckOutDate] = useState(new Date(Date.now() + 86400000).toISOString().substring(0, 10));
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [useCurrentTimeIn, setUseCurrentTimeIn] = useState(false);
  const [useCurrentTimeOut, setUseCurrentTimeOut] = useState(false);

  const handleCheckInDateChange = (val) => {
    if (convertingReservationID) return;
    setCheckInDate(val);
    if (val) {
      const inDate = new Date(val + 'T00:00:00');
      if (!isNaN(inDate.getTime())) {
        inDate.setDate(inDate.getDate() + 1);
        const pad = (n) => String(n).padStart(2, '0');
        const nextDayStr = `${inDate.getFullYear()}-${pad(inDate.getMonth() + 1)}-${pad(inDate.getDate())}`;
        setCheckOutDate(nextDayStr);
      }
    }
  };
  const [numGuests, setNumGuests] = useState(1);
  const [breakfastOption, setBreakfastOption] = useState('with'); // 'with' | 'without'
  const [specialRequests, setSpecialRequests] = useState('');

  const [paymentOption, setPaymentOption] = useState('50'); // '25' | '50' | '100'
  const [gcashRef, setGcashRef] = useState('');
  const [isGuestGcashSettled, setIsGuestGcashSettled] = useState(false);
  const [guestGcashInlineError, setGuestGcashInlineError] = useState('');
  const [registeredGuests, setRegisteredGuests] = useState([
    { fullName: `${initialGuest.firstName || 'Guest'} ${initialGuest.lastName || ''}`.trim(), age: 30, discountID: '', discountIdNumber: '' }
  ]);
  const [discountedGuests, setDiscountedGuests] = useState([]);
  const [convertingReservationID, setConvertingReservationID] = useState(null);
  const [reservationSummaryData, setReservationSummaryData] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [processing, setProcessing] = useState(false);

  // PayMongo Real-time Polling & QR States
  const [paymongoSourceID, setPaymongoSourceID] = useState(null);
  const [paymongoCheckoutUrl, setPaymongoCheckoutUrl] = useState(null);
  const [paymongoQrUrl, setPaymongoQrUrl] = useState(null);
  const [paymongoLoading, setPaymongoLoading] = useState(false);
  const [paymongoError, setPaymongoError] = useState('');
  const [paymongoStatus, setPaymongoStatus] = useState('idle'); // 'idle' | 'awaiting_payment' | 'paid' | 'failed'
  const pollingIntervalRef = useRef(null);

  // Courtesy Hold States
  const [isCourtesyHold, setIsCourtesyHold] = useState(false);
  const [holdDurationHours, setHoldDurationHours] = useState(48);
  const [countdownTick, setCountdownTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownTick(t => t + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Live Billing & Audit Trail State
  const [showBillModal, setShowBillModal] = useState(false);
  const [showAuditTrailModal, setShowAuditTrailModal] = useState(false);
  const [detailedBill, setDetailedBill] = useState(initialActiveBill);
  const [loadingBill, setLoadingBill] = useState(false);

  const fetchDetailedBill = async (bookingID) => {
    if (!bookingID) return;
    setLoadingBill(true);
    try {
      const res = await fetch(`/api/billing?bookingID=${bookingID}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setDetailedBill(data);
        setActiveBill(data);
      }
    } catch (e) {
      console.error("Failed to fetch detailed billing:", e);
    } finally {
      setLoadingBill(false);
    }
  };

  // Edit Profile Modal State
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingModalPic, setUploadingModalPic] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    contact: '',
    gender: 'Other',
    city: '',
    province: '',
    profilePicture: ''
  });

  const handleModalProfilePicUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showAlert('error', 'Error', 'Please select an image file smaller than 2MB.');
      return;
    }
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      showAlert('error', 'Error', 'Please upload a valid JPG, PNG, or WebP image.');
      return;
    }

    setUploadingModalPic(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'profile');
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload photo');
      setEditProfileForm(prev => ({ ...prev, profilePicture: data.url }));
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setUploadingModalPic(false);
    }
  };

  const handleModalRemoveProfilePic = () => {
    setEditProfileForm(prev => ({ ...prev, profilePicture: '' }));
  };

  const router = useRouter();

  // Real-time polling to keep room statuses, balances, and orders updated
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible' &&
        activeModal === 'none' &&
        !showBillModal &&
        !showAuditTrailModal &&
        !showEditProfileModal &&
        !paymongoLoading &&
        viewMode === 'default'
      ) {
        router.refresh();
      }
    }, 15000);

    return () => clearInterval(timer);
  }, [router, activeModal, showBillModal, showAuditTrailModal, showEditProfileModal, paymongoLoading, viewMode]);

  const handleSaveProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch('/api/guest/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProfileForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      setGuest(prev => ({
        ...prev,
        ...editProfileForm
      }));
      showAlert('success', 'Success', data.message || 'Profile updated successfully!');
      setShowEditProfileModal(false);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setSavingProfile(false);
    }
  };
  const [settleBooking, setSettleBooking] = useState(null);
  const [settleGcashRef, setSettleGcashRef] = useState('');
  const [settleProcessing, setSettleProcessing] = useState(false);

  // Handle redirect query params from PayMongo test simulation page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const payStatus = urlParams.get('paymentStatus');
    const returnedBookingID = urlParams.get('bookingID');

    if (payStatus === 'completed') {
      showAlert('success', 'Payment Completed', 'Your GCash payment simulation was authorized and settled successfully! You can view or download your official receipt.');
      fetchRoomsAndStatus();
      if (returnedBookingID) {
        fetchDetailedBill(returnedBookingID);
      }
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    } else if (payStatus === 'declined') {
      showAlert('error', 'Payment Declined', 'Payment Declined, Try Again');
      fetchRoomsAndStatus();
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, []);

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
        if (data.roomSchedules) setRoomSchedules(data.roomSchedules);
      }
    } catch (err) {
      console.error("Failed to load room data:", err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const getDisabledDatesForRoom = (roomId, excludeResId = convertingReservationID) => {
    if (!roomId || !roomSchedules || roomSchedules.length === 0) return [];
    const disabledSet = new Set();
    const pad = (n) => String(n).padStart(2, '0');
    
    roomSchedules.forEach(sched => {
      if (String(sched.roomID) !== String(roomId)) return;
      if (excludeResId && String(sched.reservationID) === String(excludeResId)) return;
      const inStr = (sched.checkInDateTime || '').substring(0, 10);
      const outStr = (sched.checkOutDateTime || '').substring(0, 10);
      if (!inStr) return;
      
      let cur = new Date(inStr + 'T00:00:00');
      const end = outStr ? new Date(outStr + 'T00:00:00') : new Date(inStr + 'T00:00:00');
      
      // Free the checkout date (cur < end) so incoming guests can check in at 2:00 PM after checkout
      if (cur.getTime() === end.getTime()) {
        const dStr = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
        disabledSet.add(dStr);
      } else {
        while (cur < end) {
          const dStr = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
          disabledSet.add(dStr);
          cur.setDate(cur.getDate() + 1);
        }
      }
    });
    
    return Array.from(disabledSet);
  };

  const checkScheduleConflict = (roomId, inDate, outDate, excludeResId = convertingReservationID) => {
    if (!roomId || !inDate || !roomSchedules || roomSchedules.length === 0) return false;
    const reqIn = new Date(`${inDate}T14:00:00`);
    const reqOut = outDate ? new Date(`${outDate}T12:00:00`) : new Date(new Date(`${inDate}T14:00:00`).getTime() + 24 * 3600 * 1000);
    if (isNaN(reqIn.getTime()) || isNaN(reqOut.getTime())) return false;
    
    return roomSchedules.some(sched => {
      if (String(sched.roomID) !== String(roomId)) return false;
      if (excludeResId && String(sched.reservationID) === String(excludeResId)) return false;
      const sIn = new Date((sched.checkInDateTime || '').replace(' ', 'T'));
      const sOut = new Date((sched.checkOutDateTime || '').replace(' ', 'T'));
      if (isNaN(sIn.getTime()) || isNaN(sOut.getTime())) return false;
      return sIn < reqOut && sOut > reqIn;
    });
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

  const handleMarkAllNotificationsRead = async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
      setUnreadCount(0);
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
    } catch (err) {
      console.error("Failed to mark notifications read:", err);
    }
  };

  const handleMarkSingleNotificationRead = async (id) => {
    try {
      setNotifications(prev => prev.map(n => n.notificationID === id ? { ...n, isRead: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", notificationID: id }),
      });
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const handleNotificationClick = (n) => {
    if (!n.isRead) {
      handleMarkSingleNotificationRead(n.notificationID);
    }

    const title = (n.title || '').toLowerCase();
    const msg = (n.message || '').toLowerCase();

    // Helper to pulse highlight on target element
    const highlightElement = (el) => {
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('notification-highlight-pulse');
      setTimeout(() => {
        el.classList.remove('notification-highlight-pulse');
      }, 3000);
    };

    // Extract potential ID e.g. "Booking #12", "Reservation #5", "Order #3"
    const resIdMatch = msg.match(/reservation\s*#?(\d+)/i) || title.match(/reservation\s*#?(\d+)/i);

    // 1. Reservation / Courtesy Hold -> direct to active reservation or reservation history
    if (title.includes('reservation') || title.includes('hold') || msg.includes('reservation') || msg.includes('hold')) {
      const targetResID = resIdMatch ? parseInt(resIdMatch[1], 10) : (activeReservation?.reservationID || null);

      if (activeReservation) {
        setActiveTab('home');
        setTimeout(() => {
          const el = document.getElementById('active-reservation-card');
          if (el) {
            highlightElement(el);
          } else {
            setActiveTab('account');
            setTimeout(() => {
              const histEl = (targetResID ? document.getElementById(`reservation-item-${targetResID}`) : null) || document.getElementById('reservations-history-section');
              highlightElement(histEl);
            }, 180);
          }
        }, 120);
      } else {
        setActiveTab('account');
        setTimeout(() => {
          const histEl = (targetResID ? document.getElementById(`reservation-item-${targetResID}`) : null) || document.getElementById('reservations-history-section');
          highlightElement(histEl);
        }, 150);
      }
      return;
    }

    // 2. Booking / Stay / Check-In / Check-Out -> direct to active booking or booking history
    if (title.includes('booking') || title.includes('check-in') || title.includes('check-out') || title.includes('checkout') || msg.includes('booking') || msg.includes('check-in') || msg.includes('check-out')) {
      if (activeBookingStay) {
        setActiveTab('home');
        setTimeout(() => {
          const el = document.getElementById('active-booking-card');
          highlightElement(el);
        }, 120);
      } else {
        setActiveTab('account');
        setTimeout(() => {
          const el = document.getElementById('bookings-history-section');
          highlightElement(el);
        }, 150);
      }
      return;
    }

    // 3. Room Service Orders -> direct to orders
    if (title.includes('order') || title.includes('room service') || msg.includes('order')) {
      setActiveTab('orders');
      return;
    }

    // 4. Payment / Billing / GCash / Balance -> direct to billing breakdown or account
    if (title.includes('payment') || title.includes('billing') || title.includes('gcash') || title.includes('soa') || msg.includes('payment') || msg.includes('balance')) {
      if (activeBookingStay) {
        setActiveTab('home');
        setTimeout(() => {
          const el = document.getElementById('stay-billing-breakdown');
          highlightElement(el);
        }, 120);
      } else {
        setActiveTab('account');
      }
      return;
    }

    // 5. Inquiries / Chat / Front Desk Messages
    if (title.includes('message') || title.includes('inquiry') || title.includes('front desk') || title.includes('chat') || msg.includes('message')) {
      setActiveTab('chat');
      return;
    }

    // Fallback: Home tab
    setActiveTab('home');
  };

  const getNotificationIcon = (title = '') => {
    const t = title.toLowerCase();
    if (t.includes('payment') || t.includes('billing') || t.includes('balance')) return 'bi-credit-card-fill text-success';
    if (t.includes('booking') || t.includes('reservation') || t.includes('check-in')) return 'bi-calendar-check-fill text-primary';
    if (t.includes('alert') || t.includes('stock') || t.includes('warning')) return 'bi-exclamation-triangle-fill text-warning';
    return 'bi-bell-fill text-info';
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
        const [resResp, bookResp, notifResp, billResp] = await Promise.all([
          fetch('/api/guest/reservations'),
          fetch('/api/guest/bookings'),
          fetch('/api/notifications'),
          fetch('/api/billing')
        ]);
        if (resResp.ok) {
          const rData = await resResp.json();
          if (rData.allRooms) setAllRooms(rData.allRooms);
          setReservations(rData.reservations || []);
          if (rData.roomSchedules) setRoomSchedules(rData.roomSchedules || []);
        }
        if (bookResp.ok) {
          const bData = await bookResp.json();
          const nextBookings = bData.bookings || [];
          setBookings(nextBookings);
          if (nextBookings.length === 0) {
            setActiveBill(null);
            setDetailedBill(null);
          }
        }
        if (notifResp.ok) {
          const nData = await notifResp.json();
          const nextNotifs = nData.notifications || [];
          setNotifications(nextNotifs);
          setUnreadCount(nextNotifs.filter(n => !n.isRead).length);
        }
        if (billResp.ok) {
          const billData = await billResp.json();
          if (billData.success) {
            setActiveBill(billData);
            setDetailedBill(billData);
          } else {
            setActiveBill(null);
            setDetailedBill(null);
          }
        } else {
          setActiveBill(null);
          setDetailedBill(null);
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
  const roomRate = selectedRoom
    ? (breakfastOption === 'with'
        ? (parseFloat(selectedRoom.rateWithBreakfast) || (selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined ? parseFloat(selectedRoom.rate) + parseFloat(selectedRoom.breakfastRate) : parseFloat(selectedRoom.rate)) || 0)
        : (parseFloat(selectedRoom.rateWithoutBreakfast) || parseFloat(selectedRoom.rate) || 0))
    : 0;
  const roomBasePax = selectedRoom ? parseInt(selectedRoom.roomBasePax || selectedRoom.minOccupancy || 2) : 2;
  const inputPax = parseInt(numGuests) || 1;
  const extraGuestsCount = selectedRoom ? Math.max(0, inputPax - roomBasePax) : 0;
  const extraGuestFee = extraGuestsCount * 100 * nightsCount; // ₱100 per extra guest per night
  // Early Check-In Fee Preview Calculation (based on selected checkInTime < 14:00 or current arrival day)
  const calculateEarlyCheckInPreview = () => {
    if (!checkInDate) return { isEarly: false, earlyHours: 0, earlyFee: 0 };
    
    // Check if user selected checkInTime earlier than standard 2:00 PM (14:00)
    if (checkInTime && checkInTime < '14:00') {
      const [ch, cm] = checkInTime.split(':').map(Number);
      const inMinutes = (ch || 0) * 60 + (cm || 0);
      const earlyMinutes = (14 * 60) - inMinutes;
      if (earlyMinutes > 0) {
        const earlyHours = Math.max(1, Math.ceil(earlyMinutes / 60));
        const earlyFee = earlyHours * 50;
        return { isEarly: true, earlyHours, earlyFee };
      }
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    let manilaHour = now.getHours();
    let manilaMinute = now.getMinutes();
    let todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    try {
      const manilaFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const parts = manilaFormatter.formatToParts(now);
      const p = {};
      parts.forEach(({ type, value }) => { p[type] = value; });
      todayStr = `${p.year}-${p.month}-${p.day}`;
      manilaHour = parseInt(p.hour, 10);
      manilaMinute = parseInt(p.minute, 10);
    } catch (e) {}

    // Early check-in applies strictly on the day of arrival before 2:00 PM (14:00) when checking in early or current time is used
    if (checkInDate === todayStr && (useCurrentTimeIn || (checkInTime && checkInTime < '14:00'))) {
      const h = useCurrentTimeIn ? manilaHour : (parseInt((checkInTime || '').split(':')[0], 10) || 14);
      const m = useCurrentTimeIn ? manilaMinute : (parseInt((checkInTime || '').split(':')[1], 10) || 0);
      const exactRemainingMinutes = (14 * 60) - (h * 60 + m);
      if (exactRemainingMinutes > 0) {
        const earlyHours = Math.max(1, Math.ceil(exactRemainingMinutes / 60));
        const earlyFee = earlyHours * 50;
        return { isEarly: true, earlyHours, earlyFee };
      }
    }
    return { isEarly: false, earlyHours: 0, earlyFee: 0 };
  };
  const earlyCheckInInfo = calculateEarlyCheckInPreview();

  // Late Check-Out Fee Preview Calculation (based on selected checkOutTime > 12:00 @ ₱100/hr)
  const calculateLateCheckOutPreview = () => {
    if (!checkOutTime || checkOutTime <= '12:00') return { isLate: false, lateHours: 0, lateFee: 0 };
    const [ch, cm] = checkOutTime.split(':').map(Number);
    const outMinutes = (ch || 0) * 60 + (cm || 0);
    const standardOutMinutes = 12 * 60;
    const lateMinutes = outMinutes - standardOutMinutes;
    if (lateMinutes > 0) {
      const lateHours = Math.max(1, Math.ceil(lateMinutes / 60));
      const lateFee = lateHours * 100;
      return { isLate: true, lateHours, lateFee };
    }
    return { isLate: false, lateHours: 0, lateFee: 0 };
  };
  const lateCheckOutInfo = calculateLateCheckOutPreview();

  const totalAutoFees = (earlyCheckInInfo.isEarly ? earlyCheckInInfo.earlyFee : 0) + (lateCheckOutInfo.isLate ? lateCheckOutInfo.lateFee : 0);
  const originalTotal = (roomRate * nightsCount) + extraGuestFee;
  const totalDiscount = 0;
  const netTotalAmount = originalTotal + totalAutoFees;
  const paymentPctNumber = parseInt(paymentOption) || 50;
  const amountToPayNow = Math.round(netTotalAmount * (paymentPctNumber / 100) * 100) / 100;
  const remainingBalanceAfterPay = Math.max(0, Math.round((netTotalAmount - amountToPayNow) * 100) / 100);

  // Dashboard Metrics
  const totalStaysCount = bookings.length;
  const totalNightsCount = bookings.reduce((sum, b) => {
    const cIn = new Date(b.checkInDate || b.reservationDateTime || Date.now());
    const cOut = new Date(b.checkOutDate || Date.now());
    const nights = Math.max(1, Math.ceil(Math.abs(cOut - cIn) / (1000 * 60 * 60 * 24)));
    return sum + nights;
  }, 0);
  const totalActiveBalanceDue = bookings.reduce((sum, b) => sum + (parseFloat(b.remainingBalance) || 0), 0);

  // Triggers for Visual Room Selection
  const handleStartReserveFlow = () => {
    setActiveTab('rooms');
    setViewMode('default');
    fetchRoomsAndStatus();
  };

  const handleStartBookFlow = () => {
    setActiveTab('rooms');
    setViewMode('default');
    fetchRoomsAndStatus();
  };

  const handleStartReservationFlow = handleStartReserveFlow;

  const handleSelectRoomCard = (rm) => {
    if (rm.status === 'Under Maintenance' || rm.status === 'Maintenance') {
      showAlert('warning', 'Room Under Maintenance', 'This room is currently under maintenance and cannot be booked.');
      return;
    }

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
    setLoggingOut(true);
    window.location.href = '/api/auth/logout';
  };

  // Submission Handlers
  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (!selectedRoom) return;

    // Reservation Rule: Strict 2-day lead time. Guests cannot select today or tomorrow.
    const pad = (n) => String(n).padStart(2, '0');
    const today = new Date();
    const minLeadD = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
    const minLeadDateStr = `${minLeadD.getFullYear()}-${pad(minLeadD.getMonth() + 1)}-${pad(minLeadD.getDate())}`;

    if (checkOutDate && checkOutDate <= checkInDate) {
      showAlert('warning', 'Invalid Stay Dates', 'Check-out time must be later than check-in time.');
      return;
    }

    if (checkInDate < minLeadDateStr) {
      showAlert('warning', 'Reservation Date Restriction', 'Reservations must be made at least 2 days in advance.');
      return;
    }

    if (selectedRoom && checkScheduleConflict(selectedRoom.roomID, checkInDate, checkOutDate)) {
      showAlert('error', 'Reservation Conflict', 'This room is already reserved or booked for the selected dates. Please choose an open date.');
      return;
    }

    setProcessing(true);

    try {
      const res = await fetch('/api/guest/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomID: selectedRoom.roomID,
          checkInDate,
          checkOutDate,
          checkInTime,
          checkOutTime,
          useCurrentTime: false,
          useCurrentTimeIn: false,
          useCurrentTimeOut: false,
          earlyFee: earlyCheckInInfo.isEarly ? earlyCheckInInfo.earlyFee : 0,
          earlyHours: earlyCheckInInfo.isEarly ? earlyCheckInInfo.earlyHours : 0,
          lateFee: lateCheckOutInfo.isLate ? lateCheckOutInfo.lateFee : 0,
          lateHours: lateCheckOutInfo.isLate ? lateCheckOutInfo.lateHours : 0,
          checkInDateTime: `${checkInDate} ${checkInTime || '14:00'}:00`,
          checkOutDateTime: `${checkOutDate} ${checkOutTime || '12:00'}:00`,
          breakfastOption: breakfastOption || 'with',
          numGuests,
          specialRequests,
          isCourtesyHold: true,
          holdDurationHours: 48
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
    if (checkOutDate && checkOutDate <= checkInDate) {
      showAlert('warning', 'Invalid Stay Dates', 'Check-out time must be later than check-in time.');
      return;
    }
    if (selectedRoom && checkScheduleConflict(selectedRoom.roomID, checkInDate, checkOutDate)) {
      showAlert('error', 'Booking Conflict', 'This room is already booked for the selected dates. Please choose an open date.');
      return;
    }
    if (discountedGuests.some(g => !g.discountID || !g.discountIdNumber.trim())) {
      showAlert('warning', 'Missing Discount Info', 'Please select a discount type and enter valid ID numbers for all discounted guests.');
      return;
    }
    setActiveModal('payment');
  };

  const initiatePayMongoSource = async (amtToPay = null) => {
    const targetAmt = amtToPay || amountToPayNow;
    if (!targetAmt || targetAmt <= 0) return null;
    setPaymongoLoading(true);
    setPaymongoError('');
    try {
      const res = await fetch('/api/guest/payments/paymongo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: targetAmt,
          description: `Online Down Payment (₱${targetAmt.toFixed(2)}) for Room ${selectedRoom?.roomNumber || ''}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initiate PayMongo GCash checkout');

      setPaymongoSourceID(data.sourceID);
      setPaymongoCheckoutUrl(data.checkoutUrl);
      setPaymongoQrUrl(data.qrCodeUrl);
      setPaymongoStatus('awaiting_payment');
      return data;
    } catch (err) {
      console.error("PayMongo initiate error:", err);
      setPaymongoError(err.message || 'Unable to generate GCash payment QR.');
      setPaymongoStatus('failed');
      return null;
    } finally {
      setPaymongoLoading(false);
    }
  };

  const handleProceedToSandboxGCash = async () => {
    let url = paymongoCheckoutUrl;
    if (!url) {
      const data = await initiatePayMongoSource();
      url = data?.checkoutUrl;
    }
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Auto-initiate PayMongo source when payment modal is opened or amount changes
  useEffect(() => {
    if (activeModal === 'payment' && selectedRoom && amountToPayNow > 0) {
      setPaymongoStatus('idle');
      setIsGuestGcashSettled(false);
      setGcashRef('');
      initiatePayMongoSource(amountToPayNow);
    } else if (activeModal !== 'payment') {
      setPaymongoStatus('idle');
      setPaymongoSourceID(null);
      setPaymongoCheckoutUrl(null);
      setPaymongoQrUrl(null);
      setIsGuestGcashSettled(false);
      setGcashRef('');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [activeModal, selectedRoom?.roomID, amountToPayNow]);

  // Real-time polling of PayMongo source status
  useEffect(() => {
    if (activeModal !== 'payment' || !paymongoSourceID || paymongoStatus === 'paid') {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/guest/payments/paymongo?sourceID=${encodeURIComponent(paymongoSourceID)}`);
        const data = await res.json();
        if (res.ok && (data.isPaid || data.status === 'paid' || data.rawStatus === 'chargeable' || data.rawStatus === 'paid')) {
          setPaymongoStatus('paid');
          setIsGuestGcashSettled(true);
          setGcashRef(data.referenceNumber || paymongoSourceID);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } catch (err) {
        console.error("Polling PayMongo status error:", err);
      }
    };

    pollingIntervalRef.current = setInterval(pollStatus, 2000);
    pollStatus();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [activeModal, paymongoSourceID, paymongoStatus]);

  const handleConfirmGCashBookingPayment = async (e, verifiedRef = null) => {
    if (e) e.preventDefault();
    if (submittingBookingRef.current || processing) return;

    const uniqueFallbackRef = `PM-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const refToUse = (verifiedRef || gcashRef.trim() || paymongoSourceID || uniqueFallbackRef);

    if (paymongoStatus !== 'paid' && !isGuestGcashSettled && !verifiedRef) {
      setGuestGcashInlineError('Please complete and authorize your GCash payment first.');
      showAlert('error', 'Payment Authorization Required', 'Please complete or authorize your GCash payment to proceed.');
      return;
    }

    submittingBookingRef.current = true;
    const finalRef = refToUse;
    setGuestGcashInlineError('');
    setProcessing(true);

    try {
      // 1. Create Online Booking with settled payment validation info
      const bookRes = await fetch('/api/guest/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          reservationID: convertingReservationID,
          roomID: selectedRoom.roomID,
          checkInDate,
          checkOutDate,
          checkInTime,
          checkOutTime,
          useCurrentTime: Boolean(useCurrentTimeIn),
          useCurrentTimeIn: Boolean(useCurrentTimeIn),
          useCurrentTimeOut: false,
          earlyFee: earlyCheckInInfo.isEarly ? earlyCheckInInfo.earlyFee : 0,
          earlyHours: earlyCheckInInfo.isEarly ? earlyCheckInInfo.earlyHours : 0,
          lateFee: lateCheckOutInfo.isLate ? lateCheckOutInfo.lateFee : 0,
          lateHours: lateCheckOutInfo.isLate ? lateCheckOutInfo.lateHours : 0,
          checkInDateTime: `${checkInDate} ${checkInTime || '14:00'}:00`,
          checkOutDateTime: `${checkOutDate} ${checkOutTime || '12:00'}:00`,
          breakfastOption: breakfastOption || 'without',
          roomRate,
          numGuests: inputPax,
          extraGuestsCount,
          extraGuestFee,
          registeredGuests,
          paymentMethod: 'GCash',
          paymentStatus: 'Settled',
          isGcashSettled: true,
          referenceNumber: finalRef,
          totalAmount: netTotalAmount,
          downPaymentAmount: amountToPayNow,
          downPaymentPercentage: paymentPctNumber,
          remainingBalance: remainingBalanceAfterPay
        })
      });

      const bookData = await bookRes.json();
      if (!bookRes.ok) throw new Error(bookData.error || 'Failed to create online booking');

      const bookingID = bookData.bookingID;
      let receiptDataToUse = bookData.receipt || null;

      if (!receiptDataToUse) {
        // 2. Submit GCash Payment with verified reference if not already settled in booking
        const payRes = await fetch('/api/guest/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingID,
            paymentPercentage: `${paymentPctNumber}%`,
            referenceNumber: finalRef,
            amountToPay: amountToPayNow
          })
        });

        const payData = await payRes.json();
        if (!payRes.ok) throw new Error(payData.error || 'Failed to process payment');
        receiptDataToUse = payData.receipt;
      }

      // Display "Booking Successful" dialog as explicitly requested
      showAlert('success', 'Booking Successful', `Your booking for Room ${selectedRoom.roomNumber} has been confirmed and payment processed successfully!`);

      setReceiptData(receiptDataToUse);
      setActiveModal('receipt');
      setIsGuestGcashSettled(false);
      setGcashRef('');
      setPaymongoStatus('idle');
      setPaymongoSourceID(null);
      setPaymongoCheckoutUrl(null);
      setPaymongoQrUrl(null);
      setConvertingReservationID(null);
      fetchRoomsAndStatus();
    } catch (err) {
      showAlert('error', 'Payment Error', err.message);
      setIsGuestGcashSettled(false);
      setGcashRef('');
      setPaymongoStatus('idle');
      setPaymongoSourceID(null);
      setPaymongoCheckoutUrl(null);
      setPaymongoQrUrl(null);
    } finally {
      setProcessing(false);
      submittingBookingRef.current = false;
    }
  };

  const handleConfirmPayBalance = async (e) => {
    e.preventDefault();
    if (!settleBooking || !settleGcashRef.trim()) return;
    setSettleProcessing(true);

    try {
      const res = await fetch('/api/guest/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingID: settleBooking.bookingID,
          paymentPercentage: 'Balance Settlement (100%)',
          referenceNumber: settleGcashRef.trim(),
          amountToPay: parseFloat(settleBooking.remainingBalance)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to settle balance');

      setReceiptData(data.receipt);
      setSettleBooking(null);
      setSettleGcashRef('');
      setActiveModal('receipt');
      fetchRoomsAndStatus();
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setSettleProcessing(false);
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

  const handleProceedToBooking = (reservation) => {
    if (!reservation) return;
    const roomObj = allRooms.find(r => String(r.roomID) === String(reservation.roomID));
    if (!roomObj) {
      showAlert('error', 'Room Not Found', 'Could not locate room details for this reservation.');
      return;
    }

    const inDateOnly = reservation.reservationDateTime ? reservation.reservationDateTime.substring(0, 10) : new Date().toISOString().substring(0, 10);
    const inTimeOnly = reservation.reservationDateTime && reservation.reservationDateTime.length >= 16 ? reservation.reservationDateTime.substring(11, 16) : '14:00';
    const outDateOnly = reservation.checkOutDateTime ? reservation.checkOutDateTime.substring(0, 10) : new Date(Date.now() + 86400000).toISOString().substring(0, 10);
    const outTimeOnly = reservation.checkOutDateTime && reservation.checkOutDateTime.length >= 16 ? reservation.checkOutDateTime.substring(11, 16) : '12:00';

    setSelectedRoom(roomObj);
    setCheckInDate(inDateOnly);
    setCheckInTime(inTimeOnly);
    setCheckOutDate(outDateOnly);
    setCheckOutTime(outTimeOnly);
    setUseCurrentTimeIn(false);
    const resGuests = parseInt(reservation.guestCount || 1);
    setNumGuests(resGuests);
    setBreakfastOption(reservation.breakfastOption || 'with');
    setSpecialRequests(reservation.specialRequests || '');
    setConvertingReservationID(reservation.reservationID);
    setPaymentOption('50');
    setGcashRef('');
    setIsGuestGcashSettled(false);
    setGuestGcashInlineError('');

    const primaryName = `${initialGuest.firstName || 'Guest'} ${initialGuest.lastName || ''}`.trim();
    const gList = [{ fullName: primaryName, age: 30, discountID: '', discountIdNumber: '' }];
    for (let i = 2; i <= resGuests; i++) {
      gList.push({ fullName: `Guest ${i}`, age: 30, discountID: '', discountIdNumber: '' });
    }
    setRegisteredGuests(gList);

    // Open booking form modal so guest sees the same booking form as when booking a room
    setActiveModal('book_form');
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

  const handleRequestCheckout = (booking) => {
    if (!booking) return;
    showConfirm(
      'Request Checkout',
      `Are you ready to request checkout for Room ${booking.roomNumber}? Receptionist will be notified to finalize your bill.`,
      async () => {
        try {
          const res = await fetch('/api/guest/checkout-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookingID: booking.bookingID
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to request checkout');

          showAlert('success', 'Checkout Requested', "Checkout request sent. Receptionist will finalize your bill.");
          fetchRoomsAndStatus();
        } catch (err) {
          showAlert('error', 'Error', err.message);
        }
      }
    );
  };

  const handleInitiatePay = (booking) => {
    if (!booking) return;
    const isBillFinalized = ['Bill Finalized', 'Final Billing Updated', 'Bill Ready'].includes(booking.status) || normalizeBookingStatus(booking.status) === 'Bill Finalized';
    const isDeclined = booking.status === 'Payment Declined' || booking.status === 'Declined';
    if (!isBillFinalized && !isDeclined) {
      showAlert('warning', 'Bill Not Ready', "Check-out must be requested first and receptionist must finalize your bill before payment.");
      return;
    }
    const rem = booking.remainingBalance ?? detailedBill?.balancing?.remainingBalance ?? detailedBill?.remainingBalance ?? 0;
    window.location.href = `/paymongo/test?bookingID=${booking.bookingID}&amount=${rem}`;
  };

  const handleViewReceiptForBooking = async (booking) => {
    if (!booking) return;
    try {
      const res = await fetch(`/api/billing?bookingID=${booking.bookingID}`);
      const data = await res.json();
      const payments = data.payments || [];
      const latestPayment = payments.length > 0 ? payments[payments.length - 1] : null;
      const totalPaid = data.balancing?.paidTotal ?? payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
      const remainingBalance = data.balancing?.remainingBalance ?? parseFloat(booking.remainingBalance) ?? 0;
      const isDownPayment = remainingBalance > 0;
      const paymentPercentage = isDownPayment ? '50% Down Payment' : '100% Full Settlement';

      const receipt = {
        receiptNumber: latestPayment?.paymentID ? `REC-${latestPayment.paymentID}` : `REC-${booking.bookingID}`,
        paymentID: latestPayment?.paymentID || booking.bookingID,
        bookingID: booking.bookingID,
        guestName: guestProfile ? `${guestProfile.firstName} ${guestProfile.lastName}` : (data.booking ? `${data.booking.firstName} ${data.booking.lastName}` : 'Guest'),
        roomNumber: booking.roomNumber || data.booking?.roomNumber || 'N/A',
        roomType: booking.roomType || data.booking?.roomType || 'Room',
        paymentMethod: latestPayment?.paymentMethod || 'GCash (PayMongo)',
        referenceNumber: latestPayment?.referenceNumber || 'PM-SETTLED',
        paymentPercentage,
        amountPaid: parseFloat(latestPayment?.amount || totalPaid || booking.downPaymentAmount || 0),
        totalPaid: parseFloat(totalPaid),
        remainingBalance: parseFloat(remainingBalance),
        timestamp: latestPayment?.paymentDate || new Date().toISOString()
      };
      setReceiptData(receipt);
      setActiveModal('receipt');
    } catch {
      const fallbackRem = parseFloat(booking.remainingBalance) || 0;
      const fallbackReceipt = {
        receiptNumber: `REC-${booking.bookingID}`,
        paymentID: booking.bookingID,
        bookingID: booking.bookingID,
        guestName: guestProfile ? `${guestProfile.firstName} ${guestProfile.lastName}` : 'Guest',
        roomNumber: booking.roomNumber,
        roomType: booking.roomType,
        paymentMethod: 'GCash (PayMongo)',
        referenceNumber: 'PM-SETTLED',
        paymentPercentage: fallbackRem > 0 ? '50% Down Payment' : '100% Full Settlement',
        amountPaid: parseFloat(booking.downPaymentAmount || booking.totalAmount || 0),
        remainingBalance: fallbackRem,
        timestamp: new Date().toISOString()
      };
      setReceiptData(fallbackReceipt);
      setActiveModal('receipt');
    }
  };

  const handleDownloadReceiptForBooking = async (booking) => {
    if (!booking) return;
    try {
      const res = await fetch(`/api/billing?bookingID=${booking.bookingID}`);
      const data = await res.json();
      const payments = data.payments || [];
      const latestPayment = payments.length > 0 ? payments[payments.length - 1] : null;
      const totalPaid = data.balancing?.paidTotal ?? payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
      const remainingBalance = data.balancing?.remainingBalance ?? parseFloat(booking.remainingBalance) ?? 0;
      const isDownPayment = remainingBalance > 0;
      const paymentPercentage = isDownPayment ? '50% Down Payment' : '100% Full Settlement';

      const receipt = {
        receiptNumber: latestPayment?.paymentID ? `REC-${latestPayment.paymentID}` : `REC-${booking.bookingID}`,
        paymentID: latestPayment?.paymentID || booking.bookingID,
        bookingID: booking.bookingID,
        guestName: guestProfile ? `${guestProfile.firstName} ${guestProfile.lastName}` : (data.booking ? `${data.booking.firstName} ${data.booking.lastName}` : 'Guest'),
        roomNumber: booking.roomNumber || data.booking?.roomNumber || 'N/A',
        roomType: booking.roomType || data.booking?.roomType || 'Room',
        paymentMethod: latestPayment?.paymentMethod || 'GCash (PayMongo)',
        referenceNumber: latestPayment?.referenceNumber || 'PM-SETTLED',
        paymentPercentage,
        amountPaid: parseFloat(latestPayment?.amount || totalPaid || booking.downPaymentAmount || 0),
        totalPaid: parseFloat(totalPaid),
        remainingBalance: parseFloat(remainingBalance),
        timestamp: latestPayment?.paymentDate || new Date().toISOString()
      };
      generateReceiptPNG(receipt);
    } catch {
      const fallbackRem = parseFloat(booking.remainingBalance) || 0;
      const fallbackReceipt = {
        receiptNumber: `REC-${booking.bookingID}`,
        paymentID: booking.bookingID,
        bookingID: booking.bookingID,
        guestName: guestProfile ? `${guestProfile.firstName} ${guestProfile.lastName}` : 'Guest',
        roomNumber: booking.roomNumber,
        roomType: booking.roomType,
        paymentMethod: 'GCash (PayMongo)',
        referenceNumber: 'PM-SETTLED',
        paymentPercentage: fallbackRem > 0 ? '50% Down Payment' : '100% Full Settlement',
        amountPaid: parseFloat(booking.downPaymentAmount || booking.totalAmount || 0),
        remainingBalance: fallbackRem,
        timestamp: new Date().toISOString()
      };
      generateReceiptPNG(fallbackReceipt);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Pending':
      case 'Pending Check-in':
        return 'bg-info-subtle text-info-emphasis border border-info';
      case 'Confirmed':
      case 'Booked':
        return 'bg-primary-subtle text-primary border border-primary';
      case 'Active Stay':
      case 'Checked In':
        return 'bg-primary text-white';
      case 'Checkout Requested':
      case 'Pending Room Verification':
      case 'Pending Checkout':
        return 'bg-warning text-dark';
      case 'Bill Finalized':
      case 'Room Verified':
      case 'Final Billing Updated':
        return 'badge-purple text-white';
      case 'Paid':
      case 'Payment Completed':
        return 'bg-success text-white';
      case 'Completed':
      case 'Checked Out':
        return 'bg-secondary text-white';
      case 'Cancelled':
      case 'No Show':
        return 'bg-danger text-white';
      default:
        return 'bg-secondary-subtle text-secondary';
    }
  };

  const handlePrintReceipt = () => {
    if (!receiptData) return;
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - PCC Home Suite Home</title>
          <style>
            @page {
              size: 80mm 200mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace, sans-serif;
              width: 80mm;
              max-width: 80mm;
              margin: 0 auto;
              padding: 8px 6px;
              color: #000;
              background: #fff;
              font-size: 11px;
              line-height: 1.35;
            }
            .receipt-box {
              width: 100%;
              max-width: 74mm;
              margin: 0 auto;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .logo { width: 42px; height: 42px; border-radius: 4px; margin-bottom: 3px; }
            .brand-name { font-size: 13px; font-weight: bold; text-transform: uppercase; margin: 1px 0; letter-spacing: 0.5px; }
            .address { font-size: 8.5px; color: #333; margin-bottom: 5px; line-height: 1.25; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .double-divider { border-top: 2px solid #000; margin: 6px 0; }
            .receipt-title { font-size: 10.5px; font-weight: bold; text-transform: uppercase; padding: 2px 0; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
            .info-table td { padding: 1.5px 0; vertical-align: top; font-size: 10.5px; }
            .total-row { font-size: 11.5px; font-weight: bold; }
            .footer { margin-top: 10px; text-align: center; font-size: 8.5px; color: #444; line-height: 1.3; }
            @media print {
              html, body {
                width: 80mm !important;
                max-width: 80mm !important;
                margin: 0 auto !important;
                padding: 4mm 3mm !important;
                background: #fff !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .receipt-box {
                width: 100% !important;
                max-width: 74mm !important;
                margin: 0 auto !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-box">
            <div class="text-center">
              <img src="/assets/images/logo.jpg" class="logo" alt="PCC Logo" />
              <div class="brand-name">PCC HOME SUITE HOME</div>
              <div class="address">
                Osmeña Street, Zone 1, Koronadal City<br/>
                South Cotabato, Philippines<br/>
                Tel: 09000000000 | Info: info@pccsuite.com
              </div>
            </div>

            <div class="divider"></div>
            <div class="text-center receipt-title">OFFICIAL ONLINE GCASH RECEIPT</div>
            <div class="divider"></div>

            <table class="info-table">
              <tr><td>Date/Time:</td><td class="text-right">${new Date(receiptData.timestamp).toLocaleString()}</td></tr>
              <tr><td>Receipt No:</td><td class="text-right">#REC-${receiptData.paymentID}</td></tr>
              <tr><td>Booking Ref:</td><td class="text-right">#${receiptData.bookingID}</td></tr>
              <tr><td>Guest Name:</td><td class="text-right bold">${receiptData.guestName}</td></tr>
              <tr><td>Payment Method:</td><td class="text-right">${receiptData.paymentMethod}</td></tr>
              <tr><td>GCash Ref No:</td><td class="text-right">${receiptData.referenceNumber}</td></tr>
              <tr><td>Payment Option:</td><td class="text-right">${receiptData.paymentPercentage}</td></tr>
            </table>

            <div class="divider"></div>

            <table class="info-table">
              <tr class="total-row"><td>AMOUNT PAID:</td><td class="text-right">₱${parseFloat(receiptData.amountPaid).toFixed(2)}</td></tr>
              <tr><td>Remaining Balance:</td><td class="text-right">₱${parseFloat(receiptData.remainingBalance).toFixed(2)}</td></tr>
            </table>

            <div class="double-divider"></div>

            <div class="footer">
              <p class="bold" style="margin-bottom: 2px;">Thank you for staying at PCC Home Suite Home!</p>
              <p style="margin: 0;">We look forward to serving you again.</p>
            </div>
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
        label: 'Available',
        bgColor: '#ffffff',
        borderLeft: '#198754',
        selectable: true
      };
    }
    if (status === 'Occupied') {
      return {
        badgeClass: 'bg-primary text-white',
        label: 'Occupied (Future stays open)',
        bgColor: '#f0f7ff',
        borderLeft: '#0d6efd',
        selectable: true
      };
    }
    if (status === 'Under Maintenance') {
      return {
        badgeClass: 'bg-danger text-white',
        label: 'Under Maintenance',
        bgColor: '#fff5f5',
        borderLeft: '#dc3545',
        selectable: false
      };
    }
    if (status === 'Booked' || status === 'Reserved') {
      return {
        badgeClass: 'bg-warning text-dark',
        label: 'Reserved (Other dates open)',
        bgColor: '#fffdf0',
        borderLeft: '#fd7e14',
        selectable: true
      };
    }
    return {
      badgeClass: 'bg-warning text-dark',
      label: status,
      bgColor: '#fffdf0',
      borderLeft: '#fd7e14',
      selectable: false
    };
  };

  // Reservation Status Timeline Component Helper (Pre-payment stage: Reserved -> On Hold -> Booked / Cancelled)
  const renderReservationStatusTimeline = (status) => {
    const norm = normalizeReservationStatus(status);
    const isCancelled = norm === 'Cancelled';

    const reservationSteps = isCancelled
      ? [
          { id: 'Reserved', label: 'Reserved', icon: 'bi-calendar-check' },
          { id: 'On Hold', label: 'On Hold', icon: 'bi-hourglass-split' },
          { id: 'Cancelled', label: 'Cancelled', icon: 'bi-x-circle' }
        ]
      : [
          { id: 'Reserved', label: 'Reserved', icon: 'bi-calendar-check' },
          { id: 'On Hold', label: 'On Hold', icon: 'bi-hourglass-split' },
          { id: 'Booked', label: 'Booked', icon: 'bi-check2-circle' }
        ];

    let currentIdx = 0;
    if (norm === 'On Hold') currentIdx = 1;
    if (norm === 'Booked' || isCancelled) currentIdx = 2;

    const trackColor = isCancelled ? '#dc3545' : (currentIdx >= 2 ? '#0dcaf0' : 'var(--pcc-blue, #0d6efd)');

    return (
      <div className="w-100 my-2.5 p-2 rounded-3 bg-light-subtle border">
        <div className="d-flex justify-content-between align-items-center mb-1.5 px-1">
          <span className="text-muted fw-bold" style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <i className="bi bi-clock-history me-1 text-primary"></i>Reservation Timeline (Pre-Payment)
          </span>
          <StatusBadge status={status} type="reservation" />
        </div>
        <div className="d-flex align-items-center justify-content-between position-relative px-2 pt-1 pb-1">
          {/* Status Connecting Line Track */}
          <div
            className="position-absolute"
            style={{
              top: '18px',
              left: '12%',
              right: '12%',
              height: '3px',
              backgroundColor: '#e2e8f0',
              zIndex: 0,
              transform: 'translateY(-50%)'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(currentIdx / (reservationSteps.length - 1)) * 100}%`,
                backgroundColor: trackColor,
                transition: 'width 0.3s ease'
              }}
            />
          </div>

          {reservationSteps.map((step, idx) => {
            const isDone = idx <= currentIdx;
            const isCurrent = idx === currentIdx;
            const isCancelStep = isCancelled && step.id === 'Cancelled';
            const nodeBg = isCancelStep
              ? 'bg-danger text-white shadow-sm'
              : (isDone 
                  ? (norm === 'Booked' && idx === 2 ? 'bg-info text-white shadow-sm' : 'bg-primary text-white shadow-sm')
                  : 'bg-white text-muted border');

            return (
              <div key={step.id} className="d-flex flex-column align-items-center" style={{ flex: 1, zIndex: 1 }}>
                <div
                  className={`rounded-circle d-flex align-items-center justify-content-center fw-bold ${nodeBg}`}
                  style={{ width: '28px', height: '28px', fontSize: '0.75rem', position: 'relative', zIndex: 2 }}
                >
                  <i className={`bi ${step.icon}`}></i>
                </div>
                <span className={`mt-1 text-center ${isCurrent ? (isCancelStep ? 'fw-bold text-danger' : 'fw-bold text-primary') : (isDone ? 'text-dark fw-semibold' : 'text-muted')}`} style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
        {norm === 'Booked' && (
          <div className="text-center text-info small mt-1 fw-bold" style={{ fontSize: '0.72rem' }}>
            <i className="bi bi-check-circle me-1"></i>Reservation complete! Converted to active booking.
          </div>
        )}
        {isCancelled && (
          <div className="text-center text-danger small mt-1 fw-bold" style={{ fontSize: '0.72rem' }}>
            <i className="bi bi-x-circle me-1"></i>Reservation ended. Room returned to inventory.
          </div>
        )}
      </div>
    );
  };

  // Interactive Booking Status Timeline Component Helper (Post-payment stage: Pending -> Active Stay -> Bill Finalized -> Paid -> Completed)
  const renderBookingStatusTimeline = (status) => {
    const norm = normalizeBookingStatus(status);
    const isCancelled = norm === 'Cancelled';

    if (isCancelled) {
      return (
        <div className="w-100 my-2 p-2 rounded-3 bg-danger-subtle border border-danger">
          <div className="d-flex align-items-center gap-2 text-danger small fw-bold">
            <i className="bi bi-x-octagon-fill fs-6"></i>
            <span>Booking Cancelled</span>
          </div>
        </div>
      );
    }

    const bookingSteps = [
      { id: 'Pending', label: 'Pending', icon: 'bi-clock-history' },
      { id: 'Active Stay', label: 'Active Stay', icon: 'bi-door-open' },
      { id: 'Bill Finalized', label: 'Bill Finalized', icon: 'bi-receipt' },
      { id: 'Paid', label: 'Paid', icon: 'bi-credit-card-2-front' },
      { id: 'Completed', label: 'Completed', icon: 'bi-check2-all' }
    ];

    let currentIdx = 0;
    if (norm === 'Active Stay') currentIdx = 1;
    if (norm === 'Bill Finalized') currentIdx = 2;
    if (norm === 'Paid') currentIdx = 3;
    if (norm === 'Completed') currentIdx = 4;

    const trackColor = currentIdx >= 4 ? '#343a40' : (currentIdx >= 3 ? '#198754' : (currentIdx >= 2 ? '#6f42c1' : 'var(--pcc-blue, #0d6efd)'));

    return (
      <div className="w-100 my-2.5 p-2 rounded-3 bg-light-subtle border">
        <div className="d-flex justify-content-between align-items-center mb-1.5 px-1">
          <span className="text-muted fw-bold" style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <i className="bi bi-calendar-check-fill me-1 text-primary"></i>Booking Timeline (Post-Payment)
          </span>
          <StatusBadge status={status} type="booking" />
        </div>
        <div className="d-flex align-items-center justify-content-between position-relative px-1 pt-1 pb-1">
          {/* Status Connecting Line Track */}
          <div
            className="position-absolute"
            style={{
              top: '18px',
              left: '8%',
              right: '8%',
              height: '3px',
              backgroundColor: '#e2e8f0',
              zIndex: 0,
              transform: 'translateY(-50%)'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(currentIdx / (bookingSteps.length - 1)) * 100}%`,
                backgroundColor: trackColor,
                transition: 'width 0.3s ease'
              }}
            />
          </div>

          {bookingSteps.map((step, idx) => {
            const isDone = idx <= currentIdx;
            const isCurrent = idx === currentIdx;
            let nodeBg = 'bg-white text-muted border';
            if (isDone) {
              if (currentIdx >= 4) nodeBg = 'bg-dark text-white shadow-sm';
              else if (currentIdx >= 3 && idx >= 3) nodeBg = 'bg-success text-white shadow-sm';
              else if (currentIdx >= 2 && idx === 2) nodeBg = 'text-white shadow-sm';
              else nodeBg = 'bg-primary text-white shadow-sm';
            }

            const customStyle = (isDone && currentIdx >= 2 && idx === 2 && currentIdx < 3)
              ? { backgroundColor: '#6f42c1' }
              : {};

            return (
              <div key={step.id} className="d-flex flex-column align-items-center" style={{ flex: 1, zIndex: 1 }}>
                <div
                  className={`rounded-circle d-flex align-items-center justify-content-center fw-bold ${nodeBg}`}
                  style={{ width: '28px', height: '28px', fontSize: '0.75rem', position: 'relative', zIndex: 2, ...customStyle }}
                >
                  <i className={`bi ${step.icon}`}></i>
                </div>
                <span className={`mt-1 text-center ${isCurrent ? 'fw-bold text-primary' : (isDone ? 'text-dark fw-semibold' : 'text-muted')}`} style={{ fontSize: '0.64rem', whiteSpace: 'nowrap' }}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Group rooms by Floor safely
  const groundFloorRooms = allRooms.filter(r => String(r.floorID) === '1' || r.floorName?.toLowerCase().includes('ground') || String(r.roomNumber).startsWith('1'));
  const secondFloorRooms = allRooms.filter(r => String(r.floorID) === '2' || r.floorName?.toLowerCase().includes('second') || r.floorName?.toLowerCase().includes('upper') || String(r.roomNumber).startsWith('2'));
  const fallbackRooms = allRooms.filter(r => !groundFloorRooms.some(g => g.roomID === r.roomID) && !secondFloorRooms.some(s => s.roomID === r.roomID));

  const activeReservation = reservations.find(r => {
    const norm = normalizeReservationStatus(r.status);
    return (norm === 'On Hold' || norm === 'Reserved') && r.status !== 'Cancelled' && r.status !== 'Booked';
  });
  const activeBookingStay = bookings.find(b => ['Pending', 'Confirmed', 'Overdue Check-In', 'Checked In', 'Active Stay', 'Pending Room Verification', 'Pending Checkout', 'Room Verified', 'Final Billing Updated', 'Payment Completed'].includes(b.status));

  useEffect(() => {
    if (activeBookingStay?.bookingID) {
      fetchDetailedBill(activeBookingStay.bookingID);
    }
  }, [activeBookingStay?.bookingID]);

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
                  <button className="btn btn-secondary text-white px-4 py-2 fw-semibold" onClick={() => setShowLogoutModal(false)} style={{ borderRadius: '8px' }}>
                    Cancel
                  </button>
                  <LoadingButton 
                    type="button"
                    className="btn btn-danger text-white px-4 py-2 fw-bold" 
                    isLoading={loggingOut}
                    loadingText="Logging out..."
                    onClick={handleConfirmLogout} 
                    style={{ borderRadius: '8px' }}
                  >
                    Logout <i className="bi bi-box-arrow-right ms-1"></i>
                  </LoadingButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GUEST PORTAL ROOT FLEX LAYOUT */}
      <div className="d-flex flex-column flex-lg-row" style={{ minHeight: '100vh', width: '100%' }}>
        {/* RESPONSIVE NAVIGATION: DESKTOP LEFT SIDEBAR vs MOBILE TOP NAV */}
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
          <nav className="navbar navbar-dark text-white border-bottom shadow-sm sticky-top px-3" style={{ background: 'var(--pcc-blue)', zIndex: 1030 }}>
            <div className="container-fluid p-0 d-flex justify-content-between align-items-center">
              <Link 
                href="/guest/dashboard" 
                onClick={() => { setActiveTab('home'); setViewMode('default'); }}
                className="navbar-brand d-flex align-items-center gap-2 m-0 text-white cursor-pointer"
                title="Guest Dashboard Home"
              >
                <img src="/assets/images/logo.jpg" height="38" alt="PCC Logo" style={{ borderRadius: "6px" }} />
                <span className="fw-bold display-font d-none d-sm-inline" style={{ fontSize: '1.05rem', color: '#ffffff' }}>PCC Home Suite</span>
              </Link>
              <div className="d-flex align-items-center gap-2 gap-sm-3">
                <HeaderProfile user={guest} />
                <button
                  className="btn btn-sm text-white border-0 px-2 py-1"
                  title="Log Out"
                  aria-label="Log Out"
                  onClick={() => setShowLogoutModal(true)}
                >
                  <i className="bi bi-power fs-5"></i>
                </button>
              </div>
            </div>
          </nav>
        )}

        {/* MAIN WORKSPACE CONTENT */}
        <main className={`flex-grow-1 p-3 p-lg-4 ${!isDesktop ? 'pb-5 mb-4' : ''}`} style={{ minWidth: 0, paddingBottom: !isDesktop ? '95px' : undefined }}>
          {viewMode === 'select_room' ? (
            /* VISUAL ROOM LAYOUT SELECTION WORKSPACE */
            <div className="animate__animated animate__fadeIn">
              {/* BACK HEADER */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <button className="btn btn-sm btn-secondary text-white fw-semibold d-flex align-items-center gap-1 shadow-xs" onClick={() => setViewMode('default')}>
                  <i className="bi bi-arrow-left"></i> Back to Navigation
                </button>
                <span className="badge bg-pcc-blue text-white px-3 py-1.5 fw-bold" style={{ fontSize: '0.82rem' }}>
                  {flowAction === 'reserve' ? 'Reservation Mode' : 'Booking Mode'}
                </span>
              </div>

            {/* EXACT 4-COLOR STATUS LEGEND BAR */}
            <div className="card shadow-sm border-0 p-3 mb-3 bg-white" style={{ borderRadius: '12px' }}>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <h5 className="fw-bold mb-1 text-dark">
                    {flowAction === 'reserve' ? 'Select Room to Reserve' : 'Select Room to Book'}
                  </h5>
                  <p className="text-muted mb-0 small">Click any Green (Available) room card to proceed with your stay request.</p>
                </div>

                {/* EXACT 4-COLOR LEGEND */}
                <div className="d-flex align-items-center gap-2 p-2 bg-light rounded border flex-wrap" style={{ fontSize: '0.78rem' }}>
                  <span className="fw-bold text-dark">Status Legend:</span>
                  <div className="d-flex align-items-center gap-1">
                    <span className="badge bg-success p-1"></span>
                    <span className="fw-bold text-success">Green (Available)</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <span className="badge bg-primary p-1"></span>
                    <span className="fw-semibold text-primary">Blue (Occupied)</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <span className="badge bg-danger p-1"></span>
                    <span className="fw-semibold text-danger">Red (Maintenance)</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <span className="badge bg-warning p-1"></span>
                    <span className="fw-semibold text-warning-emphasis">Orange (Booked)</span>
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
                <h5 className="fw-bold text-dark mb-1">No Rooms Available At The Moment</h5>
                <p className="text-muted small mb-3">Our rooms are currently being updated by Front Desk. Please check back shortly.</p>
                <button className="btn btn-primary text-white fw-bold btn-sm m-auto shadow-xs" onClick={fetchRoomsAndStatus}>
                  Refresh Availability
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

                            <div className="my-2.5 p-3 rounded border small room-rate-panel" style={{ fontSize: '0.8rem', padding: '0.75rem 0.95rem' }}>
                              <div className="d-flex justify-content-between mb-1 py-0.5">
                                <span className="text-muted">Max Occupancy:</span>
                                <strong className="text-dark">Up to {rm.occupancyLimit} Pax</strong>
                              </div>
                              <div className="d-flex justify-content-between mb-1 py-0.5">
                                <span className="text-muted">Without Breakfast:</span>
                                <strong className="text-dark">₱{parseFloat(rm.rateWithoutBreakfast || rm.rate).toFixed(2)}</strong>
                              </div>
                              <div className="d-flex justify-content-between mb-1 py-0.5">
                                <span className="text-muted">With Breakfast:</span>
                                <strong className="text-pcc-blue fw-bold">₱{parseFloat(rm.rateWithBreakfast || (rm.breakfastRate !== null && rm.breakfastRate !== undefined ? parseFloat(rm.rate) + parseFloat(rm.breakfastRate) : parseFloat(rm.rate))).toFixed(2)}</strong>
                              </div>
                              <div className="d-flex justify-content-between align-items-center pt-1.5 mt-1 border-top" style={{ fontSize: '0.76rem' }}>
                                <span className="text-muted">Breakfast Rate:</span>
                                {rm.breakfastRate !== null && rm.breakfastRate !== undefined && parseFloat(rm.breakfastRate) === 0 ? (
                                  <strong className="text-success"><i className="bi bi-cup-hot me-1"></i>Free / Included</strong>
                                ) : (
                                  <strong className="text-success">
                                    ₱{parseFloat(
                                      rm.breakfastRate !== null && rm.breakfastRate !== undefined
                                        ? rm.breakfastRate
                                        : (rm.rateWithBreakfast && rm.rateWithoutBreakfast ? parseFloat(rm.rateWithBreakfast) - parseFloat(rm.rateWithoutBreakfast) : 0)
                                    ).toFixed(2)}
                                  </strong>
                                )}
                              </div>
                            </div>

                            <div className="mt-auto pt-2.5 d-flex justify-content-between align-items-center gap-2">
                              <button
                                type="button"
                                className="btn btn-xs btn-secondary text-white py-1.5 px-2.5 shadow-xs"
                                onClick={(e) => { e.stopPropagation(); handleOpenRoomDetails(rm); }}
                                style={{ fontSize: '0.76rem', borderRadius: '6px' }}
                                aria-label={`View details for Room ${rm.roomNumber}`}
                              >
                                Details
                              </button>
                              {meta.selectable ? (
                                <button
                                  type="button"
                                  className={`btn btn-xs fw-bold py-1.5 px-3 shadow-xs ${flowAction === 'reserve' ? 'btn-success text-white' : 'btn-primary text-white'}`}
                                  style={{ borderRadius: '6px', fontSize: '0.76rem' }}
                                  aria-label={`${flowAction === 'reserve' ? 'Reserve' : 'Book'} Room ${rm.roomNumber}`}
                                >
                                  {flowAction === 'reserve' ? 'Reserve' : 'Book'}
                                </button>
                              ) : (
                                <span className="badge bg-secondary text-white py-1.5 px-2">Disabled</span>
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

                            <div className="my-2.5 p-3 rounded border small room-rate-panel" style={{ fontSize: '0.8rem', padding: '0.75rem 0.95rem' }}>
                              <div className="d-flex justify-content-between mb-1 py-0.5">
                                <span className="text-muted">Max Occupancy:</span>
                                <strong className="text-dark">Up to {rm.occupancyLimit} Pax</strong>
                              </div>
                              <div className="d-flex justify-content-between mb-1 py-0.5">
                                <span className="text-muted">Without Breakfast:</span>
                                <strong className="text-dark">₱{parseFloat(rm.rateWithoutBreakfast || rm.rate).toFixed(2)}</strong>
                              </div>
                              <div className="d-flex justify-content-between mb-1 py-0.5">
                                <span className="text-muted">With Breakfast:</span>
                                <strong className="text-pcc-blue fw-bold">₱{parseFloat(rm.rateWithBreakfast || (rm.breakfastRate !== null && rm.breakfastRate !== undefined ? parseFloat(rm.rate) + parseFloat(rm.breakfastRate) : parseFloat(rm.rate))).toFixed(2)}</strong>
                              </div>
                              <div className="d-flex justify-content-between align-items-center pt-1.5 mt-1 border-top" style={{ fontSize: '0.76rem' }}>
                                <span className="text-muted">Breakfast Rate:</span>
                                {rm.breakfastRate !== null && rm.breakfastRate !== undefined && parseFloat(rm.breakfastRate) === 0 ? (
                                  <strong className="text-success"><i className="bi bi-cup-hot me-1"></i>Free / Included</strong>
                                ) : (
                                  <strong className="text-success">
                                    ₱{parseFloat(
                                      rm.breakfastRate !== null && rm.breakfastRate !== undefined
                                        ? rm.breakfastRate
                                        : (rm.rateWithBreakfast && rm.rateWithoutBreakfast ? parseFloat(rm.rateWithBreakfast) - parseFloat(rm.rateWithoutBreakfast) : 0)
                                    ).toFixed(2)}
                                  </strong>
                                )}
                              </div>
                            </div>

                            <div className="mt-auto pt-2.5 d-flex justify-content-between align-items-center gap-2">
                              <button
                                type="button"
                                className="btn btn-xs btn-secondary text-white py-1.5 px-2.5 shadow-xs"
                                onClick={(e) => { e.stopPropagation(); handleOpenRoomDetails(rm); }}
                                style={{ fontSize: '0.76rem', borderRadius: '6px' }}
                                aria-label={`View details for Room ${rm.roomNumber}`}
                              >
                                Details
                              </button>
                              {meta.selectable ? (
                                <button
                                  type="button"
                                  className={`btn btn-xs fw-bold py-1.5 px-3 shadow-xs ${flowAction === 'reserve' ? 'btn-success text-white' : 'btn-primary text-white'}`}
                                  style={{ borderRadius: '6px', fontSize: '0.76rem' }}
                                  aria-label={`${flowAction === 'reserve' ? 'Reserve' : 'Book'} Room ${rm.roomNumber}`}
                                >
                                  {flowAction === 'reserve' ? 'Reserve' : 'Book'}
                                </button>
                              ) : (
                                <span className="badge bg-secondary text-white py-1.5 px-2">Disabled</span>
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

                              <div className="my-2.5 p-3 rounded border small room-rate-panel" style={{ fontSize: '0.8rem', padding: '0.75rem 0.95rem' }}>
                                <div className="d-flex justify-content-between mb-1 py-0.5">
                                  <span className="text-muted">Max Occupancy:</span>
                                  <strong className="text-dark">Up to {rm.occupancyLimit} Pax</strong>
                                </div>
                                <div className="d-flex justify-content-between mb-1 py-0.5">
                                  <span className="text-muted">Without Breakfast:</span>
                                  <strong className="text-dark">₱{parseFloat(rm.rateWithoutBreakfast || rm.rate).toFixed(2)}</strong>
                                </div>
                                <div className="d-flex justify-content-between mb-1 py-0.5">
                                  <span className="text-muted">With Breakfast:</span>
                                  <strong className="text-pcc-blue fw-bold">₱{parseFloat(rm.rateWithBreakfast || (rm.breakfastRate !== null && rm.breakfastRate !== undefined ? parseFloat(rm.rate) + parseFloat(rm.breakfastRate) : parseFloat(rm.rate))).toFixed(2)}</strong>
                                </div>
                                <div className="d-flex justify-content-between align-items-center pt-1.5 mt-1 border-top" style={{ fontSize: '0.76rem' }}>
                                  <span className="text-muted">Breakfast Rate:</span>
                                  {rm.breakfastRate !== null && rm.breakfastRate !== undefined && parseFloat(rm.breakfastRate) === 0 ? (
                                    <strong className="text-success"><i className="bi bi-cup-hot me-1"></i>Free / Included</strong>
                                  ) : (
                                    <strong className="text-success">
                                      ₱{parseFloat(
                                        rm.breakfastRate !== null && rm.breakfastRate !== undefined
                                          ? rm.breakfastRate
                                          : (rm.rateWithBreakfast && rm.rateWithoutBreakfast ? parseFloat(rm.rateWithBreakfast) - parseFloat(rm.rateWithoutBreakfast) : 0)
                                      ).toFixed(2)}
                                    </strong>
                                  )}
                                </div>
                              </div>

                              <div className="mt-auto pt-2.5 d-flex justify-content-between align-items-center gap-2">
                                <button
                                  type="button"
                                  className="btn btn-xs btn-secondary text-white py-1.5 px-2.5 shadow-xs"
                                  onClick={(e) => { e.stopPropagation(); handleOpenRoomDetails(rm); }}
                                  style={{ fontSize: '0.76rem', borderRadius: '6px' }}
                                  aria-label={`View details for Room ${rm.roomNumber}`}
                                >
                                  Details
                                </button>
                                {meta.selectable ? (
                                  <button
                                    type="button"
                                    className={`btn btn-xs fw-bold py-1.5 px-3 shadow-xs ${flowAction === 'reserve' ? 'btn-success text-white' : 'btn-primary text-white'}`}
                                    style={{ borderRadius: '6px', fontSize: '0.76rem' }}
                                    aria-label={`${flowAction === 'reserve' ? 'Reserve' : 'Book'} Room ${rm.roomNumber}`}
                                  >
                                    {flowAction === 'reserve' ? 'Reserve' : 'Book'}
                                  </button>
                                ) : (
                                  <span className="badge bg-secondary text-white py-1.5 px-2">Disabled</span>
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
                      <span className="fw-bold mb-2 d-inline-block px-3 py-1 rounded-pill" style={{ backgroundColor: 'rgba(255, 255, 255, 0.25)', color: '#ffffff', fontSize: '0.78rem', border: '1px solid rgba(255, 255, 255, 0.4)' }}>
                        Hotel Guest Portal
                      </span>
                      <div className="welcome-header mb-1">
                        <div className="welcome-header-mobile d-md-none">
                          <div className="fw-bold fs-5">Welcome, {guest.firstName} {guest.lastName || ''}!</div>
                          <div className="opacity-75 font-monospace small">(UserID: #{guest.userID || guest.guestID})</div>
                        </div>
                        <h3 className="fw-bold mb-0 d-none d-md-block">
                          Welcome, {guest.firstName} {guest.lastName || ''}! <span className="fs-6 font-monospace opacity-75 fw-normal">(UserID: #{guest.userID || guest.guestID})</span>
                        </h3>
                      </div>
                      <p className="mb-0 text-white-50 small">Experience comfort and convenience at PCC Home Suite Home.</p>
                    </div>
                  </div>
                </div>

                {/* STAY & LOYALTY METRICS WIDGETS */}
                <div className="row g-2 g-md-3 mb-4">
                  <div className="col-4">
                    <div className="card shadow-sm border-0 p-2.5 p-md-3 text-center bg-white" style={{ borderRadius: '12px' }}>
                      <div className="text-pcc-blue fw-bold fs-4 fs-md-3 mb-0 text-nowrap">{totalStaysCount}</div>
                      <div className="text-muted small fw-semibold" style={{ fontSize: '0.74rem' }}>Total Stays</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="card shadow-sm border-0 p-2.5 p-md-3 text-center bg-white" style={{ borderRadius: '12px' }}>
                      <div className="text-success fw-bold fs-4 fs-md-3 mb-0 text-nowrap">{totalNightsCount}</div>
                      <div className="text-muted small fw-semibold" style={{ fontSize: '0.74rem' }}>Nights Booked</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className="card shadow-sm border-0 p-2.5 p-md-3 text-center bg-white" style={{ borderRadius: '12px' }}>
                      <div className="text-danger fw-bold fs-5 fs-md-3 mb-0 text-nowrap text-truncate" style={{ whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
                        ₱{totalActiveBalanceDue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-muted small fw-semibold" style={{ fontSize: '0.74rem' }}>Balance Due</div>
                    </div>
                  </div>
                </div>

                {/* ACTIVE STAY / STATUS CARDS */}
                {activeReservation && (
                  <div id="active-reservation-card" className="card shadow-sm border-0 border-start border-4 border-success p-3 mb-4 bg-white" style={{ borderRadius: '12px' }}>
                    <div>
                      {(activeReservation.status === 'On Hold' || activeReservation.status === 'Courtesy Hold' || Boolean(activeReservation.isCourtesyHold)) ? (
                        <span className="badge mb-1" style={{ backgroundColor: '#fd7e14', color: '#fff' }}>Courtesy Hold</span>
                      ) : (
                        <span className="badge bg-success text-white mb-1">Active Reservation Request</span>
                      )}
                      <h6 className="fw-bold mb-0 text-dark">Room {activeReservation.roomNumber} ({activeReservation.roomType})</h6>
                      <div className="small text-muted mb-1">Check-in: {formatDate(activeReservation.reservationDateTime)}</div>
                      {(activeReservation.status === 'On Hold' || activeReservation.status === 'Courtesy Hold' || Boolean(activeReservation.isCourtesyHold)) && (() => {
                        const holdInfo = getCourtesyHoldTimeInfo(activeReservation.holdExpiryDateTime);
                        return holdInfo && !holdInfo.expired ? (
                          <div className="small text-warning-emphasis fw-bold mb-2">
                            <i className="bi bi-hourglass-split me-1 text-warning"></i>
                            Hold expires in {holdInfo.text}
                          </div>
                        ) : null;
                      })()}
                      {renderReservationStatusTimeline(activeReservation.status)}
                    </div>
                    {/* Action buttons directly below statuses: Cancel on left, Proceed to Booking on right */}
                    <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top gap-2">
                      <button 
                        className="btn btn-sm btn-danger text-white fw-bold px-3 py-2 shadow-sm" 
                        onClick={() => handleCancelReservation(activeReservation.reservationID)}
                      >
                        {(activeReservation.status === 'On Hold' || activeReservation.status === 'Courtesy Hold' || Boolean(activeReservation.isCourtesyHold)) ? 'Cancel Hold' : 'Cancel'}
                      </button>
                      <button 
                        className="btn btn-sm btn-success text-white fw-bold px-3 py-2 shadow-sm d-inline-flex align-items-center justify-content-center" 
                        onClick={() => handleProceedToBooking(activeReservation)}
                      >
                        <i className="bi bi-calendar-check me-1"></i>Proceed to Booking
                      </button>
                    </div>
                  </div>
                )}

                {/* MY BOOKINGS HISTORY & STATUS TIMELINE ON DASHBOARD */}
                <div id="dashboard-bookings-history-section" className="card shadow-sm border-0 p-3 mb-4 bg-white" style={{ borderRadius: '12px' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                      <i className="bi bi-clock-history text-primary"></i>
                      <span>My Bookings History &amp; Status Timeline</span>
                    </h6>
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1" style={{ fontSize: '0.74rem' }}>
                      {bookings.length} Stay{bookings.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {bookings.length === 0 ? (
                    !resetBannerDismissed ? (
                      <div className="alert alert-info py-3 px-3 border-0 bg-info-subtle rounded-3 mb-0">
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div className="d-flex align-items-start gap-2">
                            <i className="bi bi-info-circle-fill text-info mt-0.5 fs-5"></i>
                            <div>
                              <div className="fw-bold text-dark mb-0.5">Your booking history has been cleared for testing purposes.</div>
                              <div className="small text-secondary">
                                You can now test new reservations or bookings with fresh ID sequences.
                              </div>
                            </div>
                          </div>
                          <button 
                            type="button" 
                            className="btn btn-sm btn-secondary text-white py-0.5 px-2.5 small"
                            style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                            onClick={() => {
                              try { sessionStorage.setItem('pcc_guest_reset_banner_dismissed', '1'); } catch (e) {}
                              setResetBannerDismissed(true);
                            }}
                          >
                            Dismiss Notice &times;
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted small">
                        <i className="bi bi-calendar-x fs-3 d-block mb-1 text-secondary opacity-50"></i>
                        <span>No booking records found. You can reserve or book a room using the quick actions below!</span>
                      </div>
                    )
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {bookings.map((b) => {
                        const isCheckedOut = b.status === 'Checked Out' || b.status === 'Completed' || b.status === 'Cancelled';
                        const remBal = isCheckedOut ? 0 : parseFloat(b.remainingBalance || 0);
                        return (
                          <div key={b.bookingID} className="card shadow-sm border mb-1 bg-white" style={{ borderRadius: '12px' }}>
                            <div className="card-body p-3">
                              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2 mb-2">
                                <div>
                                  <h5 className="card-title fw-bold text-dark mb-0">
                                    Room {b.roomNumber} — {b.roomType || 'Standard Room'}
                                  </h5>
                                  <div className="text-secondary font-monospace small" style={{ fontSize: '0.78rem' }}>
                                    Booking ID: #{formatBookingID(b.bookingID)} • User ID: #{guest.userID || guest.guestID}
                                  </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                  <StatusBadge status={b.status} />
                                </div>
                              </div>

                              <p className="card-text text-muted small mb-2">
                                <i className="bi bi-calendar-event me-1"></i> Check-in: <strong>{formatDate(b.checkInDateTime)}</strong> • Check-out: <strong>{formatDate(b.checkOutDateTime)}</strong>
                                {b.breakfastOption && (
                                  <span className="ms-2 badge bg-light text-dark border">
                                    {b.breakfastOption === 'without' ? 'No Breakfast' : 'With Breakfast'}
                                  </span>
                                )}
                              </p>

                              <div className="d-flex justify-content-between align-items-center py-2 px-3 bg-light rounded mb-2">
                                <span className="small text-muted fw-semibold">Billing Balance:</span>
                                <span className={`fw-bold fs-6 ${remBal > 0 ? 'text-danger' : 'text-success'}`}>
                                  ₱{remBal.toFixed(2)}
                                </span>
                              </div>

                              {/* TIMELINE */}
                              {renderBookingStatusTimeline(b.status)}

                              {/* INSPECTION STATUS BANNER */}
                              {['Checkout Requested', 'Pending Room Verification', 'Pending Checkout', 'Room Verified'].includes(b.status) && (
                                <div className="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 my-2 border-0 bg-warning-subtle text-warning-emphasis rounded-3">
                                  <span className="spinner-border spinner-border-sm flex-shrink-0" role="status"></span>
                                  <div>
                                    <strong>Room Inspection in Progress:</strong> Front desk and housekeeping staff are currently verifying your room condition and checking for incidental charges. Your final billing will be updated here shortly.
                                  </div>
                                </div>
                              )}

                              {/* ACTION BUTTONS */}
                              <div className="booking-card-actions mt-2">
                                <button 
                                  type="button" 
                                  className="btn btn-primary text-white"
                                  onClick={() => setViewBillingBooking(b)}
                                  aria-label="View Billing Breakdown"
                                >
                                  <i className="bi bi-receipt"></i> View Billing
                                </button>

                                {['Checked In', 'Checked-In', 'Active Stay'].includes(b.status) && (
                                  <button 
                                    type="button" 
                                    className="btn btn-secondary text-white"
                                    onClick={() => handleRequestCheckout(b)}
                                    aria-label="Request Checkout"
                                  >
                                    <i className="bi bi-box-arrow-right"></i> Request Checkout
                                  </button>
                                )}

                                {['Checkout Requested', 'Pending Room Verification', 'Pending Checkout', 'Room Verified'].includes(b.status) && (
                                  <button type="button" className="btn btn-warning text-dark" disabled aria-label="Awaiting Bill Finalization">
                                    <span className="spinner-border spinner-border-sm me-1" role="status"></span> Awaiting Bill Finalization
                                  </button>
                                )}

                                {['Bill Finalized', 'Final Billing Updated', 'Bill Ready'].includes(b.status) && (
                                  <button 
                                    type="button" 
                                    className="btn btn-primary fw-bold text-white shadow-sm"
                                    onClick={() => handleInitiatePay(b)}
                                    aria-label="Proceed to Payment"
                                  >
                                    <i className="bi bi-credit-card-2-front me-1"></i> Proceed to Payment
                                  </button>
                                )}

                                {['Paid', 'Payment Completed'].includes(b.status) && (
                                  <button type="button" className="btn btn-success text-white" disabled aria-label="Paid">
                                    <i className="bi bi-check2-all me-1"></i> Paid
                                  </button>
                                )}

                                {['Completed', 'Checked Out', 'Checked-Out'].includes(b.status) && (
                                  <button type="button" className="btn btn-secondary text-white" disabled aria-label="Completed">
                                    <i className="bi bi-check-circle me-1"></i> Completed
                                  </button>
                                )}

                                {normalizeBookingStatus(b.status) === 'Pending' && (
                                  <button 
                                    type="button" 
                                    className="btn btn-danger text-white" 
                                    onClick={() => handleCancelBooking(b.bookingID)}
                                    aria-label="Cancel Booking"
                                  >
                                    <i className="bi bi-x-circle"></i> Cancel
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* QUICK ACTION BUTTONS */}
                <h6 className="fw-bold text-dark mb-2.5">Quick Actions</h6>
                <div className="row g-2 mb-4">
                  <div className="col-6 col-md-3">
                    <button
                      className="btn btn-outline-primary fw-bold w-100 touch-action-btn shadow-sm py-2.5"
                      onClick={handleStartReserveFlow}
                    >
                      Reserve Room
                    </button>
                  </div>
                  <div className="col-6 col-md-3">
                    <button
                      className="btn btn-primary text-white fw-bold w-100 touch-action-btn shadow-sm py-2.5"
                      onClick={handleStartBookFlow}
                    >
                      Book Room
                    </button>
                  </div>
                  <div className="col-6 col-md-3">
                    <button
                      type="button"
                      className="btn btn-warning text-dark fw-bold w-100 touch-action-btn shadow-sm py-2.5 text-decoration-none d-flex align-items-center justify-content-center"
                      onClick={() => setActiveTab('orders')}
                    >
                      <span>Order Food</span>
                    </button>
                  </div>
                  <div className="col-6 col-md-3">
                    <button
                      className="btn btn-secondary text-white fw-bold w-100 touch-action-btn shadow-sm py-2.5"
                      onClick={() => setActiveTab('account')}
                    >
                      My Bookings
                    </button>
                  </div>
                </div>

                {/* ACTIVE PROMOTIONS & RECOMMENDED ROOMS */}
                <h6 className="fw-bold text-dark mb-2.5">Featured Rooms & Offers</h6>
                <div className="row g-3 mb-4">
                  {allRooms.slice(0, 4).map((rm) => (
                    <div key={rm.roomID} className="col-12 col-md-6 col-lg-3">
                      <div className="card shadow-sm border-0 h-100 room-card-hover overflow-hidden" style={{ borderRadius: '12px' }}>
                        {(() => {
                          const imgList = parseRoomImages(rm.image);
                          const roomPic = imgList.length > 0 ? imgList[0] : null;
                          if (!roomPic) {
                            return (
                              <div className="image-fallback d-flex flex-column align-items-center justify-content-center bg-light text-muted border-bottom" style={{ height: '140px', width: '100%', fontSize: '0.82rem', fontWeight: 600 }}>
                                <i className="bi bi-image fs-3 mb-1 opacity-50"></i>
                                <span>Image Unavailable</span>
                              </div>
                            );
                          }
                          return (
                            <div style={{ height: '140px', width: '100%', overflow: 'hidden', position: 'relative', backgroundColor: '#e2e8f0' }}>
                              <img
                                src={roomPic}
                                alt={`Room ${rm.roomNumber} - ${rm.roomType}`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                loading="lazy"
                                decoding="async"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget.parentElement?.querySelector('.image-fallback-err');
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                              <div className="image-fallback image-fallback-err flex-column align-items-center justify-content-center bg-light text-muted border-bottom" style={{ height: '140px', width: '100%', fontSize: '0.82rem', fontWeight: 600, display: 'none' }}>
                                <i className="bi bi-image fs-3 mb-1 opacity-50"></i>
                                <span>Image Unavailable</span>
                              </div>
                            </div>
                          );
                        })()}
                        <div className="card-body p-3">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <div>
                              <h6 className="fw-bold mb-0 text-dark">Room {rm.roomNumber}</h6>
                              <span className="small text-muted">{rm.floorName}</span>
                            </div>
                            <span className="fw-bold text-pcc-blue" style={{ fontSize: '1rem' }}>₱{parseFloat(rm.rate).toFixed(2)}/night</span>
                          </div>
                          <p className="small text-muted mb-3 text-truncate" title={rm.description || `${rm.roomType} • Max Occupancy: ${rm.occupancyLimit || 2} Pax`}>
                            {rm.description || `${rm.roomType} • Max Occupancy: ${rm.occupancyLimit || 2} Pax`}
                          </p>
                          <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-secondary text-white fw-bold w-50" onClick={() => handleOpenRoomDetails(rm)}>Details</button>
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
                    <h4 className="fw-bold text-dark mb-0">Rooms</h4>
                    <span className="text-muted small">Select any available room panel below to Reserve or Book your stay.</span>
                  </div>
                  <div>
                    <button
                      className="btn btn-sm text-white fw-bold d-flex align-items-center gap-1.5 shadow-sm"
                      onClick={fetchRoomsAndStatus}
                      title="Refresh rooms"
                      style={{ backgroundColor: 'var(--pcc-blue)', borderColor: 'var(--pcc-blue)', color: '#ffffff' }}
                    >
                      <i className="bi bi-arrow-clockwise"></i> Refresh
                    </button>
                  </div>
                </div>

                {/* SEARCH & FILTER BAR */}
                <div className="card shadow-sm border border-secondary-subtle p-3 mb-3 bg-white" style={{ borderRadius: '12px' }}>
                  <div className="row g-2 align-items-center">
                    <div className="col-12 col-md-4">
                      <div className="input-group input-group-sm">
                        <span className="input-group-text bg-light text-muted border-end-0"><i className="bi bi-search"></i></span>
                        <input
                          type="text"
                          className="form-control border-start-0"
                          placeholder="Search room number or type..."
                          value={roomSearchQuery}
                          onChange={(e) => setRoomSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-6 col-md-2.5">
                      <select
                        className="form-select form-select-sm"
                        value={selectedFloorFilter}
                        onChange={(e) => setSelectedFloorFilter(e.target.value)}
                      >
                        <option value="All">All Floors</option>
                        {Array.from(new Set(allRooms.map(r => r.floorName).filter(Boolean))).map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6 col-md-2.5">
                      <select
                        className="form-select form-select-sm"
                        value={selectedRoomTypeFilter}
                        onChange={(e) => setSelectedRoomTypeFilter(e.target.value)}
                      >
                        <option value="All">All Room Types</option>
                        {Array.from(new Set(allRooms.map(r => r.roomType).filter(Boolean))).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6 col-md-2">
                      <select
                        className="form-select form-select-sm"
                        value={selectedStatusFilter}
                        onChange={(e) => setSelectedStatusFilter(e.target.value)}
                      >
                        <option value="All">All Statuses</option>
                        <option value="Available">Available</option>
                        <option value="Occupied">Occupied</option>
                        <option value="Under Maintenance">Under Maintenance</option>
                        <option value="Booked">Booked / Reserved</option>
                      </select>
                    </div>
                    {(roomSearchQuery || selectedFloorFilter !== 'All' || selectedRoomTypeFilter !== 'All' || selectedStatusFilter !== 'All') && (
                      <div className="col-12 text-end mt-2">
                        <button
                          type="button"
                          className="btn btn-xs btn-danger text-white py-1 px-3 fw-bold"
                          onClick={() => {
                            setRoomSearchQuery('');
                            setSelectedFloorFilter('All');
                            setSelectedRoomTypeFilter('All');
                            setSelectedStatusFilter('All');
                          }}
                        >
                          Reset Filters
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {loadingRooms ? (
                  <div className="card shadow-sm border-0 p-5 text-center bg-white" style={{ borderRadius: '12px' }}>
                    <div className="spinner-border text-pcc-blue mx-auto mb-2" role="status"></div>
                    <p className="text-muted small mb-0">Loading rooms catalog...</p>
                  </div>
                ) : allRooms.length === 0 ? (
                  <div className="card shadow-sm border-0 p-5 text-center bg-white" style={{ borderRadius: '12px' }}>
                    <h6 className="fw-bold text-dark mb-1">No Rooms Available To Display</h6>
                    <p className="text-muted small mb-3">Click refresh to load the latest room status from server.</p>
                    <button className="btn btn-sm btn-pcc-primary text-white fw-bold mx-auto px-4 py-2" onClick={fetchRoomsAndStatus}>
                      Fetch Rooms Catalog
                    </button>
                  </div>
                ) : (
                  (() => {
                    const filteredRooms = allRooms.filter((rm) => {
                      const q = roomSearchQuery.trim().toLowerCase();
                      const matchesSearch = !q || rm.roomNumber.toLowerCase().includes(q) || (rm.roomType && rm.roomType.toLowerCase().includes(q));
                      const matchesFloor = selectedFloorFilter === 'All' || String(rm.floorName || '') === selectedFloorFilter;
                      const matchesType = selectedRoomTypeFilter === 'All' || String(rm.roomType || '') === selectedRoomTypeFilter;
                      const matchesStatus = selectedStatusFilter === 'All' || rm.status === selectedStatusFilter || (selectedStatusFilter === 'Booked' && (rm.status === 'Booked' || rm.status === 'Reserved'));
                      return matchesSearch && matchesFloor && matchesType && matchesStatus;
                    });

                    if (filteredRooms.length === 0) {
                      return (
                        <div className="card shadow-sm border border-secondary-subtle p-4 text-center bg-white" style={{ borderRadius: '12px' }}>
                          <p className="text-muted mb-0">No rooms match your selected search or filter criteria.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="row g-3">
                        {filteredRooms.map((rm) => {
                          const meta = getRoomStatusMeta(rm.status);
                          const isBookable = rm.status !== 'Under Maintenance' && rm.status !== 'Maintenance';

                          return (
                            <div key={rm.roomID} className="col-12 col-md-6 col-lg-4">
                              <div 
                                className={`card shadow-sm border border-secondary-subtle h-100 room-card-hover overflow-hidden ${isBookable ? 'cursor-pointer' : 'opacity-85'}`}
                                style={{
                                  borderRadius: '12px',
                                  backgroundColor: meta.bgColor,
                                  borderLeft: `5px solid ${meta.borderLeft} !important`
                                }}
                                onClick={() => {
                                  if (isBookable) {
                                    setSelectedRoom(rm);
                                    setFlowAction('book');
                                    setActiveModal('book_form');
                                  }
                                }}
                              >
                                {(() => {
                                  const imgList = parseRoomImages(rm.image);
                                  const roomPic = imgList.length > 0 ? imgList[0] : null;
                                  if (!roomPic) {
                                    return (
                                      <div className="image-fallback d-flex flex-column align-items-center justify-content-center bg-light text-muted border-bottom" style={{ height: '140px', width: '100%', fontSize: '0.82rem', fontWeight: 600 }}>
                                        <i className="bi bi-image fs-3 mb-1 opacity-50"></i>
                                        <span>Image Unavailable</span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div style={{ height: '140px', width: '100%', overflow: 'hidden', position: 'relative', backgroundColor: '#e2e8f0' }}>
                                      <img
                                        src={roomPic}
                                        alt={`Room ${rm.roomNumber} - ${rm.roomType}`}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        loading="lazy"
                                        decoding="async"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          const fallback = e.currentTarget.parentElement?.querySelector('.image-fallback-err');
                                          if (fallback) fallback.style.display = 'flex';
                                        }}
                                      />
                                      <div className="image-fallback image-fallback-err flex-column align-items-center justify-content-center bg-light text-muted border-bottom" style={{ height: '140px', width: '100%', fontSize: '0.82rem', fontWeight: 600, display: 'none' }}>
                                        <i className="bi bi-image fs-3 mb-1 opacity-50"></i>
                                        <span>Image Unavailable</span>
                                      </div>
                                    </div>
                                  );
                                })()}
                                <div className="card-body p-3 d-flex flex-column">
                                  <div className="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                      <h5 className="fw-bold mb-0 text-dark">Room {rm.roomNumber}</h5>
                                      <div className="text-muted small">{rm.roomType} • {rm.floorName || 'Ground Floor'}</div>
                                    </div>
                                    <span className={`badge ${meta.badgeClass} px-2.5 py-1.5`} style={{ fontSize: '0.78rem' }}>
                                      {meta.label}
                                    </span>
                                  </div>

                                  <div className="my-2.5 p-3 rounded border small room-rate-panel" style={{ padding: '0.75rem 0.95rem' }}>
                                    <div className="d-flex justify-content-between mb-1.5 py-0.5">
                                      <span className="text-muted">Max Occupancy:</span>
                                      <strong className="text-dark">Up to {rm.occupancyLimit || 2} Pax</strong>
                                    </div>
                                    <div className="d-flex justify-content-between mb-1.5 py-0.5">
                                      <span className="text-muted">Without Breakfast:</span>
                                      <strong className="text-dark">₱{parseFloat(rm.rateWithoutBreakfast || rm.rate || 0).toFixed(2)}</strong>
                                    </div>
                                    <div className="d-flex justify-content-between mb-1.5 py-0.5">
                                      <span className="text-muted">With Breakfast:</span>
                                      <strong className="text-pcc-blue fw-bold">₱{parseFloat(rm.rateWithBreakfast || (rm.breakfastRate !== null && rm.breakfastRate !== undefined ? parseFloat(rm.rate || 0) + parseFloat(rm.breakfastRate) : parseFloat(rm.rate || 0))).toFixed(2)}</strong>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center pt-1.5 mt-1 border-top">
                                      <span className="text-muted">Breakfast Rate:</span>
                                      {rm.breakfastRate !== null && rm.breakfastRate !== undefined && parseFloat(rm.breakfastRate) === 0 ? (
                                        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-0.5">
                                          <i className="bi bi-cup-hot me-1"></i>Free / Included
                                        </span>
                                      ) : (
                                        <span className="text-success fw-bold">
                                          ₱{parseFloat(
                                            rm.breakfastRate !== null && rm.breakfastRate !== undefined
                                              ? rm.breakfastRate
                                              : (rm.rateWithBreakfast && rm.rateWithoutBreakfast ? parseFloat(rm.rateWithBreakfast) - parseFloat(rm.rateWithoutBreakfast) : 0)
                                          ).toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-auto pt-3 d-flex gap-2.5 align-items-center" style={{ gap: '8px' }}>
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-secondary text-white fw-bold py-2 px-2.5 shadow-xs"
                                      onClick={(e) => { e.stopPropagation(); handleOpenRoomDetails(rm); }}
                                      style={{ fontSize: '0.78rem', borderRadius: '6px' }}
                                      aria-label={`View details for Room ${rm.roomNumber}`}
                                    >
                                      Details
                                    </button>
                                    {isBookable ? (
                                      <>
                                        <button
                                          type="button"
                                          className="btn btn-xs btn-success text-white fw-bold py-2 px-2.5 flex-grow-1 shadow-xs"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedRoom(rm);
                                            setFlowAction('reserve');
                                            handleCheckInDateChange(minReserveDateStr);
                                            setActiveModal('reserve_form');
                                          }}
                                          style={{ fontSize: '0.78rem', borderRadius: '6px' }}
                                          aria-label={`Reserve Room ${rm.roomNumber}`}
                                        >
                                          Reserve
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-xs btn-primary text-white fw-bold py-2 px-2.5 flex-grow-1 shadow-xs"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedRoom(rm);
                                            setFlowAction('book');
                                            handleCheckInDateChange(minBookDateStr);
                                            setActiveModal('book_form');
                                          }}
                                          style={{ fontSize: '0.78rem', borderRadius: '6px' }}
                                          aria-label={`Book Room ${rm.roomNumber}`}
                                        >
                                          Book
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn btn-xs btn-secondary text-white py-2 px-2.5 flex-grow-1"
                                        disabled
                                        style={{ fontSize: '0.78rem', borderRadius: '6px' }}
                                        aria-label={`Room ${rm.roomNumber} is ${meta.label}`}
                                      >
                                        {meta.label}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* TAB: ORDERS TAB */}
            {activeTab === 'orders' && (
              <GuestOrdersContent guest={guest} activeBookingStay={activeBookingStay} initialCategory="all" />
            )}

            {/* TAB 3: CHAT TAB */}
            {activeTab === 'chat' && (
              <div className="animate__animated animate__fadeIn">
                <div className="card shadow-sm border-0 p-3 mb-3 bg-white" style={{ borderRadius: '12px' }}>
                  <h5 className="fw-bold mb-1 text-dark">Inquiry & Live Chat Workspace</h5>
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
                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2 mb-3">
                  <div>
                    <h4 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                      <i className="bi bi-bell-fill text-primary"></i> Notifications
                    </h4>
                    <span className="text-muted small">Stay updated on your stay reservations, bookings, and room orders. Click any notification to view details.</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    {unreadCount > 0 && (
                      <span className="badge bg-danger rounded-pill px-3 py-1.5">{unreadCount} Unread</span>
                    )}
                    {unreadCount > 0 && (
                      <button
                        className="btn btn-sm btn-primary text-white rounded-pill px-3 py-1.5 fw-bold shadow-xs"
                        onClick={handleMarkAllNotificationsRead}
                        style={{ fontSize: '0.78rem' }}
                      >
                        Mark All as Read
                      </button>
                    )}
                  </div>
                </div>

                {notifications.length === 0 ? (
                  <div className="card shadow-sm border-0 p-5 text-center text-muted bg-white" style={{ borderRadius: '16px' }}>
                    <i className="bi bi-bell-slash text-secondary display-3 mb-2 opacity-50"></i>
                    <h6 className="fw-bold text-dark mb-1">No notifications yet</h6>
                    <p className="mb-0 small">Real-time alerts regarding your room reservations, bookings, and orders will appear here.</p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {notifications.map((n) => (
                      <div
                        key={n.notificationID}
                        onClick={() => handleNotificationClick(n)}
                        className={`card shadow-sm border-0 transition-all ${
                          !n.isRead ? 'border-start border-4 border-pcc-blue bg-light' : 'bg-white text-muted'
                        }`}
                        style={{
                          borderRadius: '14px',
                          cursor: 'pointer',
                          padding: '1.25rem 1.5rem',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                          boxShadow: !n.isRead ? '0 4px 14px rgba(33, 85, 181, 0.08)' : '0 2px 6px rgba(0,0,0,0.03)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = !n.isRead ? '0 4px 14px rgba(33, 85, 181, 0.08)' : '0 2px 6px rgba(0,0,0,0.03)';
                        }}
                      >
                        <div className="d-flex align-items-center justify-content-between gap-3">
                          <div className="d-flex align-items-start flex-grow-1 min-w-0" style={{ gap: '1rem' }}>
                            <div
                              className="rounded-circle d-flex align-items-center justify-content-center bg-white shadow-xs flex-shrink-0"
                              style={{ width: '44px', height: '44px', border: '1px solid #e2e8f0' }}
                            >
                              <i className={`bi ${getNotificationIcon(n.title)} fs-5`}></i>
                            </div>
                            <div className="flex-grow-1 min-w-0">
                              <div className="d-flex flex-wrap justify-content-between align-items-center gap-1 mb-1">
                                <div className="d-flex align-items-center gap-2">
                                  <h6 className={`fw-bold mb-0 ${!n.isRead ? 'text-dark' : 'text-secondary'}`} style={{ fontSize: '0.94rem' }}>
                                    {n.title}
                                  </h6>
                                  {!n.isRead && (
                                    <span className="badge bg-primary text-white rounded-pill px-2 py-0.5" style={{ fontSize: '0.65rem' }}>NEW</span>
                                  )}
                                </div>
                                <span className="text-muted" style={{ fontSize: '0.74rem' }}>
                                  {new Date(n.createdAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </div>
                              <p className="text-secondary small mb-0" style={{ lineHeight: '1.5', fontSize: '0.84rem' }}>{n.message}</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-muted ps-2 d-none d-sm-flex align-items-center gap-1" style={{ fontSize: '0.78rem' }}>
                            <span className="text-primary fw-semibold">View</span>
                            <i className="bi bi-chevron-right fs-6 text-primary"></i>
                          </div>
                        </div>
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
                <div className="card profile-card shadow-sm border-0 p-4 mb-4 bg-white" style={{ borderRadius: '16px' }}>
                  <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3 mb-3">
                    <div className="d-flex align-items-center gap-3">
                      {guest?.profilePicture ? (
                        <img
                          src={guest.profilePicture}
                          alt={`${guest.firstName || 'Guest'} Avatar`}
                          className="profile-avatar-img shadow-sm"
                          style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '50%', border: '2px solid var(--pcc-blue)', flexShrink: 0 }}
                        />
                      ) : (
                        <div
                          className="profile-avatar-initial shadow-sm flex-shrink-0"
                          style={{ width: '64px', height: '64px', fontSize: '1.6rem' }}
                        >
                          {guest?.firstName ? guest.firstName.charAt(0).toUpperCase() : 'G'}
                        </div>
                      )}
                      <div>
                        <h5 className="fw-bold mb-1 text-dark">{guest.firstName} {guest.lastName}</h5>
                        <p className="text-muted mb-0">UserID: #{guest.userID || guest.guestID}</p>
                      </div>
                    </div>
                    <span className="badge bg-success text-white px-3 py-1.5 rounded-pill">Active Guest</span>
                  </div>

                  <table className="table table-borderless table-sm small mb-0">
                    <tbody>
                      <tr>
                        <td className="text-muted" style={{ width: '120px' }}>User ID:</td>
                        <td className="fw-bold text-pcc-blue font-monospace">#{guest.userID || guest.guestID}</td>
                      </tr>
                      <tr>
                        <td className="text-muted" style={{ width: '120px' }}>Contact:</td>
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

                {/* EDIT PROFILE SETTINGS BUTTON */}
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setEditProfileForm({
                        firstName: guest.firstName || '',
                        middleName: guest.middleName || '',
                        lastName: guest.lastName || '',
                        contact: guest.contact || '',
                        gender: guest.gender || 'Other',
                        city: guest.city || '',
                        province: guest.province || '',
                        profilePicture: guest.profilePicture || ''
                      });
                      setShowEditProfileModal(true);
                    }}
                    className="btn btn-pcc-primary text-white w-100 text-start p-3 fw-bold d-flex justify-content-between align-items-center shadow-sm"
                    style={{ borderRadius: '12px' }}
                  >
                    <span className="d-flex align-items-center gap-2">
                      <i className="bi bi-person-lines-fill"></i>
                      <span>Edit Profile Settings</span>
                    </span>
                    <i className="bi bi-pencil-square"></i>
                  </button>
                </div>

                {/* THEME & APPEARANCE SETTINGS CARD */}
                <div className="card shadow-sm border-0 p-4 mb-4 bg-white" style={{ borderRadius: '14px', padding: '1.25rem 1.5rem' }}>
                  <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3 gap-md-4">
                    <div className="flex-grow-1 pe-sm-3">
                      <h6 className="fw-bold text-dark mb-1.5 d-flex align-items-center gap-2 fs-6">
                        <i className="bi bi-moon-stars-fill text-primary"></i> Theme &amp; Display Setup
                      </h6>
                      <p className="text-muted small mb-0 lh-base">
                        Switch between Light Mode and Night Mode for comfortable viewing across devices.
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <ThemeToggle />
                    </div>
                  </div>
                </div>

                {/* MY RESERVATIONS HISTORY */}
                <div id="reservations-history-section" className="card shadow-sm border-0 p-3 mb-4 bg-white" style={{ borderRadius: '12px' }}>
                  <h6 className="fw-bold text-dark mb-3">My Reservations History &amp; Status Timeline</h6>
                  {reservations.length === 0 ? (
                    <p className="text-muted small mb-0">No reservation records found.</p>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {reservations.map((r) => {
                        const isHold = r.status === 'Courtesy Hold';
                        const holdInfo = isHold ? getCourtesyHoldTimeInfo(r.holdExpiryDateTime) : null;

                        return (
                          <div key={r.reservationID} id={`reservation-item-${r.reservationID}`} className="p-3 border rounded bg-light">
                            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2 mb-2">
                              <div>
                                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                  <h6 className="fw-bold mb-0 text-dark">
                                    Reservation #{formatReservationID(r.reservationID)} — Room {r.roomNumber} ({r.roomType || 'Room'})
                                  </h6>
                                  {isHold ? (
                                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#fff' }} aria-label="Courtesy Hold Status">
                                      Courtesy Hold
                                    </span>
                                  ) : r.status === 'Released' ? (
                                    <span className="badge bg-secondary text-white" aria-label="Hold Released Status">
                                      Hold Released
                                    </span>
                                  ) : null}
                                </div>
                                <span className="small text-muted d-block">
                                  Check-in Date: <strong>{formatDate(r.reservationDateTime)}</strong>
                                </span>

                                {/* Countdown Timer */}
                                {isHold && holdInfo && !holdInfo.inGrace && !holdInfo.expired && (
                                  <p className="text-warning-emphasis small mb-1 fw-bold d-flex align-items-center gap-1.5 mt-1" role="timer" aria-label="Courtesy Hold Expiration">
                                    <i className="bi bi-hourglass-split text-warning"></i>
                                    Courtesy Hold expires in {holdInfo.text}
                                  </p>
                                )}

                                {/* Explicit 30-Minute Grace Window Alert Banner */}
                                {isHold && holdInfo && holdInfo.inGrace && (
                                  <div className="alert alert-warning py-1.5 px-3 small mb-2 mt-1.5 fw-bold d-flex align-items-center gap-2 border border-warning" role="alert" aria-label="Courtesy Hold Grace Period Active">
                                    <i className="bi bi-exclamation-triangle-fill text-danger fs-6"></i>
                                    <span>
                                      Final 30-Minute Grace Window: Your hold expired, but is temporarily held for {holdInfo.graceMins} more minute{holdInfo.graceMins !== 1 ? 's' : ''}. Complete payment now before auto-release!
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {renderReservationStatusTimeline(r.status)}
                            {/* Action buttons directly below statuses: Cancel on left, Proceed to Booking on right */}
                            {(() => {
                              const normR = normalizeReservationStatus(r.status);
                              const canProceed = !['Booked', 'Cancelled'].includes(normR);
                              if (!canProceed) return null;
                              return (
                                <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top gap-2">
                                  <button
                                    className="btn btn-sm btn-danger text-white fw-bold px-3 py-2 shadow-sm"
                                    onClick={() => handleCancelReservation(r.reservationID)}
                                    title={isHold ? "Cancel Courtesy Hold" : "Cancel Reservation"}
                                    aria-label={isHold ? "Cancel Courtesy Hold" : "Cancel Reservation"}
                                  >
                                    {isHold ? "Cancel Hold" : "Cancel"}
                                  </button>
                                  <button
                                    className="btn btn-sm btn-success text-white fw-bold px-3 py-2 shadow-sm"
                                    onClick={() => handleProceedToBooking(r)}
                                    title="Proceed to Booking with Down Payment"
                                    aria-label="Proceed to Booking"
                                  >
                                    <i className="bi bi-calendar-check me-1"></i>
                                    Proceed to Booking
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* MY BOOKINGS HISTORY */}
                <div id="bookings-history-section" className="card shadow-sm border-0 p-3 mb-4 bg-white" style={{ borderRadius: '12px' }}>
                  <h6 className="fw-bold text-dark mb-3">My Bookings History &amp; Status Timeline</h6>
                  {bookings.length === 0 ? (
                    !resetBannerDismissed ? (
                      <div className="alert alert-info py-3 px-3 border-0 bg-info-subtle rounded-3 mb-0">
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div className="d-flex align-items-start gap-2">
                            <i className="bi bi-info-circle-fill text-info mt-0.5 fs-5"></i>
                            <div>
                              <div className="fw-bold text-dark mb-0.5">Your booking history has been cleared for testing purposes.</div>
                              <div className="small text-secondary">
                                You can now test new reservations or bookings with fresh ID sequences.
                              </div>
                            </div>
                          </div>
                          <button 
                            type="button" 
                            className="btn btn-sm btn-secondary text-white py-0.5 px-2.5 small"
                            style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                            onClick={() => {
                              try { sessionStorage.setItem('pcc_guest_reset_banner_dismissed', '1'); } catch (e) {}
                              setResetBannerDismissed(true);
                            }}
                          >
                            Dismiss Notice &times;
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted small mb-0">No booking records found.</p>
                    )
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {bookings.map((b) => {
                        const isCheckedOut = b.status === 'Checked Out' || b.status === 'Completed' || b.status === 'Cancelled';
                        const remBal = isCheckedOut ? 0 : parseFloat(b.remainingBalance || 0);
                        return (
                          <div key={b.bookingID} className="card shadow-sm border mb-3 bg-white" style={{ borderRadius: '12px' }}>
                            <div className="card-body p-3">
                              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start gap-2 mb-2">
                                <div>
                                  <h5 className="card-title fw-bold text-dark mb-0">
                                    Room {b.roomNumber} — {b.roomType || 'Standard Room'}
                                  </h5>
                                  <div className="text-secondary font-monospace small" style={{ fontSize: '0.78rem' }}>
                                    Booking ID: #{formatBookingID(b.bookingID)} • User ID: #{guest.userID || guest.guestID}
                                  </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                  <StatusBadge status={b.status} />
                                </div>
                              </div>

                              <p className="card-text text-muted small mb-2">
                                <i className="bi bi-calendar-event me-1"></i> Check-in: <strong>{formatDate(b.checkInDateTime)}</strong> • Check-out: <strong>{formatDate(b.checkOutDateTime)}</strong>
                              </p>

                              <div className="d-flex justify-content-between align-items-center py-2 px-3 bg-light rounded mb-2">
                                <span className="small text-muted fw-semibold">Billing Balance:</span>
                                <span className={`fw-bold fs-6 ${remBal > 0 ? 'text-danger' : 'text-success'}`}>
                                  ₱{remBal.toFixed(2)}
                                </span>
                              </div>

                              {/* TIMELINE */}
                              {renderBookingStatusTimeline(b.status)}

                              {/* INSPECTION STATUS BANNER */}
                              {['Checkout Requested', 'Pending Room Verification', 'Pending Checkout', 'Room Verified'].includes(b.status) && (
                                <div className="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 my-2 border-0 bg-warning-subtle text-warning-emphasis rounded-3">
                                  <span className="spinner-border spinner-border-sm flex-shrink-0" role="status"></span>
                                  <div>
                                    <strong>Room Inspection in Progress:</strong> Front desk and housekeeping staff are currently verifying your room condition and checking for incidental charges. Your final billing will be updated here shortly.
                                  </div>
                                </div>
                              )}

                              {/* ACTION BUTTONS */}
                              <div className="booking-card-actions">
                                <button 
                                  type="button" 
                                  className="btn btn-primary text-white"
                                  onClick={() => setViewBillingBooking(b)}
                                  aria-label="View Billing Breakdown"
                                >
                                  <i className="bi bi-receipt"></i> View Billing
                                </button>

                                {['Checked In', 'Checked-In', 'Active Stay'].includes(b.status) && (
                                  <button 
                                    type="button" 
                                    className="btn btn-secondary text-white"
                                    onClick={() => handleRequestCheckout(b)}
                                    aria-label="Request Checkout"
                                  >
                                    <i className="bi bi-box-arrow-right"></i> Request Checkout
                                  </button>
                                )}

                                {['Checkout Requested', 'Pending Room Verification', 'Pending Checkout', 'Room Verified'].includes(b.status) && (
                                  <button type="button" className="btn btn-warning text-dark" disabled aria-label="Awaiting Bill Finalization">
                                    <span className="spinner-border spinner-border-sm me-1" role="status"></span> Awaiting Bill Finalization
                                  </button>
                                )}

                                {['Bill Finalized', 'Final Billing Updated', 'Bill Ready'].includes(b.status) && (
                                  <button 
                                    type="button" 
                                    className="btn btn-primary fw-bold text-white shadow-sm"
                                    onClick={() => handleInitiatePay(b)}
                                    aria-label="Proceed to Payment"
                                  >
                                    <i className="bi bi-credit-card-2-front me-1"></i> Proceed to Payment
                                  </button>
                                )}

                                {['Paid', 'Payment Completed'].includes(b.status) && (
                                  <button type="button" className="btn btn-success text-white" disabled aria-label="Paid">
                                    <i className="bi bi-check2-all me-1"></i> Paid
                                  </button>
                                )}

                                {['Completed', 'Checked Out', 'Checked-Out'].includes(b.status) && (
                                  <button type="button" className="btn btn-secondary text-white" disabled aria-label="Completed">
                                    <i className="bi bi-check-circle me-1"></i> Completed
                                  </button>
                                )}

                                {normalizeBookingStatus(b.status) === 'Pending' && (
                                  <button 
                                    type="button" 
                                    className="btn btn-danger text-white" 
                                    onClick={() => handleCancelBooking(b.bookingID)}
                                    aria-label="Cancel Booking"
                                  >
                                    <i className="bi bi-x-circle"></i> Cancel
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ACCOUNT ACTION BUTTONS */}
                <div className="d-flex flex-column gap-2 mb-4">
                  <button onClick={() => setShowLogoutModal(true)} className="btn btn-danger text-white text-start p-3 fw-bold d-flex justify-content-between align-items-center" style={{ borderRadius: '10px' }}>
                    <span><i className="bi bi-power me-2"></i> Log Out</span>
                    <i className="bi bi-box-arrow-right"></i>
                  </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
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
        bottomOffset={isDesktop ? '24px' : (activeTab === 'orders' ? '135px' : '85px')}
      />



      {/* VIEW BILLING BREAKDOWN MODAL */}
      {viewBillingBooking && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '14px' }}>
              <div className="modal-header text-white" style={{ backgroundColor: 'var(--pcc-blue, #0d6efd)' }}>
                <div>
                  <h5 className="modal-title fw-bold mb-0">Billing Breakdown — Room {viewBillingBooking.roomNumber}</h5>
                  <div className="small opacity-75 font-monospace">Stay #{viewBillingBooking.bookingID} • {viewBillingBooking.roomType || 'Room'}</div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setViewBillingBooking(null)}></button>
              </div>
              <div className="modal-body p-3 p-md-4" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                {/* Stay Summary Card */}
                <div className="p-3 bg-light rounded border mb-3">
                  <div className="row g-2 small">
                    <div className="col-sm-6">
                      <span className="text-muted d-block">Scheduled Stay:</span>
                      <strong>{formatDate(viewBillingBooking.checkInDateTime)} &rarr; {formatDate(viewBillingBooking.checkOutDateTime)}</strong>
                    </div>
                    <div className="col-sm-6">
                      <span className="text-muted d-block">Current Status:</span>
                      <span className={`booking-status-pill ${getStatusBadgeClass(viewBillingBooking.status)}`}>
                        {viewBillingBooking.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Itemized Room Charges */}
                <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                  <i className="bi bi-door-open-fill text-primary"></i> Room Charges
                </h6>
                <div className="table-responsive mb-3">
                  <table className="table table-sm table-bordered align-middle small mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Item Description</th>
                        <th className="text-end" style={{ width: '120px' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Room Rate ({viewBillingBooking.roomType || 'Standard'})</td>
                        <td className="text-end fw-semibold">
                          ₱{parseFloat(
                            viewBillingBooking.billingDetails?.chargesBreakdown?.room?.rate ||
                            viewBillingBooking.billingDetails?.roomChargeSummary?.baseRoomCharge ||
                            viewBillingBooking.billingDetails?.rate ||
                            viewBillingBooking.rate ||
                            0
                          ).toFixed(2)}
                        </td>
                      </tr>
                      {(viewBillingBooking.billingDetails?.chargesBreakdown?.room?.breakfastOption === 'with' || viewBillingBooking.breakfastOption === 'with' || viewBillingBooking.billingDetails?.roomChargeSummary?.breakfastOption === 'with') && (
                        <tr>
                          <td>Breakfast Package (Included with Stay)</td>
                          <td className="text-end text-success fw-semibold">Included</td>
                        </tr>
                      )}
                      {parseFloat(viewBillingBooking.billingDetails?.roomChargeSummary?.totalDiscount || 0) > 0 && (
                        <tr>
                          <td className="text-success">Discount Applied</td>
                          <td className="text-end text-success fw-semibold">
                            -₱{parseFloat(viewBillingBooking.billingDetails.roomChargeSummary.totalDiscount).toFixed(2)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Itemized Incidental Charges */}
                <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                  <i className="bi bi-shield-check text-warning"></i> Incidental &amp; Extra Charges
                </h6>
                <div className="table-responsive mb-3">
                  <table className="table table-sm table-bordered align-middle small mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Fee Description</th>
                        <th className="text-end" style={{ width: '120px' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!viewBillingBooking.incidentals || viewBillingBooking.incidentals.length === 0) ? (
                        <tr>
                          <td colSpan="2" className="text-center text-muted py-2">No incidental charges added.</td>
                        </tr>
                      ) : (
                        viewBillingBooking.incidentals.map((inc, idx) => (
                          <tr key={inc.chargeID || idx}>
                            <td>
                              <div>{inc.description}</div>
                              {inc.createdAt && <span className="text-muted" style={{ fontSize: '0.72rem' }}>{inc.createdAt}</span>}
                            </td>
                            <td className="text-end fw-semibold text-danger">₱{parseFloat(inc.amount).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Room Service / Orders if present */}
                {viewBillingBooking.billingDetails?.productCharges?.length > 0 && (
                  <>
                    <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                      <i className="bi bi-cup-hot-fill text-success"></i> Room Service &amp; Store Orders
                    </h6>
                    <div className="table-responsive mb-3">
                      <table className="table table-sm table-bordered align-middle small mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Item</th>
                            <th className="text-center" style={{ width: '60px' }}>Qty</th>
                            <th className="text-end" style={{ width: '120px' }}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewBillingBooking.billingDetails.productCharges.map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.name} {item.isFreeBreakfast && <span className="badge bg-success-subtle text-success ms-1">Package</span>}</td>
                              <td className="text-center">{item.quantity}</td>
                              <td className="text-end fw-semibold">₱{parseFloat(item.subtotal || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Payment History Breakdown */}
                <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                  <i className="bi bi-cash-stack text-success"></i> Payments Recorded
                </h6>
                <div className="table-responsive mb-3">
                  <table className="table table-sm table-bordered align-middle small mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Payment Detail</th>
                        <th>Method</th>
                        <th className="text-end" style={{ width: '120px' }}>Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!viewBillingBooking.billingDetails?.paymentsList || viewBillingBooking.billingDetails.paymentsList.length === 0) ? (
                        <tr>
                          <td colSpan="3" className="text-center text-muted py-2">No payments recorded yet.</td>
                        </tr>
                      ) : (
                        viewBillingBooking.billingDetails.paymentsList.map((p, idx) => (
                          <tr key={p.paymentID || idx}>
                            <td>Payment #{p.paymentID} <span className="text-muted small">({p.paymentDate})</span></td>
                            <td>{p.paymentMethod || 'GCash'}</td>
                            <td className="text-end fw-semibold text-success">₱{parseFloat(p.amount).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Balance Summary Box */}
                <div className="p-3 bg-light rounded border">
                  <div className="d-flex justify-content-between mb-1 small">
                    <span className="text-muted">Total Charges:</span>
                    <strong className="text-dark">
                      ₱{parseFloat(viewBillingBooking.billingDetails?.totalAmount || viewBillingBooking.rate || 0).toFixed(2)}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1 small">
                    <span className="text-muted">Total Payments Made:</span>
                    <strong className="text-success">
                      ₱{parseFloat(viewBillingBooking.billingDetails?.paidTotal || 0).toFixed(2)}
                    </strong>
                  </div>
                  <hr className="my-2" />
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-dark">Remaining Final Balance:</span>
                    <span className={`fw-bold fs-5 ${parseFloat(viewBillingBooking.remainingBalance || 0) > 0 ? 'text-danger' : 'text-success'}`}>
                      ₱{parseFloat(viewBillingBooking.remainingBalance || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light border-top">
                <button type="button" className="btn btn-secondary" onClick={() => setViewBillingBooking(null)}>
                  Close
                </button>
                {normalizeBookingStatus(viewBillingBooking.status) === 'Bill Ready' && parseFloat(viewBillingBooking.remainingBalance || 0) > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary fw-bold px-4 text-white shadow-sm"
                    aria-label="Proceed to Payment"
                    onClick={() => {
                      const target = viewBillingBooking;
                      setViewBillingBooking(null);
                      handleInitiatePay(target);
                    }}
                  >
                    <i className="bi bi-credit-card-2-front me-1"></i> Proceed to Payment
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WORKFLOW: ROOM DETAILS MODAL */}
      {activeModal === 'room_details' && selectedRoom && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ backgroundColor: '#2155B5' }}>
                <h5 className="modal-title fw-bold">Room {selectedRoom.roomNumber} Details</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal('none')}></button>
              </div>
              <div className="modal-body p-0">
                <div className="position-relative overflow-hidden" style={{ borderRadius: '0', maxHeight: '220px' }}>
                  <RoomImageCarousel
                    images={parseRoomImages(selectedRoom.image)}
                    fallbackImg={null}
                    alt={`Room ${selectedRoom.roomNumber}`}
                    height="200px"
                  />
                </div>

                <div className="p-3">
                  <div className="p-3 bg-light rounded text-center mb-3">
                    <h4 className="fw-bold text-pcc-blue mb-1">Room {selectedRoom.roomNumber} ({selectedRoom.roomType})</h4>
                    <div className="text-muted small">Floor: {selectedRoom.floorName}</div>
                  </div>

                <div className="p-3 border rounded mb-3 room-rate-panel" style={{ fontSize: '0.88rem', padding: '0.85rem 1rem' }}>
                  <div className="d-flex justify-content-between mb-1.5 py-0.5">
                    <span className="text-muted">Rate Without Breakfast:</span>
                    <strong className="text-dark">₱{parseFloat(selectedRoom.rateWithoutBreakfast || selectedRoom.rate).toFixed(2)} / night</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1.5 py-0.5">
                    <span className="text-muted">Rate With Breakfast:</span>
                    <strong className="text-pcc-blue fw-bold">₱{parseFloat(selectedRoom.rateWithBreakfast || (selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined ? parseFloat(selectedRoom.rate) + parseFloat(selectedRoom.breakfastRate) : parseFloat(selectedRoom.rate))).toFixed(2)} / night</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1.5 py-0.5">
                    <span className="text-muted">Breakfast Add-on Rate:</span>
                    {selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined && parseFloat(selectedRoom.breakfastRate) === 0 ? (
                      <strong className="text-success"><i className="bi bi-cup-hot me-1"></i>Breakfast Included (Free)</strong>
                    ) : (
                      <strong className="text-success">
                        ₱{parseFloat(
                          selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined
                            ? selectedRoom.breakfastRate
                            : (selectedRoom.rateWithBreakfast && selectedRoom.rateWithoutBreakfast ? parseFloat(selectedRoom.rateWithBreakfast) - parseFloat(selectedRoom.rateWithoutBreakfast) : 0)
                        ).toFixed(2)}
                      </strong>
                    )}
                  </div>
                  <div className="d-flex justify-content-between mb-1.5 py-0.5">
                    <span className="text-muted">Maximum Occupancy:</span>
                    <strong className="text-dark">Up to {selectedRoom.occupancyLimit} Pax</strong>
                  </div>
                  <div className="d-flex justify-content-between py-0.5">
                    <span className="text-muted">Status:</span>
                    <span className={`badge ${selectedRoom.status === 'Available' ? 'bg-success' : 'bg-secondary'}`}>{selectedRoom.status}</span>
                  </div>
                </div>

                {selectedRoom.description ? (
                  <div className="p-3 bg-light rounded border mb-0">
                    <h6 className="fw-bold text-dark mb-1">Room Description</h6>
                    <p className="small text-muted mb-0" style={{ whiteSpace: 'pre-line' }}>{selectedRoom.description}</p>
                  </div>
                ) : null}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary text-white fw-bold" onClick={() => setActiveModal('none')}>Close</button>
                {selectedRoom.status === 'Available' && (
                  <button type="button" className="btn btn-primary text-white fw-bold" onClick={() => { setActiveModal('none'); handleStartBookFlow(); }}>
                    Book Room Now
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
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ backgroundColor: isCourtesyHold ? '#fd7e14' : '#198754' }}>
                <h5 className="modal-title fw-bold">
                  {isCourtesyHold ? 'Courtesy Hold Reservation Form' : 'Reservation Request Form'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal('none')}></button>
              </div>
              <form onSubmit={handleCreateReservation}>
                <div className="modal-body">
                  <div className="p-3 bg-light rounded border mb-3">
                    <h6 className="fw-bold text-success mb-1">Room {selectedRoom.roomNumber} ({selectedRoom.roomType})</h6>
                    <div className="small text-muted">Floor: {selectedRoom.floorName} • Without Bfast: ₱{parseFloat(selectedRoom.rateWithoutBreakfast || selectedRoom.rate).toFixed(2)} • With Bfast: ₱{parseFloat(selectedRoom.rateWithBreakfast || (selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined ? parseFloat(selectedRoom.rate) + parseFloat(selectedRoom.breakfastRate) : parseFloat(selectedRoom.rate))).toFixed(2)}/night</div>
                    <div className="small text-success fw-semibold mt-1">
                      {selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined && parseFloat(selectedRoom.breakfastRate) === 0 ? (
                        <span><i className="bi bi-cup-hot me-1"></i>Breakfast Included (Free)</span>
                      ) : (
                        <span>
                          Breakfast Rate: ₱{parseFloat(
                            selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined
                              ? selectedRoom.breakfastRate
                              : (selectedRoom.rateWithBreakfast && selectedRoom.rateWithoutBreakfast ? parseFloat(selectedRoom.rateWithBreakfast) - parseFloat(selectedRoom.rateWithoutBreakfast) : 0)
                          ).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  <GuestReservationForm
                    selectedRoom={selectedRoom}
                    checkInDate={checkInDate}
                    onChangeCheckInDate={(newDate) => handleCheckInDateChange(newDate)}
                    checkOutDate={checkOutDate}
                    onChangeCheckOutDate={(newDate) => setCheckOutDate(newDate)}
                    checkInTime={checkInTime}
                    onChangeCheckInTime={(newTime) => setCheckInTime(newTime)}
                    checkOutTime={checkOutTime}
                    onChangeCheckOutTime={(newTime) => setCheckOutTime(newTime)}
                    breakfastOption={breakfastOption}
                    onChangeBreakfastOption={(newOption) => setBreakfastOption(newOption)}
                    minDate={minReserveDateStr}
                    maxDate={maxReserveDateStr}
                    roomSchedules={roomSchedules}
                    hasConflict={Boolean(selectedRoom && checkScheduleConflict(selectedRoom.roomID, checkInDate, checkOutDate))}
                    numGuests={numGuests}
                    onChangeNumGuests={(val) => setNumGuests(val)}
                    roomBasePax={roomBasePax}
                    specialRequests={specialRequests}
                    onChangeSpecialRequests={(val) => setSpecialRequests(val)}
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-danger text-white fw-bold" onClick={() => setActiveModal('none')}>Cancel</button>
                  <LoadingButton
                    type="submit"
                    className="btn btn-warning text-dark fw-bold"
                    isLoading={processing}
                    loadingText="Placing Hold..."
                    disabled={Boolean(selectedRoom && checkScheduleConflict(selectedRoom.roomID, checkInDate, checkOutDate))}
                  >
                    Place Courtesy Hold
                  </LoadingButton>
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
                <h4 className="fw-bold text-dark">
                  Courtesy Hold Placed!
                </h4>
                <p className="text-muted small mb-3">
                  Your room is temporarily held for 48 hours without payment. Confirm with payment before it expires to secure your booking.
                </p>

                <div className="p-3 bg-light rounded text-start border mb-3" style={{ fontSize: '0.85rem' }}>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Reservation Ref:</span>
                    <span className="fw-bold text-success">#{formatReservationID(reservationSummaryData.reservationID)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Reservation Type:</span>
                    <span className="badge bg-warning text-dark">
                      Courtesy Hold (48h)
                    </span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Reserved Room:</span>
                    <span className="fw-bold text-dark">Room {reservationSummaryData.roomNumber} ({reservationSummaryData.roomType})</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Check-In Date:</span>
                    <span className="fw-semibold">{reservationSummaryData.checkInDate}</span>
                  </div>
                  {reservationSummaryData.isCourtesyHold && reservationSummaryData.holdExpiryDateTime && (
                    <div className="d-flex justify-content-between mb-1 text-warning-emphasis fw-bold">
                      <span>Hold Expiration:</span>
                      <span>{new Date(reservationSummaryData.holdExpiryDateTime).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}</span>
                    </div>
                  )}
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
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ backgroundColor: '#0d6efd' }}>
                <h5 className="modal-title fw-bold">Online Booking Summary & Guest Details</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal('none')}></button>
              </div>
              <form onSubmit={handleProceedToPayment}>
                <div className="modal-body p-3 p-md-4">
                  {convertingReservationID && (
                    <div className="alert alert-info py-2 px-3 small mb-3 d-flex align-items-center gap-2 border border-info-subtle shadow-xs">
                      <i className="bi bi-arrow-repeat fs-5 text-primary"></i>
                      <div>
                        <strong>Converting Reservation #{convertingReservationID} to Booking:</strong>
                        <span className="ms-1">Your reservation details have been loaded. Please review your stay schedule, breakfast option, and guest details below before proceeding to payment.</span>
                      </div>
                    </div>
                  )}
                  <div className="row g-3 mb-3">
                    <div className="col-lg-5">
                      <div className="p-3 bg-light rounded border h-100">
                        <h6 className="fw-bold text-primary mb-2">Room {selectedRoom.roomNumber} - {selectedRoom.roomType}</h6>
                        <div className="small text-muted mb-1">Floor: <strong>{selectedRoom.floorName}</strong></div>
                        <div className="small text-muted mb-1">Rate Without Breakfast: <strong>₱{parseFloat(selectedRoom.rateWithoutBreakfast || selectedRoom.rate).toFixed(2)} / night</strong></div>
                        <div className="small text-muted mb-1">Rate With Breakfast: <strong className="text-primary">₱{parseFloat(selectedRoom.rateWithBreakfast || (selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined ? parseFloat(selectedRoom.rate) + parseFloat(selectedRoom.breakfastRate) : parseFloat(selectedRoom.rate))).toFixed(2)} / night</strong></div>
                        <div className="small text-muted">
                          Breakfast Rate: {selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined && parseFloat(selectedRoom.breakfastRate) === 0 ? (
                            <span className="badge bg-success-subtle text-success border border-success-subtle"><i className="bi bi-cup-hot me-1"></i>Breakfast Included (Free)</span>
                          ) : (
                            <span className="text-success fw-bold">
                              ₱{parseFloat(
                                selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined
                                  ? selectedRoom.breakfastRate
                                  : (selectedRoom.rateWithBreakfast && selectedRoom.rateWithoutBreakfast ? parseFloat(selectedRoom.rateWithBreakfast) - parseFloat(selectedRoom.rateWithoutBreakfast) : 0)
                              ).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="col-lg-7">
                      <div className="p-3 bg-light rounded border h-100">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="fw-bold text-dark mb-0">Stay Schedule</h6>
                          {convertingReservationID && (
                            <span className="badge bg-warning text-dark border border-warning-subtle">
                              <i className="bi bi-lock-fill me-1"></i>Dates Locked to Reservation #{convertingReservationID}
                            </span>
                          )}
                        </div>
                        {convertingReservationID && (
                          <div className="alert alert-warning py-1.5 px-2.5 small mb-2 d-flex align-items-center gap-2">
                            <i className="bi bi-lock-fill text-warning-emphasis"></i>
                            <span style={{ fontSize: '0.78rem' }}>
                              Stay schedule is locked to your reservation ({checkInDate} to {checkOutDate}). Date changes are not allowed when converting an on-hold reservation.
                            </span>
                          </div>
                        )}
                        <BookingForm
                          checkInDate={checkInDate}
                          onChangeCheckInDate={(newDate) => { if (!convertingReservationID) handleCheckInDateChange(newDate); }}
                          checkOutDate={checkOutDate}
                          onChangeCheckOutDate={(newDate) => { if (!convertingReservationID) setCheckOutDate(newDate); }}
                          checkInTime={checkInTime}
                          onChangeCheckInTime={(newTime) => { if (!convertingReservationID) setCheckInTime(newTime); }}
                          checkOutTime={checkOutTime}
                          onChangeCheckOutTime={(newTime) => { if (!convertingReservationID) setCheckOutTime(newTime); }}
                          useCurrentTimeIn={false}
                          allowCurrentTimeIn={false}
                          minDate={minBookDateStr}
                          nightsCount={nightsCount}
                          selectedRoom={selectedRoom}
                          roomSchedules={convertingReservationID ? roomSchedules.filter(s => String(s.reservationID) !== String(convertingReservationID)) : roomSchedules}
                          showCalendar={!convertingReservationID}
                          readOnlyDates={Boolean(convertingReservationID)}
                        />
                      </div>
                    </div>
                  </div>

                  {selectedRoom && checkScheduleConflict(selectedRoom.roomID, checkInDate, checkOutDate) && (
                    <div className="alert alert-danger py-2 px-3 small mb-3 border border-danger shadow-xs">
                      <i className="bi bi-exclamation-triangle-fill me-1.5 fw-bold"></i>
                      <strong>Schedule Conflict:</strong> Room {selectedRoom.roomNumber} is already held, reserved, or booked for the selected date(s) ({checkInDate}{checkOutDate ? ` to ${checkOutDate}` : ''}). Please select an open date on the calendar.
                    </div>
                  )}

                  {/* Room Occupancy & Breakfast Option */}
                  <div className="p-3 bg-white border rounded mb-3">
                    <div className="row g-2 align-items-center mb-3">
                      <div className="col-md-6">
                        <label className="form-label fw-bold mb-1 small text-dark d-flex justify-content-between">
                          <span>Breakfast Inclusion *</span>
                          {selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined && parseFloat(selectedRoom.breakfastRate) === 0 && (
                            <span className="text-success fw-semibold">(Complimentary)</span>
                          )}
                        </label>
                        <select
                          className="form-select form-select-sm fw-semibold"
                          value={breakfastOption}
                          onChange={(e) => setBreakfastOption(e.target.value)}
                        >
                          <option value="with">
                            With Breakfast (₱{parseFloat(selectedRoom.rateWithBreakfast || (selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined ? parseFloat(selectedRoom.rate) + parseFloat(selectedRoom.breakfastRate) : parseFloat(selectedRoom.rate))).toFixed(2)}/night{selectedRoom.breakfastRate !== null && selectedRoom.breakfastRate !== undefined && parseFloat(selectedRoom.breakfastRate) === 0 ? ' - Free' : ''})
                          </option>
                          <option value="without">
                            Without Breakfast (₱{parseFloat(selectedRoom.rateWithoutBreakfast || selectedRoom.rate).toFixed(2)}/night)
                          </option>
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-bold mb-1 small text-dark">Number of Guests Staying *</label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min="1"
                          placeholder="e.g. 2"
                          value={numGuests === '' ? '' : numGuests}
                          onChange={(e) => setNumGuests(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                          required
                        />
                        <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                          Standard Room Capacity: <strong>Up to {roomBasePax} Pax</strong>
                          {extraGuestsCount > 0 && (
                            <span className="text-primary fw-bold ms-1">
                              (+₱{(extraGuestFee).toFixed(2)} for {extraGuestsCount} extra guest(s) @ ₱100/night)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {earlyCheckInInfo.isEarly && (
                    <div className="alert alert-warning py-2 px-3 small mb-3">
                      <i className="bi bi-clock-history me-1.5 fw-bold"></i>
                      <strong>Early Arrival Note:</strong> Standard check-in is 2:00 PM. Arriving before 2:00 PM will incur an estimated early check-in fee of <strong>₱{earlyCheckInInfo.earlyFee.toFixed(2)}</strong> ({earlyCheckInInfo.earlyHours} hr(s) @ ₱50/hr) added upon check-in.
                    </div>
                  )}

                  {lateCheckOutInfo.isLate && (
                    <div className="alert alert-danger py-2 px-3 small mb-3">
                      <i className="bi bi-clock-history me-1.5 fw-bold"></i>
                      <strong>Late Departure Note:</strong> Standard check-out is 12:00 PM. Departing past 12:00 PM will incur an estimated late check-out fee of <strong>₱{lateCheckOutInfo.lateFee.toFixed(2)}</strong> ({lateCheckOutInfo.lateHours} hr(s) @ ₱100/hr) added upon check-out.
                    </div>
                  )}

                    <div className="p-3 bg-light rounded border" style={{ fontSize: '0.88rem' }}>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Room Rent Subtotal ({nightsCount} nights):</span>
                        <span className="fw-semibold">₱{originalTotal.toFixed(2)}</span>
                      </div>
                      {earlyCheckInInfo.isEarly && (
                        <div className="d-flex justify-content-between mb-1 text-warning-emphasis fw-semibold">
                          <span>Early Check-In Fee ({earlyCheckInInfo.earlyHours} hr{earlyCheckInInfo.earlyHours > 1 ? 's' : ''} @ ₱50/hr):</span>
                          <span>+₱{earlyCheckInInfo.earlyFee.toFixed(2)}</span>
                        </div>
                      )}
                      {lateCheckOutInfo.isLate && (
                        <div className="d-flex justify-content-between mb-1 text-danger fw-semibold">
                          <span>Late Check-Out Fee ({lateCheckOutInfo.lateHours} hr{lateCheckOutInfo.lateHours > 1 ? 's' : ''} @ ₱100/hr):</span>
                          <span>+₱{lateCheckOutInfo.lateFee.toFixed(2)}</span>
                        </div>
                      )}
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
                  <button type="button" className="btn btn-danger text-white fw-bold" onClick={() => setActiveModal('none')}>Cancel</button>
                  <LoadingButton
                    type="submit"
                    className="btn btn-primary text-white fw-bold"
                    isLoading={processing}
                    loadingText="Proceeding..."
                    disabled={Boolean(selectedRoom && checkScheduleConflict(selectedRoom.roomID, checkInDate, checkOutDate))}
                  >
                    Proceed to GCash Payment
                  </LoadingButton>
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
              <div className="modal-header text-white d-flex justify-content-between align-items-center" style={{ backgroundColor: '#0d6efd' }}>
                <div className="d-flex align-items-center gap-2">
                  <h5 className="modal-title fw-bold mb-0">GCash Online Payment Options</h5>
                  <span className="badge bg-warning text-dark font-mono px-2 py-1" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                    <i className="bi bi-flask me-1"></i>TEST MODE
                  </span>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => {
                  setIsGuestGcashSettled(false);
                  setGuestGcashInlineError('');
                  setGcashRef('');
                  setPaymongoStatus('idle');
                  setPaymongoSourceID(null);
                  setActiveModal('book_form');
                }}></button>
              </div>
              <form onSubmit={handleConfirmGCashBookingPayment}>
                <div className="modal-body">
                  <div className="alert alert-info py-2 small mb-3 d-flex justify-content-between align-items-center">
                    <span>Online payments are processed via <strong>GCash (PayMongo Test Mode)</strong>. Select downpayment below.</span>
                    <span className="badge bg-warning text-dark ms-2">TEST MODE</span>
                  </div>

                  <GuestBookingForm paymentOption={paymentOption} setPaymentOption={setPaymentOption} />

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

                  {/* OFFICIAL PAYMONGO DYNAMIC QRPH CODE */}
                  <div className="card border-0 shadow-sm p-3 bg-white rounded-3 mb-3 text-center">
                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-qr-code-scan text-primary fs-5"></i>
                        <span className="fw-bold text-dark" style={{ fontSize: '0.95rem' }}>Pay via QRPh Code</span>
                      </div>
                      {paymongoStatus === 'paid' ? (
                        <span className="badge bg-success text-white fw-semibold" style={{ fontSize: '0.72rem' }}>
                          <i className="bi bi-check-circle-fill me-1"></i>Authorized
                        </span>
                      ) : (
                        <span className="badge bg-warning text-dark fw-semibold" style={{ fontSize: '0.72rem' }}>
                          Awaiting Scan
                        </span>
                      )}
                    </div>

                    {paymongoLoading ? (
                      <div className="py-4 text-center">
                        <div className="spinner-border text-primary" role="status"></div>
                        <div className="small text-muted mt-2">Generating PayMongo dynamic QRPh code...</div>
                      </div>
                    ) : paymongoQrUrl ? (
                      <div className="d-flex flex-column align-items-center justify-content-center">
                        <div className="bg-white p-2 rounded shadow-sm border mb-2 position-relative" style={{ display: 'inline-block' }}>
                          <div className="position-relative d-inline-block">
                            <img
                              src={paymongoQrUrl}
                              alt="Official PayMongo Dynamic QRPh Code"
                              className="img-fluid rounded"
                              style={{ width: '200px', height: '200px', objectFit: 'contain' }}
                            />
                            {/* Official QRPh Center Logo overlay for fallback codes (native PayMongo QR already includes official QRPh logo) */}
                            {!paymongoQrUrl?.startsWith('data:image') && (
                              <div
                                className="position-absolute top-50 start-50 translate-middle bg-white p-1 rounded shadow-sm border border-danger d-flex align-items-center justify-content-center"
                                style={{ width: '36px', height: '36px', pointerEvents: 'none' }}
                              >
                                <span className="badge bg-danger text-white fw-bold" style={{ fontSize: '0.62rem', padding: '2px 4px', letterSpacing: '0.3px' }}>QR Ph</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* EXACT INSTRUCTION BANNER */}
                        <div className="alert alert-info py-2 px-3 small mt-1 mb-2 text-center fw-medium" style={{ fontSize: '0.82rem' }}>
                          <i className="bi bi-info-circle-fill me-1.5 text-primary"></i>
                          <span>Scan with GCash or any QRPh-compliant app. Amount is pre-set.</span>
                        </div>

                        <div className="text-muted small mt-1 d-flex flex-column gap-1 text-start w-100 px-2" style={{ fontSize: '0.74rem' }}>
                          <div><strong>Step 1:</strong> Open GCash, Maya, or any QRPh-compliant banking app.</div>
                          <div><strong>Step 2:</strong> Scan the QR code to load the pre-set downpayment amount (₱{amountToPayNow.toFixed(2)}).</div>
                          <div><strong>Step 3:</strong> Confirm payment in your app or simulate authorization below.</div>
                        </div>
                      </div>
                    ) : paymongoError ? (
                      <div className="alert alert-warning py-2 small mb-0">
                        {paymongoError}
                        <button
                          type="button"
                          className="btn btn-sm btn-primary text-white fw-bold d-block mx-auto mt-2"
                          onClick={() => initiatePayMongoSource()}
                        >
                          Retry Generating QR
                        </button>
                      </div>
                    ) : null}

                    {paymongoStatus === 'paid' && (
                      <div className="alert alert-success py-2 px-3 small d-flex align-items-center gap-2 mt-3 mb-0">
                        <i className="bi bi-check-circle-fill text-success fs-5"></i>
                        <div className="text-start">
                          <strong>Payment Verified & Authorized!</strong>
                          <div className="text-muted small">PayMongo Reference #{paymongoSourceID}. You may now complete your booking.</div>
                        </div>
                      </div>
                    )}

                    {guestGcashInlineError && (
                      <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mt-3 mb-0">
                        <i className="bi bi-exclamation-triangle-fill text-danger fs-6"></i>
                        <span>{guestGcashInlineError}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer d-flex flex-column gap-2 p-3 border-top bg-light">
                  {paymongoStatus === 'paid' ? (
                    <LoadingButton 
                      type="submit" 
                      className="btn btn-primary text-white fw-bold w-100 py-2 d-flex align-items-center justify-content-center gap-2 shadow-sm" 
                      isLoading={processing}
                      loadingText="Processing Booking..."
                      style={{ backgroundColor: '#005ce6', borderColor: '#005ce6', borderRadius: '8px' }}
                    >
                      <i className="bi bi-check-circle-fill"></i>
                      <span>Confirm & Complete Booking (₱{amountToPayNow.toFixed(2)})</span>
                    </LoadingButton>
                  ) : (
                    <button 
                      type="button" 
                      className="btn btn-primary text-white fw-bold w-100 py-2 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                      style={{ backgroundColor: '#005ce6', borderColor: '#005ce6', borderRadius: '8px' }}
                      onClick={handleProceedToSandboxGCash}
                    >
                      <i className="bi bi-wallet2 me-2"></i>
                      <span>Proceed to GCash</span>
                    </button>
                  )}

                  {/* BACK BUTTON: Placed below confirm / proceed button, filled red, no arrow, with mt-2 spacing */}
                  <button 
                    type="button" 
                    className="btn btn-danger text-white fw-bold w-100 py-2 shadow-sm mt-2" 
                    style={{ borderRadius: '8px' }}
                    onClick={() => {
                      setIsGuestGcashSettled(false);
                      setGuestGcashInlineError('');
                      setGcashRef('');
                      setPaymongoStatus('idle');
                      setPaymongoSourceID(null);
                      setActiveModal('book_form');
                    }}
                  >
                    Back
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WORKFLOW: RECEIPT WINDOW (COMPACT SMALL RECEIPT SIZE) */}
      {activeModal === 'receipt' && receiptData && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '380px' }}>
            <div className="modal-content shadow-lg border-0 text-center p-3" style={{ borderRadius: '14px' }}>
              <div className="modal-body py-3 px-2">
                <div className="mb-2">
                  <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1 fw-bold" style={{ fontSize: '0.78rem' }}>
                    <i className="bi bi-check-circle-fill me-1"></i>Payment Confirmed
                  </span>
                </div>
                <h5 className="fw-bold text-dark mb-1">Official Payment Receipt</h5>
                <p className="text-muted small mb-3" style={{ fontSize: '0.78rem' }}>Your GCash payment has been verified and confirmed.</p>

                {/* COMPACT THERMAL SLIP CARD */}
                <div className="p-3 bg-light rounded text-start border mb-3 font-monospace" style={{ fontSize: '0.80rem', borderStyle: 'dashed !important' }}>
                  <div className="text-center pb-2 mb-2 border-bottom border-secondary border-opacity-25">
                    <div className="fw-bold text-dark" style={{ fontSize: '0.85rem' }}>PCC HOME SUITE HOME</div>
                    <div className="text-muted" style={{ fontSize: '0.70rem' }}>Koronadal City, South Cotabato</div>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Receipt No:</span>
                    <span className="fw-bold text-dark">#REC-{receiptData.paymentID}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Booking Ref:</span>
                    <span className="fw-bold text-primary">#{receiptData.bookingID}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Guest:</span>
                    <span className="fw-bold text-dark">{receiptData.guestName}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Payment:</span>
                    <span className="text-dark">{receiptData.paymentMethod}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Ref No:</span>
                    <span className="fw-bold text-dark text-break" style={{ fontSize: '0.75rem' }}>{receiptData.referenceNumber}</span>
                  </div>
                  <div className="d-flex justify-content-between pt-1.5 pb-1 border-top border-secondary border-opacity-25 text-success fw-bold">
                    <span>Paid ({receiptData.paymentPercentage}):</span>
                    <span>₱{receiptData.amountPaid.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between pt-1 border-top border-secondary border-opacity-25 text-danger">
                    <span>Remaining Balance:</span>
                    <span className="fw-bold">₱{receiptData.remainingBalance.toFixed(2)}</span>
                  </div>
                </div>

                <div className="d-flex flex-column gap-2">
                  <div className="d-flex gap-2">
                    <button className="btn btn-primary btn-sm flex-fill text-white fw-bold py-2" onClick={handlePrintReceipt}>
                      <i className="bi bi-printer me-1"></i>Print Receipt
                    </button>
                    <button className="btn btn-success btn-sm flex-fill text-white fw-bold py-2 shadow-sm" onClick={() => generateReceiptPNG(receiptData)}>
                      <i className="bi bi-download me-1"></i>Save (PNG)
                    </button>
                  </div>
                  <button className="btn btn-outline-secondary btn-sm fw-bold py-1.5" onClick={() => { setActiveModal('none'); setViewMode('default'); setActiveTab('home'); }}>
                    Done &amp; View Portal
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL DIALOG */}
      {showEditProfileModal && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <div className="modal-header text-white" style={{ backgroundColor: 'var(--pcc-blue)' }}>
                <h5 className="modal-title fw-bold">Edit Profile Settings</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowEditProfileModal(false)}></button>
              </div>
              <form onSubmit={handleSaveProfileSubmit}>
                <div className="modal-body p-4">
                  {/* PROFILE PICTURE SECTION */}
                  <div className="d-flex align-items-center gap-3 p-3 bg-light rounded border mb-3">
                    <div className="position-relative">
                      <img
                        src={editProfileForm.profilePicture || "/assets/images/logo.jpg"}
                        alt="Profile Preview"
                        className="rounded-circle border"
                        style={{ width: '64px', height: '64px', objectFit: 'cover', border: '2px solid var(--pcc-blue)' }}
                      />
                      <label
                        htmlFor="dashboardModalAvatarInput"
                        className="position-absolute bottom-0 end-0 bg-primary text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm cursor-pointer"
                        style={{ width: '24px', height: '24px', border: '1.5px solid #ffffff' }}
                        title="Upload Photo"
                      >
                        <i className="bi bi-camera-fill" style={{ fontSize: '0.7rem' }}></i>
                      </label>
                      <input
                        type="file"
                        id="dashboardModalAvatarInput"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        className="d-none"
                        onChange={handleModalProfilePicUpload}
                        disabled={uploadingModalPic}
                      />
                    </div>
                    <div>
                      <div className="fw-bold text-dark small">Profile Photo</div>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>JPG or PNG under 2MB.</div>
                      <div className="d-flex gap-2 mt-1">
                        <label
                          htmlFor="dashboardModalAvatarInput"
                          className="btn btn-xs btn-primary text-white py-0.5 px-2 fw-semibold"
                          style={{ fontSize: '0.72rem' }}
                        >
                          {uploadingModalPic ? 'Uploading...' : 'Change Photo'}
                        </label>
                        {editProfileForm.profilePicture && (
                          <button
                            type="button"
                            className="btn btn-xs btn-danger text-white py-0.5 px-2 fw-semibold"
                            onClick={handleModalRemoveProfilePic}
                            disabled={uploadingModalPic}
                            style={{ fontSize: '0.72rem' }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">First Name *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        required
                        value={editProfileForm.firstName}
                        onChange={(e) => setEditProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Middle Name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={editProfileForm.middleName}
                        onChange={(e) => setEditProfileForm(prev => ({ ...prev, middleName: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Last Name *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        required
                        value={editProfileForm.lastName}
                        onChange={(e) => setEditProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Contact Number *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        required
                        value={editProfileForm.contact}
                        onChange={(e) => setEditProfileForm(prev => ({ ...prev, contact: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Gender</label>
                      <select
                        className="form-select form-select-sm"
                        value={editProfileForm.gender}
                        onChange={(e) => setEditProfileForm(prev => ({ ...prev, gender: e.target.value }))}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">City / Municipality</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={editProfileForm.city}
                        onChange={(e) => setEditProfileForm(prev => ({ ...prev, city: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Province / Region</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={editProfileForm.province}
                        onChange={(e) => setEditProfileForm(prev => ({ ...prev, province: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
                  <button type="button" className="btn btn-secondary text-white fw-bold px-4" onClick={() => setShowEditProfileModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-pcc-primary text-white fw-bold px-4" disabled={savingProfile}>
                    {savingProfile ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Saving Changes...
                      </>
                    ) : (
                      'Save Profile Settings'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* LIVE BILL BREAKDOWN MODAL */}
      {showBillModal && detailedBill && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '14px', overflow: 'hidden' }}>
              <div className="modal-header text-white" style={{ backgroundColor: 'var(--pcc-blue)' }}>
                <div>
                  <h5 className="modal-title fw-bold mb-0">
                    <i className="bi bi-receipt-cutoff me-2"></i>Live Bill Breakdown
                  </h5>
                  <div className="small text-white text-opacity-75">
                    Booking #{detailedBill.bookingID || detailedBill.booking?.bookingID} • Room {detailedBill.booking?.roomNumber} ({detailedBill.booking?.roomType})
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowBillModal(false)}></button>
              </div>
              <div className="modal-body p-4" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                {/* 1. ROOM CHARGES */}
                <h6 className="fw-bold text-dark border-bottom pb-1 mb-2.5" style={{ fontSize: '0.86rem' }}>
                  <i className="bi bi-door-open-fill me-1.5 text-primary"></i>Room Stay Charges
                </h6>
                <div className="table-responsive mb-3">
                  <table className="table table-sm table-bordered align-middle mb-0" style={{ fontSize: '0.80rem' }}>
                    <thead className="table-light">
                      <tr>
                        <th>Description</th>
                        <th>Rate / Night</th>
                        <th>Nights</th>
                        <th className="text-end">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{detailedBill.booking?.roomType || 'Room'} (Base Rate)</td>
                        <td>₱{parseFloat(detailedBill.rate || detailedBill.chargesBreakdown?.room?.rate || detailedBill.booking?.rate || 0).toFixed(2)}</td>
                        <td>{detailedBill.nights || detailedBill.chargesBreakdown?.room?.nights || detailedBill.booking?.nights || 1}</td>
                        <td className="text-end fw-bold">₱{parseFloat(detailedBill.baseRoomCharge || detailedBill.chargesBreakdown?.room?.baseRoomCharge || 0).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 2. ADDITIONAL FEES */}
                <h6 className="fw-bold text-dark border-bottom pb-1 mb-2.5" style={{ fontSize: '0.86rem' }}>
                  <i className="bi bi-plus-circle-fill me-1.5 text-info"></i>Additional Fees
                </h6>
                <div className="table-responsive mb-3">
                  <table className="table table-sm table-bordered align-middle mb-0" style={{ fontSize: '0.80rem' }}>
                    <thead className="table-light">
                      <tr>
                        <th>Fee Type</th>
                        <th>Calculation Details</th>
                        <th className="text-end">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Extra Guests Fee</td>
                        <td>{detailedBill.extraGuests || detailedBill.chargesBreakdown?.additionalFees?.extraGuestsCount || 0} Pax beyond limit @ ₱100/night</td>
                        <td className="text-end fw-semibold">₱{parseFloat(detailedBill.extraGuestFee || detailedBill.chargesBreakdown?.additionalFees?.extraGuestFee || 0).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>Early Check-In Fee</td>
                        <td>Arrived before standard 2:00 PM check-in (₱50.00 / hour)</td>
                        <td className="text-end fw-semibold">₱{parseFloat(detailedBill.earlyCheckInFee || detailedBill.chargesBreakdown?.additionalFees?.earlyCheckInFee || 0).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>
                          Late Check-Out Fee
                          <span className="badge bg-warning text-dark font-monospace ms-2" style={{ fontSize: '0.66rem' }}>
                            {detailedBill.lateCheckOutRule || detailedBill.chargesBreakdown?.additionalFees?.lateCheckOutRule || '1-22 hrs: ₱100/hr | >22 hrs: Full room rate'}
                          </span>
                        </td>
                        <td>
                          {detailedBill.lateHours || detailedBill.chargesBreakdown?.additionalFees?.lateHours || 0} hour(s) past 12:00 PM checkout
                          <div className="text-muted" style={{ fontSize: '0.70rem' }}>* ₱100/hr for extensions up to 22h; &gt;22h billed at full daily room rate.</div>
                        </td>
                        <td className="text-end fw-semibold">₱{parseFloat(detailedBill.lateCheckOutFee || detailedBill.chargesBreakdown?.additionalFees?.lateCheckOutFee || 0).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. INCIDENTAL FEES */}
                <h6 className="fw-bold text-dark border-bottom pb-1 mb-2.5" style={{ fontSize: '0.86rem' }}>
                  <i className="bi bi-shield-exclamation me-1.5 text-danger"></i>Incidental Fees (Damages / Penalties)
                </h6>
                <div className="table-responsive mb-3">
                  <table className="table table-sm table-bordered align-middle mb-0" style={{ fontSize: '0.80rem' }}>
                    <thead className="table-light">
                      <tr>
                        <th>Charge Description</th>
                        <th>Date Recorded</th>
                        <th className="text-end">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailedBill.incidentalCharges || detailedBill.chargesBreakdown?.incidentalFees?.charges || []).length > 0 ? (
                        (detailedBill.incidentalCharges || detailedBill.chargesBreakdown?.incidentalFees?.charges || []).map((inc, i) => (
                          <tr key={i}>
                            <td>{inc.description}</td>
                            <td>{inc.createdAt || 'During Stay'}</td>
                            <td className="text-end fw-bold text-danger">₱{parseFloat(inc.amount).toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="text-center text-muted py-2">No incidental charges recorded in this stay.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 4. ORDERS (PRODUCTS, COOKED MEALS, AMENITIES) */}
                <h6 className="fw-bold text-dark border-bottom pb-1 mb-2.5" style={{ fontSize: '0.86rem' }}>
                  <i className="bi bi-bag-check-fill me-1.5 text-success"></i>Orders (Products, Cooked Meals &amp; Amenities)
                </h6>
                <div className="table-responsive mb-3">
                  <table className="table table-sm table-bordered align-middle mb-0" style={{ fontSize: '0.80rem' }}>
                    <thead className="table-light">
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th className="text-end">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((detailedBill.productCharges || detailedBill.chargesBreakdown?.orders?.products || []).concat(detailedBill.amenityCharges || detailedBill.chargesBreakdown?.orders?.amenities || [])).length > 0 ? (
                        (detailedBill.productCharges || detailedBill.chargesBreakdown?.orders?.products || []).concat(detailedBill.amenityCharges || detailedBill.chargesBreakdown?.orders?.amenities || []).map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              {item.name}
                              {(item.isComplimentary || parseFloat(item.price) === 0) && (
                                <span className="badge bg-success-subtle text-success ms-1.5" style={{ fontSize: '0.70rem' }}>Complimentary Breakfast</span>
                              )}
                            </td>
                            <td>{item.quantity}</td>
                            <td>{(item.isComplimentary || parseFloat(item.price) === 0) ? <span className="text-success fw-bold">₱0.00</span> : `₱${parseFloat(item.price).toFixed(2)}`}</td>
                            <td className="text-end fw-semibold">{(item.isComplimentary || parseFloat(item.price) === 0) ? <span className="text-success fw-bold">₱0.00</span> : `₱${parseFloat(item.subtotal).toFixed(2)}`}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="text-center text-muted py-2">No room orders submitted during this stay.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 5. APPORTIONED DISCOUNTS */}
                {(detailedBill.totalDiscount || detailedBill.chargesBreakdown?.discounts?.total || 0) > 0 && (
                  <div className="alert alert-success py-2.5 px-3 mb-3" style={{ fontSize: '0.82rem' }}>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-bold">
                        <i className="bi bi-tag-fill me-1.5"></i>
                        Discounts Applied (Proportionate Share Deduction):
                      </span>
                      <strong className="fs-6">-₱{parseFloat(detailedBill.totalDiscount || detailedBill.chargesBreakdown?.discounts?.total).toFixed(2)}</strong>
                    </div>
                    {((detailedBill.chargesBreakdown?.discounts?.beneficiaries || detailedBill.finalGuestsList || detailedBill.guestsList || []).filter(g => g.discountID || g.promotionID)).map((ben, bIdx) => (
                      <div key={bIdx} className="d-flex justify-content-between text-success-emphasis ps-2" style={{ fontSize: '0.74rem' }}>
                        <span>• {ben.fullName || ben.beneficiaryName || `Beneficiary #${bIdx + 1}`} ({ben.discountName || ben.name || 'Senior/PWD'} - {ben.percentage || 20}% share) {ben.discountIdNumber ? `[ID: ${ben.discountIdNumber}]` : ''}</span>
                        <span className="fw-semibold">-₱{parseFloat(ben.discountDeduction || ben.deduction || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 6. FINANCIAL BALANCING CARD */}
                <div className="billing-breakdown p-3 bg-light rounded-3 border mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1.5 small">
                    <span className="text-muted">Room Rate ({detailedBill.nights || 1} night{detailedBill.nights > 1 ? 's' : ''}):</span>
                    <strong className="text-dark">₱{parseFloat(detailedBill.baseRoomCharge || detailedBill.chargesSummary?.room || detailedBill.roomCharge || 0).toFixed(2)}</strong>
                  </div>
                  {(detailedBill.chargesSummary?.downPaymentPaid > 0 || detailedBill.downPaymentPaid > 0 || detailedBill.storedDownPaymentAmount > 0) && (
                    <div className="d-flex justify-content-between align-items-center mb-1.5 small text-primary">
                      <span>Down Payment ({detailedBill.chargesSummary?.downPaymentPercentage || detailedBill.storedDownPaymentPercentage || 30}%):</span>
                      <strong className="fw-semibold">-₱{parseFloat(detailedBill.chargesSummary?.downPaymentPaid || detailedBill.downPaymentPaid || detailedBill.storedDownPaymentAmount || 0).toFixed(2)}</strong>
                    </div>
                  )}
                  <div className="d-flex justify-content-between align-items-center mb-1.5 small">
                    <span className="text-muted">Additional Charges (Incidentals, Fees &amp; Orders):</span>
                    <strong className="text-dark">
                      ₱{parseFloat(
                        (parseFloat(detailedBill.regularIncidentalTotal || detailedBill.incidentalTotal || 0)) +
                        (parseFloat(detailedBill.earlyCheckInFee || 0)) +
                        (parseFloat(detailedBill.lateCheckOutFee || 0)) +
                        (parseFloat(detailedBill.extraGuestFee || 0)) +
                        (parseFloat(detailedBill.ordersTotal || 0))
                      ).toFixed(2)}
                    </strong>
                  </div>
                  {(detailedBill.totalDiscount || detailedBill.chargesBreakdown?.discounts?.total || 0) > 0 && (
                    <div className="d-flex justify-content-between align-items-center mb-1.5 small text-success">
                      <span>Discounts Applied:</span>
                      <strong className="fw-semibold">-₱{parseFloat(detailedBill.totalDiscount || detailedBill.chargesBreakdown?.discounts?.total || 0).toFixed(2)}</strong>
                    </div>
                  )}
                  <div className="d-flex justify-content-between align-items-center mb-2 small text-success">
                    <span>Total Paid Recorded:</span>
                    <strong className="fs-6">₱{parseFloat(detailedBill.paidTotal || detailedBill.balancing?.paidTotal || detailedBill.chargesSummary?.paid || 0).toFixed(2)}</strong>
                  </div>
                  <hr className="my-2" />
                  <div className="d-flex justify-content-between align-items-center total-row">
                    <span className="fw-bold text-danger fs-6">Total Remaining Balance:</span>
                    <span className="fw-bold text-danger fs-5">₱{parseFloat(detailedBill.balance ?? detailedBill.remainingBalance ?? detailedBill.balancing?.remainingBalance ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="mt-2.5 pt-2 border-top d-flex justify-content-end">
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-primary fw-semibold d-inline-flex align-items-center gap-1"
                      style={{ fontSize: '0.80rem' }}
                      onClick={() => setShowAuditTrailModal(true)}
                    >
                      <i className="bi bi-clock-history"></i>
                      <span>View Payment History &amp; Audit Logs</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="modal-footer bg-light border-top d-flex justify-content-between p-3">
                <button type="button" className="btn btn-secondary text-white fw-bold px-4" onClick={() => setShowBillModal(false)}>
                  Close
                </button>
                {parseFloat(detailedBill.balance ?? detailedBill.remainingBalance ?? detailedBill.balancing?.remainingBalance ?? 0) > 0 ? (
                  <button
                    type="button"
                    className="btn btn-primary text-white fw-bold px-4 shadow-sm"
                    style={{ backgroundColor: '#005ce6', borderColor: '#005ce6' }}
                    onClick={() => {
                      setShowBillModal(false);
                      handleInitiatePay(activeBookingStay);
                    }}
                  >
                    <i className="bi bi-wallet2 me-1.5"></i>Proceed to GCash Payment
                  </button>
                ) : (
                  <span className="badge bg-success px-3 py-2 fs-6">
                    <i className="bi bi-check-circle-fill me-1"></i>Fully Paid &amp; Settled
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT TRAIL MODAL */}
      {showAuditTrailModal && detailedBill && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '14px', overflow: 'hidden' }}>
              <div className="modal-header text-white" style={{ backgroundColor: 'var(--pcc-blue)' }}>
                <div>
                  <h5 className="modal-title fw-bold mb-0">
                    <i className="bi bi-clock-history me-2"></i>Financial Audit Trail
                  </h5>
                  <div className="small text-white text-opacity-75">
                    Real-time transaction history for Booking #{detailedBill.bookingID || detailedBill.booking?.bookingID}
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAuditTrailModal(false)}></button>
              </div>
              <div className="modal-body p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {detailedBill.auditLogs && detailedBill.auditLogs.length > 0 ? (
                  <div className="d-flex flex-column gap-2.5">
                    {detailedBill.auditLogs.map((log) => (
                      <div key={log.auditID} className="p-3 rounded border bg-light small" style={{ fontSize: '0.80rem' }}>
                        <div className="d-flex justify-content-between align-items-center mb-1.5">
                          <span className={`badge px-2 py-1 ${
                            log.transactionType?.includes('Payment') || log.transactionType?.includes('Settlement') ? 'bg-success text-white' :
                            log.transactionType?.includes('Discount') ? 'bg-info text-dark' :
                            log.transactionType?.includes('Incidental') ? 'bg-danger text-white' :
                            log.transactionType?.includes('Order') ? 'bg-warning text-dark' : 'bg-primary text-white'
                          }`}>
                            {log.transactionType}
                          </span>
                          <span className="text-muted font-monospace" style={{ fontSize: '0.72rem' }}>{log.createdAt}</span>
                        </div>
                        <div className="fw-semibold text-dark mb-1">{log.description || 'Transaction logged'}</div>
                        <div className="d-flex justify-content-between align-items-center text-muted mb-1" style={{ fontSize: '0.76rem' }}>
                          <span>Transaction Amount: <strong className="text-dark">₱{parseFloat(log.amount).toFixed(2)}</strong></span>
                          <span>Balance Progression: ₱{parseFloat(log.balanceBefore).toFixed(2)} → <strong className="text-primary">₱{parseFloat(log.balanceAfter).toFixed(2)}</strong></span>
                        </div>
                        {log.userName && (
                          <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                            Initiated By: <strong>{log.userName}</strong> ({log.userRole || 'Guest'}) {log.referenceNumber ? `• Reference #${log.referenceNumber}` : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted py-4">
                    <i className="bi bi-clock-history fs-1 d-block mb-2 opacity-50"></i>
                    No financial audit events recorded yet for this booking.
                  </div>
                )}
              </div>
              <div className="modal-footer bg-light border-top p-3">
                <button type="button" className="btn btn-secondary text-white fw-bold px-4" onClick={() => setShowAuditTrailModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
