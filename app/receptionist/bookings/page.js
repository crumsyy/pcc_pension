'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { clientCache, CACHE_TTL } from '@/lib/clientCache';
import ModalDialog from '../../components/ModalDialog';
import { toast } from '@/components/ui/toast';
import ModalPortal from '../../components/ModalPortal';
import DateInput, { isValidDate, toDbDate, toUiDate } from '../../components/DateInput';
import CalendarDatePicker from '../../components/CalendarDatePicker';
import ReservationCalendar from '../../components/ReservationCalendar';
import LoadingButton from '../../components/LoadingButton';
import SearchableSelect from '../../components/SearchableSelect';
import DynamicQrPhCode from '../../components/DynamicQrPhCode';
import StatusBadge, { normalizeBookingStatus } from '../../components/StatusBadge';
import { calculateBillingTotals } from '@/lib/billingCalculator';
import BookingBreakfastSelector from '@/app/guest/rooms/BookingBreakfastSelector';
import { getStayNights } from '@/lib/dateUtils';

function calculateAgeFromUiDate(uiDateStr) {
  if (!isValidDate(uiDateStr)) return '';
  const parts = uiDateStr.split('/');
  const birthMonth = parseInt(parts[0], 10) - 1;
  const birthDay = parseInt(parts[1], 10);
  const birthYear = parseInt(parts[2], 10);
  
  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const m = today.getMonth() - birthMonth;
  if (m < 0 || (m === 0 && today.getDate() < birthDay)) {
    age--;
  }
  return age;
}

function calculateAgeFromDbDate(dbDateStr) {
  if (!dbDateStr) return '';
  const dateOnly = dbDateStr.substring(0, 10);
  const parts = dateOnly.split('-');
  if (parts.length !== 3) return '';
  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);
  
  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const m = today.getMonth() - birthMonth;
  if (m < 0 || (m === 0 && today.getDate() < birthDay)) {
    age--;
  }
  return age;
}

function getRoomDisplayImage(imgVal) {
  if (!imgVal) return null;
  const trimmed = String(imgVal).trim();
  if (trimmed && trimmed !== 'null' && trimmed !== 'undefined') {
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr) && arr.length > 0 && arr[0]) return arr[0];
      } catch (e) {}
    }
    const first = trimmed.split(',')[0].trim();
    if (first) return first;
  }
  return null;
}

function BookingsClient() {
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomSchedules, setRoomSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [expandedBookingId, setExpandedBookingId] = useState(null);

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'cancel_reason' | 'manage_guests' | null
  const [cancellingBookingID, setCancellingBookingID] = useState(null);
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [finalizeBillModal, setFinalizeBillModal] = useState({
    isOpen: false,
    booking: null,
    singleDesc: '',
    singleAmount: '',
    processing: false
  });
  const [minDateTime, setMinDateTime] = useState('');
  const [maxDobStr, setMaxDobStr] = useState('');

  const [todayUiDate, setTodayUiDate] = useState('');
  const [todayDbDate, setTodayDbDate] = useState('');
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  useEffect(() => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const year18Ago = today.getFullYear() - 18;
    setMaxDobStr(`${year18Ago}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);

    const tDb = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const tUi = `${pad(today.getMonth() + 1)}/${pad(today.getDate())}/${today.getFullYear()}`;
    setTodayDbDate(tDb);
    setTodayUiDate(tUi);

    const updateCurrentTime = () => {
      const d = new Date();
      setCurrentTimeStr(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    };
    updateCurrentTime();
    const interval = setInterval(updateCurrentTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const [updateCheckInDate, setUpdateCheckInDate] = useState('');
  const [updateCheckInTime, setUpdateCheckInTime] = useState('14:00');
  const [updateCheckOutDate, setUpdateCheckOutDate] = useState('');
  const [updateCheckOutTime, setUpdateCheckOutTime] = useState('12:00');

  const [formData, setFormData] = useState({
    guestID: '',
    roomID: '',
    checkInDateTime: '',
    checkOutDateTime: '',
    status: 'Checked In'
  });

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [downPayment, setDownPayment] = useState('');
  const [paymentMethodID, setPaymentMethodID] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingBooking, setIsUpdatingBooking] = useState(false);
  const [isGcashSettled, setIsGcashSettled] = useState(false);
  const [gcashInlineError, setGcashInlineError] = useState('');
  const [settledPaymentRef, setSettledPaymentRef] = useState('');
  const [walkinGcashRef, setWalkinGcashRef] = useState('');

  const [roomFilterStatus, setRoomFilterStatus] = useState('Available');
  const [downPaymentOption, setDownPaymentOption] = useState('30');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [useCurrentTimeIn, setUseCurrentTimeIn] = useState(false);
  const [updateUseCurrentTimeIn, setUpdateUseCurrentTimeIn] = useState(false);

  const calculateBookingNights = (inDateVal = checkInDate, outDateVal = checkOutDate) => {
    const dbIn = toDbDate(inDateVal);
    const dbOut = toDbDate(outDateVal);
    if (!dbIn || !dbOut) return 1;
    const inD = new Date(dbIn + 'T00:00:00');
    const outD = new Date(dbOut + 'T00:00:00');
    if (isNaN(inD.getTime()) || isNaN(outD.getTime()) || outD <= inD) return 1;
    return Math.max(1, Math.round((outD - inD) / (1000 * 60 * 60 * 24)));
  };

  const isCheckInToday = checkInDate === todayUiDate || (checkInDate && toDbDate(checkInDate) === todayDbDate);
  const isUpdateToday = updateCheckInDate === todayUiDate || (updateCheckInDate && toDbDate(updateCheckInDate) === todayDbDate);

  const isEarlyCheckIn = checkInTime && checkInTime < '14:00' && isCheckInToday;
  let earlyHours = 0;
  let earlyFee = 0;
  if (isEarlyCheckIn) {
    const [h, m] = checkInTime.split(':').map(Number);
    const inMinutes = (h || 0) * 60 + (m || 0);
    const standardInMinutes = 14 * 60;
    earlyHours = Math.max(1, Math.ceil((standardInMinutes - inMinutes) / 60));
    earlyFee = earlyHours * 50;
  }

  const isLateCheckOut = checkOutTime && checkOutTime > '12:00';
  let lateHours = 0;
  let lateFee = 0;
  if (isLateCheckOut) {
    const [h, m] = checkOutTime.split(':').map(Number);
    const outMinutes = (h || 0) * 60 + (m || 0);
    const standardOutMinutes = 12 * 60;
    lateHours = Math.max(1, Math.ceil((outMinutes - standardOutMinutes) / 60));
    lateFee = lateHours * 100;
  }

  const handleCheckInDateChange = (val) => {
    if (val && isValidDate(val)) {
      const dbStr = toDbDate(val);
      if (dbStr) {
        const inDate = new Date(dbStr + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (inDate < today) {
          showAlert('warning', 'Invalid Date', 'Past dates are not allowed for Check-In date. Reverting to today.');
          const pad = (n) => String(n).padStart(2, '0');
          const todayUi = toUiDate(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
          setCheckInDate(todayUi);
          return;
        }

        inDate.setDate(inDate.getDate() + 1);
        const pad = (n) => String(n).padStart(2, '0');
        const nextDayDb = `${inDate.getFullYear()}-${pad(inDate.getMonth() + 1)}-${pad(inDate.getDate())}`;
        setCheckOutDate(toUiDate(nextDayDb));
      }
    }
    setCheckInDate(val);
  };

  // Form states matching unified guest form
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [guestForm, setGuestForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    contact: '',
    email: '',
    gender: 'Male',
    dateOfBirth: ''
  });

  const handleUidChange = (val) => {
    setFormData(prev => ({ ...prev, guestID: val }));
    if (!val) {
      setIsAutoFilled(false);
      return;
    }
    const selected = guests.find(g => String(g.guestID) === String(val));
    if (selected) {
      setGuestForm({
        firstName: selected.firstName || '',
        middleName: selected.middleName || '',
        lastName: selected.lastName || '',
        contact: selected.contact || '',
        email: selected.email || '',
        gender: selected.gender || 'Male',
        dateOfBirth: selected.dateOfBirth ? toUiDate(selected.dateOfBirth) : ''
      });
      setIsAutoFilled(true);
    }
  };

  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [breakfastOption, setBreakfastOption] = useState('with'); // 'with' | 'custom' | 'without'
  const [selectedBreakfastDates, setSelectedBreakfastDates] = useState([]);
  const [availableDiscounts, setAvailableDiscounts] = useState([]);
  const [vatPercentage, setVatPercentage] = useState(0);
  const [numGuestsCount, setNumGuestsCount] = useState(1);
  const [roomGuests, setRoomGuests] = useState([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
  const [discountedGuests, setDiscountedGuests] = useState([]);
  const [managingBooking, setManagingBooking] = useState(null);
  const [managingGuests, setManagingGuests] = useState([]);
  const [isSavingGuests, setIsSavingGuests] = useState(false);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);
  const [downPaymentReceipt, setDownPaymentReceipt] = useState(null);

  // Update Booking Modal State
  const [updatingBooking, setUpdatingBooking] = useState(null);
  const [updateNumGuests, setUpdateNumGuests] = useState(1);

  const openUpdateBookingModal = (b) => {
    const currentGuestCount = b.registeredGuests && b.registeredGuests.length > 0 
      ? b.registeredGuests.length 
      : (parseInt(b.guestCount || b.totalGuests) || 1);

    setUpdatingBooking({ ...b, currentGuestCount });
    setUseCurrentTimeIn(false);

    let inDatePart = '';
    let inTimePart = '14:00';
    if (b.checkInDateTime) {
      const parts = String(b.checkInDateTime).replace('T', ' ').split(' ');
      inDatePart = parts[0] || '';
      if (parts[1]) {
        inTimePart = parts[1].substring(0, 5);
      }
    }
    let outDatePart = '';
    let outTimePart = '12:00';
    if (b.checkOutDateTime) {
      const parts = String(b.checkOutDateTime).replace('T', ' ').split(' ');
      outDatePart = parts[0] || '';
      if (parts[1]) {
        outTimePart = parts[1].substring(0, 5);
      }
    }

    const inUiDate = inDatePart ? toUiDate(inDatePart) : '';
    const outUiDate = outDatePart ? toUiDate(outDatePart) : '';

    // Pre-populate Workspace Date & Times
    setCheckInDate(inUiDate);
    setCheckInTime(inTimePart);
    setCheckOutDate(outUiDate);
    setCheckOutTime(outTimePart);
    setNumGuestsCount(currentGuestCount);

    // Pre-populate Guest Info
    const matchedGuest = guests.find(g => String(g.guestID) === String(b.guestID));
    setGuestForm({
      firstName: b.firstName || matchedGuest?.firstName || '',
      middleName: b.middleName || matchedGuest?.middleName || '',
      lastName: b.lastName || matchedGuest?.lastName || '',
      contact: b.contact || matchedGuest?.contact || '',
      email: b.email || matchedGuest?.email || '',
      gender: b.gender || matchedGuest?.gender || 'Male',
      dateOfBirth: b.dateOfBirth ? toUiDate(b.dateOfBirth) : (matchedGuest?.dateOfBirth ? toUiDate(matchedGuest.dateOfBirth) : '')
    });
    setIsAutoFilled(Boolean(b.guestID));

    // Pre-populate Room Selection
    setSelectedRoomType(b.roomType || '');
    setBreakfastOption(b.breakfastOption || 'with');
    let bDates = [];
    try {
      bDates = typeof b.breakfastDates === 'string' ? JSON.parse(b.breakfastDates || '[]') : (Array.isArray(b.breakfastDates) ? b.breakfastDates : []);
    } catch (e) {
      bDates = [];
    }
    setSelectedBreakfastDates(bDates);
    setFormData({
      guestID: b.guestID ? String(b.guestID) : '',
      roomID: String(b.roomID),
      checkInDateTime: inDatePart ? `${inDatePart} ${inTimePart}:00` : '',
      checkOutDateTime: outDatePart ? `${outDatePart} ${outTimePart}:00` : '',
      status: b.status || 'Checked In'
    });

    // Pre-populate Registered Guests and Discounts
    if (b.registeredGuests && b.registeredGuests.length > 0) {
      setRoomGuests(b.registeredGuests.map(g => ({
        fullName: g.fullName || '',
        age: g.age || 30,
        discountID: g.discountID ? String(g.discountID) : '',
        discountIdNumber: g.discountIdNumber || ''
      })));
      const discOnly = b.registeredGuests
        .filter(g => g.discountID)
        .map(g => ({
          guestName: g.fullName || '',
          discountID: String(g.discountID),
          discountIdNumber: g.discountIdNumber || ''
        }));
      setDiscountedGuests(discOnly);
    } else {
      const primaryFullName = `${b.firstName || ''} ${b.middleName ? b.middleName + ' ' : ''}${b.lastName || ''}`.trim();
      setRoomGuests([{
        fullName: primaryFullName,
        age: 30,
        discountID: '',
        discountIdNumber: ''
      }]);
      setDiscountedGuests([]);
    }

    setActiveModal('update_booking');
  };

  const handleUpdateBookingSubmit = async (e) => {
    e.preventDefault();
    if (!updatingBooking) return;

    if (!guestForm.email || !guestForm.email.trim()) {
      showAlert('error', 'Validation Error', 'Email address is required for walk-in guests to receive booking confirmation and official receipt.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestForm.email.trim())) {
      showAlert('error', 'Validation Error', 'Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    const newNumGuests = parseInt(numGuestsCount) || 1;
    if (newNumGuests < 1) {
      showAlert('error', 'Validation Error', 'Number of guests must be at least 1.');
      return;
    }

    if (!isValidDate(checkInDate) || !isValidDate(checkOutDate)) {
      showAlert('error', 'Validation Error', 'Please enter valid Check-In and Check-Out dates (MM/DD/YYYY).');
      return;
    }

    const newInD = new Date(toDbDate(checkInDate) + 'T' + checkInTime + ':00');
    const newOutD = new Date(toDbDate(checkOutDate) + 'T' + checkOutTime + ':00');

    if (newOutD <= newInD) {
      showAlert('error', 'Validation Error', 'Check-out time must be later than check-in time.');
      return;
    }

    const targetRoomID = formData.roomID || updatingBooking.roomID;
    const updateConflict = checkScheduleConflict(
      targetRoomID,
      checkInDate,
      checkOutDate,
      checkInTime,
      checkOutTime,
      updatingBooking.bookingID
    );
    if (updateConflict) {
      const roomObj = rooms.find(r => String(r.roomID) === String(targetRoomID));
      const roomNum = roomObj ? roomObj.roomNumber : '';
      showAlert(
        'error',
        'Schedule Conflict',
        `Room ${roomNum} is not available for the updated schedule. It has a conflicting ${updateConflict.type} (${updateConflict.id}) scheduled from ${updateConflict.checkIn} to ${updateConflict.checkOut}.`
      );
      return;
    }

    const origInStr = (updatingBooking.checkInDateTime || '').replace(' ', 'T').substring(0, 16);
    const origOutStr = (updatingBooking.checkOutDateTime || '').replace(' ', 'T').substring(0, 16);
    const newInStr = (toDbDate(checkInDate) + 'T' + checkInTime).substring(0, 16);
    const newOutStr = (toDbDate(checkOutDate) + 'T' + checkOutTime).substring(0, 16);

    const isAlreadyPaid = Boolean(
      updatingBooking?.isDownPaymentPaid ||
      (parseFloat(updatingBooking?.downPaymentPaid) > 0) ||
      (parseFloat(updatingBooking?.paidTotal) > 0) ||
      (parseFloat(updatingBooking?.downPaymentAmount || 0) > 0 && ['Payment Completed', 'Confirmed', 'Checked In'].includes(updatingBooking?.status))
    );

    let dpAmount = 0;
    let dpPctNum = parseInt(downPaymentOption) || 50;

    if (!isAlreadyPaid) {
      dpAmount = parseFloat(downPayment);
      if (isNaN(dpAmount) || dpAmount <= 0) {
        showAlert('error', 'Validation Error', 'Please enter a valid payment received amount.');
        return;
      }
      if (String(paymentMethodID) === '2' && !isGcashSettled) {
        setGcashInlineError('Cannot proceed: GCash payment not settled. Please scan and verify the QR payment before saving.');
        showAlert('error', 'Payment Unsettled', 'Cannot proceed: GCash payment not settled. Please scan and verify the QR payment before saving.');
        return;
      }
    }

    const preparedGuests = [];
    const primaryName = `${guestForm.firstName} ${guestForm.middleName ? guestForm.middleName + ' ' : ''}${guestForm.lastName}`.trim() || 'Primary Guest';
    for (let i = 0; i < (parseInt(numGuestsCount) || 1); i++) {
      const disc = discountedGuests[i] || roomGuests[i];
      const gName = disc?.guestName?.trim() || disc?.fullName?.trim();
      const discIdVal = (disc?.discountID && disc.discountID !== 'none' && disc.discountID !== '' && disc.discountID !== 'null') ? disc.discountID : null;
      const promoIdVal = (disc?.promotionID && disc.promotionID !== 'none' && disc.promotionID !== '' && disc.promotionID !== 'null') ? disc.promotionID : null;
      const discNumVal = (disc?.discountIdNumber && disc.discountIdNumber !== 'N/A' && disc.discountIdNumber.trim() !== '') ? disc.discountIdNumber.trim() : null;

      preparedGuests.push({
        fullName: gName || (i === 0 ? primaryName : `Guest #${i + 1}`),
        age: disc?.age ? parseInt(disc.age) : 30,
        discountID: discIdVal,
        promotionID: promoIdVal,
        discountIdNumber: discNumVal
      });
    }

    const executeUpdate = async () => {
      setIsUpdatingBooking(true);
      try {
        const payload = {
          action: 'update_booking',
          bookingID: updatingBooking.bookingID,
          guestID: formData.guestID || null,
          roomID: formData.roomID || updatingBooking.roomID,
          checkInDateTime: toDbDate(checkInDate) + ' ' + checkInTime + ':00',
          checkOutDateTime: toDbDate(checkOutDate) + ' ' + checkOutTime + ':00',
          numGuestsCount: newNumGuests,
          breakfastOption,
          breakfastDates: selectedBreakfastDates,
          guestForm,
          guests: preparedGuests,
          recordDownPayment: !isAlreadyPaid,
          downPaymentAmount: !isAlreadyPaid ? dpAmount : undefined,
          downPaymentPercentage: !isAlreadyPaid ? dpPctNum : undefined,
          paymentMethodID: !isAlreadyPaid ? parseInt(paymentMethodID) : undefined,
          referenceNumber: !isAlreadyPaid ? (settledPaymentRef || null) : undefined
        };
        const res = await fetch('/api/receptionist/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update booking');

        if (!isAlreadyPaid && data.downPaymentRecorded) {
          const roomObj = rooms.find(r => String(r.roomID) === String(formData.roomID || updatingBooking.roomID));
          const guestName = `${guestForm.firstName || ''} ${guestForm.middleName ? guestForm.middleName + ' ' : ''}${guestForm.lastName || ''}`.trim() || 'Guest';
          const pmObj = paymentMethods.find(m => String(m.paymentMethodID) === String(paymentMethodID));

          setDownPaymentReceipt({
            receiptNo: `DP-${Math.floor(Math.random() * 900000 + 100000)}`,
            bookingID: updatingBooking.bookingID,
            date: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
            guestName,
            roomNumber: roomObj?.roomNumber || 'N/A',
            roomType: roomObj?.roomType || 'Standard',
            totalRoomCharge: parseFloat(updatingBooking.roomCharge || dpAmount * 2),
            downPaymentPercentage: dpPctNum,
            requiredDownpayment: dpAmount,
            cashReceived: parseFloat(downPayment || dpAmount),
            change: Math.max(0, parseFloat(downPayment || 0) - dpAmount),
            amountPaid: dpAmount,
            remainingBalance: Math.max(0, parseFloat(updatingBooking.roomCharge || dpAmount * 2) - dpAmount),
            paymentMethodName: pmObj?.paymentMethod || 'Cash'
          });
          setActiveModal('downpayment_receipt');
        } else {
          setActiveModal(null);
          toast.success('Booking Updated', data.message || 'Booking updated successfully!');
          showAlert('success', 'Booking Updated', data.message || 'Booking updated successfully!');
        }
        clientCache.delete('RECEPTIONIST_BOOKINGS');
        fetchData();
      } catch (err) {
        toast.error('Update Failed', err.message);
        showAlert('error', 'Error', err.message);
      } finally {
        setIsUpdatingBooking(false);
      }
    };

    if (datesChanged) {
      const formatDateTimeNice = (dtStr) => {
        if (!dtStr) return 'N/A';
        const str = dtStr.replace('T', ' ');
        const parts = str.split(' ');
        if (parts.length < 2) return str;
        const dateParts = parts[0].split('-');
        if (dateParts.length !== 3) return str;
        const uiDate = `${dateParts[1]}/${dateParts[2]}/${dateParts[0]}`;
        const timeParts = parts[1].substring(0, 5);
        return `${uiDate} ${timeParts}`;
      };

      const origInFormatted = formatDateTimeNice(updatingBooking.checkInDateTime);
      const origOutFormatted = formatDateTimeNice(updatingBooking.checkOutDateTime);
      const newInFormatted = `${checkInDate} ${checkInTime}`;
      const newOutFormatted = `${checkOutDate} ${checkOutTime}`;

      const confirmMessage = (
        <div className="text-start">
          <p className="mb-2 text-dark font-medium">Are you sure you want to update this booking?</p>
          <div className="p-3 bg-light rounded border text-start small mb-2">
            <div className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
              Schedule Update Preview:
            </div>
            <div className="d-flex justify-content-between mb-1 pb-1 border-bottom">
              <span className="text-muted">Original Schedule:</span>
              <span className="fw-semibold text-danger">{origInFormatted} → {origOutFormatted}</span>
            </div>
            <div className="d-flex justify-content-between pt-1">
              <span className="text-muted">New Schedule:</span>
              <span className="fw-bold text-success">{newInFormatted} → {newOutFormatted}</span>
            </div>
          </div>
        </div>
      );
      showConfirm('Confirm Booking Update', confirmMessage, executeUpdate);
    } else {
      executeUpdate();
    }
  };

  const handleOpenFinalizeBillModal = (b) => {
    setFinalizeBillModal({
      isOpen: true,
      booking: b,
      singleDesc: '',
      singleAmount: '',
      processing: false
    });
  };

  const handleSaveFinalBill = async (e) => {
    if (e) e.preventDefault();
    if (!finalizeBillModal.booking) return;

    setFinalizeBillModal(prev => ({ ...prev, processing: true }));
    try {
      const payload = {
        action: 'update_final_billing',
        bookingID: finalizeBillModal.booking.bookingID,
        incidentals: []
      };
      if (finalizeBillModal.singleDesc.trim() && parseFloat(finalizeBillModal.singleAmount) > 0) {
        payload.incidentals.push({
          description: finalizeBillModal.singleDesc.trim(),
          amount: parseFloat(finalizeBillModal.singleAmount)
        });
      }
      const res = await fetch('/api/receptionist/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to finalize bill');

      showAlert('success', 'Bill Ready', data.message || 'Billing has been finalized to Bill Ready and guest notified.');
      const finalizedBooking = finalizeBillModal.booking;
      setFinalizeBillModal({ isOpen: false, booking: null, singleDesc: '', singleAmount: '', processing: false });
      await fetchData();

      const bal = parseFloat(data.finalBalance || finalizedBooking.remainingBalance || 0);
      if (bal > 0) {
        showConfirm(
          'Balance Remaining',
          `Room ${finalizedBooking.roomNumber} has an outstanding balance of ₱${bal.toFixed(2)}. Would you like to proceed to the Payment Terminal now?`,
          () => {
            window.location.href = `/receptionist/bookings/checkout`;
          },
          'Proceed to Pay',
          'Dismiss'
        );
      }
    } catch (err) {
      showAlert('error', 'Error', err.message);
      setFinalizeBillModal(prev => ({ ...prev, processing: false }));
    }
  };

  const handleMarkCompleted = (b) => {
    if (!b) return;
    showConfirm(
      'Complete Checkout',
      `Are you sure you want to mark Booking #${b.bookingID} (Room ${b.roomNumber}) as Completed? This will release the room and mark the stay as departed.`,
      async () => {
        try {
          const res = await fetch('/api/receptionist/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'checkout',
              bookingID: b.bookingID,
              confirmEarlyCheckOut: true
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to complete checkout');

          showAlert('success', 'Stay Completed', `Booking #${b.bookingID} has been completed and Room ${b.roomNumber} is now freed.`);
          fetchData();
        } catch (err) {
          showAlert('error', 'Error', err.message);
        }
      }
    );
  };

  const handlePrintDownPaymentReceipt = () => {
    if (!downPaymentReceipt) return;
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Down Payment Sales Invoice - PCC Home Suite Home</title>
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
            <div class="text-center receipt-title">BOOKING DOWN PAYMENT SALES INVOICE</div>
            <div class="divider"></div>

            <table class="info-table">
              <tr><td>Date/Time:</td><td class="text-right">${downPaymentReceipt.date}</td></tr>
              <tr><td>Sales Invoice No:</td><td class="text-right">#INV-${downPaymentReceipt.receiptNo}</td></tr>
              <tr><td>Booking Ref:</td><td class="text-right">#${downPaymentReceipt.bookingID}</td></tr>
              <tr><td>Payment Method:</td><td class="text-right">${downPaymentReceipt.paymentMethodName}</td></tr>
              <tr><td>Guest Name:</td><td class="text-right bold">${downPaymentReceipt.guestName}</td></tr>
              <tr><td>Room:</td><td class="text-right">Room ${downPaymentReceipt.roomNumber} (${downPaymentReceipt.roomType})</td></tr>
            </table>

            <div class="divider"></div>

            <table class="info-table">
              <tr><td>Gross Subtotal:</td><td class="text-right">₱${parseFloat(downPaymentReceipt.grossSubtotal || downPaymentReceipt.totalRoomCharge).toFixed(2)}</td></tr>
              ${downPaymentReceipt.totalDiscount > 0 ? `<tr><td>Applied Discounts:</td><td class="text-right" style="color: #b91c1c;">-₱${parseFloat(downPaymentReceipt.totalDiscount).toFixed(2)}</td></tr>` : ''}
              <tr class="total-row"><td>NET TOTAL AMOUNT DUE:</td><td class="text-right bold">₱${parseFloat(downPaymentReceipt.netTotal || downPaymentReceipt.grandTotal || downPaymentReceipt.totalRoomCharge).toFixed(2)}</td></tr>
              <tr><td>Required Down Payment (${downPaymentReceipt.downPaymentPercentage}%):</td><td class="text-right">₱${parseFloat(downPaymentReceipt.requiredDownpayment || downPaymentReceipt.amountPaid).toFixed(2)}</td></tr>
              <tr class="total-row"><td>MONEY RECEIVED:</td><td class="text-right">₱${parseFloat(downPaymentReceipt.cashReceived || downPaymentReceipt.amountPaid).toFixed(2)}</td></tr>
              ${downPaymentReceipt.change > 0 ? `<tr><td>Change Issued:</td><td class="text-right">₱${parseFloat(downPaymentReceipt.change).toFixed(2)}</td></tr>` : ''}
              <tr><td>Remaining Balance Due:</td><td class="text-right bold">₱${parseFloat(downPaymentReceipt.remainingBalance).toFixed(2)}</td></tr>
            </table>

            <div class="double-divider"></div>

            <div class="footer">
              <p class="bold" style="margin-bottom: 2px;">Thank you for your reservation!</p>
              <p style="margin: 0;">Please present this receipt upon check-in.</p>
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

  // Custom Modal dialog state
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
    toast.add({
      type: type || 'info',
      title: title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notification'),
      description: message || ''
    });
  };

  const showConfirm = (title, message, onConfirmCallback) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          if (onConfirmCallback) await onConfirmCallback();
        } finally {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      },
      onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  // Cross-window / 2nd monitor GCash payment settlement listener (placed safely below all state & handlers)
  useEffect(() => {
    const onPaymentReceived = (data) => {
      if (data?.type === 'PAYMENT_SETTLED') {
        const isMatch = (updatingBooking && String(data.bookingID) === String(updatingBooking.bookingID)) ||
                        (walkinGcashRef && (String(data.bookingID) === String(walkinGcashRef) || String(data.referenceNumber) === String(walkinGcashRef))) ||
                        (data.bookingID && String(data.bookingID).startsWith('BOOK-'));
        if (isMatch) {
          setIsGcashSettled(true);
          const refCode = data.referenceNumber || data.bookingID || `PM-AUTH-${Date.now().toString().slice(-6)}`;
          setSettledPaymentRef(refCode);
          setGcashInlineError('');
          if (data.amount && parseFloat(data.amount) > 0) {
            setDownPayment(parseFloat(data.amount).toFixed(2));
          }
          if (typeof showAlert === 'function') {
            showAlert('success', 'Payment Settled', `GCash payment verified (${refCode}) from 2nd Monitor.`);
          }
        }
      }
    };

    let channel = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('pcc_payment_sync');
        channel.onmessage = (event) => {
          if (event.data) {
            onPaymentReceived(event.data);
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    const handleStorage = (e) => {
      if (e.key === 'pcc_payment_sync_event' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) {
            onPaymentReceived(parsed);
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) {
        try { channel.close(); } catch (e) {}
      }
      window.removeEventListener('storage', handleStorage);
    };
  }, [updatingBooking, walkinGcashRef, showAlert]);

  const [shouldAnimate, setShouldAnimate] = useState(true);
  const isFirstMount = useRef(true);

  const fetchData = async (isBackground = false) => {
    if (!isBackground && !clientCache.has('RECEPTIONIST_BOOKINGS')) {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/receptionist/bookings');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch bookings');

      setBookings(data.bookings || []);
      setGuests(data.guests || []);
      setRooms(data.rooms || []);
      setAvailableDiscounts(data.discounts || []);
      setPaymentMethods(data.paymentMethods || []);
      if (data.vatPercentage !== undefined) setVatPercentage(parseFloat(data.vatPercentage) || 0);
      if (data.roomSchedules) setRoomSchedules(data.roomSchedules);

      clientCache.set('RECEPTIONIST_BOOKINGS', data, CACHE_TTL.RECEPTIONIST_BOOKINGS);
    } catch (err) {
      if (!isBackground) showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const entry = clientCache.get('RECEPTIONIST_BOOKINGS');
    if (entry) {
      const data = entry.data;
      setBookings(data.bookings || []);
      setGuests(data.guests || []);
      setRooms(data.rooms || []);
      setAvailableDiscounts(data.discounts || []);
      setPaymentMethods(data.paymentMethods || []);
      if (data.vatPercentage !== undefined) setVatPercentage(parseFloat(data.vatPercentage) || 0);
      if (data.roomSchedules) setRoomSchedules(data.roomSchedules);
      setLoading(false);
      setShouldAnimate(false);
      if (entry.isStale) {
        fetchData(true);
      }
    } else {
      if (!isFirstMount.current) {
        setShouldAnimate(true);
      }
      fetchData(false);
    }
    isFirstMount.current = false;

    // Real-time background sync polling every 5 seconds
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchData(true);
      }
    }, 5000);

    const handleFocus = () => fetchData(true);
    const handleCustomRefresh = () => fetchData(true);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('pcc-refresh-bookings', handleCustomRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pcc-refresh-bookings', handleCustomRefresh);
    };
  }, []);

  const openCreateModal = () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    
    const pad = (n) => String(n).padStart(2, '0');
    const todayUiDate = toUiDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    const tomorrowUiDate = toUiDate(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`);
    const currentTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    
    setMinDateTime(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${currentTimeStr}`);
    setUseCurrentTimeIn(false);
    setDownPaymentOption('30');
    setCheckInDate(todayUiDate);
    setCheckInTime('14:00');
    setCheckOutDate(tomorrowUiDate);
    setCheckOutTime('12:00');
    
    setNumGuestsCount(1);
    setIsAutoFilled(false);
    setGuestForm({ firstName: '', middleName: '', lastName: '', contact: '', email: '', gender: 'Male', dateOfBirth: '' });
    setSelectedRoomType('');
    setBreakfastOption('with');
    setSelectedBreakfastDates([toDbDate(todayUiDate)]);
    setFormData({ guestID: '', roomID: '', checkInDateTime: '', checkOutDateTime: '', status: 'Pending Check-in' });
    setRoomGuests([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
    setDiscountedGuests([]);
    setDownPayment('');
    setPaymentMethodID('1');
    setIsGcashSettled(false);
    setGcashInlineError('');
    setSettledPaymentRef('');
    setActiveModal('create');
  };

  const handleRebook = (b) => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    
    const pad = (n) => String(n).padStart(2, '0');
    const todayUiDate = toUiDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    const tomorrowUiDate = toUiDate(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`);
    const currentTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    
    setMinDateTime(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${currentTimeStr}`);
    setUseCurrentTimeIn(false);
    setDownPaymentOption('30');
    setCheckInDate(todayUiDate);
    setCheckInTime('14:00');
    setCheckOutDate(tomorrowUiDate);
    setCheckOutTime('12:00');

    const rebookGuest = guests.find(g => String(g.guestID) === String(b.guestID));
    setGuestForm({
      firstName: b.firstName || rebookGuest?.firstName || '',
      middleName: b.middleName || rebookGuest?.middleName || '',
      lastName: b.lastName || rebookGuest?.lastName || '',
      contact: b.contact || rebookGuest?.contact || '',
      email: b.email || rebookGuest?.email || '',
      gender: b.gender || rebookGuest?.gender || 'Male',
      dateOfBirth: b.dateOfBirth ? toUiDate(b.dateOfBirth) : (rebookGuest?.dateOfBirth ? toUiDate(rebookGuest.dateOfBirth) : '')
    });
    setIsAutoFilled(Boolean(b.guestID));
    setSelectedRoomType(b.roomType || '');
    setBreakfastOption(b.breakfastOption || 'with');
    let bDates = [];
    try {
      bDates = typeof b.breakfastDates === 'string' ? JSON.parse(b.breakfastDates || '[]') : (Array.isArray(b.breakfastDates) ? b.breakfastDates : []);
    } catch (e) {
      bDates = [];
    }
    setSelectedBreakfastDates(bDates);
    setFormData({ guestID: String(b.guestID), roomID: String(b.roomID), checkInDateTime: '', checkOutDateTime: '', status: 'Pending Check-in' });
    setRoomGuests(b.registeredGuests && b.registeredGuests.length > 0 ? b.registeredGuests.map(g => ({ ...g, discountID: '' })) : [{ fullName: b.firstName + ' ' + b.lastName, age: 30, discountID: '', discountIdNumber: '' }]);
    setNumGuestsCount(1);
    setDiscountedGuests([]);
    setDownPayment('');
    setPaymentMethodID('1');
    setIsGcashSettled(false);
    setGcashInlineError('');
    setSettledPaymentRef('');
    setActiveModal('create');
  };

  useEffect(() => {
    if (activeModal !== 'create' && activeModal !== 'update_booking') {
      setIsAutoFilled(false);
      setGuestForm({ firstName: '', middleName: '', lastName: '', contact: '', email: '', gender: 'Male', dateOfBirth: '' });
      setSelectedRoomType('');
      setBreakfastOption('with');
      setSelectedBreakfastDates([]);
      setFormData({ guestID: '', roomID: '', checkInDateTime: '', checkOutDateTime: '', status: 'Checked In' });
      setRoomGuests([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
      setDiscountedGuests([]);
      setPaymentMethodID('1');
      setIsGcashSettled(false);
      setGcashInlineError('');
      setSettledPaymentRef('');
      setWalkinGcashRef('');
    }
  }, [activeModal]);

  useEffect(() => {
    if (activeModal !== 'manage_guests') {
      setManagingBooking(null);
      setManagingGuests([]);
    }
  }, [activeModal]);

  // Synchronize first guest name
  useEffect(() => {
    if (activeModal === 'create' || activeModal === 'update_booking') {
      let name = `${guestForm.firstName} ${guestForm.middleName ? guestForm.middleName + ' ' : ''}${guestForm.lastName}`.trim();
      let calculatedAge = '';
      if (guestForm.dateOfBirth) {
        calculatedAge = calculateAgeFromUiDate(guestForm.dateOfBirth);
      }
      setRoomGuests(prev => {
        const copy = [...prev];
        if (copy.length > 0) {
          copy[0] = { ...copy[0], fullName: name, age: calculatedAge };
        } else {
          copy.push({ fullName: name, age: calculatedAge, discountID: '', discountIdNumber: '' });
        }
        return copy;
      });
    }
  }, [guestForm.firstName, guestForm.middleName, guestForm.lastName, guestForm.dateOfBirth, activeModal]);

  // Synchronize breakfast dates when check-in or check-out dates change
  useEffect(() => {
    if (checkInDate && checkOutDate) {
      const inD = new Date(toDbDate(checkInDate) + 'T00:00:00');
      const outD = new Date(toDbDate(checkOutDate) + 'T00:00:00');
      if (outD > inD) {
        const validRange = [];
        let cur = new Date(inD);
        while (cur < outD) {
          validRange.push(cur.toISOString().split('T')[0]);
          cur.setDate(cur.getDate() + 1);
        }
        if (breakfastOption === 'with') {
          setSelectedBreakfastDates(validRange);
        } else if (breakfastOption === 'custom') {
          setSelectedBreakfastDates(prev => {
            const filtered = (prev || []).filter(d => validRange.includes(d));
            return filtered.length > 0 ? filtered : validRange;
          });
        }
      }
    }
  }, [checkInDate, checkOutDate, breakfastOption]);

  // Auto-calculate downPayment based on selected room, breakfast option, and downpayment percentage tier
  useEffect(() => {
    if ((activeModal === 'create' || activeModal === 'update_booking') && formData.roomID) {
      const selectedRoom = rooms.find(r => String(r.roomID) === String(formData.roomID));
      const perGuestBreakfastRate = selectedRoom?.breakfastRate !== null && selectedRoom?.breakfastRate !== undefined
        ? parseFloat(selectedRoom.breakfastRate)
        : (selectedRoom?.rateWithBreakfast && selectedRoom?.rateWithoutBreakfast
            ? Math.max(0, parseFloat(selectedRoom.rateWithBreakfast) - parseFloat(selectedRoom.rateWithoutBreakfast))
            : 250);

      const baseRoomRate = selectedRoom
        ? (parseFloat(selectedRoom.rateWithoutBreakfast) || parseFloat(selectedRoom.rate) || 0)
        : 0;

      const maxOccupancy = selectedRoom ? (parseInt(selectedRoom.occupancyLimit || selectedRoom.roomBasePax) || 4) : 4;

      let nights = 0;
      if (checkInDate && checkOutDate) {
        const inD = new Date(toDbDate(checkInDate) + 'T00:00:00');
        const outD = new Date(toDbDate(checkOutDate) + 'T00:00:00');
        if (outD > inD) {
          nights = Math.round(Math.abs(outD - inD) / (1000 * 60 * 60 * 24));
        }
      }
      nights = Math.max(1, nights);

      const effectiveDiscGuests = (discountedGuests || []).filter(g => g && g.discountID);
      const totalGuests = Math.max(1, parseInt(numGuestsCount) || effectiveDiscGuests.length || 1);

      const excessGuestsCount = Math.max(0, totalGuests - maxOccupancy);
      const extraGuestFee = excessGuestsCount * 100 * (nights || 1);

      let calculatedBreakfastFee = 0;
      if (breakfastOption === 'with') {
        calculatedBreakfastFee = perGuestBreakfastRate * nights;
      } else if (breakfastOption === 'custom') {
        calculatedBreakfastFee = perGuestBreakfastRate * (selectedBreakfastDates?.length || 0);
      }

      const formattedDiscounts = effectiveDiscGuests
        .filter(g => g.discountID)
        .map(g => {
          const disc = availableDiscounts.find(d => String(d.discountID) === String(g.discountID));
          return {
            name: g.guestName || g.fullName,
            discountID: g.discountID,
            discountIdNumber: g.discountIdNumber,
            rate: disc ? (parseFloat(disc.percentage) / 100) : 0,
            type: disc?.name || 'Special Discount'
          };
        });

      const billing = calculateBillingTotals({
        roomRate: baseRoomRate,
        nights: nights || 1,
        guestCount: totalGuests,
        guestDiscounts: formattedDiscounts,
        extraGuestFee,
        breakfastFee: calculatedBreakfastFee,
        downPaymentPercentage: parseInt(downPaymentOption, 10) || 50
      });

      setDownPayment(billing.requiredDownpayment.toFixed(2));
    }
  }, [
    activeModal,
    formData.roomID,
    breakfastOption,
    selectedBreakfastDates,
    checkInDate,
    checkOutDate,
    checkInTime,
    checkOutTime,
    numGuestsCount,
    downPaymentOption,
    discountedGuests,
    roomGuests,
    rooms,
    availableDiscounts
  ]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Requirement 2: Additional Guests allowed
  const handleAddGuest = () => {
    if (!formData.roomID) {
      showAlert('warning', 'Warning', 'Please select a room first.');
      return;
    }
    setRoomGuests(prev => [...prev, { fullName: '', age: 30, discountID: '', discountIdNumber: '' }]);
  };

  const handleRemoveGuest = (index) => {
    setRoomGuests(prev => prev.filter((_, i) => i !== index));
  };

  const handleGuestChange = (index, field, value) => {
    setRoomGuests(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === 'discountID' && !value) {
        copy[index].discountIdNumber = '';
      }
      return copy;
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!guestForm.firstName.trim() || !guestForm.lastName.trim()) {
      showAlert('error', 'Validation Error', 'First Name and Last Name are required.');
      return;
    }
    if (/\d/.test(guestForm.firstName) || /\d/.test(guestForm.lastName) || (guestForm.middleName && /\d/.test(guestForm.middleName))) {
      showAlert('error', 'Validation Error', 'First name, middle name, and last name must not contain numbers.');
      return;
    }
    if (guestForm.email && guestForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestForm.email.trim())) {
      showAlert('error', 'Validation Error', 'Please enter a valid guest email address.');
      return;
    }
    if (!guestForm.dateOfBirth) {
      showAlert('error', 'Validation Error', 'Birthdate is required.');
      return;
    }
    if (guestForm.dateOfBirth) {
      const calculatedAge = calculateAgeFromUiDate(guestForm.dateOfBirth);
      if (typeof calculatedAge === 'number' && calculatedAge < 18) {
        showAlert('error', 'Validation Error', 'Guest must be at least 18 years old to proceed.');
        return;
      }
    }
    if (guestForm.contact && guestForm.contact.length !== 11) {
      showAlert('error', 'Validation Error', 'Contact number must be exactly 11 digits (e.g. 09XXXXXXXXX).');
      return;
    }

    if (!formData.roomID) {
      showAlert('error', 'Validation Error', 'Please select an available room.');
      return;
    }

    if (!isValidDate(checkInDate) || !isValidDate(checkOutDate)) {
      showAlert('error', 'Validation Error', 'Please enter valid Check-In and Check-Out dates (MM/DD/YYYY).');
      return;
    }

    const inDateObj = new Date(toDbDate(checkInDate) + 'T' + (checkInTime || '14:00') + ':00');
    const outDateObj = new Date(toDbDate(checkOutDate) + 'T' + (checkOutTime || '12:00') + ':00');

    const todayFloor = new Date();
    todayFloor.setHours(0, 0, 0, 0);
    const checkInFloor = new Date(toDbDate(checkInDate) + 'T00:00:00');

    if (checkInFloor < todayFloor) {
      showAlert('error', 'Validation Error', 'Past dates are not allowed for Check-In date. Please select today or a future date.');
      return;
    }

    if (!useCurrentTimeIn && inDateObj < new Date()) {
      showAlert('error', 'Validation Error', 'Scheduled Check-In time has already passed. Please select a valid future time or use "Current time".');
      return;
    }

    if (outDateObj <= inDateObj) {
      showAlert('error', 'Validation Error', 'Check-out time must be later than check-in time.');
      return;
    }

    const inTimeEffective = useCurrentTimeIn ? (currentTimeStr || '14:00') : (checkInTime || '14:00');
    const outTimeEffective = checkOutTime || '12:00';
    const createConflict = checkScheduleConflict(
      formData.roomID,
      checkInDate,
      checkOutDate,
      inTimeEffective,
      outTimeEffective
    );
    if (createConflict) {
      const selectedRoomObj = rooms.find(r => String(r.roomID) === String(formData.roomID));
      const roomNum = selectedRoomObj ? selectedRoomObj.roomNumber : '';
      showAlert(
        'error',
        'Schedule Conflict',
        `Room ${roomNum} is already booked or reserved during this schedule (${createConflict.type} ${createConflict.id} from ${createConflict.checkIn} to ${createConflict.checkOut}). Please select another room or adjust the dates.`
      );
      return;
    }

    const selectedRoom = rooms.find(r => String(r.roomID) === String(formData.roomID));
    const maxOccupancy = selectedRoom ? (parseInt(selectedRoom.occupancyLimit || selectedRoom.roomBasePax) || 4) : 4;

    const preparedGuests = [];
    const primaryName = `${guestForm.firstName} ${guestForm.lastName}`.trim() || 'Primary Guest';
    const validGuests = (discountedGuests || []).filter(g => g && (g.guestName || g.fullName));

    for (let i = 0; i < (parseInt(numGuestsCount) || 1); i++) {
      const disc = validGuests[i];
      const gName = disc?.guestName?.trim() || disc?.fullName?.trim();
      const discIdVal = (disc?.discountID && disc.discountID !== 'none' && disc.discountID !== '' && disc.discountID !== 'null') ? disc.discountID : null;
      const promoIdVal = (disc?.promotionID && disc.promotionID !== 'none' && disc.promotionID !== '' && disc.promotionID !== 'null') ? disc.promotionID : null;
      const discNumVal = (disc?.discountIdNumber && disc.discountIdNumber !== 'N/A' && disc.discountIdNumber.trim() !== '') ? disc.discountIdNumber.trim() : null;

      preparedGuests.push({
        fullName: gName || (i === 0 ? (primaryName || 'Primary Guest') : `Guest #${i + 1}`),
        age: 30,
        discountID: discIdVal,
        promotionID: promoIdVal,
        discountIdNumber: discNumVal
      });
    }

    const perGuestBreakfastRate = selectedRoom?.breakfastRate !== null && selectedRoom?.breakfastRate !== undefined
      ? parseFloat(selectedRoom.breakfastRate)
      : (selectedRoom?.rateWithBreakfast && selectedRoom?.rateWithoutBreakfast
          ? Math.max(0, parseFloat(selectedRoom.rateWithBreakfast) - parseFloat(selectedRoom.rateWithoutBreakfast))
          : 250);

    const baseRoomRate = selectedRoom
      ? (parseFloat(selectedRoom.rateWithoutBreakfast) || parseFloat(selectedRoom.rate) || 0)
      : 0;

    let nights = 0;
    if (checkInDate && checkOutDate) {
      const inD = new Date(toDbDate(checkInDate) + 'T00:00:00');
      const outD = new Date(toDbDate(checkOutDate) + 'T00:00:00');
      if (outD > inD) {
        nights = Math.round(Math.abs(outD - inD) / (1000 * 60 * 60 * 24));
      }
    }
    nights = Math.max(1, nights);

    const excessGuestsCount = Math.max(0, (parseInt(numGuestsCount) || 1) - maxOccupancy);
    const extraGuestFee = excessGuestsCount * 100 * nights;

    const totalGuests = Math.max(1, parseInt(numGuestsCount) || 1);

    let calculatedBreakfastFee = 0;
    if (breakfastOption === 'with') {
      calculatedBreakfastFee = perGuestBreakfastRate * nights;
    } else if (breakfastOption === 'custom') {
      calculatedBreakfastFee = perGuestBreakfastRate * (selectedBreakfastDates?.length || 0);
    }

    const dpPctNum = parseInt(downPaymentOption) || 50;
    const billing = calculateBillingTotals({
      roomRate: baseRoomRate,
      nights,
      guestCount: totalGuests,
      guestDiscounts: [], // Initial booking creation starts with 0 discount; discounts are applied in Receptionist Billing
      extraGuestFee,
      breakfastFee: calculatedBreakfastFee,
      earlyFee,
      lateFee,
      downPaymentPercentage: dpPctNum
    });

    const netRoomStayCharge = billing.netRoomStayCharge;
    const grossSubtotal = billing.grossSubtotal;
    const netSubtotal = billing.netTotal;
    const grandTotal = billing.netTotal;
    const requiredDownpayment = billing.requiredDownpayment;

    const dpAmount = parseFloat(downPayment);
    if (isNaN(dpAmount) || dpAmount <= 0) {
      showAlert('error', 'Validation Error', 'Please enter a valid payment received amount.');
      return;
    }
    if (dpAmount < requiredDownpayment - 0.05) {
      showAlert('error', 'Validation Error', `Payment received (₱${dpAmount.toFixed(2)}) cannot be below the selected ${dpPctNum}% requirement of ₱${requiredDownpayment.toFixed(2)} on total charges.`);
      return;
    }

    if (String(paymentMethodID) === '2' && !isGcashSettled) {
      setGcashInlineError('Cannot proceed: GCash payment not settled. Please scan and verify the QR payment before saving.');
      showAlert('error', 'Payment Unsettled', 'Cannot proceed: GCash payment not settled. Please scan and verify the QR payment before saving.');
      return;
    }

    // Format Check-in timestamp cleanly based on useCurrentTimeIn
    let finalCheckInDateTime = toDbDate(checkInDate) + ' ' + checkInTime + ':00';
    if (useCurrentTimeIn) {
      const localNow = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      finalCheckInDateTime = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;
    }

    const isWalkIn = !formData.guestID;

    showConfirm('Create Booking', 'Are you sure you want to save this booking and record the down payment?', async () => {
      setIsSubmitting(true);
      try {
        const res = await fetch('/api/receptionist/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            isWalkIn,
            guestID: formData.guestID || null,
            firstName: guestForm.firstName,
            middleName: guestForm.middleName || null,
            lastName: guestForm.lastName,
            contact: guestForm.contact,
            email: guestForm.email,
            gender: guestForm.gender || 'Male',
            dateOfBirth: guestForm.dateOfBirth ? toDbDate(guestForm.dateOfBirth) : null,
            roomID: formData.roomID,
            checkInDateTime: finalCheckInDateTime,
            checkOutDateTime: toDbDate(checkOutDate) + ' ' + checkOutTime + ':00',
            status: useCurrentTimeIn ? 'Checked In' : 'Pending Check-in',
            useCurrentTime: Boolean(useCurrentTimeIn),
            useCurrentTimeIn: Boolean(useCurrentTimeIn),
            useCurrentTimeOut: false,
            earlyFee,
            earlyHours,
            lateFee,
            lateHours,
            roomRate: baseRoomRate,
            roomCharge: netRoomStayCharge,
            breakfastOption,
            breakfastDates: selectedBreakfastDates,
            breakfastFee: calculatedBreakfastFee,
            netTotalAmount: billing.netTotal,
            downPaymentAmount: dpAmount,
            downPaymentPercentage: dpPctNum,
            paymentMethodID: parseInt(paymentMethodID),
            paymentStatus: String(paymentMethodID) === '2' ? 'Settled' : 'Settled',
            isGcashSettled: String(paymentMethodID) === '2' ? isGcashSettled : true,
            referenceNumber: settledPaymentRef || null,
            guests: preparedGuests
          })
        });
        const contentType = res.headers.get('content-type') || '';
        let data = {};
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const text = await res.text();
          throw new Error(text && text.length < 200 ? text : `Server error (${res.status} ${res.statusText || 'Response'})`);
        }
        if (!res.ok) throw new Error(data.error || 'Failed to create booking');

        const roomObj = rooms.find(r => String(r.roomID) === String(formData.roomID));
        const guestObj = isWalkIn ? null : guests.find(g => String(g.guestID) === String(formData.guestID));
        const guestName = `${guestForm.firstName || ''} ${guestForm.middleName ? guestForm.middleName + ' ' : ''}${guestForm.lastName || ''}`.trim() || (guestObj ? `${guestObj.firstName} ${guestObj.lastName}` : 'Guest');

        const pmObj = paymentMethods.find(m => String(m.paymentMethodID) === String(paymentMethodID));
        const receiptTotalAmount = grandTotal;

        setDownPaymentReceipt({
          receiptNo: `DP-${Math.floor(Math.random() * 900000 + 100000)}`,
          bookingID: data.bookingID || 'N/A',
          date: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
          guestName,
          roomNumber: roomObj?.roomNumber || 'N/A',
          roomType: roomObj?.roomType || 'Standard',
          grossSubtotal: billing.grossSubtotal,
          totalDiscount: billing.totalPerCapitaDiscount || 0,
          netTotal: netSubtotal,
          vatRate: 0.00,
          vatAmount: 0.00,
          grandTotal: netSubtotal,
          totalRoomCharge: receiptTotalAmount,
          downPaymentPercentage: dpPctNum,
          requiredDownpayment: dpAmount,
          cashReceived: parseFloat(downPayment || dpAmount),
          change: Math.max(0, parseFloat(downPayment || 0) - dpAmount),
          amountPaid: dpAmount,
          remainingBalance: Math.max(0, receiptTotalAmount - dpAmount),
          paymentMethodName: pmObj?.paymentMethod || 'Cash'
        });

        toast.success('Booking Created', `Booking #${data.bookingID || ''} created successfully with down payment.`);
        showAlert('success', 'Booking Created', `Booking #${data.bookingID || ''} created successfully with down payment.`);
        setActiveModal('downpayment_receipt');
        clientCache.delete('RECEPTIONIST_BOOKINGS');
        clientCache.delete('RECEPTIONIST_RESERVATIONS');
        fetchData();
      } catch (err) {
        toast.error('Booking Failed', err.message);
        showAlert('error', 'Error', err.message);
      } finally {
        setIsSubmitting(false);
      }
    });
  };



  const handleCheckIn = (id) => {
    const performCheckIn = async (isEarlyConfirmed = false) => {
      try {
        const res = await fetch('/api/receptionist/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'checkin',
            bookingID: id,
            confirmEarlyCheckIn: isEarlyConfirmed
          })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to check in');

        if (data.requiresEarlyCheckInConfirmation) {
          showConfirm(
            'Early Check-In Confirmation',
            `Standard check-in time is 2:00 PM. Are you sure you want to proceed with Early Check-In? An additional early check-in fee of ₱${parseFloat(data.earlyFee).toFixed(2)} (${data.earlyHours} hour(s) @ ₱50/hr) will be automatically added to the guest's bill.`,
            async () => {
              await performCheckIn(true);
            }
          );
          return;
        }

        toast.success('Check-In Complete', data.message || 'Guest checked in successfully.');
        showAlert('success', 'Success', data.message || 'Guest checked in successfully.');
        fetchData();
      } catch (err) {
        toast.error('Check-In Failed', err.message);
        showAlert('error', 'Error', err.message);
      }
    };

    showConfirm('Process Check-In', 'Check in this guest now?', async () => {
      await performCheckIn(false);
    });
  };

  const handleCheckOut = (id) => {
    const performCheckOut = async (isEarlyConfirmed = false) => {
      try {
        const res = await fetch('/api/receptionist/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'checkout',
            bookingID: id,
            confirmEarlyCheckOut: isEarlyConfirmed
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to check out');

        if (data.requiresEarlyCheckOutConfirmation) {
          showConfirm(
            'Early Check-Out Confirmation',
            data.message || "Are you sure you want to checkout even if it's still not the checkout time yet.",
            async () => {
              await performCheckOut(true);
            }
          );
          return;
        }

        toast.success('Check-Out Complete', data.message || 'Guest checked out successfully.');
        showAlert('success', 'Success', data.message || 'Guest checked out successfully.');
        fetchData();
      } catch (err) {
        toast.error('Check-Out Failed', err.message);
        showAlert('error', 'Error', err.message);
      }
    };

    showConfirm('Process Check-Out', 'Check out this guest now and free up the room?', async () => {
      await performCheckOut(false);
    });
  };

  const [cancellingBookingObj, setCancellingBookingObj] = useState(null);

  const openCancelModal = (b) => {
    setCancellingBookingObj(b);
    setCancellingBookingID(b.bookingID);
    setCancelRemarks('');
    setActiveModal('cancel_reason');
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancellingBookingID || isCancellingBooking) return;
    if (!cancelRemarks.trim()) {
      showAlert('error', 'Validation Error', 'Please enter cancellation remarks.');
      return;
    }

    setIsCancellingBooking(true);
    try {
      const res = await fetch('/api/receptionist/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          bookingID: cancellingBookingID,
          cancelRemarks
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel booking');

      toast.success('Booking Cancelled', data.message || 'Booking cancelled successfully.');
      showAlert('success', 'Booking Cancelled', data.message || 'Booking cancelled successfully.');
      setActiveModal(null);
      setCancellingBookingObj(null);
      fetchData();
    } catch (err) {
      toast.error('Cancellation Failed', err.message);
      showAlert('error', 'Error', err.message);
    } finally {
      setIsCancellingBooking(false);
    }
  };

  const handleSaveGuestsSubmit = async (e) => {
    e.preventDefault();
    if (!managingBooking || isSavingGuests) return;

    for (let i = 0; i < managingGuests.length; i++) {
      const g = managingGuests[i];
      if (!g.fullName.trim()) {
        showAlert('error', 'Validation Error', `Guest #${i + 1} full name is required.`);
        return;
      }
      if (!g.age || parseInt(g.age) <= 0) {
        showAlert('error', 'Validation Error', `Guest #${i + 1} valid age is required.`);
        return;
      }
    }

    setIsSavingGuests(true);
    try {
      const res = await fetch('/api/receptionist/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manage_guests',
          bookingID: managingBooking.bookingID,
          guests: managingGuests
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update guests');

      showAlert('success', 'Guests Updated', data.message || 'Room guests updated successfully.');
      setActiveModal(null);
      setManagingBooking(null);
      fetchData();
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setIsSavingGuests(false);
    }
  };

  const isHistoricalBooking = (status) => ['Completed', 'Checked Out', 'Cancelled', 'No Show'].includes(status);

  const activeBookingsCount = bookings.filter(b => !isHistoricalBooking(b.status)).length;
  const historyBookingsCount = bookings.filter(b => isHistoricalBooking(b.status)).length;

  const filteredBookings = bookings.filter(b => {
    const fullName = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase();
    const contact = (b.contact || '').toLowerCase();
    const roomNum = (b.roomNumber || '').toString().toLowerCase();
    const bookingIdStr = (b.bookingID || '').toString();
    const matchesSearch = fullName.includes(search.toLowerCase()) || 
                          contact.includes(search.toLowerCase()) || 
                          roomNum.includes(search.toLowerCase()) ||
                          bookingIdStr.includes(search.toLowerCase());
    
    // Tab separation: Active Stays vs Historical Log
    if (activeTab === 'active' && isHistoricalBooking(b.status)) return false;
    if (activeTab === 'history' && !isHistoricalBooking(b.status)) return false;

    let matchesStatus = true;
    if (statusFilter) {
      matchesStatus = normalizeBookingStatus(b.status) === normalizeBookingStatus(statusFilter);
    }
    return matchesSearch && matchesStatus;
  }).sort((a, b) => (parseInt(b.bookingID, 10) || 0) - (parseInt(a.bookingID, 10) || 0));

  const checkScheduleConflict = (roomId, inDate, outDate, inTime = '14:00', outTime = '12:00', currentBookingId = null) => {
    if (!roomId || !inDate) return null;
    const dbIn = toDbDate(inDate);
    const dbOut = outDate ? toDbDate(outDate) : null;
    if (!dbIn || !dbOut) return null;

    const reqIn = new Date(`${dbIn}T${inTime || '14:00'}:00`);
    const reqOut = new Date(`${dbOut}T${outTime || '12:00'}:00`);
    if (isNaN(reqIn.getTime()) || isNaN(reqOut.getTime()) || reqOut <= reqIn) return null;

    // Check roomSchedules (all active bookings and active reservations)
    if (roomSchedules && roomSchedules.length > 0) {
      const conflictSched = roomSchedules.find(sched => {
        if (String(sched.roomID) !== String(roomId)) return false;
        if (currentBookingId && String(sched.bookingID) === String(currentBookingId)) return false;
        if (['Cancelled', 'Canceled', 'Checked Out', 'No Show', 'Released', 'Completed'].includes(sched.status)) return false;
        const sIn = new Date((sched.checkInDateTime || '').replace(' ', 'T'));
        const sOut = new Date((sched.checkOutDateTime || '').replace(' ', 'T'));
        if (isNaN(sIn.getTime()) || isNaN(sOut.getTime())) return false;
        return sIn < reqOut && sOut > reqIn;
      });
      if (conflictSched) {
        const isRes = conflictSched.type === 'reservation' || conflictSched.reservationID;
        const typeLabel = isRes ? (conflictSched.isCourtesyHold || conflictSched.status === 'Courtesy Hold' ? 'Courtesy Hold' : 'Reservation') : 'Booking';
        const idLabel = isRes ? `#${conflictSched.reservationID}` : `#${conflictSched.bookingID}`;
        return {
          conflict: true,
          type: typeLabel,
          id: idLabel,
          checkIn: conflictSched.checkInDateTime,
          checkOut: conflictSched.checkOutDateTime,
          status: conflictSched.status
        };
      }
    }

    // Also check bookings in state
    if (bookings && bookings.length > 0) {
      const conflictBooking = bookings.find(b => {
        if (String(b.roomID) !== String(roomId)) return false;
        if (currentBookingId && String(b.bookingID) === String(currentBookingId)) return false;
        if (['Cancelled', 'Canceled', 'Checked Out', 'No Show', 'Completed'].includes(b.status)) return false;
        const bIn = new Date((b.checkInDateTime || '').replace(' ', 'T'));
        const bOut = new Date((b.checkOutDateTime || '').replace(' ', 'T'));
        if (isNaN(bIn.getTime()) || isNaN(bOut.getTime())) return false;
        return bIn < reqOut && bOut > reqIn;
      });
      if (conflictBooking) {
        return {
          conflict: true,
          type: 'Booking',
          id: `#${conflictBooking.bookingID}`,
          checkIn: conflictBooking.checkInDateTime,
          checkOut: conflictBooking.checkOutDateTime,
          status: conflictBooking.status
        };
      }
    }

    return null;
  };

  const isRoomAvailableForDates = (roomID, inDateStr, outDateStr, isCurrentTime = false, inTime = '14:00', outTime = '12:00', excludeBookingId = null) => {
    const room = rooms.find(r => String(r.roomID) === String(roomID));
    if (!room) return false;

    if (['Maintenance', 'Under Maintenance', 'Out of Order', 'Disabled'].includes(room.status)) {
      return false;
    }

    if (!inDateStr || !outDateStr) {
      return room.status === 'Available';
    }

    const checkTimeIn = isCurrentTime ? (currentTimeStr || '14:00') : (inTime || '14:00');
    const checkTimeOut = outTime || '12:00';
    const conflict = checkScheduleConflict(roomID, inDateStr, outDateStr, checkTimeIn, checkTimeOut, excludeBookingId);
    return !conflict;
  };

  const getStatusBadge = (status) => {
    const norm = normalizeBookingStatus(status);
    switch (norm) {
      case 'Pending': return 'bg-secondary text-white';
      case 'Active Stay': return 'bg-primary text-white';
      case 'Bill Finalized': return 'badge-purple text-white';
      case 'Paid': return 'bg-success text-white';
      case 'Completed': return 'bg-dark text-white';
      case 'Cancelled': return 'bg-danger text-white';
      default: return 'bg-primary text-white';
    }
  };

  const selectedRoomObj = rooms.find(r => String(r.roomID) === String(formData.roomID));

  return (
    <div className={`container-fluid py-3 ${shouldAnimate ? 'pcc-content-reveal' : ''}`}>
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

      <div className="d-flex justify-content-end align-items-center mb-3">
        <button className="btn btn-pcc-primary text-white shadow-sm fw-bold" onClick={openCreateModal}>
          + New Booking
        </button>
      </div>


      {/* TABS: ACTIVE VS HISTORICAL LOG */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <button
          type="button"
          className={`btn ${activeTab === 'active' ? 'text-white shadow-sm' : 'btn-outline-secondary'} rounded-3 px-3 py-2 fw-semibold d-flex align-items-center gap-2`}
          style={{
            backgroundColor: activeTab === 'active' ? '#2563eb' : undefined,
            borderColor: activeTab === 'active' ? '#2563eb' : undefined
          }}
          onClick={() => { setActiveTab('active'); setExpandedBookingId(null); setStatusFilter(''); }}
        >
          <i className="bi bi-clock-history"></i>
          <span>Active Stays &amp; Bookings</span>
          <span className={`badge ${activeTab === 'active' ? 'bg-white text-primary' : 'bg-secondary text-white'} rounded-pill ms-1`}>
            {activeBookingsCount}
          </span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'history' ? 'text-white shadow-sm' : 'btn-outline-secondary'} rounded-3 px-3 py-2 fw-semibold d-flex align-items-center gap-2`}
          style={{
            backgroundColor: activeTab === 'history' ? '#0f172a' : undefined,
            borderColor: activeTab === 'history' ? '#0f172a' : undefined
          }}
          onClick={() => { setActiveTab('history'); setExpandedBookingId(null); setStatusFilter(''); }}
        >
          <i className="bi bi-archive-fill"></i>
          <span>Historical Log</span>
          <span className={`badge ${activeTab === 'history' ? 'bg-white text-dark' : 'bg-secondary text-white'} rounded-pill ms-1`}>
            {historyBookingsCount}
          </span>
        </button>
      </div>

      <div className="card shadow-sm border-0 p-3 mb-4 bg-white" style={{ borderRadius: '12px' }}>
        <div className="row g-2">
          <div className="col-md-6">
            <input
              type="text"
              className="form-control"
              placeholder={activeTab === 'active' ? "Search active bookings by guest name, room number, contact, ID..." : "Search historical log by guest name, room, contact, ID..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-md-6">
            <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {activeTab === 'active' ? (
                <>
                  <option value="">All Active Statuses</option>
                  <option value="Pending">Pending Check-in</option>
                  <option value="Active Stay">Active Stay / Checked In</option>
                  <option value="Bill Finalized">Bill Finalized</option>
                  <option value="Paid">Paid / Ready for Checkout</option>
                </>
              ) : (
                <>
                  <option value="">All Historical Statuses</option>
                  <option value="Completed">Completed</option>
                  <option value="Checked Out">Checked Out</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="No Show">No Show</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* BOOKINGS TABLE */}
      <div className="card shadow-sm border-0 p-3 bg-white" style={{ borderRadius: '12px' }}>
        {filteredBookings.length === 0 ? (
          <div className="p-4 text-center text-muted border rounded bg-light">
            <i className={`bi ${activeTab === 'active' ? 'bi-calendar-check text-primary' : 'bi-archive text-secondary'} fs-4 d-block mb-1`}></i>
            <p className="mb-0 fw-semibold">
              {activeTab === 'active'
                ? "No active bookings right now. Completed and checked-out stays are preserved in the Historical Log tab."
                : "No historical booking records found matching your filters."}
            </p>
          </div>
        ) : activeTab === 'active' ? (
          /* ACTIVE BOOKINGS TABLE VIEW */
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.88rem' }}>
              <thead>
                <tr className="table-light">
                  <th>Booking ID</th>
                  <th>Guest Name</th>
                  <th>Room</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map(b => (
                  <tr key={b.bookingID}>
                    <td className="fw-bold">#{b.bookingID}</td>
                    <td>
                      <div className="fw-bold text-dark">{b.firstName} {b.lastName}</div>
                      <small className="text-muted">{b.contact || 'No Contact'}</small>
                    </td>
                    <td>
                      <div>
                        <span className="fw-bold text-pcc-blue">Room {b.roomNumber}</span>
                        <br />
                        <small className="text-muted">{b.roomType}</small>
                      </div>
                    </td>
                    <td>
                      <div className="text-dark" style={{ fontSize: '0.85rem' }}>
                        In: <strong>{new Date(b.checkInDateTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.82rem' }}>
                        Out: <strong>{new Date(b.checkOutDateTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="text-end">
                      <div className="actions-wrapper d-flex justify-content-end gap-1">
                        {['Pending Check-in', 'Confirmed', 'Pending', 'Booked', 'Overdue Check-In'].includes(b.status) && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary text-white fw-bold me-1 d-inline-flex align-items-center justify-content-center"
                            data-bs-toggle="tooltip"
                            data-bs-placement="top"
                            title="Check-In Guest"
                            aria-label="Check-In Guest"
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '6px',
                              backgroundColor: '#2155B5',
                              borderColor: '#2155B5'
                            }}
                            onClick={() => handleCheckIn(b.bookingID)}
                          >
                            <i className="fa-solid fa-user-check"></i>
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-sm btn-success text-white fw-bold me-1 d-inline-flex align-items-center justify-content-center"
                          data-bs-toggle="tooltip"
                          data-bs-placement="top"
                          title="Update Booking"
                          aria-label="Update Booking"
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px'
                          }}
                          onClick={() => openUpdateBookingModal(b)}
                        >
                          <i className="fa-solid fa-sync-alt"></i>
                        </button>

                        {['Pending Check-in', 'Confirmed', 'Pending', 'Booked', 'Checked In', 'Active Stay'].includes(b.status) && (
                          <button
                            type="button"
                            className="action-btn action-btn-delete"
                            data-bs-toggle="tooltip"
                            data-bs-placement="top"
                            title="Cancel Booking"
                            aria-label="Cancel Booking"
                            onClick={() => openCancelModal(b)}
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* HISTORICAL LOG TABLE VIEW WITH EXPANDABLE ROW ACCORDIONS */
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.88rem' }}>
              <thead>
                <tr className="table-light">
                  <th>Booking ID</th>
                  <th>Guest Name</th>
                  <th>Room</th>
                  <th>Stay Schedule</th>
                  <th>Total Stay Amount</th>
                  <th>Status</th>
                  <th className="text-end">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map(b => {
                  const isExpanded = expandedBookingId === b.bookingID;
                  const stayNights = b.chargesSummary?.nights || calculateBookingNights(toUiDate(b.checkInDateTime.substring(0,10)), toUiDate(b.checkOutDateTime.substring(0,10)));
                  const totalStayCharge = b.subtotal || b.chargesSummary?.subtotal || b.totalAmount || b.roomCharge || 0;
                  const paidTotal = b.paidTotal || b.chargesSummary?.paid || 0;
                  const baseCharge = b.chargesSummary?.baseRoomCharge || b.roomCharge || (parseFloat(b.roomRate || 1200) * stayNights);
                  const roomRateVal = b.chargesSummary?.roomRate || b.roomRate || 1200;

                  return (
                    <>
                      <tr key={b.bookingID} className={isExpanded ? 'table-light' : ''}>
                        <td className="fw-bold">
                          <span className="text-dark">#{b.bookingID}</span>
                          {b.reservationID && <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Res #{b.reservationID}</small>}
                        </td>
                        <td>
                          <div className="fw-bold text-dark">{b.firstName} {b.lastName}</div>
                          <small className="text-muted">{b.contact || 'No Contact'}</small>
                        </td>
                        <td>
                          <div>
                            <span className="fw-bold text-pcc-blue">Room {b.roomNumber}</span>
                            <span className="text-muted ms-1" style={{ fontSize: '0.78rem' }}>({b.roomType})</span>
                          </div>
                        </td>
                        <td>
                          <div className="text-dark" style={{ fontSize: '0.82rem' }}>
                            {new Date(b.checkInDateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – {new Date(b.checkOutDateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <small className="text-muted">
                            ({stayNights} night{stayNights !== 1 ? 's' : ''})
                          </small>
                        </td>
                        <td>
                          <div className="fw-bold text-dark">
                            ₱{Number(totalStayCharge).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </div>
                          <small className="text-success fw-semibold">
                            Paid: ₱{Number(paidTotal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </small>
                        </td>
                        <td>
                          <StatusBadge status={b.status} />
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm d-inline-flex align-items-center gap-1.5 px-3 py-1.5 rounded-3 fw-semibold text-white shadow-xs"
                            style={{
                              backgroundColor: isExpanded ? '#0f172a' : '#2563eb',
                              borderColor: isExpanded ? '#0f172a' : '#2563eb',
                              fontSize: '0.80rem'
                            }}
                            onClick={() => setExpandedBookingId(isExpanded ? null : b.bookingID)}
                            aria-expanded={isExpanded}
                            title={isExpanded ? "Collapse Details" : "Expand Details"}
                          >
                            <span>{isExpanded ? 'Hide' : 'Details'}</span>
                            <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                          </button>
                        </td>
                      </tr>

                      {/* INLINE EXPANDABLE DETAILS ACCORDION DRAWER */}
                      {isExpanded && (
                        <tr key={`${b.bookingID}-expanded`} className="bg-light">
                          <td colSpan="7" className="p-3 border-top-0 border-bottom">
                            <div className="card shadow-sm border p-3 rounded-3 bg-white">
                              <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                                <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                                  <i className="bi bi-file-text-fill text-primary"></i>
                                  <span>Historical Stay Details &amp; Folio Summary: #{b.bookingID}</span>
                                  <span className="badge bg-light text-dark border ms-1">Room {b.roomNumber} ({b.roomType})</span>
                                </h6>
                                <div className="d-flex align-items-center gap-2">
                                  <StatusBadge status={b.status} />
                                  <button 
                                    type="button" 
                                    className="btn btn-sm btn-outline-secondary rounded-3"
                                    onClick={() => setExpandedBookingId(null)}
                                    title="Collapse Details"
                                  >
                                    <i className="bi bi-chevron-up"></i>
                                  </button>
                                </div>
                              </div>

                              <div className="row g-3">
                                {/* Col 1: Guest Information */}
                                <div className="col-md-4">
                                  <div className="p-3 border rounded-3 bg-light h-100">
                                    <h6 className="fw-bold text-secondary mb-2" style={{ fontSize: '0.82rem' }}>
                                      <i className="bi bi-person-circle text-primary me-1"></i> GUEST PROFILE &amp; DETAILS
                                    </h6>
                                    <div className="mb-1 fw-bold text-dark">{b.firstName} {b.middleName ? `${b.middleName} ` : ''}{b.lastName}</div>
                                    <div className="small text-muted mb-1"><i className="bi bi-telephone me-1"></i>{b.contact || 'No Contact'}</div>
                                    <div className="small text-muted mb-1"><i className="bi bi-envelope me-1"></i>{b.email || 'No Email'}</div>
                                    <div className="small text-muted mb-2">
                                      <i className="bi bi-person-badge me-1"></i>Account: <strong>{b.userID ? `UID#${b.userID}` : 'Walk-in Guest'}</strong>
                                    </div>
                                    
                                    {b.registeredGuests && b.registeredGuests.length > 0 && (
                                      <div className="mt-2 pt-2 border-top">
                                        <span className="small fw-bold text-dark d-block mb-1">Registered Room Guests ({b.registeredGuests.length}):</span>
                                        <ul className="list-unstyled mb-0" style={{ fontSize: '0.78rem' }}>
                                          {b.registeredGuests.map((g, gIdx) => (
                                            <li key={gIdx} className="text-muted d-flex justify-content-between align-items-center mb-1">
                                              <span>• {g.fullName} ({g.age} y/o)</span>
                                              {g.discountName && (
                                                <span className="badge bg-info-subtle text-info-emphasis border ms-1" style={{ fontSize: '0.68rem' }}>
                                                  {g.discountName} ({g.discountPercentage}%)
                                                </span>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Col 2: Room & Schedule Breakdown */}
                                <div className="col-md-4">
                                  <div className="p-3 border rounded-3 bg-light h-100">
                                    <h6 className="fw-bold text-secondary mb-2" style={{ fontSize: '0.82rem' }}>
                                      <i className="bi bi-calendar-event text-primary me-1"></i> ROOM &amp; STAY SCHEDULE
                                    </h6>
                                    <div className="small mb-1">Room: <strong>Room {b.roomNumber}</strong> ({b.roomType})</div>
                                    <div className="small mb-1">Max Occupancy Limit: <strong>{b.occupancyLimit || 4} Guests</strong></div>
                                    <div className="small mb-1">Stay Duration: <strong>{stayNights} night{stayNights !== 1 ? 's' : ''}</strong></div>
                                    <div className="small mb-2">
                                      Breakfast Inclusions: <span className="badge bg-light text-dark border">{b.breakfastOption === 'with' ? 'Included with Package' : 'Without Breakfast / A La Carte'}</span>
                                    </div>

                                    {/* Breakfast Badges if any */}
                                    {b.chargesSummary?.breakfastDates && b.chargesSummary.breakfastDates.length > 0 && (
                                      <div className="mt-2 pt-2 border-top">
                                        <span className="small fw-bold text-dark d-block mb-1">Breakfast Schedule Mornings:</span>
                                        <div className="d-flex flex-wrap gap-1">
                                          {b.chargesSummary.breakfastDates.map((d, dIdx) => (
                                            <span key={dIdx} className="badge bg-white text-dark border" style={{ fontSize: '0.72rem' }}>
                                              <i className="bi bi-egg-fried text-warning me-1"></i>{d}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Timestamps */}
                                    <div className="mt-2 pt-2 border-top" style={{ fontSize: '0.75rem' }}>
                                      <div className="text-muted">Checked In: <strong className="text-dark">{b.checkInDateTime ? new Date(b.checkInDateTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}</strong></div>
                                      <div className="text-muted">Checked Out: <strong className="text-dark">{b.checkOutDateTime ? new Date(b.checkOutDateTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}</strong></div>
                                      {b.roomVerifiedAt && <div className="text-muted">Room Verified: <strong className="text-dark">{new Date(b.roomVerifiedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</strong></div>}
                                      {b.checkoutRequestedAt && <div className="text-muted">Requested Checkout: <strong className="text-dark">{new Date(b.checkoutRequestedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</strong></div>}
                                    </div>
                                  </div>
                                </div>

                                {/* Col 3: Complete Financial Breakdown */}
                                <div className="col-md-4">
                                  <div className="p-3 border rounded-3 bg-light h-100">
                                    <h6 className="fw-bold text-secondary mb-2" style={{ fontSize: '0.82rem' }}>
                                      <i className="bi bi-cash-stack text-success me-1"></i> COMPLETE FINANCIAL BALANCE SUMMARY
                                    </h6>
                                    
                                    <div className="small d-flex justify-content-between mb-1">
                                      <span className="text-muted">Base Room Rate (₱{parseFloat(roomRateVal).toLocaleString('en-PH', { minimumFractionDigits: 2 })} × {stayNights}n):</span>
                                      <span className="fw-semibold">₱{parseFloat(baseCharge).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    {(b.chargesSummary?.totalDiscount > 0) && (
                                      <div className="small d-flex justify-content-between mb-1 text-danger">
                                        <span>Discounts Applied:</span>
                                        <span>-₱{parseFloat(b.chargesSummary.totalDiscount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    )}

                                    {(b.chargesSummary?.extraGuestFee > 0) && (
                                      <div className="small d-flex justify-content-between mb-1">
                                        <span className="text-muted">Extra Pax / Capacity Fee:</span>
                                        <span className="fw-semibold">+₱{parseFloat(b.chargesSummary.extraGuestFee).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    )}

                                    {(b.chargesSummary?.orders > 0 || b.chargesSummary?.products > 0) && (
                                      <div className="small d-flex justify-content-between mb-1">
                                        <span className="text-muted">Orders &amp; Store Products:</span>
                                        <span className="fw-semibold">+₱{parseFloat(b.chargesSummary.orders || b.chargesSummary.products || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    )}

                                    {(b.chargesSummary?.incidentals > 0 || (b.incidentals && b.incidentals.length > 0)) && (
                                      <div className="small d-flex justify-content-between mb-1">
                                        <span className="text-muted">Incidentals:</span>
                                        <span className="fw-semibold">+₱{parseFloat(b.chargesSummary?.incidentals || b.incidentals?.reduce((sum, ic) => sum + parseFloat(ic.amount || 0), 0) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    )}

                                    <div className="small d-flex justify-content-between py-1 border-top border-bottom my-1 fw-bold">
                                      <span>Net Total Amount Due:</span>
                                      <span className="text-dark">₱{Number(b.netTotal || b.grandTotal || b.chargesSummary?.grandTotal || totalStayCharge).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    <div className="small d-flex justify-content-between mb-1 text-success">
                                      <span>Total Payments Settled:</span>
                                      <span className="fw-bold">₱{Number(paidTotal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                    </div>

                                    <div className="p-2 rounded bg-success-subtle border border-success-subtle text-success-emphasis text-center mt-2">
                                      <div className="small fw-bold text-uppercase" style={{ fontSize: '0.72rem' }}>Final Outstanding Balance</div>
                                      <div className="fs-5 fw-extrabold text-success">₱0.00</div>
                                      <small style={{ fontSize: '0.70rem' }}><i className="bi bi-check-circle-fill me-1"></i>Stay Fully Settled &amp; Archived</small>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Payment Transactions List if payments exist */}
                              {b.paymentsList && b.paymentsList.length > 0 && (
                                <div className="mt-3 pt-3 border-top">
                                  <h6 className="fw-bold text-secondary mb-2" style={{ fontSize: '0.80rem' }}>
                                    <i className="bi bi-receipt me-1"></i> Recorded Payment Receipts &amp; Transactions ({b.paymentsList.length}):
                                  </h6>
                                  <div className="table-responsive">
                                    <table className="table table-sm align-middle mb-0" style={{ fontSize: '0.78rem' }}>
                                      <thead className="table-light">
                                        <tr>
                                          <th>Payment #</th>
                                          <th>Method</th>
                                          <th>Amount</th>
                                          <th>Reference #</th>
                                          <th>Payment Date</th>
                                          <th>Status</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {b.paymentsList.map((p, pIdx) => (
                                          <tr key={pIdx}>
                                            <td><strong>PAY#{p.paymentID}</strong></td>
                                            <td>{p.paymentMethod || 'Cash'}</td>
                                            <td className="text-success fw-bold">₱{parseFloat(p.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                            <td><small className="text-muted">{p.referenceNumber || 'N/A'}</small></td>
                                            <td>{p.paymentDate || 'N/A'}</td>
                                            <td><span className="badge bg-success">Settled</span></td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {b.cancelRemarks && (
                                <div className="alert alert-danger mb-0 mt-3 p-2 small">
                                  <strong>Cancellation Reason:</strong> {b.cancelRemarks}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / UPDATE LODGING BOOKING WORKSPACE MODAL */}
      {(activeModal === 'create' || activeModal === 'update_booking') && (
        <ModalPortal>
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.32)', backdropFilter: 'blur(10px) saturate(125%)', WebkitBackdropFilter: 'blur(10px) saturate(125%)', zIndex: 99999 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ background: '#2155B5' }}>
                <h5 className="modal-title fw-bold">
                  {activeModal === 'create'
                    ? 'New Lodging Booking Workspace'
                    : `Update Booking #${updatingBooking ? `BK${String(updatingBooking.bookingID).padStart(5, '0')}` : ''}`}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={activeModal === 'create' ? handleCreateSubmit : handleUpdateBookingSubmit}>
                <div className="modal-body">
                  {/* TOP: SELECT GUEST ACCOUNT (UID) */}
                  <div className="p-3 mb-3 border rounded bg-light">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <label className="form-label fw-bold text-dark mb-0">
                        <i className="bi bi-person-badge text-pcc-primary me-1.5"></i>
                        Select Guest Account (UID)
                      </label>
                      {isAutoFilled && formData.guestID && (
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                          <i className="bi bi-check-circle-fill me-1"></i> Auto-filled from Guest Account
                        </span>
                      )}
                    </div>
                    <SearchableSelect
                      options={guests.map(g => ({
                        value: String(g.guestID),
                        label: `UID${g.userID || g.guestID} – ${g.firstName} ${g.lastName} (${g.contact || 'No contact'})`
                      }))}
                      value={formData.guestID}
                      onChange={handleUidChange}
                      placeholder="Type UID, guest name or contact to search..."
                    />
                    <div className="form-text text-muted small mt-1">
                      <i className="bi bi-info-circle me-1"></i>
                      Leave blank for walk-in guest.
                    </div>
                  </div>

                  {/* GUEST DETAILS CARD PANEL (ALWAYS VISIBLE) */}
                  <div className="p-3 mb-3 border rounded bg-white shadow-xs">
                    <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                      <h6 className="mb-0 text-pcc-primary fw-bold d-flex align-items-center gap-1.5">
                        <i className="bi bi-person-lines-fill"></i>
                        Guest Details
                      </h6>
                      <span className="badge bg-light text-muted border small">
                        {formData.guestID ? 'Account Linked' : 'Walk-In Entry'}
                      </span>
                    </div>

                    <div className="row g-2 mb-2">
                      <div className="col-md-4">
                        <label className="form-label small fw-semibold mb-1">First Name *</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          required
                          value={guestForm.firstName}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[0-9]/g, '');
                            setGuestForm(prev => ({ ...prev, firstName: val }));
                          }}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small fw-semibold mb-1">Middle Name <span className="text-muted fw-normal">(Optional)</span></label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Optional"
                          value={guestForm.middleName || ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[0-9]/g, '');
                            setGuestForm(prev => ({ ...prev, middleName: val }));
                          }}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small fw-semibold mb-1">Last Name *</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          required
                          value={guestForm.lastName}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[0-9]/g, '');
                            setGuestForm(prev => ({ ...prev, lastName: val }));
                          }}
                        />
                      </div>
                    </div>

                    <div className="row g-2">
                      <div className="col-md-4 mb-2">
                        <label className="form-label small fw-semibold mb-1">Contact Number (11 digits)</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="09XXXXXXXXX"
                          value={guestForm.contact}
                          onChange={(e) => {
                            const sanitized = e.target.value.replace(/[^0-9]/g, "").slice(0, 11);
                            setGuestForm(prev => ({ ...prev, contact: sanitized }));
                          }}
                        />
                      </div>
                      <div className="col-md-4 mb-2">
                        <label className="form-label small fw-semibold mb-1">Birthdate (18+) *</label>
                        <DateInput
                          className="form-control form-control-sm"
                          value={guestForm.dateOfBirth}
                          onChange={(e) => setGuestForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                          max={maxDobStr}
                        />
                      </div>
                      <div className="col-md-4 mb-2">
                        <label className="form-label small fw-semibold mb-1">
                          Email Address <span className="text-muted fw-normal">(Optional)</span>
                        </label>
                        <input
                          type="email"
                          className="form-control form-control-sm"
                          placeholder="name@example.com"
                          value={guestForm.email}
                          onChange={(e) => setGuestForm(prev => ({ ...prev, email: e.target.value }))}
                        />
                        <div className="form-text small text-muted" style={{ fontSize: '0.73rem' }}>
                          <i className="bi bi-info-circle me-1"></i>Optional for walk-in guests to receive booking confirmation and official receipt.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ROOM SELECTION & BREAKFAST OPTION */}
                  <div className="row g-2 mb-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Room Type *</label>
                      <select
                        className="form-select"
                        required
                        value={selectedRoomType}
                        onChange={(e) => {
                          setSelectedRoomType(e.target.value);
                          setFormData(prev => ({ ...prev, roomID: '' }));
                        }}
                      >
                        <option value="" disabled>Select Room Type</option>
                        {[...new Set(rooms.map(rm => rm.roomType || 'Standard Room'))].map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Available Room *</label>
                      <select
                        className="form-select"
                        required
                        value={formData.roomID}
                        onChange={(e) => setFormData(prev => ({ ...prev, roomID: e.target.value }))}
                        disabled={!selectedRoomType}
                      >
                        <option value="" disabled>
                          {selectedRoomType ? "Select Available Room" : "Choose Room Type first"}
                        </option>
                        {rooms
                          .filter(rm => (rm.roomType || 'Standard Room') === selectedRoomType && isRoomAvailableForDates(rm.roomID, checkInDate, checkOutDate, useCurrentTimeIn, checkInTime, checkOutTime))
                          .map(rm => (
                            <option key={rm.roomID} value={String(rm.roomID)}>
                              Room {rm.roomNumber} (Max {rm.occupancyLimit || 4} Pax)
                            </option>
                          ))
                        }
                      </select>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Breakfast Inclusion *</label>
                      <select
                        className="form-select fw-semibold"
                        value={breakfastOption}
                        onChange={(e) => setBreakfastOption(e.target.value)}
                      >
                        <option value="with">With Breakfast</option>
                        <option value="custom">Customize Breakfast Mornings</option>
                        <option value="without">Without Breakfast</option>
                      </select>
                    </div>
                  </div>

                  {/* ROOM OCCUPANCY & PRICE DISPLAY */}
                  {selectedRoomObj && (
                    <div className="p-3 mb-3 border rounded bg-light d-flex align-items-center justify-content-between flex-wrap gap-3">
                      <div className="d-flex align-items-center gap-3">
                        <div className="rounded border bg-white text-pcc-blue d-flex align-items-center justify-content-center shadow-sm" style={{ width: '45px', height: '45px' }}>
                          <i className="bi bi-door-closed fs-4"></i>
                        </div>
                        <div>
                          <div className="fw-bold text-dark" style={{ fontSize: '0.92rem' }}>
                            Room {selectedRoomObj.roomNumber} ({selectedRoomObj.roomType || 'Standard'})
                          </div>
                          <div className="text-muted small">
                            Base Price: <span className="text-pcc-blue fw-bold">₱{(
                              breakfastOption === 'with'
                                ? (parseFloat(selectedRoomObj.rateWithBreakfast) || parseFloat(selectedRoomObj.rate) || 0)
                                : (parseFloat(selectedRoomObj.rateWithoutBreakfast) || parseFloat(selectedRoomObj.rate) || 0)
                            ).toFixed(2)}</span> / night
                          </div>
                          <small className="text-muted">
                            ({breakfastOption === 'with' ? 'Daily Breakfast Included' : (breakfastOption === 'custom' ? 'Customized Breakfast Mornings' : 'Standard Stay Without Breakfast')})
                          </small>
                        </div>
                      </div>
                      <span className="badge bg-primary px-3 py-1.5 rounded-pill fs-6">
                        Maximum Occupancy: {selectedRoomObj.occupancyLimit || 4} Guests
                      </span>
                    </div>
                  )}

                  {/* CUSTOM BREAKFAST MORNINGS SELECTOR */}
                  {breakfastOption === 'custom' && (
                    <div className="mb-3">
                      <BookingBreakfastSelector
                        checkInDate={toDbDate(checkInDate)}
                        checkOutDate={toDbDate(checkOutDate)}
                        guestCount={numGuestsCount}
                        perGuestBreakfastRate={
                          selectedRoomObj?.breakfastRate !== null && selectedRoomObj?.breakfastRate !== undefined
                            ? parseFloat(selectedRoomObj.breakfastRate)
                            : (selectedRoomObj?.rateWithBreakfast && selectedRoomObj?.rateWithoutBreakfast
                                ? Math.max(0, parseFloat(selectedRoomObj.rateWithBreakfast) - parseFloat(selectedRoomObj.rateWithoutBreakfast))
                                : 250)
                        }
                        initialSelectedDates={selectedBreakfastDates}
                        onChangeDates={(dates) => setSelectedBreakfastDates(dates)}
                      />
                    </div>
                  )}

                  {/* ROOM OCCUPANCY & NUMBER OF GUESTS */}
                  <div className="p-3 mb-3 border rounded bg-white">
                    <div className="row g-2 align-items-center mb-2">
                      <div className="col-md-6">
                        <label className="form-label fw-bold mb-0 small text-dark">Total Number of Guests *</label>
                        <input
                          type="number"
                          className="form-control form-control-sm mt-1"
                          min="1"
                          max={selectedRoomObj ? (selectedRoomObj.occupancyLimit || 4) + 5 : 10}
                          value={numGuestsCount}
                          onChange={(e) => {
                            const val = e.target.value;
                            const parsed = val === '' ? '' : Math.max(1, parseInt(val) || 1);
                            setNumGuestsCount(parsed);
                            if (typeof parsed === 'number') {
                              setDiscountedGuests(prev => prev.slice(0, parsed));
                            }
                          }}
                          onBlur={() => {
                            if (numGuestsCount === '' || isNaN(numGuestsCount)) setNumGuestsCount(1);
                          }}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        {selectedRoomObj && numGuestsCount > (selectedRoomObj.occupancyLimit || 4) && (
                          <div className="alert alert-warning py-1.5 mb-0 small fw-bold">
                            Excess Guests: {numGuestsCount - (selectedRoomObj.occupancyLimit || 4)} Additional Guest(s)
                            <div>Fee: ₱{(numGuestsCount - (selectedRoomObj.occupancyLimit || 4)) * 100}/night applied.</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SPECIAL DISCOUNTS (SENIOR / PWD) */}
                    <div className="pt-2 border-top mt-2">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div>
                          <h6 className="fw-bold text-pcc-primary mb-0 small">Special Discounts (Senior Citizen / PWD)</h6>
                          <span className="small text-muted">Optional: Add details for any guest qualifying for a discount (Limit: {parseInt(numGuestsCount) || 1} guest{(parseInt(numGuestsCount) || 1) > 1 ? 's' : ''}).</span>
                        </div>
                        {discountedGuests.length < (parseInt(numGuestsCount) || 1) && (
                          <button
                            type="button"
                            className="btn btn-sm btn-pcc-primary text-white fw-bold"
                            onClick={() => setDiscountedGuests(prev => [...prev, { guestName: '', discountID: '', discountIdNumber: '' }])}
                          >
                            + Add Discounted Guest
                          </button>
                        )}
                      </div>

                      {discountedGuests.length === 0 ? (
                        <div className="text-muted small fst-italic py-1 mb-2">
                          No discounted guests added. Click "+ Add Discounted Guest" if any guest qualifies for a discount.
                        </div>
                      ) : (
                        discountedGuests.map((g, idx) => (
                          <div key={idx} className="row g-2 align-items-center mb-2 p-2 border rounded bg-light">
                            <div className="col-md-4">
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder={g.discountID ? "Qualifying Guest Full Name *" : "Qualifying Guest Full Name"}
                                value={g.guestName || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDiscountedGuests(prev => prev.map((item, i) => i === idx ? { ...item, guestName: val } : item));
                                }}
                                required={Boolean(g.discountID)}
                              />
                            </div>
                            <div className="col-md-4">
                              <select
                                className="form-select form-select-sm"
                                value={g.discountID}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDiscountedGuests(prev => prev.map((item, i) => i === idx ? { ...item, discountID: val } : item));
                                }}
                              >
                                <option value="">Select Discount Type (Optional)</option>
                                {availableDiscounts.map(d => (
                                  <option key={d.discountID} value={String(d.discountID)}>{d.name} ({d.percentage}%)</option>
                                ))}
                              </select>
                            </div>
                            <div className="col-md-3">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className="form-control form-control-sm"
                                placeholder={g.discountID ? "Numeric ID No * (0-9)" : "Numeric ID No (0-9)"}
                                value={g.discountIdNumber}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  setDiscountedGuests(prev => prev.map((item, i) => i === idx ? { ...item, discountIdNumber: val } : item));
                                }}
                                onKeyDown={(e) => {
                                  if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                                    e.preventDefault();
                                  }
                                }}
                                required={Boolean(g.discountID)}
                              />
                            </div>
                            <div className="col-md-1 text-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-danger text-white fw-bold py-1 px-2 w-100"
                                onClick={() => {
                                  if (discountedGuests.length <= 1) {
                                    setDiscountedGuests([]);
                                  } else {
                                    setDiscountedGuests(prev => prev.filter((_, i) => i !== idx));
                                  }
                                }}
                                title="Remove / Clear discount"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* STAY SCHEDULE & CALENDAR DATES */}
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Check-In Date *</label>
                      <input
                        type="date"
                        className="form-control form-control-sm mb-2"
                        value={toDbDate(checkInDate)}
                        min={todayDbDate}
                        onChange={(e) => handleCheckInDateChange(e.target.value)}
                        disabled={Boolean(useCurrentTimeIn)}
                        required
                      />
                      <div className="mt-2">
                        <label className="form-label small fw-semibold d-flex justify-content-between">
                          <span>Check-In Time *</span>
                          <small className="text-muted" style={{ fontSize: '0.72rem' }}>Std: 2:00 PM</small>
                        </label>
                        <input
                          type="time"
                          className={`form-control form-control-sm ${useCurrentTimeIn ? 'bg-light text-muted' : ''}`}
                          value={checkInTime}
                          min={isCheckInToday && !useCurrentTimeIn ? currentTimeStr : undefined}
                          onChange={(e) => setCheckInTime(e.target.value)}
                          disabled={Boolean(useCurrentTimeIn)}
                          required
                        />
                        <div className="form-check mt-1">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="recUseCurrentTimeIn"
                            checked={Boolean(useCurrentTimeIn)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setUseCurrentTimeIn(checked);
                              if (checked) {
                                const now = new Date();
                                const pad = (n) => String(n).padStart(2, '0');
                                setCheckInDate(toUiDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`));
                                setCheckInTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
                                setFormData(prev => ({ ...prev, status: 'Checked In' }));
                              } else {
                                setCheckInTime('14:00');
                                setFormData(prev => ({ ...prev, status: 'Pending Check-in' }));
                              }
                            }}
                          />
                          <label className="form-check-label small text-muted user-select-none fw-semibold text-dark" htmlFor="recUseCurrentTimeIn" style={{ fontSize: '0.75rem' }}>
                            Check-In Now (use current time)
                          </label>
                          <div className="form-text text-muted small mt-0.5" style={{ fontSize: '0.73rem' }}>
                            <i className="bi bi-info-circle me-1"></i>
                            Checked In immediately when selected; defaults to 2:00 PM when unselected.
                          </div>
                        </div>
                        {isEarlyCheckIn && (
                          <small className="text-warning-emphasis d-block mt-0.5 fw-semibold" style={{ fontSize: '0.72rem' }}>
                            ℹ Early Check-in ({earlyHours} hr{earlyHours > 1 ? 's' : ''} prior to 2:00 PM) fee of ₱{earlyFee.toFixed(2)} applied @ ₱50/hr.
                          </small>
                        )}
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Check-Out Date *</label>
                      <input
                        type="date"
                        className="form-control form-control-sm mb-2"
                        value={toDbDate(checkOutDate)}
                        min={checkInDate ? toDbDate(checkInDate) : todayDbDate}
                        onChange={(e) => setCheckOutDate(e.target.value)}
                        required
                      />
                      <div className="mt-2">
                        <label className="form-label small fw-semibold d-flex justify-content-between">
                          <span>Check-Out Time *</span>
                          <small className="text-muted" style={{ fontSize: '0.72rem' }}>Std: 12:00 PM</small>
                        </label>
                        <input
                          type="time"
                          className="form-control form-control-sm"
                          value={checkOutTime}
                          onChange={(e) => setCheckOutTime(e.target.value)}
                          required
                        />
                        {isLateCheckOut && (
                          <small className="text-danger d-block mt-0.5 fw-semibold" style={{ fontSize: '0.72rem' }}>
                            ℹ Late Check-out ({lateHours} hr{lateHours > 1 ? 's' : ''} past 12:00 PM) fee of ₱{lateFee.toFixed(2)} applied @ ₱100/hr.
                          </small>
                        )}
                      </div>
                    </div>

                    {/* SINGLE VISUAL CALENDAR WITH DUAL HIGHLIGHTING & ROOM STATUSES */}
                    <div className="col-12 mt-2">
                      <ReservationCalendar
                        schedules={roomSchedules}
                        selectedRoom={selectedRoomObj}
                        selectedRoomId={selectedRoomObj?.roomID}
                        checkInDate={checkInDate}
                        checkOutDate={checkOutDate}
                        title={selectedRoomObj ? `Room ${selectedRoomObj.roomNumber} Availability & Status Overview` : "Room Availability & Status Overview"}
                      />
                    </div>
                  </div>

                  {/* DYNAMIC STAY DURATION & NIGHTS SUMMARY BADGE */}
                  <div className="p-3 bg-primary-subtle border border-primary-subtle rounded-3 mb-3 d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-bold text-primary small d-flex align-items-center gap-1">
                        <i className="fa-solid fa-moon me-1"></i>
                        <span>Stay Duration</span>
                      </div>
                      <div className="text-muted small mt-1">
                        {toDbDate(checkInDate) || 'Check-in'} → {toDbDate(checkOutDate) || 'Check-out'}
                      </div>
                    </div>
                    <div className="text-end">
                      <span className="badge bg-primary text-white fs-6 px-3 py-1 shadow-xs">
                        {calculateBookingNights()} {calculateBookingNights() === 1 ? 'Night' : 'Nights'}
                      </span>
                    </div>
                  </div>

                  {/* REQUIREMENT 4: DOWN PAYMENT OPTIONS */}
                  <div className="mb-3">
                    <label className="form-label fw-bold">Required Down Payment Tier *</label>
                    <div className="btn-group w-100" role="group">
                      <button
                        type="button"
                        className={`btn ${downPaymentOption === '30' ? 'btn-pcc-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                        onClick={() => setDownPaymentOption('30')}
                      >
                        30% Down Payment
                      </button>
                      <button
                        type="button"
                        className={`btn ${downPaymentOption === '50' ? 'btn-pcc-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                        onClick={() => setDownPaymentOption('50')}
                      >
                        50% Down Payment
                      </button>
                      <button
                        type="button"
                        className={`btn ${downPaymentOption === '100' ? 'btn-pcc-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                        onClick={() => setDownPaymentOption('100')}
                      >
                        Full Payment (100%)
                      </button>
                    </div>
                  </div>

                  {/* DYNAMIC BREAKDOWN MATH */}
                  {(() => {
                    const perGuestBreakfastRate = selectedRoomObj?.breakfastRate !== null && selectedRoomObj?.breakfastRate !== undefined
                      ? parseFloat(selectedRoomObj.breakfastRate)
                      : (selectedRoomObj?.rateWithBreakfast && selectedRoomObj?.rateWithoutBreakfast
                          ? Math.max(0, parseFloat(selectedRoomObj.rateWithBreakfast) - parseFloat(selectedRoomObj.rateWithoutBreakfast))
                          : 250);

                    const baseRoomRate = selectedRoomObj
                      ? (parseFloat(selectedRoomObj.rateWithoutBreakfast) || parseFloat(selectedRoomObj.rate) || 0)
                      : 0;
                    const maxOccupancy = selectedRoomObj ? (parseInt(selectedRoomObj.occupancyLimit) || 4) : 4;

                    let nights = 0;
                    if (checkInDate && checkOutDate) {
                      const inD = new Date(toDbDate(checkInDate) + 'T00:00:00');
                      const outD = new Date(toDbDate(checkOutDate) + 'T00:00:00');
                      if (outD > inD) {
                        nights = Math.round(Math.abs(outD - inD) / (1000 * 60 * 60 * 24));
                      }
                    }
                    nights = Math.max(1, nights);

                    const totalGuests = Math.max(1, parseInt(numGuestsCount) || 1);

                    let calculatedBreakfastFee = 0;
                    if (breakfastOption === 'with') {
                      calculatedBreakfastFee = perGuestBreakfastRate * nights;
                    } else if (breakfastOption === 'custom') {
                      calculatedBreakfastFee = perGuestBreakfastRate * (selectedBreakfastDates?.length || 0);
                    }

                    const baseRoomStayCharges = baseRoomRate * (nights || 1);

                    const excessGuestsCount = Math.max(0, totalGuests - maxOccupancy);
                    const extraGuestFee = excessGuestsCount * 100 * (nights || 1);
                    const dpPctNum = parseInt(downPaymentOption) || 50;

                    const billing = calculateBillingTotals({
                      roomRate: baseRoomRate,
                      nights: nights || 1,
                      guestCount: totalGuests,
                      guestDiscounts: [], // Special discounts are verified and applied in Receptionist Billing
                      extraGuestFee,
                      breakfastFee: calculatedBreakfastFee,
                      earlyFee,
                      lateFee,
                      downPaymentPercentage: dpPctNum
                    });

                    const perCapitaShare = billing.perCapitaShare;
                    const totalApportionedDiscount = billing.totalPerCapitaDiscount;
                    const appliedDiscountsList = billing.itemizedDiscounts.map(d => ({
                      guestName: d.guestName,
                      discountName: d.discountType,
                      percentage: d.percentage,
                      idNumber: d.discountIdNumber || 'N/A',
                      amount: d.discountAmount
                    }));

                    const grossSubtotal = billing.grossSubtotal;
                    const netSubtotal = billing.netTotal;
                    const grandTotal = billing.netTotal;
                    const requiredDownpayment = billing.requiredDownpayment;
                    const remainingBalance = Math.max(0, netSubtotal - requiredDownpayment);

                    return (
                      <>
                        {baseRoomRate > 0 && (
                          <div className="card shadow-sm border-0 mb-3" style={{ background: '#f8fafc', borderRadius: '10px' }}>
                            <div className="card-body p-3">
                              <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                <span className="fw-bold text-dark d-flex align-items-center gap-1" style={{ fontSize: '0.90rem' }}>
                                  <i className="fa-solid fa-receipt text-primary"></i>
                                  <span>Payment &amp; Billing Breakdown</span>
                                </span>
                                <span className="badge bg-primary-subtle text-primary fw-semibold px-2.5 py-1" style={{ fontSize: '0.75rem' }}>
                                  {nights} Night{nights > 1 ? 's' : ''} Stay • {totalGuests} Pax
                                </span>
                              </div>

                              <div className="d-flex justify-content-between mb-1" style={{ fontSize: '0.84rem' }}>
                                <span className="text-muted">Room Base Rate (Room Only):</span>
                                <span className="fw-semibold text-dark">₱{baseRoomRate.toFixed(2)}/night</span>
                              </div>
                              <div className="d-flex justify-content-between mb-1" style={{ fontSize: '0.84rem' }}>
                                <span className="text-muted">Room Stay Charges ({nights} Night{nights > 1 ? 's' : ''}):</span>
                                <span className="fw-semibold text-dark">₱{baseRoomStayCharges.toFixed(2)}</span>
                              </div>
                              {calculatedBreakfastFee > 0 && (
                                <div className="d-flex justify-content-between mb-1" style={{ fontSize: '0.84rem' }}>
                                  <span className="text-muted">
                                    Breakfast Fee ({breakfastOption === 'custom' ? `${selectedBreakfastDates?.length || 0} morning(s)` : `${nights} morning(s)`} for {totalGuests} pax @ ₱{perGuestBreakfastRate.toFixed(2)}):
                                  </span>
                                  <span className="fw-semibold text-dark">+₱{calculatedBreakfastFee.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="d-flex justify-content-between mb-1" style={{ fontSize: '0.84rem' }}>
                                <span className="text-muted">Per-Capita Share ({totalGuests} Guest{totalGuests > 1 ? 's' : ''}):</span>
                                <span className="fw-semibold text-dark">₱{perCapitaShare.toFixed(2)}/pax</span>
                              </div>

                              {excessGuestsCount > 0 && (
                                <div className="d-flex justify-content-between mb-1 text-muted" style={{ fontSize: '0.84rem' }}>
                                  <span>
                                    Extra Guest Fee ({excessGuestsCount} Pax × {nights}N):
                                    <span className="badge bg-secondary-subtle text-secondary ms-1.5" style={{ fontSize: '0.68rem' }}>Final Billing Only</span>
                                  </span>
                                  <span className="fw-semibold text-dark">+₱{extraGuestFee.toFixed(2)}</span>
                                </div>
                              )}

                              {earlyFee > 0 && (
                                <div className="d-flex justify-content-between mb-1 text-warning-emphasis" style={{ fontSize: '0.84rem' }}>
                                  <span>Early Check-In Fee ({earlyHours} hr{earlyHours > 1 ? 's' : ''} @ ₱50/hr):</span>
                                  <span className="fw-semibold">+₱{earlyFee.toFixed(2)}</span>
                                </div>
                              )}

                              {lateFee > 0 && (
                                <div className="d-flex justify-content-between mb-1 text-danger" style={{ fontSize: '0.84rem' }}>
                                  <span>Late Check-Out Fee ({lateHours} hr{lateHours > 1 ? 's' : ''} @ ₱100/hr):</span>
                                  <span className="fw-semibold">+₱{lateFee.toFixed(2)}</span>
                                </div>
                              )}

                              <div className="d-flex justify-content-between pt-1.5 mb-2 border-top text-secondary fw-semibold" style={{ fontSize: '0.88rem' }}>
                                <span>Gross Subtotal:</span>
                                <span className="fw-bold text-dark">₱{grossSubtotal.toFixed(2)}</span>
                              </div>

                              {/* Applied Special Discounts pill badges */}
                              {totalApportionedDiscount > 0 ? (
                                <div className="mb-2.5 p-2 rounded bg-danger-subtle border border-danger-subtle">
                                  <div className="d-flex justify-content-between align-items-center mb-1 text-danger fw-bold" style={{ fontSize: '0.84rem' }}>
                                    <span className="d-flex align-items-center gap-1">
                                      <i className="fa-solid fa-tags"></i>
                                      <span>Applied Special Discounts ({appliedDiscountsList.length}):</span>
                                    </span>
                                    <span className="fs-6">-₱{totalApportionedDiscount.toFixed(2)}</span>
                                  </div>
                                  <div className="d-flex flex-wrap gap-1.5 mt-1">
                                    {appliedDiscountsList.map((disc, dIdx) => (
                                      <span key={dIdx} className="badge bg-danger text-white fw-normal px-2.5 py-1 text-start" style={{ fontSize: '0.74rem', lineHeight: '1.3' }}>
                                        <i className="fa-solid fa-user-check me-1"></i>
                                        <strong>{disc.guestName}</strong> ({disc.discountName} {disc.percentage}% - ID: {disc.idNumber}): -₱{disc.amount.toFixed(2)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="d-flex justify-content-between mb-2 text-muted" style={{ fontSize: '0.82rem' }}>
                                  <span className="fst-italic">Special Discounts:</span>
                                  <span className="text-secondary">₱0.00</span>
                                </div>
                              )}

                              {/* Net Total Amount Due */}
                              <div className="d-flex justify-content-between align-items-center p-2 mb-2 rounded" style={{ background: '#e0f2fe', border: '1px solid #bae6fd' }}>
                                <span className="fw-bold text-primary" style={{ fontSize: '0.90rem' }}>
                                  <i className="fa-solid fa-calculator me-1"></i>Net Total Amount Due:
                                </span>
                                <span className="fw-bold text-primary fs-6">₱{netSubtotal.toFixed(2)}</span>
                              </div>

                              {/* Required Down Payment */}
                              <div className="d-flex justify-content-between align-items-center mb-1 text-success fw-bold" style={{ fontSize: '0.88rem' }}>
                                <span>Required Down Payment ({dpPctNum}%):</span>
                                <span className="fs-6">₱{requiredDownpayment.toFixed(2)}</span>
                              </div>

                              {/* Remaining Balance */}
                              <div className="d-flex justify-content-between align-items-center text-muted small">
                                <span>Remaining Balance Due:</span>
                                <span className="fw-bold text-dark">₱{remainingBalance.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {(() => {
                          const isAlreadyPaid = activeModal === 'update_booking' && Boolean(
                            updatingBooking?.isDownPaymentPaid ||
                            (parseFloat(updatingBooking?.downPaymentPaid) > 0) ||
                            (parseFloat(updatingBooking?.paidTotal) > 0) ||
                            (parseFloat(updatingBooking?.downPaymentAmount || 0) > 0 && ['Payment Completed', 'Confirmed', 'Checked In'].includes(updatingBooking?.status))
                          );

                          return isAlreadyPaid ? (
                            <div className="row g-2 mb-3">
                              <div className="col-12">
                                <div className="alert alert-success py-2.5 px-3 mb-0 small d-flex align-items-center gap-2">
                                  <i className="fa-solid fa-circle-check fs-5 text-success"></i>
                                  <div>
                                    <strong>Down Payment Settled:</strong> Initial down payment of ₱{parseFloat(updatingBooking.downPaymentPaid || updatingBooking.downPaymentAmount || 0).toFixed(2)} has already been verified and paid. Room charges and schedule adjustments will be automatically updated in the Billing Ledger.
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="row g-2 mb-3">
                              <div className="col-md-4">
                                <label className="form-label small fw-semibold">Payment Method *</label>
                                <select
                                  className="form-select form-select-sm"
                                  required
                                  value={paymentMethodID}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPaymentMethodID(val);
                                    setIsGcashSettled(false);
                                    setGcashInlineError('');
                                    setSettledPaymentRef('');
                                    if (String(val) === '2') {
                                      setDownPayment(requiredDownpayment.toFixed(2));
                                      if (!walkinGcashRef) {
                                        setWalkinGcashRef(`BOOK-${selectedRoomObj?.roomNumber || formData.roomID || 'WALK'}-${Date.now().toString().slice(-4)}`);
                                      }
                                    }
                                  }}
                                >
                                  {paymentMethods.map(pm => (
                                    <option key={pm.paymentMethodID} value={pm.paymentMethodID}>
                                      {pm.paymentMethod}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {String(paymentMethodID) === '1' ? (
                                <>
                                  <div className="col-md-4">
                                    <label className="form-label small fw-semibold">Payment Received (₱) *</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      className="form-control form-control-sm fw-bold text-success"
                                      required
                                      placeholder={`Min ₱${requiredDownpayment.toFixed(2)}`}
                                      value={downPayment}
                                      onChange={(e) => setDownPayment(e.target.value)}
                                    />
                                    <small className="text-muted d-block mt-1" style={{ fontSize: '0.74rem' }}>
                                      Required Due: ₱{requiredDownpayment.toFixed(2)} ({dpPctNum}% Tier)
                                    </small>
                                  </div>

                                  <div className="col-md-4">
                                    <label className="form-label small fw-semibold">Change to Give (₱)</label>
                                    <input
                                      type="text"
                                      readOnly
                                      className={`form-control form-control-sm fw-bold ${
                                        (parseFloat(downPayment || 0) - requiredDownpayment) >= 0 ? 'text-primary' : 'text-danger'
                                      }`}
                                      value={`₱${Math.max(0, (parseFloat(downPayment || 0) - requiredDownpayment)).toFixed(2)}`}
                                    />
                                    <small className="text-muted d-block mt-1" style={{ fontSize: '0.74rem' }}>
                                      Auto-calculated change
                                    </small>
                                  </div>
                                </>
                              ) : (() => {
                                const activeGcashRef = walkinGcashRef || `BOOK-${selectedRoomObj?.roomNumber || formData.roomID || 'WALK'}-${Date.now().toString().slice(-4)}`;
                                return (
                                  <>
                                    <div className="col-md-8 d-flex align-items-end justify-content-start gap-2 pb-1">
                                      <a
                                        href={`/receptionist/qr-payment?amount=${requiredDownpayment.toFixed(2)}&ref=${activeGcashRef}&roomNumber=${encodeURIComponent(selectedRoomObj?.roomNumber || '')}&guestName=${encodeURIComponent(`${guestForm.firstName || ''} ${guestForm.lastName || ''}`.trim() || 'Guest')}&roomType=${encodeURIComponent(selectedRoomObj?.roomType || 'Standard')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-sm btn-outline-primary fw-bold text-nowrap d-inline-flex align-items-center gap-1 shadow-sm"
                                        title="Open guest payment terminal in a new window or second monitor"
                                        onClick={() => {
                                          if (!walkinGcashRef) {
                                            setWalkinGcashRef(activeGcashRef);
                                          }
                                        }}
                                      >
                                        <i className="fa-solid fa-up-right-from-square"></i> Open on 2nd Monitor
                                      </a>
                                      {!isGcashSettled ? (
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-success fw-bold text-white text-nowrap d-inline-flex align-items-center gap-1 shadow-sm"
                                          onClick={() => {
                                            const authRef = `AUTH-${Date.now().toString().slice(-6)}`;
                                            setIsGcashSettled(true);
                                            setSettledPaymentRef(authRef);
                                            setDownPayment(requiredDownpayment.toFixed(2));
                                            setGcashInlineError('');
                                            showAlert('success', 'Payment Authorized', `GCash payment settled (${authRef}). You may now save the booking.`);
                                          }}
                                        >
                                          <i className="fa-solid fa-circle-check"></i> Authorize Payment
                                        </button>
                                      ) : (
                                        <span className="badge bg-success d-inline-flex align-items-center gap-1 py-2 px-2.5 shadow-sm">
                                          <i className="fa-solid fa-circle-check"></i> Payment Authorized
                                        </span>
                                      )}
                                    </div>

                                    <div className="col-md-12 d-flex flex-column align-items-center justify-content-center">
                                      {gcashInlineError ? (
                                        <div className="alert alert-danger py-2 px-3 mb-2 small d-flex align-items-center gap-2 w-100" style={{ maxWidth: '380px' }}>
                                          <i className="bi bi-exclamation-triangle-fill text-danger fs-6"></i>
                                          <span>{gcashInlineError}</span>
                                        </div>
                                      ) : isGcashSettled ? (
                                        <div className="alert alert-success py-2 px-3 mb-2 small d-flex align-items-center gap-2 w-100" style={{ maxWidth: '380px' }}>
                                          <i className="bi bi-check-circle-fill text-success fs-6"></i>
                                          <span><strong>GCash Payment Settled:</strong> Reference #{settledPaymentRef}. You may proceed to save booking.</span>
                                        </div>
                                      ) : (
                                        <div className="alert alert-warning py-2 px-3 mb-2 small d-flex align-items-center gap-2 w-100" style={{ maxWidth: '380px' }}>
                                          <i className="bi bi-info-circle-fill text-warning fs-6"></i>
                                          <span><strong>Awaiting GCash Payment:</strong> Down payment must be verified/settled before saving this booking.</span>
                                        </div>
                                      )}
                                      <DynamicQrPhCode 
                                        amount={requiredDownpayment}
                                        refNumber={activeGcashRef}
                                        paymentStatus={isGcashSettled ? 'Settled' : 'Pending'}
                                        showProceedBtn={false}
                                        showCheckStatusBtn={false}
                                        showTestPayBtn={false}
                                        onPaymentSuccess={(pData) => {
                                          setIsGcashSettled(true);
                                          setSettledPaymentRef(pData?.referenceNumber || pData?.paymentIntentId || `PAY-${Date.now()}`);
                                          setGcashInlineError('');
                                          setDownPayment(requiredDownpayment.toFixed(2));
                                        }}
                                      />
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          );
                        })()}
                      </>
                    );
                  })()}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)} disabled={isSubmitting || isUpdatingBooking}>Cancel</button>
                  <LoadingButton
                    type="submit"
                    isLoading={activeModal === 'create' ? isSubmitting : isUpdatingBooking}
                    loadingText={activeModal === 'create' ? 'Saving Booking...' : 'Saving...'}
                    className="btn btn-pcc-primary text-white fw-bold"
                  >
                    {activeModal === 'create' ? (
                      <>Save Booking &amp; Record Down Payment</>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-1"></i> Save and Update Booking
                      </>
                    )}
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* DOWN PAYMENT RECEIPT MODAL */}
      {activeModal === 'downpayment_receipt' && downPaymentReceipt && (
        <ModalPortal>
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.32)', backdropFilter: 'blur(10px) saturate(125%)', WebkitBackdropFilter: 'blur(10px) saturate(125%)', zIndex: 99999 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ background: '#2155B5' }}>
                <h5 className="modal-title fw-bold">Booking Down Payment Receipt</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <div className="modal-body p-4 text-center">
                <div className="mb-3">
                  <div className="rounded-circle bg-success-subtle d-inline-flex align-items-center justify-content-center p-3 mb-2" style={{ width: '64px', height: '64px' }}>
                    <span className="fs-2 text-success">✓</span>
                  </div>
                  <h5 className="fw-bold text-dark mb-1">Down Payment Recorded Successfully!</h5>
                  <p className="text-muted small">Receipt #{downPaymentReceipt.receiptNo} generated for Booking #{downPaymentReceipt.bookingID}</p>
                </div>

                <div className="p-3 bg-light rounded border text-start mb-3" style={{ fontSize: '0.9rem' }}>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Guest Name:</span>
                    <strong className="text-dark">{downPaymentReceipt.guestName}</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Target Room:</span>
                    <strong className="text-pcc-blue">Room {downPaymentReceipt.roomNumber} ({downPaymentReceipt.roomType})</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Payment Method:</span>
                    <strong className="text-dark">{downPaymentReceipt.paymentMethodName}</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted">Total Booking Amount:</span>
                    <strong className="text-dark">₱{parseFloat(downPaymentReceipt.totalRoomCharge).toFixed(2)}</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1 text-dark fw-bold">
                    <span>Required Down Payment ({downPaymentReceipt.downPaymentPercentage}%):</span>
                    <span>₱{parseFloat(downPaymentReceipt.requiredDownpayment || downPaymentReceipt.amountPaid).toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1 text-success fw-bold">
                    <span>Payment Received from Guest:</span>
                    <span className="fs-6">₱{parseFloat(downPaymentReceipt.cashReceived || downPaymentReceipt.amountPaid).toFixed(2)}</span>
                  </div>
                  {downPaymentReceipt.change > 0 && (
                    <div className="d-flex justify-content-between mb-1 text-primary fw-bold">
                      <span>Change Issued to Guest:</span>
                      <span>₱{parseFloat(downPaymentReceipt.change).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="d-flex justify-content-between border-top pt-1 text-muted small">
                    <span>Remaining Balance at Check-in:</span>
                    <span className="fw-bold text-dark">₱{parseFloat(downPaymentReceipt.remainingBalance).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer d-flex justify-content-between">
                <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Close</button>
                <button type="button" className="btn btn-pcc-primary text-white fw-bold" onClick={handlePrintDownPaymentReceipt}>
                  Print Down Payment Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* MANAGE ROOM GUESTS MODAL */}
      {activeModal === 'manage_guests' && managingBooking && (
        <ModalPortal>
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.32)', backdropFilter: 'blur(10px) saturate(125%)', WebkitBackdropFilter: 'blur(10px) saturate(125%)', zIndex: 99999 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ background: '#2155B5' }}>
                <h5 className="modal-title fw-bold">Manage Room Guests — Stay #{managingBooking.bookingID}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleSaveGuestsSubmit}>
                <div className="modal-body p-4">
                  <div className="p-3 bg-light rounded border mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Primary Guest:</span>
                      <strong className="text-dark">{managingBooking.firstName} {managingBooking.lastName}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Target Room:</span>
                      <strong className="text-pcc-blue">Room {managingBooking.roomNumber} ({managingBooking.roomType})</strong>
                    </div>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fw-bold text-dark mb-0">Registered Room Guests ({managingGuests.length})</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-pcc-primary text-white fw-bold"
                      onClick={() => setManagingGuests(prev => [...prev, { fullName: '', age: 30, discountID: '', discountIdNumber: '' }])}
                    >
                      + Add Guest
                    </button>
                  </div>

                  {managingGuests.map((g, idx) => (
                    <div key={idx} className="p-3 mb-2 rounded bg-light border position-relative">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="small text-muted fw-bold">Guest #{idx + 1} {idx === 0 && "(Primary Guest)"}</span>
                        <div className="d-flex align-items-center gap-2">
                          {g.age !== '' && g.age !== null && (
                            <span className={`badge ${parseInt(g.age) >= 60 ? 'bg-success' : 'bg-primary-subtle text-primary'}`} style={{ fontSize: '0.72rem' }}>
                              Age: {g.age} yrs {parseInt(g.age) >= 60 ? '— Senior Citizen Eligible' : ''}
                            </span>
                          )}
                          {idx > 0 && (
                            <button
                              type="button"
                              className="btn-close"
                              style={{ fontSize: '0.75rem' }}
                              onClick={() => setManagingGuests(prev => prev.filter((_, i) => i !== idx))}
                            ></button>
                          )}
                        </div>
                      </div>
                      <div className="row g-2">
                        <div className="col-md-6">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Full Name *"
                            required
                            value={g.fullName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setManagingGuests(prev => prev.map((item, i) => i === idx ? { ...item, fullName: val } : item));
                            }}
                          />
                        </div>
                        <div className="col-md-6">
                          <select
                            className="form-select form-select-sm"
                            value={g.discountID}
                            onChange={(e) => {
                              const val = e.target.value;
                              setManagingGuests(prev => prev.map((item, i) => i === idx ? { ...item, discountID: val } : item));
                            }}
                          >
                            <option value="">No Discount</option>
                            {availableDiscounts.map(d => (
                              <option key={d.discountID} value={String(d.discountID)}>{d.name} ({d.percentage}%)</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-secondary text-white" disabled={isSavingGuests} onClick={() => setActiveModal(null)}>Cancel</button>
                  <LoadingButton
                    type="submit"
                    isLoading={isSavingGuests}
                    loadingText="Saving Guests..."
                    className="btn btn-pcc-primary text-white fw-bold"
                  >
                    Save Registered Guests
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
      {/* CANCEL BOOKING REASON MODAL */}
      {activeModal === 'cancel_reason' && (
        <ModalPortal>
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.32)', backdropFilter: 'blur(10px) saturate(125%)', WebkitBackdropFilter: 'blur(10px) saturate(125%)', zIndex: 99999 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '16px' }}>
              <div className="modal-header text-white" style={{ background: '#dc3545' }}>
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <i className="fa-solid fa-ban"></i> Cancel Booking #{cancellingBookingID}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCancelSubmit}>
                <div className="modal-body p-4">
                  {cancellingBookingObj && cancellingBookingObj.status === 'Checked In' && (
                    <div className="alert alert-warning border-warning d-flex align-items-start gap-3 mb-3 p-3" style={{ borderRadius: '10px' }}>
                      <i className="fa-solid fa-triangle-exclamation text-warning fs-3 mt-1"></i>
                      <div className="small">
                        <strong className="text-dark d-block mb-1 fs-6">⚠️ Non-Refundable Policy Notice:</strong>
                        This guest is currently <strong>CHECKED IN</strong> to Room {cancellingBookingObj.roomNumber}. Cancelling this active stay will make the room available, but as per hotel policy, <strong>all payments made are strictly NON-REFUNDABLE</strong>.
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label fw-semibold text-dark">Cancellation Remarks / Reason *</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="Please specify reason for cancellation..."
                      required
                      value={cancelRemarks}
                      onChange={(e) => setCancelRemarks(e.target.value)}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer border-top px-4 py-3 d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary text-white" disabled={isCancellingBooking} onClick={() => setActiveModal(null)}>
                    Dismiss
                  </button>
                  <LoadingButton
                    type="submit"
                    isLoading={isCancellingBooking}
                    loadingText="Cancelling..."
                    className="btn btn-danger text-white fw-bold"
                  >
                    Confirm Cancellation
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* FINALIZE BILL MODAL */}
      {finalizeBillModal.isOpen && finalizeBillModal.booking && (
        <ModalPortal>
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.32)', backdropFilter: 'blur(10px) saturate(125%)', WebkitBackdropFilter: 'blur(10px) saturate(125%)', zIndex: 99999 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header text-white" style={{ backgroundColor: '#6f42c1' }}>
                <h5 className="modal-title fw-bold">
                  <i className="fa-solid fa-receipt me-2"></i>
                  Finalize Bill — Room {finalizeBillModal.booking.roomNumber}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setFinalizeBillModal({ isOpen: false, booking: null, singleDesc: '', singleAmount: '', processing: false })}
                ></button>
              </div>
              <form onSubmit={handleSaveFinalBill}>
                <div className="modal-body">
                  <div className="p-3 bg-light rounded border mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Guest:</span>
                      <strong className="text-dark">{finalizeBillModal.booking.firstName} {finalizeBillModal.booking.lastName}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Current Balance:</span>
                      <strong className="text-danger">₱{parseFloat(finalizeBillModal.booking.remainingBalance || finalizeBillModal.booking.finalBalance || 0).toFixed(2)}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">Current Status:</span>
                      <StatusBadge status={finalizeBillModal.booking.status} />
                    </div>
                  </div>

                  <h6 className="fw-bold text-dark mb-2" style={{ fontSize: '0.88rem' }}>
                    Add Incidental Fee / Damage Charge (Optional)
                  </h6>
                  <div className="mb-2">
                    <label className="form-label small fw-semibold mb-1">Description</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Minibar consumption, stained towel, key replacement"
                      value={finalizeBillModal.singleDesc}
                      onChange={(e) => setFinalizeBillModal(prev => ({ ...prev, singleDesc: e.target.value }))}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold mb-1">Amount (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control form-control-sm"
                      placeholder="0.00"
                      value={finalizeBillModal.singleAmount}
                      onChange={(e) => setFinalizeBillModal(prev => ({ ...prev, singleAmount: e.target.value }))}
                    />
                  </div>

                  <div className="alert alert-info py-2 px-3 small mb-0 d-flex align-items-center gap-2">
                    <i className="fa-solid fa-circle-info"></i>
                    <span>Finalizing the bill will update the booking status to <strong>Bill Ready</strong> and notify the guest.</span>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setFinalizeBillModal({ isOpen: false, booking: null, singleDesc: '', singleAmount: '', processing: false })}
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    className="btn btn-sm text-white fw-bold"
                    style={{ backgroundColor: '#6f42c1', borderColor: '#6f42c1' }}
                    isLoading={finalizeBillModal.processing}
                    loadingText="Finalizing..."
                  >
                    Confirm &amp; Finalize Bill
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}

export default function ReceptionistBookingsPage() {
  return (
    <Suspense fallback={null}>
      <BookingsClient />
    </Suspense>
  );
}
