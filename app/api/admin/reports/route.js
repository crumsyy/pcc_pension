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

  try {
    const data = {};

    if (report === 'sales') {
      // 1. Fetch transactions in range
      const transactions = await dbQuery(`
        SELECT t.transactionID, t.transactionDateTime, p.amount as netAmount, pm.paymentMethod, p.paymentID, p.discountID, p.billingID, bil.bookingID
        FROM transactions t
        JOIN payment p ON p.paymentID = t.paymentID
        LEFT JOIN payment_method pm ON pm.paymentMethodID = p.paymentMethodID
        LEFT JOIN billing bil ON bil.billingID = t.billingID
        WHERE DATE(t.transactionDateTime) BETWEEN ? AND ?
        ORDER BY t.transactionDateTime ASC
      `, [from, to]);

      // 2. Fetch all bookings to compute detailed discounts
      const bookings = await dbQuery(`
        SELECT b.bookingID, DATE_FORMAT(b.checkInDateTime, '%Y-%m-%dT%H:%i:%s') as checkInDateTime, DATE_FORMAT(b.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime, b.status, COALESCE(rr.rate, 0) as roomPrice
        FROM booking b
        JOIN room r ON r.roomID = b.roomID
        JOIN room_type rt ON rt.roomTypeID = r.roomTypeID
        LEFT JOIN room_rate rr ON rr.roomTypeID = r.roomTypeID AND rr.floorID = r.floorID AND rr.breakfastID = 1
      `);

      // 3. Fetch guest details with discount percentage
      const guestDetails = await dbQuery(`
        SELECT bg.bookingID, bg.discountID, d.percentage 
        FROM booking_guest_details bg
        JOIN discounts d ON d.discountID = bg.discountID
      `);

      // Pre-compute discounts per booking ID
      const bookingDiscounts = {};
      for (const b of bookings) {
        const checkIn = new Date(b.checkInDateTime);
        const checkOut = new Date(b.checkOutDateTime);
        const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
        const roomCharge = parseFloat(b.roomPrice) * nights;

        const bookingGuests = guestDetails.filter(g => g.bookingID === b.bookingID);
        const totalGuestsCount = bookingGuests.length > 0 ? bookingGuests.length : 1;
        const sharePerGuest = roomCharge / totalGuestsCount;

        let totalDiscount = 0;
        for (const guest of bookingGuests) {
          const pct = guest.percentage ? parseInt(guest.percentage) : 0;
          totalDiscount += sharePerGuest * (pct / 100);
        }
        bookingDiscounts[b.bookingID] = totalDiscount;
      }

      // Grouping transactions in JS to handle format reliably
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
          // Get ISO week
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

      for (const tx of transactions) {
        const key = getPeriodKey(tx.transactionDateTime);
        const netAmt = parseFloat(tx.netAmount || 0);
        const discountAmt = bookingDiscounts[tx.bookingID] || 0;
        const grossAmt = netAmt + discountAmt;

        totalRevenue += netAmt;
        totalDiscountApplied += discountAmt;

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
        if (tx.paymentMethod) {
          groupedData[key].paymentMethods.add(tx.paymentMethod);
        }
      }

      const salesRows = Object.values(groupedData).map(row => {
        return {
          period: row.period,
          bookingCount: row.bookingIDs.size,
          grossRevenue: row.grossRevenue,
          discount: row.discount,
          netRevenue: row.netRevenue,
          paymentMethods: Array.from(row.paymentMethods).join(', ') || 'Cash'
        };
      });

      // Fetch overall stats
      const bookingsInRange = await dbQuery(`
        SELECT COUNT(*) as count 
        FROM booking 
        WHERE DATE(checkInDateTime) BETWEEN ? AND ?
      `, [from, to]);
      
      const completedBookingsInRange = await dbQuery(`
        SELECT COUNT(*) as count 
        FROM booking 
        WHERE status = 'Checked Out' AND DATE(checkInDateTime) BETWEEN ? AND ?
      `, [from, to]);

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
        WHERE DATE(t.transactionDateTime) BETWEEN ? AND ?
      `, [prevFromStr, prevToStr]);
      const prevRevenue = parseFloat(prevSalesRes[0]?.revenue || 0);
      const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

      data.salesRows = salesRows;
      data.totalRevenue = totalRevenue;
      data.totalSales = transactions.length;
      data.numberBookings = numberBookings;
      data.completedBookings = completedBookings;
      data.averageBookingValue = numberBookings > 0 ? (totalRevenue / numberBookings) : 0;
      data.discountApplied = totalDiscountApplied;
      data.revenueGrowth = revenueGrowth;

      // Find highest and lowest revenue month/day
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

      data.highestPeriod = highestPeriod;
      data.highestPeriodRevenue = highestRev;
      data.lowestPeriod = lowestPeriod;
      data.lowestPeriodRevenue = lowestRev === Infinity ? 0 : lowestRev;

    } else if (report === 'occupancy') {
      // 1. Fetch KPI room states
      const totalRoomsRes = await dbQuery("SELECT COUNT(*) as count FROM room WHERE isArchived = 0");
      const occupiedNowRes = await dbQuery("SELECT COUNT(*) as count FROM room WHERE status = 'Occupied' AND isArchived = 0");
      const maintenanceNowRes = await dbQuery("SELECT COUNT(*) as count FROM room WHERE status = 'Under Maintenance' AND isArchived = 0");
      const availableNowRes = await dbQuery("SELECT COUNT(*) as count FROM room WHERE status = 'Available' AND isArchived = 0");

      const totalRooms = totalRoomsRes[0]?.count || 0;
      const occupiedNow = occupiedNowRes[0]?.count || 0;
      const maintenanceNow = maintenanceNowRes[0]?.count || 0;
      const availableNow = availableNowRes[0]?.count || 0;

      // 2. Fetch booking check-ins, check-outs and reservations count
      const checkInsRes = await dbQuery("SELECT COUNT(*) as count FROM booking WHERE status IN ('Checked In', 'Checked Out') AND DATE(checkInDateTime) BETWEEN ? AND ?", [from, to]);
      const checkOutsRes = await dbQuery("SELECT COUNT(*) as count FROM booking WHERE status = 'Checked Out' AND DATE(checkOutDateTime) BETWEEN ? AND ?", [from, to]);
      const reservationsRes = await dbQuery("SELECT COUNT(*) as count FROM reservation WHERE status = 'Confirmed' AND DATE(createdAt) BETWEEN ? AND ?", [from, to]);

      // 3. Occupancy trends daily calculations
      const daysList = [];
      const start = new Date(from);
      const end = new Date(to);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        daysList.push(d.toISOString().substring(0, 10));
      }

      const activeBookings = await dbQuery(`
        SELECT DATE_FORMAT(checkInDateTime, '%Y-%m-%dT%H:%i:%s') as checkInDateTime, DATE_FORMAT(checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime, status 
        FROM booking 
        WHERE status IN ('Checked In', 'Checked Out') 
          AND DATE(checkInDateTime) <= ? AND DATE(checkOutDateTime) >= ?
      `, [to, from]);

      const occupancyTrend = daysList.map(day => {
        const occupiedCount = activeBookings.filter(b => {
          const checkIn = new Date(b.checkInDateTime).toISOString().substring(0, 10);
          const checkOut = new Date(b.checkOutDateTime).toISOString().substring(0, 10);
          return checkIn <= day && checkOut >= day;
        }).length;

        const activeTotalRooms = totalRooms - maintenanceNow;
        const rate = activeTotalRooms > 0 ? (occupiedCount / activeTotalRooms) * 100 : 0;
        return {
          date: day,
          occupied: occupiedCount,
          occupancyRate: parseFloat(rate.toFixed(1))
        };
      });

      // 4. Room type utilization
      const roomUtilRows = await dbQuery(`
        SELECT rt.type as roomType, COUNT(b.bookingID) as bookingsCount
        FROM booking b
        JOIN room rm ON rm.roomID = b.roomID
        JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
        WHERE DATE(b.checkInDateTime) BETWEEN ? AND ?
        GROUP BY rt.type
        ORDER BY bookingsCount DESC
      `, [from, to]);

      // 5. Frequently booked rooms
      const frequentlyBooked = await dbQuery(`
        SELECT r.roomNumber, COUNT(b.bookingID) as bookingCount
        FROM booking b
        JOIN room r ON r.roomID = b.roomID
        WHERE DATE(b.checkInDateTime) BETWEEN ? AND ?
        GROUP BY r.roomNumber
        ORDER BY bookingCount DESC
      `, [from, to]);

      // Calculate peak booking dates
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

      const averageOccupancy = occupancyTrend.reduce((sum, t) => sum + t.occupancyRate, 0) / (occupancyTrend.length || 1);

      data.totalRooms = totalRooms;
      data.occupiedNow = occupiedNow;
      data.availableNow = availableNow;
      data.maintenanceNow = maintenanceNow;
      data.occupancyPercentage = (totalRooms - maintenanceNow) > 0 ? ((occupiedNow / (totalRooms - maintenanceNow)) * 100) : 0;
      
      data.checkInsCount = checkInsRes[0]?.count || 0;
      data.checkOutsCount = checkOutsRes[0]?.count || 0;
      data.reservationsCount = reservationsRes[0]?.count || 0;

      data.occupancyTrend = occupancyTrend;
      data.roomUtilRows = roomUtilRows;
      data.frequentlyBooked = frequentlyBooked;
      data.peakOccupancyDate = peakOccupancyDate;
      data.peakOccupancyRate = peakOccupancyRate;
      data.lowestOccupancyDate = lowestOccupancyDate;
      data.lowestOccupancyRate = lowestOccupancyRate === 100 ? 0 : lowestOccupancyRate;
      data.averageOccupancy = parseFloat(averageOccupancy.toFixed(1));

    } else if (report === 'inventory') {
      // 1. Fetch all stock movements in range
      const movements = await dbQuery(`
        SELECT im.*, COALESCE(a.name, p.name) as itemName, ib.batchNumber, u.email as userEmail
        FROM inventory_movement im
        LEFT JOIN amenities a ON im.itemType = 'Amenity' AND a.amenityID = im.itemID
        LEFT JOIN products p ON im.itemType = 'Product' AND p.productID = im.itemID
        LEFT JOIN inventory_batch ib ON ib.batchID = im.batchID
        LEFT JOIN user u ON u.userID = im.userID
        WHERE DATE(im.movementDateTime) BETWEEN ? AND ?
        ORDER BY im.movementDateTime DESC
      `, [from, to]);

      // 2. Fetch inventory summary (received, consumed, remaining)
      // First select all catalog items
      const amenities = await dbQuery(`
        SELECT 'Amenity' as sourceTable, a.amenityID as itemID, a.name, ac.name as category, 'Amenity' as itemClass, a.minStock, a.itemType, a.unit
        FROM amenities a
        JOIN amenities_category ac ON ac.amenityCategoryID = a.amenityCategoryID
        WHERE a.isArchived = 0
      `);

      const products = await dbQuery(`
        SELECT 'Product' as sourceTable, p.productID as itemID, p.name, pc.name as category, 'Product' as itemClass, p.minStock, p.itemType, p.unit
        FROM products p
        JOIN product_category pc ON pc.productCategoryID = p.productCategoryID
        WHERE p.isArchived = 0
      `);

      const catalog = [...amenities, ...products];

      // Fetch batch data
      const batches = await dbQuery("SELECT * FROM inventory_batch");
      const borrows = await dbQuery("SELECT * FROM borrow_transaction");
      const disposals = await dbQuery("SELECT * FROM inventory_disposal");
      const allMovements = await dbQuery("SELECT * FROM inventory_movement");

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
        
        // Sums
        const received = itemBatches.reduce((sum, b) => sum + b.quantity, 0);
        const remaining = itemBatches.reduce((sum, b) => sum + b.remainingQuantity, 0);
        
        const used = allMovements
          .filter(m => m.itemType === item.itemClass && m.itemID === item.itemID && m.movementType === 'Stock Out')
          .reduce((sum, m) => sum + Math.abs(m.quantity), 0);

        const disposed = itemDisposals.reduce((sum, d) => sum + d.quantity, 0);
        const borrowed = itemBorrows.filter(b => b.status === 'Borrowed').reduce((sum, b) => sum + b.quantity, 0);
        const returned = itemBorrows.filter(b => b.status === 'Returned').reduce((sum, b) => sum + b.quantity, 0);

        const expired = itemBatches
          .filter(b => b.expirationDate && getFormatDate(b.expirationDate) < todayStr)
          .reduce((sum, b) => sum + b.remainingQuantity, 0);

        return {
          itemName: item.name,
          category: item.category,
          itemType: item.itemType, // 'Consumable' | 'Non-Consumable'
          quantityReceived: received,
          quantityUsed: used,
          remainingStock: remaining,
          lowStock: remaining <= item.minStock,
          expiredQty: expired,
          disposedQty: disposed,
          borrowedQty: item.itemType === 'Non-Consumable' ? borrowed : 0,
          returnedQty: item.itemType === 'Non-Consumable' ? returned : 0
        };
      });

      // 3. Analytics
      let mostUsedItem = '—';
      let maxUsed = 0;
      let mostBorrowed = '—';
      let maxBorrowed = 0;
      let mostDisposed = '—';
      let maxDisposed = 0;

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
      });

      data.movements = movements;
      data.summaries = summaries;
      data.mostUsedItem = mostUsedItem;
      data.maxUsed = maxUsed;
      data.mostBorrowed = mostBorrowed;
      data.maxBorrowed = maxBorrowed;
      data.mostDisposed = mostDisposed;
      data.maxDisposed = maxDisposed;

    } else if (report === 'guests') {
      // 1. Fetch guest stay logs
      const guests = await dbQuery(`
        SELECT g.guestID, g.firstName, g.lastName, g.email, g.contact,
               b.bookingID, DATE_FORMAT(b.checkInDateTime, '%Y-%m-%dT%H:%i:%s') as checkInDateTime, DATE_FORMAT(b.checkOutDateTime, '%Y-%m-%dT%H:%i:%s') as checkOutDateTime, b.status as bookingStatus,
               r.roomNumber,
               (SELECT COALESCE(SUM(p.amount), 0) FROM payment p JOIN billing bil ON bil.billingID = p.billingID WHERE bil.bookingID = b.bookingID) as amountPaid
        FROM guest g
        JOIN booking b ON b.guestID = g.guestID
        JOIN room r ON r.roomID = b.roomID
        WHERE DATE(b.checkInDateTime) BETWEEN ? AND ?
        ORDER BY b.checkInDateTime DESC
      `, [from, to]);

      // Calculate visits count
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

        // Previous stays before this checkIn
        const prevVisits = allGuestStays.filter(s => s.guestID === g.guestID && new Date(s.checkInDateTime) < checkIn).length;

        // Discount applied name
        const discountApplied = guestDetails.find(gd => gd.bookingID === g.bookingID)?.discountName || '—';

        return {
          guestName: `${g.firstName} ${g.lastName}`,
          contact: g.contact || '—',
          email: g.email || '—',
          checkIn: checkIn.toLocaleDateString(),
          checkOut: checkOut.toLocaleDateString(),
          roomNumber: g.roomNumber || '—',
          lengthOfStay: stayNights,
          amountPaid: parseFloat(g.amountPaid || 0),
          discountApplied,
          bookingStatus: g.bookingStatus,
          previousVisits: prevVisits
        };
      });

      // 2. Guest Analytics
      const uniqueGuestsInRange = Array.from(new Set(guests.map(g => g.guestID)));
      
      let newGuestsCount = 0;
      let returningGuestsCount = 0;
      let totalNights = 0;
      let visitCounts = {};
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

        if (allStaysCount > maxVisits) {
          maxVisits = allStaysCount;
          mostFrequentGuest = `${firstGuest.firstName} ${firstGuest.lastName}`;
        }
      }

      guestRows.forEach(row => {
        totalNights += row.lengthOfStay;
      });

      const avgStay = guestRows.length > 0 ? (totalNights / guestRows.length) : 0;

      data.guestRows = guestRows;
      data.newGuestsCount = newGuestsCount;
      data.returningGuestsCount = returningGuestsCount;
      data.averageStayLength = parseFloat(avgStay.toFixed(1));
      data.mostFrequentGuest = mostFrequentGuest;
      data.maxVisits = maxVisits;
    }

    return NextResponse.json({ report, from, to, grouping, data });
  } catch (error) {
    console.error("Failed to generate report:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
