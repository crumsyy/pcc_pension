'use client';

import { useState, useEffect, useMemo } from 'react';
import { LineChart, BarChart, DoughnutChart } from '../../components/ReportsCharts';
import DateInput, { isValidDate, toDbDate, toUiDate } from '../../components/DateInput';
import clientCache, { CACHE_TTL } from '@/lib/clientCache';

export default function AdminReports() {
  // 4 Core Pillar Reports
  const [report, setReport] = useState('sales'); // 'sales' | 'occupancy' | 'inventory' | 'guests'
  const [subTab, setSubTab] = useState('summary'); // varies per report
  const [grouping, setGrouping] = useState('Daily'); // 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'

  // Multi-Criteria Filters
  const [datePreset, setDatePreset] = useState('This Month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [roomFilter, setRoomFilter] = useState(''); // roomID
  const [roomTypeFilter, setRoomTypeFilter] = useState(''); // roomTypeID
  const [itemClassification, setItemClassification] = useState('All'); // 'All' | 'Cooked Meals' | 'Products' | 'Amenities'
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('All'); // 'All' | 'Cash' | 'GCash'
  const [statusFilter, setStatusFilter] = useState('All');
  const [discountFilter, setDiscountFilter] = useState('ALL'); // 'ALL' | 'NONE' | discountName/ID
  const [movementTypeFilter, setMovementTypeFilter] = useState('ALL'); // 'ALL' | 'STOCK_IN' | 'STOCK_OUT'
  const [fulfillmentStatusFilter, setFulfillmentStatusFilter] = useState('ALL'); // 'ALL' | 'ORDERED' | 'DELIVERED'

  const baseCacheKey = `admin-reports:${report}_${dateFrom}_${dateTo}_${grouping}_${roomFilter}_${roomTypeFilter}_${itemClassification}_${paymentMethodFilter}_${statusFilter}_${discountFilter}_${movementTypeFilter}_${fulfillmentStatusFilter}`;
  const cached = clientCache.get(baseCacheKey);

  // Server & Data States
  const [reportData, setReportData] = useState(cached?.data?.reportData || null);
  const [filterOptions, setFilterOptions] = useState(cached?.data?.filterOptions || { rooms: [], roomTypes: [], discounts: [] });
  const [shouldAnimate, setShouldAnimate] = useState(!cached);
  const [error, setError] = useState('');

  // Table Search, Pagination & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const itemsPerPage = 10;

  // Switch report type cleanly without stale schema collisions
  const handleSelectReport = (newReport) => {
    if (newReport === report) return;
    setReport(newReport);
    const nextKey = `admin-reports:${newReport}_${dateFrom}_${dateTo}_${grouping}_${roomFilter}_${roomTypeFilter}_${itemClassification}_${paymentMethodFilter}_${statusFilter}_${discountFilter}_${movementTypeFilter}_${fulfillmentStatusFilter}`;
    const nextCached = clientCache.get(nextKey);
    if (nextCached) {
      setReportData(nextCached.data.reportData);
      if (nextCached.data.filterOptions) setFilterOptions(nextCached.data.filterOptions);
      setShouldAnimate(false);
    } else {
      setReportData(null);
      setShouldAnimate(true);
    }
    setError('');
    setCurrentPage(1);
    setSearchTerm('');
  };

  // Sync subTab whenever main report changes
  useEffect(() => {
    if (report === 'sales') setSubTab('summary');
    else if (report === 'occupancy') setSubTab('trends');
    else if (report === 'inventory') setSubTab('balances');
    else if (report === 'guests') setSubTab('stays');
    setCurrentPage(1);
    setSearchTerm('');
  }, [report]);

  // Preset Date Range Calculation
  const applyPresetDates = (preset) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (preset) {
      case 'Today':
        start = today;
        end = today;
        break;
      case 'Yesterday':
        start.setDate(today.getDate() - 1);
        end.setDate(today.getDate() - 1);
        break;
      case 'Last 7 Days':
        start.setDate(today.getDate() - 6);
        break;
      case 'Last 30 Days':
        start.setDate(today.getDate() - 29);
        break;
      case 'This Month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'Last Month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'This Year':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      case 'Custom Range':
        return; // keeps manual dates unchanged
      default:
        break;
    }

    setDateFrom(toUiDate(start.toISOString().substring(0, 10)));
    setDateTo(toUiDate(end.toISOString().substring(0, 10)));
  };

  useEffect(() => {
    applyPresetDates(datePreset);
  }, [datePreset]);

  // Fetch Report Data from API
  const fetchReport = async (isBackground = false) => {
    if (!dateFrom || !dateTo) return;
    if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
      setError('Please enter valid From and To dates in MM/DD/YYYY format.');
      return;
    }
    setError('');
    try {
      const query = new URLSearchParams({
        report,
        from: toDbDate(dateFrom),
        to: toDbDate(dateTo),
        grouping,
        roomID: roomFilter,
        roomTypeID: roomTypeFilter,
        itemClassification,
        paymentMethod: paymentMethodFilter,
        status: statusFilter,
        discountType: discountFilter,
        movementType: movementTypeFilter,
        fulfillmentStatus: fulfillmentStatusFilter
      }).toString();

      const res = await fetch(`/api/admin/reports?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate report');

      const freshReport = { ...(data.data || {}), _reportType: data.report || report };
      setReportData(freshReport);
      const freshFilters = data.filterOptions || filterOptions;
      if (data.filterOptions) {
        setFilterOptions(data.filterOptions);
      }
      clientCache.set(baseCacheKey, { reportData: freshReport, filterOptions: freshFilters }, CACHE_TTL.REPORTS);
      setCurrentPage(1);
      setSearchTerm('');
    } catch (err) {
      if (!isBackground) setError(err.message);
      else console.warn('Background reports refresh error:', err.message);
    }
  };

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    const entry = clientCache.get(baseCacheKey);
    if (!entry) {
      fetchReport(false);
    } else {
      setReportData(entry.data.reportData);
      if (entry.data.filterOptions) setFilterOptions(entry.data.filterOptions);
      if (entry.isStale) {
        fetchReport(true);
      }
    }
  }, [report, dateFrom, dateTo, grouping, roomFilter, roomTypeFilter, itemClassification, paymentMethodFilter, statusFilter, discountFilter, movementTypeFilter, fulfillmentStatusFilter]);

  // Reset Filters to defaults
  const handleResetFilters = () => {
    setDatePreset('This Month');
    applyPresetDates('This Month');
    setRoomFilter('');
    setRoomTypeFilter('');
    setItemClassification('All');
    setPaymentMethodFilter('All');
    setStatusFilter('All');
    setDiscountFilter('ALL');
    setMovementTypeFilter('ALL');
    setFulfillmentStatusFilter('ALL');
    setGrouping('Daily');
  };

  // Sorting Helper
  const handleSort = (field) => {
    const isAsc = sortField === field && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortField(field);
  };

  // Client Side Filtered and Sorted Table Data
  const currentRawRows = useMemo(() => {
    if (!reportData) return [];

    if (report === 'sales') {
      if (subTab === 'summary') return reportData.salesRows || [];
      if (subTab === 'transactions') return reportData.transactionLogs || [];
      if (subTab === 'orders') return reportData.orderLogs || [];
      if (subTab === 'purchase_orders') return reportData.poLogs || [];
      return reportData.salesRows || [];
    }
    if (report === 'occupancy') {
      return subTab === 'trends' ? (reportData.occupancyTrend || []) : (reportData.roomPerformance || []);
    }
    if (report === 'inventory') {
      return subTab === 'balances' ? (reportData.summaries || []) : (reportData.movements || []);
    }
    if (report === 'guests') {
      return subTab === 'stays' ? (reportData.guestRows || []) : (reportData.reservationRows || []);
    }
    return [];
  }, [reportData, report, subTab]);

  const filteredData = useMemo(() => {
    if (!currentRawRows) return [];
    if (!searchTerm.trim()) return currentRawRows;

    const term = searchTerm.toLowerCase();
    return currentRawRows.filter(row => {
      return Object.values(row).some(val => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }, [currentRawRows, searchTerm]);

  const sortedData = useMemo(() => {
    if (!sortField) return filteredData;
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });
    return sorted;
  }, [filteredData, sortField, sortOrder]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  // SVG Chart Data
  const salesChartData = useMemo(() => {
    if (!reportData || !reportData.salesRows) return [];
    return reportData.salesRows.map(r => ({ label: r.period, value: r.netRevenue }));
  }, [reportData]);

  const occupancyChartData = useMemo(() => {
    if (!reportData || !reportData.occupancyTrend) return [];
    return reportData.occupancyTrend.map(t => ({ label: t.date, value: t.occupancyRate }));
  }, [reportData]);

  const roomUtilChartData = useMemo(() => {
    if (!reportData || !reportData.roomUtilRows) return [];
    return reportData.roomUtilRows.map(ru => ({ label: ru.roomType, value: ru.bookingsCount }));
  }, [reportData]);

  const paymentMethodsChartData = useMemo(() => {
    if (!reportData) return [];
    return [
      { label: 'Cash', value: reportData.cashTotal || 0 },
      { label: 'GCash / Online', value: reportData.gcashTotal || 0 }
    ].filter(item => item.value > 0);
  }, [reportData]);

  // ===========================================================================
  // CSV / EXCEL EXPORT ENGINE
  // ===========================================================================
  const handleExportCSV = () => {
    if (!reportData || sortedData.length === 0) return;
    let headers = [];
    let rows = [];
    const filename = `PCC_Pension_${report.toUpperCase()}_${subTab}_${dateFrom.replace(/\//g, '-')}_to_${dateTo.replace(/\//g, '-')}.csv`;

    if (report === 'sales') {
      if (subTab === 'summary') {
        headers = ['Period', 'Booking Count', 'Gross Revenue (PHP)', 'Discounts (PHP)', 'Net Revenue (PHP)', 'PO Expenses (PHP)', 'Net Profit (PHP)', 'Payment Methods'];
        rows = sortedData.map(r => [r.period, r.bookingCount, (r.grossRevenue || 0).toFixed(2), (r.discount || 0).toFixed(2), (r.netRevenue || 0).toFixed(2), (r.poExpenses || 0).toFixed(2), (r.netProfit || 0).toFixed(2), `"${r.paymentMethods || 'Cash'}"`]);
      } else if (subTab === 'transactions') {
        headers = ['Transaction ID', 'Date & Time', 'Booking #', 'Billing #', 'Guest Name', 'Room', 'Room Type', 'Payment Method', 'Discount Type', 'Gross (PHP)', 'Discount (PHP)', 'Net Amount (PHP)'];
        rows = sortedData.map(r => [r.transactionID, `"${r.date}"`, r.bookingID, r.billingID, `"${r.guestName}"`, `"${r.roomNumber}"`, `"${r.roomTypeName}"`, `"${r.paymentMethod}"`, `"${r.discountType || 'None'}"`, (r.grossAmount || 0).toFixed(2), (r.discountAmount || 0).toFixed(2), (r.netAmount || 0).toFixed(2)]);
      } else if (subTab === 'orders') {
        headers = ['Order ID', 'Date & Time', 'Booking #', 'Guest Name', 'Room', 'Category', 'Item Name', 'Quantity', 'Unit Price (PHP)', 'Total (PHP)', 'Status'];
        rows = sortedData.map(r => [r.orderID, `"${r.date}"`, r.bookingID, `"${r.guestName}"`, `"${r.roomNumber}"`, `"${r.itemType}"`, `"${r.itemName}"`, r.quantity, (r.unitPrice || 0).toFixed(2), (r.totalAmount || 0).toFixed(2), `"${r.orderStatus}"`]);
      } else if (subTab === 'purchase_orders') {
        headers = ['PO #', 'Date', 'Status', 'Total Expense (PHP)', 'Remarks', 'Items'];
        rows = sortedData.map(r => [r.purchaseOrderID, `"${r.date}"`, `"${r.poStatus}"`, (r.totalExpense || 0).toFixed(2), `"${r.remarks}"`, `"${(r.items || []).map(i => `${i.itemName} (x${i.quantity})`).join('; ')}"`]);
      }
    } else if (report === 'occupancy') {
      if (subTab === 'trends') {
        headers = ['Date', 'Occupied Rooms', 'Occupancy Rate (%)'];
        rows = sortedData.map(r => [r.date, r.occupied, r.occupancyRate]);
      } else {
        headers = ['Room Number', 'Floor', 'Room Type', 'Status', 'Standard Rate (PHP)', 'Total Bookings', 'Total Nights Occupied'];
        rows = sortedData.map(r => [r.roomNumber, `"${r.floorName}"`, `"${r.roomTypeName}"`, `"${r.currentStatus}"`, parseFloat(r.standardRate || 0).toFixed(2), r.totalBookings, r.totalNightsOccupied]);
      }
    } else if (report === 'inventory') {
      if (subTab === 'balances') {
        headers = ['Item Name', 'Category', 'Classification', 'Unit', 'Received Qty', 'Used Qty', 'Remaining Stock', 'Expired Qty', 'Disposed Qty', 'Stock Status'];
        rows = sortedData.map(s => [`"${s.itemName}"`, `"${s.category}"`, `"${s.itemClassification}"`, s.unit, s.quantityReceived, s.quantityUsed, s.remainingStock, s.expiredQty, s.disposedQty, s.lowStock ? 'Low Stock' : 'In Stock']);
      } else {
        headers = ['Item Name', 'Category', 'Transaction Type', 'Status', 'Quantity', 'Unit Cost (PHP)', 'Total Value (PHP)', 'Date Recorded', 'Recorded By', 'Reference #', 'Remarks'];
        rows = sortedData.map(m => [
          `"${m.itemName}"`,
          `"${m.category}"`,
          `"${m.transactionType}"`,
          `"${m.status}"`,
          m.quantity,
          (m.unitCost || 0).toFixed(2),
          (m.totalValue || 0).toFixed(2),
          `"${m.dateRecorded ? new Date(m.dateRecorded).toLocaleString() : '—'}"`,
          `"${m.recordedBy || 'System'}"`,
          `"${m.referenceNumber || '—'}"`,
          `"${m.remarks || '—'}"`
        ]);
      }
    } else if (report === 'guests') {
      if (subTab === 'stays') {
        headers = ['Guest Name', 'Email', 'Contact', 'Check-In', 'Check-Out', 'Room Assigned', 'Length of Stay (Nights)', 'Amount Paid (PHP)', 'Discount Applied', 'Status', 'Previous Visits'];
        rows = sortedData.map(g => [`"${g.guestName}"`, `"${g.email}"`, `"${g.contact}"`, g.checkIn, g.checkOut, `"${g.roomNumber}"`, g.lengthOfStay, g.amountPaid.toFixed(2), `"${g.discountApplied}"`, `"${g.bookingStatus}"`, g.previousVisits]);
      } else {
        headers = ['Reservation ID', 'Guest Name', 'Contact', 'Email', 'Room Assigned', 'Room Type', 'Reservation Date', 'Check-In Date', 'Status'];
        rows = sortedData.map(r => [r.reservationID, `"${r.guestName}"`, `"${r.contact}"`, `"${r.email}"`, `"${r.roomNumber}"`, `"${r.roomType}"`, r.reservationDate, r.checkInDate, `"${r.status}"`]);
      }
    }

    if (headers.length === 0) return;

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ===========================================================================
  // PROFESSIONAL HOTEL PMS PDF REPORT GENERATOR (AUTHENTIC A4 DOCUMENT LOOK)
  // ===========================================================================
  const handleExportPDF = () => {
    if (!reportData) return;

    let reportTitle = 'Executive Management Report';
    let kpiHtml = '';
    let tableHeadersHtml = '';
    let tableRowsHtml = '';

    const selectedRoomName = roomFilter
      ? (filterOptions.rooms.find(r => String(r.roomID) === String(roomFilter))?.roomNumber ? `Room ${filterOptions.rooms.find(r => String(r.roomID) === String(roomFilter))?.roomNumber}` : `Room #${roomFilter}`)
      : 'All Active Rooms';

    const docReference = `PCC-REP-${report.toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

    if (report === 'sales') {
      reportTitle = 'Executive Sales & Financial Revenue Report';
      kpiHtml = `
        <div class="kpi-grid">
          <div class="kpi-card border-blue">
            <div class="kpi-label">TOTAL NET REVENUE</div>
            <div class="kpi-value text-blue">₱${(reportData?.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="kpi-sub">Gross: ₱${(reportData?.grossRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card border-red">
            <div class="kpi-label">PURCHASE ORDER EXPENSES</div>
            <div class="kpi-value text-red">₱${(reportData?.totalPoExpenses ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="kpi-sub">${reportData?.poLogs?.length || 0} purchase orders</div>
          </div>
          <div class="kpi-card border-green">
            <div class="kpi-label">NET PROFIT / BALANCE</div>
            <div class="kpi-value text-green">₱${(reportData?.netProfit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="kpi-sub">Net Revenue less PO Expenses</div>
          </div>
          <div class="kpi-card border-purple">
            <div class="kpi-label">GUEST ORDERS</div>
            <div class="kpi-value text-purple" style="font-size: 13px; margin-top: 4px; line-height: 1.4;">
              Meals: ₱${(reportData?.ordersBreakdown?.cookedMealsTotal ?? 0).toLocaleString()}<br />
              Prods: ₱${(reportData?.ordersBreakdown?.productsTotal ?? 0).toLocaleString()} | Amen: ₱${(reportData?.ordersBreakdown?.amenitiesTotal ?? 0).toLocaleString()}
            </div>
            <div class="kpi-sub">Total: ₱${(reportData?.ordersBreakdown?.totalOrdersTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      `;

      if (subTab === 'summary') {
        tableHeadersHtml = `
          <tr>
            <th style="width: 18%;">Period</th>
            <th class="text-center" style="width: 10%;">Bookings</th>
            <th class="text-right" style="width: 14%;">Gross Revenue</th>
            <th class="text-right" style="width: 12%;">Discounts</th>
            <th class="text-right" style="width: 14%;">Net Revenue</th>
            <th class="text-right" style="width: 14%;">PO Expenses</th>
            <th class="text-right" style="width: 14%;">Net Profit</th>
            <th style="width: 10%;">Settlement</th>
          </tr>
        `;
        tableRowsHtml = (reportData.salesRows || []).map(r => `
          <tr>
            <td><strong>${r.period}</strong></td>
            <td class="text-center">${r.bookingCount}</td>
            <td class="text-right">₱${(r.grossRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right text-red">-₱${(r.discount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right text-blue bold">₱${(r.netRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right text-red">₱${(r.poExpenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right text-green bold">₱${(r.netProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td><span class="badge bg-secondary">${r.paymentMethods || 'Cash'}</span></td>
          </tr>
        `).join('');
      } else if (subTab === 'orders') {
        tableHeadersHtml = `
          <tr>
            <th style="width: 12%;">Order #</th>
            <th style="width: 16%;">Date & Time</th>
            <th style="width: 18%;">Guest / Room</th>
            <th style="width: 14%;">Category</th>
            <th style="width: 18%;">Item Name</th>
            <th class="text-center" style="width: 8%;">Qty</th>
            <th class="text-right" style="width: 14%;">Total (PHP)</th>
          </tr>
        `;
        tableRowsHtml = (reportData.orderLogs || []).map(r => `
          <tr>
            <td><code>#ORD-${r.orderID}</code></td>
            <td>${r.date}</td>
            <td><strong>${r.guestName}</strong><br /><small class="text-muted">${r.roomNumber}</small></td>
            <td><span class="badge ${r.itemType === 'Cooked Meal' ? 'bg-warning text-dark' : r.itemType === 'Amenity' ? 'bg-info' : 'bg-primary'}">${r.itemType}</span></td>
            <td>${r.itemName}</td>
            <td class="text-center">${r.quantity}</td>
            <td class="text-right text-green bold">₱${(r.totalAmount || 0).toFixed(2)}</td>
          </tr>
        `).join('');
      } else if (subTab === 'purchase_orders') {
        tableHeadersHtml = `
          <tr>
            <th style="width: 12%;">PO #</th>
            <th style="width: 16%;">Order Date</th>
            <th style="width: 14%;">Status</th>
            <th style="width: 38%;">Items Ordered</th>
            <th class="text-right" style="width: 20%;">Total Expense (PHP)</th>
          </tr>
        `;
        tableRowsHtml = (reportData.poLogs || []).map(r => `
          <tr>
            <td><code>#PO-${r.purchaseOrderID}</code></td>
            <td>${r.date}</td>
            <td><span class="badge ${r.poStatus === 'Received' ? 'bg-success' : 'bg-secondary'}">${r.poStatus}</span></td>
            <td><small>${(r.items || []).map(i => `${i.itemName} (x${i.quantity})`).join(', ')}</small></td>
            <td class="text-right text-red bold">₱${(r.totalExpense || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        `).join('');
      } else {
        tableHeadersHtml = `
          <tr>
            <th style="width: 13%;">Folio / Trx</th>
            <th style="width: 17%;">Date & Time</th>
            <th style="width: 18%;">Guest Full Name</th>
            <th style="width: 9%;">Room</th>
            <th style="width: 9%;">Method</th>
            <th style="width: 12%;">Discount</th>
            <th class="text-right" style="width: 11%;">Gross</th>
            <th class="text-right" style="width: 11%;">Net Paid</th>
          </tr>
        `;
        tableRowsHtml = (reportData.transactionLogs || []).map(r => `
          <tr>
            <td><code class="ref-code">#TX-${r.transactionID}</code></td>
            <td>${r.date}</td>
            <td><strong>${r.guestName}</strong></td>
            <td>${r.roomNumber}</td>
            <td><span class="badge bg-secondary">${r.paymentMethod}</span></td>
            <td><small>${r.discountType || 'None'}</small></td>
            <td class="text-right">₱${r.grossAmount.toFixed(2)}</td>
            <td class="text-right text-green bold">₱${r.netAmount.toFixed(2)}</td>
          </tr>
        `).join('');
      }

    } else if (report === 'occupancy') {
      reportTitle = 'Room Occupancy & Utilization Performance Report';
      if (roomFilter && roomFilter !== 'ALL' && reportData?.selectedRoomMetrics) {
        kpiHtml = `
          <div class="kpi-grid">
            <div class="kpi-card border-green">
              <div class="kpi-label">ROOM OCCUPANCY RATE</div>
              <div class="kpi-value text-green">${reportData.selectedRoomMetrics.occupancyRate}%</div>
              <div class="kpi-sub">Room ${reportData.selectedRoomMetrics.roomNumber} (${reportData.selectedRoomMetrics.roomTypeName})</div>
            </div>
            <div class="kpi-card border-blue">
              <div class="kpi-label">OCCUPIED DAYS</div>
              <div class="kpi-value text-blue">${reportData.selectedRoomMetrics.totalOccupiedDays} Days</div>
              <div class="kpi-sub">Out of ${reportData.selectedRoomMetrics.totalAvailableDays} total days in period</div>
            </div>
            <div class="kpi-card border-purple">
              <div class="kpi-label">AVAILABLE DAYS</div>
              <div class="kpi-value text-purple">${reportData.selectedRoomMetrics.totalAvailableDays - reportData.selectedRoomMetrics.totalOccupiedDays} Days</div>
              <div class="kpi-sub">Status: ${reportData.selectedRoomMetrics.status}</div>
            </div>
            <div class="kpi-card border-orange">
              <div class="kpi-label">OCCUPANCY CALCULATION</div>
              <div class="kpi-value text-orange" style="font-size: 13px; margin-top: 5px;">(${reportData.selectedRoomMetrics.totalOccupiedDays} / ${reportData.selectedRoomMetrics.totalAvailableDays}) × 100</div>
              <div class="kpi-sub">${reportData.selectedRoomMetrics.occupancyRate}% Room Utilization</div>
            </div>
          </div>
        `;
      } else {
        kpiHtml = `
          <div class="kpi-grid">
            <div class="kpi-card border-green">
              <div class="kpi-label">AVERAGE OCCUPANCY</div>
              <div class="kpi-value text-green">${reportData?.averageOccupancy ?? 0}%</div>
              <div class="kpi-sub">Across reporting window</div>
            </div>
            <div class="kpi-card border-blue">
              <div class="kpi-label">TOTAL ROOMS MANAGED</div>
              <div class="kpi-value text-blue">${reportData?.totalRooms ?? 0} Total</div>
              <div class="kpi-sub">${reportData?.occupiedNow ?? 0} Occupied | ${reportData?.availableNow ?? 0} Available</div>
            </div>
            <div class="kpi-card border-purple">
              <div class="kpi-label">CHECK-INS & TURNOVER</div>
              <div class="kpi-value text-purple">${reportData?.checkInsCount ?? 0}</div>
              <div class="kpi-sub">${reportData?.checkOutsCount ?? 0} check-outs executed</div>
            </div>
            <div class="kpi-card border-orange">
              <div class="kpi-label">PEAK OCCUPANCY DATE</div>
              <div class="kpi-value text-orange">${reportData?.peakOccupancyRate ?? 0}%</div>
              <div class="kpi-sub">Observed on ${reportData?.peakOccupancyDate || '—'}</div>
            </div>
          </div>
        `;
      }

      if (subTab === 'trends') {
        tableHeadersHtml = `
          <tr>
            <th style="width: 35%;">Date</th>
            <th class="text-center" style="width: 30%;">Occupied Rooms</th>
            <th class="text-right" style="width: 35%;">Occupancy Rate (%)</th>
          </tr>
        `;
        tableRowsHtml = (reportData.occupancyTrend || []).map(r => `
          <tr>
            <td><strong>${r.date}</strong></td>
            <td class="text-center">${r.occupied}</td>
            <td class="text-right bold text-blue">${r.occupancyRate}%</td>
          </tr>
        `).join('');
      } else {
        tableHeadersHtml = `
          <tr>
            <th style="width: 18%;">Room Number</th>
            <th style="width: 18%;">Floor</th>
            <th style="width: 22%;">Room Type</th>
            <th style="width: 16%;">Current Status</th>
            <th class="text-center" style="width: 13%;">Total Stays</th>
            <th class="text-center" style="width: 13%;">Nights Booked</th>
          </tr>
        `;
        tableRowsHtml = (reportData.roomPerformance || []).map(r => `
          <tr>
            <td><strong>Room ${r.roomNumber}</strong></td>
            <td>${r.floorName}</td>
            <td>${r.roomTypeName}</td>
            <td><span class="badge ${r.currentStatus === 'Available' ? 'bg-success' : r.currentStatus === 'Occupied' ? 'bg-primary' : 'bg-warning'}">${r.currentStatus}</span></td>
            <td class="text-center">${r.totalBookings}</td>
            <td class="text-center bold text-blue">${r.totalNightsOccupied}</td>
          </tr>
        `).join('');
      }

    } else if (report === 'inventory') {
      reportTitle = 'Inventory Management & Stock Audit Report';
      if (subTab === 'balances') {
        kpiHtml = `
          <div class="kpi-grid">
            <div class="kpi-card border-blue">
              <div class="kpi-label">TOTAL STOCK CATALOG</div>
              <div class="kpi-value text-blue">${reportData.summaries?.length || 0} Items</div>
              <div class="kpi-sub">Amenities, F&B & products</div>
            </div>
            <div class="kpi-card border-red">
              <div class="kpi-label">CRITICAL LOW STOCK</div>
              <div class="kpi-value text-red">${reportData.lowStockCount || 0} Items</div>
              <div class="kpi-sub">At or below reorder threshold</div>
            </div>
            <div class="kpi-card border-green">
              <div class="kpi-label">MOST CONSUMED ITEM</div>
              <div class="kpi-value text-green" style="font-size: 14px;">${reportData.mostUsedItem || '—'}</div>
              <div class="kpi-sub">${reportData.maxUsed || 0} units utilized</div>
            </div>
            <div class="kpi-card border-orange">
              <div class="kpi-label">TOTAL DISPOSED / LOSS</div>
              <div class="kpi-value text-orange">${reportData.expiredTotalCount || 0} Qty</div>
              <div class="kpi-sub">Expired or discarded units</div>
            </div>
          </div>
        `;
        tableHeadersHtml = `
          <tr>
            <th style="width: 25%;">Item Description</th>
            <th style="width: 15%;">Category</th>
            <th style="width: 14%;">Classification</th>
            <th class="text-center" style="width: 11%;">Received</th>
            <th class="text-center" style="width: 11%;">Consumed</th>
            <th class="text-center" style="width: 12%;">Current Stock</th>
            <th class="text-center" style="width: 12%;">Inventory Status</th>
          </tr>
        `;
        tableRowsHtml = (reportData.summaries || []).map(s => `
          <tr>
            <td><strong>${s.itemName}</strong></td>
            <td>${s.category}</td>
            <td>${s.itemClassification}</td>
            <td class="text-center">${s.quantityReceived}</td>
            <td class="text-center">${s.quantityUsed}</td>
            <td class="text-center bold ${s.lowStock ? 'text-red' : 'text-green'}">${s.remainingStock} ${s.unit}</td>
            <td class="text-center"><span class="badge ${s.lowStock ? 'bg-danger' : 'bg-success'}">${s.lowStock ? 'LOW STOCK' : 'IN STOCK'}</span></td>
          </tr>
        `).join('');
      } else {
        kpiHtml = `
          <div class="kpi-grid">
            <div class="kpi-card border-orange">
              <div class="kpi-label">ORDERED (PENDING POs)</div>
              <div class="kpi-value text-orange">${reportData.totalOrderedQty ?? 0} Qty</div>
              <div class="kpi-sub">Est. Value: ₱${(reportData.totalOrderedValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="kpi-card border-green">
              <div class="kpi-label">DELIVERED STOCK-IN</div>
              <div class="kpi-value text-green">${reportData.totalDeliveredQty ?? 0} Qty</div>
              <div class="kpi-sub">Value: ₱${(reportData.totalDeliveredValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="kpi-card border-red">
              <div class="kpi-label">STOCK-OUT USAGE</div>
              <div class="kpi-value text-red">${reportData.totalStockOutQty ?? 0} Qty</div>
              <div class="kpi-sub">Outflow: ₱${(reportData.totalStockOutValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div class="kpi-card border-blue">
              <div class="kpi-label">NET MOVEMENT</div>
              <div class="kpi-value text-blue">${(reportData.netMovementQty ?? 0) > 0 ? '+' : ''}${reportData.netMovementQty ?? 0} Qty</div>
              <div class="kpi-sub">Net Value: ₱${(reportData.netMovementValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        `;
        tableHeadersHtml = `
          <tr>
            <th style="width: 20%;">Item Name</th>
            <th style="width: 12%;">Category</th>
            <th style="width: 14%;">Transaction Type</th>
            <th style="width: 10%;">Status</th>
            <th class="text-center" style="width: 8%;">Qty</th>
            <th class="text-right" style="width: 10%;">Unit Cost</th>
            <th class="text-right" style="width: 10%;">Total Value</th>
            <th style="width: 16%;">Date & Staff</th>
          </tr>
        `;
        tableRowsHtml = (reportData.movements || []).map(m => `
          <tr>
            <td><strong>${m.itemName}</strong><br /><small class="text-muted">${m.referenceNumber || '—'}</small></td>
            <td>${m.category}</td>
            <td><span class="badge ${m.transactionType?.includes('Stock-In') ? 'bg-success' : 'bg-secondary'}">${m.transactionType}</span></td>
            <td><span class="badge ${m.status === 'Ordered' ? 'bg-warning' : 'bg-primary'}">${m.status}</span></td>
            <td class="text-center bold">${m.quantity}</td>
            <td class="text-right">₱${(m.unitCost || 0).toFixed(2)}</td>
            <td class="text-right bold">₱${(m.totalValue || 0).toFixed(2)}</td>
            <td>${m.dateRecorded ? new Date(m.dateRecorded).toLocaleDateString() : '—'}<br /><small class="text-muted">${m.recordedBy || 'System'}</small></td>
          </tr>
        `).join('');
      }

    } else if (report === 'guests') {
      reportTitle = 'Guest Stay History & Reservation Activity Report';
      kpiHtml = `
        <div class="kpi-grid">
          <div class="kpi-card border-purple">
            <div class="kpi-label">TOTAL UNIQUE GUESTS</div>
            <div class="kpi-value text-purple">${reportData.totalGuestsCount || 0}</div>
            <div class="kpi-sub">${reportData.returningGuestsCount || 0} repeat | ${reportData.newGuestsCount || 0} new clients</div>
          </div>
          <div class="kpi-card border-blue">
            <div class="kpi-label">AVERAGE STAY DURATION</div>
            <div class="kpi-value text-blue">${reportData.averageStayLength || 0} Nights</div>
            <div class="kpi-sub">Per guest booking folio</div>
          </div>
          <div class="kpi-card border-green">
            <div class="kpi-label">RESERVATION ACTIVITY</div>
            <div class="kpi-value text-green">${reportData.totalReservations || 0} Total</div>
            <div class="kpi-sub">${reportData.confirmedCount || 0} Confirmed | ${reportData.cancelledCount || 0} Cancelled</div>
          </div>
          <div class="kpi-card border-orange">
            <div class="kpi-label">TOP FREQUENT GUEST</div>
            <div class="kpi-value text-orange" style="font-size: 14px;">${reportData.mostFrequentGuest || '—'}</div>
            <div class="kpi-sub">${reportData.maxVisits || 0} recorded hotel stays</div>
          </div>
        </div>
      `;

      if (subTab === 'stays') {
        tableHeadersHtml = `
          <tr>
            <th style="width: 20%;">Guest Full Name</th>
            <th style="width: 18%;">Contact & Email</th>
            <th style="width: 12%;">Assigned Room</th>
            <th style="width: 12%;">Check-In</th>
            <th style="width: 12%;">Check-Out</th>
            <th class="text-center" style="width: 8%;">Nights</th>
            <th class="text-right" style="width: 12%;">Settled Amount</th>
            <th style="width: 6%;">Status</th>
          </tr>
        `;
        tableRowsHtml = (reportData.guestRows || []).map(g => `
          <tr>
            <td><strong>${g.guestName}</strong></td>
            <td>${g.contact}<br /><small class="text-muted">${g.email}</small></td>
            <td>${g.roomNumber}</td>
            <td>${g.checkIn}</td>
            <td>${g.checkOut}</td>
            <td class="text-center">${g.lengthOfStay}</td>
            <td class="text-right bold text-green">₱${g.amountPaid.toFixed(2)}</td>
            <td><span class="badge bg-primary">${g.bookingStatus}</span></td>
          </tr>
        `).join('');
      } else {
        tableHeadersHtml = `
          <tr>
            <th style="width: 12%;">Reservation ID</th>
            <th style="width: 20%;">Guest Full Name</th>
            <th style="width: 16%;">Contact</th>
            <th style="width: 12%;">Room</th>
            <th style="width: 14%;">Room Type</th>
            <th style="width: 14%;">Reservation Date</th>
            <th style="width: 12%;">Status</th>
          </tr>
        `;
        tableRowsHtml = (reportData.reservationRows || []).map(r => `
          <tr>
            <td><code class="ref-code">#RES-${r.reservationID}</code></td>
            <td><strong>${r.guestName}</strong></td>
            <td>${r.contact}</td>
            <td>${r.roomNumber}</td>
            <td>${r.roomType}</td>
            <td>${r.reservationDate}</td>
            <td><span class="badge ${r.status === 'Confirmed' ? 'bg-success' : r.status === 'Cancelled' ? 'bg-danger' : 'bg-warning'}">${r.status}</span></td>
          </tr>
        `).join('');
      }
    }

    const printWindow = window.open('', '_blank', 'width=1150,height=880');
    if (!printWindow) {
      alert('Pop-up was blocked. Please allow pop-ups for this site to export the PDF document.');
      return;
    }

    const generationDateStr = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const criteriaText = report === 'sales'
      ? `Payment: ${paymentMethodFilter} | Grouping: ${grouping}`
      : report === 'inventory'
      ? `Classification: ${itemClassification}`
      : report === 'guests'
      ? `Status: ${statusFilter}`
      : 'Standard Operations';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>${reportTitle} — PCC Home Suite Home</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4 portrait;
              margin: 14mm 15mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background-color: #e2e8f0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              line-height: 1.4;
              font-size: 11px;
            }
            .screen-toolbar {
              background-color: #1e293b;
              color: #f8fafc;
              padding: 10px 20px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              position: sticky;
              top: 0;
              z-index: 9999;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .screen-toolbar-title {
              font-size: 13px;
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .screen-toolbar-btn {
              background: #2563eb;
              color: #ffffff;
              border: none;
              padding: 7px 18px;
              font-size: 12px;
              font-weight: 600;
              border-radius: 4px;
              cursor: pointer;
              transition: background 0.15s ease-in-out;
            }
            .screen-toolbar-btn:hover {
              background: #1d4ed8;
            }
            .screen-toolbar-btn-secondary {
              background: #475569;
              color: #ffffff;
              border: none;
              padding: 7px 14px;
              font-size: 12px;
              font-weight: 500;
              border-radius: 4px;
              cursor: pointer;
              margin-left: 8px;
            }
            .screen-toolbar-btn-secondary:hover {
              background: #334155;
            }
            .page-container {
              padding: 24px 0 40px 0;
            }
            /* A4 Physical Paper Look Sheet */
            .page-document {
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
              padding: 16mm 18mm;
              background: #ffffff;
              box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15), 0 2px 6px rgba(0, 0, 0, 0.08);
              border-radius: 2px;
              position: relative;
            }
            /* Formal Letterhead */
            .letterhead {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 3px double #cbd5e1;
              padding-bottom: 14px;
              margin-bottom: 14px;
            }
            .brand-name {
              font-size: 20px;
              font-weight: 900;
              letter-spacing: 0.8px;
              color: #1e3a8a;
              text-transform: uppercase;
              margin: 0 0 2px 0;
            }
            .brand-sub {
              font-size: 11px;
              font-weight: 600;
              color: #0d9488;
              margin: 0 0 4px 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .brand-contact {
              font-size: 9.5px;
              color: #64748b;
              margin: 0;
              line-height: 1.35;
            }
            .ref-box {
              text-align: right;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 4px;
              padding: 6px 10px;
              min-width: 170px;
            }
            .ref-code {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-size: 10px;
              font-weight: 700;
              color: #1e3a8a;
            }
            .ref-label {
              font-size: 8.5px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.4px;
            }
            /* Document Header & Title */
            .doc-header {
              text-align: center;
              margin-bottom: 14px;
            }
            .doc-title {
              font-size: 16px;
              font-weight: 800;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 0 0 6px 0;
            }
            /* Metadata Grid Box */
            .meta-box {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px 24px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-left: 4px solid #1e3a8a;
              border-radius: 4px;
              padding: 8px 12px;
              margin-bottom: 16px;
              font-size: 10px;
            }
            .meta-item {
              display: flex;
              align-items: baseline;
            }
            .meta-label {
              font-weight: 700;
              color: #475569;
              min-width: 110px;
              text-transform: uppercase;
              font-size: 9px;
            }
            .meta-val {
              color: #0f172a;
              font-weight: 600;
            }
            /* KPI Grid */
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 16px;
            }
            .kpi-card {
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-left-width: 4px;
              border-radius: 4px;
              padding: 8px 10px;
              box-shadow: 0 1px 2px rgba(0,0,0,0.03);
            }
            .border-blue { border-left-color: #2563eb; }
            .border-green { border-left-color: #16a34a; }
            .border-red { border-left-color: #dc2626; }
            .border-purple { border-left-color: #7c3aed; }
            .border-orange { border-left-color: #ea580c; }
            .kpi-label {
              font-size: 8.5px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .kpi-value {
              font-size: 15px;
              font-weight: 800;
              margin: 3px 0 2px 0;
            }
            .kpi-sub {
              font-size: 8.5px;
              color: #94a3b8;
            }
            .text-blue { color: #1e3a8a; }
            .text-green { color: #16a34a; }
            .text-red { color: #dc2626; }
            .text-purple { color: #7c3aed; }
            .text-orange { color: #ea580c; }
            .bold { font-weight: 700; }
            /* Accounting Table */
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              margin-bottom: 20px;
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
            th {
              background-color: #1e3a8a !important;
              color: #ffffff !important;
              font-weight: 700;
              padding: 7px 8px;
              border: 1px solid #1e3a8a;
              font-size: 9.5px;
              text-align: left;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            td {
              padding: 5.5px 8px;
              border: 1px solid #e2e8f0;
              font-size: 9.5px;
              vertical-align: middle;
            }
            tbody tr:nth-child(even) {
              background-color: #f8fafc;
            }
            tbody tr:hover {
              background-color: #f1f5f9;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .badge {
              display: inline-block;
              padding: 2px 6px;
              font-size: 8px;
              font-weight: 700;
              border-radius: 3px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .bg-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
            .bg-danger { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
            .bg-primary { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
            .bg-warning { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
            .bg-secondary { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
            /* Audit Certification & Sign-off */
            .signoff-wrapper {
              margin-top: 32px;
              page-break-inside: avoid;
            }
            .signoff-title {
              font-size: 9.5px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #475569;
              margin-bottom: 18px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
            }
            .signoff-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 50px;
            }
            .signoff-box {
              font-size: 9.5px;
            }
            .signoff-line {
              border-top: 1.5px solid #334155;
              padding-top: 6px;
              margin-top: 40px;
            }
            .signoff-name {
              font-weight: 800;
              color: #0f172a;
              font-size: 10px;
              text-transform: uppercase;
            }
            .signoff-role {
              color: #64748b;
              font-size: 9px;
            }
            .doc-end {
              text-align: center;
              font-size: 9px;
              font-weight: 700;
              letter-spacing: 1px;
              color: #94a3b8;
              margin-top: 24px;
              margin-bottom: 8px;
            }
            .footer-clause {
              font-size: 8px;
              color: #94a3b8;
              text-align: center;
              line-height: 1.4;
              border-top: 1px dashed #cbd5e1;
              padding-top: 8px;
            }
            /* Media Print Optimization for A4 Paper */
            @media print {
              .no-print {
                display: none !important;
              }
              html, body {
                background: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              .page-container {
                padding: 0 !important;
              }
              .page-document {
                width: 100% !important;
                min-height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                border-radius: 0 !important;
              }
              table {
                page-break-inside: auto;
              }
              tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
              thead {
                display: table-header-group;
              }
            }
          </style>
        </head>
        <body>
          <div class="screen-toolbar no-print">
            <div class="screen-toolbar-title">
              <span>📄</span>
              <span>PCC PMS Document Report — A4 Paper Preview</span>
            </div>
            <div>
              <button class="screen-toolbar-btn" onclick="window.print()">
                🖨️ Print / Save as PDF
              </button>
              <button class="screen-toolbar-btn-secondary" onclick="window.close()">
                Close
              </button>
            </div>
          </div>

          <div class="page-container">
            <div class="page-document">
              <!-- Formal Letterhead -->
              <div class="letterhead">
                <div>
                  <div class="brand-name">PCC Home Suite Home</div>
                  <div class="brand-sub">Property & Pension House Management Operations</div>
                  <div class="brand-contact">
                    National Highway, Brgy. Dadiangas East, General Santos City, 9500<br />
                    Tel: (083) 552-8888 | Mobile: +63 917 123 4567 | Email: info@pcchomesuite.com
                  </div>
                </div>
                <div class="ref-box">
                  <div class="ref-label">Official Document Ref</div>
                  <div class="ref-code">${docReference}</div>
                  <div class="ref-label" style="margin-top: 4px;">Security Classification</div>
                  <div style="font-size: 8.5px; font-weight: 700; color: #16a34a;">CONFIDENTIAL / INTERNAL</div>
                </div>
              </div>

              <!-- Document Title -->
              <div class="doc-header">
                <div class="doc-title">${reportTitle}</div>
              </div>

              <!-- Metadata Summary Box -->
              <div class="meta-box">
                <div class="meta-item">
                  <span class="meta-label">Reporting Period:</span>
                  <span class="meta-val">${dateFrom} to ${dateTo}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Date Generated:</span>
                  <span class="meta-val">${generationDateStr}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Target Scope:</span>
                  <span class="meta-val">${selectedRoomName}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Filter Criteria:</span>
                  <span class="meta-val">${criteriaText}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Generated By:</span>
                  <span class="meta-val">System Administrator (Operations)</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Audit Status:</span>
                  <span class="meta-val" style="color: #16a34a;">Active Operational Audit</span>
                </div>
              </div>

              <!-- KPI Summary Cards -->
              ${kpiHtml}

              <!-- Accounting / Data Table -->
              <table>
                <thead>${tableHeadersHtml}</thead>
                <tbody>${tableRowsHtml}</tbody>
              </table>

              <!-- Audit Certification & Sign-off Section -->
              <div class="signoff-wrapper">
                <div class="signoff-title">Administrative Audit & Verification Sign-Off</div>
                <div class="signoff-grid">
                  <div class="signoff-box">
                    <div>Certified Correct & Prepared By:</div>
                    <div class="signoff-line">
                      <div class="signoff-name">System Administrator</div>
                      <div class="signoff-role">Front Office & Administrative Operations</div>
                      <div class="signoff-role">PCC Home Suite Home</div>
                    </div>
                  </div>
                  <div class="signoff-box">
                    <div>Audited & Approved By:</div>
                    <div class="signoff-line">
                      <div class="signoff-name">General Manager / Auditor</div>
                      <div class="signoff-role">Property Administration & Financial Oversight</div>
                      <div class="signoff-role">PCC Pension Administration</div>
                    </div>
                  </div>
                </div>

                <div class="doc-end">*** END OF REPORT — CONFIDENTIAL ***</div>
                <div class="footer-clause">
                  This document contains privileged and confidential operational information belonging to PCC Home Suite Home. 
                  Any unauthorized review, copying, distribution, or disclosure is strictly prohibited. Generated automatically via PCC Pension House Management System on ${generationDateStr}.
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 450);
  };

  return (
    <div className="pb-5 pcc-content-reveal">
      {/* 4 CORE PILLAR REPORT CARDS (REQ076) */}
      <div className="row g-3 mb-4 d-print-none">
        {[
          {
            id: 'sales',
            icon: 'bi-cash-coin',
            title: 'Sales & Financials',
            desc: 'Gross & Net revenue, Cash vs GCash breakdown, discounts, and payment folios.',
            bg: '#2155B5'
          },
          {
            id: 'occupancy',
            icon: 'bi-building-check',
            title: 'Occupancy & Utilization',
            desc: 'Occupancy rates, room-by-room performance, room type demand, and peak dates.',
            bg: '#198754'
          },
          {
            id: 'inventory',
            icon: 'bi-box-seam',
            title: 'Inventory Report',
            desc: 'Stock balances, consumable usage, stock movements audit trail, and replenishment alerts.',
            bg: '#0891b2'
          },
          {
            id: 'guests',
            icon: 'bi-people-fill',
            title: 'Guest History & Reservations',
            desc: 'Guest stay records, repeat visitors, VIP guest spending, and reservation activity.',
            bg: '#7c3aed'
          }
        ].map(cat => (
          <div key={cat.id} className="col-12 col-sm-6 col-lg-3">
            <div
              className="card shadow-sm border-0 h-100 p-3 bg-white border-start border-4"
              style={{
                borderLeftColor: cat.bg,
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                transform: report === cat.id ? 'translateY(-2px)' : 'none',
                boxShadow: report === cat.id ? '0 4px 12px rgba(0,0,0,0.1)' : undefined
              }}
              onClick={() => handleSelectReport(cat.id)}
            >
              <div className="d-flex align-items-center gap-3">
                <div className="rounded p-2 text-white" style={{ backgroundColor: cat.bg }}>
                  <i className={`bi ${cat.icon}`} style={{ fontSize: '1.4rem' }}></i>
                </div>
                <div>
                  <h6 className="fw-bold text-dark mb-0">{cat.title}</h6>
                  <small className="text-muted" style={{ fontSize: '0.75rem' }}>{cat.desc}</small>
                </div>
              </div>
              <button
                type="button"
                className={`btn btn-sm mt-3 w-100 fw-semibold ${report === cat.id ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectReport(cat.id);
                }}
              >
                {report === cat.id ? '✓ Active Report' : 'Select Report'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MULTI-CRITERIA FILTER CONTROL CARD (REQ084) */}
      <div className="card shadow-sm border-0 mb-4 bg-white p-3 d-print-none" style={{ borderRadius: '8px' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="fw-bold mb-0 text-pcc-blue">
            <i className="bi bi-funnel-fill me-1"></i> Multi-Criteria Report Filters
          </h6>
          <button className="btn btn-sm btn-link text-decoration-none text-muted" onClick={handleResetFilters}>
            <i className="bi bi-arrow-counterclockwise me-1"></i> Reset Filters
          </button>
        </div>

        <div className="row g-2 align-items-end">
          {/* Date Presets */}
          <div className="col-6 col-md-2">
            <label className="form-label small fw-semibold text-muted mb-1 text-truncate d-block" style={{ minHeight: '18px' }}>Date Preset</label>
            <select
              className="form-select form-select-sm"
              style={{ height: '36px' }}
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
            >
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="This Month">This Month</option>
              <option value="Last Month">Last Month</option>
              <option value="This Year">This Year</option>
              <option value="Custom Range">Custom Range</option>
            </select>
          </div>

          {/* From Date */}
          <div className="col-6 col-md-2">
            <label className="form-label small fw-semibold text-muted mb-1 text-truncate d-block" style={{ minHeight: '18px' }}>From</label>
            <DateInput
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setDatePreset('Custom Range');
              }}
              className="form-control form-control-sm"
              style={{ height: '36px', margin: 0, marginBottom: 0 }}
            />
          </div>

          {/* To Date */}
          <div className="col-6 col-md-2">
            <label className="form-label small fw-semibold text-muted mb-1 text-truncate d-block" style={{ minHeight: '18px' }}>To</label>
            <DateInput
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setDatePreset('Custom Range');
              }}
              className="form-control form-control-sm"
              style={{ height: '36px', margin: 0, marginBottom: 0 }}
            />
          </div>

          {/* Room Filter (Sales, Occupancy, Guests) */}
          {report !== 'inventory' && (
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-muted mb-1 text-truncate d-block" style={{ minHeight: '18px' }}>
                {report === 'occupancy' ? 'Specific Room' : 'Room'}
              </label>
              <select
                className="form-select form-select-sm"
                style={{ height: '36px' }}
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
              >
                <option value="">All Rooms</option>
                {filterOptions.rooms?.map(r => (
                  <option key={r.roomID} value={r.roomID}>
                    Room {r.roomNumber} ({r.roomTypeName})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Room Type Filter (Occupancy and Sales) */}
          {(report === 'occupancy' || report === 'sales') && (
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-muted mb-1 text-truncate d-block" style={{ minHeight: '18px' }}>Room Type</label>
              <select
                className="form-select form-select-sm"
                style={{ height: '36px' }}
                value={roomTypeFilter}
                onChange={(e) => setRoomTypeFilter(e.target.value)}
              >
                <option value="">All Room Types</option>
                {filterOptions.roomTypes?.map(rt => (
                  <option key={rt.roomTypeID} value={rt.roomTypeID}>
                    {rt.type}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Discount Filter (Sales) */}
          {report === 'sales' && (
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-muted mb-1 text-truncate d-block" style={{ minHeight: '18px' }}>Discount Type</label>
              <select
                className="form-select form-select-sm"
                style={{ height: '36px' }}
                value={discountFilter}
                onChange={(e) => setDiscountFilter(e.target.value)}
              >
                <option value="ALL">All Discounts</option>
                <option value="NONE">No Discount / Full Fare</option>
                {filterOptions.discounts?.map(d => (
                  <option key={d.discountID} value={d.name}>
                    {d.name} ({d.percentage}%)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Item Classification Filter (Inventory & Sales Guest Orders) */}
          {(report === 'inventory' || (report === 'sales' && subTab === 'orders')) && (
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-muted mb-1 text-truncate d-block" style={{ minHeight: '18px' }}>Classification</label>
              <select
                className="form-select form-select-sm"
                style={{ height: '36px' }}
                value={itemClassification}
                onChange={(e) => setItemClassification(e.target.value)}
              >
                <option value="All">All Categories</option>
                <option value="Cooked Meals">🍳 Cooked Meals</option>
                <option value="Products">🥤 Products & Minibar</option>
                <option value="Amenities">🧴 Amenities & Toiletries</option>
              </select>
            </div>
          )}

          {/* Movement Type Filter (Inventory) */}
          {report === 'inventory' && (
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-muted mb-1 text-truncate d-block" style={{ minHeight: '18px' }}>Movement Type</label>
              <select
                className="form-select form-select-sm"
                style={{ height: '36px' }}
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
              >
                <option value="ALL">All Movements</option>
                <option value="STOCK_IN">Stock-In</option>
                <option value="STOCK_OUT">Stock-Out</option>
              </select>
            </div>
          )}

          {/* Fulfillment Status Filter (Inventory) */}
          {report === 'inventory' && (
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-muted mb-1 text-truncate d-block" style={{ minHeight: '18px' }}>Fulfillment Status</label>
              <select
                className="form-select form-select-sm"
                style={{ height: '36px' }}
                value={fulfillmentStatusFilter}
                onChange={(e) => setFulfillmentStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ORDERED">Ordered (Pending POs)</option>
                <option value="DELIVERED">Delivered (Received)</option>
              </select>
            </div>
          )}

          {/* Payment Method Filter (Sales) */}
          {report === 'sales' && (
            <div className="col-6 col-md-1">
              <label className="form-label small fw-semibold text-muted mb-1 text-truncate d-block" style={{ minHeight: '18px' }}>Payment</label>
              <select
                className="form-select form-select-sm"
                style={{ height: '36px' }}
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
              >
                <option value="All">All</option>
                <option value="Cash">Cash</option>
                <option value="GCash">GCash</option>
              </select>
            </div>
          )}

          {/* Grouping Filter (Sales) */}
          {report === 'sales' && (
            <div className="col-6 col-md-1">
              <label className="form-label small fw-semibold text-muted mb-1 text-truncate d-block" style={{ minHeight: '18px' }}>Grouping</label>
              <select
                className="form-select form-select-sm"
                style={{ height: '36px' }}
                value={grouping}
                onChange={(e) => setGrouping(e.target.value)}
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>
          )}

          {/* Status Filter (Guests) */}
          {report === 'guests' && (
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-muted mb-1 text-truncate d-block" style={{ minHeight: '18px' }}>Booking Status</label>
              <select
                className="form-select form-select-sm"
                style={{ height: '36px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Checked In">Checked In</option>
                <option value="Checked Out">Checked Out</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          )}

          {/* Refresh Action */}
          <div className={`col-12 ${report === 'occupancy' ? 'col-md-2' : report === 'inventory' ? 'col-md-2' : report === 'guests' ? 'col-md-2' : 'col-md-2'}`}>
            <label className="form-label small fw-semibold text-muted mb-1 d-none d-md-block invisible" style={{ minHeight: '18px' }}>Action</label>
            <button
              className="btn btn-sm btn-pcc-primary text-white w-100 fw-semibold d-flex align-items-center justify-content-center shadow-xs"
              style={{ height: '36px' }}
              onClick={fetchReport}
            >
              Generate
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger shadow-sm mb-4" role="alert">
          <strong>⚠ Error generating report:</strong> {error}
        </div>
      ) : reportData && reportData._reportType === report ? (
        <div className={shouldAnimate ? 'pcc-content-reveal' : ''}>
          {/* EXPORTS & REPORT SUB-TABS TOOLBAR */}
          <div className="card shadow-sm border-0 bg-white mb-3 p-2 d-print-none">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              {/* Report Sub-Tabs */}
              <div className="btn-group btn-group-sm" role="group">
                {report === 'sales' && (
                  <>
                    <button
                      type="button"
                      className={`btn fw-semibold ${subTab === 'summary' ? 'btn-pcc-primary text-white' : 'btn-outline-secondary'}`}
                      onClick={() => setSubTab('summary')}
                    >
                      <i className="bi bi-graph-up me-1"></i> Period Breakdown & Trends
                    </button>
                    <button
                      type="button"
                      className={`btn fw-semibold ${subTab === 'transactions' ? 'btn-pcc-primary text-white' : 'btn-outline-secondary'}`}
                      onClick={() => setSubTab('transactions')}
                    >
                      <i className="bi bi-receipt me-1"></i> Payment Logs & Folios ({reportData.transactionLogs?.length || 0})
                    </button>
                    <button
                      type="button"
                      className={`btn fw-semibold ${subTab === 'orders' ? 'btn-pcc-primary text-white' : 'btn-outline-secondary'}`}
                      onClick={() => setSubTab('orders')}
                    >
                      <i className="bi bi-cart-check me-1"></i> Guest Orders ({reportData.orderLogs?.length || 0})
                    </button>
                    <button
                      type="button"
                      className={`btn fw-semibold ${subTab === 'purchase_orders' ? 'btn-pcc-primary text-white' : 'btn-outline-secondary'}`}
                      onClick={() => setSubTab('purchase_orders')}
                    >
                      <i className="bi bi-truck me-1"></i> Purchase Orders ({reportData.poLogs?.length || 0})
                    </button>
                  </>
                )}

                {report === 'occupancy' && (
                  <>
                    <button
                      type="button"
                      className={`btn fw-semibold ${subTab === 'trends' ? 'btn-pcc-primary text-white' : 'btn-outline-secondary'}`}
                      onClick={() => setSubTab('trends')}
                    >
                      <i className="bi bi-calendar3 me-1"></i> Daily Trends & Utilization
                    </button>
                    <button
                      type="button"
                      className={`btn fw-semibold ${subTab === 'performance' ? 'btn-pcc-primary text-white' : 'btn-outline-secondary'}`}
                      onClick={() => setSubTab('performance')}
                    >
                      <i className="bi bi-door-open me-1"></i> Room-by-Room Performance ({reportData.roomPerformance?.length || 0})
                    </button>
                  </>
                )}

                {report === 'inventory' && (
                  <>
                    <button
                      type="button"
                      className={`btn fw-semibold ${subTab === 'balances' ? 'btn-pcc-primary text-white' : 'btn-outline-secondary'}`}
                      onClick={() => setSubTab('balances')}
                    >
                      <i className="bi bi-boxes me-1"></i> Stock Balances & Status ({reportData.summaries?.length || 0})
                    </button>
                    <button
                      type="button"
                      className={`btn fw-semibold ${subTab === 'movements' ? 'btn-pcc-primary text-white' : 'btn-outline-secondary'}`}
                      onClick={() => setSubTab('movements')}
                    >
                      <i className="bi bi-clock-history me-1"></i> Stock Movements Trail ({reportData.movements?.length || 0})
                    </button>
                  </>
                )}

                {report === 'guests' && (
                  <>
                    <button
                      type="button"
                      className={`btn fw-semibold ${subTab === 'stays' ? 'btn-pcc-primary text-white' : 'btn-outline-secondary'}`}
                      onClick={() => setSubTab('stays')}
                    >
                      <i className="bi bi-person-check me-1"></i> Guest Stay History ({reportData.guestRows?.length || 0})
                    </button>
                    <button
                      type="button"
                      className={`btn fw-semibold ${subTab === 'reservations' ? 'btn-pcc-primary text-white' : 'btn-outline-secondary'}`}
                      onClick={() => setSubTab('reservations')}
                    >
                      <i className="bi bi-calendar-event me-1"></i> Reservation Activity ({reportData.reservationRows?.length || 0})
                    </button>
                  </>
                )}
              </div>

              {/* Action Buttons: PDF and CSV */}
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-danger text-white fw-semibold d-flex align-items-center gap-1 shadow-sm"
                  onClick={handleExportPDF}
                >
                  <i className="bi bi-file-earmark-pdf-fill"></i> Export / Download PDF
                </button>
                <button
                  className="btn btn-sm btn-success text-white fw-semibold d-flex align-items-center gap-1 shadow-sm"
                  onClick={handleExportCSV}
                >
                  <i className="bi bi-file-earmark-spreadsheet-fill"></i> Export to Excel/CSV
                </button>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* REPORT VIEW 1: SALES & FINANCIALS */}
          {/* ================================================================= */}
          {report === 'sales' && (
            <div>
              {/* Sales Statistics Cards */}
              <div className="row g-3 mb-4">
                <div className="col-12 col-md-4">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-primary border-4">
                    <span className="text-muted small fw-bold">TOTAL NET REVENUE</span>
                    <h3 className="fw-bold text-primary mb-0 mt-1">
                      ₱{(reportData?.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <div className="text-muted small mt-2">
                      Gross: ₱{(reportData?.grossRevenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-danger border-4">
                    <span className="text-muted small fw-bold">PURCHASE ORDER EXPENSES</span>
                    <h3 className="fw-bold text-danger mb-0 mt-1">
                      ₱{(reportData?.totalPoExpenses ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <small className="text-muted mt-2 d-block">
                      {reportData?.poLogs?.length || 0} purchase orders placed/received
                    </small>
                  </div>
                </div>
                <div className="col-6 col-md-4">
                  <div className={`card shadow-sm border-0 p-3 h-100 bg-white border-start ${(reportData?.netProfit ?? 0) >= 0 ? 'border-success' : 'border-danger'} border-4`}>
                    <span className="text-muted small fw-bold">NET OPERATING PROFIT / BALANCE</span>
                    <h3 className={`fw-bold ${(reportData?.netProfit ?? 0) >= 0 ? 'text-success' : 'text-danger'} mb-0 mt-1`}>
                      ₱{(reportData?.netProfit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <small className="text-muted mt-2 d-block">
                      Net Revenue minus PO Procurement Expenses
                    </small>
                  </div>
                </div>

                {/* Second row of KPI summaries */}
                <div className="col-12 col-md-5">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-muted small fw-bold">GUEST ORDERS BREAKDOWN</span>
                      <span className="badge bg-primary-subtle text-primary fw-semibold">
                        Total: ₱{(reportData?.ordersBreakdown?.totalOrdersTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      <span className="badge text-bg-warning text-dark py-2 px-2">
                        🍳 Cooked Meals: ₱{(reportData?.ordersBreakdown?.cookedMealsTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({reportData?.ordersBreakdown?.cookedMealsCount ?? 0} ordered)
                      </span>
                      <span className="badge text-bg-primary py-2 px-2">
                        🥤 Products: ₱{(reportData?.ordersBreakdown?.productsTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({reportData?.ordersBreakdown?.productsCount ?? 0} ordered)
                      </span>
                      <span className="badge text-bg-info text-white py-2 px-2">
                        🧴 Amenities: ₱{(reportData?.ordersBreakdown?.amenitiesTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({reportData?.ordersBreakdown?.amenitiesCount ?? 0} ordered)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">BOOKINGS & DISCOUNTS</span>
                    <h4 className="fw-bold text-dark mb-0 mt-1">{reportData?.numberBookings ?? 0} Bookings</h4>
                    <small className="text-muted">{reportData?.completedBookings ?? 0} completed stays</small>
                    <div className="small text-danger mt-1">
                      Discounts: -₱{(reportData?.discountApplied ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-4">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">PAYMENT SETTLEMENTS</span>
                    <div className="row g-2 mt-1">
                      <div className="col-6">
                        <small className="text-muted d-block">Cash</small>
                        <strong className="text-dark">₱{(reportData?.cashTotal ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                      </div>
                      <div className="col-6">
                        <small className="text-muted d-block">GCash / Online</small>
                        <strong className="text-info">₱{(reportData?.gcashTotal ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sales Charts Row (shown on Summary subTab) */}
              {subTab === 'summary' && (
                <div className="row g-3 mb-4">
                  <div className="col-12 col-lg-8">
                    <div className="card shadow-sm border-0 p-3 bg-white">
                      <LineChart data={salesChartData} title={`Revenue Trend over Time (PHP, Grouped by ${grouping})`} height={220} />
                    </div>
                  </div>
                  <div className="col-12 col-lg-4">
                    <div className="card shadow-sm border-0 p-3 bg-white h-100">
                      <DoughnutChart data={paymentMethodsChartData} title="Revenue by Payment Method" height={180} />
                    </div>
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="card shadow-sm border-0 bg-white rounded">
                <div className="card-header bg-white py-3 border-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="fw-bold text-dark mb-0">
                      {subTab === 'summary'
                        ? `Earnings & Expenses Breakdown (${grouping})`
                        : subTab === 'orders'
                        ? `Guest Orders Breakdown (${filteredData.length} records)`
                        : subTab === 'purchase_orders'
                        ? `Purchase Order Invoices & Expenses (${filteredData.length} records)`
                        : `Payment Transactions Log (${filteredData.length} records)`}
                    </h6>
                    <input
                      type="text"
                      className="form-control form-control-sm w-25"
                      placeholder="Search records..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead>
                      <tr className="table-light">
                        {subTab === 'summary' ? (
                          <>
                            <th onClick={() => handleSort('period')} style={{ cursor: 'pointer' }}>
                              Period <i className="bi bi-arrow-down-up small text-muted"></i>
                            </th>
                            <th className="text-center" onClick={() => handleSort('bookingCount')} style={{ cursor: 'pointer' }}>
                              Booking Count <i className="bi bi-arrow-down-up small text-muted"></i>
                            </th>
                            <th className="text-end" onClick={() => handleSort('grossRevenue')} style={{ cursor: 'pointer' }}>
                              Gross Revenue <i className="bi bi-arrow-down-up small text-muted"></i>
                            </th>
                            <th className="text-end" onClick={() => handleSort('discount')} style={{ cursor: 'pointer' }}>
                              Discounts <i className="bi bi-arrow-down-up small text-muted"></i>
                            </th>
                            <th className="text-end" onClick={() => handleSort('netRevenue')} style={{ cursor: 'pointer' }}>
                              Net Revenue <i className="bi bi-arrow-down-up small text-muted"></i>
                            </th>
                            <th className="text-end" onClick={() => handleSort('poExpenses')} style={{ cursor: 'pointer' }}>
                              PO Expenses <i className="bi bi-arrow-down-up small text-muted"></i>
                            </th>
                            <th className="text-end" onClick={() => handleSort('netProfit')} style={{ cursor: 'pointer' }}>
                              Net Profit <i className="bi bi-arrow-down-up small text-muted"></i>
                            </th>
                            <th>Payment Methods</th>
                          </>
                        ) : subTab === 'orders' ? (
                          <>
                            <th onClick={() => handleSort('orderID')} style={{ cursor: 'pointer' }}>Order #</th>
                            <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>Date & Time</th>
                            <th onClick={() => handleSort('guestName')} style={{ cursor: 'pointer' }}>Guest / Room</th>
                            <th onClick={() => handleSort('itemType')} style={{ cursor: 'pointer' }}>Classification</th>
                            <th onClick={() => handleSort('itemName')} style={{ cursor: 'pointer' }}>Item Name</th>
                            <th className="text-center" onClick={() => handleSort('quantity')} style={{ cursor: 'pointer' }}>Qty</th>
                            <th className="text-end" onClick={() => handleSort('unitPrice')} style={{ cursor: 'pointer' }}>Unit Price</th>
                            <th className="text-end" onClick={() => handleSort('totalAmount')} style={{ cursor: 'pointer' }}>Total Amount</th>
                            <th>Status</th>
                          </>
                        ) : subTab === 'purchase_orders' ? (
                          <>
                            <th onClick={() => handleSort('purchaseOrderID')} style={{ cursor: 'pointer' }}>PO #</th>
                            <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>Order Date</th>
                            <th onClick={() => handleSort('poStatus')} style={{ cursor: 'pointer' }}>Status</th>
                            <th>Remarks / Note</th>
                            <th>Items Breakdown</th>
                            <th className="text-end" onClick={() => handleSort('totalExpense')} style={{ cursor: 'pointer' }}>Total PO Expense</th>
                          </>
                        ) : (
                          <>
                            <th onClick={() => handleSort('transactionID')} style={{ cursor: 'pointer' }}>Trx #</th>
                            <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>Date</th>
                            <th onClick={() => handleSort('guestName')} style={{ cursor: 'pointer' }}>Guest Name</th>
                            <th onClick={() => handleSort('roomNumber')} style={{ cursor: 'pointer' }}>Room</th>
                            <th onClick={() => handleSort('paymentMethod')} style={{ cursor: 'pointer' }}>Method</th>
                            <th onClick={() => handleSort('discountType')} style={{ cursor: 'pointer' }}>Discount Applied</th>
                            <th className="text-end" onClick={() => handleSort('grossAmount')} style={{ cursor: 'pointer' }}>Gross</th>
                            <th className="text-end" onClick={() => handleSort('discountAmount')} style={{ cursor: 'pointer' }}>Discount</th>
                            <th className="text-end" onClick={() => handleSort('netAmount')} style={{ cursor: 'pointer' }}>Net Paid</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.length === 0 ? (
                        <tr>
                          <td colSpan="10" className="text-center py-4 text-muted">No records found matching filters.</td>
                        </tr>
                      ) : (
                        paginatedData.map((row, idx) => (
                          <tr key={idx}>
                            {subTab === 'summary' ? (
                              <>
                                <td><strong>{row.period}</strong></td>
                                <td className="text-center">{row.bookingCount}</td>
                                <td className="text-end">₱{(row.grossRevenue || 0).toFixed(2)}</td>
                                <td className="text-end text-danger">-₱{(row.discount || 0).toFixed(2)}</td>
                                <td className="text-end text-primary fw-semibold">₱{(row.netRevenue || 0).toFixed(2)}</td>
                                <td className="text-end text-danger">₱{(row.poExpenses || 0).toFixed(2)}</td>
                                <td className={`text-end fw-bold ${(row.netProfit || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                                  ₱{(row.netProfit || 0).toFixed(2)}
                                </td>
                                <td><span className="badge text-bg-light border text-muted">{row.paymentMethods || 'Cash'}</span></td>
                              </>
                            ) : subTab === 'orders' ? (
                              <>
                                <td><code>#ORD-{row.orderID}</code></td>
                                <td className="small text-muted">{row.date}</td>
                                <td>
                                  <strong>{row.guestName}</strong>
                                  <div className="small text-muted">{row.roomNumber} ({row.bookingID === 'Walk-in' ? 'Walk-in' : `Booking #${row.bookingID}`})</div>
                                </td>
                                <td>
                                  <span className={`badge ${row.itemType === 'Cooked Meal' ? 'text-bg-warning text-dark' : row.itemType === 'Amenity' ? 'text-bg-info text-white' : 'text-bg-primary'}`}>
                                    {row.itemType === 'Cooked Meal' ? '🍳 Cooked Meal' : row.itemType === 'Amenity' ? '🧴 Amenity' : '🥤 Product'}
                                  </span>
                                </td>
                                <td>
                                  <strong>{row.itemName}</strong>
                                  {row.isComplimentary && <span className="badge text-bg-success ms-1 small">Complimentary</span>}
                                </td>
                                <td className="text-center">{row.quantity}</td>
                                <td className="text-end">₱{(row.unitPrice || 0).toFixed(2)}</td>
                                <td className="text-end fw-bold text-success">₱{(row.totalAmount || 0).toFixed(2)}</td>
                                <td>
                                  <span className={`badge ${row.orderStatus === 'Completed' || row.orderStatus === 'Delivered' ? 'text-bg-success' : row.orderStatus === 'Placed' || row.orderStatus === 'Pending' ? 'text-bg-warning text-dark' : 'text-bg-secondary'}`}>
                                    {row.orderStatus}
                                  </span>
                                </td>
                              </>
                            ) : subTab === 'purchase_orders' ? (
                              <>
                                <td><code>#PO-{row.purchaseOrderID}</code></td>
                                <td className="small text-muted">{row.date}</td>
                                <td>
                                  <span className={`badge ${row.poStatus === 'Received' ? 'text-bg-success' : row.poStatus === 'Partially Received' ? 'text-bg-warning text-dark' : 'text-bg-primary'}`}>
                                    {row.poStatus}
                                  </span>
                                </td>
                                <td><span className="small text-muted">{row.remarks || '—'}</span></td>
                                <td>
                                  <div className="d-flex flex-wrap gap-1">
                                    {(row.items || []).map((it, i) => (
                                      <span key={i} className="badge text-bg-light border">
                                        {it.itemName} ({it.quantityReceived ? `${it.quantityReceived}/${it.quantity}` : it.quantity} @ ₱{it.unitPrice})
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="text-end fw-bold text-danger">₱{(row.totalExpense || 0).toFixed(2)}</td>
                              </>
                            ) : (
                              <>
                                <td><code>#TRX-{row.transactionID}</code></td>
                                <td className="small text-muted">{row.date}</td>
                                <td><strong>{row.guestName}</strong></td>
                                <td>{row.roomNumber}</td>
                                <td>
                                  <span className={`badge ${row.paymentMethod?.toLowerCase().includes('gcash') ? 'text-bg-info' : 'text-bg-secondary'}`}>
                                    {row.paymentMethod}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge ${row.discountType && row.discountType !== 'None' ? 'text-bg-light border text-danger' : 'text-muted'}`}>
                                    {row.discountType || 'None'}
                                  </span>
                                </td>
                                <td className="text-end">₱{row.grossAmount.toFixed(2)}</td>
                                <td className="text-end text-danger">-₱{row.discountAmount.toFixed(2)}</td>
                                <td className="text-end text-success fw-bold">₱{row.netAmount.toFixed(2)}</td>
                              </>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="card-footer bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                    <span className="small text-muted">Showing page {currentPage} of {totalPages} ({sortedData.length} records)</span>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)}>Prev</button>
                      <button className="btn btn-sm btn-outline-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)}>Next</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* REPORT VIEW 2: OCCUPANCY & UTILIZATION */}
          {/* ================================================================= */}
          {report === 'occupancy' && (
            <div>
              {/* Occupancy Stats Cards */}
              {roomFilter && roomFilter !== 'ALL' && reportData?.selectedRoomMetrics ? (
                <div className="row g-3 mb-4">
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-success border-4">
                      <span className="text-muted small fw-bold">ROOM OCCUPANCY RATE</span>
                      <h3 className="fw-bold text-success mb-0 mt-1">{reportData.selectedRoomMetrics.occupancyRate}%</h3>
                      <div className="progress mt-2" style={{ height: '6px' }}>
                        <div className="progress-bar bg-success" role="progressbar" style={{ width: `${Math.min(100, reportData.selectedRoomMetrics.occupancyRate)}%` }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-primary border-4">
                      <span className="text-muted small fw-bold">DAYS OCCUPIED</span>
                      <h3 className="fw-bold text-primary mb-0 mt-1">{reportData.selectedRoomMetrics.totalOccupiedDays} Days</h3>
                      <small className="text-muted">Out of {reportData.selectedRoomMetrics.totalAvailableDays} total days in period</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                      <span className="text-muted small fw-bold">AVAILABLE DAYS</span>
                      <h3 className="fw-bold text-dark mb-0 mt-1">{reportData.selectedRoomMetrics.totalAvailableDays - reportData.selectedRoomMetrics.totalOccupiedDays} Days</h3>
                      <small className="text-muted">Status: <span className="badge text-bg-light border text-muted">{reportData.selectedRoomMetrics.status}</span></small>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                      <span className="text-muted small fw-bold">SELECTED ROOM</span>
                      <h5 className="fw-bold text-dark mb-0 mt-1 text-truncate">Room {reportData.selectedRoomMetrics.roomNumber}</h5>
                      <small className="text-muted">{reportData.selectedRoomMetrics.roomTypeName}</small>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="row g-3 mb-4">
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-success border-4">
                      <span className="text-muted small fw-bold">AVERAGE OCCUPANCY</span>
                      <h3 className="fw-bold text-success mb-0 mt-1">{reportData?.averageOccupancy ?? 0}%</h3>
                      <div className="progress mt-2" style={{ height: '6px' }}>
                        <div className="progress-bar bg-success" role="progressbar" style={{ width: `${Math.min(100, reportData?.averageOccupancy ?? 0)}%` }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                      <span className="text-muted small fw-bold">ROOMS INVENTORY</span>
                      <h4 className="fw-bold text-dark mb-0 mt-1">{reportData?.totalRooms ?? 0} Total</h4>
                      <div className="text-muted small mt-1">
                        {reportData?.occupiedNow ?? 0} Occupied | {reportData?.availableNow ?? 0} Available
                      </div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                      <span className="text-muted small fw-bold">CHECK-INS & ACTIVITY</span>
                      <h3 className="fw-bold text-primary mb-0 mt-1">{reportData?.checkInsCount ?? 0}</h3>
                      <small className="text-muted">{reportData?.checkOutsCount ?? 0} completed check-outs</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                      <span className="text-muted small fw-bold">PEAK OCCUPANCY</span>
                      <h4 className="fw-bold text-warning mb-0 mt-1">{reportData?.peakOccupancyRate ?? 0}%</h4>
                      <small className="text-muted">Recorded on {reportData?.peakOccupancyDate || '—'}</small>
                    </div>
                  </div>
                </div>
              )}

              {/* Occupancy Charts Row (shown on Trends subTab) */}
              {subTab === 'trends' && (
                <div className="row g-3 mb-4">
                  <div className="col-12 col-lg-7">
                    <div className="card shadow-sm border-0 p-3 bg-white h-100">
                      <LineChart data={occupancyChartData} title="Occupancy Rate Daily Trend (%)" height={220} />
                    </div>
                  </div>
                  <div className="col-12 col-lg-5">
                    <div className="card shadow-sm border-0 p-3 bg-white h-100">
                      <BarChart data={roomUtilChartData} title="Utilization by Room Type (Bookings)" color="#2155B5" height={220} />
                    </div>
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="card shadow-sm border-0 bg-white rounded">
                <div className="card-header bg-white py-3 border-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="fw-bold text-dark mb-0">
                      {subTab === 'trends' ? 'Daily Occupancy Rate Logs' : 'Room-by-Room Utilization Details'}
                    </h6>
                    <input
                      type="text"
                      className="form-control form-control-sm w-25"
                      placeholder="Search rooms/dates..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead>
                      <tr className="table-light">
                        {subTab === 'trends' ? (
                          <>
                            <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>Date</th>
                            <th className="text-center" onClick={() => handleSort('occupied')} style={{ cursor: 'pointer' }}>Occupied Rooms</th>
                            <th className="text-end" onClick={() => handleSort('occupancyRate')} style={{ cursor: 'pointer' }}>Occupancy Rate (%)</th>
                          </>
                        ) : (
                          <>
                            <th onClick={() => handleSort('roomNumber')} style={{ cursor: 'pointer' }}>Room Number</th>
                            <th onClick={() => handleSort('floorName')} style={{ cursor: 'pointer' }}>Floor</th>
                            <th onClick={() => handleSort('roomTypeName')} style={{ cursor: 'pointer' }}>Room Type</th>
                            <th onClick={() => handleSort('currentStatus')} style={{ cursor: 'pointer' }}>Current Status</th>
                            <th className="text-end" onClick={() => handleSort('standardRate')} style={{ cursor: 'pointer' }}>Standard Rate</th>
                            <th className="text-center" onClick={() => handleSort('totalBookings')} style={{ cursor: 'pointer' }}>Bookings Count</th>
                            <th className="text-center" onClick={() => handleSort('totalNightsOccupied')} style={{ cursor: 'pointer' }}>Nights Occupied</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-4 text-muted">No occupancy records found matching filters.</td>
                        </tr>
                      ) : (
                        paginatedData.map((row, idx) => (
                          <tr key={idx}>
                            {subTab === 'trends' ? (
                              <>
                                <td><strong>{row.date}</strong></td>
                                <td className="text-center">{row.occupied}</td>
                                <td className="text-end fw-bold text-success">{row.occupancyRate}%</td>
                              </>
                            ) : (
                              <>
                                <td><strong>Room {row.roomNumber}</strong></td>
                                <td>{row.floorName}</td>
                                <td>{row.roomTypeName}</td>
                                <td>
                                  <span className={`badge ${
                                    row.currentStatus === 'Available' ? 'text-bg-success' :
                                    row.currentStatus === 'Occupied' ? 'text-bg-primary' : 'text-bg-warning'
                                  }`}>
                                    {row.currentStatus}
                                  </span>
                                </td>
                                <td className="text-end">₱{parseFloat(row.standardRate || 0).toFixed(2)}</td>
                                <td className="text-center fw-bold">{row.totalBookings}</td>
                                <td className="text-center fw-bold text-primary">{row.totalNightsOccupied}</td>
                              </>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="card-footer bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                    <span className="small text-muted">Showing page {currentPage} of {totalPages} ({sortedData.length} records)</span>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)}>Prev</button>
                      <button className="btn btn-sm btn-outline-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)}>Next</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* REPORT VIEW 3: INVENTORY REPORT */}
          {/* ================================================================= */}
          {report === 'inventory' && (
            <div>
              {/* Inventory Stats Cards */}
              {subTab === 'movements' ? (
                <div className="row g-3 mb-4">
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-warning border-4">
                      <span className="text-muted small fw-bold">ORDERED (PENDING POs)</span>
                      <h3 className="fw-bold text-warning mb-0 mt-1">{reportData?.totalOrderedQty ?? 0} units</h3>
                      <small className="text-muted">Est. Value: ₱{(reportData?.totalOrderedValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-success border-4">
                      <span className="text-muted small fw-bold">DELIVERED STOCK-IN</span>
                      <h3 className="fw-bold text-success mb-0 mt-1">{reportData?.totalDeliveredQty ?? 0} units</h3>
                      <small className="text-muted">Received: ₱{(reportData?.totalDeliveredValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-danger border-4">
                      <span className="text-muted small fw-bold">STOCK-OUT USAGE</span>
                      <h3 className="fw-bold text-danger mb-0 mt-1">{reportData?.totalStockOutQty ?? 0} units</h3>
                      <small className="text-muted">Outflow: ₱{(reportData?.totalStockOutValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-primary border-4">
                      <span className="text-muted small fw-bold">NET MOVEMENT BALANCE</span>
                      <h3 className="fw-bold text-primary mb-0 mt-1">{(reportData?.netMovementQty ?? 0) > 0 ? `+${reportData?.netMovementQty}` : reportData?.netMovementQty ?? 0} units</h3>
                      <small className="text-muted">Net Value: ₱{(reportData?.netMovementValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-info border-4">
                      <span className="text-muted small fw-bold">MOST USED CONSUMABLE</span>
                      <h4 className="fw-bold text-info mb-0 mt-1 text-truncate">{reportData?.mostUsedItem || '—'}</h4>
                      <small className="text-muted">{reportData?.maxUsed ?? 0} units consumed</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-danger border-4">
                      <span className="text-muted small fw-bold">LOW STOCK ALERTS</span>
                      <h3 className="fw-bold text-danger mb-0 mt-1">{reportData?.lowStockCount ?? 0}</h3>
                      <small className="text-muted">Items requiring replenishment</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                      <span className="text-muted small fw-bold">MOST BORROWED ASSET</span>
                      <h4 className="fw-bold text-success mb-0 mt-1 text-truncate">{reportData?.mostBorrowed || '—'}</h4>
                      <small className="text-muted">{reportData?.maxBorrowed ?? 0} times borrowed</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                      <span className="text-muted small fw-bold">DISPOSED / EXPIRED</span>
                      <h4 className="fw-bold text-warning mb-0 mt-1">{reportData?.expiredTotalCount ?? 0} Expired</h4>
                      <small className="text-muted">{reportData?.maxDisposed ?? 0} units disposed</small>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="card shadow-sm border-0 bg-white rounded">
                <div className="card-header bg-white py-3 border-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="fw-bold text-dark mb-0">
                      {subTab === 'balances' ? 'Inventory Balances & Consumption Status' : 'Stock Movements & Purchase Orders Audit Trail'}
                    </h6>
                    <input
                      type="text"
                      className="form-control form-control-sm w-25"
                      placeholder="Search items, references..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead>
                      <tr className="table-light">
                        {subTab === 'balances' ? (
                          <>
                            <th onClick={() => handleSort('itemName')} style={{ cursor: 'pointer' }}>Item Name</th>
                            <th onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>Category</th>
                            <th onClick={() => handleSort('itemClassification')} style={{ cursor: 'pointer' }}>Classification</th>
                            <th className="text-center" onClick={() => handleSort('quantityReceived')} style={{ cursor: 'pointer' }}>Rec'd</th>
                            <th className="text-center" onClick={() => handleSort('quantityUsed')} style={{ cursor: 'pointer' }}>Used</th>
                            <th className="text-center" onClick={() => handleSort('remainingStock')} style={{ cursor: 'pointer' }}>Remaining</th>
                            <th className="text-center" onClick={() => handleSort('expiredQty')} style={{ cursor: 'pointer' }}>Expired</th>
                            <th>Status</th>
                          </>
                        ) : (
                          <>
                            <th onClick={() => handleSort('itemName')} style={{ cursor: 'pointer' }}>Item Name</th>
                            <th onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>Category</th>
                            <th onClick={() => handleSort('transactionType')} style={{ cursor: 'pointer' }}>Transaction Type</th>
                            <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>Status</th>
                            <th className="text-center" onClick={() => handleSort('quantity')} style={{ cursor: 'pointer' }}>Quantity</th>
                            <th className="text-end" onClick={() => handleSort('unitCost')} style={{ cursor: 'pointer' }}>Unit Cost</th>
                            <th className="text-end" onClick={() => handleSort('totalValue')} style={{ cursor: 'pointer' }}>Total Value</th>
                            <th onClick={() => handleSort('dateRecorded')} style={{ cursor: 'pointer' }}>Date Recorded</th>
                            <th onClick={() => handleSort('recordedBy')} style={{ cursor: 'pointer' }}>Recorded By</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.length === 0 ? (
                        <tr>
                          <td colSpan={subTab === 'balances' ? 8 : 9} className="text-center py-4 text-muted">No inventory records found matching filters.</td>
                        </tr>
                      ) : (
                        paginatedData.map((row, idx) => (
                          <tr key={idx}>
                            {subTab === 'balances' ? (
                              <>
                                <td><strong>{row.itemName}</strong></td>
                                <td>{row.category}</td>
                                <td>
                                  <span className={`badge ${
                                    row.itemClassification === 'Cooked Meal' ? 'text-bg-warning' :
                                    row.itemClassification === 'Product' ? 'text-bg-info' : 'text-bg-secondary'
                                  }`}>
                                    {row.itemClassification}
                                  </span>
                                </td>
                                <td className="text-center">{row.quantityReceived}</td>
                                <td className="text-center">{row.quantityUsed}</td>
                                <td className={`text-center fw-bold ${row.lowStock ? 'text-danger' : 'text-success'}`}>
                                  {row.remainingStock} {row.unit}
                                </td>
                                <td className="text-center text-danger">{row.expiredQty > 0 ? row.expiredQty : '—'}</td>
                                <td>
                                  {row.lowStock ? (
                                    <span className="badge text-bg-danger">⚠ Low Stock</span>
                                  ) : (
                                    <span className="badge text-bg-success">In Stock</span>
                                  )}
                                </td>
                              </>
                            ) : (
                              <>
                                <td>
                                  <strong>{row.itemName}</strong>
                                  {row.referenceNumber && row.referenceNumber !== '—' && (
                                    <div className="text-muted small font-monospace" style={{ fontSize: '11px' }}>
                                      {row.referenceNumber}
                                    </div>
                                  )}
                                </td>
                                <td><span className="badge text-bg-light border text-dark">{row.category}</span></td>
                                <td>
                                  <span className={`badge ${
                                    row.transactionType?.includes('Stock-In') ? 'text-bg-success' : 'text-bg-dark'
                                  }`}>
                                    {row.transactionType}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge ${
                                    row.status === 'Ordered' ? 'text-bg-warning text-dark' : 'text-bg-success'
                                  }`}>
                                    {row.status === 'Ordered' ? '🕒 Ordered' : '✓ Delivered'}
                                  </span>
                                </td>
                                <td className={`text-center fw-bold ${row.transactionType?.includes('Stock-In') ? 'text-success' : 'text-danger'}`}>
                                  {row.transactionType?.includes('Stock-In') ? `+${row.quantity}` : `-${row.quantity}`}
                                </td>
                                <td className="text-end font-monospace">₱{(row.unitCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="text-end font-monospace fw-bold">₱{(row.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="small text-muted">{row.dateRecorded ? new Date(row.dateRecorded).toLocaleString() : '—'}</td>
                                <td className="small text-truncate" style={{ maxWidth: '160px' }} title={row.recordedBy}>{row.recordedBy || 'System'}</td>
                              </>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="card-footer bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                    <span className="small text-muted">Showing page {currentPage} of {totalPages} ({sortedData.length} records)</span>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)}>Prev</button>
                      <button className="btn btn-sm btn-outline-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)}>Next</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* REPORT VIEW 4: GUEST HISTORY & RESERVATIONS */}
          {/* ================================================================= */}
          {report === 'guests' && (
            <div>
              {/* Guest Stats Cards */}
              <div className="row g-3 mb-4">
                <div className="col-12 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-purple border-4">
                    <span className="text-muted small fw-bold">UNIQUE GUESTS</span>
                    <h3 className="fw-bold text-dark mb-0 mt-1">{reportData?.totalGuestsCount ?? 0}</h3>
                    <small className="text-muted">{reportData?.returningGuestsCount ?? 0} returning | {reportData?.newGuestsCount ?? 0} new</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">AVG. LENGTH OF STAY</span>
                    <h3 className="fw-bold text-primary mb-0 mt-1">{reportData?.averageStayLength ?? 0} Nights</h3>
                    <small className="text-muted">Across all stay bookings</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">TOTAL RESERVATIONS</span>
                    <h3 className="fw-bold text-success mb-0 mt-1">{reportData?.totalReservations ?? 0}</h3>
                    <small className="text-muted">{reportData?.confirmedCount ?? 0} confirmed | {reportData?.cancelledCount ?? 0} cancelled</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">TOP RETURNING GUEST</span>
                    <h4 className="fw-bold text-warning mb-0 mt-1 text-truncate">{reportData?.mostFrequentGuest || '—'}</h4>
                    <small className="text-muted">{reportData?.maxVisits ?? 0} total stays on record</small>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="card shadow-sm border-0 bg-white rounded">
                <div className="card-header bg-white py-3 border-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="fw-bold text-dark mb-0">
                      {subTab === 'stays' ? 'Guest Stay Records & Spending' : 'Reservation Requests & Activity Log'}
                    </h6>
                    <input
                      type="text"
                      className="form-control form-control-sm w-25"
                      placeholder="Search guest, room, contact..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead>
                      <tr className="table-light">
                        {subTab === 'stays' ? (
                          <>
                            <th onClick={() => handleSort('guestName')} style={{ cursor: 'pointer' }}>Guest Name</th>
                            <th onClick={() => handleSort('contact')} style={{ cursor: 'pointer' }}>Contact Info</th>
                            <th onClick={() => handleSort('roomNumber')} style={{ cursor: 'pointer' }}>Room Assigned</th>
                            <th onClick={() => handleSort('checkIn')} style={{ cursor: 'pointer' }}>Check-In</th>
                            <th onClick={() => handleSort('checkOut')} style={{ cursor: 'pointer' }}>Check-Out</th>
                            <th className="text-center" onClick={() => handleSort('lengthOfStay')} style={{ cursor: 'pointer' }}>Nights</th>
                            <th className="text-end" onClick={() => handleSort('amountPaid')} style={{ cursor: 'pointer' }}>Total Spend</th>
                            <th>Privilege</th>
                            <th>Status</th>
                          </>
                        ) : (
                          <>
                            <th onClick={() => handleSort('reservationID')} style={{ cursor: 'pointer' }}>Ref #</th>
                            <th onClick={() => handleSort('guestName')} style={{ cursor: 'pointer' }}>Guest Name</th>
                            <th onClick={() => handleSort('contact')} style={{ cursor: 'pointer' }}>Contact</th>
                            <th onClick={() => handleSort('roomNumber')} style={{ cursor: 'pointer' }}>Room</th>
                            <th onClick={() => handleSort('roomType')} style={{ cursor: 'pointer' }}>Room Type</th>
                            <th onClick={() => handleSort('reservationDate')} style={{ cursor: 'pointer' }}>Booked On</th>
                            <th onClick={() => handleSort('checkInDate')} style={{ cursor: 'pointer' }}>Check-In Date</th>
                            <th>Status</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="text-center py-4 text-muted">No guest or reservation records found matching filters.</td>
                        </tr>
                      ) : (
                        paginatedData.map((row, idx) => (
                          <tr key={idx}>
                            {subTab === 'stays' ? (
                              <>
                                <td>
                                  <strong>{row.guestName}</strong>
                                  {row.previousVisits > 0 && (
                                    <span className="badge text-bg-warning ms-1" style={{ fontSize: '0.68rem' }}>
                                      {row.previousVisits} prev stay(s)
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {row.contact}<br />
                                  <small className="text-muted">{row.email}</small>
                                </td>
                                <td>{row.roomNumber}</td>
                                <td>{row.checkIn}</td>
                                <td>{row.checkOut}</td>
                                <td className="text-center fw-bold">{row.lengthOfStay}</td>
                                <td className="text-end fw-bold text-success">₱{row.amountPaid.toFixed(2)}</td>
                                <td><span className="badge text-bg-light border text-muted">{row.discountApplied}</span></td>
                                <td><span className="badge text-bg-primary">{row.bookingStatus}</span></td>
                              </>
                            ) : (
                              <>
                                <td><strong>#RES-{row.reservationID}</strong></td>
                                <td>{row.guestName}</td>
                                <td>{row.contact}</td>
                                <td>{row.roomNumber}</td>
                                <td>{row.roomType}</td>
                                <td>{row.reservationDate}</td>
                                <td>{row.checkInDate}</td>
                                <td>
                                  <span className={`badge ${
                                    row.status === 'Confirmed' ? 'text-bg-success' :
                                    row.status === 'Cancelled' ? 'text-bg-danger' : 'text-bg-warning'
                                  }`}>
                                    {row.status}
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="card-footer bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                    <span className="small text-muted">Showing page {currentPage} of {totalPages} ({sortedData.length} records)</span>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)}>Prev</button>
                      <button className="btn btn-sm btn-outline-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)}>Next</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-5 bg-white border rounded shadow-sm">
          <i className="bi bi-file-earmark-bar-graph text-muted" style={{ fontSize: '2.5rem' }}></i>
          <p className="text-muted mt-2">No report data generated. Adjust filters and click Generate.</p>
        </div>
      )}
    </div>
  );
}
