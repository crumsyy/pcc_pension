import mysql from 'mysql2/promise';

let pool;

export async function getDbConnection() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000, // 10 seconds
      // Useful for SSL connections to cloud databases like TiDB Serverless or Aiven
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

export async function dbQuery(sql, params = []) {
  const db = await getDbConnection();
  const [results] = await db.execute(sql, params);
  return results;
}

export async function syncRoomStatuses() {
  try {
    const rooms = await dbQuery("SELECT roomID, roomNumber, status FROM room WHERE isArchived = 0");
    const activeBookings = await dbQuery("SELECT roomID FROM booking WHERE status = 'Checked In'");
    const activeBookingRoomIDs = new Set(activeBookings.map(b => b.roomID));
    
    const pendingCheckinBookings = await dbQuery("SELECT roomID FROM booking WHERE status = 'Pending Check-in'");
    const reservedRoomIDs = new Set(pendingCheckinBookings.map(b => b.roomID));

    for (const room of rooms) {
      if (room.status === 'Under Maintenance') {
        continue;
      }
      
      let expectedStatus = 'Available';
      if (activeBookingRoomIDs.has(room.roomID)) {
        expectedStatus = 'Occupied';
      } else if (reservedRoomIDs.has(room.roomID)) {
        expectedStatus = 'Reserved';
      }
      
      if (room.status !== expectedStatus) {
        console.log(`Sync: Room ${room.roomNumber} status changed from ${room.status} to ${expectedStatus}`);
        await dbQuery("UPDATE room SET status = ? WHERE roomID = ?", [expectedStatus, room.roomID]);
      }
    }
  } catch (error) {
    console.error("Failed to sync room statuses:", error);
  }
}

export async function syncInventoryStock() {
  try {
    const conn = await getDbConnection();
    // 1. Bulk update products
    await conn.execute(`
      UPDATE products p
      LEFT JOIN (
        SELECT itemID, SUM(remainingQuantity) as totalQty
        FROM inventory_batch
        WHERE itemType = 'Product' AND status = 'Active' AND (expirationDate IS NULL OR expirationDate >= CURDATE())
        GROUP BY itemID
      ) b ON p.productID = b.itemID
      SET p.quantity = COALESCE(b.totalQty, 0)
      WHERE p.productCategoryID != 3
    `);

    // 2. Bulk update amenities
    await conn.execute(`
      UPDATE amenities a
      LEFT JOIN (
        SELECT itemID, SUM(remainingQuantity) as totalQty
        FROM inventory_batch
        WHERE itemType = 'Amenity' AND status = 'Active' AND (expirationDate IS NULL OR expirationDate >= CURDATE())
        GROUP BY itemID
      ) b ON a.amenityID = b.itemID
      SET a.quantity = COALESCE(b.totalQty, 0)
    `);

    console.log("Sync: Inventory stock quantities synchronized in bulk successfully.");
  } catch (error) {
    console.error("Failed to sync inventory stock quantities:", error);
  }
}

export async function getBookingBalance(bookingID) {
  try {
    const bookingRes = await dbQuery(`
      SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status, b.guestID, b.roomID,
             rm.roomNumber, rm.floorID, rt.type as roomType, rt.roomTypeID,
             g.firstName, g.lastName
      FROM booking b
      JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE b.bookingID = ?
    `, [bookingID]);

    if (bookingRes.length === 0) return 0;
    const booking = bookingRes[0];

    const rateRes = await dbQuery(
      "SELECT rate FROM room_rate WHERE roomTypeID = ? AND floorID = ? AND breakfastID = 1",
      [booking.roomTypeID, booking.floorID]
    );
    const rate = rateRes[0]?.rate || 0;

    const checkIn = new Date(booking.checkInDateTime);
    const checkOut = new Date(booking.checkOutDateTime);
    const diffTime = Math.abs(checkOut - checkIn);
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const roomCharge = rate * nights;

    const guestsList = await dbQuery(`
      SELECT bg.*, 
             COALESCE(d.percentage, p.percentage) as discountPercentage
      FROM booking_guest_details bg
      LEFT JOIN discounts d ON d.discountID = bg.discountID
      LEFT JOIN promotions p ON p.promotionID = bg.promotionID
      WHERE bg.bookingID = ?
    `, [bookingID]);

    let finalGuestsList = [...guestsList];
    if (finalGuestsList.length === 0) {
      finalGuestsList = [{ discountPercentage: 0 }];
    }

    const totalGuestsCount = finalGuestsList.length;
    const sharePerGuest = roomCharge / totalGuestsCount;
    
    let totalDiscount = 0;
    for (const g of finalGuestsList) {
      const discountPercentage = g.discountPercentage ? parseInt(g.discountPercentage) : 0;
      totalDiscount += sharePerGuest * (discountPercentage / 100);
    }
    const finalRoomCharge = roomCharge - totalDiscount;

    let earlyCheckInFee = 0;
    const standardCheckInTime = new Date(checkIn);
    standardCheckInTime.setHours(14, 0, 0, 0);
    if (checkIn < standardCheckInTime && checkIn.toDateString() === standardCheckInTime.toDateString()) {
      const earlyHours = Math.ceil((standardCheckInTime - checkIn) / (1000 * 60 * 60));
      if (earlyHours > 0) earlyCheckInFee = earlyHours * 50;
    }

    let lateCheckOutFee = 0;
    const standardCheckOutTime = new Date(checkOut);
    standardCheckOutTime.setHours(12, 0, 0, 0);
    const endCheckoutTime = booking.status === 'Checked In' ? new Date() : new Date(booking.checkOutDateTime);
    if (endCheckoutTime > standardCheckOutTime) {
      const lateHours = Math.ceil((endCheckoutTime - standardCheckOutTime) / (1000 * 60 * 60));
      if (lateHours > 0) lateCheckOutFee = lateHours * 150;
    }

    const products = await dbQuery(`
      SELECT SUM(op.quantity * p.price) as total
      FROM order_product op
      JOIN products p ON p.productID = op.productID
      JOIN orders o ON o.orderID = op.orderID
      WHERE o.guestID = ? 
        AND o.orderDateTime >= DATE_SUB(?, INTERVAL 12 HOUR) 
        AND o.orderStatus != 'Canceled'
        AND o.orderID NOT IN (SELECT orderID FROM billing WHERE orderID IS NOT NULL)
    `, [booking.guestID, booking.checkInDateTime]);
    const productTotal = parseFloat(products[0]?.total || 0);

    const amenities = await dbQuery(`
      SELECT SUM(oa.quantity * a.price) as total
      FROM order_amenities oa
      JOIN amenities a ON a.amenityID = oa.amenityID
      JOIN orders o ON o.orderID = oa.orderID
      WHERE o.guestID = ? 
        AND o.orderDateTime >= DATE_SUB(?, INTERVAL 12 HOUR) 
        AND o.orderStatus != 'Canceled'
        AND o.orderID NOT IN (SELECT orderID FROM billing WHERE orderID IS NOT NULL)
    `, [booking.guestID, booking.checkInDateTime]);
    const amenityTotal = parseFloat(amenities[0]?.total || 0);

    const incidentals = await dbQuery(
      "SELECT SUM(amount) as total FROM incidental_charge WHERE bookingID = ?",
      [bookingID]
    );
    const incidentalTotal = parseFloat(incidentals[0]?.total || 0);

    const subtotal = finalRoomCharge + earlyCheckInFee + lateCheckOutFee + productTotal + amenityTotal + incidentalTotal;

    const billingRes = await dbQuery("SELECT billingID FROM billing WHERE bookingID = ?", [bookingID]);
    let paidTotal = 0;
    if (billingRes.length > 0) {
      const billingID = billingRes[0].billingID;
      const payments = await dbQuery("SELECT SUM(amount) as total FROM payment WHERE billingID = ?", [billingID]);
      paidTotal = parseFloat(payments[0]?.total || 0);
    }

    return subtotal - paidTotal;
  } catch (error) {
    console.error("Error in getBookingBalance:", error);
    return 0;
  }
}
