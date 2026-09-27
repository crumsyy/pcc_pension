import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const report = searchParams.get('report') || 'sales';
  const from = searchParams.get('from') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0, 10);
  const to = searchParams.get('to') || new Date().toISOString().substring(0, 10);
  const grouping = searchParams.get('grouping') || 'Daily'; // 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'
  const rawRoomID = searchParams.get('roomID') || searchParams.get('roomId') || '';
  const roomID = (rawRoomID && rawRoomID !== 'ALL') ? rawRoomID : '';
  const roomTypeID = searchParams.get('roomTypeID') || '';
  const itemClassification = searchParams.get('itemClassification') || 'All'; // 'All' | 'Cooked Meals' | 'Products' | 'Amenities'
  const paymentMethod = searchParams.get('paymentMethod') || 'All'; // 'All' | 'Cash' | 'GCash'
  const statusFilter = searchParams.get('status') || 'All';
  const discountFilter = searchParams.get('discountType') || searchParams.get('discountID') || 'ALL';
  const movementType = searchParams.get('movementType') || searchParams.get('stockType') || 'ALL'; // 'ALL' | 'STOCK_IN' | 'STOCK_OUT'
  const fulfillmentStatus = searchParams.get('fulfillmentStatus') || (report === 'inventory' ? searchParams.get('status') : '') || 'ALL'; // 'ALL' | 'ORDERED' | 'DELIVERED'

  try {
    // 1. Fetch common metadata so client filters always have room, category, and discount options
    const [roomsList, roomTypesList, discountsList] = await Promise.all([
      dbQuery(`
        SELECT r.roomID, r.roomNumber, rt.type as roomTypeName, r.status
        FROM room r
        JOIN room_type rt ON rt.roomTypeID = r.roomTypeID
        WHERE r.isArchived = 0
        ORDER BY r.roomNumber ASC
      `),
      dbQuery(`SELECT roomTypeID, type FROM room_type ORDER BY type ASC`),
      dbQuery(`SELECT discountID, name, percentage, type FROM discounts WHERE isArchived = 0 ORDER BY name ASC`).catch(() => [])
    ]);

    const data = {};

    // =========================================================================
    // REPORT 1: SALES & FINANCIAL REPORT
    // =========================================================================
    if (report === 'sales') {
      let txSql = `
        SELECT t.transactionID, DATE_FORMAT(t.transactionDateTime, '%Y-%m-%dT%H:%i:%s') as transactionDateTime,
               p.amount as netAmount, pm.paymentMethod, p.paymentID, p.discountID, p.billingID,
               bil.bookingID, COALESCE(p.testMode, 1) as testMode,
               b.roomID, r.roomNumber, rt.type as roomTypeName,
               g.firstName, g.lastName, g.email
        FROM transactions t
        JOIN payment p ON p.paymentID = t.paymentID
        LEFT JOIN payment_method pm ON pm.paymentMethodID = p.paymentMethodID
        LEFT JOIN billing bil ON bil.billingID = t.billingID
        LEFT JOIN booking b ON b.bookingID = bil.bookingID
        LEFT JOIN room r ON r.roomID = b.roomID
        LEFT JOIN room_type rt ON rt.roomTypeID = r.roomTypeID
        LEFT JOIN guest g ON g.guestID = b.guestID
        WHERE DATE(t.transactionDateTime) BETWEEN ? AND ?
      `;
      const txParams = [from, to];

      if (roomID) {
        txSql += " AND b.roomID = ?";
        txParams.push(parseInt(roomID));
      }
      if (roomTypeID) {
        txSql += " AND r.roomTypeID = ?";
        txParams.push(parseInt(roomTypeID));
      }
      if (paymentMethod && paymentMethod !== 'All') {
        txSql += " AND LOWER(pm.paymentMethod) LIKE LOWER(?)";
        txParams.push(`%${paymentMethod}%`);
      }

      txSql += " ORDER BY t.transactionDateTime ASC";

      const transactions = await dbQuery(txSql, txParams);

      // 2. Fetch all bookings to compute detailed discounts
      const bookings = await dbQuery(`
        SELECT b.bookingID, DATE_FORMAT(b.checkInDateTime, '%Y-%m-%dT%H:%i:%s') as checkInDateTime, 
               DATE_FORMAT(b.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime, 
               b.status, COALESCE(rr.rate, 0) as roomPrice
        FROM booking b
        JOIN room r ON r.roomID = b.roomID
        JOIN room_type rt ON rt.roomTypeID = r.roomTypeID
        LEFT JOIN room_rate rr ON rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID AND rr.breakfastID = 1
      `);

      // 3. Fetch guest details with discount percentage and name
      const guestDetails = await dbQuery(`
        SELECT bg.bookingID, bg.discountID, d.name as discountName, d.percentage 
        FROM booking_guest_details bg
        JOIN discounts d ON d.discountID = bg.discountID
      `).catch(() => []);

      // Pre-compute discounts per booking ID
      const bookingDiscounts = {};
      const bookingDiscountInfo = {}; // maps bookingID -> array of { discountID, discountName, percentage, amount }
      for (const b of bookings) {
        const checkIn = new Date(b.checkInDateTime);
        const checkOut = new Date(b.checkOutDateTime);
        const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
        const roomCharge = parseFloat(b.roomPrice) * nights;

        const bookingGuests = guestDetails.filter(g => g.bookingID === b.bookingID);
        const totalGuestsCount = bookingGuests.length > 0 ? bookingGuests.length : 1;
        const sharePerGuest = roomCharge / totalGuestsCount;

        let totalDiscount = 0;
        const appliedDiscs = [];
        for (const guest of bookingGuests) {
          const pct = guest.percentage ? parseInt(guest.percentage) : 0;
          const discAmt = sharePerGuest * (pct / 100);
          totalDiscount += discAmt;
          appliedDiscs.push({
            discountID: guest.discountID,
            discountName: guest.discountName,
            percentage: pct,
            amount: discAmt
          });
        }
        bookingDiscounts[b.bookingID] = totalDiscount;
        bookingDiscountInfo[b.bookingID] = appliedDiscs;
      }

      // Filter transactions based on discountFilter
      const filteredTransactions = transactions.filter(tx => {
        if (!discountFilter || discountFilter === 'ALL') return true;

        const totalDisc = bookingDiscounts[tx.bookingID] || 0;
        const appliedDiscs = bookingDiscountInfo[tx.bookingID] || [];
        const payDiscID = tx.discountID ? parseInt(tx.discountID) : null;
        const payDiscObj = payDiscID ? discountsList.find(d => d.discountID === payDiscID) : null;

        if (discountFilter === 'NONE') {
          // No discount / full fare: total discount must be 0 and no payment discount
          return totalDisc === 0 && (!payDiscID || payDiscID === 0);
        }

        // Match against specific discount: by ID or by Name
        const matchesGuestDisc = appliedDiscs.some(d =>
          String(d.discountID) === String(discountFilter) ||
          d.discountName?.trim().toLowerCase() === discountFilter.trim().toLowerCase()
        );
        const matchesPayDisc = payDiscID && (
          String(payDiscID) === String(discountFilter) ||
          payDiscObj?.name?.trim().toLowerCase() === discountFilter.trim().toLowerCase()
        );

        return matchesGuestDisc || matchesPayDisc;
      });

      // Grouping transactions in JS by chosen period
      const groupedData = {};

      const getPeriodKey = (dateStr) => {
        const d = new Date(dateStr);
        if (grouping === 'Yearly') {
          return `${d.getFullYear()}`;
        }
        if (grouping === 'Monthly') {
          return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
        if (grouping === 'Weekly') {
          const tempDate = new Date(d.valueOf());
          tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
          const yearStart = new Date(tempDate.getFullYear(), 0, 1);
          const weekNo = Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
          return `Week ${weekNo}, ${tempDate.getFullYear()}`;
        }
        // Daily
        return d.toISOString().substring(0, 10);
      };

      let totalRevenue = 0;
      let totalDiscountApplied = 0;
      let cashTotal = 0;
      let gcashTotal = 0;
      let otherTotal = 0;

      const transactionLogs = [];

      for (const tx of filteredTransactions) {
        const key = getPeriodKey(tx.transactionDateTime);
        const netAmt = parseFloat(tx.netAmount || 0);

        const appliedDiscs = bookingDiscountInfo[tx.bookingID] || [];
        const payDiscID = tx.discountID ? parseInt(tx.discountID) : null;
        const payDiscObj = payDiscID ? discountsList.find(d => d.discountID === payDiscID) : null;

        let discountAmt = 0;
        if (!discountFilter || discountFilter === 'ALL') {
          discountAmt = bookingDiscounts[tx.bookingID] || 0;
        } else if (discountFilter === 'NONE') {
          discountAmt = 0;
        } else {
          // Calculate specific discount deduction
          const specificMatches = appliedDiscs.filter(d =>
            String(d.discountID) === String(discountFilter) ||
            d.discountName?.trim().toLowerCase() === discountFilter.trim().toLowerCase()
          );
          if (specificMatches.length > 0) {
            discountAmt = specificMatches.reduce((sum, d) => sum + d.amount, 0);
          } else {
            discountAmt = bookingDiscounts[tx.bookingID] || 0;
          }
        }

        const grossAmt = netAmt + discountAmt;
        const method = tx.paymentMethod || 'Cash';

        // Extract applied discount names for the transaction log row
        const discNames = appliedDiscs.map(d => d.discountName).filter(Boolean);
        if (payDiscObj?.name && !discNames.includes(payDiscObj.name)) {
          discNames.push(payDiscObj.name);
        }
        const discountTypeLabel = discNames.length > 0 ? discNames.join(', ') : (discountAmt > 0 ? 'Discount Applied' : 'None');

        totalRevenue += netAmt;
        totalDiscountApplied += discountAmt;

        if (method.toLowerCase().includes('gcash') || method.toLowerCase().includes('online')) {
          gcashTotal += netAmt;
        } else if (method.toLowerCase().includes('cash')) {
          cashTotal += netAmt;
        } else {
          otherTotal += netAmt;
        }

        if (!groupedData[key]) {
          groupedData[key] = {
            period: key,
            bookingCount: 0,
            grossRevenue: 0,
            discount: 0,
            netRevenue: 0,
            paymentMethods: new Set(),
            bookingIDs: new Set()
          };
        }

        if (tx.bookingID) {
          groupedData[key].bookingIDs.add(tx.bookingID);
        }
        groupedData[key].grossRevenue += grossAmt;
        groupedData[key].discount += discountAmt;
        groupedData[key].netRevenue += netAmt;
        groupedData[key].paymentMethods.add(method);

        transactionLogs.push({
          transactionID: tx.transactionID,
          date: tx.transactionDateTime ? new Date(tx.transactionDateTime).toLocaleString() : '—',
          bookingID: tx.bookingID || '—',
          billingID: tx.billingID || '—',
          guestName: tx.firstName ? `${tx.firstName} ${tx.lastName || ''}`.trim() : 'Walk-in / System',
          roomNumber: tx.roomNumber ? `Room ${tx.roomNumber}` : '—',
          roomTypeName: tx.roomTypeName || '—',
          paymentMethod: method,
          discountType: discountTypeLabel,
          grossAmount: grossAmt,
          discountAmount: discountAmt,
          netAmount: netAmt
        });
      }

      const salesRows = Object.values(groupedData).map(row => ({
        period: row.period,
        bookingCount: row.bookingIDs.size,
        grossRevenue: row.grossRevenue,
        discount: row.discount,
        netRevenue: row.netRevenue,
        paymentMethods: Array.from(row.paymentMethods).join(', ') || 'Cash'
      }));

      // Overall stats for sales
      let bkCountSql = "SELECT COUNT(*) as count FROM booking b JOIN room r ON r.roomID = b.roomID WHERE DATE(b.checkInDateTime) BETWEEN ? AND ?";
      const bkCountParams = [from, to];
      if (roomID) {
        bkCountSql += " AND b.roomID = ?";
        bkCountParams.push(parseInt(roomID));
      }
      if (roomTypeID) {
        bkCountSql += " AND r.roomTypeID = ?";
        bkCountParams.push(parseInt(roomTypeID));
      }

      const bookingsInRange = await dbQuery(bkCountSql, bkCountParams);
      const completedBookingsInRange = await dbQuery(
        bkCountSql + " AND b.status IN ('Checked Out', 'Bill Finalized', 'Payment Completed')",
        bkCountParams
      );

      const numberBookings = bookingsInRange[0]?.count || 0;
      const completedBookings = completedBookingsInRange[0]?.count || 0;

      // Calculate previous period sales for growth comparison
      const daysCount = Math.ceil((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)) + 1;
      const prevFromDate = new Date(from);
      prevFromDate.setDate(prevFromDate.getDate() - daysCount);
      const prevToDate = new Date(from);
      prevToDate.setDate(prevToDate.getDate() - 1);

      const prevFromStr = prevFromDate.toISOString().substring(0, 10);
      const prevToStr = prevToDate.toISOString().substring(0, 10);

      const prevSalesRes = await dbQuery(`
        SELECT SUM(p.amount) as revenue
        FROM transactions t
        JOIN payment p ON p.paymentID = t.paymentID
        LEFT JOIN billing bil ON bil.billingID = t.billingID
        LEFT JOIN booking b ON b.bookingID = bil.bookingID
        LEFT JOIN room r ON r.roomID = b.roomID
        WHERE DATE(t.transactionDateTime) BETWEEN ? AND ?
        ${roomID ? ` AND b.roomID = ${parseInt(roomID)}` : ''}
        ${roomTypeID ? ` AND r.roomTypeID = ${parseInt(roomTypeID)}` : ''}
      `, [prevFromStr, prevToStr]);
      const prevRevenue = parseFloat(prevSalesRes[0]?.revenue || 0);
      const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

      // Find highest and lowest revenue periods
      let highestRev = 0;
      let highestPeriod = '—';
      let lowestRev = Infinity;
      let lowestPeriod = '—';

      salesRows.forEach(row => {
        if (row.netRevenue > highestRev) {
          highestRev = row.netRevenue;
          highestPeriod = row.period;
        }
        if (row.netRevenue < lowestRev) {
          lowestRev = row.netRevenue;
          lowestPeriod = row.period;
        }
      });

      data.salesRows = salesRows;
      data.transactionLogs = transactionLogs;
      data.totalRevenue = totalRevenue;
      data.grossRevenue = totalRevenue + totalDiscountApplied;
      data.discountApplied = totalDiscountApplied;
      data.totalSales = filteredTransactions.length;
      data.cashTotal = cashTotal;
      data.gcashTotal = gcashTotal;
      data.otherTotal = otherTotal;
      data.numberBookings = numberBookings;
      data.completedBookings = completedBookings;
      data.averageBookingValue = numberBookings > 0 ? (totalRevenue / numberBookings) : 0;
      data.revenueGrowth = revenueGrowth;
      data.highestPeriod = highestPeriod;
      data.highestPeriodRevenue = highestRev;
      data.lowestPeriod = lowestPeriod;
      data.lowestPeriodRevenue = lowestRev === Infinity ? 0 : lowestRev;

    // =========================================================================
    // REPORT 2: OCCUPANCY & ROOM UTILIZATION REPORT
    // =========================================================================
    } else if (report === 'occupancy') {
      let roomFilterSql = " WHERE r.isArchived = 0";
      const roomFilterParams = [];
      if (roomID) {
        roomFilterSql += " AND r.roomID = ?";
        roomFilterParams.push(parseInt(roomID));
      }
      if (roomTypeID) {
        roomFilterSql += " AND r.roomTypeID = ?";
        roomFilterParams.push(parseInt(roomTypeID));
      }

      const totalRoomsRes = await dbQuery(`SELECT COUNT(*) as count FROM room r ${roomFilterSql}`, roomFilterParams);
      const occupiedNowRes = await dbQuery(`SELECT COUNT(*) as count FROM room r ${roomFilterSql} AND r.status = 'Occupied'`, roomFilterParams);
      const maintenanceNowRes = await dbQuery(`SELECT COUNT(*) as count FROM room r ${roomFilterSql} AND r.status = 'Under Maintenance'`, roomFilterParams);
      const availableNowRes = await dbQuery(`SELECT COUNT(*) as count FROM room r ${roomFilterSql} AND r.status = 'Available'`, roomFilterParams);

      const totalRooms = totalRoomsRes[0]?.count || 0;
      const occupiedNow = occupiedNowRes[0]?.count || 0;
      const maintenanceNow = maintenanceNowRes[0]?.count || 0;
      const availableNow = availableNowRes[0]?.count || 0;

      // Check-ins and Check-outs
      let bkCheckSql = "SELECT COUNT(*) as count FROM booking b JOIN room r ON r.roomID = b.roomID WHERE b.status IN ('Checked In', 'Checked Out', 'Bill Finalized', 'Payment Completed') AND DATE(b.checkInDateTime) BETWEEN ? AND ?";
      const bkCheckParams = [from, to];
      if (roomID) {
        bkCheckSql += " AND b.roomID = ?";
        bkCheckParams.push(parseInt(roomID));
      }
      if (roomTypeID) {
        bkCheckSql += " AND r.roomTypeID = ?";
        bkCheckParams.push(parseInt(roomTypeID));
      }

      const checkInsRes = await dbQuery(bkCheckSql, bkCheckParams);
      const checkOutsRes = await dbQuery(
        bkCheckSql.replace('DATE(b.checkInDateTime)', 'DATE(b.checkOutDateTime)'),
        bkCheckParams
      );

      // Occupancy daily trend
      const daysList = [];
      const start = new Date(from);
      const end = new Date(to);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        daysList.push(d.toISOString().substring(0, 10));
      }

      let activeBkSql = `
        SELECT b.bookingID, b.roomID, DATE_FORMAT(b.checkInDateTime, '%Y-%m-%dT%H:%i:%s') as checkInDateTime, 
               DATE_FORMAT(b.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime, b.status 
        FROM booking b
        JOIN room r ON r.roomID = b.roomID
        WHERE b.status IN ('Checked In', 'Checked Out', 'Bill Finalized', 'Payment Completed')
          AND DATE(b.checkInDateTime) <= ? AND DATE(b.checkOutDateTime) >= ?
      `;
      const activeBkParams = [to, from];
      if (roomID) {
        activeBkSql += " AND b.roomID = ?";
        activeBkParams.push(parseInt(roomID));
      }
      if (roomTypeID) {
        activeBkSql += " AND r.roomTypeID = ?";
        activeBkParams.push(parseInt(roomTypeID));
      }
      const activeBookings = await dbQuery(activeBkSql, activeBkParams);

      const occupancyTrend = daysList.map(day => {
        const occupiedCount = activeBookings.filter(b => {
          const checkIn = new Date(b.checkInDateTime).toISOString().substring(0, 10);
          const checkOut = new Date(b.checkOutDateTime).toISOString().substring(0, 10);
          return checkIn <= day && checkOut >= day;
        }).length;

        const activeTotalRooms = Math.max(1, totalRooms - maintenanceNow);
        const rate = (occupiedCount / activeTotalRooms) * 100;
        return {
          date: day,
          occupied: occupiedCount,
          occupancyRate: parseFloat(Math.min(100, rate).toFixed(1))
        };
      });

      // Room Type Utilization
      let utilSql = `
        SELECT rt.type as roomType, COUNT(b.bookingID) as bookingsCount
        FROM booking b
        JOIN room rm ON rm.roomID = b.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE DATE(b.checkInDateTime) BETWEEN ? AND ?
      `;
      const utilParams = [from, to];
      if (roomID) {
        utilSql += " AND rm.roomID = ?";
        utilParams.push(parseInt(roomID));
      }
      if (roomTypeID) {
        utilSql += " AND rm.roomTypeID = ?";
        utilParams.push(parseInt(roomTypeID));
      }
      utilSql += " GROUP BY rt.type ORDER BY bookingsCount DESC";
      const roomUtilRows = await dbQuery(utilSql, utilParams);

      // Detailed Room Performance / Utilization table
      let perfSql = `
        SELECT rm.roomID, rm.roomNumber, rm.status as currentStatus, fl.name as floorName, rt.type as roomTypeName,
               COALESCE(MAX(rr.rate), 0) as standardRate,
               COUNT(b.bookingID) as totalBookings,
               COALESCE(SUM(
                 CASE 
                   WHEN b.bookingID IS NOT NULL THEN GREATEST(1, DATEDIFF(LEAST(b.checkOutDateTime, ?), GREATEST(b.checkInDateTime, ?)))
                   ELSE 0
                 END
               ), 0) as totalNightsOccupied
        FROM room rm
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        JOIN floor fl ON fl.floorID = rm.floorID
        LEFT JOIN room_rate rr ON rr.roomTypeID = rm.roomTypeID AND rr.floorID = rm.floorID AND rr.breakfastID = 1
        LEFT JOIN booking b ON b.roomID = rm.roomID
          AND b.status IN ('Checked In', 'Checked Out', 'Bill Finalized', 'Payment Completed')
          AND DATE(b.checkInDateTime) <= ? AND DATE(b.checkOutDateTime) >= ?
        WHERE rm.isArchived = 0
      `;
      const perfParams = [`${to} 23:59:59`, `${from} 00:00:00`, to, from];
      if (roomID) {
        perfSql += " AND rm.roomID = ?";
        perfParams.push(parseInt(roomID));
      }
      if (roomTypeID) {
        perfSql += " AND rm.roomTypeID = ?";
        perfParams.push(parseInt(roomTypeID));
      }
      perfSql += " GROUP BY rm.roomID, rm.roomNumber, rm.status, fl.name, rt.type ORDER BY totalBookings DESC, rm.roomNumber ASC";
      const roomPerformance = await dbQuery(perfSql, perfParams);

      // Peak booking dates
      let peakOccupancyDate = '—';
      let peakOccupancyRate = 0;
      let lowestOccupancyDate = '—';
      let lowestOccupancyRate = 100;

      occupancyTrend.forEach(t => {
        if (t.occupancyRate > peakOccupancyRate) {
          peakOccupancyRate = t.occupancyRate;
          peakOccupancyDate = t.date;
        }
        if (t.occupancyRate < lowestOccupancyRate) {
          lowestOccupancyRate = t.occupancyRate;
          lowestOccupancyDate = t.date;
        }
      });

      const startDate = new Date(from);
      const endDate = new Date(to);
      const totalDaysInPeriod = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);

      let selectedRoomMetrics = null;
      if (roomID) {
        // Calculate single room occupied days in period: Occupancy Rate (%) = (Occupied Days / Total Days) * 100
        const singleRoomOccupiedDays = occupancyTrend.reduce((sum, d) => sum + (d.occupied > 0 ? 1 : 0), 0);
        const singleRoomRate = parseFloat(((singleRoomOccupiedDays / totalDaysInPeriod) * 100).toFixed(1));
        const roomInfo = roomsList.find(r => String(r.roomID) === String(roomID));

        selectedRoomMetrics = {
          roomID: parseInt(roomID),
          roomNumber: roomInfo?.roomNumber || `${roomID}`,
          roomTypeName: roomInfo?.roomTypeName || '—',
          status: roomInfo?.status || 'Available',
          totalOccupiedDays: singleRoomOccupiedDays,
          totalAvailableDays: totalDaysInPeriod,
          occupancyRate: singleRoomRate
        };
        data.averageOccupancy = singleRoomRate;
      } else {
        const averageOccupancy = occupancyTrend.reduce((sum, t) => sum + t.occupancyRate, 0) / (occupancyTrend.length || 1);
        data.averageOccupancy = parseFloat(averageOccupancy.toFixed(1));
      }

      data.totalRooms = totalRooms;
      data.occupiedNow = occupiedNow;
      data.availableNow = availableNow;
      data.maintenanceNow = maintenanceNow;
      data.occupancyPercentage = (totalRooms - maintenanceNow) > 0 ? ((occupiedNow / (totalRooms - maintenanceNow)) * 100) : 0;
      data.checkInsCount = checkInsRes[0]?.count || 0;
      data.checkOutsCount = checkOutsRes[0]?.count || 0;
      data.occupancyTrend = occupancyTrend;
      data.roomUtilRows = roomUtilRows;
      data.roomPerformance = roomPerformance;
      data.peakOccupancyDate = peakOccupancyDate;
      data.peakOccupancyRate = peakOccupancyRate;
      data.lowestOccupancyDate = lowestOccupancyDate;
      data.lowestOccupancyRate = lowestOccupancyRate === 100 ? 0 : lowestOccupancyRate;
      data.totalDaysInPeriod = totalDaysInPeriod;
      data.selectedRoomMetrics = selectedRoomMetrics;

    // =========================================================================
    // REPORT 3: INVENTORY REPORT
    // =========================================================================
    } else if (report === 'inventory') {
      const safeDbQuery = async (queryStr, params = []) => {
        try {
          return await dbQuery(queryStr, params);
        } catch (err) {
          console.warn("Report safe query fallback:", err.message);
          return [];
        }
      };

      // 1. Fetch amenities and products
      const amenities = await safeDbQuery(`
        SELECT 'Amenity' as sourceTable, a.amenityID as itemID, a.name, COALESCE(ac.name, 'General') as category,
               'Amenity' as itemClass, 'Amenity' as itemClassification, COALESCE(a.minStock, 5) as minStock,
               'Consumable' as itemType, COALESCE(a.unit, 'pcs') as unit, COALESCE(a.price, 0) as defaultCost
        FROM amenities a
        LEFT JOIN amenities_category ac ON ac.amenityCategoryID = a.amenityCategoryID
        WHERE a.isArchived = 0
      `);

      let products = await safeDbQuery(`
        SELECT 'Product' as sourceTable, p.productID as itemID, p.name, COALESCE(pc.name, 'General') as category,
               'Product' as itemClass,
               CASE WHEN p.productCategoryID = 3 OR LOWER(pc.name) = 'cooked meals' THEN 'Cooked Meal' ELSE 'Product' END as itemClassification,
               COALESCE(p.minStock, 5) as minStock, 'Consumable' as itemType, COALESCE(p.unit, 'pcs') as unit,
               COALESCE(p.basePrice, p.price, 0) as defaultCost
        FROM products p
        LEFT JOIN product_category pc ON pc.productCategoryID = p.productCategoryID
        WHERE p.isArchived = 0
      `);

      if (!products || products.length === 0) {
        // Fallback to product singular if schema uses product
        products = await safeDbQuery(`
          SELECT 'Product' as sourceTable, p.productID as itemID, p.name, COALESCE(pc.name, 'General') as category,
                 'Product' as itemClass,
                 CASE WHEN p.productCategoryID = 3 OR LOWER(pc.name) = 'cooked meals' THEN 'Cooked Meal' ELSE 'Product' END as itemClassification,
                 COALESCE(p.minStock, 5) as minStock, 'Consumable' as itemType, COALESCE(p.unit, 'pcs') as unit,
                 COALESCE(p.basePrice, p.price, 0) as defaultCost
          FROM product p
          LEFT JOIN product_category pc ON pc.productCategoryID = p.productCategoryID
          WHERE p.isArchived = 0
        `);
      }

      let catalog = [...amenities, ...products];

      // Filter catalog by itemClassification if specified
      if (itemClassification === 'Cooked Meals') {
        catalog = catalog.filter(i => i.itemClassification === 'Cooked Meal');
      } else if (itemClassification === 'Products') {
        catalog = catalog.filter(i => i.itemClassification === 'Product');
      } else if (itemClassification === 'Amenities') {
        catalog = catalog.filter(i => i.itemClassification === 'Amenity');
      }

      // Fetch batch data
      const batches = await safeDbQuery("SELECT * FROM inventory_batch");
      const borrows = await safeDbQuery("SELECT * FROM borrow_transaction");
      const disposals = await safeDbQuery("SELECT * FROM inventory_disposal");
      const allMovements = await safeDbQuery("SELECT * FROM inventory_movement");

      const todayStr = new Date().toISOString().substring(0, 10);

      const getFormatDate = (d) => {
        if (!d) return '';
        try {
          return new Date(d).toISOString().substring(0, 10);
        } catch (e) {
          return '';
        }
      };

      const summaries = catalog.map(item => {
        const itemBatches = batches.filter(b => b.itemType === item.itemClass && b.itemID === item.itemID);
        const itemDisposals = disposals.filter(d => d.itemType === item.itemClass && d.itemID === item.itemID);
        const itemBorrows = borrows.filter(b => b.itemType === item.itemClass && b.itemID === item.itemID);

        const received = itemBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
        const remaining = itemBatches.reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);

        const used = allMovements
          .filter(m => m.itemType === item.itemClass && m.itemID === item.itemID && m.movementType === 'Stock Out')
          .reduce((sum, m) => sum + Math.abs(m.quantity || 0), 0);

        const disposed = itemDisposals.reduce((sum, d) => sum + (d.quantity || 0), 0);
        const borrowed = itemBorrows.filter(b => b.status === 'Borrowed').reduce((sum, b) => sum + (b.quantity || 0), 0);
        const returned = itemBorrows.filter(b => b.status === 'Returned').reduce((sum, b) => sum + (b.quantity || 0), 0);

        const expired = itemBatches
          .filter(b => b.expirationDate && getFormatDate(b.expirationDate) < todayStr)
          .reduce((sum, b) => sum + (b.remainingQuantity || 0), 0);

        return {
          itemID: item.itemID,
          itemName: item.name,
          category: item.category,
          itemClassification: item.itemClassification,
          itemType: item.itemType,
          unit: item.unit,
          quantityReceived: received,
          quantityUsed: used,
          remainingStock: remaining,
          minStock: item.minStock,
          lowStock: remaining <= item.minStock,
          expiredQty: expired,
          disposedQty: disposed,
          borrowedQty: item.itemType === 'Non-Consumable' ? borrowed : 0,
          returnedQty: item.itemType === 'Non-Consumable' ? returned : 0
        };
      });

      // 2. Fetch Ordered Stock (Pending / Partially Received Purchase Orders)
      const purchaseOrderItems = await safeDbQuery(`
        SELECT po.purchaseOrderID, DATE_FORMAT(po.orderDate, '%Y-%m-%dT%H:%i:%s') as orderDate, po.status as poStatus,
               poi.orderItemID, poi.itemName, poi.itemType, poi.quantity, COALESCE(poi.quantityReceived, 0) as quantityReceived,
               COALESCE(poi.unitPrice, 0) as unitPrice,
               u.email as staffEmail, u.firstName as staffFirstName, u.lastName as staffLastName
        FROM purchase_order po
        JOIN purchase_order_items poi ON poi.purchaseOrderID = po.purchaseOrderID
        LEFT JOIN user u ON u.userID = po.staffID
        WHERE DATE(po.orderDate) BETWEEN ? AND ?
          AND po.status IN ('Pending', 'Approved', 'Partially Received')
      `, [from, to]);

      const orderedRows = [];
      for (const poi of purchaseOrderItems) {
        const pendingQty = Math.max(0, poi.quantity - poi.quantityReceived);
        if (pendingQty <= 0) continue; // fully received PO items do not appear in pending ordered

        const unitCost = parseFloat(poi.unitPrice || 0);
        const totalVal = parseFloat((pendingQty * unitCost).toFixed(2));
        const recordedBy = poi.staffEmail || (poi.staffFirstName ? `${poi.staffFirstName} ${poi.staffLastName || ''}`.trim() : 'Purchasing Staff');

        orderedRows.push({
          id: `PO-${poi.purchaseOrderID}-${poi.orderItemID}`,
          movementID: `po-${poi.purchaseOrderID}-${poi.orderItemID}`,
          itemName: poi.itemName,
          category: poi.itemType || 'Product',
          itemClassification: poi.itemType === 'Amenity' ? 'Amenity' : 'Product',
          transactionType: 'Stock-In (Ordered PO)',
          rawType: 'STOCK_IN',
          status: 'Ordered',
          rawStatus: 'ORDERED',
          quantity: pendingQty,
          unitCost: unitCost,
          totalValue: totalVal,
          dateRecorded: poi.orderDate,
          movementDateTime: poi.orderDate,
          recordedBy: recordedBy,
          referenceNumber: `PO-${poi.purchaseOrderID}`,
          remarks: `Pending delivery (${poi.poStatus})`
        });
      }

      // 3. Fetch Delivered Stock & Stock-Out Movements from inventory_movement
      let movementsSql = `
        SELECT im.*, 
               DATE_FORMAT(im.movementDateTime, '%Y-%m-%dT%H:%i:%s') as movementDateTimeStr,
               COALESCE(a.name, p.name) as itemName,
               COALESCE(ac.name, pc.name, im.itemType) as category,
               CASE 
                 WHEN im.itemType = 'Amenity' THEN 'Amenity'
                 WHEN p.productCategoryID = 3 OR LOWER(pc.name) = 'cooked meals' THEN 'Cooked Meal'
                 ELSE 'Product'
               END as itemClassification,
               ib.batchNumber, COALESCE(ib.unitCost, p.basePrice, p.price, a.price, 0) as resolvedUnitCost,
               u.email as userEmail, u.firstName as userFirstName, u.lastName as userLastName
        FROM inventory_movement im
        LEFT JOIN amenities a ON im.itemType = 'Amenity' AND a.amenityID = im.itemID
        LEFT JOIN amenities_category ac ON ac.amenityCategoryID = a.amenityCategoryID
        LEFT JOIN products p ON im.itemType = 'Product' AND p.productID = im.itemID
        LEFT JOIN product_category pc ON pc.productCategoryID = p.productCategoryID
        LEFT JOIN inventory_batch ib ON ib.batchID = im.batchID
        LEFT JOIN user u ON u.userID = im.userID
        WHERE DATE(im.movementDateTime) BETWEEN ? AND ?
        ORDER BY im.movementDateTime DESC
      `;
      let movements = await safeDbQuery(movementsSql, [from, to]);
      if (!movements || movements.length === 0) {
        // Fallback for schema using product singular
        movements = await safeDbQuery(movementsSql.replace('LEFT JOIN products p', 'LEFT JOIN product p'), [from, to]);
      }

      const deliveredRows = [];
      for (const m of movements) {
        const isStockIn = m.movementType === 'Stock In';
        const qty = Math.abs(m.quantity || 0);
        const unitCost = parseFloat(m.resolvedUnitCost || 0);
        const totalVal = parseFloat((qty * unitCost).toFixed(2));
        const recordedBy = m.userEmail || (m.userFirstName ? `${m.userFirstName} ${m.userLastName || ''}`.trim() : 'System');

        deliveredRows.push({
          id: `MOV-${m.movementID}`,
          movementID: m.movementID,
          itemName: m.itemName || `Item #${m.itemID}`,
          category: m.category || m.itemType || 'General',
          itemClassification: m.itemClassification,
          transactionType: isStockIn ? 'Stock-In' : 'Stock-Out',
          rawType: isStockIn ? 'STOCK_IN' : 'STOCK_OUT',
          status: 'Delivered',
          rawStatus: 'DELIVERED',
          quantity: qty,
          unitCost: unitCost,
          totalValue: totalVal,
          dateRecorded: m.movementDateTimeStr || m.movementDateTime,
          movementDateTime: m.movementDateTimeStr || m.movementDateTime,
          recordedBy: recordedBy,
          referenceNumber: m.referenceNumber || '—',
          remarks: m.remarks || (isStockIn ? 'Received physical stock' : m.movementType)
        });
      }

      // Merge ordered and delivered movement rows
      let allMovementAuditRows = [...orderedRows, ...deliveredRows];
      allMovementAuditRows.sort((a, b) => new Date(b.dateRecorded || 0) - new Date(a.dateRecorded || 0));

      // Calculate totals across audit rows in this date window
      let totalOrderedQty = 0;
      let totalOrderedValue = 0;
      let totalDeliveredQty = 0;
      let totalDeliveredValue = 0;
      let totalStockOutQty = 0;
      let totalStockOutValue = 0;

      for (const row of allMovementAuditRows) {
        if (row.rawStatus === 'ORDERED') {
          totalOrderedQty += row.quantity;
          totalOrderedValue += row.totalValue;
        } else if (row.rawType === 'STOCK_IN') {
          totalDeliveredQty += row.quantity;
          totalDeliveredValue += row.totalValue;
        } else if (row.rawType === 'STOCK_OUT') {
          totalStockOutQty += row.quantity;
          totalStockOutValue += row.totalValue;
        }
      }

      // Now apply filters: itemClassification, movementType, fulfillmentStatus
      let filteredAuditRows = allMovementAuditRows;

      if (itemClassification !== 'All') {
        filteredAuditRows = filteredAuditRows.filter(r => {
          if (itemClassification === 'Cooked Meals') return r.itemClassification === 'Cooked Meal';
          if (itemClassification === 'Products') return r.itemClassification === 'Product';
          if (itemClassification === 'Amenities') return r.itemClassification === 'Amenity';
          return true;
        });
      }

      if (movementType && movementType !== 'ALL') {
        filteredAuditRows = filteredAuditRows.filter(r => r.rawType === movementType);
      }

      if (fulfillmentStatus && fulfillmentStatus !== 'ALL') {
        filteredAuditRows = filteredAuditRows.filter(r => r.rawStatus === fulfillmentStatus);
      }

      let mostUsedItem = '—';
      let maxUsed = 0;
      let mostBorrowed = '—';
      let maxBorrowed = 0;
      let mostDisposed = '—';
      let maxDisposed = 0;
      let lowStockCount = 0;
      let expiredTotalCount = 0;

      summaries.forEach(s => {
        if (s.quantityUsed > maxUsed) {
          maxUsed = s.quantityUsed;
          mostUsedItem = s.itemName;
        }
        if (s.borrowedQty > maxBorrowed) {
          maxBorrowed = s.borrowedQty;
          mostBorrowed = s.itemName;
        }
        if (s.disposedQty > maxDisposed) {
          maxDisposed = s.disposedQty;
          mostDisposed = s.itemName;
        }
        if (s.lowStock) lowStockCount++;
        if (s.expiredQty > 0) expiredTotalCount += s.expiredQty;
      });

      data.movements = filteredAuditRows;
      data.summaries = summaries;
      data.totalOrderedQty = totalOrderedQty;
      data.totalOrderedValue = totalOrderedValue;
      data.totalDeliveredQty = totalDeliveredQty;
      data.totalDeliveredValue = totalDeliveredValue;
      data.totalStockOutQty = totalStockOutQty;
      data.totalStockOutValue = totalStockOutValue;
      data.netMovementQty = totalDeliveredQty - totalStockOutQty;
      data.netMovementValue = totalDeliveredValue - totalStockOutValue;
      data.mostUsedItem = mostUsedItem;
      data.maxUsed = maxUsed;
      data.mostBorrowed = mostBorrowed;
      data.maxBorrowed = maxBorrowed;
      data.mostDisposed = mostDisposed;
      data.maxDisposed = maxDisposed;
      data.lowStockCount = lowStockCount;
      data.expiredTotalCount = expiredTotalCount;

    // =========================================================================
    // REPORT 4: GUEST HISTORY & RESERVATION ACTIVITY REPORT
    // =========================================================================
    } else if (report === 'guests') {
      let guestSql = `
        SELECT g.guestID, g.firstName, g.lastName, g.email, g.contact,
               b.bookingID, DATE_FORMAT(b.checkInDateTime, '%Y-%m-%dT%H:%i:%s') as checkInDateTime, 
               DATE_FORMAT(b.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime, 
               b.status as bookingStatus, b.roomID,
               r.roomNumber, rt.type as roomTypeName,
               (SELECT COALESCE(SUM(p.amount), 0) FROM payment p JOIN billing bil ON bil.billingID = p.billingID WHERE bil.bookingID = b.bookingID) as amountPaid
        FROM guest g
        JOIN booking b ON b.guestID = g.guestID
        JOIN room r ON r.roomID = b.roomID
        JOIN room_type rt ON rt.roomTypeID = r.roomTypeID
        WHERE DATE(b.checkInDateTime) BETWEEN ? AND ?
      `;
      const guestParams = [from, to];
      if (roomID) {
        guestSql += " AND b.roomID = ?";
        guestParams.push(parseInt(roomID));
      }
      if (roomTypeID) {
        guestSql += " AND r.roomTypeID = ?";
        guestParams.push(parseInt(roomTypeID));
      }
      if (statusFilter && statusFilter !== 'All') {
        guestSql += " AND b.status = ?";
        guestParams.push(statusFilter);
      }
      guestSql += " ORDER BY b.checkInDateTime DESC";

      const guests = await dbQuery(guestSql, guestParams);

      // Previous stays calculation
      const allGuestStays = await dbQuery("SELECT guestID, bookingID, DATE_FORMAT(checkInDateTime, '%Y-%m-%dT%H:%i:%s') as checkInDateTime FROM booking");
      const guestDetails = await dbQuery(`
        SELECT bg.bookingID, d.name as discountName
        FROM booking_guest_details bg
        JOIN discounts d ON d.discountID = bg.discountID
      `);

      const guestRows = guests.map(g => {
        const checkIn = new Date(g.checkInDateTime);
        const checkOut = new Date(g.checkOutDateTime);
        const stayNights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
        const prevVisits = allGuestStays.filter(s => s.guestID === g.guestID && new Date(s.checkInDateTime) < checkIn).length;
        const discountApplied = guestDetails.find(gd => gd.bookingID === g.bookingID)?.discountName || '—';

        return {
          guestID: g.guestID,
          guestName: `${g.firstName} ${g.lastName || ''}`.trim(),
          contact: g.contact || '—',
          email: g.email || '—',
          checkIn: checkIn.toLocaleDateString(),
          checkOut: checkOut.toLocaleDateString(),
          roomNumber: g.roomNumber ? `Room ${g.roomNumber}` : '—',
          roomTypeName: g.roomTypeName || '—',
          lengthOfStay: stayNights,
          amountPaid: parseFloat(g.amountPaid || 0),
          discountApplied,
          bookingStatus: g.bookingStatus,
          previousVisits: prevVisits
        };
      });

      // Reservations Activity Log
      let resSql = `
        SELECT r.reservationID, 
               DATE_FORMAT(r.reservationDateTime, '%Y-%m-%dT%H:%i:%s') as reservationDateTime, 
               DATE_FORMAT(r.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime, 
               r.status, r.roomID,
               g.firstName, g.lastName, g.contact, g.email,
               rm.roomNumber, rt.type as roomType
        FROM reservation r
        JOIN guest g ON g.guestID = r.guestID
        JOIN room rm ON rm.roomID = r.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE DATE(r.reservationDateTime) BETWEEN ? AND ?
      `;
      const resParams = [from, to];
      if (roomID) {
        resSql += " AND r.roomID = ?";
        resParams.push(parseInt(roomID));
      }
      if (roomTypeID) {
        resSql += " AND rm.roomTypeID = ?";
        resParams.push(parseInt(roomTypeID));
      }
      if (statusFilter && statusFilter !== 'All') {
        resSql += " AND r.status = ?";
        resParams.push(statusFilter);
      }
      resSql += " ORDER BY r.reservationDateTime DESC";

      const reservationsList = await dbQuery(resSql, resParams);

      const reservationRows = reservationsList.map(r => ({
        reservationID: r.reservationID,
        guestName: `${r.firstName} ${r.lastName || ''}`.trim(),
        contact: r.contact || '—',
        email: r.email || '—',
        roomNumber: r.roomNumber ? `Room ${r.roomNumber}` : '—',
        roomType: r.roomType || '—',
        reservationDate: r.reservationDateTime ? new Date(r.reservationDateTime).toLocaleDateString() : '—',
        checkInDate: r.reservationDateTime ? new Date(r.reservationDateTime).toLocaleDateString() : '—',
        status: r.status
      }));

      // Guest Analytics
      const uniqueGuestsInRange = Array.from(new Set(guests.map(g => g.guestID)));
      let newGuestsCount = 0;
      let returningGuestsCount = 0;
      let totalNights = 0;
      let mostFrequentGuest = '—';
      let maxVisits = 0;

      for (const guestID of uniqueGuestsInRange) {
        const firstGuest = guests.find(g => g.guestID === guestID);
        const allStaysCount = allGuestStays.filter(s => s.guestID === guestID).length;
        if (allStaysCount > 1) {
          returningGuestsCount++;
        } else {
          newGuestsCount++;
        }

        if (allStaysCount > maxVisits && firstGuest) {
          maxVisits = allStaysCount;
          mostFrequentGuest = `${firstGuest.firstName} ${firstGuest.lastName || ''}`.trim();
        }
      }

      guestRows.forEach(row => {
        totalNights += row.lengthOfStay;
      });

      const avgStay = guestRows.length > 0 ? (totalNights / guestRows.length) : 0;
      const totalReservations = reservationsList.length;
      const confirmedCount = reservationsList.filter(r => r.status === 'Confirmed').length;
      const pendingCount = reservationsList.filter(r => r.status === 'Pending').length;
      const cancelledCount = reservationsList.filter(r => r.status === 'Cancelled').length;
      const cancellationRate = totalReservations > 0 ? parseFloat(((cancelledCount / totalReservations) * 100).toFixed(1)) : 0;

      data.guestRows = guestRows;
      data.reservationRows = reservationRows;
      data.totalGuestsCount = uniqueGuestsInRange.length;
      data.newGuestsCount = newGuestsCount;
      data.returningGuestsCount = returningGuestsCount;
      data.averageStayLength = parseFloat(avgStay.toFixed(1));
      data.mostFrequentGuest = mostFrequentGuest;
      data.maxVisits = maxVisits;
      data.totalReservations = totalReservations;
      data.confirmedCount = confirmedCount;
      data.pendingCount = pendingCount;
      data.cancelledCount = cancelledCount;
      data.cancellationRate = cancellationRate;

    // =========================================================================
    // LEGACY FALLBACKS (Reservations, Payments, Billing if queried individually)
    // =========================================================================
    } else if (report === 'reservations') {
      const resList = await dbQuery(`
        SELECT r.reservationID, 
               DATE_FORMAT(r.reservationDateTime, '%Y-%m-%dT%H:%i:%s') as reservationDateTime, 
               r.status, g.firstName, g.lastName, g.contact, g.email, rm.roomNumber, rt.type as roomType
        FROM reservation r
        JOIN guest g ON g.guestID = r.guestID
        JOIN room rm ON rm.roomID = r.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE DATE(r.reservationDateTime) BETWEEN ? AND ?
        ORDER BY r.reservationDateTime DESC
      `, [from, to]);

      data.reservationRows = resList.map(r => ({
        reservationID: r.reservationID,
        guestName: `${r.firstName} ${r.lastName || ''}`.trim(),
        contact: r.contact || '—',
        email: r.email || '—',
        roomNumber: r.roomNumber,
        roomType: r.roomType,
        reservationDate: r.reservationDateTime ? new Date(r.reservationDateTime).toLocaleDateString() : '—',
        checkInDate: r.reservationDateTime ? new Date(r.reservationDateTime).toLocaleDateString() : '—',
        status: r.status
      }));
      data.totalReservations = resList.length;
      data.confirmedCount = resList.filter(r => r.status === 'Confirmed').length;
      data.pendingCount = resList.filter(r => r.status === 'Pending').length;
      data.cancelledCount = resList.filter(r => r.status === 'Cancelled').length;

    } else if (report === 'payments') {
      const paymentsList = await dbQuery(`
        SELECT p.paymentID, DATE_FORMAT(p.paymentDate, '%Y-%m-%dT%H:%i:%s') as paymentDate, p.amount, pm.paymentMethod, p.isFullyPaid,
               bil.billingID, bil.bookingID, g.firstName, g.lastName
        FROM payment p
        JOIN billing bil ON bil.billingID = p.billingID
        JOIN booking b ON b.bookingID = bil.bookingID
        JOIN guest g ON g.guestID = b.guestID
        LEFT JOIN payment_method pm ON pm.paymentMethodID = p.paymentMethodID
        WHERE DATE(p.paymentDate) BETWEEN ? AND ?
        ORDER BY p.paymentDate DESC
      `, [from, to]);

      let totalPaymentAmount = 0;
      let cashTotal = 0;
      let gcashTotal = 0;

      data.paymentRows = paymentsList.map(p => {
        const amt = parseFloat(p.amount || 0);
        totalPaymentAmount += amt;
        const method = p.paymentMethod || 'Cash';
        if (method.toLowerCase().includes('gcash')) gcashTotal += amt;
        else cashTotal += amt;
        return {
          paymentID: p.paymentID,
          paymentDate: p.paymentDate ? new Date(p.paymentDate).toLocaleString() : '—',
          guestName: `${p.firstName} ${p.lastName || ''}`.trim(),
          bookingID: p.bookingID,
          billingID: p.billingID,
          amount: amt,
          paymentMethod: method,
          status: p.isFullyPaid ? 'Fully Paid' : 'Partial'
        };
      });
      data.totalPaymentsCount = paymentsList.length;
      data.totalPaymentAmount = totalPaymentAmount;
      data.cashTotal = cashTotal;
      data.gcashTotal = gcashTotal;

    } else if (report === 'billing') {
      const billingList = await dbQuery(`
        SELECT bil.billingID, DATE_FORMAT(bil.billingDateTime, '%Y-%m-%dT%H:%i:%s') as billingDate, b.status as billingStatus, bil.bookingID,
               g.firstName, g.lastName, rm.roomNumber,
               (SELECT COALESCE(SUM(p.amount), 0) FROM payment p WHERE p.billingID = bil.billingID) as totalPaid
        FROM billing bil
        JOIN booking b ON b.bookingID = bil.bookingID
        JOIN guest g ON g.guestID = b.guestID
        JOIN room rm ON rm.roomID = b.roomID
        WHERE DATE(bil.billingDateTime) BETWEEN ? AND ?
        ORDER BY bil.billingDateTime DESC
      `, [from, to]);

      let totalCollected = 0;
      data.billingRows = billingList.map(b => {
        const paid = parseFloat(b.totalPaid || 0);
        totalCollected += paid;
        return {
          billingID: b.billingID,
          bookingID: b.bookingID,
          guestName: `${b.firstName} ${b.lastName || ''}`.trim(),
          roomNumber: b.roomNumber,
          billingDate: b.billingDate ? new Date(b.billingDate).toLocaleDateString() : '—',
          status: b.billingStatus,
          totalPaid: paid
        };
      });
      data.totalBillingsCount = billingList.length;
      data.totalCollected = totalCollected;
    }

    return NextResponse.json({
      report,
      from,
      to,
      grouping,
      roomID: rawRoomID || 'ALL',
      roomTypeID,
      itemClassification,
      paymentMethod,
      discountType: discountFilter,
      movementType,
      fulfillmentStatus,
      filterOptions: {
        rooms: roomsList,
        roomTypes: roomTypesList,
        discounts: discountsList
      },
      data
    });
  } catch (error) {
    console.error("Failed to generate report:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
