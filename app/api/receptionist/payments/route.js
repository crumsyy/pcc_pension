import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch checked in bookings that need checkout/payment
    const activeBookings = await dbQuery(`
      SELECT b.bookingID, b.guestID, b.roomID, b.status, b.checkInDateTime, b.checkOutDateTime,
             g.firstName, g.lastName, g.contact,
             rm.roomNumber, rt.type as roomType
      FROM booking b
      JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE b.status IN ('Checked In', 'Confirmed')
      ORDER BY rm.roomNumber
    `);

    // Fetch discounts
    const discounts = await dbQuery("SELECT discountID, name, percentage, eligibilityTypeID FROM discounts WHERE isArchived = 0");

    // Fetch payment methods
    const paymentMethods = await dbQuery("SELECT paymentMethodID, paymentMethod FROM payment_method");

    return NextResponse.json({ success: true, activeBookings, discounts, paymentMethods });
  } catch (error) {
    console.error("Failed to fetch payments checkout list:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const bookingID = parseInt(body.bookingID);
    const guestID = parseInt(body.guestID);
    const amount = parseFloat(body.amount);
    const cashReceived = parseFloat(body.cashReceived || 0);
    const change = parseFloat(body.change || 0);
    const paymentMethodID = parseInt(body.paymentMethodID);
    const discountID = body.discountID ? parseInt(body.discountID) : null;
    const shouldCheckout = true; // Always automatically check out upon payment

    if (!bookingID || !guestID || isNaN(amount) || !paymentMethodID) {
      return NextResponse.json({ error: 'Missing required payment details.' }, { status: 400 });
    }

    // 1. Fetch staffID from staff table using userID
    const staffRes = await dbQuery("SELECT staffID FROM staff WHERE userID = ?", [session.userID]);
    const staffID = staffRes[0]?.staffID || null;

    const db = await getDbConnection();
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // 2. Ensure billing record exists
      const [billingCheck] = await connection.execute("SELECT billingID FROM billing WHERE bookingID = ?", [bookingID]);
      let billingID;

      if (billingCheck.length > 0) {
        billingID = billingCheck[0].billingID;
      } else {
        const [billingInsert] = await connection.execute(
          "INSERT INTO billing (billingDateTime, guestID, bookingID, orderID) VALUES (NOW(), ?, ?, NULL)",
          [guestID, bookingID]
        );
        billingID = billingInsert.insertId;
      }

      // 3. Insert payment
      const [paymentInsert] = await connection.execute(
        `INSERT INTO payment (amount, cashReceived, \`change\`, billingID, guestID, staffID, paymentMethodID, discountID, promotionID) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [amount, cashReceived, change, billingID, guestID, staffID, paymentMethodID, discountID]
      );
      const paymentID = paymentInsert.insertId;

      // 4. Insert transaction log
      await connection.execute(
        "INSERT INTO transactions (transactionDateTime, billingID, paymentID) VALUES (NOW(), ?, ?)",
        [billingID, paymentID]
      );

      // 5. If checkout requested, update booking and room statuses
      if (shouldCheckout) {
        const [bookingRes] = await connection.execute("SELECT roomID FROM booking WHERE bookingID = ?", [bookingID]);
        if (bookingRes.length > 0) {
          const roomID = bookingRes[0].roomID;
          await connection.execute("UPDATE booking SET status = 'Checked Out', checkOutDateTime = NOW() WHERE bookingID = ?", [bookingID]);
          await connection.execute("UPDATE room SET status = 'Available' WHERE roomID = ?", [roomID]);
        }
      }

      await connection.commit();
      return NextResponse.json({ success: true, message: 'Payment recorded successfully.', billingID, paymentID });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("Failed to process payment:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
