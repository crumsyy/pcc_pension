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
      connectTimeout: 5000, // 5 seconds connect timeout
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

export async function ensureProfilePictureSchema() {
  try {
    const conn = await getDbConnection();
    await conn.execute("ALTER TABLE guest ADD COLUMN profilePicture VARCHAR(255) NULL").catch(() => {});
    await conn.execute("ALTER TABLE user ADD COLUMN profilePicture VARCHAR(255) NULL").catch(() => {});
  } catch (e) {}
}

export async function ensureTestModeSchema() {
  try {
    const conn = await getDbConnection();
    await conn.execute("ALTER TABLE transactions ADD COLUMN testMode TINYINT(1) NOT NULL DEFAULT 1").catch(() => {});
    await conn.execute("ALTER TABLE payment ADD COLUMN testMode TINYINT(1) NOT NULL DEFAULT 1").catch(() => {});
  } catch (e) {}
}

export async function ensureBillingAuditSchema() {
  try {
    const conn = await getDbConnection();
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS billing_audit (
        auditID INT AUTO_INCREMENT PRIMARY KEY,
        billingID INT NULL,
        bookingID INT NOT NULL,
        transactionType VARCHAR(50) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        balanceBefore DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        balanceAfter DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        userID INT NULL,
        userName VARCHAR(150) NULL,
        userRole VARCHAR(50) NULL,
        description TEXT NULL,
        referenceNumber VARCHAR(100) NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bookingID (bookingID),
        INDEX idx_billingID (billingID),
        INDEX idx_createdAt (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});
  } catch (e) {
    console.error("Error ensuring billing audit schema:", e);
  }
}

export async function logBillingAudit(connOrDb, {
  billingID = null,
  bookingID,
  transactionType,
  amount = 0,
  balanceBefore = 0,
  balanceAfter = 0,
  userID = null,
  userName = null,
  userRole = null,
  description = null,
  referenceNumber = null
}) {
  try {
    await ensureBillingAuditSchema();
    const executor = connOrDb || (await getDbConnection());
    await executor.execute(
      `INSERT INTO billing_audit 
        (billingID, bookingID, transactionType, amount, balanceBefore, balanceAfter, userID, userName, userRole, description, referenceNumber, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        billingID || null,
        bookingID,
        transactionType,
        parseFloat(amount || 0),
        parseFloat(balanceBefore || 0),
        parseFloat(balanceAfter || 0),
        userID || null,
        userName || null,
        userRole || null,
        description || null,
        referenceNumber || null
      ]
    );
  } catch (err) {
    console.error("Failed to log billing audit:", err);
  }
}

export async function syncRoomStatuses() {
  try {
    const conn = await getDbConnection();

    // 1. Auto-update unarrived bookings past scheduled check-in + 1-hour grace period to 'No Show'
    try {
      const [noShowBookings] = await conn.execute(`
        SELECT b.bookingID, b.guestID, g.userID as guestUserID, g.firstName, g.lastName, b.checkInDateTime, b.roomID
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        WHERE b.status IN ('Pending Check-in', 'Confirmed', 'Pending', 'Booked')
          AND b.checkInDateTime < DATE_SUB(NOW(), INTERVAL 1 HOUR)
      `);

      for (const b of noShowBookings) {
        await conn.execute("UPDATE booking SET status = 'No Show' WHERE bookingID = ?", [b.bookingID]);
        
        // Notify Guest
        if (b.guestUserID) {
          await conn.execute(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Booking Marked as No Show', ?)",
            [b.guestUserID, `Booking #${b.bookingID} was marked as No Show due to missed arrival after exceeding the 1-hour grace period. Please contact Front Desk if you need assistance.`]
          );
        }

        // Notify Receptionists only (roleID = 2, excluding Admins roleID = 1)
        const [receptionists] = await conn.execute("SELECT userID FROM user WHERE roleID = 2 AND status = 'Active'");
        for (const s of receptionists) {
          await conn.execute(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'No Show Alert', ?)",
            [s.userID, `Booking #${b.bookingID} for ${b.firstName} ${b.lastName} has been marked as No Show after exceeding the 1-hour grace period.`]
          );
        }
      }
    } catch (eNoShowErr) {
      console.error("Auto No-Show update failed:", eNoShowErr);
    }

    // 1b. Auto-update unarrived reservations past scheduled check-in + 1-hour grace period to 'No Show'
    try {
      const [noShowReservations] = await conn.execute(`
        SELECT r.reservationID, r.guestID, r.roomID, r.reservationDateTime, r.checkOutDateTime,
               g.userID as guestUserID, g.firstName, g.lastName, rm.roomNumber
        FROM reservation r
        JOIN guest g ON g.guestID = r.guestID
        JOIN room rm ON rm.roomID = r.roomID
        WHERE r.status IN ('Confirmed', 'Pending')
          AND r.reservationID NOT IN (SELECT reservationID FROM booking WHERE reservationID IS NOT NULL AND status IN ('Checked In', 'Late Checkout', 'Completed'))
          AND (r.reservationDateTime < DATE_SUB(NOW(), INTERVAL 1 HOUR) OR NOW() > r.checkOutDateTime)
      `);

      for (const r of noShowReservations) {
        await conn.execute("UPDATE reservation SET status = 'No Show' WHERE reservationID = ?", [r.reservationID]);

        // Notify Guest
        if (r.guestUserID) {
          await conn.execute(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Reservation Marked as No Show', ?)",
            [
              r.guestUserID,
              `Your reservation #${r.reservationID} for Room ${r.roomNumber} has been marked as No Show after exceeding the 1-hour grace period. Room hold has been released.`
            ]
          );
        }

        // Notify Receptionists only (roleID = 2, excluding Admins roleID = 1)
        const [receptionists] = await conn.execute("SELECT userID FROM user WHERE roleID = 2 AND status = 'Active'");
        for (const s of receptionists) {
          await conn.execute(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Reservation No Show Alert', ?)",
            [
              s.userID,
              `Reservation #${r.reservationID} for Room ${r.roomNumber} (${r.firstName} ${r.lastName}) has been marked as No Show after exceeding the 1-hour grace period. Room is released back to Available.`
            ]
          );
        }
      }
    } catch (eResNoShowErr) {
      console.error("Auto Reservation No-Show update failed:", eResNoShowErr);
    }

    // 2. Auto-update Checked-In Bookings past checkout time to 'Late Checkout'
    try {
      const [lateCheckoutBookings] = await conn.execute(`
        SELECT b.bookingID, b.guestID, g.userID as guestUserID, g.firstName, g.lastName, b.checkOutDateTime
        FROM booking b
        JOIN guest g ON g.guestID = b.guestID
        WHERE b.status = 'Checked In'
          AND NOW() > b.checkOutDateTime
      `);

      for (const b of lateCheckoutBookings) {
        await conn.execute("UPDATE booking SET status = 'Late Checkout' WHERE bookingID = ?", [b.bookingID]);

        if (b.guestUserID) {
          await conn.execute(
            "INSERT INTO notification (userID, title, message) VALUES (?, 'Late Check-out Notice', ?)",
            [b.guestUserID, `Your scheduled checkout time for Booking #${b.bookingID} has passed. Late checkout fee (₱100.00/hr past 12:00 PM) applies until stay checkout is completed.`]
          );
        }
      }
    } catch (eLateCheckoutErr) {
      console.error("Auto Late Checkout update failed:", eLateCheckoutErr);
    }

    // 3. Update room statuses dynamically:
    // Occupied if any Checked In or Late Checkout booking exists; Reserved if active Pending Check-in booking OR Confirmed/Overdue reservation exists; Available otherwise
    await conn.execute(`
      UPDATE room r
      LEFT JOIN (
        SELECT roomID, 
               CASE 
                 WHEN SUM(CASE WHEN status IN ('Checked In', 'Late Checkout') THEN 1 ELSE 0 END) > 0 THEN 'Occupied'
                 WHEN SUM(CASE WHEN status IN ('Pending Check-in', 'Overdue Check-In') OR (status IN ('Confirmed', 'Pending', 'Booked') AND checkInDateTime >= DATE_SUB(NOW(), INTERVAL 1 HOUR))) > 0 THEN 'Reserved'
                 ELSE 'Available'
               END as calcStatus
        FROM booking
        WHERE status IN ('Checked In', 'Late Checkout', 'Pending Check-in', 'Overdue Check-In', 'Confirmed', 'Pending', 'Booked')
        GROUP BY roomID
      ) b ON r.roomID = b.roomID
      LEFT JOIN (
        SELECT roomID, COUNT(*) as activeResCount
        FROM reservation
        WHERE status IN ('Confirmed', 'Pending', 'Overdue Check-In')
          AND reservationDateTime >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
        GROUP BY roomID
      ) res ON r.roomID = res.roomID
      SET r.status = CASE 
        WHEN b.calcStatus = 'Occupied' THEN 'Occupied'
        WHEN b.calcStatus = 'Reserved' OR (b.calcStatus IS NULL AND COALESCE(res.activeResCount, 0) > 0) THEN 'Reserved'
        ELSE 'Available'
      END
      WHERE r.isArchived = 0 AND r.status != 'Under Maintenance'
    `);
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

let isInquirySchemaChecked = false;

export async function ensureInquirySchema() {
  if (isInquirySchemaChecked) return;
  try {
    const conn = await getDbConnection();
    // 1. Add contactNumber column to inquiry if missing
    const [inqCols] = await conn.execute("SHOW COLUMNS FROM inquiry LIKE 'contactNumber'");
    if (inqCols.length === 0) {
      await conn.execute("ALTER TABLE inquiry ADD COLUMN contactNumber VARCHAR(50) NULL AFTER email");
    }

    // 1b. Add deliveryTime column to orders if missing
    const [delCols] = await conn.execute("SHOW COLUMNS FROM orders LIKE 'deliveryTime'");
    if (delCols.length === 0) {
      await conn.execute("ALTER TABLE orders ADD COLUMN deliveryTime VARCHAR(50) NULL AFTER orderStatus");
    }

    // 2. Add unreadGuest and unreadReceptionist columns if missing
    const [unreadG] = await conn.execute("SHOW COLUMNS FROM inquiry LIKE 'unreadGuest'");
    if (unreadG.length === 0) {
      await conn.execute("ALTER TABLE inquiry ADD COLUMN unreadGuest INT DEFAULT 0, ADD COLUMN unreadReceptionist INT DEFAULT 0");
    }

    // 3. Modify status column to support 'Pending', 'Responded', 'Closed'
    await conn.execute("ALTER TABLE inquiry MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Pending'");

    // 4. Create inquiry_message table if not exists
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS inquiry_message (
        messageID INT AUTO_INCREMENT PRIMARY KEY,
        inquiryID INT NOT NULL,
        senderType ENUM('Guest', 'Receptionist', 'System') NOT NULL,
        senderName VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        isRead TINYINT(1) DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (inquiryID)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Migrate legacy message/response in inquiry table to inquiry_message table if inquiry_message is empty
    const [msgCheck] = await conn.execute("SELECT messageID FROM inquiry_message LIMIT 1");
    if (msgCheck.length === 0) {
      const [existingInquiries] = await conn.execute("SELECT inquiryID, name, message, response, createdAt FROM inquiry");
      for (const inq of existingInquiries) {
        if (inq.message) {
          await conn.execute(
            "INSERT INTO inquiry_message (inquiryID, senderType, senderName, message, isRead, timestamp) VALUES (?, 'Guest', ?, ?, 1, ?)",
            [inq.inquiryID, inq.name || 'Guest', inq.message, inq.createdAt]
          );
        }
        if (inq.response) {
          await conn.execute(
            "INSERT INTO inquiry_message (inquiryID, senderType, senderName, message, isRead, timestamp) VALUES (?, 'Receptionist', 'Front Desk', ?, 1, ?)",
            [inq.inquiryID, inq.response, inq.createdAt]
          );
        }
      }
    }
    isInquirySchemaChecked = true;
  } catch (error) {
    console.error("Failed to ensure inquiry schema:", error);
  }
}

export function computeLateCheckOutFee(checkOutDateTime, actualOrCurrentTime = new Date(), roomRate = 0) {
  if (!checkOutDateTime) return { fee: 0, hours: 0 };
  const scheduledCheckOut = new Date(String(checkOutDateTime).replace(' ', 'T'));
  if (isNaN(scheduledCheckOut.getTime())) return { fee: 0, hours: 0 };

  const endTime = actualOrCurrentTime instanceof Date 
    ? actualOrCurrentTime 
    : new Date(String(actualOrCurrentTime).replace(' ', 'T'));
    
  if (isNaN(endTime.getTime()) || endTime <= scheduledCheckOut) {
    return { fee: 0, hours: 0 };
  }

  const diffMs = endTime.getTime() - scheduledCheckOut.getTime();
  const totalLateHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));

  let fee = 0;
  if (totalLateHours <= 22) {
    fee = totalLateHours * 100; // ₱100.00 per hour
  } else {
    const fullDays = Math.floor(totalLateHours / 24);
    const remainderHours = totalLateHours % 24;
    const rate = parseFloat(roomRate) || 1500;
    if (fullDays > 0) {
      fee = (fullDays * rate) + (remainderHours > 0 ? (remainderHours <= 22 ? remainderHours * 100 : rate) : 0);
    } else {
      fee = rate;
    }
  }

  return { fee: Math.round(fee * 100) / 100, hours: totalLateHours };
}

export async function getBookingBalanceDetails(bookingID) {
  try {
    const bookingRes = await dbQuery(`
      SELECT b.bookingID, DATE_FORMAT(b.checkInDateTime, '%Y-%m-%d %H:%i:%s') as checkInDateTime, 
             DATE_FORMAT(b.checkOutDateTime, '%Y-%m-%d %H:%i:%s') as checkOutDateTime, 
             b.status, b.guestID, b.roomID,
             rm.roomNumber, rm.floorID, rm.occupancyLimit, rt.type as roomType, rt.roomTypeID,
             g.firstName, g.lastName, g.contact, g.email
      FROM booking b
      JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE b.bookingID = ?
    `, [bookingID]);

    if (bookingRes.length === 0) {
      return {
        booking: null,
        subtotal: 0,
        paidTotal: 0,
        balance: 0
      };
    }

    const booking = bookingRes[0];

    const rateRes = await dbQuery(
      "SELECT rate FROM room_rate WHERE roomTypeID = ? AND floorID = ? AND breakfastID = 1",
      [booking.roomTypeID, booking.floorID]
    );
    const rate = rateRes[0]?.rate ? parseFloat(rateRes[0].rate) : 1500;

    const checkIn = new Date(booking.checkInDateTime);
    const checkOut = new Date(booking.checkOutDateTime);
    const diffTime = Math.abs(checkOut - checkIn);
    const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const baseRoomCharge = rate * nights;

    const guestsList = await dbQuery(`
      SELECT bg.*, 
             COALESCE(d.name, p.name) as discountName,
             COALESCE(d.percentage, p.percentage, 0) as discountPercentage
      FROM booking_guest_details bg
      LEFT JOIN discounts d ON d.discountID = bg.discountID
      LEFT JOIN promotions p ON p.promotionID = bg.promotionID
      WHERE bg.bookingID = ?
    `, [bookingID]);

    let finalGuestsList = guestsList.length > 0 ? [...guestsList] : [{
      bookingGuestID: 0,
      bookingID,
      fullName: `${booking.firstName} ${booking.lastName}`,
      age: 30,
      discountID: null,
      promotionID: null,
      discountIdNumber: null,
      discountName: null,
      discountPercentage: 0
    }];

    const totalGuestsCount = finalGuestsList.length;
    const maxOccupancy = parseInt(booking.occupancyLimit) || 2;
    const extraGuests = Math.max(0, totalGuestsCount - maxOccupancy);
    const extraGuestFee = extraGuests * 100 * nights;
    const roomCharge = baseRoomCharge + extraGuestFee;

    const sharePerGuest = roomCharge / totalGuestsCount;
    let totalDiscount = 0;

    finalGuestsList = finalGuestsList.map(g => {
      const discountPercentage = g.discountPercentage ? parseFloat(g.discountPercentage) : 0;
      const discountAmount = sharePerGuest * (discountPercentage / 100);
      totalDiscount += discountAmount;
      return {
        ...g,
        share: sharePerGuest,
        discount: discountAmount,
        netShare: sharePerGuest - discountAmount
      };
    });

    const finalRoomCharge = Math.max(0, roomCharge - totalDiscount);

    const cleanCheckInDate = (booking.checkInDateTime || '').replace('T', ' ');

    const [productCharges, amenityCharges, incidentalCharges, billingRes] = await Promise.all([
      dbQuery(`
        SELECT op.orderProductID, op.quantity, p.name, 
               CASE WHEN op.isComplimentary = 1 THEN 0 ELSE p.price END as price, 
               CASE WHEN op.isComplimentary = 1 THEN 0 ELSE (op.quantity * p.price) END as subtotal
        FROM order_product op
        JOIN products p ON p.productID = op.productID
        JOIN orders o ON o.orderID = op.orderID
        WHERE o.guestID = ? 
          AND o.orderDateTime >= DATE_SUB(?, INTERVAL 12 HOUR) 
          AND o.orderStatus != 'Canceled'
          AND o.orderID NOT IN (SELECT orderID FROM billing WHERE orderID IS NOT NULL)
      `, [booking.guestID, cleanCheckInDate]),
      dbQuery(`
        SELECT oa.orderAmenityID, oa.quantity, a.name, a.price, (oa.quantity * a.price) as subtotal
        FROM order_amenities oa
        JOIN amenities a ON a.amenityID = oa.amenityID
        JOIN orders o ON o.orderID = oa.orderID
        WHERE o.guestID = ? 
          AND o.orderDateTime >= DATE_SUB(?, INTERVAL 12 HOUR) 
          AND o.orderStatus != 'Canceled'
          AND o.orderID NOT IN (SELECT orderID FROM billing WHERE orderID IS NOT NULL)
      `, [booking.guestID, cleanCheckInDate]),
      dbQuery(
        "SELECT chargeID, description, amount, createdAt FROM incidental_charge WHERE bookingID = ?",
        [bookingID]
      ),
      dbQuery("SELECT billingID FROM billing WHERE bookingID = ? ORDER BY billingID DESC LIMIT 1", [bookingID])
    ]);

    const productTotal = Math.round(productCharges.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0) * 100) / 100;
    const amenityTotal = Math.round(amenityCharges.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0) * 100) / 100;
    const ordersTotal = Math.round((productTotal + amenityTotal) * 100) / 100;

    // Check if Early Check-In is recorded in incidental charges
    const earlyCheckInIncidental = incidentalCharges.find(ic =>
      ic.description && ic.description.toLowerCase().includes('early check-in')
    );
    let earlyCheckInFee = earlyCheckInIncidental ? parseFloat(earlyCheckInIncidental.amount) : 0;

    // Filter incidentalTotal to exclude extra capacity charge if already accounted in roomCharge and early check-in
    const filteredIncidentals = incidentalCharges.filter(ic => 
      !(ic.description && ic.description.toLowerCase().includes('extra capacity charge')) &&
      !(ic.description && ic.description.toLowerCase().includes('early check-in'))
    );
    const regularIncidentalTotal = Math.round(filteredIncidentals.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) * 100) / 100;
    const totalIncidentalsWithEarly = Math.round((regularIncidentalTotal + earlyCheckInFee) * 100) / 100;

    // Hourly Late Check-out Fee (₱100/hr for 1-22 hrs, full day rate if >22 hrs)
    const endCheckoutTime = (booking.status === 'Checked In' || booking.status === 'Late Checkout')
      ? new Date() 
      : new Date(booking.checkOutDateTime);

    const { fee: lateCheckOutFee, hours: lateHours } = computeLateCheckOutFee(
      booking.checkOutDateTime,
      endCheckoutTime,
      rate
    );

    const totalAdditionalFees = Math.round((extraGuestFee + earlyCheckInFee + lateCheckOutFee) * 100) / 100;

    // Subtotal = Room base rate + additional fees + incidental fees + orders - totalDiscount
    const subtotal = Math.max(0, Math.round((baseRoomCharge + totalAdditionalFees + regularIncidentalTotal + ordersTotal - totalDiscount) * 100) / 100);

    const billingID = billingRes[0]?.billingID || null;
    let paidTotal = 0;
    let paymentsList = [];

    if (billingID) {
      paymentsList = await dbQuery(
        `SELECT p.paymentID, p.amount, DATE_FORMAT(p.paymentDate, '%Y-%m-%d %H:%i:%s') as paymentDate,
                p.isFullyPaid, pm.paymentMethod, p.cashReceived, p.\`change\`,
                COALESCE(p.testMode, 0) as testMode
         FROM payment p
         LEFT JOIN payment_method pm ON pm.paymentMethodID = p.paymentMethodID
         WHERE p.billingID = ?
         ORDER BY p.paymentDate DESC, p.paymentID DESC`,
        [billingID]
      );
      paidTotal = Math.round(paymentsList.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) * 100) / 100;
    }

    let balance = Math.max(0, Math.round((subtotal - paidTotal) * 100) / 100);

    // Clear remaining balance to ₱0.00 upon checkout or completion
    if ((booking.status === 'Checked Out' || booking.status === 'Completed' || booking.status === 'Cancelled') || balance <= 0.05) {
      balance = 0;
    }

    let auditLogs = [];
    try {
      auditLogs = await dbQuery(
        `SELECT auditID, billingID, bookingID, transactionType, amount,
                balanceBefore, balanceAfter, userID, userName, userRole,
                description, referenceNumber,
                DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s') as createdAt
         FROM billing_audit
         WHERE bookingID = ?
         ORDER BY createdAt DESC, auditID DESC
         LIMIT 100`,
        [bookingID]
      );
    } catch (e) {}

    const chargesSummary = {
      room: finalRoomCharge,
      baseRoomCharge,
      originalRoomCharge: roomCharge,
      totalDiscount,
      sharePerGuest,
      totalGuests: totalGuestsCount,
      extraGuests,
      extraGuestFee,
      earlyCheckIn: earlyCheckInFee,
      lateCheckOut: lateCheckOutFee,
      lateHours,
      lateCheckOutRule: '1-22 hrs: ₱100/hr | >22 hrs: Full room rate',
      totalAdditionalFees,
      products: productTotal,
      amenities: amenityTotal,
      orders: ordersTotal,
      incidentals: regularIncidentalTotal, // strictly regular incidentals (damages/penalties)
      totalIncidentalsWithEarly,
      total: subtotal,
      subtotal,
      paid: paidTotal,
      balance,
      remainingBalance: balance
    };

    return {
      booking,
      nights,
      rate,
      baseRoomCharge,
      extraGuests,
      extraGuestFee,
      roomCharge,
      totalGuestsCount,
      sharePerGuest,
      finalGuestsList,
      totalDiscount,
      finalRoomCharge,
      earlyCheckInFee,
      lateCheckOutFee,
      lateHours,
      lateCheckOutRule: '1-22 hrs: ₱100/hr | >22 hrs: Full room rate',
      totalAdditionalFees,
      productTotal,
      amenityTotal,
      ordersTotal,
      incidentalTotal: regularIncidentalTotal,
      regularIncidentalTotal,
      totalIncidentalsWithEarly,
      productCharges,
      amenityCharges,
      incidentalCharges: filteredIncidentals,
      allIncidentalCharges: incidentalCharges,
      subtotal,
      paidTotal,
      balance,
      remainingBalance: balance,
      billingID,
      paymentsList,
      auditLogs,
      chargesSummary
    };
  } catch (error) {
    console.error("Error in getBookingBalanceDetails:", error);
    return {
      booking: null,
      subtotal: 0,
      paidTotal: 0,
      balance: 0,
      remainingBalance: 0,
      chargesSummary: {
        room: 0,
        total: 0,
        paid: 0,
        balance: 0,
        remainingBalance: 0
      }
    };
  }
}

export async function getBookingBalance(bookingID) {
  const details = await getBookingBalanceDetails(bookingID);
  return details.balance || 0;
}

export async function completeBookingAndFreeRoom(bookingID, options = {}) {
  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [bookingRows] = await conn.execute(
      "SELECT bookingID, roomID, status, guestID FROM booking WHERE bookingID = ? FOR UPDATE",
      [bookingID]
    );

    if (bookingRows.length === 0) {
      await conn.rollback();
      return { error: 'Booking not found.' };
    }

    const b = bookingRows[0];

    // Idempotency: If already completed, commit and return current state
    if (b.status === 'Completed') {
      await conn.commit();
      return { success: true, bookingID, status: 'Completed', roomStatus: 'Available', alreadyCompleted: true };
    }

    const localNow = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

    // 1. Update booking status to 'Completed'
    await conn.execute(
      "UPDATE booking SET status = 'Completed', checkOutDateTime = ? WHERE bookingID = ?",
      [nowStr, bookingID]
    );

    // 2. Free room to 'Available'
    if (b.roomID) {
      await conn.execute(
        "UPDATE room SET status = 'Available' WHERE roomID = ? AND (isArchived IS NULL OR isArchived = 0)",
        [b.roomID]
      );
    }

    // 3. Update reservation status to 'Completed'
    await conn.execute(
      "UPDATE reservation SET status = 'Completed' WHERE reservationID = (SELECT reservationID FROM booking WHERE bookingID = ?) OR (roomID = ? AND guestID = ? AND status IN ('Pending', 'Confirmed', 'Booked', 'Checked In'))",
      [bookingID, b.roomID, b.guestID]
    );

    // 4. Auto-return active borrowed amenities
    await conn.execute(
      "UPDATE borrow_transaction SET status = 'Returned', conditionUponReturn = 'Good', actualReturnDate = ?, remarks = 'Auto-returned upon check-out completion' WHERE bookingID = ? AND status = 'Borrowed'",
      [nowStr, bookingID]
    );

    await conn.commit();
    return { success: true, bookingID, status: 'Completed', roomStatus: 'Available' };
  } catch (err) {
    await conn.rollback();
    console.error("Error in completeBookingAndFreeRoom:", err);
    throw err;
  } finally {
    conn.release();
  }
}

