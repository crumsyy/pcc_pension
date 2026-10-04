import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { dbQuery, ensureCatalogImageSchema } from '@/lib/db';

export async function GET(request) {
  const auth = await verifyAdmin();
  if (!auth.authorized) return auth.response;

  await ensureCatalogImageSchema();

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

  sql += " ORDER BY p.productID DESC";

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
  const auth = await verifyAdmin();
  if (!auth.authorized) return auth.response;

  await ensureCatalogImageSchema();

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const name = body.name.trim();
      const basePrice = parseFloat(body.basePrice || 0);
      const sellingPrice = parseFloat(body.sellingPrice || 0);
      const price = sellingPrice;
      const productCategoryID = parseInt(body.productCategoryID);
      const minStock = parseInt(body.minStock) || 5;
      const itemType = body.itemType || 'Consumable';
      const unit = body.unit ? body.unit.trim() : 'pcs';
      const description = body.description ? body.description.trim() : null;
      const image = body.image ? body.image.trim() : null;

      const existing = await dbQuery("SELECT productID FROM products WHERE LOWER(TRIM(name)) = LOWER(?)", [name]);
      if (existing.length > 0) {
        return NextResponse.json({ error: 'A product with this name already exists.' }, { status: 400 });
      }

      await dbQuery(
        "INSERT INTO products(name, price, basePrice, sellingPrice, quantity, productCategoryID, minStock, itemType, unit, description, image) VALUES(?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)",
        [name, price, basePrice, sellingPrice, productCategoryID, minStock, itemType, unit, description, image]
      );
      return NextResponse.json({ success: true, message: 'Product created successfully.' });
    }

    if (action === 'update') {
      const productID = parseInt(body.productID);
      const name = body.name.trim();
      const basePrice = parseFloat(body.basePrice || 0);
      const sellingPrice = parseFloat(body.sellingPrice || 0);
      const price = sellingPrice;
      const productCategoryID = parseInt(body.productCategoryID);
      const minStock = parseInt(body.minStock) || 5;
      const itemType = body.itemType || 'Consumable';
      const unit = body.unit ? body.unit.trim() : 'pcs';
      const description = body.description ? body.description.trim() : null;
      const image = body.image ? body.image.trim() : null;

      const existing = await dbQuery("SELECT productID FROM products WHERE LOWER(TRIM(name)) = LOWER(?) AND productID != ?", [name, productID]);
      if (existing.length > 0) {
        return NextResponse.json({ error: 'A product with this name already exists.' }, { status: 400 });
      }

      await dbQuery(
        "UPDATE products SET name=?, price=?, basePrice=?, sellingPrice=?, productCategoryID=?, minStock=?, itemType=?, unit=?, description=?, image=? WHERE productID=?",
        [name, price, basePrice, sellingPrice, productCategoryID, minStock, itemType, unit, description, image, productID]
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
