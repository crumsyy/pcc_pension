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
  const [isSubmittingStockIn, setIsSubmittingStockIn] = useState(false);

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
      fetchInventory();
    } catch (err) {
      showAlert('error', 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/admin/inventory/low-stock');
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
  }, [statusFilter, searchVal, dateFilter]);

  useEffect(() => {
    fetchInventory();
    const interval = setInterval(fetchInventory, 5000);
    return () => clearInterval(interval);
  }, []);

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



  const handlePrintPO = (po) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showAlert('error', 'Error', 'Failed to open print window. Please allow popups.');
      return;
    }
    
    const isPartial = po.status === 'Partially Received' || po.items.some(i => (i.quantityReceived || 0) > 0);
    const totalOrdered = po.items.reduce((sum, i) => sum + parseInt(i.quantity || 0), 0);
    const totalReceived = po.items.reduce((sum, i) => sum + parseInt(i.quantityReceived || 0), 0);
    const totalRemaining = Math.max(0, totalOrdered - totalReceived);

    const itemsRows = po.items.map((item, idx) => {
      const rec = parseInt(item.quantityReceived || 0);
      const rem = Math.max(0, parseInt(item.quantity || 0) - rec);
      return `
        <tr>
          <td>${idx + 1}</td>
          <td style="font-weight: bold; color: #111;">${item.itemName}</td>
          <td>${item.itemType}</td>
          <td>${item.itemClassType || 'Consumable'}</td>
          <td style="text-align: right; font-weight: bold;">${item.quantity}</td>
          ${isPartial ? `<td style="text-align: right; color: #28a745; font-weight: bold;">${rec}</td>` : ''}
          ${isPartial ? `<td style="text-align: right; color: ${rem > 0 ? '#dc3545' : '#6c757d'}; font-weight: bold;">${rem}</td>` : ''}
          <td style="text-align: right;">₱${parseFloat(item.unitPrice).toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold; color: #1a3c61;">₱${(parseInt(item.quantity) * parseFloat(item.unitPrice)).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const formattedOrderDate = new Date(po.orderDate).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const formattedDeliveryDate = po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }) : '—';

    printWindow.document.write(`
      <html>
        <head>
          <title>Purchase Order PO-${String(po.purchaseOrderID).padStart(4, '0')}</title>
          <style>
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              color: #333;
              padding: 40px;
              line-height: 1.5;
            }
            .header {
              display: flex;
              justify-content: space-between;
              border-bottom: 3px solid #1a3c61;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .logo-title h1 {
              margin: 0;
              color: #1a3c61;
              font-size: 26px;
              font-weight: 800;
            }
            .logo-title p {
              margin: 5px 0 0 0;
              font-size: 13px;
              color: #666;
            }
            .po-title {
              text-align: right;
            }
            .po-title h2 {
              margin: 0;
              color: #1a3c61;
              font-size: 28px;
              font-weight: 800;
            }
            .po-title p {
              margin: 5px 0 0 0;
              font-size: 15px;
              font-weight: bold;
            }
            .details {
              display: flex;
              justify-content: space-between;
              margin-bottom: 25px;
              background-color: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              border: 1px solid #eee;
            }
            .details-col {
              width: 48%;
            }
            .details-col h3 {
              margin: 0 0 10px 0;
              font-size: 13px;
              text-transform: uppercase;
              color: #555;
              border-bottom: 2px solid #ddd;
              padding-bottom: 5px;
            }
            .details-col p {
              margin: 6px 0;
              font-size: 14px;
            }
            .status-badge-partial {
              display: inline-block;
              background-color: #fff3cd;
              color: #856404;
              border: 1px solid #ffeeba;
              padding: 4px 10px;
              border-radius: 4px;
              font-weight: bold;
              font-size: 13px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 35px;
            }
            th {
              background-color: #1a3c61;
              color: #fff;
              padding: 10px 8px;
              text-align: left;
              font-size: 12px;
              text-transform: uppercase;
            }
            td {
              border-bottom: 1px solid #ddd;
              padding: 10px 8px;
              font-size: 13px;
            }
            .totals {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 60px;
            }
            .totals-table {
              width: 320px;
            }
            .totals-table td {
              border: none;
              padding: 6px 10px;
            }
            .totals-table tr.grand-total td {
              border-top: 2px solid #1a3c61;
              border-bottom: 2px double #1a3c61;
              font-size: 18px;
              font-weight: bold;
              color: #1a3c61;
            }
            .footer {
              display: flex;
              justify-content: space-between;
              margin-top: 100px;
              font-size: 13px;
            }
            .signature-block {
              width: 220px;
              text-align: center;
              border-top: 1.5px solid #000;
              padding-top: 6px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-title">
              <h1>PCC Home Suite Home</h1>
              <p>Osmeña Street, Zone 1, Koronadal City, South Cotabato, Philippines</p>
              <p>Contact: info@pccsuite.com | 09000000000</p>
            </div>
            <div class="po-title">
              <h2>PURCHASE ORDER</h2>
              <p>PO-${String(po.purchaseOrderID).padStart(4, '0')}</p>
            </div>
          </div>
          
          <div class="details">
            <div class="details-col">
              <h3>PO DETAILS</h3>
              <p><strong>Order Date:</strong> ${formattedOrderDate}</p>
              <p><strong>Expected Delivery:</strong> ${formattedDeliveryDate}</p>
              <p><strong>Status:</strong> <span class="${po.status === 'Partially Received' ? 'status-badge-partial' : ''}">${po.status}</span></p>
              ${isPartial ? `<p><strong>Fulfillment:</strong> ${totalReceived} of ${totalOrdered} items received (${totalRemaining} remaining)</p>` : ''}
            </div>
            <div class="details-col">
              <h3>SUPPLIER / REMARKS</h3>
              <p><strong>Supplier:</strong> ${po.supplier || 'PCC Selected Supplier'}</p>
              <p><strong>Remarks:</strong> ${po.remarks || 'No remarks.'}</p>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 4%;">#</th>
                <th style="width: 32%;">Item Name</th>
                <th style="width: 12%;">Category</th>
                <th style="width: 12%;">Type</th>
                <th style="width: 10%; text-align: right;">Ordered</th>
                ${isPartial ? `<th style="width: 10%; text-align: right;">Received</th>` : ''}
                ${isPartial ? `<th style="width: 10%; text-align: right;">Remaining</th>` : ''}
                <th style="width: 10%; text-align: right;">Unit Cost</th>
                <th style="width: 12%; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
          
          <div class="totals">
            <div>
              ${isPartial ? `
                <div style="font-size: 13px; background: #eef2f7; padding: 10px 15px; borderRadius: 6px; border-left: 4px solid #1a3c61;">
                  <strong>Stock-In Summary:</strong><br/>
                  Total Received So Far: <strong>${totalReceived} pcs</strong><br/>
                  Total Remaining to Stock-In: <strong style="color: ${totalRemaining > 0 ? '#dc3545' : '#28a745'}">${totalRemaining} pcs</strong>
                </div>
              ` : ''}
            </div>
            <table class="totals-table">
              <tr class="grand-total">
                <td><strong>Grand Total:</strong></td>
                <td style="text-align: right;"><strong>₱${parseFloat(po.total || 0).toFixed(2)}</strong></td>
              </tr>
            </table>
          </div>
          
          <div class="footer">
            <div>
              <p>Printed on: ${new Date().toLocaleString()}</p>
            </div>
            <div class="signature-block">
              Authorized Signature
            </div>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
    if (poItems.some(item => item.quantity === '' || parseInt(item.quantity || 0) <= 0)) {
      showAlert('error', 'Validation Error', 'Please enter a valid quantity greater than 0 for all items.');
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
    if (isSubmittingStockIn) return;

    for (const itemID in receivedQtys) {
      const val = receivedQtys[itemID];
      const item = selectedOrder.items.find(i => String(i.orderItemID) === String(itemID));
      if (item && parseInt(val.qty || 0) > 0) {
        if (val.expirationDate && val.expirationDate.trim() !== '') {
          if (!isValidDate(val.expirationDate)) {
            showAlert('error', 'Validation Error', `Please enter a valid Expiration Date (MM/DD/YYYY) for item "${item.itemName}".`);
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
        setIsSubmittingStockIn(true);
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

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pcc-inventory-sync'));
          try {
            const bc = new BroadcastChannel('pcc_inventory_sync');
            bc.postMessage({ type: 'STOCK_UPDATED', time: Date.now() });
            bc.close();
          } catch (e) {}
        }
      } catch (err) {
        showAlert('error', 'Error', err.message);
      } finally {
        setIsSubmittingStockIn(false);
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

  const recommendedItems = inventoryItems;

  return (
    <div className="pcc-page-container d-flex flex-column" style={{ height: 'calc(100vh - 90px)', overflow: 'hidden', padding: '1rem' }}>
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

      <div className="d-flex justify-content-between align-items-center mb-3 flex-shrink-0">
        <div>
          <div className="section-eyebrow">Admin</div>
          <h2 className="section-title mb-0">Purchase Orders</h2>
        </div>
        <button className="btn btn-pcc-primary" onClick={openCreateModal}>
          + Create Purchase Order
        </button>
      </div>

      <div className="row g-3 flex-grow-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left Column: PO Table & Filters */}
        <div className="col-lg-8 d-flex flex-column h-100 overflow-hidden" style={{ minHeight: 0 }}>
          {/* Filter */}
          <div className="card-module mb-3 flex-shrink-0" style={{ backgroundColor: "#fff", padding: "1rem 1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)" }}>
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
                <button className="btn btn-pcc-primary text-white w-100" onClick={() => { setStatusFilter(''); setSearchVal(''); setDateFilter(''); }}>
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Purchase Orders Table */}
          <div className="card-module pcc-table-card flex-grow-1 d-flex flex-column overflow-hidden mb-0" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)", minHeight: 0 }}>
            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : (
              <div className="table-responsive flex-grow-1 overflow-auto">
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
                              onPrint={() => handlePrintPO(po)}
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

        {/* Right Column: Recommended Restock */}
        <div className="col-lg-4 d-flex flex-column h-100 overflow-hidden" style={{ minHeight: 0 }}>
          {/* Recommended Restock Panel */}
          <div className="card-module flex-grow-1 d-flex flex-column overflow-hidden mb-0" style={{ backgroundColor: "#fff", padding: "1.25rem", borderRadius: "8px", border: "1px solid var(--pcc-mist)", minHeight: 0 }}>
            <div className="d-flex justify-content-between align-items-center mb-3 flex-shrink-0">
              <h4 className="fw-bold mb-0 text-pcc-blue" style={{ color: 'var(--pcc-blue)', fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                ⚠️ Recommended for Restock
              </h4>
              {recommendedItems.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-pcc-primary text-white py-1 px-2"
                  style={{ fontSize: '0.75rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                  onClick={handleOrderAll}
                >
                  Order All
                </button>
              )}
            </div>
            <div className="flex-grow-1 overflow-auto">
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
                            onChange={(e) => handlePORowChange(idx, 'quantity', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
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
                {selectedOrder.status === 'Received' && selectedOrder.items.some(it => (it.quantityReceived || 0) < it.quantity) && (
                  <button
                    className="btn btn-warning me-auto text-white"
                    onClick={() => handleGenerateReorder(selectedOrder.purchaseOrderID)}
                  >
                    ⚠ Generate Reorder Request
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-pcc-primary text-white"
                  onClick={() => handlePrintPO(selectedOrder)}
                >
                  🖨️ Print
                </button>
                <button className="btn btn-secondary text-white" onClick={() => setActiveModal(null)}>Close</button>
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
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  disabled={isSubmittingStockIn}
                  onClick={() => !isSubmittingStockIn && setActiveModal(null)}
                ></button>
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
                          <th>Ordered / Remaining</th>
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
                              <td>
                                <div>{item.quantity}</div>
                                {remaining < item.quantity ? (
                                  <div className="small text-danger fw-bold">{remaining} remaining</div>
                                ) : (
                                  <div className="small text-muted">{remaining} remaining</div>
                                )}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  min="0"
                                  max={remaining}
                                  required
                                  value={val.qty}
                                  onChange={(e) => handleReceivedQtyChange(item.orderItemID, 'qty', e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
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
                                  onChange={(e) => handleReceivedQtyChange(item.orderItemID, 'unitCost', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
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
                  <button
                    type="submit"
                    className="btn btn-pcc-primary d-inline-flex align-items-center justify-content-center gap-2"
                    disabled={isSubmittingStockIn}
                  >
                    {isSubmittingStockIn ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        <span>Processing Stock-In...</span>
                      </>
                    ) : (
                      'Confirm Stock-In'
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isSubmittingStockIn}
                    onClick={() => setActiveModal(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
