import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { dbQuery, ensureProfilePictureSchema } from '@/lib/db';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';

export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const uploadType = formData.get('type') || 'rooms'; // 'profile' or 'rooms'

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No image file uploaded.' }, { status: 400 });
    }

    // Validation: Max 2MB file size
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds the 2MB limit. Please select a smaller JPG or PNG image.' }, { status: 400 });
    }

    // Validation: Supported file extensions
    const originalName = file.name || 'image.jpg';
    const ext = path.extname(originalName).toLowerCase() || '.jpg';
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];

    if (!allowedExts.includes(ext)) {
      return NextResponse.json({ error: 'Unsupported file format. Please upload a JPG or PNG image.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const subFolder = uploadType === 'profile' ? 'profile-pictures' : 'rooms';
    const filename = `${uploadType}-${Date.now()}-${Math.floor(Math.random() * 1000)}${ext}`;

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', subFolder);
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

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
