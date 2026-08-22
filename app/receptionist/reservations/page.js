'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ModalDialog from '../../components/ModalDialog';
import DateInput, { isValidDate, toDbDate, toUiDate } from '../../components/DateInput';
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

  useEffect(() => {
    const today = new Date();
    const year18Ago = today.getFullYear() - 18;
    const pad = (n) => String(n).padStart(2, '0');
    setMaxDobStr(`${year18Ago}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
  }, []);

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'edit' | 'convert' | null
  const [selectedRes, setSelectedRes] = useState(null);

  // Form states matching Booking Workspace
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [walkInForm, setWalkInForm] = useState({
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

  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [breakfastOption, setBreakfastOption] = useState('with');

  const [resDate, setResDate] = useState('');
  const [resTime, setResTime] = useState('14:00');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [specialRequests, setSpecialRequests] = useState('');

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

  // Room guests matching Booking form
  const [roomGuests, setRoomGuests] = useState([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);

  // Convert/Confirm Booking States
  const [downPaymentOption, setDownPaymentOption] = useState('25');
  const [paymentMethodID, setPaymentMethodID] = useState('1');
  const [downPayment, setDownPayment] = useState('');
  const [convInDate, setConvInDate] = useState('');
  const [convInTime, setConvInTime] = useState('14:00');
  const [convOutDate, setConvOutDate] = useState('');
  const [convOutTime, setConvOutTime] = useState('12:00');

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
        setIsWalkIn(true);
        setWalkInForm({
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
      setRoomGuests([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
    } else if (!activeModal) {
      setResDate('');
      setResTime('');
      setCheckOutDate('');
      setCheckOutTime('12:00');
      setSpecialRequests('');
      setFormData({ guestID: '', roomID: '' });
      setIsWalkIn(false);
      setWalkInForm({ firstName: '', lastName: '', contact: '', email: '', gender: 'Male', dateOfBirth: '' });
      setSelectedRoomType('');
      setSelectedRes(null);
      setRoomGuests([{ fullName: '', age: '', discountID: '', discountIdNumber: '' }]);
    }
  }, [activeModal, guests, minResDate]);

  // Synchronize first guest name matching Booking form
  useEffect(() => {
    if (activeModal === 'create' || activeModal === 'edit') {
      let name = '';
      let calculatedAge = '';
      if (isWalkIn) {
        name = `${walkInForm.firstName} ${walkInForm.lastName}`.trim();
        if (walkInForm.dateOfBirth) {
          calculatedAge = calculateAgeFromUiDate(walkInForm.dateOfBirth);
        }
      } else if (formData.guestID) {
        const selected = guests.find(g => String(g.guestID) === String(formData.guestID));
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
    setFormData({
      guestID: String(res.guestID),
      roomID: String(res.roomID)
    });

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

    setRoomGuests([{ fullName: `${res.firstName} ${res.lastName}`, age: 30, discountID: '', discountIdNumber: '' }]);
    setActiveModal('edit');
  };

  const openConvertModal = (res) => {
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

    setDownPaymentOption('25');
    setPaymentMethodID('1');
    setDownPayment('');
    setActiveModal('convert');
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    if (!isValidDate(resDate)) {
      showAlert('error', 'Validation Error', 'Please enter a valid Reservation Date (MM/DD/YYYY).');
      return;
    }
    if (!resTime) {
      showAlert('error', 'Validation Error', 'Please select a Reservation Time.');
      return;
    }
    if (!formData.roomID) {
      showAlert('error', 'Validation Error', 'Please select a Room for the reservation.');
      return;
    }

    // Lead time validation (at least 2 days ahead of today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(toDbDate(resDate) + 'T00:00:00');
    selectedDateObj.setHours(0, 0, 0, 0);

    const diffDays = Math.round((selectedDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays > 2) {
      showAlert('error', 'Validation Error', 'Reservations are strictly allowed for Today, Tomorrow, and Next Day only (up to 2 days ahead).');
      return;
    }

    if (isWalkIn) {
      if (!walkInForm.firstName.trim() || !walkInForm.lastName.trim()) {
        showAlert('error', 'Validation Error', 'First name and Last name are required.');
        return;
      }
      if (!walkInForm.dateOfBirth) {
        showAlert('error', 'Validation Error', 'Birthdate is required for walk-in guests.');
        return;
      }
      if (walkInForm.dateOfBirth) {
        const calculatedAge = calculateAgeFromUiDate(walkInForm.dateOfBirth);
        if (typeof calculatedAge === 'number' && calculatedAge < 18) {
          showAlert('error', 'Validation Error', 'You must be at least 18 years old to proceed.');
          return;
        }
      }
      if (!walkInForm.contact || walkInForm.contact.length !== 11) {
        showAlert('error', 'Validation Error', 'Contact number must be exactly 11 digits.');
        return;
      }
    }

    if (checkOutDate && isValidDate(checkOutDate)) {
      const inDateObj = new Date(toDbDate(resDate) + 'T' + resTime + ':00');
      const outDateObj = new Date(toDbDate(checkOutDate) + 'T' + checkOutTime + ':00');
      if (outDateObj <= inDateObj) {
        showAlert('error', 'Validation Error', 'Check-out time must be later than check-in time.');
        return;
      }
    }

    showConfirm('Create Reservation', 'Are you sure you want to create this reservation?', async () => {
      try {
        const res = await fetch('/api/receptionist/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            isWalkIn,
            ...(isWalkIn ? walkInForm : { guestID: formData.guestID }),
            roomID: formData.roomID,
            reservationDateTime: toDbDate(resDate) + ' ' + resTime + ':00',
            checkOutDateTime: checkOutDate && isValidDate(checkOutDate) ? toDbDate(checkOutDate) + ' ' + checkOutTime + ':00' : null,
            guestCount: roomGuests.length,
            specialRequests: specialRequests || null,
            breakfastOption
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create reservation');

        showAlert('success', 'Success', 'Reservation created successfully.');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRes) return;

    if (!isValidDate(resDate)) {
      showAlert('error', 'Validation Error', 'Please enter a valid Reservation Date (MM/DD/YYYY).');
      return;
    }
    if (!resTime) {
      showAlert('error', 'Validation Error', 'Please select a Reservation Time.');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(toDbDate(resDate) + 'T00:00:00');
    selectedDateObj.setHours(0, 0, 0, 0);

    const diffDays = Math.round((selectedDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 2) {
      showAlert('error', 'Validation Error', 'Reservations must be made at least 2 days before your intended check-in date.');
      return;
    }

    showConfirm('Update Reservation', 'Are you sure you want to update this reservation?', async () => {
      try {
        const res = await fetch('/api/receptionist/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            reservationID: selectedRes.reservationID,
            roomID: formData.roomID,
            reservationDateTime: toDbDate(resDate) + ' ' + resTime + ':00',
            checkOutDateTime: checkOutDate && isValidDate(checkOutDate) ? toDbDate(checkOutDate) + ' ' + checkOutTime + ':00' : null,
            guestCount: roomGuests.length,
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
    const dpPct = parseInt(downPaymentOption) || 25;
    const requiredDownpayment = totalRoomCharge * (dpPct / 100);

    const cashReceived = parseFloat(downPayment || 0);

    if (isNaN(cashReceived) || cashReceived < requiredDownpayment) {
      showAlert('error', 'Validation Error', `Minimum required down payment is ₱${requiredDownpayment.toFixed(2)} (${dpPct}% Tier).`);
      return;
    }

    const change = cashReceived - requiredDownpayment;

    showConfirm('Confirm & Record Booking', 'Are you sure you want to confirm this reservation and record down payment?', async () => {
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
            paymentMethodID: parseInt(paymentMethodID)
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to convert reservation to booking');

        showAlert('success', 'Success', 'Reservation confirmed and converted to booking successfully.');
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Confirmed': return 'bg-success text-white';
      case 'Pending': return 'bg-warning text-dark';
      case 'Canceled':
      case 'Cancelled': return 'bg-danger text-white';
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
              <option value="Booked">Booked</option>
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
                        {r.middleName ? `${r.firstName} ${r.middleName.charAt(0).toUpperCase()}. ${r.lastName}` : `${r.firstName} ${r.lastName}`}
                      </div>
                      <small className="text-muted">{r.contact}</small>
                    </td>
                    <td>
                      <div className="fw-semibold text-dark">Room {r.roomNumber} ({r.roomType})</div>
                      <small className="badge bg-light text-dark border">
                        {r.breakfastOption === 'without' ? 'Without Breakfast' : 'With Breakfast'}
                      </small>
                    </td>
                    <td>{new Date(r.reservationDateTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td>
                      {r.bookingID ? (
                        <span className="badge bg-success text-white">Booked</span>
                      ) : (
                        <span className={`badge ${getStatusBadge(r.status)}`}>{r.status}</span>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="actions-wrapper d-flex justify-content-end gap-1">
                        {!r.bookingID && r.status === 'Pending' && (
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
                        {!r.bookingID && r.status !== 'Cancelled' && r.status !== 'Expired' && (
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

      {/* CREATE / EDIT RESERVATION MODAL (Matching Booking Workspace Design) */}
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

                  {/* WALK-IN TOGGLE */}
                  {activeModal === 'create' && (
                    <div className="form-check form-switch p-2.5 mb-3 border rounded bg-light d-flex align-items-center justify-content-between">
                      <label className="form-check-label fw-bold mb-0 text-dark me-3" htmlFor="walkInToggle">
                        Walk-In Guest (Quick Booking Without Registered Account)
                      </label>
                      <input
                        className="form-check-input ms-0"
                        type="checkbox"
                        id="walkInToggle"
                        style={{ width: '2.4em', height: '1.2em' }}
                        checked={isWalkIn}
                        onChange={(e) => setIsWalkIn(e.target.checked)}
                      />
                    </div>
                  )}

                  {/* GUEST ACCOUNT SELECTION */}
                  {!isWalkIn ? (
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Select Guest Account *</label>
                      <SearchableSelect
                        options={guests.map(g => ({
                          value: String(g.guestID),
                          label: `${g.lastName}, ${g.firstName} (${g.contact})`
                        }))}
                        value={formData.guestID}
                        onChange={(val) => setFormData(prev => ({ ...prev, guestID: val }))}
                        placeholder="Type guest name or contact..."
                      />
                    </div>
                  ) : (
                    <div className="p-3 mb-3 border rounded bg-light">
                      <h6 className="mb-3 text-pcc-primary fw-bold">Walk-In Guest Details</h6>
                      <div className="row g-2 mb-2">
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold mb-1">First Name *</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            required={isWalkIn}
                            value={walkInForm.firstName}
                            onChange={(e) => setWalkInForm(prev => ({ ...prev, firstName: e.target.value }))}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold mb-1">Last Name *</label>
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
                          <label className="form-label small fw-semibold mb-1">Contact Number *</label>
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
                          <label className="form-label small fw-semibold mb-1">Birthdate *</label>
                          <DateInput
                            className="form-control form-control-sm"
                            value={walkInForm.dateOfBirth}
                            onChange={(e) => setWalkInForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                            max={maxDobStr}
                          />
                        </div>
                        <div className="col-md-4 mb-2">
                          <label className="form-label small fw-semibold mb-1">Email Address <span className="text-muted">(Optional)</span></label>
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

                  {/* ROOM SELECTION & BREAKFAST INCLUSION */}
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
                          .filter(rm => rm.roomType === selectedRoomType && (rm.status === 'Available' || String(rm.roomID) === String(formData.roomID)))
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
                        <option value="with">With Breakfast</option>
                        <option value="without">Without Breakfast</option>
                      </select>
                    </div>
                  </div>

                  {/* ROOM BASE PRICE DISPLAY */}
                  {selectedRoomObj && (
                    <div className="p-3 mb-3 border rounded bg-light d-flex align-items-center justify-content-between flex-wrap gap-2">
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
                      <span className="badge bg-primary px-3 py-1.5 rounded-pill fs-6">
                        Maximum Occupancy: {selectedRoomObj.occupancyLimit || 2} Guests
                      </span>
                    </div>
                  )}

                  {/* RESERVATION CHECK-IN & CHECK-OUT DATES */}
                  <div className="row g-2 mb-3 p-3 bg-light rounded border">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Reservation Check-In Date *</label>
                      <DateInput
                        className="form-control form-control-sm"
                        value={resDate}
                        onChange={(e) => handleResDateChange(e.target.value)}
                        required
                        min={minResDate}
                        max={maxResDate}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Reservation Check-In Time *</label>
                      <input
                        type="time"
                        className="form-control form-control-sm"
                        value={resTime}
                        onChange={(e) => setResTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Check-Out Date *</label>
                      <DateInput
                        className="form-control form-control-sm"
                        value={checkOutDate}
                        onChange={(e) => setCheckOutDate(e.target.value)}
                        required
                        min={resDate || minResDate}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Check-Out Time *</label>
                      <input
                        type="time"
                        className="form-control form-control-sm"
                        value={checkOutTime}
                        onChange={(e) => setCheckOutTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>

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
                  <button type="submit" className="btn btn-pcc-primary text-white fw-bold">
                    {activeModal === 'create' ? 'Save Reservation' : 'Update Reservation'}
                  </button>
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
        const dpPctNum = parseInt(downPaymentOption) || 25;
        const requiredDownpayment = totalRoomCharge * (dpPctNum / 100);
        const remainingBal = totalRoomCharge - requiredDownpayment;

        return (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content border-0 shadow-lg">
                <div className="modal-header text-white" style={{ background: 'var(--pcc-blue)' }}>
                  <h5 className="modal-title fw-bold">Confirm Reservation & Record Booking</h5>
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

                    {/* CHECK-IN SCENARIO (Locked to Check-In Later for Reservations) */}
                    <div className="mb-3">
                      <label className="form-label fw-bold">Check-In Scenario *</label>
                      <div className="btn-group w-100" role="group">
                        <button type="button" className="btn btn-outline-secondary" disabled>
                          Book & Check-In Now (Current System Time)
                        </button>
                        <button type="button" className="btn btn-primary text-white fw-bold active">
                          Book Now, Check-In Later
                        </button>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Reservations are scheduled for check-in on the reservation date.
                      </small>
                    </div>

                    <div className="row g-2 mb-3">
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Scheduled Check-In Date *</label>
                        <DateInput className="form-control form-control-sm" value={convInDate} onChange={(e) => setConvInDate(e.target.value)} required />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Scheduled Check-In Time *</label>
                        <input type="time" className="form-control form-control-sm" value={convInTime} onChange={(e) => setConvInTime(e.target.value)} required />
                      </div>
                    </div>

                    <div className="row g-2 mb-3">
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Check-Out Date *</label>
                        <DateInput className="form-control form-control-sm" value={convOutDate} onChange={(e) => setConvOutDate(e.target.value)} required />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Check-Out Time *</label>
                        <input type="time" className="form-control form-control-sm" value={convOutTime} onChange={(e) => setConvOutTime(e.target.value)} required />
                      </div>
                    </div>

                    {/* REQUIRED DOWN PAYMENT TIER */}
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
                          onChange={(e) => setPaymentMethodID(e.target.value)}
                        >
                          {paymentMethods.map(pm => (
                            <option key={pm.paymentMethodID} value={pm.paymentMethodID}>
                              {pm.paymentMethod}
                            </option>
                          ))}
                        </select>
                      </div>

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
                          className={`form-control form-control-sm fw-bold ${(parseFloat(downPayment || 0) - requiredDownpayment) >= 0 ? 'text-primary' : 'text-danger'
                            }`}
                          value={`₱${Math.max(0, (parseFloat(downPayment || 0) - requiredDownpayment)).toFixed(2)}`}
                        />
                        <small className="text-muted d-block mt-1" style={{ fontSize: '0.74rem' }}>
                          Auto-calculated change
                        </small>
                      </div>
                    </div>

                    {String(paymentMethodID) === '2' && (
                      <DynamicQrPhCode 
                        amount={requiredDownpayment}
                        merchantName="JOHN LLOYD CASPILLO"
                        accountNumber="0948-825-1444"
                        refNumber={`RES-${selectedRes?.reservationID || 'CONFIRM'}`}
                      />
                    )}
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Cancel</button>
                    <button type="submit" className="btn btn-pcc-primary text-white fw-bold">Save Booking & Record Down Payment</button>
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
