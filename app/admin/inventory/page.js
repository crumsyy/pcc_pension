'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ModalDialog from '../../components/ModalDialog';
import ModalPortal from '../../components/ModalPortal';
import FlatDatePicker from '../../components/FlatDatePicker';
import { isValidDate, toDbDate, toUiDate } from '../../components/DateInput';
import clientCache, { CACHE_TTL } from '@/lib/clientCache';
import { toast } from '@/components/ui/toast';
import AdminPagination, { paginate, ADMIN_PAGE_SIZE } from '../../components/AdminPagination';

export default function AdminInventory() {
  const router = useRouter();

  const cached = clientCache.get('admin-inventory');
  const [items, setItems] = useState(cached?.data?.items || []);
  const [batches, setBatches] = useState(cached?.data?.batches || []);
  const [borrowLogs, setBorrowLogs] = useState(cached?.data?.borrowLogs || []);
  const [disposalLogs, setDisposalLogs] = useState(cached?.data?.disposalLogs || []);
  const [movements, setMovements] = useState(cached?.data?.movements || []);
  const [stats, setStats] = useState(cached?.data?.stats || {
    totalConsumables: 0,
    totalNonConsumables: 0,
    totalStock: 0,
    lowStockCount: 0,
    expiredCount: 0,
    totalDisposed: 0,
    totalBorrowed: 0,
    totalDamaged: 0,
    totalLost: 0,
    nearExpirationCount: 0
  });

  // UI state
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'stocks' | 'batches' | 'borrow' | 'logs'
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(''); // 'Amenity' | 'Product'
  const [itemTypeFilter, setItemTypeFilter] = useState(''); // 'Consumable' | 'Non-Consumable'
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [expiredOnly, setExpiredOnly] = useState(false);
  const [expiryDateFilter, setExpiryDateFilter] = useState('');
  const [error, setError] = useState('');

  // Client-side pagination (10/page) — separate page per table
  const [dashPage, setDashPage] = useState(1);
  const [stocksPage, setStocksPage] = useState(1);
  const [batchesPage, setBatchesPage] = useState(1);
  const [borrowPage, setBorrowPage] = useState(1);
  const [disposalPage, setDisposalPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);

  const resetAllPages = () => {
    setDashPage(1);
    setStocksPage(1);
    setBatchesPage(1);
    setBorrowPage(1);
    setDisposalPage(1);
    setLogsPage(1);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    resetAllPages();
  };

  const handleSearchChange = (v) => {
    setSearch(v);
    resetAllPages();
  };

  const handleTypeFilterChange = (v) => {
    setTypeFilter(v);
    resetAllPages();
  };

  const handleItemTypeFilterChange = (v) => {
    setItemTypeFilter(v);
    resetAllPages();
  };

  const handleLowStockChange = (v) => {
    setLowStockOnly(v);
    setStocksPage(1);
  };

  const handleExpiredChange = (v) => {
    setExpiredOnly(v);
    setBatchesPage(1);
  };

  const handleExpiryDateChange = (v) => {
    setExpiryDateFilter(v);
    setBatchesPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setItemTypeFilter('');
    setLowStockOnly(false);
    setExpiredOnly(false);
    setExpiryDateFilter('');
    resetAllPages();
  };

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'dispose' | 'borrow' | 'return' | 'add_stock' | 'min_stock' | 'edit_expiry' | null
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedBorrow, setSelectedBorrow] = useState(null);
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editMinStock, setEditMinStock] = useState('');

  // Form states
  const [disposeForm, setDisposeForm] = useState({
    quantity: 1,
    reason: 'Expired',
    remarks: ''
  });

  const [borrowForm, setBorrowForm] = useState({
    quantity: 1,
    borrowedBy: '',
    bookingID: '',
    roomID: '',
    expectedReturnDate: '',
    remarks: ''
  });

  const [returnForm, setReturnForm] = useState({
    quantityReturned: 1,
    conditionUponReturn: 'Good',
    status: 'Returned', // 'Returned' | 'Damaged' | 'Lost'
    remarks: ''
  });

  const [stockOutForm, setStockOutForm] = useState({
    quantity: 1,
    reason: 'Internal Use',
    remarks: ''
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

  // Client-side synchronized filters
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !search.trim() ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase());
      const matchesType = !typeFilter || item.sourceTable === typeFilter;
      const matchesItemType = !itemTypeFilter || item.itemType === itemTypeFilter;
      const matchesLowStock = !lowStockOnly || (item.availableQty <= item.minStock);
      return matchesSearch && matchesType && matchesItemType && matchesLowStock;
    });
  }, [items, search, typeFilter, itemTypeFilter, lowStockOnly]);

  const filteredBatches = useMemo(() => {
    const localNow = new Date();
    const offset = 8 * 60;
    const localTime = new Date(localNow.getTime() + (offset + localNow.getTimezoneOffset()) * 60 * 1000);
    const todayStr = localTime.toISOString().substring(0, 10);

    return batches.filter(b => {
      const item = items.find(i => i.sourceTable === b.itemType && i.itemID === b.itemID);
      const matchesSearch = !search.trim() ||
        b.itemName.toLowerCase().includes(search.toLowerCase()) ||
        b.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
        (item && item.category.toLowerCase().includes(search.toLowerCase()));
      const matchesType = !typeFilter || b.itemType === typeFilter;
      const matchesItemType = !itemTypeFilter || (item && item.itemType === itemTypeFilter);
      
      const isExpired = b.expirationDate && (new Date(b.expirationDate).toISOString().substring(0, 10) < todayStr);
      const matchesExpired = !expiredOnly || isExpired;
      const matchesExpiryDate = !expiryDateFilter || (b.expirationDate && (new Date(b.expirationDate).toISOString().substring(0, 10) === toDbDate(expiryDateFilter)));
      const isAvailable = b.remainingQuantity > 0;

      return matchesSearch && matchesType && matchesItemType && matchesExpired && matchesExpiryDate && isAvailable;
    });
  }, [batches, items, search, typeFilter, itemTypeFilter, expiredOnly, expiryDateFilter]);

  const filteredBorrowLogs = useMemo(() => {
    return borrowLogs.filter(b => {
      const item = items.find(i => i.sourceTable === b.itemType && i.itemID === b.itemID);
      const matchesSearch = !search.trim() ||
        b.itemName.toLowerCase().includes(search.toLowerCase()) ||
        b.borrowedBy.toLowerCase().includes(search.toLowerCase()) ||
        (b.roomNumber && String(b.roomNumber).includes(search)) ||
        (item && item.category.toLowerCase().includes(search.toLowerCase()));
      const matchesType = !typeFilter || b.itemType === typeFilter;
      const matchesItemType = !itemTypeFilter || (item && item.itemType === itemTypeFilter);
      return matchesSearch && matchesType && matchesItemType;
    });
  }, [borrowLogs, items, search, typeFilter, itemTypeFilter]);

  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const item = items.find(i => i.sourceTable === m.itemType && i.itemID === m.itemID);
      const matchesSearch = !search.trim() ||
        m.itemName.toLowerCase().includes(search.toLowerCase()) ||
        (m.referenceNumber && m.referenceNumber.toLowerCase().includes(search.toLowerCase())) ||
        (m.remarks && m.remarks.toLowerCase().includes(search.toLowerCase())) ||
        (m.userEmail && m.userEmail.toLowerCase().includes(search.toLowerCase())) ||
        (item && item.category.toLowerCase().includes(search.toLowerCase()));
      const matchesType = !typeFilter || m.itemType === typeFilter;
      const matchesItemType = !itemTypeFilter || (item && item.itemType === itemTypeFilter);
      return matchesSearch && matchesType && matchesItemType;
    });
  }, [movements, items, search, typeFilter, itemTypeFilter]);

  const dashPaginated = paginate(movements, dashPage, ADMIN_PAGE_SIZE);
  const stocksPaginated = paginate(filteredItems, stocksPage, ADMIN_PAGE_SIZE);
  const batchesPaginated = paginate(filteredBatches, batchesPage, ADMIN_PAGE_SIZE);
  const borrowPaginated = paginate(filteredBorrowLogs, borrowPage, ADMIN_PAGE_SIZE);
  const disposalPaginated = paginate(disposalLogs, disposalPage, ADMIN_PAGE_SIZE);
  const logsPaginated = paginate(filteredMovements, logsPage, ADMIN_PAGE_SIZE);

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

  const notifyCrossModuleSync = () => {
    clientCache.invalidate('admin-inventory');
    clientCache.invalidate('admin-dashboard');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pcc-inventory-sync'));
      try {
        const bc = new BroadcastChannel('pcc_inventory_sync');
        bc.postMessage({ type: 'STOCK_UPDATED', time: Date.now() });
        bc.close();
      } catch (e) {}
    }
  };

  const fetchInventory = async (isSilent = false) => {
    setError('');
    try {
      const res = await fetch('/api/admin/inventory', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch inventory');

      const itemsData = data.items || [];
      const batchesData = data.batches || [];
      const borrowLogsData = data.borrowLogs || [];
      const disposalLogsData = data.disposalLogs || [];
      const movementsData = data.movements || [];
      const statsData = data.stats || {
        totalConsumables: 0,
        totalNonConsumables: 0,
        totalStock: 0,
        lowStockCount: 0,
        expiredCount: 0,
        totalDisposed: 0,
        totalBorrowed: 0,
        totalDamaged: 0,
        totalLost: 0,
        nearExpirationCount: 0
      };

      setItems(itemsData);
      setBatches(batchesData);
      setBorrowLogs(borrowLogsData);
      setDisposalLogs(disposalLogsData);
      setMovements(movementsData);
      setStats(statsData);

      clientCache.set('admin-inventory', {
        items: itemsData,
        batches: batchesData,
        borrowLogs: borrowLogsData,
        disposalLogs: disposalLogsData,
        movements: movementsData,
        stats: statsData
      }, CACHE_TTL.INVENTORY);
    } catch (err) {
      if (!isSilent) setError(err.message);
      else console.warn('Background inventory refresh error:', err.message);
    }
  };

  useEffect(() => {
    const currentCached = clientCache.get('admin-inventory');
    if (!currentCached) {
      fetchInventory(false);
    } else if (currentCached.isStale) {
      fetchInventory(true);
    }

    // Real-time polling every 3 seconds
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchInventory(true);
      }
    }, 3000);

    const handleFocus = () => fetchInventory(true);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchInventory(true);
    };
    const handleSync = () => fetchInventory(true);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pcc-inventory-sync', handleSync);

    let bc;
    try {
      bc = new BroadcastChannel('pcc_inventory_sync');
      bc.onmessage = () => {
        handleSync();
      };
    } catch (e) {}

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pcc-inventory-sync', handleSync);
      if (bc) {
        try { bc.close(); } catch (e) {}
      }
    };
  }, []);

  const openEditExpiryModal = (batch) => {
    setSelectedBatch(batch);
    setEditExpiryDate(batch.expirationDate ? toUiDate(batch.expirationDate) : '');
    setActiveModal('edit_expiry');
  };

  const handleEditExpirySubmit = async (e) => {
    e.preventDefault();
    if (editExpiryDate && !isValidDate(editExpiryDate)) {
      showAlert('error', 'Validation Error', 'Please enter a valid Expiration Date (MM/DD/YYYY).');
      return;
    }
    showConfirm('Update Expiration Date', 'Are you sure you want to update the expiration date for this batch?', async () => {
      try {
        const res = await fetch('/api/admin/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_expiry',
            batchID: selectedBatch.batchID,
            expirationDate: editExpiryDate ? toDbDate(editExpiryDate) : null
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update expiration date');

        showAlert('success', 'Success', data.message || 'Batch expiration date updated successfully.');
        setActiveModal(null);
        fetchInventory(true);
        notifyCrossModuleSync();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const openMinStockModal = (item) => {
    setSelectedItem(item);
    setEditMinStock(item.minStock || 0);
    setActiveModal('min_stock');
  };

  const handleMinStockSubmit = async (e) => {
    e.preventDefault();
    const minVal = parseInt(editMinStock);
    if (isNaN(minVal) || minVal < 0) {
      showAlert('error', 'Validation Error', 'Minimum Stock Level must be a non-negative number.');
      return;
    }

    showConfirm('Confirm Update', 'Are you sure you want to change the minimum stock level?', async () => {
      try {
        const res = await fetch('/api/admin/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_min_stock',
            itemType: selectedItem?.sourceTable,
            itemID: selectedItem?.itemID,
            minStock: minVal
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update minimum stock level');

        showAlert('success', 'Success', data.message || 'Minimum stock level updated successfully.');
        setActiveModal(null);
        fetchInventory(true);
        notifyCrossModuleSync();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleDisposeSubmit = async (e) => {
    e.preventDefault();
    if (disposeForm.quantity <= 0) {
      showAlert('error', 'Validation Error', 'Quantity must be greater than zero.');
      return;
    }

    showConfirm('Confirm Disposal', 'Are you sure you want to dispose of these items? This action is permanent.', async () => {
      try {
        const res = await fetch('/api/admin/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'dispose',
            batchID: selectedBatch?.batchID || null,
            itemType: selectedItem?.sourceTable,
            itemID: selectedItem?.itemID,
            ...disposeForm
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Disposal failed');

        showAlert('success', 'Disposal Successful', data.message || 'Disposal recorded successfully.');
        setActiveModal(null);
        fetchInventory();
        notifyCrossModuleSync();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleStockOutSubmit = async (e) => {
    e.preventDefault();
    if (stockOutForm.quantity <= 0) {
      showAlert('error', 'Validation Error', 'Quantity must be greater than zero.');
      return;
    }

    showConfirm('Confirm Stock Out', 'Are you sure you want to record this stock out movement? This will update the inventory levels.', async () => {
      try {
        const res = await fetch('/api/admin/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'stock_out',
            batchID: selectedBatch?.batchID || null,
            itemType: selectedItem?.sourceTable,
            itemID: selectedItem?.itemID,
            ...stockOutForm
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Stock out failed');

        showAlert('success', 'Stock Out Successful', data.message || 'Stock out recorded successfully.');
        setActiveModal(null);
        fetchInventory();
        notifyCrossModuleSync();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const openStockOutModal = (item, batch = null) => {
    setSelectedItem(item);
    setSelectedBatch(batch);
    setStockOutForm({
      quantity: 1,
      reason: 'Internal Use',
      remarks: ''
    });
    setActiveModal('stock_out');
  };

  const handleBorrowSubmit = async (e) => {
    e.preventDefault();
    if (!borrowForm.borrowedBy.trim()) {
      showAlert('error', 'Validation Error', 'Borrower name is required.');
      return;
    }
    if (borrowForm.quantity <= 0) {
      showAlert('error', 'Validation Error', 'Quantity must be greater than zero.');
      return;
    }
    if (borrowForm.expectedReturnDate && !isValidDate(borrowForm.expectedReturnDate)) {
      showAlert('error', 'Validation Error', 'Please enter a valid Expected Return Date (MM/DD/YYYY).');
      return;
    }

    showConfirm('Confirm Borrowing', 'Are you sure you want to register this borrow transaction?', async () => {
      try {
        const res = await fetch('/api/admin/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'borrow',
            itemType: selectedItem?.sourceTable,
            itemID: selectedItem?.itemID,
            ...borrowForm,
            expectedReturnDate: borrowForm.expectedReturnDate ? toDbDate(borrowForm.expectedReturnDate) : null
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Borrow transaction failed');

        showAlert('success', 'Success', data.message || 'Borrow registered successfully.');
        setActiveModal(null);
        fetchInventory();
        notifyCrossModuleSync();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (returnForm.quantityReturned <= 0) {
      showAlert('error', 'Validation Error', 'Return quantity must be greater than zero.');
      return;
    }

    showConfirm('Confirm Return', 'Are you sure you want to process this return?', async () => {
      try {
        const res = await fetch('/api/admin/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'return',
            borrowID: selectedBorrow?.borrowID,
            ...returnForm
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Return failed');

        showAlert('success', 'Success', data.message || 'Return registered successfully.');
        setActiveModal(null);
        fetchInventory();
        notifyCrossModuleSync();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const openDisposeModal = (item, batch = null) => {
    setSelectedItem(item);
    setSelectedBatch(batch);
    setDisposeForm({
      quantity: 1,
      reason: 'Expired',
      remarks: ''
    });
    setActiveModal('dispose');
  };

  const openBorrowModal = (item) => {
    setSelectedItem(item);
    setBorrowForm({
      quantity: 1,
      borrowedBy: '',
      bookingID: '',
      roomID: '',
      expectedReturnDate: '',
      remarks: ''
    });
    setActiveModal('borrow');
  };

  const openReturnModal = (log) => {
    setSelectedBorrow(log);
    setReturnForm({
      quantityReturned: log.quantity,
      conditionUponReturn: 'Good',
      status: 'Returned',
      remarks: ''
    });
    setActiveModal('return');
  };

  const lowStockItems = items.filter(item => item.availableQty <= item.minStock);

  return (
    <div className="pcc-page-container pcc-content-reveal">
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

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="section-eyebrow">Admin</div>
          <h2 className="section-title mb-0">Inventory Management</h2>
        </div>
        <Link href="/admin/purchase-orders" className="btn btn-pcc-primary">
          + Create Purchase Order
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Navigation Tabs */}
      <ul className="nav nav-tabs mb-4 d-print-none">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'dashboard' ? 'active' : 'text-secondary'}`}
            style={{
              borderBottom: activeTab === 'dashboard' ? '3px solid var(--pcc-blue)' : '',
              color: activeTab === 'dashboard' ? 'var(--pcc-blue)' : ''
            }}
            onClick={() => handleTabChange('dashboard')}
          >
            Dashboard
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'stocks' ? 'active' : 'text-secondary'}`}
            style={{
              borderBottom: activeTab === 'stocks' ? '3px solid var(--pcc-blue)' : '',
              color: activeTab === 'stocks' ? 'var(--pcc-blue)' : ''
            }}
            onClick={() => handleTabChange('stocks')}
          >
            Current Stocks
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'batches' ? 'active' : 'text-secondary'}`}
            style={{
              borderBottom: activeTab === 'batches' ? '3px solid var(--pcc-blue)' : '',
              color: activeTab === 'batches' ? 'var(--pcc-blue)' : ''
            }}
            onClick={() => handleTabChange('batches')}
          >
            Batch Tracker
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'borrow' ? 'active' : 'text-secondary'}`}
            style={{
              borderBottom: activeTab === 'borrow' ? '3px solid var(--pcc-blue)' : '',
              color: activeTab === 'borrow' ? 'var(--pcc-blue)' : ''
            }}
            onClick={() => handleTabChange('borrow')}
          >
            Borrowing System
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'logs' ? 'active' : 'text-secondary'}`}
            style={{
              borderBottom: activeTab === 'logs' ? '3px solid var(--pcc-blue)' : '',
              color: activeTab === 'logs' ? 'var(--pcc-blue)' : ''
            }}
            onClick={() => handleTabChange('logs')}
          >
            Movement Logs
          </button>
        </li>
      </ul>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="row g-3 mb-4">
          <div className="col-6 col-md-4 col-xl-2">
            <div
              className="card-module h-100 p-3 rounded"
              style={{
                backgroundColor: '#fff',
                borderLeft: '4px solid #2155B5',
                borderTop: '1px solid var(--pcc-mist)',
                borderRight: '1px solid var(--pcc-mist)',
                borderBottom: '1px solid var(--pcc-mist)',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--pcc-muted)',
                  fontFamily: 'var(--font-tag)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 600
                }}
              >
                TOTAL ITEMS
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2155B5' }}>
                {items.length}
              </div>
            </div>
          </div>
          <div className="col-6 col-md-4 col-xl-2">
            <div
              className="card-module h-100 p-3 rounded"
              style={{
                backgroundColor: '#fff',
                borderLeft: '4px solid #2155B5',
                borderTop: '1px solid var(--pcc-mist)',
                borderRight: '1px solid var(--pcc-mist)',
                borderBottom: '1px solid var(--pcc-mist)',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--pcc-muted)',
                  fontFamily: 'var(--font-tag)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 600
                }}
              >
                TOTAL QUANTITY
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2155B5' }}>
                {items.reduce((sum, i) => sum + (i.availableQty || 0), 0)}
              </div>
            </div>
          </div>
          <div className="col-6 col-md-4 col-xl-2">
            <div
              className="card-module h-100 p-3 rounded"
              style={{
                backgroundColor: '#fff',
                borderLeft: '4px solid #2155B5',
                borderTop: '1px solid var(--pcc-mist)',
                borderRight: '1px solid var(--pcc-mist)',
                borderBottom: '1px solid var(--pcc-mist)',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--pcc-muted)',
                  fontFamily: 'var(--font-tag)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 600
                }}
              >
                LOW STOCK
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2155B5' }}>
                {stats.lowStockCount}
              </div>
            </div>
          </div>
          <div className="col-6 col-md-4 col-xl-2">
            <div
              className="card-module h-100 p-3 rounded"
              style={{
                backgroundColor: '#fff',
                borderLeft: '4px solid #2155B5',
                borderTop: '1px solid var(--pcc-mist)',
                borderRight: '1px solid var(--pcc-mist)',
                borderBottom: '1px solid var(--pcc-mist)',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--pcc-muted)',
                  fontFamily: 'var(--font-tag)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 600
                }}
              >
                EXPIRED BATCHES
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2155B5' }}>
                {stats.expiredCount}
              </div>
            </div>
          </div>
          <div className="col-6 col-md-4 col-xl-2">
            <div
              className="card-module h-100 p-3 rounded"
              style={{
                backgroundColor: '#fff',
                borderLeft: '4px solid #2155B5',
                borderTop: '1px solid var(--pcc-mist)',
                borderRight: '1px solid var(--pcc-mist)',
                borderBottom: '1px solid var(--pcc-mist)',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--pcc-muted)',
                  fontFamily: 'var(--font-tag)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 600
                }}
              >
                NEAR EXPIRATION
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2155B5' }}>
                {stats.nearExpirationCount}
              </div>
            </div>
          </div>
          <div className="col-6 col-md-4 col-xl-2">
            <div
              className="card-module h-100 p-3 rounded"
              style={{
                backgroundColor: '#fff',
                borderLeft: '4px solid #2155B5',
                borderTop: '1px solid var(--pcc-mist)',
                borderRight: '1px solid var(--pcc-mist)',
                borderBottom: '1px solid var(--pcc-mist)',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--pcc-muted)',
                  fontFamily: 'var(--font-tag)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 600
                }}
              >
                DISPOSED ITEMS
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2155B5' }}>
                {stats.totalDisposed}
              </div>
            </div>
          </div>

          {/* Recent movements overview */}
          <div className="col-12 mt-4">
            <div className="card shadow-sm border-0 bg-white p-3">
              <h5 style={{ color: 'var(--pcc-blue)', fontWeight: 600 }} className="mb-3">Recent Stock Movements</h5>
              <div className="table-responsive" style={{ maxHeight: 'max(200px, calc(100vh - 500px))', overflowY: 'auto' }}>
                <table className="table table-hover align-middle table-sm" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Item</th>
                      <th>Movement Type</th>
                      <th>Quantity</th>
                      <th>Reference</th>
                      <th>Staff</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashPaginated.rows.map((m) => (
                      <tr key={m.movementID}>
                        <td>{new Date(m.movementDateTime).toLocaleString()}</td>
                        <td><strong>{m.itemName}</strong></td>
                        <td>
                          <span className={`badge ${m.movementType === 'Stock In' ? 'text-bg-success' :
                              m.movementType === 'Stock Out' ? 'text-bg-dark' :
                                m.movementType === 'Borrow' ? 'text-bg-warning' :
                                  m.movementType === 'Return' ? 'text-bg-info' : 'text-bg-danger'
                            }`}>
                            {m.movementType}
                          </span>
                        </td>
                        <td className={m.quantity > 0 ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </td>
                        <td>{m.referenceNumber || '—'}</td>
                        <td>{m.userEmail || 'System'}</td>
                        <td>{m.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AdminPagination page={dashPaginated.safePage} totalPages={dashPaginated.totalPages} onPage={setDashPage} start={dashPaginated.start} end={dashPaginated.end} total={dashPaginated.total} label="movements" ariaLabel="Dashboard movements pagination" />
            </div>
          </div>
        </div>
      )}

      {/* SEARCH AND FILTERS CARD FOR TABS */}
      {activeTab !== 'dashboard' && (
        <div className="card-module mb-3 bg-white p-3 rounded border">
          <div className="row g-2 align-items-center">
            <div className="col-md-3">
              <input
                type="text"
                className="form-control"
                placeholder="Search catalog items..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <select className="form-select" value={typeFilter} onChange={(e) => handleTypeFilterChange(e.target.value)}>
                <option value="">All Categories</option>
                <option value="Amenity">Amenities</option>
                <option value="Product">Products</option>
              </select>
            </div>
            <div className="col-md-2">
              <select className="form-select" value={itemTypeFilter} onChange={(e) => handleItemTypeFilterChange(e.target.value)}>
                <option value="">All Item Types</option>
                <option value="Consumable">Consumable</option>
                <option value="Non-Consumable">Non-Consumable</option>
              </select>
            </div>
            {activeTab === 'batches' && (
              <div className="col-md-2">
                <div className="input-group">
                  <span className="input-group-text bg-light text-muted border-end-0" title="Filter by Expiration Date">
                    <i className="bi bi-calendar-event"></i>
                  </span>
                  <FlatDatePicker
                    className="form-control border-start-0 ps-0"
                    value={expiryDateFilter}
                    onChange={(val) => handleExpiryDateChange(typeof val === 'string' ? val : val?.target?.value || '')}
                    dateFormat="m/d/Y"
                  />
                </div>
              </div>
            )}
            <div className={`col-md-${activeTab === 'batches' ? '1' : '3'} d-flex align-items-center justify-content-center`}>
              {activeTab === 'stocks' && (
                <div className="form-check form-switch mb-0">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    role="switch" 
                    id="lowStockOnlySwitch"
                    checked={lowStockOnly}
                    onChange={(e) => handleLowStockChange(e.target.checked)}
                  />
                  <label className="form-check-label small fw-bold text-danger ms-1" htmlFor="lowStockOnlySwitch">
                    ⚠️ Low Stock Only
                  </label>
                </div>
              )}
              {activeTab === 'batches' && (
                <div className="form-check form-switch mb-0 ms-1">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    role="switch" 
                    id="expiredOnlySwitch"
                    checked={expiredOnly}
                    onChange={(e) => handleExpiredChange(e.target.checked)}
                  />
                  <label className="form-check-label small fw-bold text-danger ms-1" htmlFor="expiredOnlySwitch">
                    ⌛ Expired
                  </label>
                </div>
              )}
            </div>
            <div className="col-md-2">
              <button className="btn btn-pcc-primary text-white w-100" onClick={handleClearFilters}>
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CURRENT STOCKS TAB */}
      {activeTab === 'stocks' && (
        <div className="card-module pcc-table-card bg-white p-3 rounded border">
          <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
            <table className="table align-middle table-hover">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Item Type</th>
                  <th>Stock</th>
                  <th>Unit</th>
                  <th>Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stocksPaginated.rows.map((item) => {
                  const isLow = item.availableQty <= item.minStock;
                  return (
                    <tr key={`${item.sourceTable}-${item.itemID}`} className={isLow ? 'table-warning' : ''}>
                      <td><span className="badge text-bg-light border text-muted">{item.sourceTable}</span></td>
                      <td>
                        <strong>{item.name}</strong>
                        {isLow && (
                          <button
                            type="button"
                            className="badge text-bg-warning ms-2 border-0"
                            style={{ fontSize: '0.7rem', cursor: 'pointer', transition: 'transform 0.1s ease' }}
                            title="Click to Restock this item"
                            onClick={() => router.push(`/admin/purchase-orders?prefillName=${encodeURIComponent(item.name)}&prefillType=${item.sourceTable}`)}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          >
                            ⚠️ Recommended for Restock
                          </button>
                        )}
                      </td>
                      <td>{item.category}</td>
                      <td>
                        <span className={`badge ${item.itemType === 'Consumable' ? 'text-bg-info' : 'text-bg-secondary'}`}>
                          {item.itemType}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className={`fw-bold ${isLow ? 'text-danger' : 'text-success'}`}>
                            {item.availableQty} / {item.minStock}
                          </span>
                          <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none border-0 bg-transparent ms-1"
                            style={{ cursor: 'pointer' }}
                            title="Edit Minimum Stock Level"
                            onClick={() => openMinStockModal(item)}
                          >
                            <i className="fa-solid fa-pen-to-square text-primary"></i>
                          </button>
                        </div>
                        {item.itemType === 'Non-Consumable' && item.borrowedQty > 0 && (
                          <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                            (Borrowed: {item.borrowedQty})
                          </div>
                        )}
                      </td>
                      <td>{item.unit}</td>
                      <td>₱{parseFloat(item.price).toFixed(2)}</td>
                      <td>
                        <div className="d-flex gap-1">
                          <button
                            type="button"
                            className="action-btn action-btn-delete"
                            onClick={() => openDisposeModal(item)}
                            data-bs-toggle="tooltip"
                            data-bs-placement="top"
                            title="Dispose Item"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <AdminPagination page={stocksPaginated.safePage} totalPages={stocksPaginated.totalPages} onPage={setStocksPage} start={stocksPaginated.start} end={stocksPaginated.end} total={stocksPaginated.total} label="items" ariaLabel="Current stocks pagination" />
        </div>
      )}

      {/* BATCH TRACKER TAB */}
      {activeTab === 'batches' && (
        <div className="card-module pcc-table-card bg-white p-3 rounded border">
          <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
            <table className="table align-middle table-hover">
              <thead>
                <tr>
                  <th>Batch Number</th>
                  <th>Item Name</th>
                  <th>Item Type</th>
                  <th>Supplier</th>
                  <th>Qty Received</th>
                  <th>Remaining</th>
                  <th>Cost/Unit</th>
                  <th>Exp. Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batchesPaginated.rows.map((b) => {
                  const todayStr = (() => {
                    const today = new Date();
                    const pad = (n) => String(n).padStart(2, '0');
                    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
                  })();
                  const isExpired = b.expirationDate && b.expirationDate < todayStr;
                  return (
                    <tr key={b.batchID} className={isExpired ? 'table-danger' : ''}>
                      <td><code>{b.batchNumber}</code></td>
                      <td><strong>{b.itemName}</strong></td>
                      <td><span className="badge text-bg-light border text-muted">{b.itemType}</span></td>
                      <td>{b.supplier || '—'}</td>
                      <td>{b.quantity}</td>
                      <td>
                        <span className={`fw-bold ${b.remainingQuantity === 0 ? 'text-muted text-decoration-line-through' : b.remainingQuantity <= 5 ? 'text-warning' : 'text-success'}`}>
                          {b.remainingQuantity}
                        </span>
                      </td>
                      <td>₱{parseFloat(b.unitCost).toFixed(2)}</td>
                      <td>{b.expirationDate ? new Date(b.expirationDate).toLocaleDateString() : 'Non-Expiring'}</td>
                      <td>
                        <span className={`badge ${
                          b.remainingQuantity === 0
                            ? 'text-bg-secondary'
                            : isExpired
                              ? 'text-bg-danger'
                              : 'text-bg-success'
                        }`}>
                          {b.remainingQuantity === 0
                            ? (b.status || 'Consumed')
                            : isExpired
                              ? 'Expired'
                              : 'Active'
                          }
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <button
                            type="button"
                            className="action-btn action-btn-edit"
                            onClick={() => openEditExpiryModal(b)}
                            data-bs-toggle="tooltip"
                            data-bs-placement="top"
                            title="Edit Expiry Date"
                          >
                            <i className="fa-solid fa-pen"></i>
                          </button>
                          {b.remainingQuantity > 0 && (
                            <button
                              type="button"
                              className="action-btn action-btn-delete"
                              onClick={() => {
                                const matchItem = items.find(i => i.sourceTable === b.itemType && i.itemID === b.itemID);
                                openDisposeModal(matchItem, b);
                              }}
                              data-bs-toggle="tooltip"
                              data-bs-placement="top"
                              title="Dispose Batch"
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <AdminPagination page={batchesPaginated.safePage} totalPages={batchesPaginated.totalPages} onPage={setBatchesPage} start={batchesPaginated.start} end={batchesPaginated.end} total={batchesPaginated.total} label="batches" ariaLabel="Batch tracker pagination" />
        </div>
      )}

      {/* BORROWING SYSTEM TAB */}
      {activeTab === 'borrow' && (
        <div className="card-module pcc-table-card bg-white p-3 rounded border">
          <h5 className="text-blue mb-3">Asset Borrow Transactions</h5>
          <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
            <table className="table align-middle table-hover">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Asset Item</th>
                  <th>Quantity</th>
                  <th>Borrowed By</th>
                  <th>Borrow Date</th>
                  <th>Expected Return</th>
                  <th>Actual Return</th>
                  <th>Status</th>
                  <th>Condition</th>
                </tr>
              </thead>
              <tbody>
                {borrowPaginated.rows.map((log) => (
                  <tr key={log.borrowID}>
                    <td><code>BOR-{log.borrowID}</code></td>
                    <td><strong>{log.itemName}</strong></td>
                    <td>{log.quantity}</td>
                    <td>{log.borrowedBy}</td>
                    <td>{new Date(log.borrowDateTime).toLocaleDateString()}</td>
                    <td>{log.expectedReturnDate ? new Date(log.expectedReturnDate).toLocaleDateString() : '—'}</td>
                    <td>{log.actualReturnDate ? new Date(log.actualReturnDate).toLocaleDateString() : '—'}</td>
                    <td>
                      <span className={`badge ${log.status === 'Borrowed' ? 'text-bg-warning' :
                          log.status === 'Returned' ? 'text-bg-success' :
                            log.status === 'Damaged' ? 'text-bg-danger' : 'text-bg-dark'
                        }`}>
                        {log.status}
                      </span>
                    </td>
                    <td>{log.conditionUponReturn || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPagination page={borrowPaginated.safePage} totalPages={borrowPaginated.totalPages} onPage={setBorrowPage} start={borrowPaginated.start} end={borrowPaginated.end} total={borrowPaginated.total} label="records" ariaLabel="Borrow transactions pagination" />
        </div>
      )}

      {/* LOGS TAB */}
      {activeTab === 'logs' && (
        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <div className="card bg-white p-3 border">
              <h5 className="text-blue mb-3">Disposed Inventory Logs</h5>
              <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table className="table table-sm align-middle" style={{ fontSize: '0.85rem' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#fff' }}>
                    <tr>
                      <th>Date</th>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Reason</th>
                      <th>Remarks</th>
                      <th>By User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disposalPaginated.rows.map((d) => (
                      <tr key={d.disposalID}>
                        <td>{new Date(d.disposalDateTime).toLocaleDateString()}</td>
                        <td><strong>{d.itemName}</strong></td>
                        <td className="text-danger fw-bold">{d.quantity}</td>
                        <td><span className="badge text-bg-warning">{d.reason}</span></td>
                        <td>{d.remarks || '—'}</td>
                        <td>{d.userEmail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AdminPagination page={disposalPaginated.safePage} totalPages={disposalPaginated.totalPages} onPage={setDisposalPage} start={disposalPaginated.start} end={disposalPaginated.end} total={disposalPaginated.total} label="records" ariaLabel="Disposal logs pagination" />
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="card bg-white p-3 border">
              <h5 className="text-blue mb-3">All Stock Movements Audit History</h5>
              <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
                <table className="table table-sm align-middle" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsPaginated.rows.map((m) => (
                      <tr key={m.movementID}>
                        <td>{new Date(m.movementDateTime).toLocaleString()}</td>
                        <td><strong>{m.itemName}</strong></td>
                        <td>
                          <span className={`badge ${m.movementType === 'Stock In' ? 'text-bg-success' :
                              m.movementType === 'Stock Out' ? 'text-bg-dark' :
                                m.movementType === 'Borrow' ? 'text-bg-warning' :
                                  m.movementType === 'Return' ? 'text-bg-info' : 'text-bg-danger'
                            }`}>
                            {m.movementType}
                          </span>
                        </td>
                        <td className={m.quantity > 0 ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </td>
                        <td>{m.userEmail || 'System'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AdminPagination page={logsPaginated.safePage} totalPages={logsPaginated.totalPages} onPage={setLogsPage} start={logsPaginated.start} end={logsPaginated.end} total={logsPaginated.total} label="movements" ariaLabel="Stock movements pagination" />
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODALS
          ========================================== */}
      {activeModal && (
        <ModalPortal>
          {/* DISPOSE MODAL */}
          {activeModal === 'dispose' && selectedItem && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Dispose Inventory — {selectedItem.name}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleDisposeSubmit}>
                <div className="modal-body">
                  {selectedBatch && (
                    <div className="alert alert-info py-2" style={{ fontSize: '0.85rem' }}>
                      <strong>Batch Selected:</strong> <code>{selectedBatch.batchNumber}</code> ({selectedBatch.remainingQuantity} units remaining)
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label">Quantity to Dispose <span className="required-asterisk">*</span></label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      max={selectedBatch ? selectedBatch.remainingQuantity : undefined}
                      required
                      value={disposeForm.quantity}
                      onChange={(e) => setDisposeForm(prev => ({ ...prev, quantity: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) }))}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Reason <span className="required-asterisk">*</span></label>
                    <select
                      className="form-select"
                      required
                      value={disposeForm.reason}
                      onChange={(e) => setDisposeForm(prev => ({ ...prev, reason: e.target.value }))}
                    >
                      <option value="Expired">Expired</option>
                      <option value="Spoiled">Spoiled</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Contaminated">Contaminated</option>
                      <option value="Lost">Lost</option>
                      <option value="Returned to Supplier">Returned to Supplier</option>
                      <option value="Other">Other (Specify in Remarks)</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Remarks/Details</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={disposeForm.remarks}
                      onChange={(e) => setDisposeForm(prev => ({ ...prev, remarks: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-danger text-white">Record Disposal</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* STOCK OUT MODAL */}
      {activeModal === 'stock_out' && selectedItem && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Stock Out — {selectedItem.name}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleStockOutSubmit}>
                <div className="modal-body">
                  {selectedBatch && (
                    <div className="alert alert-info py-2" style={{ fontSize: '0.85rem' }}>
                      <strong>Batch Selected:</strong> <code>{selectedBatch.batchNumber}</code> ({selectedBatch.remainingQuantity} units remaining)
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label">Quantity to Stock Out <span className="required-asterisk">*</span></label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      max={selectedBatch ? selectedBatch.remainingQuantity : undefined}
                      required
                      value={stockOutForm.quantity}
                      onChange={(e) => setStockOutForm(prev => ({ ...prev, quantity: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) }))}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Reason <span className="required-asterisk">*</span></label>
                    <select
                      className="form-select"
                      required
                      value={stockOutForm.reason}
                      onChange={(e) => setStockOutForm(prev => ({ ...prev, reason: e.target.value }))}
                    >
                      <option value="Internal Use">Internal Use</option>
                      <option value="Room Setup">Room Setup</option>
                      <option value="Staff Consumption">Staff Consumption</option>
                      <option value="Complimentary Guest Amenity">Complimentary Guest Amenity</option>
                      <option value="Inventory Correction">Inventory Correction</option>
                      <option value="Other">Other (Specify in Remarks)</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Remarks/Details</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={stockOutForm.remarks}
                      onChange={(e) => setStockOutForm(prev => ({ ...prev, remarks: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-dark text-white">Record Stock Out</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* BORROW MODAL */}
      {activeModal === 'borrow' && selectedItem && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Borrow Asset — {selectedItem.name}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleBorrowSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Quantity to Borrow <span className="required-asterisk">*</span></label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      max={selectedItem.availableQty}
                      required
                      value={borrowForm.quantity}
                      onChange={(e) => setBorrowForm(prev => ({ ...prev, quantity: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) }))}
                    />
                    <div className="form-text small text-muted">Available stock: {selectedItem.availableQty}</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Borrowed By <span className="required-asterisk">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Guest Full Name or Staff Member"
                      required
                      value={borrowForm.borrowedBy}
                      onChange={(e) => setBorrowForm(prev => ({ ...prev, borrowedBy: e.target.value }))}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Expected Return Date</label>
                    <FlatDatePicker
                      className="form-control"
                      value={borrowForm.expectedReturnDate}
                      onChange={(val) => setBorrowForm(prev => ({ ...prev, expectedReturnDate: typeof val === 'string' ? val : val?.target?.value || '' }))}
                      dateFormat="m/d/Y"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Remarks</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={borrowForm.remarks}
                      onChange={(e) => setBorrowForm(prev => ({ ...prev, remarks: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Confirm Borrow</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* RETURN MODAL */}
      {activeModal === 'return' && selectedBorrow && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Return Asset — {selectedBorrow.itemName}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleReturnSubmit}>
                <div className="modal-body">
                  <div className="alert alert-info py-2" style={{ fontSize: '0.85rem' }}>
                    <strong>Borrower:</strong> {selectedBorrow.borrowedBy}<br />
                    <strong>Quantity borrowed:</strong> {selectedBorrow.quantity} units
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Quantity Returned <span className="required-asterisk">*</span></label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      max={selectedBorrow.quantity}
                      required
                      value={returnForm.quantityReturned}
                      onChange={(e) => setReturnForm(prev => ({ ...prev, quantityReturned: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) }))}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Return Status / Condition <span className="required-asterisk">*</span></label>
                    <select
                      className="form-select"
                      required
                      value={returnForm.status}
                      onChange={(e) => setReturnForm(prev => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="Returned">Returned (Good Condition)</option>
                      <option value="Damaged">Damaged (Disposed permanently)</option>
                      <option value="Lost">Lost (Disposed permanently)</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Condition Notes / Remarks</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      placeholder="e.g. Scratched legs, minor dent..."
                      value={returnForm.remarks}
                      onChange={(e) => setReturnForm(prev => ({ ...prev, remarks: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Record Return</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT EXPIRY MODAL */}
      {activeModal === 'edit_expiry' && selectedBatch && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Edit Batch Expiry Date</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleEditExpirySubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label fw-bold">Batch Number</label>
                    <input type="text" className="form-control bg-light" value={selectedBatch.batchNumber} disabled />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-bold">Item Name</label>
                    <input type="text" className="form-control bg-light" value={selectedBatch.itemName} disabled />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-bold">Expiration Date</label>
                    <FlatDatePicker
                      className="form-control"
                      value={editExpiryDate}
                      onChange={(val) => setEditExpiryDate(typeof val === 'string' ? val : val?.target?.value || '')}
                      dateFormat="m/d/Y"
                    />
                    <div className="form-text text-muted">
                      Leave empty if the item does not expire.
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Save Changes</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MIN STOCK MODAL */}
      {activeModal === 'min_stock' && selectedItem && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Edit Minimum Stock Threshold</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleMinStockSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label fw-bold">Item Name</label>
                    <input type="text" className="form-control bg-light" value={selectedItem.name} disabled />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-bold">Category</label>
                    <input type="text" className="form-control bg-light" value={selectedItem.sourceTable} disabled />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-bold">Minimum Stock Level <span className="required-asterisk">*</span></label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      required
                      value={editMinStock}
                      onChange={(e) => setEditMinStock(e.target.value)}
                    />
                    <div className="form-text text-muted">
                      Alert badge will be shown when the stock level falls to or below this amount.
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Save Changes</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
        </ModalPortal>
      )}
    </div>
  );
}
