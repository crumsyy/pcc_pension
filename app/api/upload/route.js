import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, ensureProfilePictureSchema, saveUploadedFile } from '@/lib/db';
import path from 'path';
import os from 'os';
import { writeFile, mkdir } from 'fs/promises';

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const uploadType = formData.get('type') || 'rooms';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No image file uploaded.' }, { status: 400 });
    }

    // Validation: Max 25MB file size
    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds the 25MB limit. Please select a smaller JPG, PNG, or WEBP image.' }, { status: 400 });
    }

    // Validation: Supported file extensions
    const originalName = file.name || 'image.jpg';
    const ext = path.extname(originalName).toLowerCase() || '.jpg';
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];

    if (!allowedExts.includes(ext)) {
      return NextResponse.json({ error: 'Unsupported file format. Please upload a JPG, PNG, or WEBP image.' }, { status: 400 });
    }

    const mimeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp'
    };
    const mimeType = file.type || mimeMap[ext] || 'image/jpeg';

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const subFolderMap = {
      profile: 'profile-pictures',
      rooms: 'rooms',
      products: 'products',
      amenities: 'amenities',
      meals: 'cooked-meals'
    };
    const subFolder = subFolderMap[uploadType] || 'catalog';
    const filename = `${uploadType}-${Date.now()}-${Math.floor(Math.random() * 1000)}${ext}`;

    // 1. Always persist to TiDB database for cross-platform / Vercel persistence
    await saveUploadedFile({
      filename,
      subFolder,
      mimeType,
      buffer
    });

    // 2. Best-effort local file write (works on local dev machine, gracefully skips on read-only serverless Vercel)
    try {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', subFolder);
      await mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, filename);
      await writeFile(filePath, buffer);
    } catch (fsError) {
      // In serverless environments (Vercel Lambda /var/task), local filesystem is read-only.
      // Cache to /tmp instead for fast local serving within the same container
      try {
        const tmpDir = path.join(os.tmpdir(), 'uploads', subFolder);
        await mkdir(tmpDir, { recursive: true });
        await writeFile(path.join(tmpDir, filename), buffer);
      } catch (tmpErr) {
        // Fallback to database serving
      }
    }

    const relativeUrl = `/uploads/${subFolder}/${filename}`;

    // If profile upload, save to database
    if (uploadType === 'profile' && session.userID) {
      await ensureProfilePictureSchema();
      await dbQuery("UPDATE guest SET profilePicture = ? WHERE userID = ?", [relativeUrl, session.userID]);
      await dbQuery("UPDATE user SET profilePicture = ? WHERE userID = ?", [relativeUrl, session.userID]);
    }

    return NextResponse.json({
      success: true,
      url: relativeUrl,
      message: 'Image uploaded successfully.'
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: 'File upload failed: ' + error.message }, { status: 500 });
  }
}
