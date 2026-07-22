'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ModalDialog from '../../components/ModalDialog';
import DateInput, { isValidDate, toDbDate, toUiDate } from '../../components/DateInput';
import SearchableSelect from '../../components/SearchableSelect';

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

function BookingsClient() {
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'cancel_reason' | 'manage_guests' | null
  const [cancellingBookingID, setCancellingBookingID] = useState(null);
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [minDateTime, setMinDateTime] = useState('');

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

  // Check-in Scenario & Downpayment Tiers
  const [checkInScenario, setCheckInScenario] = useState('now'); // 'now' | 'later'
  const [downPaymentOption, setDownPaymentOption] = useState('25'); // '25' | '50' | '100'

  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('12:00');

  const [isWalkIn, setIsWalkIn] = useState(false);
  const [walkInForm, setWalkInForm] = useState({
    firstName: '',
    lastName: '',
    contact: '',
    email: '',
    gender: 'Male',
    dateOfBirth: ''
  });

  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [breakfastOption, setBreakfastOption] = useState('with'); // 'with' | 'without'
  const [availableDiscounts, setAvailableDiscounts] = useState([]);
  const [roomGuests, setRoomGuests] = useState([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
  const [managingBooking, setManagingBooking] = useState(null);
  const [managingGuests, setManagingGuests] = useState([]);
  const [downPaymentReceipt, setDownPaymentReceipt] = useState(null);

  const handlePrintDownPaymentReceipt = () => {
    if (!downPaymentReceipt) return;
    const printWindow = window.open('', '_blank', 'width=450,height=700');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Down Payment Receipt - PCC Home Suite Home</title>
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
          <div class="text-center bold" style="font-size: 11px;">BOOKING DOWN PAYMENT RECEIPT</div>
          <div class="divider"></div>

          <table class="info-table">
            <tr><td>Date/Time:</td><td class="text-right">${downPaymentReceipt.date}</td></tr>
            <tr><td>Receipt No:</td><td class="text-right">#${downPaymentReceipt.receiptNo}</td></tr>
            <tr><td>Booking Ref:</td><td class="text-right">#${downPaymentReceipt.bookingID}</td></tr>
            <tr><td>Payment Method:</td><td class="text-right">${downPaymentReceipt.paymentMethodName}</td></tr>
            <tr><td>Guest Name:</td><td class="text-right bold">${downPaymentReceipt.guestName}</td></tr>
            <tr><td>Room:</td><td class="text-right">Room ${downPaymentReceipt.roomNumber} (${downPaymentReceipt.roomType})</td></tr>
          </table>

          <div class="divider"></div>

          <table class="info-table">
            <tr><td>Total Booking Charge:</td><td class="text-right">₱${parseFloat(downPaymentReceipt.totalRoomCharge).toFixed(2)}</td></tr>
            <tr><td>Down Payment Tier:</td><td class="text-right">${downPaymentReceipt.downPaymentPercentage}%</td></tr>
            <tr class="total-row"><td>DOWN PAYMENT PAID:</td><td class="text-right">₱${parseFloat(downPaymentReceipt.amountPaid).toFixed(2)}</td></tr>
            <tr><td>Remaining Balance:</td><td class="text-right">₱${parseFloat(downPaymentReceipt.remainingBalance).toFixed(2)}</td></tr>
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
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        onConfirmCallback();
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
    setCheckInScenario('now');
    setDownPaymentOption('25');
    setCheckInDate(todayUiDate);
    setCheckInTime(currentTimeStr);
    setCheckOutDate(tomorrowUiDate);
    setCheckOutTime('12:00');
    
    setIsWalkIn(false);
    setWalkInForm({ firstName: '', lastName: '', contact: '', email: '', gender: 'Male', dateOfBirth: '' });
    setSelectedRoomType('');
    setFormData({ guestID: '', roomID: '', checkInDateTime: '', checkOutDateTime: '', status: 'Checked In' });
    setRoomGuests([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
    setDownPayment('');
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
    setCheckInScenario('now');
    setDownPaymentOption('25');
    setCheckInDate(todayUiDate);
    setCheckInTime(currentTimeStr);
    setCheckOutDate(tomorrowUiDate);
    setCheckOutTime('12:00');

    setIsWalkIn(false);
    setWalkInForm({ firstName: '', lastName: '', contact: '', email: '', gender: 'Male', dateOfBirth: '' });
    setSelectedRoomType(b.roomType || '');
    setFormData({ guestID: String(b.guestID), roomID: String(b.roomID), checkInDateTime: '', checkOutDateTime: '', status: 'Checked In' });
    setRoomGuests(b.registeredGuests && b.registeredGuests.length > 0 ? b.registeredGuests.map(g => ({ ...g, discountID: g.discountID || '' })) : [{ fullName: b.firstName + ' ' + b.lastName, age: 30, discountID: '', discountIdNumber: '' }]);
    setDownPayment('');
    setActiveModal('create');
  };

  useEffect(() => {
    if (activeModal !== 'create') {
      setIsWalkIn(false);
      setWalkInForm({ firstName: '', lastName: '', contact: '', email: '', gender: 'Male', dateOfBirth: '' });
      setSelectedRoomType('');
      setFormData({ guestID: '', roomID: '', checkInDateTime: '', checkOutDateTime: '', status: 'Checked In' });
      setRoomGuests([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
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
      let name = '';
      let calculatedAge = '';
      if (isWalkIn) {
        name = `${walkInForm.firstName} ${walkInForm.lastName}`.trim();
        if (walkInForm.dateOfBirth) {
          calculatedAge = calculateAgeFromUiDate(walkInForm.dateOfBirth);
        }
      } else if (formData.guestID) {
        const selected = guests.find(g => g.guestID === parseInt(formData.guestID));
        if (selected) {
          name = `${selected.firstName} ${selected.lastName}`;
          if (selected.dateOfBirth) {
            calculatedAge = calculateAgeFromDbDate(selected.dateOfBirth);
          }
        }
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
  }, [isWalkIn, walkInForm.firstName, walkInForm.lastName, walkInForm.dateOfBirth, formData.guestID, guests, activeModal]);

  // Auto-calculate downPayment based on selected room, breakfast option, and downpayment percentage tier
  useEffect(() => {
    if (activeModal === 'create' && formData.roomID) {
      const selectedRoom = rooms.find(r => String(r.roomID) === String(formData.roomID));
      const rate = selectedRoom
        ? (breakfastOption === 'with'
            ? (parseFloat(selectedRoom.rateWithBreakfast) || parseFloat(selectedRoom.rate) || 0)
            : (parseFloat(selectedRoom.rateWithoutBreakfast) || (parseFloat(selectedRoom.rate) ? parseFloat(selectedRoom.rate) - 200 : 0)))
        : 0;
      const maxOccupancy = selectedRoom ? (parseInt(selectedRoom.occupancyLimit) || 2) : 2;

      let nights = 0;
      if (checkInDate && checkOutDate && checkInTime && checkOutTime) {
        const inStr = toDbDate(checkInDate) + 'T' + checkInTime;
        const outStr = toDbDate(checkOutDate) + 'T' + checkOutTime;
        const inD = new Date(inStr);
        const outD = new Date(outStr);
        if (outD > inD) {
          const diff = Math.abs(outD - inD);
          nights = Math.ceil(diff / (1000 * 60 * 60 * 24));
        }
      }

      const excessGuestsCount = Math.max(0, roomGuests.length - maxOccupancy);
      const extraGuestFee = excessGuestsCount * 200 * (nights || 1);
      const rawSubtotal = (rate * (nights || 1)) + extraGuestFee;

      let totalApportionedDiscount = 0;
      if (roomGuests.length > 0 && selectedRoom) {
        const sharePerGuest = (rate * (nights || 1)) / roomGuests.length;
        roomGuests.forEach(g => {
          if (g.discountID) {
            const disc = availableDiscounts.find(d => String(d.discountID) === String(g.discountID));
            if (disc) {
              totalApportionedDiscount += sharePerGuest * (parseFloat(disc.percentage) / 100);
            }
          }
        });
      }

      const netTotalAmount = Math.max(0, rawSubtotal - totalApportionedDiscount);
      const dpPctNum = parseInt(downPaymentOption) || 25;
      const requiredDp = netTotalAmount * (dpPctNum / 100);
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
    if (!isWalkIn && !formData.guestID) {
      showAlert('error', 'Validation Error', 'Please select a guest or choose Walk-In.');
      return;
    }
    if (!formData.roomID) {
      showAlert('error', 'Validation Error', 'Please select a room.');
      return;
    }
    if (!isValidDate(checkInDate) || !isValidDate(checkOutDate)) {
      showAlert('error', 'Validation Error', 'Please enter valid Check-In and Check-Out dates (MM/DD/YYYY).');
      return;
    }

    const selectedRoom = rooms.find(r => r.roomID === parseInt(formData.roomID));
    const maxOccupancy = selectedRoom ? (parseInt(selectedRoom.occupancyLimit) || 2) : 2;

    for (const g of roomGuests) {
      if (!g.fullName.trim()) {
        showAlert('error', 'Validation Error', 'All registered room guests must have a full name.');
        return;
      }
      const ageNum = parseInt(g.age);
      if (isNaN(ageNum) || ageNum <= 0) {
        showAlert('error', 'Validation Error', `Please enter a valid age for guest ${g.fullName}.`);
        return;
      }
      if (g.discountID) {
        if (!g.discountIdNumber || !g.discountIdNumber.trim()) {
          showAlert('error', 'Validation Error', `Discount ID number is required for ${g.fullName}.`);
          return;
        }
      }
    }

    const rate = selectedRoom ? parseFloat(selectedRoom.rate || 0) : 0;
    let nights = 0;
    if (checkInDate && checkOutDate && checkInTime && checkOutTime) {
      const inStr = toDbDate(checkInDate) + 'T' + checkInTime;
      const outStr = toDbDate(checkOutDate) + 'T' + checkOutTime;
      const inD = new Date(inStr);
      const outD = new Date(outStr);
      if (outD > inD) {
        const diff = Math.abs(outD - inD);
        nights = Math.ceil(diff / (1000 * 60 * 60 * 24));
      }
    }

    const excessGuestsCount = Math.max(0, roomGuests.length - maxOccupancy);
    const extraGuestFee = excessGuestsCount * 200 * (nights || 1);
    const rawSubtotal = (rate * nights) + extraGuestFee;

    let totalApportionedDiscount = 0;
    if (roomGuests.length > 0 && selectedRoom) {
      const sharePerGuest = (rate * nights) / roomGuests.length;
      roomGuests.forEach(g => {
        if (g.discountID) {
          const disc = availableDiscounts.find(d => String(d.discountID) === String(g.discountID));
          if (disc) {
            totalApportionedDiscount += sharePerGuest * (parseFloat(disc.percentage) / 100);
          }
        }
      });
    }

    const netTotalAmount = Math.max(0, rawSubtotal - totalApportionedDiscount);
    const dpPctNum = parseInt(downPaymentOption);
    const requiredDownpayment = netTotalAmount * (dpPctNum / 100);

    const dpAmount = parseFloat(downPayment);
    if (isNaN(dpAmount) || dpAmount <= 0) {
      showAlert('error', 'Validation Error', 'Please enter a valid down payment amount.');
      return;
    }
    if (dpAmount < requiredDownpayment - 0.01) {
      showAlert('error', 'Validation Error', `Received down payment (₱${dpAmount.toFixed(2)}) cannot be below the selected ${dpPctNum}% requirement of ₱${requiredDownpayment.toFixed(2)}.`);
      return;
    }

    // Format Check-in timestamp cleanly based on Scenario 1 vs Scenario 2
    let finalCheckInDateTime = toDbDate(checkInDate) + ' ' + checkInTime + ':00';
    if (checkInScenario === 'now') {
      const localNow = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      finalCheckInDateTime = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;
    }

    showConfirm('Create Booking', 'Are you sure you want to create this booking?', async () => {
      try {
        const res = await fetch('/api/receptionist/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            isWalkIn,
            ...(isWalkIn ? { ...walkInForm, dateOfBirth: walkInForm.dateOfBirth ? toDbDate(walkInForm.dateOfBirth) : null } : { guestID: formData.guestID }),
            roomID: formData.roomID,
            checkInDateTime: finalCheckInDateTime,
            checkOutDateTime: toDbDate(checkOutDate) + ' ' + checkOutTime + ':00',
            status: checkInScenario === 'now' ? 'Checked In' : 'Pending Check-in',
            downPaymentAmount: dpAmount,
            downPaymentPercentage: dpPctNum,
            paymentMethodID: parseInt(paymentMethodID),
            guests: roomGuests.map(g => ({
              fullName: g.fullName,
              age: parseInt(g.age),
              discountID: g.discountID ? parseInt(g.discountID) : null,
              discountIdNumber: g.discountIdNumber || null
            }))
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create booking');

        const selectedRoom = rooms.find(r => r.roomID === parseInt(formData.roomID));
        const guestObj = isWalkIn ? null : guests.find(g => g.guestID === parseInt(formData.guestID));
        const guestName = isWalkIn 
          ? `${walkInForm.firstName} ${walkInForm.lastName}`.trim() 
          : (guestObj ? `${guestObj.firstName} ${guestObj.lastName}` : 'Guest');

        const pmObj = paymentMethods.find(m => String(m.paymentMethodID) === String(paymentMethodID));
        const netTotalAmount = parseFloat(data.totalBookingAmount || dpAmount / (dpPctNum / 100) || 0);

        setDownPaymentReceipt({
          receiptNo: `DP-${Math.floor(Math.random() * 900000 + 100000)}`,
          bookingID: data.bookingID || 'N/A',
          date: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
          guestName,
          roomNumber: selectedRoom?.roomNumber || 'N/A',
          roomType: selectedRoom?.roomType || 'Standard',
          totalRoomCharge: netTotalAmount,
          downPaymentPercentage: dpPctNum,
          amountPaid: dpAmount,
          remainingBalance: Math.max(0, netTotalAmount - dpAmount),
          paymentMethodName: pmObj?.paymentMethod || 'Cash'
        });

        setActiveModal('downpayment_receipt');
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };



  const handleCheckIn = (id) => {
    showConfirm('Process Check-In', 'Check in this guest now?', async () => {
      try {
        const res = await fetch('/api/receptionist/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'checkin',
            bookingID: id
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to check in');

        showAlert('success', 'Success', 'Guest checked in successfully.');
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleCheckOut = (id) => {
    showConfirm('Process Check-Out', 'Check out this guest now and free up the room?', async () => {
      try {
        const res = await fetch('/api/receptionist/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'checkout',
            bookingID: id
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to check out');

        showAlert('success', 'Success', 'Guest checked out successfully.');
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const openCancelModal = (id) => {
    setCancellingBookingID(id);
    setCancelRemarks('');
    setActiveModal('cancel_reason');
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Checked In': return 'bg-success';
      case 'Checked Out': return 'bg-secondary';
      case 'Pending Check-in': return 'bg-warning text-dark';
      case 'Cancelled': return 'bg-danger';
      default: return 'bg-primary';
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
              <option value="Checked In">Checked In</option>
              <option value="Checked Out">Checked Out</option>
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
                      <span className="fw-bold text-pcc-blue">Room {b.roomNumber}</span>
                      <br />
                      <small className="text-muted">{b.roomType}</small>
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
                          className="action-btn action-btn-edit"
                          data-bs-toggle="tooltip"
                          data-bs-placement="top"
                          title="Manage Room Guests"
                          aria-label="Manage Room Guests"
                          onClick={() => {
                            setManagingBooking(b);
                            setManagingGuests(b.registeredGuests && b.registeredGuests.length > 0 ? b.registeredGuests.map(rg => ({ ...rg, discountID: rg.discountID || '' })) : [{ fullName: b.firstName + ' ' + b.lastName, age: 30, discountID: '', discountIdNumber: '' }]);
                            setActiveModal('manage_guests');
                          }}
                        >
                          <i className="fa-solid fa-users"></i>
                        </button>

                        {(b.status === 'Pending Check-in' || b.status === 'Confirmed' || b.status === 'Checked In') && (
                          <button
                            type="button"
                            className="action-btn action-btn-delete"
                            data-bs-toggle="tooltip"
                            data-bs-placement="top"
                            title="Cancel Booking"
                            aria-label="Cancel Booking"
                            onClick={() => openCancelModal(b.bookingID)}
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
                  <div className="form-check form-switch mb-3 p-2 bg-light rounded border">
                    <input
                      className="form-check-input ms-0 me-2"
                      type="checkbox"
                      id="walkInToggle"
                      checked={isWalkIn}
                      onChange={(e) => setIsWalkIn(e.target.checked)}
                    />
                    <label className="form-check-label fw-bold text-dark" htmlFor="walkInToggle">
                      Walk-In Guest (Quick Booking Without Registered Account)
                    </label>
                  </div>

                  {!isWalkIn ? (
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Select Guest Account *</label>
                      <SearchableSelect
                        options={guests.map(g => ({
                          value: String(g.guestID),
                          label: `${g.lastName}, ${g.firstName} (${g.contact || 'No Phone'})`
                        }))}
                        value={formData.guestID}
                        onChange={(val) => setFormData(prev => ({ ...prev, guestID: val }))}
                        placeholder="Type guest name or contact..."
                        disabled={isWalkIn}
                      />
                    </div>
                  ) : (
                    <div className="p-3 mb-3 border rounded bg-light">
                      <h6 className="mb-3 text-pcc-primary fw-bold">Walk-In Guest Information</h6>
                      <div className="row g-2">
                        <div className="col-md-6 mb-2">
                          <label className="form-label small mb-1">First Name *</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            required={isWalkIn}
                            value={walkInForm.firstName}
                            onChange={(e) => setWalkInForm(prev => ({ ...prev, firstName: e.target.value }))}
                          />
                        </div>
                        <div className="col-md-6 mb-2">
                          <label className="form-label small mb-1">Last Name *</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            required={isWalkIn}
                            value={walkInForm.lastName}
                            onChange={(e) => setWalkInForm(prev => ({ ...prev, lastName: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="row g-2">
                        <div className="col-md-4 mb-2">
                          <label className="form-label small mb-1">Contact Number</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="09XXXXXXXXX"
                            value={walkInForm.contact}
                            onChange={(e) => {
                              const sanitized = e.target.value.replace(/[^0-9]/g, "").slice(0, 11);
                              setWalkInForm(prev => ({ ...prev, contact: sanitized }));
                            }}
                          />
                        </div>
                        <div className="col-md-4 mb-2">
                          <label className="form-label small mb-1">Birthdate (Calendar) *</label>
                          <DateInput
                            value={walkInForm.dateOfBirth}
                            onChange={(e) => setWalkInForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                          />
                        </div>
                        <div className="col-md-4 mb-2">
                          <label className="form-label small mb-1">Email Address <span className="text-muted">(Optional)</span></label>
                          <input
                            type="email"
                            className="form-control form-control-sm"
                            placeholder="Optional email"
                            value={walkInForm.email}
                            onChange={(e) => setWalkInForm(prev => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}

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
                          .filter(rm => rm.roomType === selectedRoomType && rm.status === 'Available')
                          .map(rm => (
                            <option key={rm.roomID} value={String(rm.roomID)}>
                              Room {rm.roomNumber} (Max {rm.occupancyLimit || 2} Pax)
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
                        <option value="with">☕ With Breakfast</option>
                        <option value="without">🚫 Without Breakfast</option>
                      </select>
                    </div>
                  </div>

                  {/* ROOM OCCUPANCY & PRICE DISPLAY */}
                  {selectedRoomObj && (
                    <div className="p-3 mb-3 border rounded bg-light d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className="fs-5">🏷️</span>
                        <div>
                          <div className="fw-bold text-dark" style={{ fontSize: '0.92rem' }}>
                            Room Base Price: <span className="text-pcc-blue fw-bold fs-6">₱{(
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

                  {/* REQUIREMENT 2: REGISTERED GUESTS & EXTRA GUEST DETECTION */}
                  <div className="p-3 mb-3 border rounded bg-white">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <h6 className="mb-0 text-pcc-primary fw-bold">Registered Room Guests ({roomGuests.length} Pax)</h6>
                        <span className="small text-muted">Add all guests staying in this room.</span>
                      </div>
                      <button type="button" className="btn btn-sm btn-outline-primary fw-bold" onClick={handleAddGuest}>
                        + Add Guest
                      </button>
                    </div>

                    {selectedRoomObj && roomGuests.length > selectedRoomObj.occupancyLimit && (
                      <div className="alert alert-warning py-2 mb-2 small fw-bold">
                        ⚠️ Excess Guests Detected: {roomGuests.length - selectedRoomObj.occupancyLimit} Additional Guest(s)
                        <div className="fw-semibold text-dark">Additional Guest Fee: ₱{(roomGuests.length - selectedRoomObj.occupancyLimit) * 200}/night applied automatically.</div>
                      </div>
                    )}

                    {roomGuests.map((g, idx) => (
                      <div key={idx} className="p-2.5 mb-2 rounded bg-light border position-relative">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="small text-muted fw-bold">Guest #{idx + 1} {idx === 0 && "(Primary)"}</span>
                          <div className="d-flex align-items-center gap-2">
                            {g.age !== '' && g.age !== null && (
                              <span className={`badge ${parseInt(g.age) >= 60 ? 'bg-success' : 'bg-primary-subtle text-primary'}`} style={{ fontSize: '0.72rem' }}>
                                🎂 Age: {g.age} yrs {parseInt(g.age) >= 60 ? '— Senior Citizen Eligible' : ''}
                              </span>
                            )}
                            {idx > 0 && (
                              <button type="button" className="btn-close" style={{ fontSize: '0.75rem' }} onClick={() => handleRemoveGuest(idx)}></button>
                            )}
                          </div>
                        </div>
                        <div className="row g-2">
                          <div className="col-md-4">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Full Name *"
                              required
                              value={g.fullName}
                              onChange={(e) => handleGuestChange(idx, 'fullName', e.target.value)}
                            />
                          </div>
                          <div className="col-md-4">
                            <div className="input-group input-group-sm">
                              <span className="input-group-text bg-white small px-2">🎂 Birthdate</span>
                              <DateInput
                                value={g.dateOfBirth || ''}
                                onChange={(e) => {
                                  const dateVal = e.target.value;
                                  const calculatedAge = calculateAgeFromUiDate(dateVal);
                                  setRoomGuests(prev => prev.map((item, i) => i === idx ? { ...item, dateOfBirth: dateVal, age: calculatedAge } : item));
                                }}
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <select
                              className="form-select form-select-sm"
                              value={g.discountID}
                              onChange={(e) => handleGuestChange(idx, 'discountID', e.target.value)}
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

                  {/* REQUIREMENT 3: CHECK-IN SCENARIO SELECTOR */}
                  <div className="mb-3">
                    <label className="form-label fw-bold">Check-In Scenario *</label>
                    <div className="btn-group w-100" role="group">
                      <button
                        type="button"
                        className={`btn ${checkInScenario === 'now' ? 'btn-success text-white fw-bold' : 'btn-outline-secondary'}`}
                        onClick={() => {
                          setCheckInScenario('now');
                          const now = new Date();
                          const pad = (n) => String(n).padStart(2, '0');
                          setCheckInDate(toUiDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`));
                          setCheckInTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
                          setFormData(prev => ({ ...prev, status: 'Checked In' }));
                        }}
                      >
                        ⚡ Book & Check-In Now (Current System Time)
                      </button>
                      <button
                        type="button"
                        className={`btn ${checkInScenario === 'later' ? 'btn-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                        onClick={() => {
                          setCheckInScenario('later');
                          setFormData(prev => ({ ...prev, status: 'Pending Check-in' }));
                        }}
                      >
                        📅 Book Now, Check-In Later
                      </button>
                    </div>
                  </div>

                  {checkInScenario === 'later' && (
                    <div className="row g-2 mb-3 p-3 bg-light rounded border">
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Check-In Date *</label>
                        <DateInput value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} required />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Check-In Time *</label>
                        <input type="time" className="form-control form-control-sm" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} required />
                      </div>
                    </div>
                  )}

                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Check-Out Date *</label>
                      <DateInput value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Check-Out Time *</label>
                      <input type="time" className="form-control form-control-sm" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} required />
                    </div>
                  </div>

                  {/* REQUIREMENT 4: DOWN PAYMENT OPTIONS */}
                  <div className="mb-3">
                    <label className="form-label fw-bold">Required Down Payment Tier *</label>
                    <div className="btn-group w-100" role="group">
                      <button
                        type="button"
                        className={`btn ${downPaymentOption === '25' ? 'btn-pcc-primary text-white fw-bold' : 'btn-outline-secondary'}`}
                        onClick={() => setDownPaymentOption('25')}
                      >
                        25% Down Payment
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
                    if (checkInDate && checkOutDate && checkInTime && checkOutTime) {
                      const inStr = toDbDate(checkInDate) + 'T' + checkInTime;
                      const outStr = toDbDate(checkOutDate) + 'T' + checkOutTime;
                      const inD = new Date(inStr);
                      const outD = new Date(outStr);
                      if (outD > inD) {
                        const diff = Math.abs(outD - inD);
                        nights = Math.ceil(diff / (1000 * 60 * 60 * 24));
                      }
                    }

                    const excessGuestsCount = Math.max(0, roomGuests.length - maxOccupancy);
                    const extraGuestFee = excessGuestsCount * 200 * (nights || 1);
                    const rawSubtotal = (rate * (nights || 1)) + extraGuestFee;

                    let totalApportionedDiscount = 0;
                    if (roomGuests.length > 0 && selectedRoomObj) {
                      const sharePerGuest = (rate * (nights || 1)) / roomGuests.length;
                      roomGuests.forEach(g => {
                        if (g.discountID) {
                          const disc = availableDiscounts.find(d => String(d.discountID) === String(g.discountID));
                          if (disc) {
                            totalApportionedDiscount += sharePerGuest * (parseFloat(disc.percentage) / 100);
                          }
                        }
                      });
                    }

                    const netTotalAmount = Math.max(0, rawSubtotal - totalApportionedDiscount);
                    const dpPctNum = parseInt(downPaymentOption) || 25;
                    const requiredDownpayment = netTotalAmount * (dpPctNum / 100);
                    const remainingBalance = netTotalAmount - requiredDownpayment;

                    return (
                      <>
                        {rate > 0 && (
                          <div className="p-3 bg-light rounded border mb-3" style={{ fontSize: '0.88rem' }}>
                            <div className="d-flex justify-content-between mb-1">
                              <span className="text-muted">Room Base Rate:</span>
                              <span className="fw-bold text-dark">
                                ₱{rate.toFixed(2)}/night ({breakfastOption === 'with' ? 'With Breakfast ☕' : 'Without Breakfast 🚫'})
                              </span>
                            </div>
                            <div className="d-flex justify-content-between mb-1">
                              <span className="text-muted">Stay Duration:</span>
                              <span className="fw-semibold">{nights} Night(s)</span>
                            </div>

                            {excessGuestsCount > 0 && (
                              <div className="d-flex justify-content-between mb-1 text-warning-emphasis fw-bold">
                                <span>Additional Guest Fee ({excessGuestsCount} Extra Pax):</span>
                                <span>+₱{extraGuestFee.toFixed(2)}</span>
                              </div>
                            )}

                            {totalApportionedDiscount > 0 && (
                              <div className="d-flex justify-content-between mb-1 text-danger">
                                <span>Applied Discounts:</span>
                                <span>-₱{totalApportionedDiscount.toFixed(2)}</span>
                              </div>
                            )}

                            <div className="d-flex justify-content-between border-top pt-1.5 mb-1 fw-bold text-pcc-blue" style={{ fontSize: '1rem' }}>
                              <span>Net Total Booking Amount:</span>
                              <span>₱{netTotalAmount.toFixed(2)}</span>
                            </div>

                            <div className="d-flex justify-content-between text-success fw-bold">
                              <span>Required Down Payment ({dpPctNum}% Tier):</span>
                              <span className="fs-6">₱{requiredDownpayment.toFixed(2)}</span>
                            </div>

                            <div className="d-flex justify-content-between text-muted small">
                              <span>Remaining Balance at Check-in:</span>
                              <span>₱{remainingBalance.toFixed(2)}</span>
                            </div>
                          </div>
                        )}

                        <div className="row g-2 mb-3">
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold">Payment Method *</label>
                            <select
                              className="form-select form-select-sm"
                              required
                              value={paymentMethodID}
                              onChange={(e) => setPaymentMethodID(e.target.value)}
                            >
                              {paymentMethods.map(pm => (
                                <option key={pm.paymentMethodID} value={pm.paymentMethodID}>
                                  {pm.paymentMethod}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-md-6">
                            <label className="form-label small fw-semibold">Down Payment Received (₱) *</label>
                            <input
                              type="number"
                              step="0.01"
                              className="form-control form-control-sm fw-bold text-success"
                              required
                              value={downPayment}
                              onChange={(e) => setDownPayment(e.target.value)}
                            />
                            <small className="text-muted d-block mt-1" style={{ fontSize: '0.74rem' }}>
                              ⚡ Auto-calculated based on selected {dpPctNum}% downpayment tier.
                            </small>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-pcc-primary text-white fw-bold">Save Booking & Record Down Payment 🚀</button>
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
                <h5 className="modal-title fw-bold">🧾 Booking Down Payment Receipt</h5>
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
                  <div className="d-flex justify-content-between mb-1 text-success fw-bold">
                    <span>Down Payment Received ({downPaymentReceipt.downPaymentPercentage}%):</span>
                    <span className="fs-6">₱{parseFloat(downPaymentReceipt.amountPaid).toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between border-top pt-1 text-muted small">
                    <span>Remaining Balance at Check-in:</span>
                    <span>₱{parseFloat(downPaymentReceipt.remainingBalance).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer d-flex justify-content-between">
                <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Close</button>
                <button type="button" className="btn btn-pcc-primary text-white fw-bold" onClick={handlePrintDownPaymentReceipt}>
                  🖨️ Print Down Payment Receipt
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
                <h5 className="modal-title fw-bold">👥 Manage Room Guests — Stay #{managingBooking.bookingID}</h5>
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
                      className="btn btn-sm btn-outline-primary fw-bold"
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
                              🎂 Age: {g.age} yrs {parseInt(g.age) >= 60 ? '— Senior Citizen Eligible' : ''}
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
                        <div className="col-md-4">
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
                        <div className="col-md-4">
                          <div className="input-group input-group-sm">
                            <span className="input-group-text bg-white small px-2">🎂 Birthdate</span>
                            <DateInput
                              value={g.dateOfBirth || ''}
                              onChange={(e) => {
                                const dateVal = e.target.value;
                                const calculatedAge = calculateAgeFromUiDate(dateVal);
                                setManagingGuests(prev => prev.map((item, i) => i === idx ? { ...item, dateOfBirth: dateVal, age: calculatedAge } : item));
                              }}
                            />
                          </div>
                        </div>
                        <div className="col-md-4">
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
