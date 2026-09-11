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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'cancel_reason' | 'manage_guests' | null
  const [cancellingBookingID, setCancellingBookingID] = useState(null);
  const [cancelRemarks, setCancelRemarks] = useState('');
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
  const [breakfastOption, setBreakfastOption] = useState('with'); // 'with' | 'without'
  const [availableDiscounts, setAvailableDiscounts] = useState([]);
  const [numGuestsCount, setNumGuestsCount] = useState(1);
  const [roomGuests, setRoomGuests] = useState([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
  const [discountedGuests, setDiscountedGuests] = useState([]);
  const [managingBooking, setManagingBooking] = useState(null);
  const [managingGuests, setManagingGuests] = useState([]);
  const [downPaymentReceipt, setDownPaymentReceipt] = useState(null);

  // Update Booking Modal State
  const [updatingBooking, setUpdatingBooking] = useState(null);
  const [updateNumGuests, setUpdateNumGuests] = useState(1);

  const openUpdateBookingModal = (b) => {
    const currentGuestCount = b.registeredGuests && b.registeredGuests.length > 0 
      ? b.registeredGuests.length 
      : (parseInt(b.guestCount || b.totalGuests) || 1);

    setUpdatingBooking({ ...b, currentGuestCount });
    const inStr = (b.checkInDateTime || '').replace(' ', 'T');
    const outStr = (b.checkOutDateTime || '').replace(' ', 'T');
    const inD = inStr ? new Date(inStr) : new Date();
    const outD = outStr ? new Date(outStr) : new Date();
    const pad = (n) => String(n).padStart(2, '0');

    const inUiDate = toUiDate(`${inD.getFullYear()}-${pad(inD.getMonth() + 1)}-${pad(inD.getDate())}`);
    const outUiDate = toUiDate(`${outD.getFullYear()}-${pad(outD.getMonth() + 1)}-${pad(outD.getDate())}`);
    const inTimeStr = `${pad(inD.getHours())}:${pad(inD.getMinutes())}`;
    const outTimeStr = `${pad(outD.getHours())}:${pad(outD.getMinutes())}`;

    setUpdateCheckInDate(inUiDate);
    setUpdateCheckInTime(inTimeStr);
    setUpdateCheckOutDate(outUiDate);
    setUpdateCheckOutTime(outTimeStr);
    setUpdateNumGuests(currentGuestCount);
    setActiveModal('update_booking');
  };

  const handleUpdateBookingSubmit = async (e) => {
    e.preventDefault();
    if (!updatingBooking) return;

    const newNumGuests = parseInt(updateNumGuests) || 1;
    if (newNumGuests < 1) {
      showAlert('error', 'Validation Error', 'Number of guests must be at least 1.');
      return;
    }

    if (!isValidDate(updateCheckInDate) || !isValidDate(updateCheckOutDate)) {
      showAlert('error', 'Validation Error', 'Please enter valid Check-In and Check-Out dates (MM/DD/YYYY).');
      return;
    }

    const newInD = new Date(toDbDate(updateCheckInDate) + 'T' + updateCheckInTime + ':00');
    const newOutD = new Date(toDbDate(updateCheckOutDate) + 'T' + updateCheckOutTime + ':00');

    const todayFloor = new Date();
    todayFloor.setHours(0, 0, 0, 0);
    const checkInFloor = new Date(toDbDate(updateCheckInDate) + 'T00:00:00');

    if (checkInFloor < todayFloor) {
      showAlert('error', 'Validation Error', 'Reservation or booking has already passed.');
      return;
    }

    if (newOutD <= newInD) {
      showAlert('error', 'Validation Error', 'Check-out time must be later than check-in time.');
      return;
    }

    const origInStr = (updatingBooking.checkInDateTime || '').replace(' ', 'T').substring(0, 16);
    const origOutStr = (updatingBooking.checkOutDateTime || '').replace(' ', 'T').substring(0, 16);
    const newInStr = (toDbDate(updateCheckInDate) + 'T' + updateCheckInTime).substring(0, 16);
    const newOutStr = (toDbDate(updateCheckOutDate) + 'T' + updateCheckOutTime).substring(0, 16);

    const datesChanged = (origInStr !== newInStr) || (origOutStr !== newOutStr);

    const executeUpdate = async () => {
      setIsUpdatingBooking(true);
      try {
        const res = await fetch('/api/receptionist/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_booking',
            bookingID: updatingBooking.bookingID,
            checkInDateTime: toDbDate(updateCheckInDate) + ' ' + updateCheckInTime + ':00',
            checkOutDateTime: toDbDate(updateCheckOutDate) + ' ' + updateCheckOutTime + ':00',
            numGuestsCount: newNumGuests
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update booking');

        showAlert('success', 'Success', data.message || 'Booking updated successfully');
        setActiveModal(null);
        fetchData();
      } catch (err) {
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
      const newInFormatted = `${updateCheckInDate} ${updateCheckInTime}`;
      const newOutFormatted = `${updateCheckOutDate} ${updateCheckOutTime}`;

      const confirmMessage = (
        <div className="text-start">
          <p className="mb-2 text-dark font-medium">Are you sure you want to rebook schedule this booking?</p>
          <div className="p-3 bg-light rounded border text-start small mb-2">
            <div className="text-muted fw-bold mb-2 text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
              Rebooking Audit Schedule Preview:
            </div>
            <div className="d-flex justify-content-between mb-1 pb-1 border-bottom">
              <span className="text-muted">Original Schedule:</span>
              <span className="fw-semibold text-danger">{origInFormatted} → {origOutFormatted}</span>
            </div>
            <div className="d-flex justify-content-between pt-1">
              <span className="text-muted">New Rebooked Schedule:</span>
              <span className="fw-bold text-success">{newInFormatted} → {newOutFormatted}</span>
            </div>
          </div>
        </div>
      );
      showConfirm('Confirm Rebooking', confirmMessage, executeUpdate);
    } else {
      executeUpdate();
    }
  };

  // Auto-fill required down payment in Payment Received textfield
  useEffect(() => {
    if (!formData.roomID) return;
    const selectedRoomObj = rooms.find(r => String(r.roomID) === String(formData.roomID));
    if (!selectedRoomObj) return;

    const rate = parseFloat(selectedRoomObj.rate) || 0;
    const maxOccupancy = parseInt(selectedRoomObj.roomBasePax || selectedRoomObj.occupancyLimit) || 4;

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
    const rawSubtotal = (rate * nights) + extraGuestFee;

    let totalApportionedDiscount = 0;
    if (discountedGuests.length > 0) {
      const sharePerGuest = (rate * nights) / (parseInt(numGuestsCount) || 1);
      discountedGuests.forEach(g => {
        if (g.discountID) {
          const disc = availableDiscounts.find(d => String(d.discountID) === String(g.discountID));
          if (disc) {
            totalApportionedDiscount += sharePerGuest * (parseFloat(disc.percentage) / 100);
          }
        }
      });
    }

    const netTotalAmount = Math.max(0, rawSubtotal - totalApportionedDiscount);
    const dpPctNum = parseInt(downPaymentOption) || 50;
    const reqDp = Math.round(netTotalAmount * (dpPctNum / 100) * 100) / 100;

    if (reqDp >= 0) {
      setDownPayment(reqDp.toFixed(2));
    }
  }, [formData.roomID, checkInDate, checkOutDate, numGuestsCount, downPaymentOption, discountedGuests, rooms, availableDiscounts]);

  const handlePrintDownPaymentReceipt = () => {
    if (!downPaymentReceipt) return;
    const printWindow = window.open('', '_blank', 'width=450,height=700');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Down Payment Sales Invoice - PCC Home Suite Home</title>
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
          <div class="text-center bold" style="font-size: 11px;">BOOKING DOWN PAYMENT SALES INVOICE</div>
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
            <tr><td>Total Booking Charge:</td><td class="text-right">₱${parseFloat(downPaymentReceipt.totalRoomCharge).toFixed(2)}</td></tr>
            <tr><td>Required Down Payment (${downPaymentReceipt.downPaymentPercentage}%):</td><td class="text-right">₱${parseFloat(downPaymentReceipt.requiredDownpayment || downPaymentReceipt.amountPaid).toFixed(2)}</td></tr>
            <tr class="total-row"><td>MONEY RECEIVED:</td><td class="text-right">₱${parseFloat(downPaymentReceipt.cashReceived || downPaymentReceipt.amountPaid).toFixed(2)}</td></tr>
            ${downPaymentReceipt.change > 0 ? `<tr><td>Change Issued:</td><td class="text-right">₱${parseFloat(downPaymentReceipt.change).toFixed(2)}</td></tr>` : ''}
            <tr><td>Remaining Balance:</td><td class="text-right bold">₱${parseFloat(downPaymentReceipt.remainingBalance).toFixed(2)}</td></tr>
          </table>

          <div class="double-divider"></div>

          <div class="footer">
            <p class="bold" style="margin-bottom: 2px;">Thank you for your reservation!</p>
            <p style="margin: 0;">Please present this receipt upon check-in.</p>
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/receptionist/bookings');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch bookings');

      setBookings(data.bookings || []);
      setGuests(data.guests || []);
      setRooms(data.rooms || []);
      setAvailableDiscounts(data.discounts || []);
      setPaymentMethods(data.paymentMethods || []);
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
    
    setIsAutoFilled(false);
    setGuestForm({ firstName: '', lastName: '', contact: '', email: '', gender: 'Male', dateOfBirth: '' });
    setSelectedRoomType('');
    setFormData({ guestID: '', roomID: '', checkInDateTime: '', checkOutDateTime: '', status: 'Pending Check-in' });
    setRoomGuests([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
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
      lastName: b.lastName || rebookGuest?.lastName || '',
      contact: b.contact || rebookGuest?.contact || '',
      email: b.email || rebookGuest?.email || '',
      gender: b.gender || rebookGuest?.gender || 'Male',
      dateOfBirth: b.dateOfBirth ? toUiDate(b.dateOfBirth) : (rebookGuest?.dateOfBirth ? toUiDate(rebookGuest.dateOfBirth) : '')
    });
    setIsAutoFilled(Boolean(b.guestID));
    setSelectedRoomType(b.roomType || '');
    setFormData({ guestID: String(b.guestID), roomID: String(b.roomID), checkInDateTime: '', checkOutDateTime: '', status: 'Pending Check-in' });
    setRoomGuests(b.registeredGuests && b.registeredGuests.length > 0 ? b.registeredGuests.map(g => ({ ...g, discountID: g.discountID || '' })) : [{ fullName: b.firstName + ' ' + b.lastName, age: 30, discountID: '', discountIdNumber: '' }]);
    setDownPayment('');
    setPaymentMethodID('1');
    setIsGcashSettled(false);
    setGcashInlineError('');
    setSettledPaymentRef('');
    setActiveModal('create');
  };

  useEffect(() => {
    if (activeModal !== 'create') {
      setIsAutoFilled(false);
      setGuestForm({ firstName: '', lastName: '', contact: '', email: '', gender: 'Male', dateOfBirth: '' });
      setSelectedRoomType('');
      setFormData({ guestID: '', roomID: '', checkInDateTime: '', checkOutDateTime: '', status: 'Checked In' });
      setRoomGuests([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
      setPaymentMethodID('1');
      setIsGcashSettled(false);
      setGcashInlineError('');
      setSettledPaymentRef('');
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
    if (activeModal === 'create') {
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

  // Auto-calculate downPayment based on selected room, breakfast option, and downpayment percentage tier
  useEffect(() => {
    if (activeModal === 'create' && formData.roomID) {
      const selectedRoom = rooms.find(r => String(r.roomID) === String(formData.roomID));
      const rate = selectedRoom
        ? (breakfastOption === 'with'
            ? (parseFloat(selectedRoom.rateWithBreakfast) || parseFloat(selectedRoom.rate) || 0)
            : (parseFloat(selectedRoom.rateWithoutBreakfast) || (parseFloat(selectedRoom.rate) ? parseFloat(selectedRoom.rate) - 200 : 0)))
        : 0;
      const maxOccupancy = selectedRoom ? (parseInt(selectedRoom.roomBasePax || selectedRoom.occupancyLimit) || 4) : 4;

      let nights = 0;
      if (checkInDate && checkOutDate) {
        const inD = new Date(toDbDate(checkInDate) + 'T00:00:00');
        const outD = new Date(toDbDate(checkOutDate) + 'T00:00:00');
        if (outD > inD) {
          nights = Math.round(Math.abs(outD - inD) / (1000 * 60 * 60 * 24));
        }
      }
      nights = Math.max(1, nights);

      const excessGuestsCount = Math.max(0, roomGuests.length - maxOccupancy);
      const extraGuestFee = excessGuestsCount * 100 * (nights || 1);
      // Down payment applies strictly to room stay charges; extra guest fees are excluded
      const rawRoomStayCharge = rate * (nights || 1);

      let totalApportionedDiscount = 0;
      if (roomGuests.length > 0 && selectedRoom) {
        const sharePerGuest = rawRoomStayCharge / roomGuests.length;
        roomGuests.forEach(g => {
          if (g.discountID) {
            const disc = availableDiscounts.find(d => String(d.discountID) === String(g.discountID));
            if (disc) {
              totalApportionedDiscount += sharePerGuest * (parseFloat(disc.percentage) / 100);
            }
          }
        });
      }

      const netRoomStayCharge = Math.max(0, rawRoomStayCharge - totalApportionedDiscount);
      const dpPctNum = parseInt(downPaymentOption) || 30;
      const requiredDp = netRoomStayCharge * (dpPctNum / 100);
      setDownPayment(requiredDp.toFixed(2));
    }
  }, [
    activeModal,
    formData.roomID,
    breakfastOption,
    checkInDate,
    checkOutDate,
    checkInTime,
    checkOutTime,
    downPaymentOption,
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

    const selectedRoom = rooms.find(r => String(r.roomID) === String(formData.roomID));
    const maxOccupancy = selectedRoom ? (parseInt(selectedRoom.roomBasePax || selectedRoom.occupancyLimit) || 4) : 4;

    const preparedGuests = [];
    const primaryName = `${guestForm.firstName} ${guestForm.lastName}`.trim() || 'Primary Guest';

    for (let i = 0; i < (parseInt(numGuestsCount) || 1); i++) {
      const disc = discountedGuests[i];
      const gName = disc?.guestName?.trim();
      preparedGuests.push({
        fullName: gName || (i === 0 ? (primaryName || 'Primary Guest') : `Guest #${i + 1}`),
        age: 30,
        discountID: disc?.discountID ? parseInt(disc.discountID) : null,
        discountIdNumber: disc?.discountIdNumber || 'N/A'
      });
    }

    const rate = selectedRoom
      ? (breakfastOption === 'with'
          ? (parseFloat(selectedRoom.rateWithBreakfast) || parseFloat(selectedRoom.rate) || 0)
          : (parseFloat(selectedRoom.rateWithoutBreakfast) || (parseFloat(selectedRoom.rate) ? parseFloat(selectedRoom.rate) - 200 : 0)))
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
    // Down payment applies strictly to room stay charges; extra guest fees are excluded!
    const rawRoomStayCharge = rate * nights;

    let totalApportionedDiscount = 0;
    if (numGuestsCount > 0 && selectedRoom && discountedGuests.length > 0) {
      const sharePerGuest = (rate * nights) / numGuestsCount;
      discountedGuests.forEach(g => {
        if (g.discountID) {
          const disc = availableDiscounts.find(d => String(d.discountID) === String(g.discountID));
          if (disc) {
            totalApportionedDiscount += sharePerGuest * (parseFloat(disc.percentage) / 100);
          }
        }
      });
    }

    const netRoomStayCharge = Math.max(0, rawRoomStayCharge - totalApportionedDiscount);
    const dpPctNum = parseInt(downPaymentOption) || 50;
    const requiredDownpayment = Math.round(netRoomStayCharge * (dpPctNum / 100) * 100) / 100;

    const dpAmount = parseFloat(downPayment);
    if (isNaN(dpAmount) || dpAmount <= 0) {
      showAlert('error', 'Validation Error', 'Please enter a valid payment received amount.');
      return;
    }
    if (dpAmount < requiredDownpayment - 0.05) {
      showAlert('error', 'Validation Error', `Payment received (₱${dpAmount.toFixed(2)}) cannot be below the selected ${dpPctNum}% requirement of ₱${requiredDownpayment.toFixed(2)} on room charges.`);
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

    showConfirm('Create Booking', 'Are you sure you want to save this booking and record the down payment?', async () => {
      setIsSubmitting(true);
      try {
        const res = await fetch('/api/receptionist/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            isWalkIn: !formData.guestID,
            guestID: formData.guestID || null,
            firstName: guestForm.firstName,
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
            roomRate: rate,
            roomCharge: netRoomStayCharge,
            breakfastOption,
            netTotalAmount: netRoomStayCharge,
            downPaymentAmount: dpAmount,
            downPaymentPercentage: dpPctNum,
            paymentMethodID: parseInt(paymentMethodID),
            paymentStatus: String(paymentMethodID) === '2' ? 'Settled' : 'Settled',
            isGcashSettled: String(paymentMethodID) === '2' ? isGcashSettled : true,
            referenceNumber: settledPaymentRef || null,
            guests: preparedGuests
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create booking');

        const roomObj = rooms.find(r => String(r.roomID) === String(formData.roomID));
        const guestObj = isWalkIn ? null : guests.find(g => String(g.guestID) === String(formData.guestID));
        const guestName = isWalkIn 
          ? `${walkInForm.firstName} ${walkInForm.lastName}`.trim() 
          : (guestObj ? `${guestObj.firstName} ${guestObj.lastName}` : 'Guest');

        const pmObj = paymentMethods.find(m => String(m.paymentMethodID) === String(paymentMethodID));
        const receiptTotalAmount = parseFloat(data.totalBookingAmount || dpAmount / (dpPctNum / 100) || netTotalAmount || 0);

        setDownPaymentReceipt({
          receiptNo: `DP-${Math.floor(Math.random() * 900000 + 100000)}`,
          bookingID: data.bookingID || 'N/A',
          date: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
          guestName,
          roomNumber: roomObj?.roomNumber || 'N/A',
          roomType: roomObj?.roomType || 'Standard',
          totalRoomCharge: receiptTotalAmount,
          downPaymentPercentage: dpPctNum,
          requiredDownpayment: dpAmount,
          cashReceived: parseFloat(downPayment || dpAmount),
          change: Math.max(0, parseFloat(downPayment || 0) - dpAmount),
          amountPaid: dpAmount,
          remainingBalance: Math.max(0, receiptTotalAmount - dpAmount),
          paymentMethodName: pmObj?.paymentMethod || 'Cash'
        });

        setActiveModal('downpayment_receipt');
        fetchData();
      } catch (err) {
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

        showAlert('success', 'Success', data.message || 'Guest checked in successfully.');
        fetchData();
      } catch (err) {
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

        showAlert('success', 'Success', data.message || 'Guest checked out successfully.');
        fetchData();
      } catch (err) {
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
    if (!cancellingBookingID) return;
    if (!cancelRemarks.trim()) {
      showAlert('error', 'Validation Error', 'Please enter cancellation remarks.');
      return;
    }

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

      showAlert('success', 'Booking Cancelled', data.message || 'Booking cancelled successfully.');
      setActiveModal(null);
      setCancellingBookingObj(null);
      fetchData();
    } catch (err) {
      showAlert('error', 'Error', err.message);
    }
  };

  const handleSaveGuestsSubmit = async (e) => {
    e.preventDefault();
    if (!managingBooking) return;

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
    }
  };

  const filteredBookings = bookings.filter(b => {
    const fullName = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase();
    const contact = (b.contact || '').toLowerCase();
    const roomNum = (b.roomNumber || '').toString().toLowerCase();
    const matchesSearch = fullName.includes(search.toLowerCase()) || contact.includes(search.toLowerCase()) || roomNum.includes(search.toLowerCase());
    const matchesStatus = statusFilter ? b.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const isRoomAvailableForDates = (roomID, inDateStr, outDateStr, isCurrentTime = false) => {
    const room = rooms.find(r => String(r.roomID) === String(roomID));
    if (!room) return false;
    if (isCurrentTime) {
      return room.status === 'Available';
    }
    if (!inDateStr || !outDateStr) {
      return room.status === 'Available';
    }
    const inD = toDbDate(inDateStr);
    const outD = toDbDate(outDateStr);
    if (!inD || !outD) return room.status === 'Available';

    const reqIn = new Date(`${inD}T14:00:00`);
    const reqOut = new Date(`${outD}T12:00:00`);
    if (isNaN(reqIn.getTime()) || isNaN(reqOut.getTime()) || reqOut <= reqIn) return room.status === 'Available';

    const hasOverlap = bookings.some(b => {
      if (String(b.roomID) !== String(roomID)) return false;
      if (['Cancelled', 'Checked Out', 'No Show'].includes(b.status)) return false;
      const bIn = new Date((b.checkInDateTime || '').replace(' ', 'T'));
      const bOut = new Date((b.checkOutDateTime || '').replace(' ', 'T'));
      if (isNaN(bIn.getTime()) || isNaN(bOut.getTime())) return false;
      return bIn < reqOut && bOut > reqIn;
    });

    return !hasOverlap;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Checked In': return 'bg-success text-white';
      case 'Late Checkout': return 'bg-danger text-white';
      case 'Overdue Check-In': return 'bg-warning text-dark';
      case 'No Show': return 'bg-danger text-white';
      case 'Checked Out': return 'bg-secondary text-white';
      case 'Pending Check-in': return 'bg-info text-dark';
      case 'Cancelled': return 'bg-secondary text-white';
      default: return 'bg-primary text-white';
    }
  };

  const selectedRoomObj = rooms.find(r => String(r.roomID) === String(formData.roomID));

  return (
    <div className="container-fluid py-3">
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

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="section-title mb-0">Booking Management</h2>
          <span className="section-eyebrow">Front Desk Reservations & Lodging Operations</span>
        </div>
        <button className="btn btn-pcc-primary text-white shadow-sm fw-bold" onClick={openCreateModal}>
          + New Booking
        </button>
      </div>

      <div className="card shadow-sm border-0 p-3 mb-4 bg-white" style={{ borderRadius: '12px' }}>
        <div className="row g-2">
          <div className="col-md-6">
            <input
              type="text"
              className="form-control"
              placeholder="Search guest name, room number, contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-md-6">
            <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Booking Statuses</option>
              <option value="Pending Check-in">Pending Check-in</option>
              <option value="Overdue Check-In">Overdue Check-In</option>
              <option value="Checked In">Checked In</option>
              <option value="Late Checkout">Late Checkout</option>
              <option value="Checked Out">Checked Out</option>
              <option value="No Show">No Show</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* BOOKINGS TABLE */}
      <div className="card shadow-sm border-0 p-3 bg-white" style={{ borderRadius: '12px' }}>
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="small text-muted mt-2">Loading bookings data...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-4 text-muted">
            <p className="mb-0">No booking records found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle" style={{ fontSize: '0.88rem' }}>
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
                      <span className={`badge ${getStatusBadge(b.status)}`}>{b.status}</span>
                    </td>
                    <td className="text-end">
                      <div className="actions-wrapper d-flex justify-content-end gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-success text-white fw-bold me-1 d-inline-flex align-items-center justify-content-center"
                          data-bs-toggle="tooltip"
                          data-bs-placement="top"
                          title={b.status === 'Checked Out' || b.status === 'Completed' || b.status === 'Cancelled' ? 'Cannot modify checked-out or cancelled stays' : 'Update Booking'}
                          aria-label="Update Booking"
                          disabled={b.status === 'Checked Out' || b.status === 'Completed' || b.status === 'Cancelled'}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            opacity: (b.status === 'Checked Out' || b.status === 'Completed' || b.status === 'Cancelled') ? 0.4 : 1,
                            cursor: (b.status === 'Checked Out' || b.status === 'Completed' || b.status === 'Cancelled') ? 'not-allowed' : 'pointer'
                          }}
                          onClick={() => {
                            if (b.status === 'Checked Out' || b.status === 'Completed' || b.status === 'Cancelled') return;
                            openUpdateBookingModal(b);
                          }}
                        >
                          <i className="fa-solid fa-sync-alt"></i>
                        </button>

                        {(b.status === 'Pending Check-in' || b.status === 'Confirmed' || b.status === 'Pending' || b.status === 'Booked' || b.status === 'Checked In') && (
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
        )}
      </div>

      {/* CREATE MODAL */}
      {activeModal === 'create' && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ background: '#2155B5' }}>
                <h5 className="modal-title fw-bold">New Lodging Booking Workspace</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCreateSubmit}>
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
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold mb-1">First Name *</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          required
                          value={guestForm.firstName}
                          onChange={(e) => setGuestForm(prev => ({ ...prev, firstName: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold mb-1">Last Name *</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          required
                          value={guestForm.lastName}
                          onChange={(e) => setGuestForm(prev => ({ ...prev, lastName: e.target.value }))}
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
                          Email Address <span className="text-muted">(Optional)</span>
                        </label>
                        <input
                          type="email"
                          className="form-control form-control-sm"
                          placeholder="name@example.com"
                          value={guestForm.email}
                          onChange={(e) => setGuestForm(prev => ({ ...prev, email: e.target.value }))}
                        />
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
                        {[...new Set(rooms.map(rm => rm.roomType))].map(type => (
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
                          .filter(rm => rm.roomType === selectedRoomType && isRoomAvailableForDates(rm.roomID, checkInDate, checkOutDate, useCurrentTimeIn))
                          .map(rm => (
                            <option key={rm.roomID} value={String(rm.roomID)}>
                              Room {rm.roomNumber} (Max {rm.occupancyLimit || 2} Pax){rm.status !== 'Available' ? ' • Vacates before stay' : ''}
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
                                : (parseFloat(selectedRoomObj.rateWithoutBreakfast) || (parseFloat(selectedRoomObj.rate) ? parseFloat(selectedRoomObj.rate) - 200 : 0))
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
                  <div className="p-3 mb-3 border rounded bg-white">
                    <div className="row g-2 align-items-center mb-2">
                      <div className="col-md-6">
                        <label className="form-label fw-bold mb-0 small text-dark">Total Number of Guests *</label>
                        <input
                          type="number"
                          className="form-control form-control-sm mt-1"
                          min="1"
                          max={selectedRoomObj ? (selectedRoomObj.occupancyLimit || 2) + 5 : 10}
                          value={numGuestsCount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNumGuestsCount(val === '' ? '' : Math.max(1, parseInt(val) || 1));
                          }}
                          onBlur={() => {
                            if (numGuestsCount === '' || isNaN(numGuestsCount)) setNumGuestsCount(1);
                          }}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        {selectedRoomObj && numGuestsCount > (selectedRoomObj.occupancyLimit || 2) && (
                          <div className="alert alert-warning py-1.5 mb-0 small fw-bold">
                            Excess Guests: {numGuestsCount - selectedRoomObj.occupancyLimit} Additional Guest(s)
                            <div>Fee: ₱{(numGuestsCount - selectedRoomObj.occupancyLimit) * 100}/night applied.</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SPECIAL DISCOUNTS (SENIOR / PWD) */}
                    <div className="pt-2 border-top mt-2">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div>
                          <h6 className="fw-bold text-pcc-primary mb-0 small">Special Discounts (Senior Citizen / PWD)</h6>
                          <span className="small text-muted">Optional: Add details for any guest qualifying for a discount.</span>
                        </div>
                        {discountedGuests.length < (numGuestsCount || 1) && (
                          <button
                            type="button"
                            className="btn btn-sm btn-pcc-primary text-white fw-bold"
                            onClick={() => setDiscountedGuests(prev => [...prev, { guestName: '', discountID: '', discountIdNumber: '' }])}
                          >
                            + Add Discounted Guest
                          </button>
                        )}
                      </div>

                      {discountedGuests.map((g, idx) => (
                        <div key={idx} className="row g-2 align-items-center mb-2 p-2 border rounded bg-light">
                          <div className="col-md-4">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Qualifying Guest Full Name *"
                              value={g.guestName || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDiscountedGuests(prev => prev.map((item, i) => i === idx ? { ...item, guestName: val } : item));
                              }}
                              required
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
                              required
                            >
                              <option value="">Select Discount Type *</option>
                              {availableDiscounts.map(d => (
                                <option key={d.discountID} value={String(d.discountID)}>{d.name} ({d.percentage}%)</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-md-3">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Valid ID No * (OSCA/PWD)"
                              value={g.discountIdNumber}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDiscountedGuests(prev => prev.map((item, i) => i === idx ? { ...item, discountIdNumber: val } : item));
                              }}
                              required
                            />
                          </div>
                          <div className="col-md-1 text-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-danger text-white fw-bold py-1 px-2 w-100"
                              onClick={() => setDiscountedGuests(prev => prev.filter((_, i) => i !== idx))}
                              title="Remove discount"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
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
                          <label className="form-check-label small text-muted user-select-none" htmlFor="recUseCurrentTimeIn" style={{ fontSize: '0.75rem' }}>
                            Current time
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
                    const rate = selectedRoomObj
                      ? (breakfastOption === 'with'
                          ? (parseFloat(selectedRoomObj.rateWithBreakfast) || parseFloat(selectedRoomObj.rate) || 0)
                          : (parseFloat(selectedRoomObj.rateWithoutBreakfast) || (parseFloat(selectedRoomObj.rate) ? parseFloat(selectedRoomObj.rate) - 200 : 0)))
                      : 0;
                    const maxOccupancy = selectedRoomObj ? (parseInt(selectedRoomObj.occupancyLimit) || 2) : 2;

                    let nights = 0;
                    if (checkInDate && checkOutDate) {
                      const inD = new Date(toDbDate(checkInDate) + 'T00:00:00');
                      const outD = new Date(toDbDate(checkOutDate) + 'T00:00:00');
                      if (outD > inD) {
                        nights = Math.round(Math.abs(outD - inD) / (1000 * 60 * 60 * 24));
                      }
                    }
                    nights = Math.max(1, nights);

                    const baseRoomStayCharges = rate * (nights || 1);

                    let totalApportionedDiscount = 0;
                    if (roomGuests.length > 0 && selectedRoomObj) {
                      const sharePerGuest = baseRoomStayCharges / roomGuests.length;
                      roomGuests.forEach(g => {
                        if (g.discountID) {
                          const disc = availableDiscounts.find(d => String(d.discountID) === String(g.discountID));
                          if (disc) {
                            totalApportionedDiscount += sharePerGuest * (parseFloat(disc.percentage) / 100);
                          }
                        }
                      });
                    }

                    const netRoomStayCharge = Math.max(0, baseRoomStayCharges - totalApportionedDiscount);
                    const dpPctNum = parseInt(downPaymentOption) || 30;
                    const requiredDownpayment = netRoomStayCharge * (dpPctNum / 100);
                    const remainingRoomBalance = Math.max(0, netRoomStayCharge - requiredDownpayment);

                    const excessGuestsCount = Math.max(0, roomGuests.length - maxOccupancy);
                    const extraGuestFee = excessGuestsCount * 100 * (nights || 1);

                    return (
                      <>
                        {rate > 0 && (
                          <div className="p-3 bg-light rounded border mb-3" style={{ fontSize: '0.88rem' }}>
                            <div className="d-flex justify-content-between mb-1">
                              <span className="text-muted">Room Base Rate ({breakfastOption === 'with' ? 'With Breakfast' : 'Room Only'}):</span>
                              <span className="fw-bold text-dark">
                                ₱{rate.toFixed(2)}/night
                              </span>
                            </div>
                            <div className="d-flex justify-content-between mb-1">
                              <span className="text-muted">Stay Duration:</span>
                              <span className="fw-semibold">{nights} Night(s)</span>
                            </div>
                            <div className="d-flex justify-content-between mb-1">
                              <span className="text-muted">Room Stay Charges:</span>
                              <span className="fw-semibold">₱{baseRoomStayCharges.toFixed(2)}</span>
                            </div>

                            {totalApportionedDiscount > 0 && (
                              <div className="d-flex justify-content-between mb-1 text-danger">
                                <span>Applied Room Discounts:</span>
                                <span>-₱{totalApportionedDiscount.toFixed(2)}</span>
                              </div>
                            )}

                            <div className="d-flex justify-content-between border-top pt-1.5 mb-1 fw-bold text-pcc-blue" style={{ fontSize: '0.95rem' }}>
                              <span>Net Room Stay Charge:</span>
                              <span>₱{netRoomStayCharge.toFixed(2)}</span>
                            </div>

                            <div className="d-flex justify-content-between text-success fw-bold">
                              <span>Required Down Payment ({dpPctNum}% of Room Charges):</span>
                              <span className="fs-6">₱{requiredDownpayment.toFixed(2)}</span>
                            </div>

                            <div className="d-flex justify-content-between text-muted small mb-2">
                              <span>Remaining Room Balance:</span>
                              <span className="fw-semibold">₱{remainingRoomBalance.toFixed(2)}</span>
                            </div>

                            {excessGuestsCount > 0 && (
                              <div className="d-flex justify-content-between pt-1 border-top align-items-center">
                                <span className="text-muted small">
                                  Additional Guest Fee ({excessGuestsCount} Extra Pax × {nights} Night{nights > 1 ? 's' : ''}):
                                  <span className="badge bg-secondary-subtle text-secondary ms-2">Final Billing Only</span>
                                </span>
                                <span className="fw-bold text-secondary small">+₱{extraGuestFee.toFixed(2)}</span>
                              </div>
                            )}

                            {earlyFee > 0 && (
                              <div className="d-flex justify-content-between pt-1 border-top align-items-center text-warning-emphasis">
                                <span className="small fw-semibold">
                                  Early Check-In Fee ({earlyHours} hr{earlyHours > 1 ? 's' : ''} @ ₱50/hr):
                                  <span className="badge bg-warning-subtle text-warning-emphasis ms-2">Incidental Charge</span>
                                </span>
                                <span className="fw-bold small">+₱{earlyFee.toFixed(2)}</span>
                              </div>
                            )}

                            {lateFee > 0 && (
                              <div className="d-flex justify-content-between pt-1 border-top align-items-center text-danger">
                                <span className="small fw-semibold">
                                  Late Check-Out Fee ({lateHours} hr{lateHours > 1 ? 's' : ''} @ ₱100/hr):
                                  <span className="badge bg-danger-subtle text-danger ms-2">Final Billing</span>
                                </span>
                                <span className="fw-bold small">+₱{lateFee.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        )}

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
                          ) : (
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
                                refNumber={`BOOK-${selectedRoomObj?.roomNumber || formData.roomID || 'WALK'}`}
                                paymentStatus={isGcashSettled ? 'Settled' : 'Pending'}
                                showProceedBtn={false}
                                showCheckStatusBtn={false}
                                showTestPayBtn={true}
                                onSimulateTestPay={(simRef) => {
                                  setIsGcashSettled(true);
                                  setSettledPaymentRef(simRef || `SIM-${Date.now()}`);
                                  setGcashInlineError('');
                                  setDownPayment(requiredDownpayment.toFixed(2));
                                  showAlert('success', 'Test Pay Simulation', `Simulated GCash payment verified (${simRef}). Down payment amount auto-filled.`);
                                }}
                                onCheckStatus={() => {}}
                                onPaymentSuccess={(pData) => {
                                  setIsGcashSettled(true);
                                  setSettledPaymentRef(pData?.referenceNumber || pData?.paymentIntentId || `PAY-${Date.now()}`);
                                  setGcashInlineError('');
                                  setDownPayment(requiredDownpayment.toFixed(2));
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                  <LoadingButton
                    type="submit"
                    isLoading={isSubmitting}
                    loadingText="Saving Booking..."
                    className="btn btn-pcc-primary text-white fw-bold"
                  >
                    Save Booking & Record Down Payment
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DOWN PAYMENT RECEIPT MODAL */}
      {activeModal === 'downpayment_receipt' && downPaymentReceipt && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
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
      )}

      {/* MANAGE ROOM GUESTS MODAL */}
      {activeModal === 'manage_guests' && managingBooking && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
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
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-pcc-primary text-white fw-bold">Save Registered Guests</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* CANCEL BOOKING REASON MODAL */}
      {activeModal === 'cancel_reason' && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
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
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>
                    Dismiss
                  </button>
                  <button type="submit" className="btn btn-danger text-white fw-bold">
                    Confirm Cancellation
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE BOOKING MODAL */}
      {activeModal === 'update_booking' && updatingBooking && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header text-white" style={{ background: '#2155B5' }}>
                <h5 className="modal-title fw-bold d-flex align-items-center">
                  <i className="fa-solid fa-edit me-2"></i>Update Booking #{`BK${String(updatingBooking.bookingID).padStart(5, '0')}`}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleUpdateBookingSubmit}>
                <div className="modal-body p-4">
                  <div className="p-3 bg-light rounded border mb-3 small">
                    <div className="row g-2">
                      <div className="col-6">
                        <span className="text-muted d-block">Primary Guest:</span>
                        <span className="fw-bold text-dark">{updatingBooking.firstName} {updatingBooking.lastName}</span>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block">Room Number:</span>
                        <span className="fw-bold text-dark">{updatingBooking.roomNumber || 'Room N/A'} ({updatingBooking.roomType || 'Standard'})</span>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block">Room Capacity:</span>
                        <span className="fw-bold text-dark">{updatingBooking.occupancyLimit || 4} Pax</span>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block">Current Booking Guests:</span>
                        <span className="fw-bold text-primary">{updatingBooking.currentGuestCount || updateNumGuests || 1} Pax</span>
                      </div>
                      <div className="col-12 mt-1 pt-1 border-top d-flex justify-content-between align-items-center">
                        <span className="text-muted small">Current Booking Status:</span>
                        <span className="badge bg-primary">{updatingBooking.status}</span>
                      </div>
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <CalendarDatePicker
                        label="Check-In Date *"
                        value={updateCheckInDate}
                        onChange={(val) => setUpdateCheckInDate(val)}
                        minDate={todayDbDate}
                        helperText="Select new arrival date"
                      />
                      <div className="mt-2">
                        <label className="form-label small fw-semibold">Check-In Time *</label>
                        <input
                          type="time"
                          className={`form-control form-control-sm ${updateUseCurrentTimeIn ? 'bg-light text-muted' : ''}`}
                          required
                          value={updateCheckInTime}
                          min={isUpdateToday && !updateUseCurrentTimeIn ? currentTimeStr : undefined}
                          disabled={Boolean(updateUseCurrentTimeIn)}
                          onChange={(e) => setUpdateCheckInTime(e.target.value)}
                        />
                        <div className="form-check mt-1">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="updUseCurrentTimeIn"
                            checked={Boolean(updateUseCurrentTimeIn)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setUpdateUseCurrentTimeIn(checked);
                              if (checked) {
                                const now = new Date();
                                const pad = (n) => String(n).padStart(2, '0');
                                setUpdateCheckInDate(toUiDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`));
                                setUpdateCheckInTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
                              } else {
                                setUpdateCheckInTime('14:00');
                              }
                            }}
                          />
                          <label className="form-check-label small text-muted user-select-none" htmlFor="updUseCurrentTimeIn" style={{ fontSize: '0.75rem' }}>
                            Current time
                          </label>
                          <div className="form-text text-muted small mt-0.5" style={{ fontSize: '0.73rem' }}>
                            <i className="bi bi-info-circle me-1"></i>
                            Checked In immediately when selected; defaults to 2:00 PM when unselected.
                          </div>
                        </div>
                        {isUpdateToday && !updateUseCurrentTimeIn && (
                          <small className="text-muted d-block mt-1" style={{ fontSize: '0.72rem' }}>
                            Earliest selectable time today: {currentTimeStr}
                          </small>
                        )}
                      </div>
                    </div>

                    <div className="col-md-6">
                      <CalendarDatePicker
                        label="Check-Out Date *"
                        value={updateCheckOutDate}
                        onChange={(val) => setUpdateCheckOutDate(val)}
                        minDate={updateCheckInDate ? toDbDate(updateCheckInDate) : todayDbDate}
                        helperText="Select new departure date"
                      />
                      <div className="mt-2">
                        <label className="form-label small fw-semibold">Check-Out Time *</label>
                        <input
                          type="time"
                          className="form-control form-control-sm"
                          required
                          value={updateCheckOutTime}
                          onChange={(e) => setUpdateCheckOutTime(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* DYNAMIC STAY DURATION & NIGHTS SUMMARY BADGE */}
                  <div className="p-3 bg-primary-subtle border border-primary-subtle rounded-3 mb-3 d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-bold text-primary small d-flex align-items-center gap-1">
                        <i className="fa-solid fa-moon me-1"></i>
                        <span>New Stay Duration</span>
                      </div>
                      <div className="text-muted small mt-1">
                        {toDbDate(updateCheckInDate) || 'Check-in'} → {toDbDate(updateCheckOutDate) || 'Check-out'}
                      </div>
                    </div>
                    <div className="text-end">
                      <span className="badge bg-primary text-white fs-6 px-3 py-1 shadow-xs">
                        {calculateBookingNights(updateCheckInDate, updateCheckOutDate)} {calculateBookingNights(updateCheckInDate, updateCheckOutDate) === 1 ? 'Night' : 'Nights'}
                      </span>
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Number of Guests *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control form-control-sm fw-bold"
                      required
                      value={updateNumGuests}
                      onChange={(e) => setUpdateNumGuests(e.target.value)}
                    />
                    <small className="text-muted d-block mt-1" style={{ fontSize: '0.74rem' }}>
                      Extra guests beyond room capacity add ₱100/night per extra guest to incidental billing.
                    </small>
                  </div>
                </div>

                <div className="modal-footer bg-light px-4 py-3 d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary btn-sm fw-bold text-white" onClick={() => setActiveModal(null)}>
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    isLoading={isUpdatingBooking}
                    loadingText="Saving Changes..."
                    className="btn btn-success btn-sm text-white fw-bold"
                  >
                    <i className="fa-solid fa-check me-1"></i>Save Changes
                  </LoadingButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReceptionistBookingsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center">Loading bookings...</div>}>
      <BookingsClient />
    </Suspense>
  );
}
