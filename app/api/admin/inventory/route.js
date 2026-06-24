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
      SELECT 'Amenity' as itemType, a.amenityID as itemID, a.name, a.quantity, a.price, ac.name as category
      FROM amenities a 
      JOIN amenities_category ac ON ac.amenityCategoryID = a.amenityCategoryID
      WHERE 1=1
    `;
    const paramsA = [];
    if (search) {
      sqlA += " AND (a.name LIKE ? OR ac.name LIKE ?)";
      const like = `%${search}%`;
      paramsA.push(like, like);
    }

    let sqlP = `
      SELECT 'Product' as itemType, p.productID as itemID, p.name, p.quantity, p.price, pc.name as category
      FROM products p 
      JOIN product_category pc ON pc.productCategoryID = p.productCategoryID
      WHERE 1=1
    `;
    const paramsP = [];
    if (search) {
      sqlP += " AND (p.name LIKE ? OR pc.name LIKE ?)";
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

    return NextResponse.json({ items: allItems });
  } catch (error) {
    console.error("Failed to fetch inventory:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}
