import { NextRequest, NextResponse } from 'next/server';
import { getHostMatchup, withHostName } from '@/lib/hostMatchup';
import { HOST_SLUG, isValidJudgeSlug } from '@/lib/show';
import {
  allowedDesksFor,
  SHOW_COOKIE,
  verifyShowToken,
} from '@/lib/showAuth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { Athlete, Row } from '@/types';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_BODY_BYTES = 256 * 1024;

async function authorize(request: NextRequest, slug: string | null) {
  const principal = await verifyShowToken(request.cookies.get(SHOW_COOKIE)?.value);
  return principal && slug && allowedDesksFor(principal).includes(slug)
    ? principal
    : null;
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  if (!isValidJudgeSlug(slug) || !(await authorize(request, slug))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }

  const admin = getSupabaseAdmin();
  const [{ data, error }, host] = await Promise.all([
    admin.from('judge_cards').select('*').eq('slug', slug).maybeSingle(),
    slug === HOST_SLUG ? Promise.resolve(null) : getHostMatchup(),
  ]);

  if (error) {
    return NextResponse.json({ error: 'Could not load scorecard' }, { status: 502, headers: NO_STORE });
  }
  const card = data && host
    ? {
        ...data,
        athlete_a: withHostName(data.athlete_a, host.athleteA),
        athlete_b: withHostName(data.athlete_b, host.athleteB),
      }
    : data;
  return NextResponse.json({ card }, { headers: NO_STORE });
}

export async function PUT(request: NextRequest) {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: NO_STORE });
  }

  if (!isJudgeCardInput(body) || !(await authorize(request, body.slug))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }

  const host = body.slug === HOST_SLUG ? null : await getHostMatchup();
  const athleteA = stripPhotos(body.athleteA);
  const athleteB = stripPhotos(body.athleteB);
  const { error } = await getSupabaseAdmin().from('judge_cards').upsert({
    slug: body.slug,
    display_name: body.displayName.slice(0, 100),
    athlete_a: host ? withHostName(athleteA, host.athleteA) : athleteA,
    athlete_b: host ? withHostName(athleteB, host.athleteB) : athleteB,
    rows: body.rows,
    current_pose_id: body.currentPoseId.slice(0, 32),
  });

  if (error) {
    return NextResponse.json({ error: 'Could not save scorecard' }, { status: 502, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

function stripPhotos(athlete: Athlete): Athlete {
  const copy = { ...athlete };
  delete copy.photos;
  return copy;
}

type JudgeCardInput = {
  slug: string;
  displayName: string;
  athleteA: Athlete;
  athleteB: Athlete;
  rows: Row[];
  currentPoseId: string;
};

function isJudgeCardInput(value: unknown): value is JudgeCardInput {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    isValidJudgeSlug(typeof record.slug === 'string' ? record.slug : null) &&
    typeof record.displayName === 'string' &&
    typeof record.athleteA === 'object' &&
    record.athleteA !== null &&
    typeof record.athleteB === 'object' &&
    record.athleteB !== null &&
    Array.isArray(record.rows) &&
    record.rows.length <= 12 &&
    typeof record.currentPoseId === 'string'
  );
}
