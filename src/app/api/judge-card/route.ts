import { NextRequest, NextResponse } from 'next/server';
import { isValidJudgeSlug } from '@/lib/show';
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

  const { data, error } = await getSupabaseAdmin()
    .from('judge_cards')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Could not load scorecard' }, { status: 502, headers: NO_STORE });
  }
  return NextResponse.json({ card: data }, { headers: NO_STORE });
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

  const { error } = await getSupabaseAdmin().from('judge_cards').upsert({
    slug: body.slug,
    display_name: body.displayName.slice(0, 100),
    athlete_a: body.athleteA,
    athlete_b: body.athleteB,
    rows: body.rows,
    current_pose_id: body.currentPoseId.slice(0, 32),
  });

  if (error) {
    return NextResponse.json({ error: 'Could not save scorecard' }, { status: 502, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
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
