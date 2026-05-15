import { NextResponse } from 'next/server';

/**
 * POST /api/scrape-gallery
 * Body: { url: string }
 *
 * Server-side fetches a gallery page and returns the highest-resolution
 * image URLs found. Two passes:
 *   1. Look for viewer-page links (e.g. NPC News' `images.php?image=N`)
 *      and follow each one to extract the actual high-res image URL.
 *   2. If no viewer links exist (regular sites), fall back to direct
 *      <img>/srcset/<a href="...jpg"> extraction with WP-style dedupe.
 */
export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', images: [] }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: 'url is required', images: [] }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { error: 'url must be http(s)', images: [] },
      { status: 400 },
    );
  }

  let html: string;
  let pageTitle: string | undefined;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Source returned HTTP ${res.status}`, images: [] },
        { status: 502 },
      );
    }
    html = await res.text();
    pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  } catch (err) {
    return NextResponse.json(
      { error: `Fetch failed: ${(err as Error).message}`, images: [] },
      { status: 502 },
    );
  }

  // Pass 1: viewer-page links (lightbox / per-image pages that hold the full-res).
  const viewerLinks = collectViewerLinks(html, url);
  let images: string[] = [];
  let resolvedFromViewer = 0;

  if (viewerLinks.length > 0) {
    const resolved = await pMap(
      viewerLinks,
      async (link) => resolveViewerPage(link),
      6,
    );
    images = resolved.filter((u): u is string => !!u);
    resolvedFromViewer = images.length;
  }

  // Pass 2: if no viewer links worked, scrape direct image URLs and dedupe by size variant.
  if (images.length === 0) {
    images = dedupeByBase(extractImageUrls(html, url));
  }

  return NextResponse.json({ images, pageTitle, resolvedFromViewer });
}

const UA = 'Mozilla/5.0 (compatible; ChowsScorecard/1.0; bodybuilding scoring)';

/**
 * Generic viewer-page link detection. Matches `<a href="…images.php?image=…">`,
 * `photo.php?id=…`, `view.php?p=…`, etc. — common PHP-driven lightbox patterns.
 */
function collectViewerLinks(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  const re = /<a\b[^>]*?\bhref\s*=\s*["']([^"']+\.php\?(?:[^"']*?\b)(?:image|photo|pic|id|p)=[^"']*)["']/gi;
  for (const m of html.matchAll(re)) {
    try {
      out.add(new URL(m[1], baseUrl).toString());
    } catch {
      /* ignore */
    }
  }
  return Array.from(out);
}

/**
 * Fetch a viewer page and pull out the main content image. Prefers a
 * URL containing "/large/" (NPC News convention) and only falls back to
 * other matches when the canonical path isn't present.
 */
async function resolveViewerPage(viewerUrl: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(viewerUrl, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();

    // Prefer NPC News canonical pattern: /images/contests/N/large/M.jpg
    const large = html.match(
      /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+\/images\/contests\/\d+\/large\/[^"']+?\.(?:jpe?g|png|webp))["']/i,
    );
    if (large) {
      try {
        return new URL(large[1], viewerUrl).toString();
      } catch {
        /* ignore */
      }
    }

    // Any other contests image
    const anyContests = html.match(
      /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+\/images\/contests\/[^"']+?\.(?:jpe?g|png|webp))["']/i,
    );
    if (anyContests) {
      try {
        return new URL(anyContests[1], viewerUrl).toString();
      } catch {
        /* ignore */
      }
    }

    // Fallback: og:image meta
    const og = html.match(
      /<meta\b[^>]*?\bproperty\s*=\s*["']og:image["'][^>]*?\bcontent\s*=\s*["']([^"']+)["']/i,
    );
    if (og) {
      try {
        return new URL(og[1], viewerUrl).toString();
      } catch {
        /* ignore */
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Concurrency-limited Promise.all replacement. Workers pull from a
 * shared cursor so we never spawn more than `concurrency` fetches.
 */
async function pMap<T, R>(
  items: T[],
  fn: (item: T, i: number) => Promise<R>,
  concurrency = 5,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = await fn(items[i], i);
      } catch {
        // Errors per item shouldn't kill the whole batch.
        results[i] = undefined as unknown as R;
      }
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    worker,
  );
  await Promise.all(workers);
  return results;
}

/**
 * Extract every plausible photo URL from a page. Heuristic-based so it
 * works on most gallery sites; not perfect but covers <img>, lazy-load
 * attributes, srcset, and <a href> links to image files.
 */
function extractImageUrls(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  const add = (raw: string | undefined) => {
    if (!raw) return;
    if (raw.startsWith('data:')) return;
    try {
      const resolved = new URL(raw, baseUrl).toString();
      if (/\.(jpe?g|png|webp)(\?|#|$)/i.test(resolved)) urls.add(resolved);
    } catch {
      /* ignore */
    }
  };

  // <img src="...">
  for (const m of html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    add(m[1]);
  }
  // Common lazy-load + full-size attributes (WordPress, Jetpack, lightbox plugins).
  const lazyAttrs = [
    'data-src',
    'data-original',
    'data-lazy',
    'data-lazy-src',
    'data-srcset',
    'data-orig-file',
    'data-large-file',
    'data-medium-file',
    'data-full',
    'data-large',
    'data-zoom-image',
    'data-image',
    'data-thumb',
  ];
  for (const attr of lazyAttrs) {
    const re = new RegExp(`<img\\b[^>]*?\\b${attr}\\s*=\\s*["']([^"']+)["']`, 'gi');
    for (const m of html.matchAll(re)) {
      const first = m[1].split(',')[0].trim().split(/\s+/)[0];
      add(first);
    }
  }
  // <img srcset="..."> — pick the largest descriptor
  for (const m of html.matchAll(/<img\b[^>]*?\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
    const candidates = m[1]
      .split(',')
      .map((s) => s.trim())
      .map((s) => {
        const [u, descriptor] = s.split(/\s+/);
        const w = descriptor?.match(/(\d+)w/)?.[1];
        return { url: u, w: w ? +w : 0 };
      });
    candidates.sort((a, b) => b.w - a.w);
    add(candidates[0]?.url);
  }
  // <source srcset="..."> (picture tags)
  for (const m of html.matchAll(/<source\b[^>]*?\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
    const first = m[1].split(',')[0].trim().split(/\s+/)[0];
    add(first);
  }
  // <a href="...jpg/png/webp">
  for (const m of html.matchAll(
    /<a\b[^>]*?\bhref\s*=\s*["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi,
  )) {
    add(m[1]);
  }

  return Array.from(urls).filter((u) => {
    const lower = u.toLowerCase();
    if (/(?:icon|logo|favicon|sprite|avatar|emoji|loading|spinner)/.test(lower)) return false;
    if (/(?:thumb|small|tiny)\.(jpe?g|png|webp)/.test(lower)) return false;
    return true;
  });
}

/**
 * WordPress (and most CMSes) serve N variants per uploaded image.
 * Group by stripped base filename and keep the biggest variant.
 */
function dedupeByBase(urls: string[]): string[] {
  const groups = new Map<string, { url: string; score: number }[]>();
  for (const u of urls) {
    const noScaled = u.replace(/-scaled(\.[a-z]+)/i, '$1');
    const m = noScaled.match(/^(.+?)(-(\d+)x(\d+))?(\.[a-z]+)(\?.*)?$/i);
    let base: string;
    let score: number;
    if (m) {
      base = (m[1] + m[5]).toLowerCase();
      score = m[3] && m[4] ? +m[3] * +m[4] : Number.MAX_SAFE_INTEGER;
    } else {
      base = u.toLowerCase();
      score = 0;
    }
    const arr = groups.get(base) ?? [];
    arr.push({ url: u, score });
    groups.set(base, arr);
  }
  return Array.from(groups.values()).map(
    (arr) => arr.sort((a, b) => b.score - a.score)[0].url,
  );
}
