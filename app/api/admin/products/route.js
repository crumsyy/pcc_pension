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
  const catF = searchParams.get('catID') || '';
  const archived = searchParams.get('archived') === 'true';
  const itemType = searchParams.get('itemType') || '';

  let sql = `
    SELECT p.*, pc.name as catName
    FROM products p
    JOIN product_category pc ON pc.productCategoryID = p.productCategoryID
    WHERE p.isArchived = ?
  `;
  const params = [archived ? 1 : 0];

  if (search) {
    sql += " AND (LOWER(p.name) LIKE LOWER(?) OR LOWER(pc.name) LIKE LOWER(?))";
    const like = `%${search}%`;
    params.push(like, like);
  }
  if (catF) {
    sql += " AND p.productCategoryID = ?";
    params.push(parseInt(catF));
  }
  if (itemType) {
    sql += " AND p.itemType = ?";
    params.push(itemType);
  }

  sql += " ORDER BY pc.name, p.name";

  try {
    const products = await dbQuery(sql, params);
    const categories = await dbQuery("SELECT * FROM product_category ORDER BY name");
    return NextResponse.json({ products, categories });
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json({ error: 'Database error: ' + error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== 'Administrator') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const name = body.name.trim();
      const price = parseFloat(body.price);
      const productCategoryID = parseInt(body.productCategoryID);
      const minStock = parseInt(body.minStock) || 5;
      const itemType = body.itemType || 'Consumable';
      const unit = body.unit ? body.unit.trim() : 'pcs';
      const description = body.description ? body.description.trim() : null;

      await dbQuery(
        "INSERT INTO products(name, price, quantity, productCategoryID, minStock, itemType, unit, description) VALUES(?, ?, 0, ?, ?, ?, ?, ?)",
        [name, price, productCategoryID, minStock, itemType, unit, description]
      );
      return NextResponse.json({ success: true, message: 'Product created successfully.' });
    }

    if (action === 'update') {
      const productID = parseInt(body.productID);
      const name = body.name.trim();
      const price = parseFloat(body.price);
      const productCategoryID = parseInt(body.productCategoryID);
      const minStock = parseInt(body.minStock) || 5;
      const itemType = body.itemType || 'Consumable';
      const unit = body.unit ? body.unit.trim() : 'pcs';
      const description = body.description ? body.description.trim() : null;

      await dbQuery(
        "UPDATE products SET name=?, price=?, productCategoryID=?, minStock=?, itemType=?, unit=?, description=? WHERE productID=?",
        [name, price, productCategoryID, minStock, itemType, unit, description, productID]
      );
      return NextResponse.json({ success: true, message: 'Product updated successfully.' });
    }

    if (action === 'archive') {
      const productID = parseInt(body.productID);
      await dbQuery(
        "UPDATE products SET isArchived=1 WHERE productID=?",
        [productID]
      );
      return NextResponse.json({ success: true, message: 'Product archived successfully.' });
    }

    if (action === 'restore') {
      const productID = parseInt(body.productID);
      await dbQuery(
        "UPDATE products SET isArchived=0 WHERE productID=?",
        [productID]
      );
      return NextResponse.json({ success: true, message: 'Product restored successfully.' });
    }

    if (action === 'toggle_availability') {
      const productID = parseInt(body.productID);
      const isAvailable = body.isAvailable ? 1 : 0;
      await dbQuery(
        "UPDATE products SET isAvailable=? WHERE productID=?",
        [isAvailable, productID]
      );
      return NextResponse.json({ success: true, message: 'Product availability updated.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process product action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
