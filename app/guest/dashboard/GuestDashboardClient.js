'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GuestChatBubble from '../../components/GuestChatBubble';
import ModalDialog from '../../components/ModalDialog';
import GuestBottomNav from './GuestBottomNav';
import GuestSidebarNav from './GuestSidebarNav';
import ThemeToggle from '../../components/ThemeToggle';
import DynamicQrPhCode from '../../components/DynamicQrPhCode';
import DatePicker from '../../components/DatePicker';
import GuestOrdersContent from './GuestOrdersContent';
import LoadingButton from '../../components/LoadingButton';
import { formatReservationID, formatBookingID, formatTransactionID, formatOrderID, formatRoomNumber } from '@/lib/formatters';
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

const defaultRoomImages = {
  'Standard Matrimonial': 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
  'Twin Matrimonial': 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80',
  'Deluxe Matrimonial': 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
};

function RoomImageCarousel({ images, fallbackImg, alt, height = '200px' }) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!images || images.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % images.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [images]);

  const list = images && images.length > 0 ? images : [fallbackImg];

  if (list.length <= 1) {
    return (
      <img
        src={list[0]}
        alt={alt}
        style={{ width: '100%', height: height, objectFit: 'cover' }}
      />
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
    setMinReserveDateStr(todayStr);

    const maxD = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 2);
    setMaxReserveDateStr(`${maxD.getFullYear()}-${pad(maxD.getMonth() + 1)}-${pad(maxD.getDate())}`);
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
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam && ['home', 'rooms', 'orders', 'chat', 'notifications', 'account'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    } catch (e) {}
  }, []);

  // Room Search & Filtering States
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [selectedFloorFilter, setSelectedFloorFilter] = useState('All');
  const [selectedRoomTypeFilter, setSelectedRoomTypeFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');

  // Workflow Mode: 'default' | 'select_room'
  const [viewMode, setViewMode] = useState('default');
  const [flowAction, setFlowAction] = useState('reserve'); // 'reserve' | 'book'

  // Modal Workflow States: 'none' | 'room_details' | 'reserve_form' | 'book_form' | 'payment' | 'receipt' | 'reservation_summary'
  const [activeModal, setActiveModal] = useState('none');
  const [selectedRoom, setSelectedRoom] = useState(null);

  // Form States
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().substring(0, 10));
  const [checkOutDate, setCheckOutDate] = useState(new Date(Date.now() + 86400000).toISOString().substring(0, 10));

  const handleCheckInDateChange = (val) => {
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
  const [reservationSummaryData, setReservationSummaryData] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [processing, setProcessing] = useState(false);

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

  const getDisabledDatesForRoom = (roomId) => {
    if (!roomId || !roomSchedules || roomSchedules.length === 0) return [];
    const disabledSet = new Set();
    const pad = (n) => String(n).padStart(2, '0');
    
    roomSchedules.forEach(sched => {
      if (String(sched.roomID) !== String(roomId)) return;
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

  const checkScheduleConflict = (roomId, inDate, outDate) => {
    if (!roomId || !inDate || !roomSchedules || roomSchedules.length === 0) return false;
    const reqIn = new Date(`${inDate}T14:00:00`);
    const reqOut = outDate ? new Date(`${outDate}T12:00:00`) : new Date(new Date(`${inDate}T14:00:00`).getTime() + 24 * 3600 * 1000);
    if (isNaN(reqIn.getTime()) || isNaN(reqOut.getTime())) return false;
    
    return roomSchedules.some(sched => {
      if (String(sched.roomID) !== String(roomId)) return false;
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
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Failed to mark notifications read:", err);
    }
  };

  const handleMarkSingleNotificationRead = async (id) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationID: id }),
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.notificationID === id ? { ...n, isRead: 1 } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
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
  const extraGuestsCount = selectedRoom ? Math.max(0, (parseInt(numGuests) || 1) - (parseInt(selectedRoom.occupancyLimit) || 2)) : 0;
  const extraGuestFee = extraGuestsCount * 100 * nightsCount;
  const originalTotal = (roomRate * nightsCount) + extraGuestFee;
  const totalDiscount = 0;
  const netTotalAmount = originalTotal;
  const paymentPctNumber = parseInt(paymentOption) || 50;
  const amountToPayNow = Math.round(netTotalAmount * (paymentPctNumber / 100) * 100) / 100;
  const remainingBalanceAfterPay = Math.max(0, Math.round((netTotalAmount - amountToPayNow) * 100) / 100);

  // Early Check-In Fee Preview Calculation (strictly on arrival day before 2:00 PM)
  const calculateEarlyCheckInPreview = () => {
    if (!checkInDate) return { isEarly: false, earlyHours: 0, earlyFee: 0 };
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

    // Early check-in applies strictly on the day of arrival before 2:00 PM (14:00)
    if (checkInDate === todayStr && manilaHour < 14) {
      const exactRemainingMinutes = (14 * 60) - (manilaHour * 60 + manilaMinute);
      const earlyHours = Math.max(1, Math.ceil(exactRemainingMinutes / 60));
      const earlyFee = earlyHours * 50;
      return { isEarly: true, earlyHours, earlyFee };
    }
    return { isEarly: false, earlyHours: 0, earlyFee: 0 };
  };
  const earlyCheckInInfo = calculateEarlyCheckInPreview();

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

    // Reservation Rule: Guests can only select today’s date and up to 2 days ahead maximum
    const pad = (n) => String(n).padStart(2, '0');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const maxDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    const maxDateStr = `${maxDate.getFullYear()}-${pad(maxDate.getMonth() + 1)}-${pad(maxDate.getDate())}`;

    if (checkOutDate && checkOutDate <= checkInDate) {
      showAlert('warning', 'Invalid Stay Dates', 'Check-out time must be later than check-in time.');
      return;
    }

    if (checkInDate < todayStr || checkInDate > maxDateStr) {
      showAlert('warning', 'Reservation Date Restriction', 'Reservations can only be made for today or up to 2 days ahead maximum.');
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

  const handlePayMongoCheckout = async () => {
    if (!amountToPayNow || amountToPayNow <= 0) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/guest/payments/paymongo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountToPayNow,
          description: `Online Down Payment (₱${amountToPayNow.toFixed(2)}) for Room ${selectedRoom?.roomNumber || ''}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initiate PayMongo GCash checkout');

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('Checkout URL not returned.');
      }
    } catch (err) {
      showAlert('error', 'PayMongo Error', err.message);
      setProcessing(false);
    }
  };

  const handleConfirmGCashBookingPayment = async (e, verifiedRef = null) => {
    if (e) e.preventDefault();
    const refToUse = (verifiedRef || gcashRef.trim());

    if (!refToUse && !isGuestGcashSettled) {
      setGuestGcashInlineError('Cannot proceed: GCash payment not settled. Please scan the QR code to verify payment or enter your reference number.');
      showAlert('error', 'Payment Required', 'Cannot proceed: GCash payment not settled. Please scan the QR code to verify payment or enter your reference number.');
      return;
    }

    const finalRef = refToUse || `GCASH-${Date.now()}`;
    setGuestGcashInlineError('');
    setProcessing(true);

    try {
      // 1. Create Online Booking with settled payment validation info
      const bookRes = await fetch('/api/guest/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          roomID: selectedRoom.roomID,
          checkInDate,
          checkOutDate,
          registeredGuests,
          paymentMethod: 'GCash',
          paymentStatus: 'Settled',
          isGcashSettled: true,
          referenceNumber: finalRef
        })
      });

      const bookData = await bookRes.json();
      if (!bookRes.ok) throw new Error(bookData.error || 'Failed to create online booking');

      const bookingID = bookData.bookingID;

      // 2. Submit GCash Payment with verified reference
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

      setReceiptData(payData.receipt);
      setActiveModal('receipt');
      setIsGuestGcashSettled(false);
      setGcashRef('');
      fetchRoomsAndStatus();
    } catch (err) {
      showAlert('error', 'Payment Error', err.message);
    } finally {
      setProcessing(false);
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
    showConfirm(
      'Proceed to Booking',
      `Would you like to officially convert your reservation for Room ${reservation.roomNumber} (${reservation.roomType}) into a confirmed booking?`,
      async () => {
        try {
          const res = await fetch('/api/guest/reservations/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reservationID: reservation.reservationID })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to convert reservation');

          showAlert('success', 'Booking Confirmed', data.message || 'Your reservation has been successfully converted into an official booking!');
          await fetchRoomsAndStatus();
        } catch (err) {
          showAlert('error', 'Conversion Error', err.message);
        }
      }
    );
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
    const printWindow = window.open('', '_blank', 'width=450,height=700');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - PCC Home Suite Home</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace, sans-serif;
              width: 80mm;
              margin: 0 auto;
              padding: 12px 10px;
              color: #000;
              background: #fff;
              font-size: 11px;
              line-height: 1.3;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .logo { width: 48px; height: 48px; border-radius: 4px; margin-bottom: 4px; }
            .brand-name { font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 2px 0; }
            .address { font-size: 9px; color: #333; margin-bottom: 6px; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .double-divider { border-top: 2px solid #000; margin: 8px 0; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
            .info-table td { padding: 2px 0; vertical-align: top; }
            .total-row { font-size: 12px; font-weight: bold; }
            .footer { margin-top: 12px; text-align: center; font-size: 9px; color: #444; }
          </style>
        </head>
        <body>
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
          <div class="text-center bold" style="font-size: 11px;">OFFICIAL ONLINE GCASH RECEIPT</div>
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

  // REQ165a: Interactive Booking Status Timeline Component Helper
  const renderBookingStatusTimeline = (status) => {
    const steps = [
      { id: 'Pending', label: 'Pending' },
      { id: 'Confirmed', label: 'Confirmed' },
      { id: 'Checked In', label: 'Checked-in' },
      { id: 'Completed', label: 'Completed' }
    ];

    let currentIdx = 0;
    if (status === 'Confirmed') currentIdx = 1;
    if (status === 'Checked In' || status === 'Late Checkout') currentIdx = 2;
    if (status === 'Completed' || status === 'Checked Out') currentIdx = 3;
    if (status === 'Cancelled') {
      return (
        <div className="alert alert-danger py-1 px-2.5 mb-0 small fw-bold" style={{ fontSize: '0.75rem' }}>
          ❌ Status: Cancelled
        </div>
      );
    }
    if (status === 'Overdue Check-In') {
      return (
        <div className="alert alert-warning py-1 px-2.5 mb-0 small fw-bold text-dark" style={{ fontSize: '0.75rem' }}>
          ⏳ Status: Overdue Check-In (1-hour arrival grace period active)
        </div>
      );
    }
    if (status === 'No Show') {
      return (
        <div className="alert alert-danger py-1 px-2.5 mb-0 small fw-bold" style={{ fontSize: '0.75rem' }}>
          ⚠️ Status: No Show (1-hour grace period expired — room hold released)
        </div>
      );
    }

    return (
      <div className="w-100 my-2">
        <div className="d-flex align-items-center justify-content-between position-relative px-1">
          {steps.map((step, idx) => {
            const isDone = idx <= currentIdx;
            return (
              <div key={step.id} className="d-flex flex-column align-items-center" style={{ flex: 1, zIndex: 1 }}>
                <div
                  className={`rounded-circle d-flex align-items-center justify-content-center fw-bold ${isDone ? 'bg-primary text-white shadow-sm' : 'bg-light text-muted border'}`}
                  style={{ width: '24px', height: '24px', fontSize: '0.68rem' }}
                >
                  {isDone ? '✓' : idx + 1}
                </div>
                <span className={`mt-1 text-center ${isDone ? 'fw-bold text-primary' : 'text-muted'}`} style={{ fontSize: '0.65rem' }}>
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

  const activeReservation = reservations.find(r => r.status === 'Pending' || r.status === 'Confirmed' || r.status === 'Overdue Check-In');
  const activeBookingStay = bookings.find(b => b.status === 'Pending' || b.status === 'Confirmed' || b.status === 'Overdue Check-In' || b.status === 'Checked In');

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
              <div className="d-flex align-items-center gap-2">
                <span className="fw-semibold text-white px-2.5 py-1 rounded-pill d-flex align-items-center gap-1.5" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', border: '1px solid rgba(255, 255, 255, 0.35)', fontSize: '0.82rem' }}>
                  {guest?.profilePicture ? (
                    <img
                      src={guest.profilePicture}
                      alt="Avatar"
                      className="rounded-circle border border-white flex-shrink-0"
                      style={{ width: '22px', height: '22px', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      className="rounded-circle bg-white text-pcc-blue fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: '22px', height: '22px', fontSize: '0.65rem' }}
                    >
                      {guest?.firstName ? guest.firstName.charAt(0).toUpperCase() : 'G'}
                    </div>
                  )}
                  {guest.firstName} {guest.lastName}
                </span>
                <button
                  className="btn btn-sm text-white border-0"
                  title="Log Out"
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
                <button className="btn btn-sm btn-outline-secondary fw-semibold d-flex align-items-center gap-1" onClick={() => setViewMode('default')}>
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
                <button className="btn btn-outline-pcc-blue btn-sm m-auto" onClick={fetchRoomsAndStatus}>
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
                                className="btn btn-xs btn-outline-secondary py-1.5 px-2.5 shadow-xs"
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
                                className="btn btn-xs btn-outline-secondary py-1.5 px-2.5 shadow-xs"
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
                                  className="btn btn-xs btn-outline-secondary py-1.5 px-2.5 shadow-xs"
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
                      <h3 className="fw-bold mb-1">Welcome, {guest.firstName}! <span className="fs-6 font-monospace opacity-75 fw-normal">(User ID: #{guest.userID || guest.guestID})</span></h3>
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
                  <div className="card shadow-sm border-0 border-start border-4 border-success p-3 mb-4 bg-white" style={{ borderRadius: '12px' }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <span className="badge bg-success text-white mb-1">Active Reservation Request</span>
                        <h6 className="fw-bold mb-0 text-dark">Room {activeReservation.roomNumber} ({activeReservation.roomType})</h6>
                        <div className="small text-muted mb-2">Check-in: {formatDate(activeReservation.reservationDateTime)}</div>
                        {renderBookingStatusTimeline(activeReservation.status)}
                      </div>
                      <div className="d-flex align-items-center gap-2 ms-2">
                        <button 
                          className="btn btn-sm btn-success text-white fw-bold px-3 py-1.5 shadow-sm d-inline-flex align-items-center" 
                          onClick={() => handleProceedToBooking(activeReservation)}
                        >
                          <i className="bi bi-calendar-check me-1"></i>Proceed to Booking
                        </button>
                        <button className="btn btn-sm btn-outline-danger fw-bold px-3 py-1.5 shadow-sm" onClick={() => handleCancelReservation(activeReservation.reservationID)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeBookingStay && (
                  <div className="card shadow-sm border-0 border-start border-4 border-primary p-3 mb-4 bg-white" style={{ borderRadius: '12px' }}>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="w-100">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                          <span className="badge bg-primary text-white px-2.5 py-1">Active Stay Booking ({formatBookingID(activeBookingStay.bookingID)})</span>
                          <div className="d-flex flex-wrap gap-1.5 align-items-center">
                            <button
                              type="button"
                              className="btn btn-xs btn-outline-warning text-dark fw-semibold px-2 py-1 text-decoration-none shadow-xs"
                              onClick={() => setActiveTab('orders')}
                            >
                              <i className="bi bi-cup-hot me-1 text-warning"></i> Order Food
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-outline-primary fw-semibold px-2 py-1"
                              onClick={() => {
                                fetchDetailedBill(activeBookingStay.bookingID);
                                setShowBillModal(true);
                              }}
                            >
                              <i className="bi bi-receipt me-1"></i> Live Bill
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-outline-secondary fw-semibold px-2 py-1"
                              onClick={() => {
                                fetchDetailedBill(activeBookingStay.bookingID);
                                setShowAuditTrailModal(true);
                              }}
                            >
                              <i className="bi bi-clock-history me-1"></i> Audit Trail
                            </button>
                            {parseFloat(activeBookingStay.remainingBalance || 0) > 0 && (
                              <button
                                className="btn btn-xs btn-success text-white fw-bold px-2.5 py-1"
                                onClick={() => setSettleBooking(activeBookingStay)}
                              >
                                Pay (₱{parseFloat(activeBookingStay.remainingBalance).toFixed(2)})
                              </button>
                            )}
                          </div>
                        </div>
                        <h6 className="fw-bold mb-1 text-dark">Room {activeBookingStay.roomNumber} ({activeBookingStay.roomType})</h6>

                        {/* GUEST BILLING BREAKDOWN CARD */}
                        <div className="card border rounded-3 p-3 bg-light-subtle my-3">
                          <div className="d-flex justify-content-between align-items-center mb-2.5 pb-2 border-bottom">
                            <div className="fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: '0.90rem' }}>
                              <i className="bi bi-receipt-cutoff text-primary fs-6"></i>
                              <span>Stay Billing Breakdown</span>
                            </div>
                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2.5 py-1" style={{ fontSize: '0.74rem' }}>
                              {detailedBill?.booking?.status || activeBookingStay.status}
                            </span>
                          </div>

                          {loadingBill ? (
                            <div className="text-center py-3 text-muted small">
                              <span className="spinner-border spinner-border-sm text-primary me-2"></span>
                              <span>Loading itemized billing details...</span>
                            </div>
                          ) : (
                            <div className="d-flex flex-column gap-2" style={{ fontSize: '0.82rem' }}>
                              {/* 1. Room Charges */}
                              <div className="p-2.5 bg-white rounded border">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                  <span className="fw-semibold text-dark">
                                    <i className="bi bi-door-closed me-1.5 text-primary"></i>
                                    {detailedBill?.booking?.roomType || activeBookingStay.roomType || 'Room'} ({detailedBill?.nights || detailedBill?.chargesBreakdown?.room?.nights || 1} Night(s))
                                  </span>
                                  <span className="fw-bold text-dark">
                                    ₱{parseFloat(detailedBill?.chargesBreakdown?.room?.finalRoomCharge || detailedBill?.finalRoomCharge || (activeBookingStay.rate * (detailedBill?.nights || 1)) || 0).toFixed(2)}
                                  </span>
                                </div>
                                <div className="text-muted small d-flex flex-wrap gap-2" style={{ fontSize: '0.74rem' }}>
                                  <span>Rate: ₱{parseFloat(detailedBill?.chargesBreakdown?.room?.rate || activeBookingStay.rate || 0).toFixed(2)}/night</span>
                                  <span>• Breakfast: <strong className="text-dark">{detailedBill?.booking?.breakfastOption === 'without' ? 'Without Breakfast' : 'With Breakfast Included'}</strong></span>
                                  {(detailedBill?.chargesBreakdown?.additionalFees?.extraGuestsCount > 0) && (
                                    <span>• Extra Pax: {detailedBill.chargesBreakdown.additionalFees.extraGuestsCount} (₱{parseFloat(detailedBill.chargesBreakdown.additionalFees.extraGuestFee).toFixed(2)})</span>
                                  )}
                                </div>
                              </div>

                              {/* 2. Cooked Meals */}
                              {((detailedBill?.chargesBreakdown?.orders?.products || []).some(p => p.productCategoryID === 3 || (p.name && p.name.toLowerCase().includes('breakfast')))) && (
                                <div className="p-2.5 bg-white rounded border">
                                  <div className="d-flex justify-content-between align-items-center mb-1">
                                    <span className="fw-semibold text-dark">
                                      <i className="bi bi-cup-hot me-1.5 text-warning"></i>Cooked Breakfast Meals
                                    </span>
                                    <span className="fw-bold text-dark">
                                      ₱{parseFloat(
                                        (detailedBill?.chargesBreakdown?.orders?.products || [])
                                          .filter(p => p.productCategoryID === 3 || (p.name && p.name.toLowerCase().includes('breakfast')))
                                          .reduce((sum, p) => sum + (parseFloat(p.price) * p.quantity), 0)
                                      ).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="d-flex flex-column gap-0.5" style={{ fontSize: '0.74rem' }}>
                                    {(detailedBill?.chargesBreakdown?.orders?.products || [])
                                      .filter(p => p.productCategoryID === 3 || (p.name && p.name.toLowerCase().includes('breakfast')))
                                      .map((m, idx) => (
                                        <div key={idx} className="d-flex justify-content-between text-muted">
                                          <span>{m.quantity}x {m.name}</span>
                                          <span>₱{(parseFloat(m.price) * m.quantity).toFixed(2)}</span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}

                              {/* 3. Products & Amenities */}
                              {(((detailedBill?.chargesBreakdown?.orders?.products || []).some(p => p.productCategoryID !== 3 && (!p.name || !p.name.toLowerCase().includes('breakfast')))) ||
                                ((detailedBill?.chargesBreakdown?.orders?.amenities || []).length > 0)) && (
                                <div className="p-2.5 bg-white rounded border">
                                  <div className="d-flex justify-content-between align-items-center mb-1">
                                    <span className="fw-semibold text-dark">
                                      <i className="bi bi-bag-check me-1.5 text-info"></i>Products & Amenities Ordered
                                    </span>
                                    <span className="fw-bold text-dark">
                                      ₱{parseFloat(
                                        ((detailedBill?.chargesBreakdown?.orders?.products || [])
                                          .filter(p => p.productCategoryID !== 3 && (!p.name || !p.name.toLowerCase().includes('breakfast')))
                                          .reduce((sum, p) => sum + (parseFloat(p.price) * p.quantity), 0)) +
                                        ((detailedBill?.chargesBreakdown?.orders?.amenities || [])
                                          .reduce((sum, a) => sum + (parseFloat(a.price) * a.quantity), 0))
                                      ).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="d-flex flex-column gap-0.5" style={{ fontSize: '0.74rem' }}>
                                    {(detailedBill?.chargesBreakdown?.orders?.products || [])
                                      .filter(p => p.productCategoryID !== 3 && (!p.name || !p.name.toLowerCase().includes('breakfast')))
                                      .map((p, idx) => (
                                        <div key={`p-${idx}`} className="d-flex justify-content-between text-muted">
                                          <span>{p.quantity}x {p.name}</span>
                                          <span>₱{(parseFloat(p.price) * p.quantity).toFixed(2)}</span>
                                        </div>
                                      ))}
                                    {(detailedBill?.chargesBreakdown?.orders?.amenities || []).map((a, idx) => (
                                      <div key={`a-${idx}`} className="d-flex justify-content-between text-muted">
                                        <span>{a.quantity}x {a.name}</span>
                                        <span>₱{(parseFloat(a.price) * a.quantity).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 4. Incidental Charges */}
                              <div className="p-2.5 bg-white rounded border">
                                <div className="d-flex justify-content-between align-items-center">
                                  <span className="fw-semibold text-dark">
                                    <i className="bi bi-shield-exclamation me-1.5 text-danger"></i>Incidental Fees & Damages
                                  </span>
                                  <span className="fw-bold text-dark">
                                    ₱{parseFloat(detailedBill?.chargesBreakdown?.incidentalFees?.total || detailedBill?.regularIncidentalTotal || 0).toFixed(2)}
                                  </span>
                                </div>
                                {(detailedBill?.chargesBreakdown?.incidentalFees?.charges || []).length > 0 ? (
                                  <div className="d-flex flex-column gap-0.5 mt-1" style={{ fontSize: '0.74rem' }}>
                                    {(detailedBill?.chargesBreakdown?.incidentalFees?.charges || []).map((inc, idx) => (
                                      <div key={idx} className="d-flex justify-content-between text-danger">
                                        <span>• {inc.description}</span>
                                        <span>₱{parseFloat(inc.amount).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-muted small" style={{ fontSize: '0.72rem' }}>₱0.00 - No incidental damages or penalty charges.</div>
                                )}
                              </div>

                              {/* 5. Totals & Balance Due Summary */}
                              <div className="p-3 bg-white rounded border mt-1">
                                <div className="d-flex justify-content-between mb-1 text-muted">
                                  <span>Gross Total Charges:</span>
                                  <span className="fw-semibold text-dark">
                                    ₱{parseFloat(detailedBill?.balancing?.subtotal || detailedBill?.subtotal || activeBill?.subtotal || 0).toFixed(2)}
                                  </span>
                                </div>
                                {(parseFloat(detailedBill?.chargesBreakdown?.discounts?.total || detailedBill?.totalDiscount || 0) > 0) && (
                                  <div className="d-flex justify-content-between mb-1 text-success">
                                    <span>Discounts Applied:</span>
                                    <span>-₱{parseFloat(detailedBill?.chargesBreakdown?.discounts?.total || detailedBill?.totalDiscount || 0).toFixed(2)}</span>
                                  </div>
                                )}
                                <div className="d-flex justify-content-between mb-1">
                                  <span className="text-muted">Down Payment / Paid Total:</span>
                                  <span className="text-success fw-bold">
                                    ₱{parseFloat(detailedBill?.balancing?.paidTotal || detailedBill?.paidTotal || activeBill?.paidTotal || 0).toFixed(2)}
                                    <span className="badge bg-success-subtle text-success ms-1.5" style={{ fontSize: '0.68rem' }}>Settled</span>
                                  </span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                                  <div>
                                    <span className="fw-bold text-dark fs-6">Balance Due:</span>
                                    <div className="text-muted small" style={{ fontSize: '0.70rem' }}>Payable online or upon checkout</div>
                                  </div>
                                  <div className="text-end">
                                    <span className={`fw-bold fs-5 ${parseFloat(activeBookingStay.remainingBalance || detailedBill?.balancing?.remainingBalance || 0) > 0 ? 'text-danger' : 'text-success'}`}>
                                      ₱{parseFloat(activeBookingStay.remainingBalance || detailedBill?.balancing?.remainingBalance || 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>

                                {parseFloat(activeBookingStay.remainingBalance || detailedBill?.balancing?.remainingBalance || 0) > 0 && (
                                  <button
                                    type="button"
                                    className="btn btn-primary w-100 mt-2.5 fw-bold py-2 shadow-xs d-flex align-items-center justify-content-center gap-2"
                                    style={{ backgroundColor: '#005CE6', borderColor: '#005CE6', borderRadius: '8px', fontSize: '0.88rem' }}
                                    onClick={() => setSettleBooking(activeBookingStay)}
                                  >
                                    <i className="bi bi-credit-card"></i>
                                    <span>Proceed to Pay (₱{parseFloat(activeBookingStay.remainingBalance || detailedBill?.balancing?.remainingBalance || 0).toFixed(2)})</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        {/* REQ165a TIMELINE */}
                        {renderBookingStatusTimeline(activeBookingStay.status)}
                      </div>
                    </div>
                  </div>
                )}

                {/* QUICK ACTION BUTTONS */}
                <h6 className="fw-bold text-dark mb-2.5">Quick Actions</h6>
                <div className="row g-2 mb-4">
                  <div className="col-6 col-lg-2">
                    <button
                      className="btn btn-success text-white fw-bold w-100 touch-action-btn shadow-sm py-2.5"
                      onClick={handleStartReserveFlow}
                    >
                      Reserve Room
                    </button>
                  </div>
                  <div className="col-6 col-lg-2">
                    <button
                      className="btn btn-primary text-white fw-bold w-100 touch-action-btn shadow-sm py-2.5"
                      onClick={handleStartBookFlow}
                    >
                      Book Room
                    </button>
                  </div>
                  <div className="col-6 col-lg-3">
                    <button
                      type="button"
                      className="btn btn-warning text-dark fw-bold w-100 touch-action-btn shadow-sm py-2.5 text-decoration-none d-flex align-items-center justify-content-center gap-1"
                      onClick={() => setActiveTab('orders')}
                    >
                      <i className="bi bi-cup-hot-fill"></i>
                      <span>Room Service Orders</span>
                    </button>
                  </div>
                  <div className="col-6 col-lg-2">
                    <button
                      className="btn btn-secondary text-white fw-bold w-100 touch-action-btn shadow-sm py-2.5"
                      onClick={() => setActiveTab('account')}
                    >
                      My Bookings
                    </button>
                  </div>
                  <div className="col-12 col-lg-3">
                    <button
                      className="btn btn-info text-white fw-bold w-100 touch-action-btn shadow-sm py-2.5"
                      onClick={() => setActiveTab('notifications')}
                    >
                      Alerts ({unreadCount})
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
                <div className="card shadow-sm border-0 p-3 mb-3 bg-white" style={{ borderRadius: '12px' }}>
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
                        <div className="card shadow-sm border-0 p-4 text-center bg-white" style={{ borderRadius: '12px' }}>
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
                                className={`card shadow-sm border-0 h-100 room-card-hover overflow-hidden ${isBookable ? 'cursor-pointer' : 'opacity-85'}`}
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
                                        className="btn btn-xs btn-outline-secondary py-2 px-2.5 flex-grow-1"
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
              <GuestOrdersContent guest={guest} />
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
                    <span className="text-muted small">Stay updated on your stay reservations, bookings, and SOA payments.</span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    {unreadCount > 0 && (
                      <span className="badge bg-danger rounded-pill px-3 py-1.5">{unreadCount} Unread</span>
                    )}
                    {unreadCount > 0 && (
                      <button
                        className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 fw-bold shadow-xs"
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
                    <p className="mb-0 small">Real-time alerts regarding your room bookings and SOA payments will appear here.</p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2.5">
                    {notifications.map((n) => (
                      <div
                        key={n.notificationID}
                        onClick={() => !n.isRead && handleMarkSingleNotificationRead(n.notificationID)}
                        className={`card shadow-sm border-0 p-3.5 transition-all ${
                          !n.isRead ? 'border-start border-4 border-pcc-blue bg-light shadow-sm cursor-pointer' : 'bg-white text-muted'
                        }`}
                        style={{ borderRadius: '14px', cursor: !n.isRead ? 'pointer' : 'default' }}
                      >
                        <div className="d-flex align-items-start gap-3">
                          <div className="rounded-circle p-2.5 d-flex align-items-center justify-content-center bg-white shadow-xs" style={{ width: '42px', height: '42px', flexShrink: 0 }}>
                            <i className={`bi ${getNotificationIcon(n.title)} fs-5`}></i>
                          </div>
                          <div className="flex-grow-1">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <h6 className={`fw-bold mb-0 ${!n.isRead ? 'text-dark' : 'text-secondary'}`} style={{ fontSize: '0.92rem' }}>
                                {n.title}
                              </h6>
                              <div className="d-flex align-items-center gap-2">
                                {!n.isRead && (
                                  <span className="badge bg-primary text-white rounded-pill px-2 py-0.5" style={{ fontSize: '0.65rem' }}>NEW</span>
                                )}
                                <span className="text-muted" style={{ fontSize: '0.74rem' }}>
                                  {new Date(n.createdAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </div>
                            </div>
                            <p className="text-secondary small mb-0" style={{ lineHeight: '1.45' }}>{n.message}</p>
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
                <div className="card shadow-sm border-0 p-4 mb-4 bg-white" style={{ borderRadius: '16px' }}>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center gap-3">
                      {guest?.profilePicture ? (
                        <img
                          src={guest.profilePicture}
                          alt={`${guest.firstName || 'Guest'} Avatar`}
                          className="profile-avatar-img shadow-sm"
                          style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '50%', border: '2px solid var(--pcc-blue)', flexShrink: 0 }}
                        />
                      ) : (
                        <div className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold fs-4 flex-shrink-0" style={{ width: '64px', height: '64px', backgroundColor: 'var(--pcc-blue)' }}>
                          {guest?.firstName ? guest.firstName.charAt(0).toUpperCase() : 'G'}
                        </div>
                      )}
                      <div>
                        <h5 className="fw-bold mb-0 text-dark">{guest.firstName} {guest.lastName} <span className="badge bg-secondary text-white font-monospace ms-1" style={{ fontSize: '0.74rem' }}>User ID: #{guest.userID || guest.guestID}</span></h5>
                        <div className="text-muted small">{guest.email}</div>
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

                {/* MY BOOKINGS HISTORY */}
                <div className="card shadow-sm border-0 p-3 mb-4 bg-white" style={{ borderRadius: '12px' }}>
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
                            className="btn btn-sm btn-outline-secondary py-0 px-2 small"
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
                          <div key={b.bookingID} className="p-3 border rounded bg-light">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div>
                                <h6 className="fw-bold mb-0 text-dark">Booking #{formatBookingID(b.bookingID)} — Room {b.roomNumber} ({b.roomType || 'Room'})</h6>
                                <span className="small text-muted">Remaining Balance: <strong className={remBal > 0 ? 'text-danger' : 'text-success'}>₱{remBal.toFixed(2)}</strong></span>
                              </div>
                              <div className="d-flex gap-1.5 align-items-center">
                                {remBal > 0 && (b.status === 'Pending' || b.status === 'Confirmed' || b.status === 'Checked In') && (
                                  <button
                                    className="btn btn-xs btn-success text-white fw-bold px-2.5 py-1"
                                    onClick={() => setSettleBooking(b)}
                                  >
                                    Pay Balance
                                  </button>
                                )}
                                {(b.status === 'Pending' || b.status === 'Confirmed') && (
                                  <button className="btn btn-xs btn-danger text-white fw-bold px-2.5 py-1" onClick={() => handleCancelBooking(b.bookingID)}>
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </div>
                            {/* REQ165a TIMELINE */}
                            {renderBookingStatusTimeline(b.status)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ACCOUNT ACTION BUTTONS */}
                <div className="d-flex flex-column gap-2 mb-4">
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
                    className="btn btn-pcc-primary text-white text-start p-3 fw-bold d-flex justify-content-between align-items-center shadow-sm"
                    style={{ borderRadius: '10px' }}
                  >
                    <span>Edit Profile Settings</span>
                    <i className="bi bi-pencil-square"></i>
                  </button>
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
        hideFloating={false}
        bottomOffset={isDesktop ? '24px' : '85px'}
      />

      {/* SETTLE REMAINING BALANCE MODAL (REQ167c) */}
      {settleBooking && (
        <div className="modal d-block tab-modal-backdrop" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ backgroundColor: '#198754' }}>
                <h5 className="modal-title fw-bold">Settle Remaining Balance — Booking #{settleBooking.bookingID}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSettleBooking(null)}></button>
              </div>
              <form onSubmit={handleConfirmPayBalance}>
                <div className="modal-body">
                  <div className="alert alert-success py-2 small mb-3">
                    Enter your GCash payment reference number below to settle the remaining balance of <strong>₱{parseFloat(settleBooking.remainingBalance).toFixed(2)}</strong>.
                  </div>

                  <div className="p-3 bg-light rounded border mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Target Booking:</span>
                      <strong className="text-dark">Booking #{settleBooking.bookingID}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Room Number:</span>
                      <strong className="text-dark">Room {settleBooking.roomNumber}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-1 text-danger fw-bold fs-6">
                      <span>Amount Due Now:</span>
                      <span>₱{parseFloat(settleBooking.remainingBalance).toFixed(2)}</span>
                    </div>
                  </div>

                  <DynamicQrPhCode 
                    amount={settleBooking.remainingBalance} 
                    merchantName="JOHN LLOYD CASPILLO"
                    accountNumber="0948-825-1444"
                    refNumber={`SETTLE-${settleBooking.bookingID}`} 
                    bookingID={settleBooking.bookingID}
                    onPaymentSuccess={(autoData) => {
                      showAlert('success', 'Balance Settled', 'Your balance has been verified and settled successfully!');
                      setSettleBooking(null);
                      setSettleGcashRef('');
                      fetchRoomsAndStatus();
                    }}
                    showProceedBtn={true}
                    showCheckStatusBtn={false}
                    showTestPayBtn={true}
                    onProceedToGCash={() => {
                      fetch('/api/payments/paymongo/test', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          bookingID: settleBooking.bookingID,
                          amount: parseFloat(settleBooking.remainingBalance || 0),
                          referenceNumber: `SETTLE-${settleBooking.bookingID}-${Date.now().toString().slice(-4)}`
                        })
                      })
                      .then(r => r.json())
                      .then(d => {
                        if (d.success) {
                          showAlert('success', 'Balance Settled', 'Your payment has been authorized and settled successfully!');
                          setSettleBooking(null);
                          fetchRoomsAndStatus();
                        } else {
                          showAlert('error', 'Payment Error', d.error || 'Failed to process payment');
                        }
                      })
                      .catch(e => showAlert('error', 'Payment Error', e.message));
                    }}
                  />

                  <div className="p-2.5 border rounded bg-white text-center mb-3">
                    <small className="text-muted d-block mb-1">
                      Scan the QR code above with GCash to automatically settle your balance.
                    </small>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary text-white fw-bold" onClick={() => setSettleBooking(null)}>Close</button>
                </div>
              </form>
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
                    fallbackImg="https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80"
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
                  <div className="d-flex justify-content-between mb-1.5 py-0.5">
                    <span className="text-muted">Air Conditioning:</span>
                    <strong>{selectedRoom.isAircon ? 'Included' : 'Fan Only'}</strong>
                  </div>
                  <div className="d-flex justify-content-between py-0.5">
                    <span className="text-muted">Hot Shower:</span>
                    <strong>{selectedRoom.hasHotShower ? 'Available' : 'Standard'}</strong>
                  </div>
                </div>

                  <h6 className="fw-bold text-dark mb-1">Included Amenities &amp; Policies</h6>
                  <ul className="small text-muted mb-0">
                    <li>Free High-Speed Wi-Fi connection</li>
                    <li>Clean towels and basic toiletries included</li>
                    <li>Check-in: 2:00 PM | Check-out: 12:00 PM</li>
                    <li>No smoking allowed inside rooms</li>
                  </ul>
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
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ backgroundColor: '#198754' }}>
                <h5 className="modal-title fw-bold">Reservation Request Form</h5>
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
                    <div className="small text-primary fw-semibold mt-1">Note: Selectable reservation check-in dates are Today, Tomorrow, and Day After Tomorrow (up to 2 days ahead).</div>
                  </div>

                  <div className="mb-3">
                    <DatePicker
                      label="Select Check-In Date *"
                      value={checkInDate}
                      minDate={minReserveDateStr}
                      maxDate={maxReserveDateStr}
                      disabledDates={selectedRoom ? getDisabledDatesForRoom(selectedRoom.roomID) : []}
                      onChange={(newDate) => handleCheckInDateChange(newDate)}
                      helperText="Note: Greyed out dates ('Busy') are already reserved or booked. Reservations are accepted up to 2 days ahead."
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Check-Out Date *</label>
                    <input type="date" className="form-control form-control-sm" min={checkInDate || minReserveDateStr} value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} required />
                  </div>

                  {selectedRoom && checkScheduleConflict(selectedRoom.roomID, checkInDate, checkOutDate) && (
                    <div className="alert alert-danger py-2 px-3 small mb-3">
                      <i className="bi bi-exclamation-triangle-fill me-1.5 fw-bold"></i>
                      <strong>Schedule Conflict:</strong> Room {selectedRoom.roomNumber} is already reserved or booked for the selected date(s). Please choose another date or room.
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Number of Guests *</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      min="1"
                      placeholder="e.g. 2"
                      value={numGuests === '' ? '' : numGuests}
                      onChange={(e) => setNumGuests(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                      required
                    />
                    {selectedRoom && (parseInt(numGuests) || 1) > selectedRoom.occupancyLimit && (
                      <small className="text-primary fw-semibold mt-1 d-block" style={{ fontSize: '0.75rem' }}>
                        ℹ Extra Guest Fee: ₱100/night per guest applied for {(parseInt(numGuests) || 1) - selectedRoom.occupancyLimit} guest(s) exceeding capacity ({selectedRoom.occupancyLimit}).
                      </small>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Special Requests (Optional)</label>
                    <textarea className="form-control form-control-sm" rows="2" placeholder="e.g. Extra pillows, early arrival note" value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)}></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-danger text-white fw-bold" onClick={() => setActiveModal('none')}>Cancel</button>
                  <LoadingButton
                    type="submit"
                    className="btn btn-success text-white fw-bold"
                    isLoading={processing}
                    loadingText="Submitting..."
                    disabled={Boolean(selectedRoom && checkScheduleConflict(selectedRoom.roomID, checkInDate, checkOutDate))}
                  >
                    Submit Reservation Request
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
                <h4 className="fw-bold text-dark">Reservation Request Sent!</h4>
                <p className="text-muted small mb-3">Front Desk will review your reservation request shortly.</p>

                <div className="p-3 bg-light rounded text-start border mb-3" style={{ fontSize: '0.85rem' }}>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Reservation Ref:</span>
                    <span className="fw-bold text-success">#{formatReservationID(reservationSummaryData.reservationID)}</span>
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
                <h5 className="modal-title fw-bold">Online Booking Summary & Guest Details</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal('none')}></button>
              </div>
              <form onSubmit={handleProceedToPayment}>
                <div className="modal-body">
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
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
                    <div className="col-md-6">
                      <div className="p-3 bg-light rounded border h-100">
                        <h6 className="fw-bold text-dark mb-2">Stay Schedule</h6>
                        <div className="mb-3">
                          <DatePicker
                            label="Check-In Date *"
                            value={checkInDate}
                            minDate={minBookDateStr}
                            disabledDates={selectedRoom ? getDisabledDatesForRoom(selectedRoom.roomID) : []}
                            onChange={(newDate) => handleCheckInDateChange(newDate)}
                            helperText="Note: Dates marked as 'Busy' are already booked or reserved."
                          />
                        </div>
                        <div className="mb-2">
                          <label className="form-label mb-0 small text-muted">Check-Out Date *</label>
                          <input type="date" className="form-control form-control-sm" min={checkInDate || minBookDateStr} value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} required />
                        </div>
                        <div className="fw-bold text-primary small">Duration: {nightsCount} Night(s)</div>
                      </div>
                    </div>
                  </div>

                  {selectedRoom && checkScheduleConflict(selectedRoom.roomID, checkInDate, checkOutDate) && (
                    <div className="alert alert-danger py-2 px-3 small mb-3">
                      <i className="bi bi-exclamation-triangle-fill me-1.5 fw-bold"></i>
                      <strong>Schedule Conflict:</strong> Room {selectedRoom.roomNumber} is already booked for the selected date(s). Please select an open date.
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
                          Standard Room Capacity: <strong>Up to {selectedRoom.occupancyLimit} Pax</strong>
                          {extraGuestsCount > 0 && (
                            <span className="text-primary fw-bold ms-1">
                              (+₱{(extraGuestFee).toFixed(2)} for {extraGuestsCount} extra guest(s))
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
                  setActiveModal('none');
                }}></button>
              </div>
              <form onSubmit={handleConfirmGCashBookingPayment}>
                <div className="modal-body">
                  <div className="alert alert-info py-2 small mb-3 d-flex justify-content-between align-items-center">
                    <span>Online payments are processed via <strong>GCash (PayMongo Test Mode)</strong>. Select downpayment below.</span>
                    <span className="badge bg-warning text-dark ms-2">TEST MODE</span>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Select Down Payment Percentage *</label>
                    <div className="btn-group w-100" role="group">
                      <input type="radio" className="btn-check" name="payPct" id="pct30" value="30" checked={paymentOption === '30'} onChange={(e) => setPaymentOption(e.target.value)} />
                      <label className="btn btn-outline-primary fw-bold" htmlFor="pct30">30% Down Payment</label>

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

                  <DynamicQrPhCode 
                    amount={amountToPayNow} 
                    refNumber={`BOOK-${selectedRoom?.roomID || 'PAY'}`}
                    paymentStatus={isGuestGcashSettled ? 'Settled' : 'Pending'}
                    showProceedBtn={true}
                    onProceedToGCash={handlePayMongoCheckout}
                    onPaymentSuccess={async (autoData) => {
                      const ref = autoData?.transactionReference || autoData?.referenceNumber || `GCASH-QR-${Date.now()}`;
                      setIsGuestGcashSettled(true);
                      setGcashRef(ref);
                      setGuestGcashInlineError('');
                      await handleConfirmGCashBookingPayment(null, ref);
                    }}
                    isRedirecting={processing}
                  />

                  {guestGcashInlineError ? (
                    <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                      <i className="bi bi-exclamation-triangle-fill text-danger fs-6"></i>
                      <span>{guestGcashInlineError}</span>
                    </div>
                  ) : isGuestGcashSettled ? (
                    <div className="alert alert-success py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                      <i className="bi bi-check-circle-fill text-success fs-6"></i>
                      <span><strong>GCash Payment Verified:</strong> Reference #{gcashRef}. You may confirm booking.</span>
                    </div>
                  ) : (
                    <div className="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                      <i className="bi bi-info-circle-fill text-warning fs-6"></i>
                      <span><strong>Payment Verification Required:</strong> Please scan QR code with GCash or enter reference number before confirming.</span>
                    </div>
                  )}

                  <div className="p-3 border rounded bg-white text-center mb-3">
                    <div className="mb-2">
                      <label className="form-label fw-semibold small">GCash Reference (Auto-verified via QR or manual input)</label>
                      <input
                        type="text"
                        className="form-control text-center fw-bold"
                        placeholder="Scan QR or enter reference"
                        value={gcashRef}
                        onChange={(e) => {
                          const val = e.target.value;
                          setGcashRef(val);
                          if (val.trim().length >= 6) {
                            setIsGuestGcashSettled(true);
                            setGuestGcashInlineError('');
                          } else {
                            setIsGuestGcashSettled(false);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary text-white fw-bold" onClick={() => {
                    setIsGuestGcashSettled(false);
                    setGuestGcashInlineError('');
                    setGcashRef('');
                    setActiveModal('book_form');
                  }}>Back</button>
                  <LoadingButton 
                    type="submit" 
                    className="btn btn-success text-white fw-bold" 
                    isLoading={processing}
                    loadingText="Processing Payment..."
                  >
                    Confirm Payment (₱{amountToPayNow.toFixed(2)})
                  </LoadingButton>
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
                  <button className="btn btn-primary text-white fw-bold" onClick={handlePrintReceipt}>
                    Print / Download Receipt
                  </button>
                  <button className="btn btn-pcc-primary text-white fw-bold" onClick={() => { setActiveModal('none'); setViewMode('default'); setActiveTab('home'); }}>
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
                          className="btn btn-xs btn-outline-primary py-0.5 px-2 fw-semibold"
                          style={{ fontSize: '0.72rem' }}
                        >
                          {uploadingModalPic ? 'Uploading...' : 'Change Photo'}
                        </label>
                        {editProfileForm.profilePicture && (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline-danger py-0.5 px-2 fw-semibold"
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
                            <td>{item.name}</td>
                            <td>{item.quantity}</td>
                            <td>₱{parseFloat(item.price).toFixed(2)}</td>
                            <td className="text-end fw-semibold">₱{parseFloat(item.subtotal).toFixed(2)}</td>
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
                  <div className="alert alert-success py-2.5 px-3 mb-3 d-flex justify-content-between align-items-center" style={{ fontSize: '0.82rem' }}>
                    <span>
                      <i className="bi bi-tag-fill me-1.5"></i>
                      Discounts / Promotions Applied (Senior Citizen, PWD, Promo):
                    </span>
                    <strong className="fs-6">-₱{parseFloat(detailedBill.totalDiscount || detailedBill.chargesBreakdown?.discounts?.total).toFixed(2)}</strong>
                  </div>
                )}

                {/* 6. FINANCIAL BALANCING CARD */}
                <div className="p-3 bg-light rounded border">
                  <div className="d-flex justify-content-between align-items-center mb-1.5 small">
                    <span className="text-muted">Subtotal (Room + Addl Fees + Incidentals + Orders - Discounts):</span>
                    <strong className="text-dark fs-6">₱{parseFloat(detailedBill.subtotal || detailedBill.balancing?.subtotal || detailedBill.chargesSummary?.total || 0).toFixed(2)}</strong>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-2 small text-success">
                    <span>Paid Total (Down Payment + Subsequent Payments):</span>
                    <strong className="fs-6">₱{parseFloat(detailedBill.paidTotal || detailedBill.balancing?.paidTotal || detailedBill.chargesSummary?.paid || 0).toFixed(2)}</strong>
                  </div>
                  <hr className="my-2" />
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-danger fs-6">Remaining Balance:</span>
                    <span className="fw-bold text-danger fs-5">₱{parseFloat(detailedBill.balance ?? detailedBill.remainingBalance ?? detailedBill.balancing?.remainingBalance ?? 0).toFixed(2)}</span>
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
                    className="btn btn-success text-white fw-bold px-4 shadow-sm"
                    onClick={() => {
                      setShowBillModal(false);
                      setSettleBooking(activeBookingStay);
                    }}
                  >
                    <i className="bi bi-credit-card me-1.5"></i>Pay Balance Online (GCash)
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
