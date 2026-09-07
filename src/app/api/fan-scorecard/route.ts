import { NextRequest, NextResponse } from 'next/server';
import { FAN_COOKIE, hasExpired, verifyFanToken } from '@/lib/fanAuth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { Athlete, Row } from '@/types';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_BODY_BYTES = 256 * 1024;

export async function GET(request: NextRequest) {
  const access = await authorize(request);
  if (!access) return forbidden();
  return NextResponse.json({ card: access.card }, { headers: NO_STORE });
}

export async function PUT(request: NextRequest) {
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413, headers: NO_STORE });
  }

  const access = await authorize(request);
  if (!access) return forbidden();
  if (access.card.locked || access.invite.status === 'closed') {
    return NextResponse.json({ error: 'Scorecard is locked' }, { status: 423, headers: NO_STORE });
  }
  if (new Date(access.invite.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'Scorecard access has expired' }, { status: 410, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: NO_STORE });
  }
  if (!isFanCardInput(body)) {
    return NextResponse.json({ error: 'Invalid scorecard data' }, { status: 400, headers: NO_STORE });
  }

  const { error } = await getSupabaseAdmin()
    .from('fan_scorecards')
    .update({
      athlete_a: stripPhotos(body.athleteA),
      athlete_b: stripPhotos(body.athleteB),
      rows: body.rows,
      current_pose_id: body.currentPoseId.slice(0, 32),
    })
    .eq('id', access.card.id);

  if (error) {
    return NextResponse.json({ error: 'Could not save scorecard' }, { status: 502, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.delete(FAN_COOKIE);
  return response;
}

async function authorize(request: NextRequest) {
  const cardId = await verifyFanToken(request.cookies.get(FAN_COOKIE)?.value);
  if (!cardId) return null;

  const admin = getSupabaseAdmin();
  const { data: card } = await admin
    .from('fan_scorecards')
    .select('*')
    .eq('id', cardId)
    .maybeSingle();
  if (!card) return null;

  const { data: invite } = await admin
    .from('superchat_invites')
    .select('*')
    .eq('id', card.invite_id)
    .eq('status', 'claimed')
    .maybeSingle();
  return invite && !hasExpired(invite.expires_at) ? { card, invite } : null;
}

type FanCardInput = {
  athleteA: Athlete;
  athleteB: Athlete;
  rows: Row[];
  currentPoseId: string;
};

function isFanCardInput(value: unknown): value is FanCardInput {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.athleteA === 'object' && input.athleteA !== null &&
    typeof input.athleteB === 'object' && input.athleteB !== null &&
    Array.isArray(input.rows) && input.rows.length <= 12 &&
    typeof input.currentPoseId === 'string'
  );
}

function stripPhotos(athlete: Athlete): Athlete {
  const copy = { ...athlete };
  delete copy.photos;
  return copy;
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
}
