'use client';

import { useState, useEffect, useMemo } from 'react';
import { LineChart, BarChart, DoughnutChart } from '../../components/ReportsCharts';
import DateInput, { isValidDate, toDbDate, toUiDate } from '../../components/DateInput';

export default function AdminReports() {
  const [report, setReport] = useState('sales'); // 'sales' | 'occupancy' | 'inventory' | 'guests'
  const [grouping, setGrouping] = useState('Daily'); // 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'

  // Date Range Filters
  const [datePreset, setDatePreset] = useState('This Month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Data states
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Table search, pagination & sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const itemsPerPage = 10;

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
        grouping
      }).toString();

      const res = await fetch(`/api/admin/reports?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate report');

      setReportData(data.data || null);
      setCurrentPage(1); // Reset page on report load
      setSearchTerm('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [report, dateFrom, dateTo, grouping]);

  const handlePrint = () => {
    window.print();
  };

  // CSV Export utility
  const handleExportCSV = () => {
    if (!reportData) return;
    let headers = [];
    let rows = [];
    let filename = `report_${report}_${dateFrom}_to_${dateTo}.csv`;

    if (report === 'sales' && reportData.salesRows) {
      headers = ['Period', 'Booking Count', 'Gross Revenue (PHP)', 'Discounts (PHP)', 'Net Revenue (PHP)', 'Payment Methods'];
      rows = reportData.salesRows.map(row => [
        row.period,
        row.bookingCount,
        row.grossRevenue.toFixed(2),
        row.discount.toFixed(2),
        row.netRevenue.toFixed(2),
        `"${row.paymentMethods}"`
      ]);
    } else if (report === 'occupancy' && reportData.occupancyTrend) {
      headers = ['Date', 'Occupied Rooms', 'Occupancy Rate (%)'];
      rows = reportData.occupancyTrend.map(row => [
        row.date,
        row.occupied,
        row.occupancyRate
      ]);
    } else if (report === 'inventory' && reportData.summaries) {
      headers = ['Item Name', 'Category', 'Type', 'Received Qty', 'Used Qty', 'Remaining Stock', 'Expired Qty', 'Disposed Qty', 'Borrowed Qty'];
      rows = reportData.summaries.map(s => [
        `"${s.itemName}"`,
        `"${s.category}"`,
        s.itemType,
        s.quantityReceived,
        s.quantityUsed,
        s.remainingStock,
        s.expiredQty,
        s.disposedQty,
        s.borrowedQty
      ]);
    } else if (report === 'guests' && reportData.guestRows) {
      headers = ['Guest Name', 'Email', 'Contact', 'Check-In', 'Check-Out', 'Room Assigned', 'Length of Stay', 'Total Paid (PHP)', 'Discount Applied', 'Status', 'Visits'];
      rows = reportData.guestRows.map(g => [
        `"${g.guestName}"`,
        g.email,
        g.contact,
        g.checkIn,
        g.checkOut,
        g.roomNumber,
        g.lengthOfStay,
        g.amountPaid.toFixed(2),
        g.discountApplied,
        g.bookingStatus,
        g.previousVisits
      ]);
    }

    if (headers.length === 0) return;

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Sorting Helper
  const handleSort = (field) => {
    const isAsc = sortField === field && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortField(field);
  };

  // Client Side Filtered and Sorted Table Data
  const tableData = useMemo(() => {
    if (!reportData) return [];

    let rawRows = [];
    if (report === 'sales') rawRows = reportData.salesRows || [];
    else if (report === 'occupancy') rawRows = reportData.occupancyTrend || [];
    else if (report === 'inventory') rawRows = reportData.summaries || [];
    else if (report === 'guests') rawRows = reportData.guestRows || [];

    // Search filter
    let filtered = rawRows.filter(row => {
      if (report === 'sales') {
        return row.period.toLowerCase().includes(searchTerm.toLowerCase()) || 
               row.paymentMethods.toLowerCase().includes(searchTerm.toLowerCase());
      }
      if (report === 'occupancy') {
        return row.date.toLowerCase().includes(searchTerm.toLowerCase());
      }
      if (report === 'inventory') {
        return row.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || 
               row.category.toLowerCase().includes(searchTerm.toLowerCase());
      }
      if (report === 'guests') {
        return row.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               row.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
               row.roomNumber.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return true;
    });

    // Sorting
    if (sortField) {
      filtered.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (typeof valA === 'string') {
          return sortOrder === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
        }
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
    }

    return filtered;
  }, [reportData, report, searchTerm, sortField, sortOrder]);

  // Paginated Rows
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return tableData.slice(start, start + itemsPerPage);
  }, [tableData, currentPage]);

  const totalPages = Math.ceil(tableData.length / itemsPerPage);

  // SVG Chart data formatting
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
    if (!reportData || !reportData.salesRows) return [];
    // Accumulate payment methods
    const counts = {};
    reportData.salesRows.forEach(r => {
      const methods = r.paymentMethods.split(', ');
      methods.forEach(m => {
        if (!m || m === '—') return;
        counts[m] = (counts[m] || 0) + r.bookingCount;
      });
    });
    return Object.entries(counts).map(([label, value]) => ({ label, value }));
  }, [reportData]);

  return (
    <div className="pb-5">
      {/* 4 Report Cards Overview Grid (REQ076) */}
      <div className="row g-3 mb-4 d-print-none">
        {[
          { id: 'sales', icon: 'bi-cash-coin', title: 'Sales & Revenue', desc: 'Earnings logs, groupings, discounts, and payment methods.', bg: '#2155B5' },
          { id: 'occupancy', icon: 'bi-building-up', title: 'Occupancy', desc: 'Occupancy trends, room utilization levels, and check-ins.', bg: '#3FA34D' },
          { id: 'inventory', icon: 'bi-box-seam', title: 'Inventory Movement', desc: 'Stock movements, batches, remaining balances, and disposals.', bg: '#17a2b8' },
          { id: 'guests', icon: 'bi-people', title: 'Guest History', desc: 'Stay logs, length of stay, payment summaries, and repeat visits.', bg: '#6f42c1' }
        ].map(cat => (
          <div key={cat.id} className="col-12 col-sm-6 col-lg-3">
            <div 
              className={`card shadow-sm border-0 h-100 p-3 bg-white border-start border-4`}
              style={{ borderLeftColor: cat.bg, cursor: 'pointer', transition: 'all 0.25s' }}
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
                {report === cat.id ? '✓ Selected' : 'Generate Report'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FILTER CONTROL CARD (REQ084) */}
      <div className="card shadow-sm border-0 mb-4 bg-white p-3 d-print-none" style={{ borderRadius: '8px' }}>
        <h6 className="fw-bold mb-3 text-pcc-blue">
          <i className="bi bi-funnel-fill me-1"></i> Report Filters
        </h6>
        <div className="row g-2 align-items-end">
          <div className="col-md-3">
            <label className="form-label small fw-bold">Date Preset</label>
            <select
              className="form-select"
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
          <div className="col-md-3">
            <label className="form-label small fw-bold">From</label>
            <DateInput
              value={dateFrom}
              disabled={datePreset !== 'Custom Range'}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-bold">To</label>
            <DateInput
              value={dateTo}
              disabled={datePreset !== 'Custom Range'}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          {report === 'sales' && (
            <div className="col-md-2">
              <label className="form-label small fw-bold">Group Details By</label>
              <select
                className="form-select"
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
          <div className={report === 'sales' ? 'col-md-1 d-flex gap-1' : 'col-md-3 d-flex gap-1'}>
            <button className="btn btn-pcc-primary text-white w-100" onClick={fetchReport}>
              Generate
            </button>
          </div>
        </div>
      </div>

      {/* PRINT HEADER FOR EXPORTS (d-print-block only) */}
      <div className="d-none d-print-block mb-4 text-center">
        <h2 className="mb-1 text-uppercase fw-bold" style={{ color: 'var(--pcc-blue, #2155B5)' }}>PCC Home Suite Home</h2>
        <h5 className="text-secondary text-capitalize mb-2">
          {report === 'sales' && 'Sales & Revenue Report'}
          {report === 'occupancy' && 'Occupancy & Utilization Report'}
          {report === 'inventory' && 'Inventory Movement Report'}
          {report === 'guests' && 'Guest Stay History Report'}
        </h5>
        <div className="text-muted small">
          Date Range: <strong>{new Date(dateFrom).toLocaleDateString()}</strong> to <strong>{new Date(dateTo).toLocaleDateString()}</strong>
          {report === 'sales' && ` (Grouped by ${grouping})`}
        </div>
        <hr />
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-pcc-primary" role="status">
            <span className="visually-hidden">Generating Report...</span>
          </div>
          <p className="text-muted mt-2">Gathering database records...</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger shadow-sm mb-4" role="alert">
          <strong>⚠ Error generating report:</strong> {error}
        </div>
      ) : reportData ? (
        <>
          {/* ACTIONS AND EXPORTS SECTION */}
          <div className="d-flex justify-content-between align-items-center mb-3 d-print-none">
            <div className="text-muted small">
              Found <strong>{tableData.length}</strong> records in filter range.
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-secondary" onClick={handlePrint}>
                🖨️ Print Preview
              </button>
              <button className="btn btn-sm btn-pcc-primary text-white" onClick={handleExportCSV}>
                📥 Export to Excel/CSV
              </button>
            </div>
          </div>

          {/* REPORT CATEGORY 1: SALES & REVENUE (REQ077, REQ078) */}
          {report === 'sales' && (
            <div>
              {/* Sales Statistics Cards (REQ085 Analysis) */}
              <div className="row g-3 mb-4">
                <div className="col-12 col-md-4">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-primary border-4">
                    <span className="text-muted small fw-bold">TOTAL REVENUE (NET)</span>
                    <h3 className="fw-bold text-primary mb-0 mt-1">₱{reportData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                    <div className="text-muted small mt-2">
                      Gross: ₱{(reportData.totalRevenue + reportData.discountApplied).toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
                    <h3 className="fw-bold text-danger mb-0 mt-1">₱{reportData.discountApplied.toLocaleString(undefined, { maximumFractionDigits: 2 })}</h3>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">AVG. BOOKING VALUE</span>
                    <h3 className="fw-bold text-warning mb-0 mt-1">₱{reportData.averageBookingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
                  </div>
                </div>
                <div className="col-6 col-md-2">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">GROWTH RATE</span>
                    <h3 className="fw-bold text-dark mb-0 mt-1">{reportData.revenueGrowth.toFixed(1)}%</h3>
                    <small className="text-muted">vs prev period</small>
                  </div>
                </div>
              </div>

              {/* Sales Analytics Panels */}
              <div className="card shadow-sm border-0 bg-white p-3 mb-4 d-print-none">
                <h6 className="fw-bold text-pcc-blue mb-3">Sales Performance Analysis</h6>
                <div className="row g-2">
                  <div className="col-md-6 border-end">
                    <p className="mb-1 text-muted small">Highest Earning Period:</p>
                    <h5 className="fw-bold text-success">{reportData.highestPeriod} (₱{reportData.highestPeriodRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })})</h5>
                  </div>
                  <div className="col-md-6 ps-md-4">
                    <p className="mb-1 text-muted small">Lowest Earning Period:</p>
                    <h5 className="fw-bold text-danger">{reportData.lowestPeriod} (₱{reportData.lowestPeriodRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })})</h5>
                  </div>
                </div>
              </div>

              {/* Sales Charts Row */}
              <div className="row g-3 mb-4">
                <div className="col-12 col-lg-8">
                  <div className="card shadow-sm border-0 p-3 bg-white">
                    <LineChart data={salesChartData} title="Revenue Trend over Time (PHP)" height={220} />
                  </div>
                </div>
                <div className="col-12 col-lg-4">
                  <div className="card shadow-sm border-0 p-3 bg-white h-100">
                    <DoughnutChart data={paymentMethodsChartData} title="Booking share by Payment Method" height={180} />
                  </div>
                </div>
              </div>

              {/* Sales details table */}
              <div className="card shadow-sm border-0 bg-white rounded">
                <div className="card-header bg-white py-3 border-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="fw-bold text-dark mb-0">Earnings Details List</h6>
                    <input
                      type="text"
                      className="form-control form-control-sm w-25"
                      placeholder="Search details..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead>
                      <tr className="table-light">
                        <th onClick={() => handleSort('period')} style={{ cursor: 'pointer' }}>Period <i className="bi bi-arrow-down-up small text-muted"></i></th>
                        <th onClick={() => handleSort('bookingCount')} style={{ cursor: 'pointer' }}>Booking Count <i className="bi bi-arrow-down-up small text-muted"></i></th>
                        <th onClick={() => handleSort('grossRevenue')} style={{ cursor: 'pointer' }}>Gross Revenue <i className="bi bi-arrow-down-up small text-muted"></i></th>
                        <th onClick={() => handleSort('discount')} style={{ cursor: 'pointer' }}>Discounts Applied <i className="bi bi-arrow-down-up small text-muted"></i></th>
                        <th onClick={() => handleSort('netRevenue')} style={{ cursor: 'pointer' }}>Net Revenue <i className="bi bi-arrow-down-up small text-muted"></i></th>
                        <th>Payment Methods</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.map((row, idx) => (
                        <tr key={idx}>
                          <td><strong>{row.period}</strong></td>
                          <td>{row.bookingCount}</td>
                          <td>₱{row.grossRevenue.toFixed(2)}</td>
                          <td className="text-danger">-₱{row.discount.toFixed(2)}</td>
                          <td className="text-success fw-bold">₱{row.netRevenue.toFixed(2)}</td>
                          <td><span className="badge text-bg-light border text-muted">{row.paymentMethods || 'Cash'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="card-footer bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                    <span className="small text-muted">Showing page {currentPage} of {totalPages}</span>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)}>Prev</button>
                      <button className="btn btn-sm btn-outline-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)}>Next</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* REPORT CATEGORY 2: OCCUPANCY REPORT (REQ079, REQ080) */}
          {report === 'occupancy' && (
            <div>
              {/* Occupancy Stats Cards */}
              <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-success border-4">
                    <span className="text-muted small fw-bold">OCCUPANCY RATE</span>
                    <h3 className="fw-bold text-success mb-0 mt-1">{reportData.averageOccupancy}%</h3>
                    <div className="progress mt-2" style={{ height: '6px' }}>
                      <div className="progress-bar bg-success" role="progressbar" style={{ width: `${reportData.averageOccupancy}%` }}></div>
                    </div>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">ROOMS STATUS</span>
                    <h4 className="fw-bold text-dark mb-0 mt-1">{reportData.totalRooms} Total</h4>
                    <div className="text-muted small mt-1">
                      {reportData.occupiedNow} Occupied | {reportData.availableNow} Available
                    </div>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">CHECK-INS & RESERVATIONS</span>
                    <h3 className="fw-bold text-primary mb-0 mt-1">{reportData.checkInsCount}</h3>
                    <small className="text-muted">{reportData.reservationsCount} Reservations</small>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">PEAK OCCUPANCY</span>
                    <h4 className="fw-bold text-warning mb-0 mt-1">{reportData.peakOccupancyRate}%</h4>
                    <small className="text-muted">on {reportData.peakOccupancyDate}</small>
                  </div>
                </div>
              </div>

              {/* Occupancy trends and Utilization charts */}
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

              {/* Frequently Booked Rooms and Util list */}
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <div className="card shadow-sm border-0 bg-white p-3 h-100">
                    <h6 className="fw-bold text-dark mb-3">Frequently Booked Rooms</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-hover mb-0">
                        <thead>
                          <tr className="table-light">
                            <th>Room Number</th>
                            <th>Total Booking Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.frequentlyBooked.slice(0, 5).map((r, i) => (
                            <tr key={i}>
                              <td><strong>Room {r.roomNumber}</strong></td>
                              <td>{r.bookingCount} bookings</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  <div className="card shadow-sm border-0 bg-white p-3 h-100">
                    <h6 className="fw-bold text-dark mb-3">Least Frequently Booked Rooms</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-hover mb-0">
                        <thead>
                          <tr className="table-light">
                            <th>Room Number</th>
                            <th>Total Booking Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.frequentlyBooked.slice(-5).reverse().map((r, i) => (
                            <tr key={i}>
                              <td><strong>Room {r.roomNumber}</strong></td>
                              <td>{r.bookingCount} bookings</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* REPORT CATEGORY 3: INVENTORY MOVEMENT (REQ081, REQ082) */}
          {report === 'inventory' && (
            <div>
              {/* Inventory Analysis Cards */}
              <div className="row g-3 mb-4">
                <div className="col-12 col-md-4">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-info border-4">
                    <span className="text-muted small fw-bold">MOST USED CONSUMABLE</span>
                    <h4 className="fw-bold text-info mb-0 mt-1">{reportData.mostUsedItem}</h4>
                    <small className="text-muted">{reportData.maxUsed} units consumed</small>
                  </div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">MOST BORROWED ASSET</span>
                    <h4 className="fw-bold text-success mb-0 mt-1">{reportData.mostBorrowed}</h4>
                    <small className="text-muted">{reportData.maxBorrowed} times borrowed</small>
                  </div>
                </div>
                <div className="col-6 col-md-4">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">MOST DISPOSED ITEM</span>
                    <h4 className="fw-bold text-danger mb-0 mt-1">{reportData.mostDisposed}</h4>
                    <small className="text-muted">{reportData.maxDisposed} units disposed</small>
                  </div>
                </div>
              </div>

              {/* Inventory Details Table (REQ082) */}
              <div className="card shadow-sm border-0 bg-white mb-4">
                <div className="card-header bg-white py-3 border-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="fw-bold text-dark mb-0">Inventory Details Summaries</h6>
                    <input
                      type="text"
                      className="form-control form-control-sm w-25"
                      placeholder="Search inventory..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead>
                      <tr className="table-light">
                        <th onClick={() => handleSort('itemName')} style={{ cursor: 'pointer' }}>Item Name <i className="bi bi-arrow-down-up small text-muted"></i></th>
                        <th onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>Category <i className="bi bi-arrow-down-up small text-muted"></i></th>
                        <th onClick={() => handleSort('itemType')} style={{ cursor: 'pointer' }}>Type <i className="bi bi-arrow-down-up small text-muted"></i></th>
                        <th onClick={() => handleSort('quantityReceived')} style={{ cursor: 'pointer' }}>Rec'd <i className="bi bi-arrow-down-up small text-muted"></i></th>
                        <th onClick={() => handleSort('quantityUsed')} style={{ cursor: 'pointer' }}>Used <i className="bi bi-arrow-down-up small text-muted"></i></th>
                        <th onClick={() => handleSort('remainingStock')} style={{ cursor: 'pointer' }}>Remaining <i className="bi bi-arrow-down-up small text-muted"></i></th>
                        <th onClick={() => handleSort('expiredQty')} style={{ cursor: 'pointer' }}>Expired <i className="bi bi-arrow-down-up small text-muted"></i></th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.map((s, idx) => (
                        <tr key={idx}>
                          <td><strong>{s.itemName}</strong></td>
                          <td>{s.category}</td>
                          <td><span className="badge text-bg-light border text-muted">{s.itemType}</span></td>
                          <td>{s.quantityReceived}</td>
                          <td>{s.quantityUsed}</td>
                          <td className={s.lowStock ? 'text-danger fw-bold' : 'text-success fw-bold'}>{s.remainingStock}</td>
                          <td className="text-danger">{s.expiredQty > 0 ? s.expiredQty : '—'}</td>
                          <td>
                            {s.lowStock ? (
                              <span className="badge text-bg-danger">⚠ Low Stock</span>
                            ) : (
                              <span className="badge text-bg-success">In Stock</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="card-footer bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                    <span className="small text-muted">Showing page {currentPage} of {totalPages}</span>
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)}>Prev</button>
                      <button className="btn btn-sm btn-outline-secondary" disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)}>Next</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Stock Movements Logs list (REQ081) */}
              <div className="card shadow-sm border-0 bg-white">
                <div className="card-header bg-white py-3 border-0">
                  <h6 className="fw-bold text-dark mb-0">Inventory Movements Log Trail</h6>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover table-sm align-middle mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr className="table-light">
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Item</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Staff User</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.movements.slice(0, 15).map((m, idx) => (
                        <tr key={idx}>
                          <td>{new Date(m.movementDateTime).toLocaleString()}</td>
                          <td><code>{m.referenceNumber || '—'}</code></td>
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
                          <td>{m.remarks || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* REPORT CATEGORY 4: GUEST HISTORY REPORT (REQ083) */}
          {report === 'guests' && (
            <div>
              {/* Guest Analytics Cards */}
              <div className="row g-3 mb-4">
                <div className="col-12 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white border-start border-purple border-4">
                    <span className="text-muted small fw-bold">NEW GUESTS</span>
                    <h3 className="fw-bold text-purple mb-0 mt-1" style={{ color: '#6f42c1' }}>{reportData.newGuestsCount}</h3>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">RETURNING GUESTS</span>
                    <h3 className="fw-bold text-success mb-0 mt-1">{reportData.returningGuestsCount}</h3>
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">AVG. STAY DURATION</span>
                    <h3 className="fw-bold text-primary mb-0 mt-1">{reportData.averageStayLength} Nights</h3>
                  </div>
                </div>
                <div className="col-12 col-md-3">
                  <div className="card shadow-sm border-0 p-3 h-100 bg-white">
                    <span className="text-muted small fw-bold">TOP RETURNING GUEST</span>
                    <h5 className="fw-bold text-dark mb-0 mt-2">{reportData.mostFrequentGuest}</h5>
                    <small className="text-muted">{reportData.maxVisits} previous stay(s)</small>
                  </div>
                </div>
              </div>

              {/* Guest history details table */}
              <div className="card shadow-sm border-0 bg-white rounded">
                <div className="card-header bg-white py-3 border-0">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="fw-bold text-dark mb-0">Guest Stays History Log</h6>
                    <input
                      type="text"
                      className="form-control form-control-sm w-25"
                      placeholder="Search guest name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead>
                      <tr className="table-light">
                        <th onClick={() => handleSort('guestName')} style={{ cursor: 'pointer' }}>Guest Name <i className="bi bi-arrow-down-up small text-muted"></i></th>
                        <th>Contact</th>
                        <th>Email</th>
                        <th>Booking Dates</th>
                        <th>Room</th>
                        <th onClick={() => handleSort('lengthOfStay')} style={{ cursor: 'pointer' }}>Stay (Nights) <i className="bi bi-arrow-down-up small text-muted"></i></th>
                        <th onClick={() => handleSort('amountPaid')} style={{ cursor: 'pointer' }}>Amount Paid <i className="bi bi-arrow-down-up small text-muted"></i></th>
                        <th>Discount Applied</th>
                        <th>Status</th>
                        <th onClick={() => handleSort('previousVisits')} style={{ cursor: 'pointer' }}>Previous Visits <i className="bi bi-arrow-down-up small text-muted"></i></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.map((row, idx) => (
                        <tr key={idx}>
                          <td><strong>{row.guestName}</strong></td>
                          <td>{row.contact}</td>
                          <td>{row.email}</td>
                          <td><span className="small text-muted">{row.checkIn} - {row.checkOut}</span></td>
                          <td>Room {row.roomNumber}</td>
                          <td>{row.lengthOfStay}</td>
                          <td className="fw-semibold text-pcc-primary">₱{row.amountPaid.toFixed(2)}</td>
                          <td>{row.discountApplied}</td>
                          <td>
                            <span className={`badge ${
                              row.bookingStatus === 'Checked Out' ? 'text-bg-success' : 'text-bg-warning'
                            }`}>
                              {row.bookingStatus}
                            </span>
                          </td>
                          <td>{row.previousVisits} stay(s)</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="card-footer bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                    <span className="small text-muted">Showing page {currentPage} of {totalPages}</span>
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
          <p className="text-muted mt-2">No report data generated. Change filters and click Generate.</p>
        </div>
      )}
    </div>
  );
}
