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

  let sql = `
    SELECT a.*, ac.name as catName
    FROM amenities a
    JOIN amenities_category ac ON ac.amenityCategoryID = a.amenityCategoryID
    WHERE a.isArchived = ?
  `;
  const params = [archived ? 1 : 0];

  if (search) {
    sql += " AND (LOWER(a.name) LIKE LOWER(?) OR LOWER(ac.name) LIKE LOWER(?))";
    const like = `%${search}%`;
    params.push(like, like);
  }
  if (catF) {
    sql += " AND a.amenityCategoryID = ?";
    params.push(parseInt(catF));
  }

  sql += " ORDER BY ac.name, a.name";

  try {
    const items = await dbQuery(sql, params);
    const categories = await dbQuery("SELECT * FROM amenities_category ORDER BY name");
    return NextResponse.json({ items, categories });
  } catch (error) {
    console.error("Failed to fetch amenities:", error);
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
      const amenityCategoryID = parseInt(body.amenityCategoryID);
      const minStock = parseInt(body.minStock) || 5;

      await dbQuery(
        "INSERT INTO amenities(name,price,quantity,amenityCategoryID,minStock) VALUES(?,?,?,?,?)",
        [name, price, quantity, amenityCategoryID, minStock]
      );
      return NextResponse.json({ success: true, message: 'Amenity created successfully.' });
    }

    if (action === 'update') {
      const amenityID = parseInt(body.amenityID);
      const name = body.name.trim();
      const price = parseFloat(body.price);
      const quantity = parseInt(body.quantity);
      const amenityCategoryID = parseInt(body.amenityCategoryID);
      const minStock = parseInt(body.minStock) || 5;

      await dbQuery(
        "UPDATE amenities SET name=?, price=?, quantity=?, amenityCategoryID=?, minStock=? WHERE amenityID=?",
        [name, price, quantity, amenityCategoryID, minStock, amenityID]
      );
      return NextResponse.json({ success: true, message: 'Amenity updated successfully.' });
    }

    if (action === 'archive') {
      const amenityID = parseInt(body.amenityID);
      await dbQuery(
        "UPDATE amenities SET isArchived=1 WHERE amenityID=?",
        [amenityID]
      );
      return NextResponse.json({ success: true, message: 'Amenity archived successfully.' });
    }

    if (action === 'restore') {
      const amenityID = parseInt(body.amenityID);
      await dbQuery(
        "UPDATE amenities SET isArchived=0 WHERE amenityID=?",
        [amenityID]
      );
      return NextResponse.json({ success: true, message: 'Amenity restored successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process amenity action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
