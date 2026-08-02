import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';

export async function POST(request) {
  const session = await getSession();
  if (!session || (session.role !== 'Administrator' && session.role !== 'Receptionist')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No image file uploaded.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine extension
    const originalName = file.name || 'image.jpg';
    const ext = path.extname(originalName) || '.jpg';
    const filename = `room-${Date.now()}-${Math.floor(Math.random() * 1000)}${ext}`;

    // Target upload dir: public/uploads/rooms/
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'rooms');
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    const relativeUrl = `/uploads/rooms/${filename}`;

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
