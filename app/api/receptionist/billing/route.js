import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Receptionist' && session.role !== 'Administrator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bookingID = parseInt(searchParams.get('bookingID'));

  if (!bookingID) {
    return NextResponse.json({ error: 'Missing booking ID.' }, { status: 400 });
  }

  try {
    // 1. Fetch booking details
    const bookingRes = await dbQuery(`
      SELECT b.bookingID, b.checkInDateTime, b.checkOutDateTime, b.status, b.guestID, b.roomID,
             g.firstName, g.lastName, g.contact, g.email,
             rm.roomNumber, rm.floorID, rt.type as roomType, rt.roomTypeID
      FROM booking b
      JOIN guest g ON g.guestID = b.guestID
      JOIN room rm ON rm.roomID = b.roomID
      JOIN room_type rt ON rt.roomTypeID = rm.roomTypeID
      WHERE b.bookingID = ?
    `, [bookingID]);

    if (bookingRes.length === 0) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    const booking = bookingRes[0];

    // 2. Fetch room rate
    const rateRes = await dbQuery(
      "SELECT rate FROM room_rate WHERE roomTypeID = ? AND floorID = ? AND breakfastID = 1",
      [booking.roomTypeID, booking.floorID]
    );
    const rate = rateRes[0]?.rate || 0;

    // Calculate nights (min 1)
    const checkIn = new Date(booking.checkInDateTime);
    const checkOut = new Date(booking.checkOutDateTime);
    const diffTime = Math.abs(checkOut - checkIn);
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const roomCharge = rate * nights;

    // Early check-in fee (₱50 per hour early before 2:00 PM)
    let earlyCheckInFee = 0;
    const standardCheckInTime = new Date(checkIn);
    standardCheckInTime.setHours(14, 0, 0, 0);
    if (checkIn < standardCheckInTime && checkIn.toDateString() === standardCheckInTime.toDateString()) {
      const earlyHours = Math.ceil((standardCheckInTime - checkIn) / (1000 * 60 * 60));
      if (earlyHours > 0) {
        earlyCheckInFee = earlyHours * 50;
      }
    }

    // Late check-out fee (₱150 per hour extended after 12:00 PM)
    let lateCheckOutFee = 0;
    const standardCheckOutTime = new Date(checkOut);
    standardCheckOutTime.setHours(12, 0, 0, 0);
    if (checkOut > standardCheckOutTime && checkOut.toDateString() === standardCheckOutTime.toDateString()) {
      const lateHours = Math.ceil((checkOut - standardCheckOutTime) / (1000 * 60 * 60));
      if (lateHours > 0) {
        lateCheckOutFee = lateHours * 150;
      }
    }

    // 3. Fetch product orders for this stay (since check-in date)
    const productCharges = await dbQuery(`
      SELECT op.orderProductID, op.quantity, p.name, p.price, (op.quantity * p.price) as subtotal
      FROM order_product op
      JOIN products p ON p.productID = op.productID
      JOIN orders o ON o.orderID = op.orderID
      WHERE o.guestID = ? AND o.orderDateTime >= ? AND o.orderStatus IN ('Served', 'Completed')
    `, [booking.guestID, booking.checkInDateTime]);

    // 4. Fetch amenity orders for this stay
    const amenityCharges = await dbQuery(`
      SELECT oa.orderAmenityID, oa.quantity, a.name, a.price, (oa.quantity * a.price) as subtotal
      FROM order_amenities oa
      JOIN amenities a ON a.amenityID = oa.amenityID
      JOIN orders o ON o.orderID = oa.orderID
      WHERE o.guestID = ? AND o.orderDateTime >= ? AND o.orderStatus IN ('Served', 'Completed')
    `, [booking.guestID, booking.checkInDateTime]);

    const productTotal = productCharges.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
    const amenityTotal = amenityCharges.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
    const subtotalCharges = roomCharge + earlyCheckInFee + lateCheckOutFee + productTotal + amenityTotal;

    // 5. Fetch existing billing record if any
    const billingRes = await dbQuery(
      "SELECT billingID FROM billing WHERE bookingID = ?",
      [bookingID]
    );

    let billingID = billingRes[0]?.billingID || null;
    let paidTotal = 0;

    if (billingID) {
      const payments = await dbQuery(
        "SELECT amount FROM payment WHERE billingID = ?",
        [billingID]
      );
      paidTotal = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    }

    const balance = subtotalCharges - paidTotal;

    return NextResponse.json({
      success: true,
      booking: {
        ...booking,
        nights,
        rate,
        roomCharge
      },
      productCharges,
      amenityCharges,
      chargesSummary: {
        room: roomCharge,
        earlyCheckIn: earlyCheckInFee,
        lateCheckOut: lateCheckOutFee,
        products: productTotal,
        amenities: amenityTotal,
        total: subtotalCharges,
        paid: paidTotal,
        balance: balance
      },
      billingID
    });

  } catch (error) {
    console.error("Failed to calculate billing:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
