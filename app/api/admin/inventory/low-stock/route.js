import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const products = await dbQuery(`
      SELECT 'Product' as sourceTable, p.productID as itemID, p.name, p.basePrice, p.price, pc.name as category, p.minStock, p.itemType, p.unit, p.quantity as availableQty
      FROM products p
      JOIN product_category pc ON pc.productCategoryID = p.productCategoryID
      WHERE p.isArchived = 0 AND pc.name != 'Cooked Meals' AND p.quantity <= p.minStock
    `);

    const amenities = await dbQuery(`
      SELECT 'Amenity' as sourceTable, a.amenityID as itemID, a.name, a.basePrice, a.price, ac.name as category, a.minStock, a.itemType, a.unit, a.quantity as availableQty
      FROM amenities a
      JOIN amenities_category ac ON ac.amenityCategoryID = a.amenityCategoryID
      WHERE a.isArchived = 0 AND a.quantity <= a.minStock
    `);

    const lowStockItems = [...products, ...amenities];
    lowStockItems.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ items: lowStockItems });
  } catch (error) {
    console.error("Failed to fetch low stock items:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
