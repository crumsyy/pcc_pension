'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ModalDialog from '../../components/ModalDialog';
import DateInput, { isValidDate, toDbDate, toUiDate } from '../../components/DateInput';

export default function AdminInventory() {
  const router = useRouter();
  
  // Data states
  const [items, setItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [borrowLogs, setBorrowLogs] = useState([]);
  const [disposalLogs, setDisposalLogs] = useState([]);
  const [movements, setMovements] = useState([]);
  const [stats, setStats] = useState({
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'dispose' | 'borrow' | 'return' | null
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
      return matchesSearch && matchesType && matchesItemType;
    });
  }, [items, search, typeFilter, itemTypeFilter]);

  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      const item = items.find(i => i.sourceTable === b.itemType && i.itemID === b.itemID);
      const matchesSearch = !search.trim() || 
        b.itemName.toLowerCase().includes(search.toLowerCase()) ||
        b.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
        (item && item.category.toLowerCase().includes(search.toLowerCase()));
      const matchesType = !typeFilter || b.itemType === typeFilter;
      const matchesItemType = !itemTypeFilter || (item && item.itemType === itemTypeFilter);
      return matchesSearch && matchesType && matchesItemType;
    });
  }, [batches, items, search, typeFilter, itemTypeFilter]);

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

  const fetchInventory = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/inventory');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch inventory');

      setItems(data.items || []);
      setBatches(data.batches || []);
      setBorrowLogs(data.borrowLogs || []);
      setDisposalLogs(data.disposalLogs || []);
      setMovements(data.movements || []);
      setStats(data.stats || {
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
    } catch (err) {
      setError(err.message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory(); // Initial full load

    const interval = setInterval(() => {
      fetchInventory(true); // Background poll
    }, 4000); // Poll every 4 seconds

    return () => clearInterval(interval);
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
    <div>
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

      {/* Low Stock Banner Alert */}
      {!loading && lowStockItems.length > 0 && (
        <div className="alert alert-warning d-flex align-items-center gap-2 mb-3 shadow-sm" role="alert">
          <span>
            <strong>⚠ Low Stock Alert:</strong> {lowStockItems.length} item(s) are at or below safety levels.
          </span>
          <button className="ms-auto btn btn-sm btn-warning" onClick={() => setActiveTab('stocks')}>
            View Items
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <ul className="nav nav-tabs mb-4 d-print-none">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'dashboard' ? 'active text-blue' : 'text-secondary'}`}
            style={{ borderBottom: activeTab === 'dashboard' ? '3px solid var(--pcc-blue)' : '' }}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'stocks' ? 'active text-blue' : 'text-secondary'}`}
            style={{ borderBottom: activeTab === 'stocks' ? '3px solid var(--pcc-blue)' : '' }}
            onClick={() => setActiveTab('stocks')}
          >
            📋 Current Stocks
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'batches' ? 'active text-blue' : 'text-secondary'}`}
            style={{ borderBottom: activeTab === 'batches' ? '3px solid var(--pcc-blue)' : '' }}
            onClick={() => setActiveTab('batches')}
          >
            📦 Batch Tracker
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'borrow' ? 'active text-blue' : 'text-secondary'}`}
            style={{ borderBottom: activeTab === 'borrow' ? '3px solid var(--pcc-blue)' : '' }}
            onClick={() => setActiveTab('borrow')}
          >
            🤝 Borrowing System
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'logs' ? 'active text-blue' : 'text-secondary'}`}
            style={{ borderBottom: activeTab === 'logs' ? '3px solid var(--pcc-blue)' : '' }}
            onClick={() => setActiveTab('logs')}
          >
            📜 Movement Logs
          </button>
        </li>
      </ul>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <div className="card shadow-sm border-0 p-3 h-100 bg-white">
              <span className="text-muted small fw-bold">TOTAL STOCK UNITS</span>
              <h2 className="fw-bold text-info mb-0 mt-1">{stats.totalStock}</h2>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card shadow-sm border-0 p-3 h-100 bg-white">
              <span className="text-muted small fw-bold">TOTAL CONSUMABLES</span>
              <h2 className="fw-bold text-primary mb-0 mt-1">{stats.totalConsumables}</h2>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card shadow-sm border-0 p-3 h-100 bg-white">
              <span className="text-muted small fw-bold">TOTAL ASSETS (NON-CONS.)</span>
              <h2 className="fw-bold text-success mb-0 mt-1">{stats.totalNonConsumables}</h2>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card shadow-sm border-0 p-3 h-100 bg-white">
              <span className="text-muted small fw-bold">LOW STOCK ALERTS</span>
              <h2 className="fw-bold text-danger mb-0 mt-1">{stats.lowStockCount}</h2>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card shadow-sm border-0 p-3 h-100 bg-white">
              <span className="text-muted small fw-bold">EXPIRED BATCHES</span>
              <h2 className="fw-bold text-dark mb-0 mt-1">{stats.expiredCount}</h2>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="card shadow-sm border-0 p-3 h-100 bg-white">
              <span className="text-muted small fw-bold">BORROWED ASSETS</span>
              <h2 className="fw-bold text-warning mb-0 mt-1">{stats.totalBorrowed}</h2>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card shadow-sm border-0 p-3 h-100 bg-white">
              <span className="text-muted small fw-bold">DISPOSED QUANTITY</span>
              <h2 className="fw-bold text-secondary mb-0 mt-1">{stats.totalDisposed}</h2>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card shadow-sm border-0 p-3 h-100 bg-white">
              <span className="text-muted small fw-bold">DAMAGED ITEMS</span>
              <h2 className="fw-bold text-danger mb-0 mt-1">{stats.totalDamaged}</h2>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card shadow-sm border-0 p-3 h-100 bg-white">
              <span className="text-muted small fw-bold">NEAR EXPIRATION (30D)</span>
              <h2 className="fw-bold text-info mb-0 mt-1">{stats.nearExpirationCount}</h2>
            </div>
          </div>

          {/* Recent movements overview */}
          <div className="col-12 mt-4">
            <div className="card shadow-sm border-0 bg-white p-3">
              <h5 className="text-blue mb-3">Recent Stock Movements</h5>
              <div className="table-responsive">
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
                    {movements.slice(0, 8).map((m) => (
                      <tr key={m.movementID}>
                        <td>{new Date(m.movementDateTime).toLocaleString()}</td>
                        <td><strong>{m.itemName}</strong></td>
                        <td>
                          <span className={`badge ${
                            m.movementType === 'Stock In' ? 'text-bg-success' :
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
            </div>
          </div>
        </div>
      )}

      {/* SEARCH AND FILTERS CARD FOR TABS */}
      {activeTab !== 'dashboard' && (
        <div className="card-module mb-3 bg-white p-3 rounded border">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <input
                type="text"
                className="form-control"
                placeholder="Search catalog items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <select className="form-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All Categories (Amenity/Product)</option>
                <option value="Amenity">Amenities</option>
                <option value="Product">Products</option>
              </select>
            </div>
            <div className="col-md-3">
              <select className="form-select" value={itemTypeFilter} onChange={(e) => setItemTypeFilter(e.target.value)}>
                <option value="">All Item Types (Consumable/Asset)</option>
                <option value="Consumable">Consumable</option>
                <option value="Non-Consumable">Non-Consumable</option>
              </select>
            </div>
            <div className="col-md-2">
              <button className="btn btn-pcc-outline w-100" onClick={() => { setSearch(''); setTypeFilter(''); setItemTypeFilter(''); }}>
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CURRENT STOCKS TAB */}
      {activeTab === 'stocks' && (
        <div className="card-module bg-white p-3 rounded border">
          <div className="table-responsive">
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
                {filteredItems.map((item) => {
                    const isLow = item.availableQty <= item.minStock;
                    return (
                      <tr key={`${item.sourceTable}-${item.itemID}`} className={isLow ? 'table-warning' : ''}>
                        <td><span className="badge text-bg-light border text-muted">{item.sourceTable}</span></td>
                        <td>
                          <strong>{item.name}</strong>
                          {isLow && (
                            <span className="badge text-bg-warning ms-2" style={{ fontSize: '0.7rem' }}>
                              ⚠️ Recommended for Restock
                            </span>
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
                            <button className="btn btn-sm btn-danger text-white" onClick={() => openDisposeModal(item)}>
                              🗑 Dispose
                            </button>
                            {isLow && (
                              <button 
                                className="btn btn-sm btn-pcc-primary text-white" 
                                onClick={() => router.push(`/admin/purchase-orders?prefillName=${encodeURIComponent(item.name)}&prefillType=${item.sourceTable}`)}
                              >
                                🛒 Restock
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
        </div>
      )}

      {/* BATCH TRACKER TAB */}
      {activeTab === 'batches' && (
        <div className="card-module bg-white p-3 rounded border">
          <div className="table-responsive">
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
                {filteredBatches.map((b) => {
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
                            b.remainingQuantity === 0 ? 'text-bg-secondary' :
                            isExpired ? 'text-bg-danger' : 'text-bg-success'
                          }`}>
                            {b.remainingQuantity === 0 ? 'Consumed' : isExpired ? 'Expired' : 'Active'}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <button className="btn btn-sm btn-pcc-outline" onClick={() => openEditExpiryModal(b)}>
                              ✏ Expiry
                            </button>
                            {b.remainingQuantity > 0 && (
                              <>
                                <button className="btn btn-sm btn-danger text-white" onClick={() => {
                                  const matchItem = items.find(i => i.sourceTable === b.itemType && i.itemID === b.itemID);
                                  openDisposeModal(matchItem, b);
                                }}>
                                  🗑 Dispose
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BORROWING SYSTEM TAB */}
      {activeTab === 'borrow' && (
        <div className="card-module bg-white p-3 rounded border">
          <h5 className="text-blue mb-3">Asset Borrow Transactions</h5>
          <div className="table-responsive">
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
                {filteredBorrowLogs.map((log) => (
                  <tr key={log.borrowID}>
                    <td><code>BOR-{log.borrowID}</code></td>
                    <td><strong>{log.itemName}</strong></td>
                    <td>{log.quantity}</td>
                    <td>{log.borrowedBy}</td>
                    <td>{new Date(log.borrowDateTime).toLocaleDateString()}</td>
                    <td>{log.expectedReturnDate ? new Date(log.expectedReturnDate).toLocaleDateString() : '—'}</td>
                    <td>{log.actualReturnDate ? new Date(log.actualReturnDate).toLocaleDateString() : '—'}</td>
                    <td>
                      <span className={`badge ${
                        log.status === 'Borrowed' ? 'text-bg-warning' :
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
        </div>
      )}

      {/* LOGS TAB */}
      {activeTab === 'logs' && (
        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <div className="card bg-white p-3 border">
              <h5 className="text-blue mb-3">Disposed Inventory Logs</h5>
              <div className="table-responsive">
                <table className="table table-sm align-middle" style={{ fontSize: '0.85rem' }}>
                  <thead>
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
                    {disposalLogs.map((d) => (
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
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="card bg-white p-3 border">
              <h5 className="text-blue mb-3">All Stock Movements Audit History</h5>
              <div className="table-responsive">
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
                    {filteredMovements.map((m) => (
                      <tr key={m.movementID}>
                        <td>{new Date(m.movementDateTime).toLocaleString()}</td>
                        <td><strong>{m.itemName}</strong></td>
                        <td>
                          <span className={`badge ${
                            m.movementType === 'Stock In' ? 'text-bg-success' :
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
            </div>
          </div>
        </div>
      )}

      {/* DISPOSE MODAL */}
      {activeModal === 'dispose' && selectedItem && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
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
                    <label className="form-label">Quantity to Dispose *</label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      max={selectedBatch ? selectedBatch.remainingQuantity : undefined}
                      required
                      value={disposeForm.quantity}
                      onChange={(e) => setDisposeForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Reason *</label>
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
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
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
                    <label className="form-label">Quantity to Stock Out *</label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      max={selectedBatch ? selectedBatch.remainingQuantity : undefined}
                      required
                      value={stockOutForm.quantity}
                      onChange={(e) => setStockOutForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Reason *</label>
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
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Borrow Asset — {selectedItem.name}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleBorrowSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Quantity to Borrow *</label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      max={selectedItem.availableQty}
                      required
                      value={borrowForm.quantity}
                      onChange={(e) => setBorrowForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                    />
                    <div className="form-text small text-muted">Available stock: {selectedItem.availableQty}</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Borrowed By *</label>
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
                    <DateInput
                      className="form-control"
                      value={borrowForm.expectedReturnDate}
                      onChange={(e) => setBorrowForm(prev => ({ ...prev, expectedReturnDate: e.target.value }))}
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
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
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
                    <label className="form-label">Quantity Returned *</label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      max={selectedBorrow.quantity}
                      required
                      value={returnForm.quantityReturned}
                      onChange={(e) => setReturnForm(prev => ({ ...prev, quantityReturned: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Return Status / Condition *</label>
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
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
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
                    <DateInput
                      className="form-control"
                      value={editExpiryDate}
                      onChange={(e) => setEditExpiryDate(e.target.value)}
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
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
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
                    <label className="form-label fw-bold">Minimum Stock Level *</label>
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
    </div>
  );
}
