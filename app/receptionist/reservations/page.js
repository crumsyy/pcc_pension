'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ModalDialog from '../../components/ModalDialog';
import DateInput, { isValidDate, toDbDate, toUiDate } from '../../components/DateInput';
import CalendarDatePicker from '../../components/CalendarDatePicker';
import ReservationCalendar from '../../components/ReservationCalendar';
import LoadingButton from '../../components/LoadingButton';
import SearchableSelect from '../../components/SearchableSelect';
import DynamicQrPhCode from '../../components/DynamicQrPhCode';

const calculateAgeFromUiDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length !== 3) return '';
  const m = parseInt(parts[0], 10);
  const d = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (isNaN(m) || isNaN(d) || isNaN(y)) return '';
  const birthDate = new Date(y, m - 1, d);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const mDiff = today.getMonth() - birthDate.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : '';
};

const calculateAgeFromDbDate = (dateStr) => {
  if (!dateStr) return '';
  const dStr = dateStr.substring(0, 10);
  const parts = dStr.split('-');
  if (parts.length !== 3) return '';
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(m) || isNaN(d) || isNaN(y)) return '';
  const birthDate = new Date(y, m - 1, d);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const mDiff = today.getMonth() - birthDate.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : '';
};

function getRoomDisplayImage(imgVal) {
  if (imgVal && typeof imgVal === 'string' && imgVal.trim()) {
    const trimmed = imgVal.trim();
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

function getCourtesyHoldTimeInfo(expiryStr) {
  if (!expiryStr) return { expired: true, text: 'Expired', inGrace: false, hours: 0, mins: 0 };
  const expiryTime = new Date(expiryStr).getTime();
  const now = Date.now();
  const diffMs = expiryTime - now;

  if (diffMs > 0) {
    const totalMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const timeText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
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
      text: `${graceMins}m in grace`
    };
  }

  return { expired: true, inGrace: false, text: 'Expired' };
}

function ReservationsClient() {
  const searchParams = useSearchParams();
  const [reservations, setReservations] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [availableDiscounts, setAvailableDiscounts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [maxDobStr, setMaxDobStr] = useState('');
  const [todayUiDate, setTodayUiDate] = useState('');
  const [todayDbDate, setTodayDbDate] = useState('');
  const [currentTimeStr, setCurrentTimeStr] = useState('');

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

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'edit' | 'convert' | null
  const [selectedRes, setSelectedRes] = useState(null);

  // Form states matching Booking Workspace (Unified guest form)
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [guestForm, setGuestForm] = useState({
    firstName: '',
    lastName: '',
    contact: '',
    email: '',
    gender: 'Male',
    dateOfBirth: ''
  });

  const [formData, setFormData] = useState({
    guestID: '',
    roomID: ''
  });

  const handleUidChange = (val) => {
    setFormData(prev => ({ ...prev, guestID: val }));
    setFormErrors(prev => ({ ...prev, guestID: '', firstName: '', lastName: '', contact: '', email: '', dateOfBirth: '' }));
    if (!val) {
      setIsAutoFilled(false);
      return;
    }
    const selected = guests.find(g => String(g.guestID) === String(val));
    if (selected) {
      setGuestForm({
        firstName: selected.firstName || '',
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
  const [breakfastOption, setBreakfastOption] = useState('with');

  const [resDate, setResDate] = useState('');
  const [resTime, setResTime] = useState('14:00');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [specialRequests, setSpecialRequests] = useState('');

  // Room guests matching Booking form
  const [roomGuests, setRoomGuests] = useState([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);

  // Convert/Confirm Booking States
  const [downPaymentOption, setDownPaymentOption] = useState('30');
  const [paymentMethodID, setPaymentMethodID] = useState('1');
  const [downPayment, setDownPayment] = useState('');
  const [convInDate, setConvInDate] = useState('');
  const [convInTime, setConvInTime] = useState('14:00');
  const [convOutDate, setConvOutDate] = useState('');
  const [convOutTime, setConvOutTime] = useState('12:00');
  const [isGcashSettled, setIsGcashSettled] = useState(false);
  const [convertCheckInNow, setConvertCheckInNow] = useState(false);
  const [gcashInlineError, setGcashInlineError] = useState('');
  const [settledPaymentRef, setSettledPaymentRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Nights Calculation for Reservations
  const calculateReservationNights = (inDateVal = resDate, outDateVal = checkOutDate) => {
    if (!inDateVal || !outDateVal) return 1;
    const dbIn = toDbDate(inDateVal);
    const dbOut = toDbDate(outDateVal);
    if (!dbIn || !dbOut) return 1;
    const inD = new Date(dbIn + 'T00:00:00');
    const outD = new Date(dbOut + 'T00:00:00');
    if (isNaN(inD.getTime()) || isNaN(outD.getTime()) || outD <= inD) return 1;
    return Math.max(1, Math.round((outD - inD) / (1000 * 60 * 60 * 24)));
  };

  const [roomSchedules, setRoomSchedules] = useState([]);
  const [guestCount, setGuestCount] = useState(1);
  const [formErrors, setFormErrors] = useState({});

  const getDisabledDatesForRoom = (roomId) => {
    if (!roomId || !roomSchedules || roomSchedules.length === 0) return [];
    const disabledSet = new Set();
    const pad = (n) => String(n).padStart(2, '0');

    roomSchedules.forEach(sched => {
      if (String(sched.roomID) !== String(roomId)) return;
      if (selectedRes && String(sched.reservationID) === String(selectedRes.reservationID)) return;
      const inStr = (sched.checkInDateTime || '').substring(0, 10);
      const outStr = (sched.checkOutDateTime || '').substring(0, 10);
      if (!inStr) return;

      let cur = new Date(inStr + 'T00:00:00');
      const end = outStr ? new Date(outStr + 'T00:00:00') : new Date(inStr + 'T00:00:00');

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

  const checkScheduleConflict = (roomId, inDate, outDate, currentResId = null) => {
    if (!roomId || !inDate || !roomSchedules || roomSchedules.length === 0) return false;
    const dbIn = toDbDate(inDate);
    const dbOut = outDate ? toDbDate(outDate) : null;
    if (!dbIn) return false;

    const reqIn = new Date(`${dbIn}T14:00:00`);
    const reqOut = dbOut ? new Date(`${dbOut}T12:00:00`) : new Date(new Date(`${dbIn}T14:00:00`).getTime() + 24 * 3600 * 1000);
    if (isNaN(reqIn.getTime()) || isNaN(reqOut.getTime())) return false;

    return roomSchedules.some(sched => {
      if (String(sched.roomID) !== String(roomId)) return false;
      if (currentResId && String(sched.reservationID) === String(currentResId)) return false;
      const sIn = new Date((sched.checkInDateTime || '').replace(' ', 'T'));
      const sOut = new Date((sched.checkOutDateTime || '').replace(' ', 'T'));
      if (isNaN(sIn.getTime()) || isNaN(sOut.getTime())) return false;
      return sIn < reqOut && sOut > reqIn;
    });
  };

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

  const isResToday = resDate === todayUiDate || (resDate && toDbDate(resDate) === todayDbDate);
  const isConvToday = convInDate === todayUiDate || (convInDate && toDbDate(convInDate) === todayDbDate);

  const handleResDateChange = (val) => {
    setResDate(val);
    if (val && isValidDate(val)) {
      const dbStr = toDbDate(val);
      if (dbStr) {
        const inDate = new Date(dbStr + 'T00:00:00');
        if (!isNaN(inDate.getTime())) {
          inDate.setDate(inDate.getDate() + 1);
          const pad = (n) => String(n).padStart(2, '0');
          const nextDayDb = `${inDate.getFullYear()}-${pad(inDate.getMonth() + 1)}-${pad(inDate.getDate())}`;
          setCheckOutDate(toUiDate(nextDayDb));
        }
      }
    }
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

  const showConfirm = (title, message, onConfirmCallback) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        await onConfirmCallback();
      },
      onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const getTodayUiDate = () => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(today.getMonth() + 1)}/${pad(today.getDate())}/${today.getFullYear()}`;
  };

  const getTomorrowUiDate = () => {
    const today = new Date();
    const target = new Date(today.getTime() + (1 * 24 * 60 * 60 * 1000));
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(target.getMonth() + 1)}/${pad(target.getDate())}/${target.getFullYear()}`;
  };

  const getTwoDaysAheadUiDate = () => {
    const today = new Date();
    const target = new Date(today.getTime() + (2 * 24 * 60 * 60 * 1000));
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(target.getMonth() + 1)}/${pad(target.getDate())}/${target.getFullYear()}`;
  };

  const minResDate = getTodayUiDate();
  const maxResDate = getTwoDaysAheadUiDate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/receptionist/reservations');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch reservations');

      setReservations(data.reservations || []);
      setGuests(data.guests || []);
      setRooms(data.rooms || []);
      setPaymentMethods(data.paymentMethods || []);
      setAvailableDiscounts(data.discounts || []);
      if (data.roomSchedules) setRoomSchedules(data.roomSchedules);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!loading && searchParams.get('action') === 'new') {
      const qCheckIn = searchParams.get('checkIn');
      const qRoomID = searchParams.get('roomID');
      const qFirstName = searchParams.get('firstName');
      const qLastName = searchParams.get('lastName');
      const qEmail = searchParams.get('email');
      const qContact = searchParams.get('contact');

      if (qCheckIn) {
        const formatParamDate = (dStr) => {
          const parts = dStr.split('-');
          if (parts.length === 3) {
            return `${parts[1]}/${parts[2]}/${parts[0]}`;
          }
          return '';
        };

        setResDate(formatParamDate(qCheckIn));
        setResTime("14:00");
        setCheckOutDate(getTomorrowUiDate());
        setCheckOutTime("12:00");
        setIsAutoFilled(false);
        setGuestForm({
          firstName: qFirstName || '',
          lastName: qLastName || '',
          email: qEmail || '',
          contact: qContact || '',
          gender: 'Male',
          dateOfBirth: ''
        });
        setFormData({
          guestID: '',
          roomID: qRoomID || ''
        });
        setActiveModal('create');
      }
    }
  }, [loading, searchParams]);

  useEffect(() => {
    if (activeModal === 'create') {
      const defaultDateStr = minResDate;
      const defaultOutStr = getTomorrowUiDate();

      setResDate(defaultDateStr);
      setResTime("14:00");
      setCheckOutDate(defaultOutStr);
      setCheckOutTime("12:00");
      setBreakfastOption('with');
      setSpecialRequests('');
      setFormData({
        guestID: '',
        roomID: '',
      });
      setIsCourtesyHold(false);
      setHoldDurationHours(48);
      setIsAutoFilled(false);
      setGuestForm({ firstName: '', lastName: '', contact: '', email: '', gender: 'Male', dateOfBirth: '' });
      setRoomGuests([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
    } else if (!activeModal) {
      setResDate('');
      setResTime('');
      setCheckOutDate('');
      setCheckOutTime('12:00');
      setSpecialRequests('');
      setFormData({ guestID: '', roomID: '' });
      setIsCourtesyHold(false);
      setHoldDurationHours(48);
      setIsAutoFilled(false);
      setGuestForm({ firstName: '', lastName: '', contact: '', email: '', gender: 'Male', dateOfBirth: '' });
      setSelectedRoomType('');
      setSelectedRes(null);
      setRoomGuests([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
    }
  }, [activeModal, guests, minResDate]);

  // Synchronize first guest name matching Booking form
  useEffect(() => {
    if (activeModal === 'create' || activeModal === 'edit') {
      let name = `${guestForm.firstName} ${guestForm.lastName}`.trim();
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
  }, [guestForm.firstName, guestForm.lastName, guestForm.dateOfBirth, activeModal]);

  const handleAddGuest = () => {
    setRoomGuests(prev => [...prev, { fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
  };

  const handleRemoveGuest = (index) => {
    if (roomGuests.length <= 1) return;
    setRoomGuests(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleGuestChange = (index, field, value) => {
    setRoomGuests(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const openEditModal = (res) => {
    setSelectedRes(res);
    setSelectedRoomType(res.roomType || '');
    setBreakfastOption(res.breakfastOption || 'with');
    setSpecialRequests(res.specialRequests || '');
    setGuestCount(res.guestCount || 1);
    setFormErrors({});
    setFormData({
      guestID: res.guestID ? String(res.guestID) : '',
      roomID: String(res.roomID)
    });
    setGuestForm({
      firstName: res.firstName || '',
      lastName: res.lastName || '',
      contact: res.contact || '',
      email: res.email || '',
      gender: res.gender || 'Male',
      dateOfBirth: res.dateOfBirth ? toUiDate(res.dateOfBirth) : ''
    });
    setIsAutoFilled(Boolean(res.guestID));

    if (res.reservationDateTime) {
      const dateOnly = res.reservationDateTime.substring(0, 10);
      setResDate(toUiDate(dateOnly));
      setResTime(res.reservationDateTime.length >= 16 ? res.reservationDateTime.substring(11, 16) : '14:00');
    } else {
      setResDate(minResDate);
      setResTime('14:00');
    }

    if (res.checkOutDateTime) {
      setCheckOutDate(toUiDate(res.checkOutDateTime.substring(0, 10)));
      setCheckOutTime(res.checkOutDateTime.length >= 16 ? res.checkOutDateTime.substring(11, 16) : '12:00');
    } else {
      setCheckOutDate(getTomorrowUiDate());
      setCheckOutTime('12:00');
    }

    setActiveModal('edit');
  };

  const openConvertModal = (res) => {
    if (['Released', 'Canceled', 'Cancelled', 'Expired', 'No Show'].includes(res.status)) {
      showAlert('error', 'Cannot Convert', `This reservation cannot be converted because its status is ${res.status}.`);
      return;
    }
    if (res.isCourtesyHold && res.holdExpiryDateTime) {
      const expiry = new Date(new Date(res.holdExpiryDateTime).getTime() + 30 * 60 * 1000);
      if (new Date() > expiry) {
        showAlert('error', 'Expired Courtesy Hold', 'This courtesy hold has expired (past the 48-hour hold and 30-minute grace period) and cannot be converted to a booking.');
        return;
      }
    }

    setSelectedRes(res);
    const inDateOnly = res.reservationDateTime ? res.reservationDateTime.substring(0, 10) : '';
    const inTimeOnly = res.reservationDateTime && res.reservationDateTime.length >= 16 ? res.reservationDateTime.substring(11, 16) : '14:00';

    const outDateOnly = res.checkOutDateTime ? res.checkOutDateTime.substring(0, 10) : '';
    const outTimeOnly = res.checkOutDateTime && res.checkOutDateTime.length >= 16 ? res.checkOutDateTime.substring(11, 16) : '12:00';

    setConvInDate(inDateOnly ? toUiDate(inDateOnly) : minResDate);
    setConvInTime(inTimeOnly);

    if (outDateOnly) {
      setConvOutDate(toUiDate(outDateOnly));
      setConvOutTime(outTimeOnly);
    } else {
      setConvOutDate(getTomorrowUiDate());
      setConvOutTime('12:00');
    }

    setDownPaymentOption('30');
    setPaymentMethodID('1');
    setDownPayment('');
    setIsGcashSettled(false);
    setConvertCheckInNow(false);
    setGcashInlineError('');
    setSettledPaymentRef('');
    setActiveModal('convert');
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    const errors = {};
    if (!guestForm.firstName || !guestForm.firstName.trim()) {
      errors.firstName = 'First name is required.';
    }
    if (!guestForm.lastName || !guestForm.lastName.trim()) {
      errors.lastName = 'Last name is required.';
    }
    if (!guestForm.contact || guestForm.contact.length !== 11) {
      errors.contact = 'Contact number must be exactly 11 digits (e.g. 09XXXXXXXXX).';
    }
    if (!guestForm.dateOfBirth) {
      errors.dateOfBirth = 'Birthdate is required.';
    } else {
      const calculatedAge = calculateAgeFromUiDate(guestForm.dateOfBirth);
      if (typeof calculatedAge === 'number' && calculatedAge < 18) {
        errors.dateOfBirth = 'Guest must be at least 18 years old to make a reservation.';
      }
    }
    if (!guestForm.email || !guestForm.email.trim()) {
      errors.email = 'Email address is required for Courtesy Hold to receive expiry alerts and auto-release notices.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestForm.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!selectedRoomType) {
      errors.roomType = 'Please select a room type.';
    }
    if (!formData.roomID) {
      errors.roomID = 'Please select an available room.';
    }

    if (!resDate || !isValidDate(resDate)) {
      errors.resDate = 'Please enter a valid reservation date.';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDateObj = new Date(toDbDate(resDate) + 'T00:00:00');
      selectedDateObj.setHours(0, 0, 0, 0);

      const diffDays = Math.round((selectedDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        errors.resDate = 'Reservation check-in date cannot be in the past.';
      }
    }

    if (!resTime) {
      errors.resTime = 'Please select a check-in time.';
    }

    if (!checkOutDate || !isValidDate(checkOutDate)) {
      errors.checkOutDate = 'Please enter a valid check-out date.';
    } else if (resDate && isValidDate(resDate)) {
      const inDateObj = new Date(toDbDate(resDate) + 'T' + (resTime || '14:00') + ':00');
      const outDateObj = new Date(toDbDate(checkOutDate) + 'T' + (checkOutTime || '12:00') + ':00');
      if (outDateObj <= inDateObj) {
        errors.checkOutDate = 'Check-out time must be later than check-in time.';
      }
    }

    if (formData.roomID && resDate && checkOutDate) {
      const hasConflict = checkScheduleConflict(formData.roomID, resDate, checkOutDate);
      if (hasConflict) {
        errors.conflict = `Room ${selectedRoomObj?.roomNumber || ''} is already reserved, held, or booked for the selected dates.`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showAlert('error', 'Validation Error', Object.values(errors)[0]);
      return;
    }

    setFormErrors({});

    const isWalkIn = !formData.guestID;
    const confirmTitle = 'Place Courtesy Hold';
    const confirmMsg = `Are you sure you want to place a 48-hour Courtesy Hold on this room? No payment is required immediately.`;

    showConfirm(confirmTitle, confirmMsg, async () => {
      setIsSubmitting(true);
      try {
        const res = await fetch('/api/receptionist/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            isWalkIn,
            guestID: formData.guestID || null,
            firstName: guestForm.firstName,
            lastName: guestForm.lastName,
            contact: guestForm.contact,
            email: guestForm.email,
            gender: guestForm.gender || 'Male',
            dateOfBirth: guestForm.dateOfBirth ? toDbDate(guestForm.dateOfBirth) : null,
            roomID: formData.roomID,
            reservationDateTime: toDbDate(resDate) + ' ' + (resTime || '14:00') + ':00',
            checkOutDateTime: checkOutDate && isValidDate(checkOutDate) ? toDbDate(checkOutDate) + ' ' + (checkOutTime || '12:00') + ':00' : null,
            guestCount: parseInt(guestCount, 10) || 1,
            specialRequests: specialRequests || null,
            breakfastOption,
            isCourtesyHold: true,
            holdDurationHours: 48
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to place courtesy hold');

        showAlert('success', 'Success', data.message || 'Courtesy hold created successfully.');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRes) return;

    const errors = {};
    if (!selectedRoomType) {
      errors.roomType = 'Please select a room type.';
    }
    if (!formData.roomID) {
      errors.roomID = 'Please select an available room.';
    }

    if (!resDate || !isValidDate(resDate)) {
      errors.resDate = 'Please enter a valid reservation date.';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDateObj = new Date(toDbDate(resDate) + 'T00:00:00');
      selectedDateObj.setHours(0, 0, 0, 0);

      const diffDays = Math.round((selectedDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        errors.resDate = 'Reservation check-in date cannot be in the past.';
      }
    }

    if (!resTime) {
      errors.resTime = 'Please select a check-in time.';
    }

    if (!checkOutDate || !isValidDate(checkOutDate)) {
      errors.checkOutDate = 'Please enter a valid check-out date.';
    } else if (resDate && isValidDate(resDate)) {
      const inDateObj = new Date(toDbDate(resDate) + 'T' + (resTime || '14:00') + ':00');
      const outDateObj = new Date(toDbDate(checkOutDate) + 'T' + (checkOutTime || '12:00') + ':00');
      if (outDateObj <= inDateObj) {
        errors.checkOutDate = 'Check-out time must be later than check-in time.';
      }
    }

    if (formData.roomID && resDate && checkOutDate) {
      const hasConflict = checkScheduleConflict(formData.roomID, resDate, checkOutDate, selectedRes.reservationID);
      if (hasConflict) {
        errors.conflict = `Room ${selectedRoomObj?.roomNumber || ''} is already reserved, held, or booked for the selected dates.`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showAlert('error', 'Validation Error', Object.values(errors)[0]);
      return;
    }

    setFormErrors({});

    showConfirm('Update Reservation', 'Are you sure you want to update this reservation?', async () => {
      setIsSubmitting(true);
      try {
        const res = await fetch('/api/receptionist/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            reservationID: selectedRes.reservationID,
            roomID: formData.roomID,
            reservationDateTime: toDbDate(resDate) + ' ' + (resTime || '14:00') + ':00',
            checkOutDateTime: checkOutDate && isValidDate(checkOutDate) ? toDbDate(checkOutDate) + ' ' + (checkOutTime || '12:00') + ':00' : null,
            guestCount: parseInt(guestCount, 10) || 1,
            specialRequests: specialRequests || null,
            breakfastOption
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update reservation');

        showAlert('success', 'Success', 'Reservation updated successfully.');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handleConvertSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRes) return;

    if (!isValidDate(convInDate) || !isValidDate(convOutDate)) {
      showAlert('error', 'Validation Error', 'Please enter valid Check-In and Check-Out dates (MM/DD/YYYY).');
      return;
    }

    const inDateObj = new Date(toDbDate(convInDate) + 'T' + convInTime);
    const outDateObj = new Date(toDbDate(convOutDate) + 'T' + convOutTime);

    if (outDateObj <= inDateObj) {
      showAlert('error', 'Validation Error', 'Check-Out date & time must be after Check-In date & time.');
      return;
    }

    // Rate calculation matching Booking Workspace
    const selectedRoom = rooms.find(r => String(r.roomID) === String(selectedRes.roomID));
    const isWithBk = (selectedRes.breakfastOption || breakfastOption) === 'with';
    const rate = selectedRoom
      ? (isWithBk
        ? (parseFloat(selectedRoom.rateWithBreakfast) || parseFloat(selectedRoom.rate) || 0)
        : (parseFloat(selectedRoom.rateWithoutBreakfast) || (parseFloat(selectedRoom.rate) ? parseFloat(selectedRoom.rate) - 200 : 0)))
      : parseFloat(selectedRes.rate || 0);

    const diff = Math.abs(outDateObj - inDateObj);
    const nights = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
    const totalRoomCharge = rate * nights;
    const dpPct = parseInt(downPaymentOption) || 30;
    const requiredDownpayment = totalRoomCharge * (dpPct / 100);

    const cashReceived = String(paymentMethodID) === '2' ? requiredDownpayment : parseFloat(downPayment || 0);

    if (String(paymentMethodID) === '1' && (isNaN(cashReceived) || cashReceived < requiredDownpayment)) {
      showAlert('error', 'Validation Error', `Minimum required down payment is ₱${requiredDownpayment.toFixed(2)} (${dpPct}% Tier).`);
      return;
    }

    if (String(paymentMethodID) === '2' && !isGcashSettled) {
      setGcashInlineError('Cannot proceed: GCash payment not settled. Please scan and verify the QR payment before saving.');
      showAlert('error', 'Payment Unsettled', 'Cannot proceed: GCash payment not settled. Please scan and verify the QR payment before saving.');
      return;
    }

    const change = Math.max(0, cashReceived - requiredDownpayment);
    const actionTitle = convertCheckInNow ? 'Book and Check‑In Now' : 'Confirm & Record Booking';
    const actionMsg = convertCheckInNow
      ? 'Are you sure you want to convert this reservation and check-in the guest immediately?'
      : 'Are you sure you want to confirm this reservation and record down payment?';

    showConfirm(actionTitle, actionMsg, async () => {
      try {
        const res = await fetch('/api/receptionist/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'convert_to_booking',
            reservationID: selectedRes.reservationID,
            checkInDateTime: toDbDate(convInDate) + ' ' + convInTime + ':00',
            checkOutDateTime: toDbDate(convOutDate) + ' ' + convOutTime + ':00',
            downPaymentAmount: requiredDownpayment,
            cashReceived: cashReceived,
            change: change,
            paymentMethodID: parseInt(paymentMethodID),
            checkInNow: convertCheckInNow,
            paymentStatus: String(paymentMethodID) === '2' ? 'Settled' : 'Settled',
            isGcashSettled: isGcashSettled,
            referenceNumber: settledPaymentRef || null
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to convert reservation to booking');

        showAlert('success', 'Success', data.message || (convertCheckInNow ? 'Reservation confirmed and guest checked in successfully.' : 'Reservation confirmed and converted to booking successfully.'));
        setActiveModal(null);
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleCancel = (id) => {
    showConfirm('Cancel Reservation', 'Are you sure you want to cancel this reservation?', async () => {
      try {
        const res = await fetch('/api/receptionist/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel', reservationID: id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to cancel reservation');

        showAlert('success', 'Success', 'Reservation canceled successfully.');
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleReleaseHold = (id) => {
    showConfirm('Release Courtesy Hold', 'Are you sure you want to release this courtesy hold? The room will immediately become Available for other bookings.', async () => {
      try {
        const res = await fetch('/api/receptionist/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'release_hold', reservationID: id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to release courtesy hold');

        showAlert('success', 'Hold Released', data.message || 'Courtesy hold released successfully.');
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleReinstate = (id) => {
    showConfirm('Reinstate Reservation', 'Are you sure you want to reinstate this No Show reservation back to Confirmed?', async () => {
      try {
        const res = await fetch('/api/receptionist/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'overrideStatus', reservationID: id, status: 'Confirmed' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to reinstate reservation');

        showAlert('success', 'Success', 'Reservation reinstated to Confirmed.');
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Confirmed': return 'bg-success text-white';
      case 'Pending': return 'bg-info text-dark';
      case 'Overdue Check-In': return 'bg-warning text-dark';
      case 'No Show': return 'bg-danger text-white';
      case 'Courtesy Hold': return 'text-white';
      case 'Released': return 'bg-secondary text-white';
      case 'Canceled':
      case 'Cancelled': return 'bg-secondary text-white';
      case 'Expired': return 'bg-secondary text-white';
      default: return 'bg-primary text-white';
    }
  };

  const filteredReservations = reservations.filter(r => {
    const matchesSearch = `${r.firstName} ${r.lastName} ${r.roomNumber} ${r.contact}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? (statusFilter === 'Booked' ? r.bookingID : r.status === statusFilter) : true;
    return matchesSearch && matchesStatus;
  });

  const selectedRoomObj = rooms.find(rm => String(rm.roomID) === String(formData.roomID));

  return (
    <>
      <div className="container-fluid p-4">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="h4 mb-0 font-weight-bold text-pcc-primary">Reservation Management</h2>
            <p className="text-muted small mb-0">View, manage, and process guest room reservations</p>
          </div>
          <button className="btn btn-pcc-primary text-white font-weight-bold" onClick={() => setActiveModal('create')}>
            <i className="fa-solid fa-plus me-2"></i>New Reservation
          </button>
        </div>

        {/* Filters */}
        <div className="row g-3 mb-4">
          <div className="col-md-6">
            <input
              type="text"
              className="form-control"
              placeholder="Search by guest name, room number, or contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-md-4">
            <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Courtesy Hold">Courtesy Hold</option>
              <option value="Overdue Check-In">Overdue Check-In</option>
              <option value="Booked">Booked</option>
              <option value="Released">Released</option>
              <option value="No Show">No Show</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="col-md-2">
            <button className="btn btn-pcc-primary w-100 text-white" onClick={() => { setSearch(''); setStatusFilter(''); }}>
              Clear
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="text-muted mt-2">Loading reservations...</p>
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="text-center py-5 text-muted">No reservations found matching the filters.</div>
        ) : (
          <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            <table className="table table-hover align-middle mb-0" style={{ fontSize: "0.9rem" }}>
              <thead>
                <tr className="table-light">
                  <th>Guest Name</th>
                  <th>Room & Inclusions</th>
                  <th>Reservation Date & Time</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReservations.map((r) => (
                  <tr key={r.reservationID}>
                    <td>
                      <div className="fw-semibold text-dark">
                        {r.middleName ? `${r.firstName || ''} ${r.middleName.charAt(0).toUpperCase()}. ${r.lastName || ''}`.trim() : `${r.firstName || ''} ${r.lastName || ''}`.trim()}
                      </div>
                      <small className="text-muted">{r.contact || 'No contact'}</small>
                    </td>
                    <td>
                      <div>
                        <div className="fw-semibold text-dark">Room {r.roomNumber || 'N/A'} ({r.roomType || 'Standard'})</div>
                        <small className="badge bg-light text-dark border">
                          {r.breakfastOption === 'without' ? 'Without Breakfast' : 'With Breakfast'}
                        </small>
                      </div>
                    </td>
                    <td>{r.reservationDateTime ? new Date(r.reservationDateTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}</td>
                    <td>
                      {r.bookingID ? (
                        <span className="badge bg-success text-white">Booked</span>
                      ) : r.status === 'Courtesy Hold' ? (
                        <div>
                          <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#fff' }} aria-label="Courtesy Hold Status">
                            Courtesy Hold
                          </span>
                          {(() => {
                            const holdInfo = getCourtesyHoldTimeInfo(r.holdExpiryDateTime);
                            if (!holdInfo.inGrace && !holdInfo.expired) {
                              return (
                                <div className="text-warning-emphasis fw-bold mt-1" role="timer" aria-label="Courtesy Hold Expiration" style={{ fontSize: '0.72rem' }}>
                                  <i className="fa-regular fa-clock me-1 text-warning"></i>
                                  {holdInfo.text} left
                                </div>
                              );
                            }
                            if (holdInfo.inGrace) {
                              return (
                                <div className="badge bg-warning text-dark mt-1 text-wrap" style={{ fontSize: '0.68rem' }} role="alert" aria-label="Courtesy Hold Grace Period Active">
                                  <i className="fa-solid fa-triangle-exclamation text-danger me-1"></i>
                                  Grace: {holdInfo.graceMins}m left
                                </div>
                              );
                            }
                            return (
                              <div className="text-muted small mt-0.5" style={{ fontSize: '0.70rem' }}>
                                Expired
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className={`badge ${getStatusBadge(r.status)}`}>{r.status}</span>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="actions-wrapper d-flex justify-content-end gap-1">
                        {!r.bookingID && r.status === 'Courtesy Hold' && (() => {
                          const holdInfo = getCourtesyHoldTimeInfo(r.holdExpiryDateTime);
                          const isExpired = holdInfo.expired;
                          return (
                            <>
                              {!isExpired && (
                                <button
                                  type="button"
                                  className="action-btn action-btn-activate"
                                  data-bs-toggle="tooltip"
                                  title="Confirm & Convert Hold to Booking"
                                  aria-label="Confirm & Convert Hold to Booking"
                                  onClick={() => openConvertModal(r)}
                                >
                                  <i className="fa-solid fa-book-bookmark"></i>
                                </button>
                              )}
                              <button
                                type="button"
                                className="action-btn action-btn-edit"
                                data-bs-toggle="tooltip"
                                title="Edit Reservation"
                                aria-label="Edit Reservation"
                                onClick={() => openEditModal(r)}
                              >
                                <i className="fa-solid fa-pen-to-square"></i>
                              </button>
                              <button
                                type="button"
                                className="action-btn"
                                style={{ color: '#d9480f', borderColor: '#fd7e14' }}
                                data-bs-toggle="tooltip"
                                title="Manually Release Courtesy Hold"
                                aria-label="Manually Release Courtesy Hold"
                                onClick={() => handleReleaseHold(r.reservationID)}
                              >
                                <i className="fa-solid fa-unlock-keyhole"></i>
                              </button>
                            </>
                          );
                        })()}
                        {!r.bookingID && (r.status === 'Pending' || r.status === 'Overdue Check-In') && (
                          <>
                            <button
                              type="button"
                              className="action-btn action-btn-activate"
                              data-bs-toggle="tooltip"
                              title="Confirm & Book Reservation"
                              aria-label="Confirm & Book Reservation"
                              onClick={() => openConvertModal(r)}
                            >
                              <i className="fa-solid fa-book-bookmark"></i>
                            </button>
                            <button
                              type="button"
                              className="action-btn action-btn-edit"
                              data-bs-toggle="tooltip"
                              title="Edit Reservation"
                              aria-label="Edit Reservation"
                              onClick={() => openEditModal(r)}
                            >
                              <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                          </>
                        )}
                        {!r.bookingID && r.status === 'No Show' && (
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm py-0 px-2 fw-semibold"
                            style={{ fontSize: '0.75rem' }}
                            title="Reinstate to Confirmed"
                            onClick={() => handleReinstate(r.reservationID)}
                          >
                            <i className="fa-solid fa-rotate-left me-1"></i> Reinstate
                          </button>
                        )}
                        {!r.bookingID && r.status !== 'Cancelled' && r.status !== 'Expired' && r.status !== 'No Show' && (
                          <button
                            type="button"
                            className="action-btn action-btn-delete"
                            data-bs-toggle="tooltip"
                            title="Cancel Reservation"
                            aria-label="Cancel Reservation"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancel(r.reservationID);
                            }}
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        )}
                        {r.bookingID && (
                          <span className="text-muted small font-italic">✓ Converted to Booking</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT RESERVATION MODAL (Matching Booking Workspace Design & Guest Form Parity) */}
      {(activeModal === 'create' || activeModal === 'edit') && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header text-white" style={{ background: 'var(--pcc-blue)' }}>
                <h5 className="modal-title fw-bold">
                  {activeModal === 'create' ? 'New Lodging Reservation Workspace' : 'Edit Lodging Reservation Workspace'}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>

              <form onSubmit={activeModal === 'create' ? handleCreateSubmit : handleUpdateSubmit}>
                <div className="modal-body" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>

                  {/* Courtesy Hold Notice Banner */}
                  <div className="alert alert-warning small fw-semibold mb-3" role="alert">
                    <i className="bi bi-info-circle-fill me-1.5"></i>
                    <strong>Courtesy Hold:</strong> This room will be held for 48 hours without payment. 
                    If not confirmed with payment, it will be automatically released after a 30-minute grace period.
                  </div>

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
                      options={[
                        { value: '', label: '-- None (Walk-In Guest - Manual Entry) --' },
                        ...guests.map(g => ({
                          value: String(g.guestID),
                          label: `UID${g.userID || g.guestID} – ${g.firstName} ${g.lastName} (${g.contact || 'No contact'})`
                        }))
                      ]}
                      value={formData.guestID}
                      onChange={handleUidChange}
                      placeholder="Type UID, guest name or contact to search..."
                    />
                    <div className="form-text text-muted small mt-1">
                      <i className="bi bi-info-circle me-1"></i>
                      Leave blank for walk-in guest.
                    </div>
                    {formErrors.guestID && (
                      <div className="text-danger small mt-1 fw-semibold">{formErrors.guestID}</div>
                    )}
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
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold mb-1">First Name *</label>
                        <input
                          type="text"
                          className={`form-control form-control-sm ${formErrors.firstName ? 'is-invalid border-danger' : ''}`}
                          required
                          value={guestForm.firstName}
                          onChange={(e) => {
                            setGuestForm(prev => ({ ...prev, firstName: e.target.value }));
                            setFormErrors(prev => ({ ...prev, firstName: '' }));
                          }}
                        />
                        {formErrors.firstName && (
                          <div className="text-danger small mt-1 fw-semibold">{formErrors.firstName}</div>
                        )}
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold mb-1">Last Name *</label>
                        <input
                          type="text"
                          className={`form-control form-control-sm ${formErrors.lastName ? 'is-invalid border-danger' : ''}`}
                          required
                          value={guestForm.lastName}
                          onChange={(e) => {
                            setGuestForm(prev => ({ ...prev, lastName: e.target.value }));
                            setFormErrors(prev => ({ ...prev, lastName: '' }));
                          }}
                        />
                        {formErrors.lastName && (
                          <div className="text-danger small mt-1 fw-semibold">{formErrors.lastName}</div>
                        )}
                      </div>
                    </div>

                    <div className="row g-2">
                      <div className="col-md-4 mb-2">
                        <label className="form-label small fw-semibold mb-1">Contact Number (11 digits) *</label>
                        <input
                          type="text"
                          className={`form-control form-control-sm ${formErrors.contact ? 'is-invalid border-danger' : ''}`}
                          placeholder="09XXXXXXXXX"
                          required
                          value={guestForm.contact}
                          onChange={(e) => {
                            const sanitized = e.target.value.replace(/[^0-9]/g, "").slice(0, 11);
                            setGuestForm(prev => ({ ...prev, contact: sanitized }));
                            setFormErrors(prev => ({ ...prev, contact: '' }));
                          }}
                        />
                        {formErrors.contact && (
                          <div className="text-danger small mt-1 fw-semibold">{formErrors.contact}</div>
                        )}
                      </div>
                      <div className="col-md-4 mb-2">
                        <label className="form-label small fw-semibold mb-1">Birthdate (18+) *</label>
                        <DateInput
                          className={`form-control form-control-sm ${formErrors.dateOfBirth ? 'is-invalid border-danger' : ''}`}
                          value={guestForm.dateOfBirth}
                          onChange={(e) => {
                            setGuestForm(prev => ({ ...prev, dateOfBirth: e.target.value }));
                            setFormErrors(prev => ({ ...prev, dateOfBirth: '' }));
                          }}
                          max={maxDobStr}
                        />
                        {formErrors.dateOfBirth && (
                          <div className="text-danger small mt-1 fw-semibold">{formErrors.dateOfBirth}</div>
                        )}
                      </div>
                      <div className="col-md-4 mb-2">
                        <label className="form-label small fw-semibold mb-1">
                          Email Address <span className="text-danger fw-bold">* (Required)</span>
                        </label>
                        <input
                          type="email"
                          className={`form-control form-control-sm ${formErrors.email ? 'is-invalid border-danger' : (!guestForm.email ? 'border-warning' : '')}`}
                          placeholder="name@example.com"
                          required
                          value={guestForm.email}
                          onChange={(e) => {
                            setGuestForm(prev => ({ ...prev, email: e.target.value }));
                            setFormErrors(prev => ({ ...prev, email: '' }));
                          }}
                        />
                        {formErrors.email ? (
                          <div className="text-danger small mt-1 fw-semibold">{formErrors.email}</div>
                        ) : (
                          <div className="form-text text-muted" style={{ fontSize: '0.70rem' }}>
                            Required for Courtesy Hold expiry alerts and auto-release notices.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ROOM SELECTION & BREAKFAST INCLUSION */}
                  <div className="row g-2 mb-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Room Type *</label>
                      <select
                        className={`form-select ${formErrors.roomType ? 'is-invalid border-danger' : ''}`}
                        required
                        value={selectedRoomType}
                        onChange={(e) => {
                          setSelectedRoomType(e.target.value);
                          setFormData(prev => ({ ...prev, roomID: '' }));
                          setFormErrors(prev => ({ ...prev, roomType: '', roomID: '' }));
                        }}
                      >
                        <option value="" disabled>Select Room Type</option>
                        {[...new Set(rooms.map(rm => rm.roomType))].map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      {formErrors.roomType && (
                        <div className="text-danger small mt-1 fw-semibold">{formErrors.roomType}</div>
                      )}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Available Room *</label>
                      <select
                        className={`form-select ${formErrors.roomID ? 'is-invalid border-danger' : ''}`}
                        required
                        value={formData.roomID}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, roomID: e.target.value }));
                          setFormErrors(prev => ({ ...prev, roomID: '' }));
                        }}
                        disabled={!selectedRoomType}
                      >
                        <option value="" disabled>
                          {selectedRoomType ? "Select Available Room" : "Choose Room Type first"}
                        </option>
                        {rooms
                          .filter(rm => rm.roomType === selectedRoomType && (rm.status === 'Available' || String(rm.roomID) === String(formData.roomID)))
                          .map(rm => (
                            <option key={rm.roomID} value={String(rm.roomID)}>
                              Room {rm.roomNumber} (Max {rm.occupancyLimit || 2} Pax)
                            </option>
                          ))
                        }
                      </select>
                      {formErrors.roomID && (
                        <div className="text-danger small mt-1 fw-semibold">{formErrors.roomID}</div>
                      )}
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold d-flex justify-content-between">
                        <span>Breakfast Inclusion *</span>
                        {selectedRoomObj && selectedRoomObj.breakfastRate !== null && selectedRoomObj.breakfastRate !== undefined && parseFloat(selectedRoomObj.breakfastRate) === 0 && (
                          <span className="text-success fw-semibold">(Complimentary)</span>
                        )}
                      </label>
                      <select
                        className="form-select fw-semibold"
                        value={breakfastOption}
                        onChange={(e) => setBreakfastOption(e.target.value)}
                        disabled={Boolean(selectedRoomObj && selectedRoomObj.breakfastRate !== null && selectedRoomObj.breakfastRate !== undefined && parseFloat(selectedRoomObj.breakfastRate) === 0)}
                      >
                        <option value="with">
                          With Breakfast{selectedRoomObj && selectedRoomObj.breakfastRate !== null && selectedRoomObj.breakfastRate !== undefined && parseFloat(selectedRoomObj.breakfastRate) === 0 ? ' (Free)' : ''}
                        </option>
                        {(!selectedRoomObj || selectedRoomObj.breakfastRate === null || selectedRoomObj.breakfastRate === undefined || parseFloat(selectedRoomObj.breakfastRate) !== 0) && (
                          <option value="without">Without Breakfast</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* ROOM BASE PRICE DISPLAY */}
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
                                ? (parseFloat(selectedRoomObj.rateWithBreakfast) || (selectedRoomObj.breakfastRate !== null && selectedRoomObj.breakfastRate !== undefined ? parseFloat(selectedRoomObj.rate) + parseFloat(selectedRoomObj.breakfastRate) : parseFloat(selectedRoomObj.rate)) || 0)
                                : (parseFloat(selectedRoomObj.rateWithoutBreakfast) || parseFloat(selectedRoomObj.rate) || 0)
                            ).toFixed(2)}</span> / night
                          </div>
                          <small className="text-muted">
                            ({breakfastOption === 'with' ? 'Daily Breakfast Included' : 'Standard Stay Without Breakfast'})
                          </small>
                        </div>
                      </div>
                      <span className="badge bg-primary px-3 py-1.5 rounded-pill fs-6">
                        Maximum Occupancy: {selectedRoomObj.occupancyLimit || 2} Guests
                      </span>
                    </div>
                  )}

                  {/* ROOM OCCUPANCY & NUMBER OF GUESTS */}
                  {selectedRoomObj && (
                    <div className="p-3 mb-3 border rounded bg-white">
                      <div className="row g-2 align-items-center mb-2">
                        <div className="col-md-6">
                          <label className="form-label fw-bold mb-0 small text-dark">Total Number of Guests *</label>
                          <input
                            type="number"
                            className="form-control form-control-sm mt-1"
                            min="1"
                            max={(selectedRoomObj.occupancyLimit || 2) + 5}
                            value={guestCount}
                            onChange={(e) => setGuestCount(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                            required
                          />
                          <div className="small text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                            Standard Room Capacity: <strong>Up to {selectedRoomObj.occupancyLimit || 2} Pax</strong>
                            {Number(guestCount) > (selectedRoomObj.occupancyLimit || 2) && (
                              <span className="text-primary fw-bold ms-1">
                                (+₱{(Number(guestCount) - (selectedRoomObj.occupancyLimit || 2)) * 100} for {Number(guestCount) - (selectedRoomObj.occupancyLimit || 2)} extra guest(s) @ ₱100 flat)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="col-md-6">
                          {Number(guestCount) > (selectedRoomObj.occupancyLimit || 2) && (
                            <div className="alert alert-warning py-1.5 px-2.5 mb-0 small fw-bold">
                              Extra Guest Fee: ₱100 flat per extra guest applied for {Number(guestCount) - (selectedRoomObj.occupancyLimit || 2)} guest(s).
                              <div>Total Extra Fee: ₱{(Number(guestCount) - (selectedRoomObj.occupancyLimit || 2)) * 100}.00</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}


                  {/* SCHEDULE CONFLICT ALERT (Parity with Guest Form) */}
                  {formData.roomID && resDate && checkScheduleConflict(formData.roomID, resDate, checkOutDate, activeModal === 'edit' ? selectedRes?.reservationID : null) && (
                    <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
                      <i className="bi bi-exclamation-triangle-fill me-1.5 fw-bold"></i>
                      <strong>Schedule Conflict:</strong> Room {selectedRoomObj?.roomNumber} is already reserved, held, or booked for the selected date(s). Please select an alternative date or room.
                    </div>
                  )}

                  {/* RESERVATION CHECK-IN & CHECK-OUT DATES & TIMES */}
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Check-In Date *</label>
                      <input
                        type="date"
                        className={`form-control form-control-sm mb-1 ${formErrors.resDate ? 'is-invalid border-danger' : ''}`}
                        value={toDbDate(resDate)}
                        min={todayDbDate}
                        onChange={(e) => {
                          handleResDateChange(e.target.value);
                          setFormErrors(prev => ({ ...prev, resDate: '', checkOutDate: '', conflict: '' }));
                        }}
                        required
                      />
                      {formErrors.resDate && (
                        <div className="text-danger small mb-1 fw-semibold">{formErrors.resDate}</div>
                      )}
                      <div className="mt-2">
                        <label className="form-label small fw-semibold d-flex justify-content-between">
                          <span>Check-In Time *</span>
                          <small className="text-muted" style={{ fontSize: '0.72rem' }}>Std: 2:00 PM</small>
                        </label>
                        <input
                          type="time"
                          className="form-control form-control-sm"
                          value={resTime}
                          min={isResToday ? currentTimeStr : undefined}
                          onChange={(e) => setResTime(e.target.value)}
                          required
                        />
                        {isResToday && (
                          <small className="text-muted d-block mt-1" style={{ fontSize: '0.72rem' }}>
                            Earliest selectable time today: {currentTimeStr}
                          </small>
                        )}
                        {resTime && resTime < '14:00' && (
                          <small className="text-warning-emphasis d-block mt-1 fw-semibold" style={{ fontSize: '0.72rem' }}>
                            ℹ Early Check-in prior to 2:00 PM fee may apply.
                          </small>
                        )}
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Check-Out Date *</label>
                      <input
                        type="date"
                        className={`form-control form-control-sm mb-1 ${formErrors.checkOutDate ? 'is-invalid border-danger' : ''}`}
                        value={toDbDate(checkOutDate)}
                        min={resDate ? toDbDate(resDate) : todayDbDate}
                        onChange={(e) => {
                          setCheckOutDate(e.target.value);
                          setFormErrors(prev => ({ ...prev, checkOutDate: '', conflict: '' }));
                        }}
                        required
                      />
                      {formErrors.checkOutDate && (
                        <div className="text-danger small mb-1 fw-semibold">{formErrors.checkOutDate}</div>
                      )}
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
                        {checkOutTime && checkOutTime > '12:00' && (
                          <small className="text-danger d-block mt-1 fw-semibold" style={{ fontSize: '0.72rem' }}>
                            ℹ Late Check-out past 12:00 PM fee applied @ ₱100/hr.
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
                        checkInDate={resDate}
                        checkOutDate={checkOutDate}
                        title={selectedRoomObj ? `Room ${selectedRoomObj.roomNumber} Availability & Status Overview` : "Room Availability & Status Overview"}
                      />
                    </div>
                  </div>

                  {/* DYNAMIC STAY DURATION & BILLING BREAKDOWN PREVIEW */}
                  {(() => {
                    const nights = calculateReservationNights();
                    const isWithBk = (selectedRoomObj && selectedRoomObj.breakfastRate !== null && selectedRoomObj.breakfastRate !== undefined && parseFloat(selectedRoomObj.breakfastRate) === 0) || breakfastOption === 'with';
                    const activeRate = selectedRoomObj
                      ? (isWithBk
                          ? (parseFloat(selectedRoomObj.rateWithBreakfast) || (selectedRoomObj.breakfastRate !== null && selectedRoomObj.breakfastRate !== undefined ? parseFloat(selectedRoomObj.rate) + parseFloat(selectedRoomObj.breakfastRate) : parseFloat(selectedRoomObj.rate)) || 0)
                          : (parseFloat(selectedRoomObj.rateWithoutBreakfast) || parseFloat(selectedRoomObj.rate) || 0))
                      : 0;
                    const maxPax = selectedRoomObj ? (parseInt(selectedRoomObj.occupancyLimit) || 2) : 2;
                    const guestVal = guestCount === '' ? 1 : (parseInt(guestCount, 10) || 1);
                    const excessPax = Math.max(0, guestVal - maxPax);
                    const extraGuestFee = excessPax * 100; // Flat ₱100 per extra guest
                    const roomStayCharges = activeRate * nights;
                    const estimatedTotal = roomStayCharges + extraGuestFee;

                    return (
                      <>
                        <div className="p-3 bg-primary-subtle border border-primary-subtle rounded-3 mb-3 d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-bold text-primary small d-flex align-items-center gap-1.5">
                              <i className="bi bi-moon-stars-fill"></i>
                              <span>Stay Duration</span>
                            </div>
                            <div className="text-muted small mt-0.5">
                              {toDbDate(resDate) || 'Check-in'} → {toDbDate(checkOutDate) || 'Check-out'}
                            </div>
                          </div>
                          <div className="text-end">
                            <span className="badge bg-primary text-white fs-6 px-3 py-1.5 shadow-xs">
                              {nights} {nights === 1 ? 'Night' : 'Nights'}
                            </span>
                          </div>
                        </div>

                        {selectedRoomObj && (
                          <div className="p-3 bg-light rounded border mb-3" style={{ fontSize: '0.88rem' }}>
                            <h6 className="fw-bold text-dark mb-2 pb-1 border-bottom" style={{ fontSize: '0.90rem' }}>
                              Estimated Billing Breakdown Preview
                            </h6>
                            <div className="d-flex justify-content-between mb-1">
                              <span className="text-muted">
                                Room Stay ({nights} night{nights > 1 ? 's' : ''} @ ₱{activeRate.toFixed(2)}/night):
                              </span>
                              <span className="fw-semibold">₱{roomStayCharges.toFixed(2)}</span>
                            </div>
                            {excessPax > 0 && (
                              <div className="d-flex justify-content-between mb-1 text-primary">
                                <span>Extra Guest Fee ({excessPax} Extra Pax @ ₱100 flat):</span>
                                <span className="fw-semibold">+₱{extraGuestFee.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="d-flex justify-content-between pt-2 border-top fw-bold text-dark" style={{ fontSize: '1.02rem' }}>
                              <span>Estimated Total:</span>
                              <span className="text-primary">₱{estimatedTotal.toFixed(2)}</span>
                            </div>
                            <div className="mt-2 pt-2 border-top text-muted small" style={{ fontSize: '0.75rem' }}>
                              <i className="bi bi-shield-check text-success me-1"></i>
                              <strong>Courtesy Hold:</strong> ₱0.00 due now. Total payable upon booking conversion or check-in.
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Special Requests (Optional)</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows="2"
                      placeholder="Any special requests or guest notes..."
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                  <LoadingButton
                    type="submit"
                    isLoading={isSubmitting}
                    disabled={Boolean(formData.roomID && resDate && checkScheduleConflict(formData.roomID, resDate, checkOutDate, activeModal === 'edit' ? selectedRes?.reservationID : null))}
                    loadingText={activeModal === 'create' ? 'Placing Hold...' : 'Updating Reservation...'}
                    className={`btn ${activeModal === 'create' ? 'btn-warning text-dark' : 'btn-pcc-primary text-white'} fw-bold`}
                  >
                    {activeModal === 'create' ? 'Place Courtesy Hold' : 'Update Reservation'}
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CONVERT MODAL ("Confirm Reservation & Record Booking") */}
      {activeModal === 'convert' && selectedRes && (() => {
        const isWithBk = (selectedRes.breakfastOption || breakfastOption) === 'with';
        const selectedRoom = rooms.find(r => String(r.roomID) === String(selectedRes.roomID));
        const rate = selectedRoom
          ? (isWithBk
            ? (parseFloat(selectedRoom.rateWithBreakfast) || parseFloat(selectedRoom.rate) || 0)
            : (parseFloat(selectedRoom.rateWithoutBreakfast) || (parseFloat(selectedRoom.rate) ? parseFloat(selectedRoom.rate) - 200 : 0)))
          : parseFloat(selectedRes.rate || 0);

        let nights = 0;
        if (convInDate && convOutDate) {
          const inD = new Date(toDbDate(convInDate) + 'T00:00:00');
          const outD = new Date(toDbDate(convOutDate) + 'T00:00:00');
          if (outD > inD) {
            nights = Math.round(Math.abs(outD - inD) / (1000 * 60 * 60 * 24));
          }
        }
        nights = Math.max(1, nights);

        const totalRoomCharge = rate * nights;
        const dpPctNum = parseInt(downPaymentOption) || 30;
        const requiredDownpayment = totalRoomCharge * (dpPctNum / 100);
        const remainingBal = totalRoomCharge - requiredDownpayment;

        return (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content border-0 shadow-lg">
                <div className="modal-header text-white" style={{ background: 'var(--pcc-blue)' }}>
                  <h5 className="modal-title fw-bold">
                    {convertCheckInNow ? 'Confirm Reservation & Book / Check‑In Now' : 'Confirm Reservation & Record Booking'}
                  </h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
                </div>
                <form onSubmit={handleConvertSubmit}>
                  <div className="modal-body" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                    <div className="p-3 mb-3 bg-light rounded border">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <h6 className="fw-bold mb-0 text-dark">
                            Guest: {selectedRes.firstName} {selectedRes.lastName}
                          </h6>
                          <span className="small text-muted">Contact: {selectedRes.contact}</span>
                        </div>
                        <div className="text-end">
                          <span className="badge bg-primary-subtle text-primary border border-primary fs-6 fw-bold">
                            Room {selectedRes.roomNumber} ({selectedRes.roomType})
                          </span>
                          <div className="small text-muted mt-1">
                            Inclusion: <strong>{isWithBk ? 'With Breakfast' : 'Without Breakfast'}</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CHECK-IN SCENARIO SELECTOR */}
                    <div className="mb-3">
                      <label className="form-label fw-bold">Check-In Scenario *</label>
                      <div className="btn-group w-100" role="group">
                        <button
                          type="button"
                          className={`btn ${convertCheckInNow ? 'btn-success text-white fw-bold' : 'btn-outline-secondary'}`}
                          onClick={() => {
                            setConvertCheckInNow(true);
                            const now = new Date();
                            const pad = (n) => String(n).padStart(2, '0');
                            const todayUi = toUiDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
                            setConvInDate(todayUi);
                            setConvInTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);

                            const tomorrow = new Date(now);
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            setConvOutDate(toUiDate(`${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`));
                            setConvOutTime('12:00');
                          }}
                        >
                          Book & Check-In Now (Current System Time)
                        </button>
                        <button
                          type="button"
                          className={`btn ${!convertCheckInNow ? 'btn-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                          onClick={() => {
                            setConvertCheckInNow(false);
                            if (selectedRes) {
                              const inDateOnly = selectedRes.reservationDateTime ? String(selectedRes.reservationDateTime).substring(0, 10) : '';
                              const inTimeOnly = selectedRes.reservationDateTime ? String(selectedRes.reservationDateTime).substring(11, 16) : '14:00';
                              const outDateOnly = selectedRes.checkOutDateTime ? String(selectedRes.checkOutDateTime).substring(0, 10) : '';
                              const outTimeOnly = selectedRes.checkOutDateTime ? String(selectedRes.checkOutDateTime).substring(11, 16) : '12:00';

                              setConvInDate(inDateOnly ? toUiDate(inDateOnly) : todayUiDate);
                              setConvInTime(inTimeOnly);
                              if (outDateOnly) {
                                setConvOutDate(toUiDate(outDateOnly));
                                setConvOutTime(outTimeOnly);
                              } else {
                                setConvOutDate(getTomorrowUiDate());
                                setConvOutTime('12:00');
                              }
                            }
                          }}
                        >
                          Book Now, Check-In Later
                        </button>
                      </div>
                      {convertCheckInNow ? (
                        <div className="alert alert-success py-2 px-3 small mt-2 mb-3 d-flex align-items-center justify-content-between" style={{ fontSize: '0.82rem' }}>
                          <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-box-arrow-in-right fs-5 text-success"></i>
                            <div>
                              <strong>Immediate Check-In:</strong> Check-in timestamp will be recorded as <strong>{convInDate} {convInTime} (Current System Time)</strong>.
                              <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                                Booking status: <span className="badge bg-success">Checked In</span> &bull; Room {selectedRes.roomNumber}: <span className="badge bg-danger">Occupied</span>
                              </div>
                            </div>
                          </div>
                          <span className="badge bg-success-subtle text-success border border-success fw-bold px-2 py-1">ACTIVE NOW</span>
                        </div>
                      ) : (
                        <>
                      {/* SCHEDULED CHECK-IN & CHECK-OUT CALENDARS */}
                      <div className="row g-3 mb-3">
                        <div className="col-md-6">
                          <CalendarDatePicker
                            label="Scheduled Check-In Date *"
                            value={convInDate}
                            onChange={(val) => {
                              setConvInDate(val);
                              if (val) {
                                const inD = new Date(toDbDate(val) + 'T00:00:00');
                                inD.setDate(inD.getDate() + 1);
                                const pad = (n) => String(n).padStart(2, '0');
                                setConvOutDate(toUiDate(`${inD.getFullYear()}-${pad(inD.getMonth() + 1)}-${pad(inD.getDate())}`));
                              }
                            }}
                            minDate={todayDbDate}
                            helperText="Guest check-in date"
                          />
                          <div className="mt-2">
                            <label className="form-label small fw-semibold">Scheduled Check-In Time *</label>
                            <input
                              type="time"
                              className="form-control form-control-sm"
                              value={convInTime}
                              min={isConvToday ? currentTimeStr : undefined}
                              onChange={(e) => setConvInTime(e.target.value)}
                              required
                            />
                            {isConvToday && (
                              <small className="text-muted d-block mt-1" style={{ fontSize: '0.72rem' }}>
                                Earliest selectable time today: {currentTimeStr}
                              </small>
                            )}
                          </div>
                        </div>

                        <div className="col-md-6">
                          <CalendarDatePicker
                            label="Check-Out Date *"
                            value={convOutDate}
                            onChange={(val) => setConvOutDate(val)}
                            minDate={convInDate ? toDbDate(convInDate) : todayDbDate}
                            helperText="Guest departure date"
                          />
                          <div className="mt-2">
                            <label className="form-label small fw-semibold">Check-Out Time *</label>
                            <input type="time" className="form-control form-control-sm" value={convOutTime} onChange={(e) => setConvOutTime(e.target.value)} required />
                          </div>
                        </div>
                      </div>
                      <small className="text-muted d-block mb-3" style={{ fontSize: '0.74rem' }}>
                        Reservations are scheduled for check-in on the selected reservation date (Status: <strong>Pending Check-In</strong>, Room: <strong>Reserved</strong>).
                      </small>
                    </>
                  )}
                </div>

                    {/* REQUIRED DOWN PAYMENT TIER */}
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
                    <div className="p-3 bg-light rounded border mb-3" style={{ fontSize: '0.88rem' }}>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Room Base Rate:</span>
                        <span className="fw-bold text-dark">
                          ₱{rate.toFixed(2)}/night ({isWithBk ? 'With Breakfast' : 'Without Breakfast'})
                        </span>
                      </div>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Stay Duration:</span>
                        <span className="fw-semibold">{nights} Night(s)</span>
                      </div>
                      <div className="d-flex justify-content-between border-top pt-1.5 mb-1 fw-bold text-pcc-blue" style={{ fontSize: '1rem' }}>
                        <span>Net Total Booking Amount:</span>
                        <span>₱{totalRoomCharge.toFixed(2)}</span>
                      </div>
                      <div className="d-flex justify-content-between text-success fw-bold">
                        <span>Required Down Payment ({dpPctNum}% Tier):</span>
                        <span className="fs-6">₱{requiredDownpayment.toFixed(2)}</span>
                      </div>
                      <div className="d-flex justify-content-between text-muted small">
                        <span>Remaining Balance at Check-in:</span>
                        <span>₱{remainingBal.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* PAYMENT METHOD & RECEIVED */}
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
                            if (String(val) === '2') {
                              setDownPayment(requiredDownpayment.toFixed(2));
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
                              Required: ₱{requiredDownpayment.toFixed(2)} ({dpPctNum}% Tier)
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
                      ) : (
                        <div className="col-md-8">
                          {gcashInlineError && (
                            <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-2">
                              <i className="bi bi-exclamation-octagon-fill"></i>
                              <span>{gcashInlineError}</span>
                            </div>
                          )}
                          {!isGcashSettled ? (
                            <div className="alert alert-warning py-1.5 px-2.5 small d-flex align-items-center gap-2 mb-2" style={{ fontSize: '0.78rem' }}>
                              <i className="bi bi-exclamation-triangle-fill text-warning"></i>
                              <span>GCash payment has not been settled yet. Scan QR code or confirm auto-settlement below.</span>
                            </div>
                          ) : (
                            <div className="alert alert-success py-1.5 px-2.5 small d-flex align-items-center gap-2 mb-2 text-success fw-bold" style={{ fontSize: '0.78rem' }}>
                              <i className="bi bi-check-circle-fill"></i>
                              <span>GCash payment verified and settled.</span>
                            </div>
                          )}
                          <DynamicQrPhCode 
                            amount={requiredDownpayment}
                            refNumber={`RES-${selectedRes?.reservationID || 'CONFIRM'}`}
                            paymentStatus={isGcashSettled ? "Settled" : "Pending"}
                            showProceedBtn={false}
                            showCheckStatusBtn={false}
                            showTestPayBtn={true}
                            onSimulateTestPay={(simRef) => {
                              setIsGcashSettled(true);
                              setGcashInlineError('');
                              setSettledPaymentRef(simRef);
                              setDownPayment(requiredDownpayment.toFixed(2));
                              showAlert('success', 'Test Pay Simulation', `Simulated GCash payment verified (${simRef}). Down payment settled.`);
                            }}
                            onCheckStatus={fetchData}
                            onPaymentSuccess={(pData) => {
                              setIsGcashSettled(true);
                              setGcashInlineError('');
                              if (pData?.referenceNumber) setSettledPaymentRef(pData.referenceNumber);
                              setDownPayment(requiredDownpayment.toFixed(2));
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                    <LoadingButton
                      type="submit"
                      isLoading={isSubmitting}
                      loadingText="Processing Booking..."
                      className="btn btn-pcc-primary text-white fw-bold"
                    >
                      {convertCheckInNow ? 'Save Booking & Check-In Now' : 'Save Booking & Record Down Payment'}
                    </LoadingButton>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirmation & Alert dialog */}
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

export default function ReceptionistReservations() {
  return (
    <Suspense fallback={
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted mt-2">Loading reservations...</p>
      </div>
    }>
      <ReservationsClient />
    </Suspense>
  );
}
