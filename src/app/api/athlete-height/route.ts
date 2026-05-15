import { NextResponse } from 'next/server';

/** Subtracted from every Wikipedia height. Bodybuilders consistently overstate. */
const BODYBUILDER_HEIGHT_FUDGE_CM = 2;

/**
 * Athletes exempt from the honesty fudge — keep this set tiny and well-justified.
 * Match is case-insensitive against the resolved Wikipedia page title.
 */
const HONEST_BODYBUILDERS: ReadonlySet<string> = new Set(['dennis wolf']);

/**
 * GET /api/athlete-height?name=Kai+Greene
 * Searches Wikipedia for the athlete and parses the infobox `height` field.
 * Returns { heightCm: number | null, source: 'wikipedia' | null, page?: string }.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get('name')?.trim();
  if (!name || name.length < 3) {
    return NextResponse.json({ heightCm: null, source: null });
  }

  // Try a few candidate searches — disambiguators help when names collide.
  const candidates = [`${name} bodybuilder`, `${name} (bodybuilder)`, name];

  // Always pick the TALLEST plausible height across all candidates and
  // all patterns within each page — bodybuilder pages often cite multiple
  // sources, and stated heights skew toward the more flattering number.
  let best: { heightCm: number; page: string } | null = null;
  const seenTitles = new Set<string>();

  for (const q of candidates) {
    const title = await searchWikipedia(q);
    if (!title || seenTitles.has(title)) continue;
    seenTitles.add(title);

    const wikitext = await fetchWikitext(title);
    if (!wikitext) continue;
    if (!isLikelyBodybuilder(wikitext)) continue;

    const heightCm = parseHeightFromWikitext(wikitext);
    if (heightCm && (!best || heightCm > best.heightCm)) {
      best = { heightCm, page: title };
    }
  }

  if (best) {
    const exempt = HONEST_BODYBUILDERS.has(best.page.toLowerCase());
    const corrected = exempt
      ? best.heightCm
      : best.heightCm - BODYBUILDER_HEIGHT_FUDGE_CM;
    return NextResponse.json({
      heightCm: corrected,
      rawHeightCm: best.heightCm,
      source: 'wikipedia',
      page: best.page,
      fudgeApplied: !exempt,
    });
  }

  return NextResponse.json({ heightCm: null, source: null });
}

async function searchWikipedia(query: string): Promise<string | null> {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'opensearch');
  url.searchParams.set('search', query);
  url.searchParams.set('limit', '1');
  url.searchParams.set('namespace', '0');
  url.searchParams.set('format', 'json');
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ChowsScorecard/1.0' } });
    if (!res.ok) return null;
    const data = (await res.json()) as [string, string[], string[], string[]];
    return data[1]?.[0] ?? null;
  } catch {
    return null;
  }
}

async function fetchWikitext(title: string): Promise<string | null> {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'parse');
  url.searchParams.set('page', title);
  url.searchParams.set('prop', 'wikitext');
  url.searchParams.set('format', 'json');
  url.searchParams.set('redirects', '1');
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ChowsScorecard/1.0' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { parse?: { wikitext?: { '*'?: string } } };
    return data.parse?.wikitext?.['*'] ?? null;
  } catch {
    return null;
  }
}

function isLikelyBodybuilder(wikitext: string): boolean {
  // Cheap heuristic: looking for sport-related infobox or category mentions
  // avoids matching unrelated people who share a name.
  const t = wikitext.toLowerCase();
  return (
    t.includes('bodybuilder') ||
    t.includes('bodybuilding') ||
    t.includes('mr. olympia') ||
    t.includes('ifbb') ||
    t.includes('npc')
  );
}

/** Plausible adult height in centimeters — used to filter out junk matches. */
const PLAUSIBLE_MIN_CM = 140;
const PLAUSIBLE_MAX_CM = 230;

/**
 * Extract every plausible height in centimeters from the infobox height field.
 * Scans all known patterns (height/convert/cvt templates, plain text)
 * and returns every match in the plausible adult range.
 */
function extractHeightsFromString(v: string): number[] {
  const out: number[] = [];
  const push = (cm: number) => {
    if (Number.isFinite(cm) && cm >= PLAUSIBLE_MIN_CM && cm <= PLAUSIBLE_MAX_CM) {
      out.push(Math.round(cm));
    }
  };

  // {{height|ft=5|in=11}}
  for (const m of v.matchAll(/\{\{height\|ft=(\d+)\|in=(\d+)/gi)) {
    push((+m[1] * 12 + +m[2]) * 2.54);
  }
  // {{height|m=1.80}}
  for (const m of v.matchAll(/\{\{height\|m=([\d.]+)/gi)) {
    push(+m[1] * 100);
  }
  // {{height|cm=180}}
  for (const m of v.matchAll(/\{\{height\|cm=([\d.]+)/gi)) {
    push(+m[1]);
  }
  // {{convert|5|ft|11|in|cm|...}}  /  {{cvt|6|ft|2|in}}
  for (const m of v.matchAll(/\{\{(?:convert|cvt)\|(\d+)\|ft\|(\d+)\|in/gi)) {
    push((+m[1] * 12 + +m[2]) * 2.54);
  }
  // {{convert|6|ft}} (whole feet only — no inches)
  for (const m of v.matchAll(/\{\{(?:convert|cvt)\|(\d+)\|ft\b(?!\|\d+\|in)/gi)) {
    const ft = +m[1];
    if (ft >= 4 && ft <= 8) push(ft * 12 * 2.54);
  }
  // {{convert|180|cm}}  /  {{cvt|180|cm}}
  for (const m of v.matchAll(/\{\{(?:convert|cvt)\|(\d+(?:\.\d+)?)\|cm\b/gi)) {
    push(+m[1]);
  }
  // {{convert|1.80|m}}
  for (const m of v.matchAll(/\{\{(?:convert|cvt)\|([\d.]+)\|m\b/gi)) {
    push(+m[1] * 100);
  }
  // Plain text: 5 ft 11 in / 5'11" / 5 feet 11 inches
  for (const m of v.matchAll(/(\d+)\s*(?:ft|feet|')\s*(\d+)\s*(?:in|inches|")/gi)) {
    push((+m[1] * 12 + +m[2]) * 2.54);
  }
  // Plain text: 1.80 m
  for (const m of v.matchAll(/([\d.]+)\s*m\b/gi)) {
    push(+m[1] * 100);
  }
  // Plain text: 180 cm
  for (const m of v.matchAll(/(\d+(?:\.\d+)?)\s*cm/gi)) {
    push(+m[1]);
  }

  return out;
}

/**
 * Find the height field on the page and return the TALLEST plausible
 * height extracted from it. Bodybuilder pages frequently cite multiple
 * sources with slightly different numbers — we prefer the largest before
 * applying the honesty fudge in the route.
 */
function parseHeightFromWikitext(wikitext: string): number | null {
  // Match the height field until the next infobox field or end of template.
  const heightMatch = wikitext.match(
    /\|\s*height\s*=\s*([\s\S]*?)(?=\n\s*\||\n\s*\}\})/i,
  );
  if (!heightMatch) return null;
  const heights = extractHeightsFromString(heightMatch[1]);
  if (!heights.length) return null;
  return Math.max(...heights);
}
