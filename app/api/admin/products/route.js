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

  let sql = `
    SELECT p.*, pc.name as catName
    FROM products p
    JOIN product_category pc ON pc.productCategoryID = p.productCategoryID
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += " AND (p.name LIKE ? OR pc.name LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like);
  }
  if (catF) {
    sql += " AND p.productCategoryID = ?";
    params.push(parseInt(catF));
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
      const quantity = parseInt(body.quantity);
      const productCategoryID = parseInt(body.productCategoryID);

      await dbQuery(
        "INSERT INTO products(name,price,quantity,productCategoryID) VALUES(?,?,?,?)",
        [name, price, quantity, productCategoryID]
      );
      return NextResponse.json({ success: true, message: 'Product created successfully.' });
    }

    if (action === 'update') {
      const productID = parseInt(body.productID);
      const name = body.name.trim();
      const price = parseFloat(body.price);
      const quantity = parseInt(body.quantity);
      const productCategoryID = parseInt(body.productCategoryID);

      await dbQuery(
        "UPDATE products SET name=?, price=?, quantity=?, productCategoryID=? WHERE productID=?",
        [name, price, quantity, productCategoryID, productID]
      );
      return NextResponse.json({ success: true, message: 'Product updated successfully.' });
    }

    if (action === 'archive') {
      const productID = parseInt(body.productID);
      await dbQuery(
        "UPDATE products SET quantity=0 WHERE productID=?",
        [productID]
      );
      return NextResponse.json({ success: true, message: 'Product archived successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process product action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
