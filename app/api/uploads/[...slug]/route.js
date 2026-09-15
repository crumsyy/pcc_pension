import { NextResponse } from 'next/server';
import { getUploadedFile } from '@/lib/db';
import path from 'path';
import os from 'os';
import { readFile } from 'fs/promises';

export async function GET(request, context) {
  try {
    const params = await context.params;
    const slug = params?.slug;

    if (!slug || !Array.isArray(slug) || slug.length === 0) {
      return NextResponse.json({ error: 'Invalid file path.' }, { status: 400 });
    }

    const filename = slug[slug.length - 1];

    // Determine MIME type from extension
    const ext = path.extname(filename).toLowerCase();
    const mimeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };
    const defaultMime = mimeMap[ext] || 'application/octet-stream';

    // 1. Try serving from public/uploads on disk (local development)
    try {
      const publicPath = path.join(process.cwd(), 'public', 'uploads', ...slug);
      const buffer = await readFile(publicPath);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': defaultMime,
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    } catch (e) {
      // File not found on public directory (expected on Vercel)
    }

    // 2. Try serving from /tmp/uploads (cached in lambda environment)
    try {
      const tmpPath = path.join(os.tmpdir(), 'uploads', ...slug);
      const buffer = await readFile(tmpPath);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': defaultMime,
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    } catch (e) {
      // Not cached in /tmp
    }

    // 3. Fallback: Retrieve binary data directly from TiDB database
    const fileRow = await getUploadedFile(filename);
    if (fileRow && fileRow.data) {
      return new NextResponse(fileRow.data, {
        headers: {
          'Content-Type': fileRow.mimeType || defaultMime,
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    }

    return NextResponse.json({ error: 'File not found.' }, { status: 404 });
  } catch (error) {
    console.error("Error serving uploaded file:", error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
