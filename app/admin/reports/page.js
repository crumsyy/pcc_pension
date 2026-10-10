'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, BarChart, DoughnutChart } from '../../components/ReportsCharts';
import FlatDatePicker from '../../components/FlatDatePicker';
import AdminPagination from '../../components/AdminPagination';
import HeaderWidgetBoundary from '../../components/HeaderWidgetBoundary';
import { Tabs, TabList, Tab } from '@/components/ui/tabs';
import { isValidDate, toDbDate, toUiDate } from '../../components/DateInput';
import clientCache, { CACHE_TTL } from '@/lib/clientCache';
import { showToast } from '@/lib/toast';

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
  // AbortController: only the latest request may commit state, so rapid
  // report/filter switches can never pile up full-dataset loads.
  const reportAbort = useRef(null);
  const fetchReport = async (isBackground = false) => {
    if (!dateFrom || !dateTo) return;
    if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
      setError('Please enter valid From and To dates in MM/DD/YYYY format.');
      return;
    }
    if (reportAbort.current) {
      try { reportAbort.current.abort(); } catch (e) {}
    }
    const controller = new AbortController();
    reportAbort.current = controller;
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

      const res = await fetch(`/api/admin/reports?${query}`, { signal: controller.signal });
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
      if (err && err.name === 'AbortError') return;
      if (!isBackground) setError(err.message);
      else console.warn('Background reports refresh error:', err.message);
    }
  };

  useEffect(() => {
    return () => {
      if (reportAbort.current) {
        try { reportAbort.current.abort(); } catch (e) {}
      }
    };
  }, []);

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
  // PROFESSIONAL EXPORTS: native PDF (@react-pdf/renderer) + genuine .xlsx (exceljs)
  // Scope: ALL rows matching server-side filters (search box ignored per spec),
  // honoring the current sort. Totals/KPIs come from reportData (API source of
  // truth, same values as the on-screen cards). No screenshots, no window.print.
  // ===========================================================================
  const [isExporting, setIsExporting] = useState(null); // null | 'pdf' | 'excel'

  // Full-filter export set: raw server-filtered rows + current sort, no search, no pagination.
  const exportRows = useMemo(() => {
    if (!currentRawRows) return [];
    if (!sortField) return [...currentRawRows];
    const sorted = [...currentRawRows];
    sorted.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB ?? '')
          : (valB ?? '').localeCompare(valA);
      }
      return sortOrder === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });
    return sorted;
  }, [currentRawRows, sortField, sortOrder]);

  const exportFilters = {
    dateFrom, dateTo, grouping, roomFilter, roomTypeFilter, itemClassification,
    paymentMethodFilter, statusFilter, discountFilter, movementTypeFilter,
    fulfillmentStatusFilter,
  };

  const handleExportExcel = async () => {
    if (!reportData) {
      showToast.warning('No report data to export yet. Generate a report first.');
      return;
    }
    if (exportRows.length === 0) {
      showToast.info('No records match the selected filters - nothing to export.');
      return;
    }
    setIsExporting('excel');
    try {
      const { exportReportExcel } = await import('@/lib/reports/exportExcel');
      const result = await exportReportExcel({
        report, subTab, rows: exportRows, reportData, filters: exportFilters,
      });
      showToast.success(`Excel exported: ${result.fileName} (${result.count} records)`);
    } catch (err) {
      console.error('Excel export failed:', err);
      showToast.error(err?.message || 'Excel export failed. Please try again.');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPDF = async () => {
    if (!reportData) {
      showToast.warning('No report data to export yet. Generate a report first.');
      return;
    }
    if (exportRows.length === 0) {
      showToast.info('No records match the selected filters - nothing to export.');
      return;
    }
    setIsExporting('pdf');
    try {
      const { exportReportPdf } = await import('@/lib/reports/exportPdf');
      const result = await exportReportPdf({
        report, subTab, rows: exportRows, reportData, filters: exportFilters,
      });
      showToast.success(`PDF exported: ${result.fileName} (${result.count} records)`);
    } catch (err) {
      console.error('PDF export failed:', err);
      showToast.error(err?.message || 'PDF export failed. Please try again.');
    } finally {
      setIsExporting(null);
    }
  };


  return (
    <div className="pb-5 pcc-content-reveal">
      {/* REPORT TYPE SELECTOR */}
      <Tabs selectedKey={report} onSelectionChange={(key) => handleSelectReport(key)} className="mb-4 d-print-none">
        <TabList aria-label="Report types">
          <Tab id="sales">Sales & Financials</Tab>
          <Tab id="occupancy">Occupancy & Utilization</Tab>
          <Tab id="inventory">Inventory Report</Tab>
          <Tab id="guests">Guest History & Reservations</Tab>
        </TabList>
      </Tabs>

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
            <FlatDatePicker
              value={dateFrom}
              onChange={(val) => {
                setDateFrom(typeof val === 'string' ? val : val?.target?.value || '');
                setDatePreset('Custom Range');
              }}
              className="form-control form-control-sm"
              style={{ height: '36px', margin: 0, marginBottom: 0 }}
              dateFormat="m/d/Y"
            />
          </div>

          {/* To Date */}
          <div className="col-6 col-md-2">
            <label className="form-label small fw-semibold text-muted mb-1 text-truncate d-block" style={{ minHeight: '18px' }}>To</label>
            <FlatDatePicker
              value={dateTo}
              onChange={(val) => {
                setDateTo(typeof val === 'string' ? val : val?.target?.value || '');
                setDatePreset('Custom Range');
              }}
              className="form-control form-control-sm"
              style={{ height: '36px', margin: 0, marginBottom: 0 }}
              dateFormat="m/d/Y"
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
                <option value="Cooked Meals">ðŸ³ Cooked Meals</option>
                <option value="Products">ðŸ¥¤ Products & Minibar</option>
                <option value="Amenities">ðŸ§´ Amenities & Toiletries</option>
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
          <strong>âš  Error generating report:</strong> {error}
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

              {/* Action Buttons: PDF and Excel */}
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-danger text-white fw-semibold d-flex align-items-center gap-1 shadow-sm"
                  onClick={handleExportPDF}
                  disabled={isExporting !== null}
                >
                  <i className="bi bi-file-earmark-pdf-fill"></i> {isExporting === 'pdf' ? 'Generating PDF...' : 'Export / Download PDF'}
                </button>
                <button
                  className="btn btn-sm btn-success text-white fw-semibold d-flex align-items-center gap-1 shadow-sm"
                  onClick={handleExportExcel}
                  disabled={isExporting !== null}
                >
                  <i className="bi bi-file-earmark-spreadsheet-fill"></i> {isExporting === 'excel' ? 'Generating Excel...' : 'Export to Excel (.xlsx)'}
                </button>
              </div>
            </div>
          </div>

          {/* Report views remount per type (clean slate) and are isolated: a view
              failure can never kill the page - switch types to recover. */}
          <HeaderWidgetBoundary key={report}>
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
                      â‚±{(reportData?.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <div className="text-muted small mt-2">
                      Gross: â‚±{(reportData?.grossRevenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-danger border-4">
                    <span className="text-muted small fw-bold">PURCHASE ORDER EXPENSES</span>
                    <h3 className="fw-bold text-danger mb-0 mt-1">
                      â‚±{(reportData?.totalPoExpenses ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                      â‚±{(reportData?.netProfit ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                        Total: â‚±{(reportData?.ordersBreakdown?.totalOrdersTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      <span className="badge text-bg-warning text-dark py-2 px-2">
                        ðŸ³ Cooked Meals: â‚±{(reportData?.ordersBreakdown?.cookedMealsTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({reportData?.ordersBreakdown?.cookedMealsCount ?? 0} ordered)
                      </span>
                      <span className="badge text-bg-primary py-2 px-2">
                        ðŸ¥¤ Products: â‚±{(reportData?.ordersBreakdown?.productsTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({reportData?.ordersBreakdown?.productsCount ?? 0} ordered)
                      </span>
                      <span className="badge text-bg-info text-white py-2 px-2">
                        ðŸ§´ Amenities: â‚±{(reportData?.ordersBreakdown?.amenitiesTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({reportData?.ordersBreakdown?.amenitiesCount ?? 0} ordered)
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
                      Discounts: -â‚±{(reportData?.discountApplied ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-4">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">PAYMENT SETTLEMENTS</span>
                    <div className="row g-2 mt-1">
                      <div className="col-6">
                        <small className="text-muted d-block">Cash</small>
                        <strong className="text-dark">â‚±{(reportData?.cashTotal ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                      </div>
                      <div className="col-6">
                        <small className="text-muted d-block">GCash / Online</small>
                        <strong className="text-info">â‚±{(reportData?.gcashTotal ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
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
                                <td className="text-end">â‚±{(row.grossRevenue || 0).toFixed(2)}</td>
                                <td className="text-end text-danger">-â‚±{(row.discount || 0).toFixed(2)}</td>
                                <td className="text-end text-primary fw-semibold">â‚±{(row.netRevenue || 0).toFixed(2)}</td>
                                <td className="text-end text-danger">â‚±{(row.poExpenses || 0).toFixed(2)}</td>
                                <td className={`text-end fw-bold ${(row.netProfit || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                                  â‚±{(row.netProfit || 0).toFixed(2)}
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
                                    {row.itemType === 'Cooked Meal' ? 'ðŸ³ Cooked Meal' : row.itemType === 'Amenity' ? 'ðŸ§´ Amenity' : 'ðŸ¥¤ Product'}
                                  </span>
                                </td>
                                <td>
                                  <strong>{row.itemName}</strong>
                                  {row.isComplimentary && <span className="badge text-bg-success ms-1 small">Complimentary</span>}
                                </td>
                                <td className="text-center">{row.quantity}</td>
                                <td className="text-end">â‚±{(row.unitPrice || 0).toFixed(2)}</td>
                                <td className="text-end fw-bold text-success">â‚±{(row.totalAmount || 0).toFixed(2)}</td>
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
                                <td><span className="small text-muted">{row.remarks || 'â€”'}</span></td>
                                <td>
                                  <div className="d-flex flex-wrap gap-1">
                                    {(row.items || []).map((it, i) => (
                                      <span key={i} className="badge text-bg-light border">
                                        {it.itemName} ({it.quantityReceived ? `${it.quantityReceived}/${it.quantity}` : it.quantity} @ â‚±{it.unitPrice})
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="text-end fw-bold text-danger">â‚±{(row.totalExpense || 0).toFixed(2)}</td>
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
                                <td className="text-end">â‚±{row.grossAmount.toFixed(2)}</td>
                                <td className="text-end text-danger">-â‚±{row.discountAmount.toFixed(2)}</td>
                                <td className="text-end text-success fw-bold">â‚±{row.netAmount.toFixed(2)}</td>
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
                  <AdminPagination
                    page={currentPage}
                    totalPages={totalPages}
                    onPage={setCurrentPage}
                    start={sortedData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                    end={Math.min(currentPage * itemsPerPage, sortedData.length)}
                    total={sortedData.length}
                    label="records"
                    ariaLabel="Report pagination"
                  />
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
                      <small className="text-muted">Recorded on {reportData?.peakOccupancyDate || 'â€”'}</small>
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
                                <td className="text-end">â‚±{parseFloat(row.standardRate || 0).toFixed(2)}</td>
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
                  <AdminPagination
                    page={currentPage}
                    totalPages={totalPages}
                    onPage={setCurrentPage}
                    start={sortedData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                    end={Math.min(currentPage * itemsPerPage, sortedData.length)}
                    total={sortedData.length}
                    label="records"
                    ariaLabel="Report pagination"
                  />
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
                      <small className="text-muted">Est. Value: â‚±{(reportData?.totalOrderedValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-success border-4">
                      <span className="text-muted small fw-bold">DELIVERED STOCK-IN</span>
                      <h3 className="fw-bold text-success mb-0 mt-1">{reportData?.totalDeliveredQty ?? 0} units</h3>
                      <small className="text-muted">Received: â‚±{(reportData?.totalDeliveredValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-danger border-4">
                      <span className="text-muted small fw-bold">STOCK-OUT USAGE</span>
                      <h3 className="fw-bold text-danger mb-0 mt-1">{reportData?.totalStockOutQty ?? 0} units</h3>
                      <small className="text-muted">Outflow: â‚±{(reportData?.totalStockOutValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-primary border-4">
                      <span className="text-muted small fw-bold">NET MOVEMENT BALANCE</span>
                      <h3 className="fw-bold text-primary mb-0 mt-1">{(reportData?.netMovementQty ?? 0) > 0 ? `+${reportData?.netMovementQty}` : reportData?.netMovementQty ?? 0} units</h3>
                      <small className="text-muted">Net Value: â‚±{(reportData?.netMovementValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-3">
                    <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-info border-4">
                      <span className="text-muted small fw-bold">MOST USED CONSUMABLE</span>
                      <h4 className="fw-bold text-info mb-0 mt-1 text-truncate">{reportData?.mostUsedItem || 'â€”'}</h4>
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
                      <h4 className="fw-bold text-success mb-0 mt-1 text-truncate">{reportData?.mostBorrowed || 'â€”'}</h4>
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
                                <td className="text-center text-danger">{row.expiredQty > 0 ? row.expiredQty : 'â€”'}</td>
                                <td>
                                  {row.lowStock ? (
                                    <span className="badge text-bg-danger">âš  Low Stock</span>
                                  ) : (
                                    <span className="badge text-bg-success">In Stock</span>
                                  )}
                                </td>
                              </>
                            ) : (
                              <>
                                <td>
                                  <strong>{row.itemName}</strong>
                                  {row.referenceNumber && row.referenceNumber !== 'â€”' && (
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
                                    {row.status === 'Ordered' ? 'ðŸ•’ Ordered' : 'âœ“ Delivered'}
                                  </span>
                                </td>
                                <td className={`text-center fw-bold ${row.transactionType?.includes('Stock-In') ? 'text-success' : 'text-danger'}`}>
                                  {row.transactionType?.includes('Stock-In') ? `+${row.quantity}` : `-${row.quantity}`}
                                </td>
                                <td className="text-end font-monospace">â‚±{(row.unitCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="text-end font-monospace fw-bold">â‚±{(row.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="small text-muted">{row.dateRecorded ? new Date(row.dateRecorded).toLocaleString() : 'â€”'}</td>
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
                  <AdminPagination
                    page={currentPage}
                    totalPages={totalPages}
                    onPage={setCurrentPage}
                    start={sortedData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                    end={Math.min(currentPage * itemsPerPage, sortedData.length)}
                    total={sortedData.length}
                    label="records"
                    ariaLabel="Report pagination"
                  />
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
                    <h4 className="fw-bold text-warning mb-0 mt-1 text-truncate">{reportData?.mostFrequentGuest || 'â€”'}</h4>
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
                                <td className="text-end fw-bold text-success">â‚±{row.amountPaid.toFixed(2)}</td>
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
                  <AdminPagination
                    page={currentPage}
                    totalPages={totalPages}
                    onPage={setCurrentPage}
                    start={sortedData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                    end={Math.min(currentPage * itemsPerPage, sortedData.length)}
                    total={sortedData.length}
                    label="records"
                    ariaLabel="Report pagination"
                  />
                )}
              </div>
            </div>
          )}
          </HeaderWidgetBoundary>
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
