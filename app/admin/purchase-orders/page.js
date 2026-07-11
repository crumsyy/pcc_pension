'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ModalDialog from '../../components/ModalDialog';
import ActionButtons from '../../components/ActionButtons';
import DateInput, { isValidDate, toDbDate, toUiDate } from '../../components/DateInput';

// Searchable Combobox Component (defined outside to prevent unmounting/focus issues)
function Combobox({ options, value, onChange, placeholder, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const filtered = options.filter(opt =>
    opt.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className="position-relative w-100">
      <div className="input-group input-group-sm">
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder={placeholder}
          value={inputValue}
          disabled={disabled}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
            if (e.target.value === '') {
              onChange(null);
            }
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
        />
        <button
          className="btn btn-outline-secondary dropdown-toggle dropdown-toggle-split px-2"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
        />
      </div>
      {isOpen && (
        <ul className="dropdown-menu show w-100 position-absolute shadow-sm" style={{ maxHeight: '200px', overflowY: 'auto', zIndex: 1060 }}>
          {filtered.map(opt => (
            <li key={`${opt.type}-${opt.id}`}>
              <button
                type="button"
                className="dropdown-item btn-sm text-start py-1"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setInputValue(opt.name);
                  setIsOpen(false);
                  onChange(opt);
                }}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <span><strong>{opt.name}</strong></span>
                  <span className="badge text-bg-light border text-muted small">{opt.type}</span>
                </div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="p-2 text-center text-muted small">
              No matching catalog items found.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function AdminPurchaseOrders() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'view' | 'stock_in' | null
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Catalog integration states
  const [catalogItems, setCatalogItems] = useState([]); // [{ id, name, type, itemType, basePrice }]
  const [inventoryItems, setInventoryItems] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [amenityCategories, setAmenityCategories] = useState([]);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickAddTargetRowIndex, setQuickAddTargetRowIndex] = useState(-1);
  const [quickAddForm, setQuickAddForm] = useState({
    name: '',
    price: 0,
    type: 'Product', // 'Product' | 'Amenity'
    categoryID: '',
    minStock: 5,
    itemType: 'Consumable',
    unit: 'pcs',
    description: ''
  });

  // Form states
  const [poItems, setPoItems] = useState([
    { itemName: '', itemType: 'Product', itemClassType: 'Consumable', quantity: 1, unitPrice: 0.00 }
  ]);
  const [receivedQtys, setReceivedQtys] = useState({});
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [supplierName, setSupplierName] = useState('');

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

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const dateVal = dateFilter && isValidDate(dateFilter) ? toDbDate(dateFilter) : '';
      const query = new URLSearchParams({ 
        status: statusFilter,
        search: searchVal,
        date: dateVal
      }).toString();
      const res = await fetch(`/api/admin/purchase-orders?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch purchase orders');

      setOrders(data.orders || []);
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/admin/inventory');
      const data = await res.json();
      if (res.ok) {
        setInventoryItems(data.items || []);
      }
    } catch (e) {
      console.error("Failed to fetch inventory for restock panel:", e);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchInventory();
  }, [statusFilter, searchVal, dateFilter]);

  const fetchCatalog = async () => {
    try {
      const [prodRes, amenRes] = await Promise.all([
        fetch('/api/admin/products'),
        fetch('/api/admin/amenities')
      ]);
      const prodData = await prodRes.json();
      const amenData = await amenRes.json();
      
      const formattedProducts = (prodData.products || [])
        .filter(p => p.catName !== 'Cooked Meals')
        .map(p => ({
          id: p.productID,
          name: p.name,
          type: 'Product',
          itemType: p.itemType,
          basePrice: parseFloat(p.basePrice || 0)
        }));

      const formattedAmenities = (amenData.items || []).map(a => ({
        id: a.amenityID,
        name: a.name,
        type: 'Amenity',
        itemType: a.itemType,
        basePrice: parseFloat(a.basePrice || 0)
      }));

      setCatalogItems([...formattedProducts, ...formattedAmenities]);
      setProductCategories(prodData.categories || []);
      setAmenityCategories(amenData.categories || []);
    } catch (e) {
      console.error("Failed to fetch catalog:", e);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  useEffect(() => {
    if (catalogItems.length > 0) {
      const prefillName = searchParams.get('prefillName');
      const prefillType = searchParams.get('prefillType');
      if (prefillName && prefillType) {
        const found = catalogItems.find(
          c => c.name.toLowerCase() === prefillName.toLowerCase() && c.type.toLowerCase() === prefillType.toLowerCase()
        );
        if (found) {
          setPoItems([
            {
              itemName: found.name,
              itemType: found.type,
              itemClassType: found.itemType,
              unitPrice: found.basePrice,
              quantity: 10
            }
          ]);
          setExpectedDeliveryDate('');
          setActiveModal('create');
          router.replace('/admin/purchase-orders');
        }
      }
    }
  }, [catalogItems, searchParams, router]);

  const handlePORowChangeSelect = (index, selectedItem) => {
    setPoItems(prev => {
      const newItems = [...prev];
      if (selectedItem) {
        newItems[index] = {
          ...newItems[index],
          itemName: selectedItem.name,
          itemType: selectedItem.type,
          itemClassType: selectedItem.itemType,
          unitPrice: selectedItem.basePrice
        };
      } else {
        newItems[index] = {
          itemName: '',
          itemType: 'Product',
          itemClassType: 'Consumable',
          unitPrice: 0.00,
          quantity: newItems[index].quantity || 1
        };
      }
      return newItems;
    });
  };



  const handleStatusChange = (poID, status, msg) => {
    showConfirm('Update Status', msg || `Are you sure you want to update status to ${status}?`, async () => {
      try {
        const res = await fetch('/api/admin/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update_status', poID, status }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update status');

        showAlert('success', 'Success', data.message || `Purchase Order status updated to ${status}.`);
        fetchOrders();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleCreatePOSubmit = async (e) => {
    e.preventDefault();
    if (expectedDeliveryDate && !isValidDate(expectedDeliveryDate)) {
      showAlert('error', 'Validation Error', 'Please enter a valid Expected Delivery Date (MM/DD/YYYY).');
      return;
    }
    if (poItems.some(item => !item.itemName.trim())) {
      showAlert('error', 'Validation Error', 'Item Name is required for all rows.');
      return;
    }

    showConfirm('Create Purchase Order', 'Are you sure you want to create this purchase order?', async () => {
      try {
        const res = await fetch('/api/admin/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_po', items: poItems, expectedDeliveryDate: toDbDate(expectedDeliveryDate) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create PO');

        showAlert('success', 'Success', data.message || 'Purchase Order created successfully.');
        setActiveModal(null);
        fetchOrders();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleStockInSubmit = async (e) => {
    e.preventDefault();

    for (const itemID in receivedQtys) {
      const val = receivedQtys[itemID];
      const item = selectedOrder.items.find(i => String(i.orderItemID) === String(itemID));
      if (item && parseInt(val.qty || 0) > 0) {
        const matchItem = catalogItems.find(c => c.name === item.itemName && c.type === item.itemType);
        const isConsumable = matchItem ? matchItem.itemType === 'Consumable' : true;

        if (isConsumable) {
          if (!val.expirationDate) {
            showAlert('error', 'Validation Error', `Expiration Date is required for consumable item "${item.itemName}".`);
            return;
          }
          if (!isValidDate(val.expirationDate)) {
            showAlert('error', 'Validation Error', `Please enter a valid Expiration Date (MM/DD/YYYY) for consumable item "${item.itemName}".`);
            return;
          }
        }
      }
    }

    const receivedFormatted = {};
    for (const itemID in receivedQtys) {
      const val = receivedQtys[itemID];
      const item = selectedOrder.items.find(i => String(i.orderItemID) === String(itemID));
      const matchItem = catalogItems.find(c => c.name === item?.itemName && c.type === item?.itemType);
      const isConsumable = matchItem ? matchItem.itemType === 'Consumable' : true;

      receivedFormatted[itemID] = {
        qty: parseInt(val.qty || 0),
        unitCost: parseFloat(val.unitCost || 0),
        expirationDate: (isConsumable && val.expirationDate) ? toDbDate(val.expirationDate) : null
      };
    }

    showConfirm('Process Stock In', 'Are you sure you want to process this stock in? This will update the inventory stock levels.', async () => {
      try {
        const res = await fetch('/api/admin/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'stock_in',
            poID: selectedOrder.purchaseOrderID,
            received: receivedFormatted,
            remarks,
            supplier: supplierName
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to complete stock-in');

        showAlert('success', 'Success', data.message || 'Stock In processed successfully.');
        setActiveModal(null);
        fetchOrders();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const handleGenerateReorder = async (poID) => {
    showConfirm('Generate Reorder', 'Are you sure you want to generate a reorder request for items with incomplete deliveries?', async () => {
      try {
        const res = await fetch('/api/admin/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate_reorder',
            poID
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to generate reorder');

        showAlert('success', 'Success', data.message || 'Reorder generated successfully.');
        setActiveModal(null);
        fetchOrders();
      } catch (err) {
        showAlert('error', 'Error', err.message);
      }
    });
  };

  const openCreateModal = () => {
    setPoItems([{ itemName: '', itemType: 'Product', itemClassType: 'Consumable', quantity: 1, unitPrice: 0.00 }]);
    setExpectedDeliveryDate('');
    setActiveModal('create');
  };

  const handleQuickPO = (recommendedItem) => {
    setPoItems([
      {
        itemName: recommendedItem.name,
        itemType: recommendedItem.sourceTable,
        itemClassType: recommendedItem.itemType,
        unitPrice: parseFloat(recommendedItem.basePrice || recommendedItem.price || 0),
        quantity: Math.max(1, (recommendedItem.minStock || 5) - (recommendedItem.availableQty || 0))
      }
    ]);
    setExpectedDeliveryDate('');
    setActiveModal('create');
  };

  const handleOrderAll = () => {
    if (recommendedItems.length === 0) return;
    const prefilledRows = recommendedItems.map(item => ({
      itemName: item.name,
      itemType: item.sourceTable,
      itemClassType: item.itemType,
      unitPrice: parseFloat(item.basePrice || item.price || 0),
      quantity: Math.max(1, (item.minStock || 5) - (item.availableQty || 0))
    }));
    setPoItems(prefilledRows);
    setExpectedDeliveryDate('');
    setActiveModal('create');
  };

  const openViewModal = (po) => {
    setSelectedOrder(po);
    setActiveModal('view');
  };

  const openStockInModal = (po) => {
    setSelectedOrder(po);
    setSupplierName('');
    setRemarks('');
    const initialQtys = {};
    po.items.forEach(item => {
      const remaining = item.quantity - (item.quantityReceived || 0);
      initialQtys[item.orderItemID] = {
        qty: remaining > 0 ? remaining : 0,
        expirationDate: '',
        manufacturingDate: '',
        supplierReference: '',
        unitCost: item.unitPrice || 0
      };
    });
    setReceivedQtys(initialQtys);
    setActiveModal('stock_in');
  };

  const addPORow = () => {
    setPoItems(prev => [...prev, { itemName: '', itemType: 'Product', itemClassType: 'Consumable', quantity: 1, unitPrice: 0.00 }]);
  };

  const handlePORowChange = (index, field, value) => {
    setPoItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  };

  const handleReceivedQtyChange = (orderItemID, field, val) => {
    setReceivedQtys(prev => ({
      ...prev,
      [orderItemID]: {
        ...prev[orderItemID],
        [field]: val
      }
    }));
  };

  const poGrandTotal = poItems.reduce((sum, item) => {
    const qty = parseInt(item.quantity || 0);
    const price = parseFloat(item.unitPrice || 0);
    return sum + (qty * price);
  }, 0);

  const recommendedItems = inventoryItems.filter(item => item.availableQty <= item.minStock);

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
          <h2 className="section-title mb-0">Purchase Orders</h2>
        </div>
        <button className="btn btn-pcc-primary" onClick={openCreateModal}>
          + Create Purchase Order
        </button>
      </div>



      <div className="row g-3">
        <div className="col-lg-8">
          {/* Filter */}
          <div className="card-module mb-3" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label small fw-bold mb-1">Search</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search PO #, item, remarks..."
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-bold mb-1">Status</label>
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Partially Received">Partially Received</option>
                  <option value="Received">Received</option>
                  <option value="Canceled">Canceled</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-bold mb-1">Order Date</label>
                <DateInput
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <button className="btn btn-pcc-outline w-100" onClick={() => { setStatusFilter(''); setSearchVal(''); setDateFilter(''); }}>
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Purchase Orders Table */}
          <div className="card-module" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>PO #</th>
                      <th>Date</th>
                      <th>Items count</th>
                      <th>Total Cost</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-4">
                          No purchase orders found.
                        </td>
                      </tr>
                    ) : (
                      orders.map((po) => (
                        <tr key={po.purchaseOrderID}>
                          <td>
                            <strong>PO-{String(po.purchaseOrderID).padStart(4, '0')}</strong>
                          </td>
                          <td>
                            {new Date(po.orderDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td>{po.itemCount} item(s)</td>
                          <td>₱{parseFloat(po.total || 0).toFixed(2)}</td>
                          <td>
                            <span
                              className={`badge ${
                                po.status === 'Received'
                                  ? 'text-bg-success'
                                  : po.status === 'Partially Received'
                                  ? 'text-bg-primary'
                                  : po.status === 'Canceled'
                                  ? 'text-bg-danger'
                                  : 'text-bg-warning'
                              }`}
                            >
                              {po.status}
                            </span>
                          </td>
                          <td>
                            <ActionButtons
                              onView={() => openViewModal(po)}
                              onCancel={po.status === 'Pending' || po.status === 'Partially Received' ? () => handleStatusChange(po.purchaseOrderID, 'Canceled', 'Cancel this Purchase Order?') : null}
                              onStockIn={po.status === 'Pending' || po.status === 'Partially Received' ? () => openStockInModal(po) : null}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-4">
          {/* Recommended Restock Panel */}
          <div className="card-module h-100" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)", display: 'flex', flexDirection: 'column' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4 className="fw-bold mb-0 text-pcc-blue" style={{ color: 'var(--pcc-blue)', fontSize: '1.25rem' }}>
                ⚠️ Recommended for Restock
              </h4>
              {recommendedItems.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-pcc-primary text-white"
                  style={{ fontSize: '0.8rem' }}
                  onClick={handleOrderAll}
                >
                  Order All
                </button>
              )}
            </div>
            <div className="flex-grow-1 overflow-auto" style={{ maxHeight: '600px' }}>
              {recommendedItems.length === 0 ? (
                <div className="text-center text-muted py-5 small">
                  All items are well stocked.
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {recommendedItems.map((item, idx) => (
                    <div key={idx} className="list-group-item px-0 py-2 border-bottom">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <strong style={{ fontSize: '0.9rem' }}>{item.name}</strong>
                          <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                            Category: {item.category} | Min Threshold: {item.minStock}
                          </div>
                          <div className="fw-semibold text-danger small mt-1" style={{ fontSize: '0.8rem' }}>
                            Current Stock: {item.availableQty} {item.unit}
                          </div>
                          <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                            Base Price: ₱{parseFloat(item.basePrice || item.price || 0).toFixed(2)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-pcc-primary text-white py-1 px-2 mt-1"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => handleQuickPO(item)}
                        >
                          + PO
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================
          MODALS
          ========================================== */}

      {/* CREATE PO MODAL */}
      {activeModal === 'create' && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', overflowY: 'auto' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Create Purchase Order</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleCreatePOSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Expected Delivery Date (Optional)</label>
                    <DateInput
                      className="form-control form-control-sm"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    />
                  </div>
                  <hr />
                  <div className="row g-2 mb-1 small fw-bold text-muted border-bottom pb-1">
                    <div className="col-md-3">Item Name *</div>
                    <div className="col-md-2">Category</div>
                    <div className="col-md-2">Type</div>
                    <div className="col-md-2">Base Price</div>
                    <div className="col-md-2">Qty Ordered *</div>
                    <div className="col-md-1 text-center">Remove</div>
                  </div>
                  <div id="poItemsList" className="mt-2">
                    {poItems.map((item, idx) => (
                      <div className="row g-2 mb-2 align-items-center" key={idx}>
                        <div className="col-md-3">
                          <Combobox
                            options={catalogItems}
                            value={item.itemName}
                            placeholder="Search catalog..."
                            onChange={(selected) => handlePORowChangeSelect(idx, selected)}
                          />
                        </div>
                        <div className="col-md-2">
                          <input
                            type="text"
                            className="form-control form-control-sm bg-light"
                            disabled
                            value={item.itemType}
                          />
                        </div>
                        <div className="col-md-2">
                          <input
                            type="text"
                            className="form-control form-control-sm bg-light"
                            disabled
                            value={item.itemClassType || 'Consumable'}
                          />
                        </div>
                        <div className="col-md-2">
                          <input
                            type="text"
                            className="form-control form-control-sm bg-light"
                            disabled
                            value={item.unitPrice ? `₱${parseFloat(item.unitPrice).toFixed(2)}` : '₱0.00'}
                          />
                        </div>
                        <div className="col-md-2">
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            placeholder="Qty"
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) => handlePORowChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div className="col-md-1 text-center">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger px-2"
                            style={{ padding: '0.15rem 0.5rem' }}
                            disabled={poItems.length <= 1}
                            onClick={() => setPoItems(prev => prev.filter((_, i) => i !== idx))}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-secondary mt-2" onClick={addPORow}>
                    + Add Item
                  </button>
                </div>
                 <div className="modal-footer d-flex justify-content-between align-items-center">
                   <div className="fw-bold text-pcc-blue" style={{ fontSize: '1.1rem' }}>
                     Grand Total: ₱{poGrandTotal.toFixed(2)}
                   </div>
                   <div className="d-flex gap-2">
                     <button type="submit" className="btn btn-pcc-primary">Create Purchase Order</button>
                     <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                   </div>
                 </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* VIEW PO DETAILS MODAL */}
      {activeModal === 'view' && selectedOrder && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">PO-{String(selectedOrder.purchaseOrderID).padStart(4, '0')} Details</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <p className="mb-1"><strong>Order Date:</strong> {new Date(selectedOrder.orderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    <p className="mb-1"><strong>Status:</strong> <span className="badge text-bg-info">{selectedOrder.status}</span></p>
                  </div>
                  <div className="col-md-6">
                    {selectedOrder.expectedDeliveryDate && (
                      <p className="mb-1"><strong>Expected Delivery:</strong> {new Date(selectedOrder.expectedDeliveryDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
                    )}
                    {selectedOrder.remarks && (
                      <p className="mb-1"><strong>Delivery Remarks:</strong> {selectedOrder.remarks}</p>
                    )}
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Type</th>
                        <th>Ordered Qty</th>
                        <th>Received Qty</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item) => (
                        <tr key={item.orderItemID}>
                          <td>{item.itemName}</td>
                          <td>{item.itemType}</td>
                          <td>{item.quantity}</td>
                          <td>{item.quantityReceived || 0}</td>
                          <td>₱{parseFloat(item.unitPrice).toFixed(2)}</td>
                          <td>
                            ₱{parseFloat(item.quantity * item.unitPrice).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="5" className="text-end fw-bold">Total:</td>
                        <td className="fw-bold">₱{parseFloat(selectedOrder.total || 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                {selectedOrder.status === 'Completed' && selectedOrder.items.some(it => (it.quantityReceived || 0) < it.quantity) && (
                  <button
                    className="btn btn-warning me-auto text-white"
                    onClick={() => handleGenerateReorder(selectedOrder.purchaseOrderID)}
                  >
                    ⚠ Generate Reorder Request
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECORD STOCK-IN MODAL */}
      {activeModal === 'stock_in' && selectedOrder && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: 'var(--pcc-blue)', color: '#fff' }}>
                <h5 className="modal-title">Record Stock-In — PO-{String(selectedOrder.purchaseOrderID).padStart(4, '0')}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
              </div>
              <form onSubmit={handleStockInSubmit}>
                <div className="modal-body">
                  <div className="table-responsive mb-3">
                    <table className="table table-sm align-middle" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Category</th>
                          <th>Item Type</th>
                          <th>Ordered</th>
                          <th style={{ width: '100px' }}>Received</th>
                          <th>Exp. Date</th>
                          <th style={{ width: '110px' }}>Unit Cost *</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items.map((item) => {
                          const val = receivedQtys[item.orderItemID] || { qty: 0, expirationDate: '', unitCost: item.unitPrice };
                          const remaining = item.quantity - (item.quantityReceived || 0);
                          const matchItem = catalogItems.find(c => c.name === item.itemName && c.type === item.itemType);
                          const itemClassType = matchItem ? matchItem.itemType : 'Consumable';
                          return (
                            <tr key={item.orderItemID}>
                              <td><strong>{item.itemName}</strong></td>
                              <td><span className="badge text-bg-light border text-muted">{item.itemType}</span></td>
                              <td>
                                <span className={`badge ${itemClassType === 'Consumable' ? 'text-bg-info' : 'text-bg-secondary'}`}>
                                  {itemClassType}
                                </span>
                              </td>
                              <td>{item.quantity}</td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  min="0"
                                  max={remaining}
                                  required
                                  value={val.qty}
                                  onChange={(e) => handleReceivedQtyChange(item.orderItemID, 'qty', parseInt(e.target.value) || 0)}
                                />
                              </td>
                              <td>
                                {itemClassType === 'Consumable' ? (
                                  <DateInput
                                    className="form-control form-control-sm"
                                    value={val.expirationDate || ''}
                                    onChange={(e) => handleReceivedQtyChange(item.orderItemID, 'expirationDate', e.target.value)}
                                  />
                                ) : (
                                  <span className="text-muted small">N/A</span>
                                )}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="form-control form-control-sm"
                                  required
                                  value={val.unitCost}
                                  onChange={(e) => handleReceivedQtyChange(item.orderItemID, 'unitCost', parseFloat(e.target.value) || 0)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Delivery Remarks</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      placeholder="e.g. Received partial batch..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="submit" className="btn btn-pcc-primary">Confirm Stock-In</button>
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
