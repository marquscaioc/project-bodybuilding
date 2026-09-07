import { NextRequest, NextResponse } from 'next/server';
import { buildInitialRows } from '@/lib/constants';
import { getHostMatchup } from '@/lib/hostMatchup';
import { HOST_SLUG } from '@/lib/show';
import { SHOW_COOKIE, verifyShowToken } from '@/lib/showAuth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { Athlete } from '@/types';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_BODY_BYTES = 32 * 1024;
const MAX_INVITES = 100;

async function isHost(request: NextRequest) {
  return (await verifyShowToken(request.cookies.get(SHOW_COOKIE)?.value)) === HOST_SLUG;
}

export async function GET(request: NextRequest) {
  if (!(await isHost(request))) return forbidden();

  const admin = getSupabaseAdmin();
  const [{ data: invites, error: inviteError }, { data: claims, error: claimError }, { data: cards, error: cardError }] =
    await Promise.all([
      admin.from('superchat_invites').select('*').order('created_at', { ascending: false }).limit(MAX_INVITES),
      admin.from('superchat_claims').select('*').order('created_at', { ascending: false }),
      admin.from('fan_scorecards').select('*'),
    ]);

  if (inviteError || claimError || cardError) {
    return NextResponse.json(
      { error: 'Could not load Super Chat access desk' },
      { status: 502, headers: NO_STORE },
    );
  }

  return NextResponse.json({ invites, claims, cards }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  if (!(await isHost(request))) return forbidden();
  if (isOversized(request)) return tooLarge();

  const body = await readJson(request);
  if (!isCreateInput(body)) {
    return NextResponse.json({ error: 'Invalid invitation data' }, { status: 400, headers: NO_STORE });
  }

  const displayName = body.displayName.trim().slice(0, 80);
  const currency = body.currency.trim().toUpperCase();
  const amount = Math.round(body.amount * 100) / 100;
  const expiresAt = new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000).toISOString();
  const claimToken = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().slice(0, 8);
  const admin = getSupabaseAdmin();

  const { data: invite, error: inviteError } = await admin
    .from('superchat_invites')
    .insert({
      claim_token: claimToken,
      display_name: displayName,
      amount,
      currency,
      note: body.note.trim().slice(0, 240),
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (inviteError || !invite) {
    return NextResponse.json({ error: 'Could not create invitation' }, { status: 502, headers: NO_STORE });
  }

  const hostMatchup = await getHostMatchup();
  const athleteA = stripPhotos(hostMatchup.athleteA);
  const athleteB = stripPhotos(hostMatchup.athleteB);
  const { data: card, error: cardError } = await admin
    .from('fan_scorecards')
    .insert({
      invite_id: invite.id,
      display_name: displayName,
      athlete_a: athleteA,
      athlete_b: athleteB,
      rows: buildInitialRows(),
      current_pose_id: hostMatchup.currentPoseId,
    })
    .select('*')
    .single();

  if (cardError || !card) {
    await admin.from('superchat_invites').delete().eq('id', invite.id);
    return NextResponse.json({ error: 'Could not create scorecard' }, { status: 502, headers: NO_STORE });
  }

  return NextResponse.json(
    { invite, card, claimPath: `/claim/${claimToken}` },
    { status: 201, headers: NO_STORE },
  );
}

export async function PATCH(request: NextRequest) {
  if (!(await isHost(request))) return forbidden();
  if (isOversized(request)) return tooLarge();

  const body = await readJson(request);
  if (!isActionInput(body)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400, headers: NO_STORE });
  }

  const admin = getSupabaseAdmin();

  if (body.action === 'approve' || body.action === 'reject') {
    const { data: claim, error } = await admin
      .from('superchat_claims')
      .select('*')
      .eq('id', body.claimId)
      .maybeSingle();
    if (error || !claim) return notFound('Claim request not found');
    if (claim.status !== 'pending') {
      return NextResponse.json({ error: 'Request was already reviewed' }, { status: 409, headers: NO_STORE });
    }

    const { data: invite } = await admin
      .from('superchat_invites')
      .select('*')
      .eq('id', claim.invite_id)
      .maybeSingle();
    if (!invite) return notFound('Invitation not found');

    if (body.action === 'reject') {
      const { error: rejectError } = await admin
        .from('superchat_claims')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', claim.id)
        .eq('status', 'pending');
      return rejectError ? failed('Could not reject request') : ok();
    }

    if (invite.status !== 'active' || new Date(invite.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Invitation is no longer active' }, { status: 409, headers: NO_STORE });
    }

    const reviewedAt = new Date().toISOString();
    const { error: approveError } = await admin
      .from('superchat_claims')
      .update({ status: 'approved', reviewed_at: reviewedAt })
      .eq('id', claim.id)
      .eq('status', 'pending');
    if (approveError) return failed('Could not approve request');

    await admin
      .from('superchat_claims')
      .update({ status: 'rejected', reviewed_at: reviewedAt })
      .eq('invite_id', invite.id)
      .eq('status', 'pending')
      .neq('id', claim.id);

    const { error: inviteUpdateError } = await admin
      .from('superchat_invites')
      .update({ status: 'claimed' })
      .eq('id', invite.id)
      .eq('status', 'active');
    return inviteUpdateError ? failed('Could not finalize approval') : ok();
  }

  if (!('inviteId' in body)) {
    return NextResponse.json({ error: 'Invalid invitation action' }, { status: 400, headers: NO_STORE });
  }

  const { data: invite, error } = await admin
    .from('superchat_invites')
    .select('id, status')
    .eq('id', body.inviteId)
    .maybeSingle();
  if (error || !invite) return notFound('Invitation not found');

  if (body.action === 'close') {
    const [{ error: inviteError }, { error: cardError }] = await Promise.all([
      admin.from('superchat_invites').update({ status: 'closed' }).eq('id', invite.id),
      admin.from('fan_scorecards').update({ locked: true }).eq('invite_id', invite.id),
    ]);
    return inviteError || cardError ? failed('Could not close scorecard') : ok();
  }

  if (invite.status !== 'closed') {
    return NextResponse.json({ error: 'Only a closed invitation can be reopened' }, { status: 409, headers: NO_STORE });
  }
  const { count: approvedCount } = await admin
    .from('superchat_claims')
    .select('*', { count: 'exact', head: true })
    .eq('invite_id', invite.id)
    .eq('status', 'approved');
  const nextStatus = approvedCount ? 'claimed' : 'active';
  const [{ error: inviteError }, { error: cardError }] = await Promise.all([
    admin
      .from('superchat_invites')
      .update({ status: nextStatus, expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() })
      .eq('id', invite.id),
    admin.from('fan_scorecards').update({ locked: false }).eq('invite_id', invite.id),
  ]);
  return inviteError || cardError ? failed('Could not reopen scorecard') : ok();
}

function stripPhotos(athlete: Athlete): Athlete {
  const copy = { ...athlete };
  delete copy.photos;
  return copy;
}

function isOversized(request: NextRequest) {
  const length = Number(request.headers.get('content-length'));
  return Number.isFinite(length) && length > MAX_BODY_BYTES;
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isCreateInput(value: unknown): value is {
  displayName: string;
  amount: number;
  currency: string;
  note: string;
  expiresInHours: number;
} {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.displayName === 'string' && input.displayName.trim().length > 0 && input.displayName.length <= 100 &&
    typeof input.amount === 'number' && Number.isFinite(input.amount) && input.amount >= 0 && input.amount <= 999_999_999 &&
    typeof input.currency === 'string' && /^[A-Za-z]{3}$/.test(input.currency.trim()) &&
    typeof input.note === 'string' && input.note.length <= 300 &&
    typeof input.expiresInHours === 'number' && Number.isInteger(input.expiresInHours) &&
    input.expiresInHours >= 1 && input.expiresInHours <= 72
  );
}

function isActionInput(value: unknown): value is
  | { action: 'approve' | 'reject'; claimId: string }
  | { action: 'close' | 'reopen'; inviteId: string } {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  if ((input.action === 'approve' || input.action === 'reject') && typeof input.claimId === 'string') return true;
  return (input.action === 'close' || input.action === 'reopen') && typeof input.inviteId === 'string';
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
}

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404, headers: NO_STORE });
}

function failed(message: string) {
  return NextResponse.json({ error: message }, { status: 502, headers: NO_STORE });
}

function tooLarge() {
  return NextResponse.json({ error: 'Payload too large' }, { status: 413, headers: NO_STORE });
}

function ok() {
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
