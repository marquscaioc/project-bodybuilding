import { NextResponse } from 'next/server';
import { readResponseBytes, safeRemoteFetch } from '@/lib/safeRemoteFetch';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/**
 * GET /api/proxy-image?url=...
 *
 * Server-side fetch of an external image, returning the bytes with the
 * original content-type. Used to display gallery thumbnails (avoiding
 * CORS in the browser) and to feed downloaded photos into the
 * background-removal/face/pose pipeline.
 */
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) {
    return new NextResponse('Bad url', { status: 400 });
  }
  try {
    const upstream = await safeRemoteFetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ProjectBodybuilding/1.0; bodybuilding scoring)',
        Accept: 'image/*',
        Referer: new URL(url).origin,
      },
    }, { timeoutMs: 12_000 });
    if (!upstream.ok) {
      return new NextResponse(`Upstream ${upstream.status}`, { status: 502 });
    }
    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return new NextResponse('Upstream did not return an image', { status: 415 });
    }
    const buf = await readResponseBytes(upstream, MAX_IMAGE_BYTES);
    return new NextResponse(buf, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    return new NextResponse(`Fetch failed: ${(err as Error).message}`, { status: 502 });
  }
}
