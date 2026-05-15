import { NextResponse } from 'next/server';

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
  if (!url || !/^https?:\/\//i.test(url)) {
    return new NextResponse('Bad url', { status: 400 });
  }
  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ChowsScorecard/1.0; bodybuilding scoring)',
        Accept: 'image/*',
        Referer: new URL(url).origin,
      },
      redirect: 'follow',
    });
    if (!upstream.ok) {
      return new NextResponse(`Upstream ${upstream.status}`, { status: 502 });
    }
    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    const buf = await upstream.arrayBuffer();
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
