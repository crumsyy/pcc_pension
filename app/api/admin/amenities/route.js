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
  if (itemType) {
    sql += " AND a.itemType = ?";
    params.push(itemType);
  }

  sql += " ORDER BY a.amenityID DESC";

  try {
    const items = await dbQuery(sql, params);
    const categories = await dbQuery(`
      SELECT ac.*, COUNT(a.amenityID) as itemCount
      FROM amenities_category ac
      LEFT JOIN amenities a ON a.amenityCategoryID = ac.amenityCategoryID AND a.isArchived = 0
      GROUP BY ac.amenityCategoryID, ac.name
      ORDER BY ac.name ASC
    `);
    return NextResponse.json({ items, categories });
  } catch (error) {
    console.error("Failed to fetch amenities:", error);
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
      const amenityCategoryID = parseInt(body.amenityCategoryID);
      const minStock = parseInt(body.minStock) || 5;
      const itemType = body.itemType || 'Consumable';
      const unit = body.unit ? body.unit.trim() : 'pcs';
      const description = body.description ? body.description.trim() : null;
      const image = body.image ? body.image.trim() : null;

      const existing = await dbQuery("SELECT amenityID FROM amenities WHERE LOWER(TRIM(name)) = LOWER(?)", [name]);
      if (existing.length > 0) {
        return NextResponse.json({ error: 'An amenity with this name already exists.' }, { status: 400 });
      }

      await dbQuery(
        "INSERT INTO amenities(name, price, basePrice, sellingPrice, quantity, amenityCategoryID, minStock, itemType, unit, description, image) VALUES(?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)",
        [name, price, basePrice, sellingPrice, amenityCategoryID, minStock, itemType, unit, description, image]
      );
      return NextResponse.json({ success: true, message: 'Amenity created successfully.' });
    }

    if (action === 'update') {
      const amenityID = parseInt(body.amenityID);
      const name = body.name.trim();
      const basePrice = parseFloat(body.basePrice || 0);
      const sellingPrice = parseFloat(body.sellingPrice || 0);
      const price = sellingPrice;
      const amenityCategoryID = parseInt(body.amenityCategoryID);
      const minStock = parseInt(body.minStock) || 5;
      const itemType = body.itemType || 'Consumable';
      const unit = body.unit ? body.unit.trim() : 'pcs';
      const description = body.description ? body.description.trim() : null;
      const image = body.image ? body.image.trim() : null;

      const existing = await dbQuery("SELECT amenityID FROM amenities WHERE LOWER(TRIM(name)) = LOWER(?) AND amenityID != ?", [name, amenityID]);
      if (existing.length > 0) {
        return NextResponse.json({ error: 'An amenity with this name already exists.' }, { status: 400 });
      }

      await dbQuery(
        "UPDATE amenities SET name=?, price=?, basePrice=?, sellingPrice=?, amenityCategoryID=?, minStock=?, itemType=?, unit=?, description=?, image=? WHERE amenityID=?",
        [name, price, basePrice, sellingPrice, amenityCategoryID, minStock, itemType, unit, description, image, amenityID]
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

    if (action === 'create_category') {
      const name = (body.name || '').trim();
      if (!name) {
        return NextResponse.json({ error: 'Category name is required.' }, { status: 400 });
      }
      const existing = await dbQuery("SELECT amenityCategoryID FROM amenities_category WHERE LOWER(TRIM(name)) = LOWER(?)", [name]);
      if (existing.length > 0) {
        return NextResponse.json({ error: 'A category with this name already exists.' }, { status: 400 });
      }
      await dbQuery("INSERT INTO amenities_category(name) VALUES(?)", [name]);
      return NextResponse.json({ success: true, message: `Category "${name}" created successfully.` });
    }

    if (action === 'update_category') {
      const amenityCategoryID = parseInt(body.amenityCategoryID);
      const name = (body.name || '').trim();
      if (!amenityCategoryID || !name) {
        return NextResponse.json({ error: 'Category ID and name are required.' }, { status: 400 });
      }
      const existing = await dbQuery(
        "SELECT amenityCategoryID FROM amenities_category WHERE LOWER(TRIM(name)) = LOWER(?) AND amenityCategoryID != ?",
        [name, amenityCategoryID]
      );
      if (existing.length > 0) {
        return NextResponse.json({ error: 'A category with this name already exists.' }, { status: 400 });
      }
      await dbQuery("UPDATE amenities_category SET name=? WHERE amenityCategoryID=?", [name, amenityCategoryID]);
      return NextResponse.json({ success: true, message: `Category updated to "${name}" successfully.` });
    }

    if (action === 'delete_category') {
      const amenityCategoryID = parseInt(body.amenityCategoryID);
      if (!amenityCategoryID) {
        return NextResponse.json({ error: 'Category ID is required.' }, { status: 400 });
      }
      const used = await dbQuery("SELECT amenityID FROM amenities WHERE amenityCategoryID = ? LIMIT 1", [amenityCategoryID]);
      if (used.length > 0) {
        return NextResponse.json({
          error: 'Cannot delete category: it is currently assigned to one or more amenities. Please reassign or delete those amenities first.'
        }, { status: 400 });
      }
      await dbQuery("DELETE FROM amenities_category WHERE amenityCategoryID=?", [amenityCategoryID]);
      return NextResponse.json({ success: true, message: 'Category deleted successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Failed to process amenity action:", error);
    return NextResponse.json({ error: 'Operation failed: ' + error.message }, { status: 500 });
  }
}
