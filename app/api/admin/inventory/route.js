import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery } from '@/lib/db';

export async function GET(request) {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const typeF = searchParams.get('type') || '';

  try {
    let sqlA = `
      SELECT 'Amenity' as itemType, a.amenityID as itemID, a.name, a.quantity, a.price, ac.name as category, a.minStock
      FROM amenities a 
      JOIN amenities_category ac ON ac.amenityCategoryID = a.amenityCategoryID
      WHERE 1=1
    `;
    const paramsA = [];
    if (search) {
      sqlA += " AND (LOWER(a.name) LIKE LOWER(?) OR LOWER(ac.name) LIKE LOWER(?))";
      const like = `%${search}%`;
      paramsA.push(like, like);
    }

    let sqlP = `
      SELECT CASE WHEN pc.name = 'Cooked Meals' THEN 'Cooked Meals' ELSE 'Product' END as itemType, 
             p.productID as itemID, p.name, p.quantity, p.price, pc.name as category, p.minStock
      FROM products p 
      JOIN product_category pc ON pc.productCategoryID = p.productCategoryID
      WHERE 1=1
    `;
    const paramsP = [];
    if (search) {
      sqlP += " AND (LOWER(p.name) LIKE LOWER(?) OR LOWER(pc.name) LIKE LOWER(?))";
      const like = `%${search}%`;
      paramsP.push(like, like);
    }

    const amenities = await dbQuery(sqlA, paramsA);
    const products = await dbQuery(sqlP, paramsP);

    let allItems = [...amenities, ...products];

    // Filter by type if specified
    if (typeF) {
      allItems = allItems.filter(item => item.itemType === typeF);
    }

    // Sort by name
    allItems.sort((a, b) => a.name.localeCompare(b.name));

    // Fetch chronological stock-in history log (Module G & I - REQ044/REQ062)
    const stockHistory = await dbQuery(`
      SELECT i.inventoryID, DATE_FORMAT(i.stockInDate, '%Y-%m-%d %H:%i:%s') as stockInDate,
             i.quantityReceived, i.purchaseOrderID,
             COALESCE(a.name, p.name) as itemName,
             CASE WHEN i.amenityID IS NOT NULL THEN 'Amenity' ELSE 'Product' END as itemType
      FROM inventory i
      LEFT JOIN amenities a ON a.amenityID = i.amenityID
      LEFT JOIN products p ON p.productID = i.productID
      ORDER BY i.stockInDate DESC, i.inventoryID DESC
      LIMIT 100
    `);

    return NextResponse.json({ items: allItems, stockHistory });
  } catch (error) {
    console.error("Failed to fetch inventory:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
