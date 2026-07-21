import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch active, non-archived products (excluding Cooked Meals) and amenities
    const products = await dbQuery(`
      SELECT 'Product' as sourceTable, p.productID as itemID, p.name, p.basePrice, p.price, pc.name as category, p.minStock, p.itemType, p.unit
      FROM products p
      JOIN product_category pc ON pc.productCategoryID = p.productCategoryID
      WHERE p.isArchived = 0 AND pc.name != 'Cooked Meals'
    `);

    const amenities = await dbQuery(`
      SELECT 'Amenity' as sourceTable, a.amenityID as itemID, a.name, a.basePrice, a.price, ac.name as category, a.minStock, a.itemType, a.unit
      FROM amenities a
      JOIN amenities_category ac ON ac.amenityCategoryID = a.amenityCategoryID
      WHERE a.isArchived = 0
    `);

    const allCatalog = [...products, ...amenities];

    // 2. Fetch all active inventory batches
    const batches = await dbQuery(`
      SELECT itemType, itemID, remainingQuantity, expirationDate
      FROM inventory_batch
      WHERE status = 'Active'
    `);

    // Compute local PHT todayStr
    const localNow = new Date();
    const offset = 8 * 60; // PHT offset is +480 minutes
    const localTime = new Date(localNow.getTime() + (offset + localNow.getTimezoneOffset()) * 60 * 1000);
    const todayStr = localTime.toISOString().substring(0, 10);

    const getFormatDate = (d) => {
      if (!d) return '';
      try {
        return new Date(d).toISOString().substring(0, 10);
      } catch (e) {
        return '';
      }
    };

    // 3. Compute dynamic stock quantities per catalog item and filter by low-stock threshold (quantity <= minStock)
    const lowStockItems = [];

    for (const item of allCatalog) {
      // Find batches for this item
      const itemBatches = batches.filter(b => b.itemType === item.sourceTable && b.itemID === item.itemID);
      
      // EXCLUDE expired batches from available (usable) stock
      const usableQuantity = itemBatches
        .filter(b => !b.expirationDate || getFormatDate(b.expirationDate) >= todayStr)
        .reduce((sum, b) => sum + b.remainingQuantity, 0);

      // Check if usable quantity is at or below the safety threshold
      if (usableQuantity <= item.minStock) {
        lowStockItems.push({
          ...item,
          availableQty: usableQuantity
        });
      }
    }

    lowStockItems.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ items: lowStockItems });
  } catch (error) {
    console.error("Failed to fetch low stock items:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
