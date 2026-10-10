/**
 * Single source of truth for Reports exports.
 * Mirrors field names used in app/admin/reports/page.js handleExportCSV
 * and the /api/admin/reports payload so PDF/XLSX never invent calculations.
 */

export const PCC_BLUE = '1E3A8A';

export function peso(n) {
  const v = Number(n) || 0;
  return `\u20B1${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getReportTitle(report, subTab) {
  if (report === 'sales') return 'Executive Sales & Financial Revenue Report';
  if (report === 'occupancy') return 'Room Occupancy & Utilization Performance Report';
  if (report === 'inventory') return 'Inventory Management & Stock Audit Report';
  if (report === 'guests') return 'Guest Stay History & Reservation Activity Report';
  return 'Executive Management Report';
}

// Column spec: { key, header, width (excel chars), align, fmt: 'text'|'money'|'int'|'date'|'percent' }
export function getReportExportSpec(report, subTab) {
  if (report === 'sales' && subTab === 'summary') {
    return {
      title: getReportTitle(report, subTab),
      columns: [
        { key: 'period', header: 'Period', width: 16, align: 'left', fmt: 'text' },
        { key: 'bookingCount', header: 'Bookings', width: 11, align: 'center', fmt: 'int' },
        { key: 'grossRevenue', header: 'Gross Revenue (PHP)', width: 19, align: 'right', fmt: 'money' },
        { key: 'discount', header: 'Discounts (PHP)', width: 17, align: 'right', fmt: 'money' },
        { key: 'netRevenue', header: 'Net Revenue (PHP)', width: 18, align: 'right', fmt: 'money' },
        { key: 'poExpenses', header: 'PO Expenses (PHP)', width: 18, align: 'right', fmt: 'money' },
        { key: 'netProfit', header: 'Net Profit (PHP)', width: 17, align: 'right', fmt: 'money' },
        { key: 'paymentMethods', header: 'Settlement', width: 16, align: 'left', fmt: 'text' },
      ],
    };
  }
  if (report === 'sales' && subTab === 'transactions') {
    return {
      title: getReportTitle(report, subTab),
      columns: [
        { key: 'transactionID', header: 'Transaction ID', width: 15, align: 'left', fmt: 'text' },
        { key: 'date', header: 'Date & Time', width: 21, align: 'left', fmt: 'text' },
        { key: 'bookingID', header: 'Booking #', width: 12, align: 'left', fmt: 'text' },
        { key: 'guestName', header: 'Guest Name', width: 24, align: 'left', fmt: 'text' },
        { key: 'roomNumber', header: 'Room', width: 12, align: 'left', fmt: 'text' },
        { key: 'roomTypeName', header: 'Room Type', width: 18, align: 'left', fmt: 'text' },
        { key: 'paymentMethod', header: 'Method', width: 13, align: 'left', fmt: 'text' },
        { key: 'discountType', header: 'Discount', width: 16, align: 'left', fmt: 'text' },
        { key: 'grossAmount', header: 'Gross (PHP)', width: 15, align: 'right', fmt: 'money' },
        { key: 'discountAmount', header: 'Discount (PHP)', width: 16, align: 'right', fmt: 'money' },
        { key: 'netAmount', header: 'Net Paid (PHP)', width: 16, align: 'right', fmt: 'money' },
      ],
    };
  }
  if (report === 'sales' && subTab === 'orders') {
    return {
      title: getReportTitle(report, subTab),
      columns: [
        { key: 'orderID', header: 'Order #', width: 12, align: 'left', fmt: 'text' },
        { key: 'date', header: 'Date & Time', width: 21, align: 'left', fmt: 'text' },
        { key: 'guestName', header: 'Guest Name', width: 24, align: 'left', fmt: 'text' },
        { key: 'roomNumber', header: 'Room', width: 12, align: 'left', fmt: 'text' },
        { key: 'itemType', header: 'Category', width: 15, align: 'left', fmt: 'text' },
        { key: 'itemName', header: 'Item Name', width: 26, align: 'left', fmt: 'text' },
        { key: 'quantity', header: 'Qty', width: 8, align: 'center', fmt: 'int' },
        { key: 'unitPrice', header: 'Unit Price (PHP)', width: 17, align: 'right', fmt: 'money' },
        { key: 'totalAmount', header: 'Total (PHP)', width: 15, align: 'right', fmt: 'money' },
        { key: 'orderStatus', header: 'Status', width: 13, align: 'left', fmt: 'text' },
      ],
    };
  }
  if (report === 'sales' && subTab === 'purchase_orders') {
    return {
      title: getReportTitle(report, subTab),
      columns: [
        { key: 'purchaseOrderID', header: 'PO #', width: 11, align: 'left', fmt: 'text' },
        { key: 'date', header: 'Order Date', width: 18, align: 'left', fmt: 'text' },
        { key: 'poStatus', header: 'Status', width: 14, align: 'left', fmt: 'text' },
        { key: 'totalExpense', header: 'Total Expense (PHP)', width: 21, align: 'right', fmt: 'money' },
        { key: 'itemsText', header: 'Items Ordered', width: 52, align: 'left', fmt: 'text' },
        { key: 'remarks', header: 'Remarks', width: 28, align: 'left', fmt: 'text' },
      ],
    };
  }
  if (report === 'occupancy' && subTab === 'trends') {
    return {
      title: getReportTitle(report, subTab),
      columns: [
        { key: 'date', header: 'Date', width: 20, align: 'left', fmt: 'text' },
        { key: 'occupied', header: 'Occupied Rooms', width: 17, align: 'center', fmt: 'int' },
        { key: 'occupancyRate', header: 'Occupancy Rate (%)', width: 20, align: 'right', fmt: 'percent' },
      ],
    };
  }
  if (report === 'occupancy') {
    return {
      title: getReportTitle(report, subTab),
      columns: [
        { key: 'roomNumber', header: 'Room Number', width: 15, align: 'left', fmt: 'text' },
        { key: 'floorName', header: 'Floor', width: 16, align: 'left', fmt: 'text' },
        { key: 'roomTypeName', header: 'Room Type', width: 22, align: 'left', fmt: 'text' },
        { key: 'currentStatus', header: 'Status', width: 14, align: 'left', fmt: 'text' },
        { key: 'standardRate', header: 'Std Rate (PHP)', width: 16, align: 'right', fmt: 'money' },
        { key: 'totalBookings', header: 'Total Stays', width: 12, align: 'center', fmt: 'int' },
        { key: 'totalNightsOccupied', header: 'Nights Booked', width: 15, align: 'center', fmt: 'int' },
      ],
    };
  }
  if (report === 'inventory' && subTab === 'movements') {
    return {
      title: getReportTitle(report, subTab),
      columns: [
        { key: 'itemName', header: 'Item Name', width: 26, align: 'left', fmt: 'text' },
        { key: 'category', header: 'Category', width: 16, align: 'left', fmt: 'text' },
        { key: 'transactionType', header: 'Transaction Type', width: 18, align: 'left', fmt: 'text' },
        { key: 'status', header: 'Status', width: 13, align: 'left', fmt: 'text' },
        { key: 'quantity', header: 'Qty', width: 9, align: 'center', fmt: 'int' },
        { key: 'unitCost', header: 'Unit Cost (PHP)', width: 17, align: 'right', fmt: 'money' },
        { key: 'totalValue', header: 'Total Value (PHP)', width: 19, align: 'right', fmt: 'money' },
        { key: 'dateRecorded', header: 'Date Recorded', width: 20, align: 'left', fmt: 'text' },
        { key: 'recordedBy', header: 'Recorded By', width: 18, align: 'left', fmt: 'text' },
        { key: 'referenceNumber', header: 'Reference #', width: 16, align: 'left', fmt: 'text' },
      ],
    };
  }
  if (report === 'inventory') {
    return {
      title: getReportTitle(report, subTab),
      columns: [
        { key: 'itemName', header: 'Item Name', width: 28, align: 'left', fmt: 'text' },
        { key: 'category', header: 'Category', width: 16, align: 'left', fmt: 'text' },
        { key: 'itemClassification', header: 'Classification', width: 17, align: 'left', fmt: 'text' },
        { key: 'unit', header: 'Unit', width: 9, align: 'left', fmt: 'text' },
        { key: 'quantityReceived', header: 'Received', width: 11, align: 'center', fmt: 'int' },
        { key: 'quantityUsed', header: 'Used', width: 9, align: 'center', fmt: 'int' },
        { key: 'remainingStock', header: 'Remaining', width: 12, align: 'center', fmt: 'int' },
        { key: 'expiredQty', header: 'Expired', width: 10, align: 'center', fmt: 'int' },
        { key: 'disposedQty', header: 'Disposed', width: 10, align: 'center', fmt: 'int' },
        { key: 'stockStatus', header: 'Stock Status', width: 14, align: 'left', fmt: 'text' },
      ],
    };
  }
  if (report === 'guests' && subTab === 'reservations') {
    return {
      title: getReportTitle(report, subTab),
      columns: [
        { key: 'reservationID', header: 'Reservation ID', width: 15, align: 'left', fmt: 'text' },
        { key: 'guestName', header: 'Guest Name', width: 26, align: 'left', fmt: 'text' },
        { key: 'contact', header: 'Contact', width: 17, align: 'left', fmt: 'text' },
        { key: 'email', header: 'Email', width: 28, align: 'left', fmt: 'text' },
        { key: 'roomNumber', header: 'Room', width: 13, align: 'left', fmt: 'text' },
        { key: 'roomType', header: 'Room Type', width: 18, align: 'left', fmt: 'text' },
        { key: 'reservationDate', header: 'Reservation Date', width: 18, align: 'left', fmt: 'text' },
        { key: 'status', header: 'Status', width: 13, align: 'left', fmt: 'text' },
      ],
    };
  }
  // guests stays (default)
  return {
    title: getReportTitle(report, subTab),
    columns: [
      { key: 'guestName', header: 'Guest Name', width: 26, align: 'left', fmt: 'text' },
      { key: 'email', header: 'Email', width: 28, align: 'left', fmt: 'text' },
      { key: 'contact', header: 'Contact', width: 17, align: 'left', fmt: 'text' },
      { key: 'checkIn', header: 'Check-In', width: 14, align: 'left', fmt: 'text' },
      { key: 'checkOut', header: 'Check-Out', width: 14, align: 'left', fmt: 'text' },
      { key: 'roomNumber', header: 'Room', width: 13, align: 'left', fmt: 'text' },
      { key: 'lengthOfStay', header: 'Nights', width: 9, align: 'center', fmt: 'int' },
      { key: 'amountPaid', header: 'Amount Paid (PHP)', width: 19, align: 'right', fmt: 'money' },
      { key: 'discountApplied', header: 'Discount', width: 16, align: 'left', fmt: 'text' },
      { key: 'bookingStatus', header: 'Status', width: 13, align: 'left', fmt: 'text' },
      { key: 'previousVisits', header: 'Prev Visits', width: 12, align: 'center', fmt: 'int' },
    ],
  };
}

// Normalize one raw API row into display/export-safe values (no new math).
export function toExportRow(report, subTab, row) {
  const r = row || {};
  const itemsText = Array.isArray(r.items)
    ? r.items.map((i) => `${i.itemName} (x${i.quantity})`).join('; ')
    : (r.itemsText || '');
  const stockStatus = r.stockStatus || (r.lowStock ? 'Low Stock' : 'In Stock');
  return {
    ...r,
    discountType: r.discountType || 'None',
    paymentMethods: r.paymentMethods || 'Cash',
    itemsText,
    stockStatus,
    remarks: r.remarks || '',
    recordedBy: r.recordedBy || 'System',
    referenceNumber: r.referenceNumber || '',
    standardRate: Number(r.standardRate) || 0,
  };
}

// KPIs reused verbatim from reportData (source of truth, matches dashboard/cards).
export function getReportKpis(report, subTab, d) {
  const x = d || {};
  if (report === 'sales') {
    return [
      { label: 'Total Net Revenue', value: peso(x.totalRevenue), sub: `Gross ${peso(x.grossRevenue)}` },
      { label: 'PO Expenses', value: peso(x.totalPoExpenses), sub: `${x.poLogs?.length || 0} purchase orders` },
      { label: 'Net Profit', value: peso(x.netProfit), sub: 'Net revenue less PO expenses' },
      { label: 'Guest Orders Total', value: peso(x.ordersBreakdown?.totalOrdersTotal), sub: `Cash ${peso(x.cashTotal)} | GCash ${peso(x.gcashTotal)}` },
    ];
  }
  if (report === 'occupancy') {
    if (x.selectedRoomMetrics) {
      const m = x.selectedRoomMetrics;
      return [
        { label: 'Room Occupancy Rate', value: `${m.occupancyRate}%`, sub: `Room ${m.roomNumber} (${m.roomTypeName})` },
        { label: 'Occupied Days', value: `${m.totalOccupiedDays} days`, sub: `Of ${m.totalAvailableDays} days` },
        { label: 'Available Days', value: `${m.totalAvailableDays - m.totalOccupiedDays} days`, sub: `Status: ${m.status}` },
        { label: 'Peak Occupancy', value: `${x.peakOccupancyRate || 0}%`, sub: `On ${x.peakOccupancyDate || '-'}` },
      ];
    }
    return [
      { label: 'Average Occupancy', value: `${x.averageOccupancy ?? 0}%`, sub: 'Across reporting window' },
      { label: 'Rooms Managed', value: `${x.totalRooms ?? 0}`, sub: `${x.occupiedNow ?? 0} occupied | ${x.availableNow ?? 0} available` },
      { label: 'Check-Ins', value: `${x.checkInsCount ?? 0}`, sub: `${x.checkOutsCount ?? 0} check-outs` },
      { label: 'Peak Occupancy', value: `${x.peakOccupancyRate ?? 0}%`, sub: `On ${x.peakOccupancyDate || '-'}` },
    ];
  }
  if (report === 'inventory' && subTab === 'movements') {
    return [
      { label: 'Ordered (Pending)', value: `${x.totalOrderedQty ?? 0} qty`, sub: `Est. ${peso(x.totalOrderedValue)}` },
      { label: 'Delivered Stock-In', value: `${x.totalDeliveredQty ?? 0} qty`, sub: peso(x.totalDeliveredValue) },
      { label: 'Stock-Out Usage', value: `${x.totalStockOutQty ?? 0} qty`, sub: peso(x.totalStockOutValue) },
      { label: 'Net Movement', value: `${x.netMovementQty ?? 0} qty`, sub: `Net ${peso(x.netMovementValue)}` },
    ];
  }
  if (report === 'inventory') {
    return [
      { label: 'Stock Catalog', value: `${x.summaries?.length || 0} items`, sub: 'Amenities, F&B & products' },
      { label: 'Low Stock', value: `${x.lowStockCount || 0} items`, sub: 'At/below reorder threshold' },
      { label: 'Most Consumed', value: `${x.mostUsedItem || '-'}`, sub: `${x.maxUsed || 0} units utilized` },
      { label: 'Disposed / Loss', value: `${x.expiredTotalCount || 0} qty`, sub: 'Expired or discarded' },
    ];
  }
  return [
    { label: 'Unique Guests', value: `${x.totalGuestsCount || 0}`, sub: `${x.returningGuestsCount || 0} repeat | ${x.newGuestsCount || 0} new` },
    { label: 'Avg Stay', value: `${x.averageStayLength || 0} nights`, sub: 'Per guest booking folio' },
    { label: 'Reservations', value: `${x.totalReservations || 0}`, sub: `${x.confirmedCount || 0} confirmed | ${x.cancelledCount || 0} cancelled` },
    { label: 'Top Guest', value: `${x.mostFrequentGuest || '-'}`, sub: `${x.maxVisits || 0} stays` },
  ];
}

export function buildDocRef(report) {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `PCC-REP-${String(report || 'REP').toUpperCase()}-${d}`;
}

export function buildFileBase(report, subTab, from, to) {
  const safe = (s) => String(s || '').replace(/\//g, '-');
  return `PCC_${String(report).toUpperCase()}_${subTab}_${safe(from)}_to_${safe(to)}`;
}
