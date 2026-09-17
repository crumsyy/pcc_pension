'use client';

import { useState, useEffect, useMemo } from 'react';
import { LineChart, BarChart, DoughnutChart } from '../../components/ReportsCharts';
import DateInput, { isValidDate, toDbDate, toUiDate } from '../../components/DateInput';

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

  // Server & Data States
  const [reportData, setReportData] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ rooms: [], roomTypes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Table Search, Pagination & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const itemsPerPage = 10;

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
  const fetchReport = async () => {
    if (!dateFrom || !dateTo) return;
    if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
      setError('Please enter valid From and To dates in MM/DD/YYYY format.');
      return;
    }
    setLoading(true);
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
        status: statusFilter
      }).toString();

      const res = await fetch(`/api/admin/reports?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate report');

      setReportData(data.data || null);
      if (data.filterOptions) {
        setFilterOptions(data.filterOptions);
      }
      setCurrentPage(1);
      setSearchTerm('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [report, dateFrom, dateTo, grouping, roomFilter, roomTypeFilter, itemClassification, paymentMethodFilter, statusFilter]);

  // Reset Filters to defaults
  const handleResetFilters = () => {
    setDatePreset('This Month');
    setRoomFilter('');
    setRoomTypeFilter('');
    setItemClassification('All');
    setPaymentMethodFilter('All');
    setStatusFilter('All');
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
      return subTab === 'summary' ? (reportData.salesRows || []) : (reportData.transactionLogs || []);
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
        headers = ['Period', 'Booking Count', 'Gross Revenue (PHP)', 'Discounts (PHP)', 'Net Revenue (PHP)', 'Payment Methods'];
        rows = sortedData.map(r => [r.period, r.bookingCount, r.grossRevenue.toFixed(2), r.discount.toFixed(2), r.netRevenue.toFixed(2), `"${r.paymentMethods}"`]);
      } else {
        headers = ['Transaction ID', 'Date & Time', 'Booking #', 'Billing #', 'Guest Name', 'Room', 'Room Type', 'Payment Method', 'Gross (PHP)', 'Discount (PHP)', 'Net Amount (PHP)'];
        rows = sortedData.map(r => [r.transactionID, `"${r.date}"`, r.bookingID, r.billingID, `"${r.guestName}"`, `"${r.roomNumber}"`, `"${r.roomTypeName}"`, `"${r.paymentMethod}"`, r.grossAmount.toFixed(2), r.discountAmount.toFixed(2), r.netAmount.toFixed(2)]);
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
        headers = ['Date & Time', 'Reference #', 'Item Name', 'Classification', 'Movement Type', 'Quantity', 'Staff User', 'Remarks'];
        rows = sortedData.map(m => [`"${m.movementDateTime}"`, `"${m.referenceNumber || '—'}"`, `"${m.itemName}"`, `"${m.itemClassification}"`, `"${m.movementType}"`, m.quantity, `"${m.userEmail || 'System'}"`, `"${m.remarks || '—'}"`]);
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
            <div class="kpi-label">NET REVENUE</div>
            <div class="kpi-value text-blue">₱${reportData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="kpi-sub">Gross: ₱${reportData.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div class="kpi-card border-green">
            <div class="kpi-label">TOTAL BOOKINGS</div>
            <div class="kpi-value text-green">${reportData.numberBookings}</div>
            <div class="kpi-sub">${reportData.completedBookings} completed stays</div>
          </div>
          <div class="kpi-card border-red">
            <div class="kpi-label">DISCOUNTS APPLIED</div>
            <div class="kpi-value text-red">₱${reportData.discountApplied.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="kpi-sub">Senior / PWD / Privilege Grants</div>
          </div>
          <div class="kpi-card border-purple">
            <div class="kpi-label">PAYMENT SETTLEMENTS</div>
            <div class="kpi-value text-purple" style="font-size: 13px; margin-top: 4px; line-height: 1.4;">
              Cash: ₱${reportData.cashTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}<br />
              GCash: ₱${reportData.gcashTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      `;

      if (subTab === 'summary') {
        tableHeadersHtml = `
          <tr>
            <th style="width: 22%;">Period</th>
            <th class="text-center" style="width: 14%;">Bookings</th>
            <th class="text-right" style="width: 18%;">Gross Revenue</th>
            <th class="text-right" style="width: 16%;">Discounts</th>
            <th class="text-right" style="width: 18%;">Net Revenue</th>
            <th style="width: 12%;">Settlement</th>
          </tr>
        `;
        tableRowsHtml = (reportData.salesRows || []).map(r => `
          <tr>
            <td><strong>${r.period}</strong></td>
            <td class="text-center">${r.bookingCount}</td>
            <td class="text-right">₱${r.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right text-red">-₱${r.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right text-blue bold">₱${r.netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td><span class="badge bg-secondary">${r.paymentMethods || 'Cash'}</span></td>
          </tr>
        `).join('');
      } else {
        tableHeadersHtml = `
          <tr>
            <th style="width: 14%;">Folio / Trx</th>
            <th style="width: 18%;">Date & Time</th>
            <th style="width: 20%;">Guest Full Name</th>
            <th style="width: 10%;">Room</th>
            <th style="width: 10%;">Method</th>
            <th class="text-right" style="width: 14%;">Gross</th>
            <th class="text-right" style="width: 14%;">Net Paid</th>
          </tr>
        `;
        tableRowsHtml = (reportData.transactionLogs || []).map(r => `
          <tr>
            <td><code class="ref-code">#TX-${r.transactionID}</code></td>
            <td>${r.date}</td>
            <td><strong>${r.guestName}</strong></td>
            <td>${r.roomNumber}</td>
            <td><span class="badge bg-secondary">${r.paymentMethod}</span></td>
            <td class="text-right">₱${r.grossAmount.toFixed(2)}</td>
            <td class="text-right text-green bold">₱${r.netAmount.toFixed(2)}</td>
          </tr>
        `).join('');
      }

    } else if (report === 'occupancy') {
      reportTitle = 'Room Occupancy & Utilization Performance Report';
      kpiHtml = `
        <div class="kpi-grid">
          <div class="kpi-card border-green">
            <div class="kpi-label">AVERAGE OCCUPANCY</div>
            <div class="kpi-value text-green">${reportData.averageOccupancy}%</div>
            <div class="kpi-sub">Across reporting window</div>
          </div>
          <div class="kpi-card border-blue">
            <div class="kpi-label">TOTAL ROOMS MANAGED</div>
            <div class="kpi-value text-blue">${reportData.totalRooms} Total</div>
            <div class="kpi-sub">${reportData.occupiedNow} Occupied | ${reportData.availableNow} Available</div>
          </div>
          <div class="kpi-card border-purple">
            <div class="kpi-label">CHECK-INS & TURNOVER</div>
            <div class="kpi-value text-purple">${reportData.checkInsCount}</div>
            <div class="kpi-sub">${reportData.checkOutsCount} check-outs executed</div>
          </div>
          <div class="kpi-card border-orange">
            <div class="kpi-label">PEAK OCCUPANCY DATE</div>
            <div class="kpi-value text-orange">${reportData.peakOccupancyRate}%</div>
            <div class="kpi-sub">Observed on ${reportData.peakOccupancyDate}</div>
          </div>
        </div>
      `;

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
      reportTitle = 'Inventory Management & F&B Movement Audit Report';
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

      if (subTab === 'balances') {
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
        tableHeadersHtml = `
          <tr>
            <th style="width: 18%;">Date & Time</th>
            <th style="width: 14%;">Reference #</th>
            <th style="width: 22%;">Item Description</th>
            <th style="width: 14%;">Movement Type</th>
            <th class="text-center" style="width: 10%;">Quantity</th>
            <th style="width: 22%;">Operator / Remarks</th>
          </tr>
        `;
        tableRowsHtml = (reportData.movements || []).map(m => `
          <tr>
            <td>${new Date(m.movementDateTime).toLocaleString()}</td>
            <td><code class="ref-code">${m.referenceNumber || '—'}</code></td>
            <td><strong>${m.itemName}</strong></td>
            <td>${m.movementType}</td>
            <td class="text-center bold ${m.quantity > 0 ? 'text-green' : 'text-red'}">${m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
            <td>${m.userEmail || 'System'} ${m.remarks ? `<br /><small class="text-muted">${m.remarks}</small>` : ''}</td>
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
    <div className="pb-5">
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
            title: 'Inventory & F&B Movement',
            desc: 'Stock balances, cooked meals vs amenities consumption, low stock alerts, and audit trail.',
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
              onClick={() => setReport(cat.id)}
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
                className={`btn btn-sm mt-3 w-100 fw-semibold ${report === cat.id ? 'btn-dark' : 'btn-outline-secondary'}`}
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
            <label className="form-label small fw-semibold text-muted mb-1 text-truncate">Date Preset</label>
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
            <label className="form-label small fw-semibold text-muted mb-1 text-truncate">From</label>
            <DateInput
              value={dateFrom}
              disabled={datePreset !== 'Custom Range'}
              onChange={(e) => setDateFrom(e.target.value)}
              className="form-control form-control-sm"
              style={{ height: '36px' }}
            />
          </div>

          {/* To Date */}
          <div className="col-6 col-md-2">
            <label className="form-label small fw-semibold text-muted mb-1 text-truncate">To</label>
            <DateInput
              value={dateTo}
              disabled={datePreset !== 'Custom Range'}
              onChange={(e) => setDateTo(e.target.value)}
              className="form-control form-control-sm"
              style={{ height: '36px' }}
            />
          </div>

          {/* Room Filter (Sales, Occupancy, Guests) */}
          {report !== 'inventory' && (
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-muted mb-1 text-truncate">Room Filter</label>
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

          {/* Item Classification Filter (Inventory) */}
          {report === 'inventory' && (
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-muted mb-1 text-truncate">Classification</label>
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

          {/* Payment Method Filter (Sales) */}
          {report === 'sales' && (
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-muted mb-1 text-truncate">Payment Method</label>
              <select
                className="form-select form-select-sm"
                style={{ height: '36px' }}
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
              >
                <option value="All">All Methods</option>
                <option value="Cash">Cash Only</option>
                <option value="GCash">GCash / Online</option>
              </select>
            </div>
          )}

          {/* Grouping Filter (Sales) */}
          {report === 'sales' && (
            <div className="col-6 col-md-1">
              <label className="form-label small fw-semibold text-muted mb-1 text-truncate">Grouping</label>
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
              <label className="form-label small fw-semibold text-muted mb-1 text-truncate">Booking Status</label>
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
          <div className="col-12 col-md-1">
            <label className="form-label small fw-semibold text-muted mb-1 d-none d-md-block invisible">Action</label>
            <button
              className="btn btn-sm btn-pcc-primary text-white w-100 fw-semibold d-flex align-items-center justify-content-center"
              style={{ height: '36px' }}
              onClick={fetchReport}
            >
              Generate
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-pcc-primary" role="status">
            <span className="visually-hidden">Generating Report...</span>
          </div>
          <p className="text-muted mt-2">Gathering database records and calculations...</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger shadow-sm mb-4" role="alert">
          <strong>⚠ Error generating report:</strong> {error}
        </div>
      ) : reportData ? (
        <>
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
                      ₱{reportData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <div className="text-muted small mt-2">
                      Gross: ₱{(reportData.grossRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">BOOKINGS</span>
                    <h3 className="fw-bold text-success mb-0 mt-1">{reportData.numberBookings}</h3>
                    <small className="text-muted">{reportData.completedBookings} completed</small>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">DISCOUNTS VALUE</span>
                    <h3 className="fw-bold text-danger mb-0 mt-1">
                      ₱{reportData.discountApplied.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </h3>
                    <small className="text-muted">Privileges applied</small>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">CASH COLLECTED</span>
                    <h4 className="fw-bold text-dark mb-0 mt-1">
                      ₱{reportData.cashTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </h4>
                    <small className="text-muted">Front desk cash</small>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">GCASH / ONLINE</span>
                    <h4 className="fw-bold text-info mb-0 mt-1">
                      ₱{reportData.gcashTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </h4>
                    <small className="text-muted">Online payment</small>
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
                      {subTab === 'summary' ? `Earnings Breakdown (${grouping})` : 'Payment Transactions Log'}
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
                            <th>Payment Methods</th>
                          </>
                        ) : (
                          <>
                            <th onClick={() => handleSort('transactionID')} style={{ cursor: 'pointer' }}>Trx #</th>
                            <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>Date</th>
                            <th onClick={() => handleSort('guestName')} style={{ cursor: 'pointer' }}>Guest Name</th>
                            <th onClick={() => handleSort('roomNumber')} style={{ cursor: 'pointer' }}>Room</th>
                            <th onClick={() => handleSort('paymentMethod')} style={{ cursor: 'pointer' }}>Method</th>
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
                          <td colSpan="8" className="text-center py-4 text-muted">No records found matching filters.</td>
                        </tr>
                      ) : (
                        paginatedData.map((row, idx) => (
                          <tr key={idx}>
                            {subTab === 'summary' ? (
                              <>
                                <td><strong>{row.period}</strong></td>
                                <td className="text-center">{row.bookingCount}</td>
                                <td className="text-end">₱{row.grossRevenue.toFixed(2)}</td>
                                <td className="text-end text-danger">-₱{row.discount.toFixed(2)}</td>
                                <td className="text-end text-success fw-bold">₱{row.netRevenue.toFixed(2)}</td>
                                <td><span className="badge text-bg-light border text-muted">{row.paymentMethods || 'Cash'}</span></td>
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
              <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-success border-4">
                    <span className="text-muted small fw-bold">AVERAGE OCCUPANCY</span>
                    <h3 className="fw-bold text-success mb-0 mt-1">{reportData.averageOccupancy}%</h3>
                    <div className="progress mt-2" style={{ height: '6px' }}>
                      <div className="progress-bar bg-success" role="progressbar" style={{ width: `${Math.min(100, reportData.averageOccupancy)}%` }}></div>
                    </div>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">ROOMS INVENTORY</span>
                    <h4 className="fw-bold text-dark mb-0 mt-1">{reportData.totalRooms} Total</h4>
                    <div className="text-muted small mt-1">
                      {reportData.occupiedNow} Occupied | {reportData.availableNow} Available
                    </div>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">CHECK-INS & ACTIVITY</span>
                    <h3 className="fw-bold text-primary mb-0 mt-1">{reportData.checkInsCount}</h3>
                    <small className="text-muted">{reportData.checkOutsCount} completed check-outs</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">PEAK OCCUPANCY</span>
                    <h4 className="fw-bold text-warning mb-0 mt-1">{reportData.peakOccupancyRate}%</h4>
                    <small className="text-muted">Recorded on {reportData.peakOccupancyDate}</small>
                  </div>
                </div>
              </div>

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
          {/* REPORT VIEW 3: INVENTORY & F&B MOVEMENT */}
          {/* ================================================================= */}
          {report === 'inventory' && (
            <div>
              {/* Inventory Stats Cards */}
              <div className="row g-3 mb-4">
                <div className="col-12 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-info border-4">
                    <span className="text-muted small fw-bold">MOST USED CONSUMABLE</span>
                    <h4 className="fw-bold text-info mb-0 mt-1 text-truncate">{reportData.mostUsedItem}</h4>
                    <small className="text-muted">{reportData.maxUsed} units consumed</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-danger border-4">
                    <span className="text-muted small fw-bold">LOW STOCK ALERTS</span>
                    <h3 className="fw-bold text-danger mb-0 mt-1">{reportData.lowStockCount || 0}</h3>
                    <small className="text-muted">Items requiring replenishment</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">MOST BORROWED ASSET</span>
                    <h4 className="fw-bold text-success mb-0 mt-1 text-truncate">{reportData.mostBorrowed}</h4>
                    <small className="text-muted">{reportData.maxBorrowed} times borrowed</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">DISPOSED / EXPIRED</span>
                    <h4 className="fw-bold text-warning mb-0 mt-1">{reportData.expiredTotalCount || 0} Expired</h4>
                    <small className="text-muted">{reportData.maxDisposed} units disposed</small>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="card shadow-sm border-0 bg-white rounded">
                <div className="card-header bg-white py-3 border-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="fw-bold text-dark mb-0">
                      {subTab === 'balances' ? 'Inventory Balances & Consumption Status' : 'Stock Movements Audit Trail'}
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
                            <th onClick={() => handleSort('movementDateTime')} style={{ cursor: 'pointer' }}>Date</th>
                            <th onClick={() => handleSort('referenceNumber')} style={{ cursor: 'pointer' }}>Ref #</th>
                            <th onClick={() => handleSort('itemName')} style={{ cursor: 'pointer' }}>Item</th>
                            <th onClick={() => handleSort('itemClassification')} style={{ cursor: 'pointer' }}>Classification</th>
                            <th onClick={() => handleSort('movementType')} style={{ cursor: 'pointer' }}>Type</th>
                            <th className="text-center" onClick={() => handleSort('quantity')} style={{ cursor: 'pointer' }}>Qty</th>
                            <th onClick={() => handleSort('userEmail')} style={{ cursor: 'pointer' }}>Staff User</th>
                            <th>Remarks</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="text-center py-4 text-muted">No inventory records found matching filters.</td>
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
                                <td className="small text-muted">{new Date(row.movementDateTime).toLocaleString()}</td>
                                <td><code>{row.referenceNumber || '—'}</code></td>
                                <td><strong>{row.itemName}</strong></td>
                                <td><span className="badge text-bg-light border text-muted">{row.itemClassification}</span></td>
                                <td>
                                  <span className={`badge ${
                                    row.movementType === 'Stock In' ? 'text-bg-success' :
                                    row.movementType === 'Stock Out' ? 'text-bg-dark' :
                                    row.movementType === 'Borrow' ? 'text-bg-warning' :
                                    row.movementType === 'Return' ? 'text-bg-info' : 'text-bg-danger'
                                  }`}>
                                    {row.movementType}
                                  </span>
                                </td>
                                <td className={`text-center fw-bold ${row.quantity > 0 ? 'text-success' : 'text-danger'}`}>
                                  {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                                </td>
                                <td>{row.userEmail || 'System'}</td>
                                <td>{row.remarks || '—'}</td>
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
                    <h3 className="fw-bold text-dark mb-0 mt-1">{reportData.totalGuestsCount || 0}</h3>
                    <small className="text-muted">{reportData.returningGuestsCount || 0} returning | {reportData.newGuestsCount || 0} new</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">AVG. LENGTH OF STAY</span>
                    <h3 className="fw-bold text-primary mb-0 mt-1">{reportData.averageStayLength || 0} Nights</h3>
                    <small className="text-muted">Across all stay bookings</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">TOTAL RESERVATIONS</span>
                    <h3 className="fw-bold text-success mb-0 mt-1">{reportData.totalReservations || 0}</h3>
                    <small className="text-muted">{reportData.confirmedCount || 0} confirmed | {reportData.cancelledCount || 0} cancelled</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">TOP RETURNING GUEST</span>
                    <h4 className="fw-bold text-warning mb-0 mt-1 text-truncate">{reportData.mostFrequentGuest || '—'}</h4>
                    <small className="text-muted">{reportData.maxVisits || 0} total stays on record</small>
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
        </>
      ) : (
        <div className="text-center py-5 bg-white border rounded shadow-sm">
          <i className="bi bi-file-earmark-bar-graph text-muted" style={{ fontSize: '2.5rem' }}></i>
          <p className="text-muted mt-2">No report data generated. Adjust filters and click Generate.</p>
        </div>
      )}
    </div>
  );
}
