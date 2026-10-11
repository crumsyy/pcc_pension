'use client';

import { useState, useEffect, useRef } from 'react';
import ModalDialog from '../../components/ModalDialog';
import ModalPortal from '../../components/ModalPortal';
import ActionButtons from '../../components/ActionButtons';
import { isValidDate, toDbDate, toUiDate } from '../../components/DateInput';
import FlatDatePicker from '../../components/FlatDatePicker';
import { Tabs, TabList, Tab } from '@/components/ui/tabs';
import {
  DialogTrigger,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import clientCache, { CACHE_TTL } from '@/lib/clientCache';
import { toast } from '@/components/ui/toast';
import AdminPagination, { paginate, ADMIN_PAGE_SIZE } from '../../components/AdminPagination';

export default function AdminDiscounts() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimer = useRef(null);
  const fetchInFlight = useRef(false);
  const [activeTab, setActiveTab] = useState('active_discounts');
  const [discPage, setDiscPage] = useState(1);
  const [promoPage, setPromoPage] = useState(1);
  // True while a tab switch is loading its dataset; tables show a loading
  // row instead of the other tab's stale rows or a false empty state.
  const [listLoading, setListLoading] = useState(false);

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setDiscPage(1);
    setPromoPage(1);
    setDiscounts([]);
    setPromotions([]);
    setListLoading(true);
  };

  const handleSearchChange = (v) => {
    setSearch(v);
    setDiscPage(1);
    setPromoPage(1);
  };

  const handleSearchInputChange = (v) => {
    setSearchInput(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      handleSearchChange(v);
    }, 350);
  };

  const handleClearSearch = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchInput('');
    setSearch('');
    setDiscPage(1);
    setPromoPage(1);
  };

  const baseCacheKey = `admin-discounts:${search}_${activeTab}`;
  const cached = clientCache.get(baseCacheKey);
  const [discounts, setDiscounts] = useState(cached?.data?.discounts || []);
  const [promotions, setPromotions] = useState(cached?.data?.promotions || []);
  const [discountTypes, setDiscountTypes] = useState(cached?.data?.discountTypes || []);
  const [eligibilityTypes, setEligibilityTypes] = useState(cached?.data?.eligibilityTypes || []);
  const [rooms, setRooms] = useState(cached?.data?.rooms || []);
  const [roomTypes, setRoomTypes] = useState(cached?.data?.roomTypes || []);
  const [shouldAnimate, setShouldAnimate] = useState(!cached);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'create_disc' | 'edit_disc' | 'create_promo' | 'edit_promo' | null
  const [selectedDisc, setSelectedDisc] = useState(null);
  const [selectedPromo, setSelectedPromo] = useState(null);

  // Form states
  const [discFormData, setDiscFormData] = useState({
    name: '',
    description: '',
    percentage: 0,
    requiredBookings: 0,
    discountTypeID: '',
    eligibilityTypeID: '',
  });

  const [promoFormData, setPromoFormData] = useState({
    name: '',
    description: '',
    percentage: 0,
    roomID: '',
    roomTypeID: '',
    startDate: '',
    endDate: '',
  });

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
          await onConfirmCallback();
        } finally {
          setModalConfig(prev => ({ ...prev, isOpen: false }));
        }
      },
      onCancel: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const fetchData = async (isSilent = false, isInitial = false) => {
    if (isSilent && fetchInFlight.current) return;
    fetchInFlight.current = true;
    if (!isSilent) {
      clientCache.invalidate('admin-discounts');
    }
    try {
      const query = new URLSearchParams({
        search,
        archived: activeTab === 'archived' ? 'true' : 'false',
        lookups: isInitial ? 'true' : 'false'
      }).toString();
      const res = await fetch(`/api/admin/discounts?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch data');

      const discData = data.discounts || [];
      const promoData = data.promotions || [];
      setDiscounts(discData);
      setPromotions(promoData);

      let dt = discountTypes;
      let et = eligibilityTypes;
      let rm = rooms;
      let rt = roomTypes;
      if (isInitial) {
        dt = data.discountTypes || [];
        et = data.eligibilityTypes || [];
        rm = data.rooms || [];
        rt = data.roomTypes || [];
        setDiscountTypes(dt);
        setEligibilityTypes(et);
        setRooms(rm);
        setRoomTypes(rt);
      }

      clientCache.set(baseCacheKey, {
        discounts: discData,
        promotions: promoData,
        discountTypes: dt,
        eligibilityTypes: et,
        rooms: rm,
        roomTypes: rt
      }, CACHE_TTL.DISCOUNTS);
    } catch (err) {
      if (!isSilent) toast.error('Request Failed', err.message);
      else console.warn('Background discounts refresh error:', err.message);
    } finally {
      fetchInFlight.current = false;
      setListLoading(false);
    }
  };

  useEffect(() => {
    const entry = clientCache.get(baseCacheKey);
    if (!entry) {
      fetchData(false, true);
    } else {
      setDiscounts(entry.data.discounts || []);
      setPromotions(entry.data.promotions || []);
      if (entry.data.discountTypes) setDiscountTypes(entry.data.discountTypes);
      if (entry.data.eligibilityTypes) setEligibilityTypes(entry.data.eligibilityTypes);
      if (entry.data.rooms) setRooms(entry.data.rooms);
      if (entry.data.roomTypes) setRoomTypes(entry.data.roomTypes);
      if (entry.isStale) {
        fetchData(true, false);
      }
    }
  }, [search, activeTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (fetchInFlight.current) return;
      fetchData(true, false);
    }, 5000);
    return () => clearInterval(interval);
  }, [search, activeTab]);

  const handleDiscInputChange = (e) => {
    const { name, value } = e.target;
    setDiscFormData(prev => {
      const next = { ...prev, [name]: value };
      // Open eligibility needs no proof: lock required bookings at 0.
      if (name === 'eligibilityTypeID') {
        const elig = (eligibilityTypes || []).find(t => String(t.eligibilityTypeID) === String(value))?.eligibility || '';
        if (elig === 'Open') next.requiredBookings = 0;
      }
      return next;
    });
  };

  const selectedEligibility = (eligibilityTypes || []).find(t => String(t.eligibilityTypeID) === String(discFormData.eligibilityTypeID))?.eligibility || '';
  const isOpenEligibility = selectedEligibility === 'Open';
  const isBookingCountEligibility = selectedEligibility === 'Booking Count';

  const eligibilityOptionLabel = (name) => {
    if (name === 'ID-Based') return 'ID-Based — name + ID required';
    if (name === 'Booking Count') return 'Booking Count — stay history required';
    if (name === 'Open') return 'Open — no requirements';
    return name;
  };

  const eligibilityExplainer = () => {
    if (isOpenEligibility) {
      return { title: 'Open — no requirements', body: 'No ID card and no stay history needed. Applies once per whole booking.' };
    }
    if (isBookingCountEligibility) {
      const req = parseInt(discFormData.requiredBookings || 0, 10) || 0;
      return { title: 'Booking Count — stay history required', body: `Guest needs ${req > 0 ? req : 'the required number of'} completed stays as primary booker (checked live at checkout). Name required, ID optional. Applies per guest.` };
    }
    if (selectedEligibility) {
      return { title: 'ID-Based — name + ID required', body: 'Guest name plus ID card number at checkout, one use per ID per booking. Applies per guest.' };
    }
    return null;
  };

  const validateDiscForm = () => {
    if (!discFormData.name.trim()) {
      return 'Name is required and cannot be empty.';
    }
    const pct = parseFloat(discFormData.percentage);
    if (isNaN(pct) || pct < 1 || pct > 100) {
      return 'Percentage must be a number between 1 and 100.';
    }
    const req = parseInt(discFormData.requiredBookings || 0, 10);
    if (isNaN(req) || req < 0) {
      return 'Required bookings cannot be negative.';
    }
    if (isBookingCountEligibility && req < 1) {
      return 'Booking Count discounts require at least 1 required booking.';
    }
    return null;
  };

  const handlePromoInputChange = (e) => {
    const { name, value } = e.target;
    setPromoFormData(prev => ({ ...prev, [name]: value }));
  };

  // Discount Handlers
  const handleCreateDiscSubmit = async (e) => {
    e.preventDefault();
    const formError = validateDiscForm();
    if (formError) {
      toast.error('Validation Error', formError);
      return;
    }

    showConfirm('Create Discount', 'Are you sure you want to create this discount?', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_discount',
            ...discFormData,
            name: discFormData.name.trim()
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create discount');
        toast.success('Discount Created', data.message || 'Discount created successfully.');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        toast.error('Request Failed', err.message);
      }
    });
  };

  const handleEditDiscSubmit = async (e) => {
    e.preventDefault();
    const formError = validateDiscForm();
    if (formError) {
      toast.error('Validation Error', formError);
      return;
    }

    showConfirm('Update Discount', 'Are you sure you want to save changes to this discount?', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_discount',
            discountID: selectedDisc.discountID,
            ...discFormData,
            name: discFormData.name.trim()
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update discount');
        toast.success('Discount Updated', data.message || 'Discount updated successfully.');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        toast.error('Request Failed', err.message);
      }
    });
  };

  const handleArchiveDisc = async (discountID) => {
    showConfirm('Archive Discount', 'Are you sure you want to archive this discount? It will be hidden from active inventory.', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'archive_discount', discountID }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to archive');
        toast.success('Discount Archived', data.message || 'Discount archived successfully.');
        fetchData();
      } catch (err) {
        toast.error('Request Failed', err.message);
      }
    });
  };

  const handleRestoreDisc = async (discountID) => {
    showConfirm('Restore Discount', 'Are you sure you want to restore this discount to active listings?', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore_discount', discountID }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to restore');
        toast.success('Discount Restored', data.message || 'Discount restored successfully.');
        fetchData();
      } catch (err) {
        toast.error('Request Failed', err.message);
      }
    });
  };

  // Promo Handlers
  const handleCreatePromoSubmit = async (e) => {
    e.preventDefault();
    if (!promoFormData.name.trim()) {
      toast.error('Validation Error', 'Name is required and cannot be empty.');
      return;
    }
    const pct = parseFloat(promoFormData.percentage);
    if (isNaN(pct) || pct < 1 || pct > 100) {
      toast.error('Validation Error', 'Percentage must be a number between 1 and 100.');
      return;
    }
    if (!promoFormData.startDate || !isValidDate(promoFormData.startDate)) {
      toast.error('Validation Error', 'Please enter a valid Start Date (MM/DD/YYYY).');
      return;
    }
    if (!promoFormData.endDate || !isValidDate(promoFormData.endDate)) {
      toast.error('Validation Error', 'Please enter a valid End Date (MM/DD/YYYY).');
      return;
    }
    if (toDbDate(promoFormData.endDate) < toDbDate(promoFormData.startDate)) {
      toast.error('Validation Error', 'End Date cannot be earlier than Start Date.');
      return;
    }

    showConfirm('Create Promotion', 'Are you sure you want to create this promotion?', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_promo',
            ...promoFormData,
            startDate: toDbDate(promoFormData.startDate),
            endDate: toDbDate(promoFormData.endDate),
            name: promoFormData.name.trim()
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create promo');
        toast.success('Promotion Created', data.message || 'Promotion created successfully.');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        toast.error('Request Failed', err.message);
      }
    });
  };

  const handleEditPromoSubmit = async (e) => {
    e.preventDefault();
    if (!promoFormData.name.trim()) {
      toast.error('Validation Error', 'Name is required and cannot be empty.');
      return;
    }
    const pct = parseFloat(promoFormData.percentage);
    if (isNaN(pct) || pct < 1 || pct > 100) {
      toast.error('Validation Error', 'Percentage must be a number between 1 and 100.');
      return;
    }
    if (!promoFormData.startDate || !isValidDate(promoFormData.startDate)) {
      toast.error('Validation Error', 'Please enter a valid Start Date (MM/DD/YYYY).');
      return;
    }
    if (!promoFormData.endDate || !isValidDate(promoFormData.endDate)) {
      toast.error('Validation Error', 'Please enter a valid End Date (MM/DD/YYYY).');
      return;
    }
    if (toDbDate(promoFormData.endDate) < toDbDate(promoFormData.startDate)) {
      toast.error('Validation Error', 'End Date cannot be earlier than Start Date.');
      return;
    }

    showConfirm('Update Promotion', 'Are you sure you want to save changes to this promotion?', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_promo',
            promotionID: selectedPromo.promotionID,
            ...promoFormData,
            startDate: toDbDate(promoFormData.startDate),
            endDate: toDbDate(promoFormData.endDate),
            name: promoFormData.name.trim()
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update promo');
        toast.success('Promotion Updated', data.message || 'Promotion updated successfully.');
        setActiveModal(null);
        fetchData();
      } catch (err) {
        toast.error('Request Failed', err.message);
      }
    });
  };

  const handleArchivePromo = async (promotionID) => {
    showConfirm('Archive Promotion', 'Are you sure you want to archive this promotion? It will be hidden from active inventory.', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'archive_promo', promotionID }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to archive');
        toast.success('Promotion Archived', data.message || 'Promotion archived successfully.');
        fetchData();
      } catch (err) {
        toast.error('Request Failed', err.message);
      }
    });
  };

  const handleRestorePromo = async (promotionID) => {
    showConfirm('Restore Promotion', 'Are you sure you want to restore this promotion to active listings?', async () => {
      try {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore_promo', promotionID }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to restore');
        toast.success('Promotion Restored', data.message || 'Promotion restored successfully.');
        fetchData();
      } catch (err) {
        toast.error('Request Failed', err.message);
      }
    });
  };

  const openCreateDiscModal = () => {
    setDiscFormData({
      name: '',
      description: '',
      percentage: 5,
      requiredBookings: 0,
      discountTypeID: discountTypes[0]?.discountTypeID || '',
      eligibilityTypeID: eligibilityTypes[0]?.eligibilityTypeID || '',
    });
    setActiveModal('create_disc');
  };

  const openEditDiscModal = (d) => {
    setSelectedDisc(d);
    setDiscFormData({
      name: d.name,
      description: d.description || '',
      percentage: d.percentage,
      requiredBookings: d.requiredBookings || 0,
      discountTypeID: d.discountTypeID,
      eligibilityTypeID: d.eligibilityTypeID,
    });
    setActiveModal('edit_disc');
  };

  const openCreatePromoModal = () => {
    setPromoFormData({
      name: '',
      description: '',
      percentage: 5,
      roomID: '',
      roomTypeID: '',
      startDate: '',
      endDate: '',
    });
    setActiveModal('create_promo');
  };

  const openEditPromoModal = (p) => {
    setSelectedPromo(p);
    setPromoFormData({
      name: p.name,
      description: p.description || '',
      percentage: p.percentage,
      roomID: p.roomID || '',
      roomTypeID: p.roomTypeID || '',
      startDate: p.startDate ? toUiDate(p.startDate) : '',
      endDate: p.endDate ? toUiDate(p.endDate) : '',
    });
    setActiveModal('edit_promo');
  };

  const isPromoActive = (startDate, endDate) => {
    const today = new Date().toISOString().substring(0, 10);
    const start = new Date(startDate).toISOString().substring(0, 10);
    const end = new Date(endDate).toISOString().substring(0, 10);
    return today >= start && today <= end;
  };

  const discPaginated = paginate(discounts, discPage, ADMIN_PAGE_SIZE);
  const promoPaginated = paginate(promotions, promoPage, ADMIN_PAGE_SIZE);


  return (
    <div className="pcc-page-container table-compact pcc-content-reveal">
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

      <div className="d-flex justify-content-between align-items-center mb-2">
        {/* Tabs for Active vs Archived */}
        <Tabs selectedKey={activeTab} onSelectionChange={(key) => handleTabChange(key)}>
          <TabList aria-label="Discount and promotion lists">
            <Tab id="active_discounts">Discounts</Tab>
            <Tab id="active_promos">Promos</Tab>
            <Tab id="archived">Archived Discounts &amp; Promos</Tab>
          </TabList>
        </Tabs>
        <div className="d-flex gap-2 align-items-center">
          {activeTab === 'active_discounts' && (
            <button className="btn btn-pcc-primary ms-2" onClick={openCreateDiscModal}>
              + Create Discount
            </button>
          )}
          {activeTab === 'active_promos' && (
            <button className="btn btn-pcc-primary" onClick={openCreatePromoModal}>
              + Create Promo
            </button>
          )}
        </div>
      </div>

      {/* Search Filter */}
      <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
        <div className="row g-2 align-items-end">
          <div className="col-md-9">
            <input
              type="text"
              className="form-control"
              placeholder="Search by discount/promo name..."
              value={searchInput}
              onChange={(e) => handleSearchInputChange(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <button className="btn btn-pcc-primary text-white w-100" onClick={handleClearSearch}>
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className={shouldAnimate ? 'pcc-content-reveal' : ''}>
        <div className={activeTab === 'archived' ? 'row g-3' : ''} style={activeTab === 'archived' ? { height: 'max(480px, calc(100dvh - 340px))' } : undefined}>
          {/* Discounts Section */}
          {(activeTab === 'active_discounts' || activeTab === 'archived') && (
            <div className={activeTab === 'archived' ? 'col-12 col-lg-6' : ''}>
            <div className={activeTab === 'archived' ? 'card-module pcc-table-card h-100 d-flex flex-column' : 'card-module pcc-table-card mb-4'} style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
              <h4 className="mb-3 text-blue">{activeTab === 'archived' ? 'Archived Discounts' : 'Discounts'}</h4>
              <div className="table-responsive" style={activeTab === 'archived' ? { flex: 1, minHeight: 0, overflowY: 'auto' } : { maxHeight: 'max(220px, calc(100vh - 500px))', overflowY: 'auto' }}>
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Eligibility</th>
                      <th>%</th>
                      <th>Req. Bookings</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discPaginated.rows.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-3">
                          {listLoading ? (
                            <span><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Loading records…</span>
                          ) : (
                            'No discounts found.'
                          )}
                        </td>
                      </tr>
                    ) : (
                      discPaginated.rows.map((d) => (
                        <tr key={d.discountID}>
                          <td>
                            <strong>{d.name}</strong>
                            <br />
                            <small className="text-muted">{d.description}</small>
                          </td>
                          <td>{d.discType}</td>
                          <td>{d.eligibility}</td>
                          <td>
                            <span className="badge text-bg-success">{d.percentage}%</span>
                          </td>
                          <td>{d.requiredBookings > 0 ? `${d.requiredBookings} stays` : '—'}</td>
                          <td>
                            <ActionButtons
                              onEdit={activeTab !== 'archived' ? () => openEditDiscModal(d) : null}
                              onArchive={activeTab !== 'archived' ? () => handleArchiveDisc(d.discountID) : null}
                              onRestore={activeTab === 'archived' ? () => handleRestoreDisc(d.discountID) : null}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className={activeTab === 'archived' ? 'mt-auto' : ''}>
              <AdminPagination page={discPaginated.safePage} totalPages={discPaginated.totalPages} onPage={setDiscPage} start={discPaginated.start} end={discPaginated.end} total={discPaginated.total} label="discounts" ariaLabel="Discounts pagination" />
              </div>
            </div>
            </div>
          )}

          {/* Promotions Section */}
          {(activeTab === 'active_promos' || activeTab === 'archived') && (
            <div className={activeTab === 'archived' ? 'col-12 col-lg-6' : ''}>
            <div className={activeTab === 'archived' ? 'card-module pcc-table-card h-100 d-flex flex-column' : 'card-module pcc-table-card'} style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
              <h4 className="mb-3 text-blue">{activeTab === 'archived' ? 'Archived Promos' : 'Promotions'}</h4>
              <div className="table-responsive" style={activeTab === 'archived' ? { flex: 1, minHeight: 0, overflowY: 'auto' } : { maxHeight: 'max(220px, calc(100vh - 500px))', overflowY: 'auto' }}>
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>%</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Applicability</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promoPaginated.rows.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center text-muted py-3">
                          {listLoading ? (
                            <span><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Loading records…</span>
                          ) : (
                            'No promotions found.'
                          )}
                        </td>
                      </tr>
                    ) : (
                      promoPaginated.rows.map((p) => {
                        const active = isPromoActive(p.startDate, p.endDate);
                        return (
                          <tr key={p.promotionID}>
                            <td>
                              <strong>{p.name}</strong>
                              <br />
                              <small className="text-muted">{p.description}</small>
                            </td>
                            <td>
                              <span className="badge text-bg-success">{p.percentage}%</span>
                            </td>
                            <td>
                              {new Date(p.startDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </td>
                            <td>
                              {new Date(p.endDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </td>
                            <td>{p.roomNumber ? `Room ${p.roomNumber}` : p.roomTypeName ? `Room Type: ${p.roomTypeName}` : 'All Rooms'}</td>
                            <td>
                              {active ? (
                                <span className="badge text-bg-success">Active</span>
                              ) : (
                                <span className="badge text-bg-secondary">Inactive</span>
                              )}
                            </td>
                            <td>
                              <ActionButtons
                                onEdit={activeTab !== 'archived' ? () => openEditPromoModal(p) : null}
                                onArchive={activeTab !== 'archived' ? () => handleArchivePromo(p.promotionID) : null}
                                onRestore={activeTab === 'archived' ? () => handleRestorePromo(p.promotionID) : null}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className={activeTab === 'archived' ? 'mt-auto' : ''}>
              <AdminPagination page={promoPaginated.safePage} totalPages={promoPaginated.totalPages} onPage={setPromoPage} start={promoPaginated.start} end={promoPaginated.end} total={promoPaginated.total} label="promos" ariaLabel="Promotions pagination" />
              </div>
            </div>
            </div>
          )}
        </div>
        </div>

      {/* ==========================================
          MODALS — DISCOUNTS & PROMOTIONS
          ========================================== */}
      {activeModal && (
        <ModalPortal>
          {/* CREATE DISCOUNT MODAL */}
          {activeModal === 'create_disc' && (
          <DialogTrigger isOpen={true}>
            <Dialog isDismissable={false} showCloseButton={false} aria-label="Create Discount">
              <DialogHeader>
                <div className="d-flex justify-content-between align-items-center w-100">
                  <DialogTitle>Create Discount</DialogTitle>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)} aria-label="Close"></button>
                </div>
              </DialogHeader>
              <form onSubmit={handleCreateDiscSubmit}>
                <DialogBody>
                  <div className="text-muted fw-bold mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }}>1 · IDENTITY</div>
                  <div className="mb-3">
                    <label className="form-label">Name <span className="required-asterisk">*</span></label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      required
                      value={discFormData.name}
                      onChange={handleDiscInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      name="description"
                      className="form-control"
                      rows="2"
                      value={discFormData.description}
                      onChange={handleDiscInputChange}
                    ></textarea>
                  </div>
                  <div className="text-muted fw-bold mb-2 mt-3" style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }}>2 · VALUE</div>
                  <div className="row g-2 mb-3">
                    <div className="col">
                      <label className="form-label">Percentage (1-100) <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        name="percentage"
                        className="form-control"
                        min="1"
                        max="100"
                        required
                        value={discFormData.percentage}
                        onChange={handleDiscInputChange}
                      />
                    </div>
                    <div className="col">
                      <label className="form-label">Req. Bookings {isBookingCountEligibility ? <span className="required-asterisk">*</span> : '(Conditional)'}</label>
                      <input
                        type="number"
                        name="requiredBookings"
                        className="form-control"
                        min="0"
                        disabled={isOpenEligibility}
                        title={isOpenEligibility ? 'Open discounts need no stay history.' : ''}
                        value={discFormData.requiredBookings}
                        onChange={handleDiscInputChange}
                      />
                    </div>
                  </div>
                  <div className="text-muted fw-bold mb-2 mt-3" style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }}>3 · RULES & ELIGIBILITY</div>
                  <div className="row g-2">
                    <div className="col">
                      <label className="form-label">Discount Type <span className="required-asterisk">*</span></label>
                      <select
                        name="discountTypeID"
                        className="form-select"
                        required
                        value={discFormData.discountTypeID}
                        onChange={handleDiscInputChange}
                      >
                        <option value="" disabled>Select</option>
                        {discountTypes.map(t => (
                          <option key={t.discountTypeID} value={t.discountTypeID}>{t.type}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col">
                      <label className="form-label">Eligibility <span className="required-asterisk">*</span></label>
                      <select
                        name="eligibilityTypeID"
                        className="form-select"
                        required
                        value={discFormData.eligibilityTypeID}
                        onChange={handleDiscInputChange}
                      >
                        <option value="" disabled>Select</option>
                        {eligibilityTypes.map(e => (
                          <option key={e.eligibilityTypeID} value={e.eligibilityTypeID}>{eligibilityOptionLabel(e.eligibility)}</option>
                        ))}
                      </select>
                      {isOpenEligibility && (
                        <div className="form-text text-muted">Open: no ID or stay history needed. Applies once per booking.</div>
                      )}
                      {isBookingCountEligibility && (
                        <div className="form-text text-muted">Booking Count: guest needs the required completed stays as primary booker.</div>
                      )}
                      {(() => {
                        const info = eligibilityExplainer();
                        if (!info) return null;
                        return (
                          <div className="alert alert-info py-2 px-3 mt-2 mb-0" style={{ fontSize: '0.8rem' }}>
                            <div className="fw-bold mb-0.5"><i className="bi bi-info-circle me-1"></i>How this works: {info.title}</div>
                            <div className="text-dark">{info.body}</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </DialogBody>
                <DialogFooter>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-pcc-primary">Create Discount</button>
                </DialogFooter>
              </form>
            </Dialog>
          </DialogTrigger>
      )}

      {/* EDIT DISCOUNT MODAL */}
      {activeModal === 'edit_disc' && selectedDisc && (
          <DialogTrigger isOpen={true}>
            <Dialog isDismissable={false} showCloseButton={false} aria-label="Update Discount">
              <DialogHeader>
                <div className="d-flex justify-content-between align-items-center w-100">
                  <DialogTitle>Update Discount</DialogTitle>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)} aria-label="Close"></button>
                </div>
              </DialogHeader>
              <form onSubmit={handleEditDiscSubmit}>
                <DialogBody>
                  <div className="text-muted fw-bold mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }}>1 · IDENTITY</div>
                  <div className="mb-3">
                    <label className="form-label">Name <span className="required-asterisk">*</span></label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      required
                      value={discFormData.name}
                      onChange={handleDiscInputChange}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      name="description"
                      className="form-control"
                      rows="2"
                      value={discFormData.description}
                      onChange={handleDiscInputChange}
                    ></textarea>
                  </div>
                  <div className="text-muted fw-bold mb-2 mt-3" style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }}>2 · VALUE</div>
                  <div className="row g-2 mb-3">
                    <div className="col">
                      <label className="form-label">Percentage <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        name="percentage"
                        className="form-control"
                        min="1"
                        max="100"
                        required
                        value={discFormData.percentage}
                        onChange={handleDiscInputChange}
                      />
                    </div>
                    <div className="col">
                      <label className="form-label">Req. Bookings {isBookingCountEligibility && <span className="required-asterisk">*</span>}</label>
                      <input
                        type="number"
                        name="requiredBookings"
                        className="form-control"
                        min="0"
                        disabled={isOpenEligibility}
                        title={isOpenEligibility ? 'Open discounts need no stay history.' : ''}
                        value={discFormData.requiredBookings}
                        onChange={handleDiscInputChange}
                      />
                    </div>
                  </div>
                  <div className="text-muted fw-bold mb-2 mt-3" style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }}>3 · RULES & ELIGIBILITY</div>
                  <div className="row g-2">
                    <div className="col">
                      <label className="form-label">Discount Type <span className="required-asterisk">*</span></label>
                      <select
                        name="discountTypeID"
                        className="form-select"
                        required
                        value={discFormData.discountTypeID}
                        onChange={handleDiscInputChange}
                      >
                        {discountTypes.map(t => (
                          <option key={t.discountTypeID} value={t.discountTypeID}>{t.type}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col">
                      <label className="form-label">Eligibility <span className="required-asterisk">*</span></label>
                      <select
                        name="eligibilityTypeID"
                        className="form-select"
                        required
                        value={discFormData.eligibilityTypeID}
                        onChange={handleDiscInputChange}
                      >
                        {eligibilityTypes.map(e => (
                          <option key={e.eligibilityTypeID} value={e.eligibilityTypeID}>{eligibilityOptionLabel(e.eligibility)}</option>
                        ))}
                      </select>
                      {isOpenEligibility && (
                        <div className="form-text text-muted">Open: no ID or stay history needed. Applies once per booking.</div>
                      )}
                      {isBookingCountEligibility && (
                        <div className="form-text text-muted">Booking Count: guest needs the required completed stays as primary booker.</div>
                      )}
                      {(() => {
                        const info = eligibilityExplainer();
                        if (!info) return null;
                        return (
                          <div className="alert alert-info py-2 px-3 mt-2 mb-0" style={{ fontSize: '0.8rem' }}>
                            <div className="fw-bold mb-0.5"><i className="bi bi-info-circle me-1"></i>How this works: {info.title}</div>
                            <div className="text-dark">{info.body}</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </DialogBody>
                <DialogFooter>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-pcc-primary">Update Discount</button>
                </DialogFooter>
              </form>
            </Dialog>
          </DialogTrigger>
      )}

      {/* ==========================================
          MODALS — PROMOTIONS
          ========================================== */}

      {/* CREATE PROMO MODAL */}
      {activeModal === 'create_promo' && (
          <DialogTrigger isOpen={true}>
            <Dialog isDismissable={false} showCloseButton={false} aria-label="Create Promotion" style={{ maxWidth: '800px' }}>
              <DialogHeader>
                <div className="d-flex justify-content-between align-items-center w-100">
                  <DialogTitle>Create Promotion</DialogTitle>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)} aria-label="Close"></button>
                </div>
              </DialogHeader>
              <form onSubmit={handleCreatePromoSubmit}>
                <DialogBody>
                  <div className="text-muted fw-bold mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }}>1 · IDENTITY</div>
                  <div className="row g-3 mb-3">
                    <div className="col-md-8">
                      <label className="form-label small fw-semibold">Promotion Name <span className="required-asterisk">*</span></label>
                      <input
                        type="text"
                        name="name"
                        className="form-control"
                        placeholder="e.g. Summer Promo Special"
                        required
                        value={promoFormData.name}
                        onChange={handlePromoInputChange}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Discount Percentage (1-100)% <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        name="percentage"
                        className="form-control"
                        min="1"
                        max="100"
                        placeholder="15"
                        required
                        value={promoFormData.percentage}
                        onChange={handlePromoInputChange}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Description / Terms</label>
                    <textarea
                      name="description"
                      className="form-control"
                      rows="2"
                      placeholder="Brief summary of promotion eligibility and details..."
                      value={promoFormData.description}
                      onChange={handlePromoInputChange}
                    ></textarea>
                  </div>

                  <div className="text-muted fw-bold mb-2 mt-3" style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }}>2 · APPLICABILITY</div>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Room Limit (Optional)</label>
                      <select
                        name="roomID"
                        className="form-select"
                        value={promoFormData.roomID}
                        onChange={(e) => {
                          handlePromoInputChange(e);
                          if (e.target.value) {
                            setPromoFormData(prev => ({ ...prev, roomTypeID: '' }));
                          }
                        }}
                      >
                        <option value="">All Rooms</option>
                        {rooms.map(rm => (
                          <option key={rm.roomID} value={rm.roomID}>Room {rm.roomNumber}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Room Type Limit (Optional)</label>
                      <select
                        name="roomTypeID"
                        className="form-select"
                        value={promoFormData.roomTypeID}
                        onChange={(e) => {
                          handlePromoInputChange(e);
                          if (e.target.value) {
                            setPromoFormData(prev => ({ ...prev, roomID: '' }));
                          }
                        }}
                      >
                        <option value="">All Room Types</option>
                        {roomTypes.map(rt => (
                          <option key={rt.roomTypeID} value={rt.roomTypeID}>{rt.type}</option>
                        ))}
                      </select>
                      <div className="form-text text-muted">Leave both on “All” for a property-wide promo. Picking one narrows it; picking a room clears the type and vice versa.</div>
                    </div>
                  </div>

                  <div className="text-muted fw-bold mb-2 mt-3" style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }}>3 · VALIDITY</div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Start Date <span className="required-asterisk">*</span></label>
                      <FlatDatePicker
                        name="startDate"
                        className="form-control"
                        required
                        value={promoFormData.startDate}
                        onChange={handlePromoInputChange}
                        dateFormat="m/d/Y"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">End Date <span className="required-asterisk">*</span></label>
                      <FlatDatePicker
                        name="endDate"
                        className="form-control"
                        required
                        value={promoFormData.endDate}
                        onChange={handlePromoInputChange}
                        dateFormat="m/d/Y"
                      />
                      <div className="form-text text-muted">Must be the same as or later than the start date.</div>
                    </div>
                  </div>
                </DialogBody>
                <DialogFooter className="border-top-0 pt-0 pb-4 px-4">
                  <button type="button" className="btn btn-secondary px-4 fw-bold" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-pcc-primary px-4 fw-bold text-white">Create Promotion</button>
                </DialogFooter>
              </form>
            </Dialog>
          </DialogTrigger>
      )}

      {/* EDIT PROMO MODAL */}
      {activeModal === 'edit_promo' && selectedPromo && (
          <DialogTrigger isOpen={true}>
            <Dialog isDismissable={false} showCloseButton={false} aria-label="Update Promotion" style={{ maxWidth: '800px' }}>
              <DialogHeader>
                <div className="d-flex justify-content-between align-items-center w-100">
                  <DialogTitle>Update Promotion</DialogTitle>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)} aria-label="Close"></button>
                </div>
              </DialogHeader>
              <form onSubmit={handleEditPromoSubmit}>
                <DialogBody>
                  <div className="text-muted fw-bold mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }}>1 · IDENTITY</div>
                  <div className="row g-3 mb-3">
                    <div className="col-md-8">
                      <label className="form-label small fw-semibold">Promotion Name <span className="required-asterisk">*</span></label>
                      <input
                        type="text"
                        name="name"
                        className="form-control"
                        required
                        value={promoFormData.name}
                        onChange={handlePromoInputChange}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Discount Percentage (1-100)% <span className="required-asterisk">*</span></label>
                      <input
                        type="number"
                        name="percentage"
                        className="form-control"
                        min="1"
                        max="100"
                        required
                        value={promoFormData.percentage}
                        onChange={handlePromoInputChange}
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Description / Terms</label>
                    <textarea
                      name="description"
                      className="form-control"
                      rows="2"
                      value={promoFormData.description}
                      onChange={handlePromoInputChange}
                    ></textarea>
                  </div>

                  <div className="text-muted fw-bold mb-2 mt-3" style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }}>2 · APPLICABILITY</div>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Room Limit (Optional)</label>
                      <select
                        name="roomID"
                        className="form-select"
                        value={promoFormData.roomID}
                        onChange={(e) => {
                          handlePromoInputChange(e);
                          if (e.target.value) {
                            setPromoFormData(prev => ({ ...prev, roomTypeID: '' }));
                          }
                        }}
                      >
                        <option value="">All Rooms</option>
                        {rooms.map(rm => (
                          <option key={rm.roomID} value={rm.roomID}>Room {rm.roomNumber}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Room Type Limit (Optional)</label>
                      <select
                        name="roomTypeID"
                        className="form-select"
                        value={promoFormData.roomTypeID}
                        onChange={(e) => {
                          handlePromoInputChange(e);
                          if (e.target.value) {
                            setPromoFormData(prev => ({ ...prev, roomID: '' }));
                          }
                        }}
                      >
                        <option value="">All Room Types</option>
                        {roomTypes.map(rt => (
                          <option key={rt.roomTypeID} value={rt.roomTypeID}>{rt.type}</option>
                        ))}
                      </select>
                      <div className="form-text text-muted">Leave both on “All” for a property-wide promo. Picking one narrows it; picking a room clears the type and vice versa.</div>
                    </div>
                  </div>

                  <div className="text-muted fw-bold mb-2 mt-3" style={{ fontSize: '0.7rem', letterSpacing: '0.08em' }}>3 · VALIDITY</div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Start Date <span className="required-asterisk">*</span></label>
                      <FlatDatePicker
                        name="startDate"
                        className="form-control"
                        required
                        value={promoFormData.startDate}
                        onChange={handlePromoInputChange}
                        dateFormat="m/d/Y"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">End Date <span className="required-asterisk">*</span></label>
                      <FlatDatePicker
                        name="endDate"
                        className="form-control"
                        required
                        value={promoFormData.endDate}
                        onChange={handlePromoInputChange}
                        dateFormat="m/d/Y"
                      />
                      <div className="form-text text-muted">Must be the same as or later than the start date.</div>
                    </div>
                  </div>
                </DialogBody>
                <DialogFooter className="border-top-0 pt-0 pb-4 px-4">
                  <button type="button" className="btn btn-secondary px-4 fw-bold" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-pcc-primary px-4 fw-bold text-white">Update Promotion</button>
                </DialogFooter>
              </form>
            </Dialog>
          </DialogTrigger>
      )}
        </ModalPortal>
      )}
    </div>
  );
}
