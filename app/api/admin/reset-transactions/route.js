import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDbConnection } from '@/lib/db';

export async function POST(request) {
  try {
    const session = await getSession();
    const authHeader = request.headers.get('x-admin-reset-key');
    const expectedKey = process.env.ADMIN_RESET_SECRET || 'pcc-suite-reset-2026';

    const isAuthorizedAdmin = session && (session.role === 'Administrator' || session.roleID === 1);
    const hasValidKey = authHeader && authHeader === expectedKey;

    if (!isAuthorizedAdmin && !hasValidKey) {
      return NextResponse.json({ error: 'Unauthorized: Only Administrators can trigger a system reset.' }, { status: 401 });
    }

    const pool = await getDbConnection();
    const conn = await pool.getConnection();

    try {
      await conn.execute("SET FOREIGN_KEY_CHECKS = 0");

      const transactionalTables = [
        'transactions',
        'payment',
        'billing_room',
        'billing_product',
        'billing_amenity',
        'billing',
        'order_product',
        'order_amenities',
        'orders',
        'borrow_transaction',
        'booking_guest_details',
        'booking',
        'reservation',
        'inquiry_message',
        'inquiry',
        'notification'
      ];

      const clearedCounts = {};

      for (const table of transactionalTables) {
        const [cntRows] = await conn.execute(`SELECT COUNT(*) as count FROM \`${table}\``);
        clearedCounts[table] = cntRows[0]?.count || 0;

        await conn.execute(`DELETE FROM \`${table}\``);
        await conn.execute(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
      }

      // Clear transaction-related inventory movements
      await conn.execute(`
        DELETE FROM \`inventory_movement\` 
        WHERE \`movementType\` IN ('Borrow', 'Return') 
           OR \`referenceNumber\` LIKE 'BK%' 
           OR \`referenceNumber\` LIKE 'RES%' 
           OR \`referenceNumber\` LIKE 'ORD%' 
           OR \`referenceNumber\` LIKE 'BOR%'
      `);

      // Reset room statuses to 'Available' (except Under Maintenance)
      const [roomUpdate] = await conn.execute(`
        UPDATE \`room\` 
        SET \`status\` = 'Available' 
        WHERE \`status\` != 'Under Maintenance'
      `);

      await conn.execute("SET FOREIGN_KEY_CHECKS = 1");

      // Verify master counts
      const [userRows] = await conn.execute("SELECT COUNT(*) as count FROM user");
      const [roomRows] = await conn.execute("SELECT COUNT(*) as count FROM room WHERE status = 'Available'");
      const [prodRows] = await conn.execute("SELECT COUNT(*) as count FROM products");
      const [amenRows] = await conn.execute("SELECT COUNT(*) as count FROM amenities");

      return NextResponse.json({
        success: true,
        message: 'Transactional records cleanly reset. All primary key counters have been reset to 1.',
        clearedRecords: clearedCounts,
        roomsResetToAvailable: roomUpdate.affectedRows,
        masterDataPreserved: {
          users: userRows[0].count,
          availableRooms: roomRows[0].count,
          products: prodRows[0].count,
          amenities: amenRows[0].count
        },
        nextIDs: {
          reservationID: 'RV00001 (id: 1)',
          bookingID: 'BK00001 (id: 1)',
          transactionID: 'TRA00001 (id: 1)',
          orderID: 'ORD00001 (id: 1)'
        }
      });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Admin transactional reset failed:", error);
    return NextResponse.json({ error: 'Reset failed: ' + error.message }, { status: 500 });
  }
}
