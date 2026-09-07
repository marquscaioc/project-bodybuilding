import { NextRequest, NextResponse } from 'next/server';
import {
  CLAIM_COOKIE,
  CLAIM_SESSION_MAX_AGE,
  createClaimToken,
  createFanToken,
  FAN_COOKIE,
  FAN_SESSION_MAX_AGE,
  secureCookieOptions,
  verifyClaimToken,
} from '@/lib/fanAuth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const NO_STORE = { 'Cache-Control': 'no-store' };
const TOKEN_PATTERN = /^[a-f0-9]{40}$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const { invite, databaseError } = await findInvite(token);
  if (databaseError) return unavailable();
  if (!invite) return missingInvite();

  const expired = new Date(invite.expires_at).getTime() <= Date.now();
  const claimId = await verifyClaimToken(request.cookies.get(CLAIM_COOKIE)?.value);
  const admin = getSupabaseAdmin();
  const claim = claimId
    ? (await admin
        .from('superchat_claims')
        .select('*')
        .eq('id', claimId)
        .eq('invite_id', invite.id)
        .maybeSingle()).data
    : null;

  const payload = {
    invite: publicInvite(invite),
    expired,
    claim: claim
      ? { status: claim.status, verificationCode: claim.verification_code }
      : null,
  };

  if (claim?.status !== 'approved' || invite.status !== 'claimed' || expired) {
    return NextResponse.json(payload, { headers: NO_STORE });
  }

  const { data: card } = await admin
    .from('fan_scorecards')
    .select('id')
    .eq('invite_id', invite.id)
    .maybeSingle();
  if (!card) {
    return NextResponse.json({ error: 'Scorecard not found' }, { status: 404, headers: NO_STORE });
  }

  const response = NextResponse.json(
    { ...payload, scorecardPath: '/fan/scorecard' },
    { headers: NO_STORE },
  );
  response.cookies.set(FAN_COOKIE, await createFanToken(card.id), secureCookieOptions(FAN_SESSION_MAX_AGE));
  return response;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const { invite, databaseError } = await findInvite(token);
  if (databaseError) return unavailable();
  if (!invite) return missingInvite();

  if (invite.status !== 'active' || new Date(invite.expires_at).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: 'This invitation is no longer accepting requests' },
      { status: 409, headers: NO_STORE },
    );
  }

  const admin = getSupabaseAdmin();
  const existingClaimId = await verifyClaimToken(request.cookies.get(CLAIM_COOKIE)?.value);
  if (existingClaimId) {
    const { data: existing } = await admin
      .from('superchat_claims')
      .select('*')
      .eq('id', existingClaimId)
      .eq('invite_id', invite.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (existing) return claimResponse(existing.id, existing.verification_code, false);
  }

  const { count: pendingCount, error: countError } = await admin
    .from('superchat_claims')
    .select('*', { count: 'exact', head: true })
    .eq('invite_id', invite.id)
    .eq('status', 'pending');
  if (countError) return unavailable();
  if ((pendingCount ?? 0) >= 20) {
    return NextResponse.json(
      { error: 'This invitation has too many pending requests. Ask Dylan for a new link.' },
      { status: 429, headers: NO_STORE },
    );
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const verificationCode = createVerificationCode();
    const { data: claim, error } = await admin
      .from('superchat_claims')
      .insert({ invite_id: invite.id, verification_code: verificationCode })
      .select('*')
      .single();
    if (claim) return claimResponse(claim.id, claim.verification_code, true);
    if (error?.code !== '23505') break;
  }

  return NextResponse.json(
    { error: 'Could not create access request' },
    { status: 502, headers: NO_STORE },
  );
}

async function findInvite(token: string) {
  if (!TOKEN_PATTERN.test(token)) return { invite: null, databaseError: false };
  const { data, error } = await getSupabaseAdmin()
    .from('superchat_invites')
    .select('*')
    .eq('claim_token', token)
    .maybeSingle();
  return { invite: data, databaseError: Boolean(error) };
}

type Invite = NonNullable<Awaited<ReturnType<typeof findInvite>>['invite']>;

function publicInvite(invite: Invite) {
  return {
    displayName: invite.display_name,
    amount: invite.amount,
    currency: invite.currency,
    status: invite.status,
    expiresAt: invite.expires_at,
  };
}

function createVerificationCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const suffix = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
  return `PB-${suffix}`;
}

async function claimResponse(claimId: string, verificationCode: string, created: boolean) {
  const response = NextResponse.json(
    { claim: { status: 'pending', verificationCode } },
    { status: created ? 201 : 200, headers: NO_STORE },
  );
  response.cookies.set(
    CLAIM_COOKIE,
    await createClaimToken(claimId),
    secureCookieOptions(CLAIM_SESSION_MAX_AGE),
  );
  return response;
}

function missingInvite() {
  return NextResponse.json({ error: 'Invitation not found' }, { status: 404, headers: NO_STORE });
}

function unavailable() {
  return NextResponse.json(
    { error: 'Scorecard service is temporarily unavailable' },
    { status: 503, headers: NO_STORE },
  );
}
