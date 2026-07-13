import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, getDbConnection, syncInventoryStock } from '@/lib/db';

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
      WHERE b.status IN ('Checked In', 'Pending Check-in')
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

    const localNow = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const nowStr = `${localNow.getFullYear()}-${pad(localNow.getMonth() + 1)}-${pad(localNow.getDate())} ${pad(localNow.getHours())}:${pad(localNow.getMinutes())}:${pad(localNow.getSeconds())}`;

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
          "INSERT INTO billing (billingDateTime, guestID, bookingID, orderID) VALUES (?, ?, ?, NULL)",
          [nowStr, guestID, bookingID]
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
        "INSERT INTO transactions (transactionDateTime, billingID, paymentID) VALUES (?, ?, ?)",
        [nowStr, billingID, paymentID]
      );

      // 5. If checkout requested, update booking and room statuses
      if (shouldCheckout) {
        const [bookingRes] = await connection.execute("SELECT roomID FROM booking WHERE bookingID = ?", [bookingID]);
        if (bookingRes.length > 0) {
          const roomID = bookingRes[0].roomID;
          await connection.execute("UPDATE booking SET status = 'Checked Out', checkOutDateTime = ? WHERE bookingID = ?", [nowStr, bookingID]);
          await connection.execute("UPDATE room SET status = 'Available' WHERE roomID = ?", [roomID]);

          // 6. Auto-return all borrowed amenities that are still outstanding
          const [borrows] = await connection.execute(
            "SELECT * FROM borrow_transaction WHERE bookingID = ? AND status = 'Borrowed'",
            [bookingID]
          );
          for (const borrow of borrows) {
            // Update status of borrow log
            await connection.execute(
              `UPDATE borrow_transaction 
               SET status = 'Returned', conditionUponReturn = 'Good', actualReturnDate = ?, remarks = 'Auto-returned upon perfect check-out' 
               WHERE borrowID = ?`,
              [nowStr, borrow.borrowID]
            );

            // Fetch last batchID for this item
            const [batches] = await connection.execute(
              "SELECT batchID FROM inventory_batch WHERE itemType = ? AND itemID = ? ORDER BY dateReceived DESC LIMIT 1",
              [borrow.itemType, borrow.itemID]
            );
            let batchID = null;
            if (batches.length > 0) {
              batchID = batches[0].batchID;
              await connection.execute(
                "UPDATE inventory_batch SET remainingQuantity = remainingQuantity + ? WHERE batchID = ?",
                [borrow.quantity, batchID]
              );
            }

            // Insert movement log
            await connection.execute(
              `INSERT INTO inventory_movement (itemType, itemID, quantity, userID, movementType, referenceNumber, remarks, batchID)
               VALUES (?, ?, ?, ?, 'Return', ?, 'Auto-returned upon perfect check-out', ?)`,
              [borrow.itemType, borrow.itemID, borrow.quantity, session.userID || staffID, `BOR-${borrow.borrowID}`, batchID]
            );

            // Update item quantity
            if (borrow.itemType === 'Amenity') {
              await connection.execute("UPDATE amenities SET quantity = quantity + ? WHERE amenityID = ?", [borrow.quantity, borrow.itemID]);
            } else {
              await connection.execute("UPDATE products SET quantity = quantity + ? WHERE productID = ?", [borrow.quantity, borrow.itemID]);
            }
          }
        }
      }

      await connection.commit();
      await syncInventoryStock();
      return NextResponse.json({ success: true, message: 'Payment recorded and checkout completed successfully.', billingID, paymentID });
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
