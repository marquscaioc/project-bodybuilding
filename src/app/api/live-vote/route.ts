import { NextRequest, NextResponse } from 'next/server';
import { CATEGORIES, POSES } from '@/lib/constants';
import {
  createVoterToken,
  secureCookieOptions,
  verifyVoterToken,
  VOTER_COOKIE,
  VOTER_SESSION_MAX_AGE,
} from '@/lib/fanAuth';
import { HOST_SLUG, SHOW_ID } from '@/lib/show';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { Athlete } from '@/types';
import type { LiveVoteChoice } from '@/lib/types/db';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_BODY_BYTES = 8 * 1024;
const VALID_ROW_IDS = new Set([...POSES, ...CATEGORIES].map((row) => row.id));
const VALID_CHOICES = new Set<LiveVoteChoice>([
  'A1', 'A2', 'A3', 'A4', 'tie', 'B1', 'B2', 'B3', 'B4',
]);

type VoteMap = Record<string, LiveVoteChoice>;

function normalizedName(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object') return fallback;
  const name = (value as Athlete).name;
  return typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : fallback;
}

async function matchup() {
  const { data, error } = await getSupabaseAdmin()
    .from('judge_cards')
    .select('athlete_a, athlete_b')
    .eq('slug', HOST_SLUG)
    .maybeSingle();

  if (error) throw error;
  const athleteA = normalizedName(data?.athlete_a, 'Athlete A');
  const athleteB = normalizedName(data?.athlete_b, 'Athlete B');
  const source = `${SHOW_ID}\u0000${athleteA.toLocaleLowerCase()}\u0000${athleteB.toLocaleLowerCase()}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  const key = Buffer.from(digest).toString('base64url').slice(0, 32);
  return { key, athleteA, athleteB };
}

async function snapshot(voterId: string | null) {
  const current = await matchup();
  const admin = getSupabaseAdmin();
  const [resultsQuery, countQuery, ownQuery] = await Promise.all([
    admin.rpc('live_vote_results', { p_matchup_key: current.key }),
    admin
      .from('live_votes')
      .select('id', { count: 'exact', head: true })
      .eq('matchup_key', current.key),
    voterId
      ? admin
          .from('live_votes')
          .select('username, votes')
          .eq('matchup_key', current.key)
          .eq('voter_id', voterId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (resultsQuery.error || countQuery.error || ownQuery.error) {
    throw resultsQuery.error ?? countQuery.error ?? ownQuery.error;
  }

  const byRow = new Map((resultsQuery.data ?? []).map((row) => [row.row_id, row]));
  const rows = [...POSES, ...CATEGORIES].map((definition) => {
    const result = byRow.get(definition.id);
    const averageA = Number(result?.average_a ?? 50);
    return {
      id: definition.id,
      label: definition.label,
      type: 'short' in definition ? 'pose' as const : 'category' as const,
      total: Number(result?.vote_count ?? 0),
      votesA: Number(result?.votes_a ?? 0),
      votesB: Number(result?.votes_b ?? 0),
      ties: Number(result?.ties ?? 0),
      averageA,
      averageB: 100 - averageA,
      distribution: {
        A1: Number(result?.distribution?.A1 ?? 0),
        A2: Number(result?.distribution?.A2 ?? 0),
        A3: Number(result?.distribution?.A3 ?? 0),
        A4: Number(result?.distribution?.A4 ?? 0),
        tie: Number(result?.distribution?.tie ?? 0),
        B1: Number(result?.distribution?.B1 ?? 0),
        B2: Number(result?.distribution?.B2 ?? 0),
        B3: Number(result?.distribution?.B3 ?? 0),
        B4: Number(result?.distribution?.B4 ?? 0),
      },
    };
  });

  const votedRows = rows.filter((row) => row.total > 0);
  const totalCalls = votedRows.reduce((sum, row) => sum + row.total, 0);
  const averageA = totalCalls
    ? votedRows.reduce((sum, row) => sum + row.averageA * row.total, 0) / totalCalls
    : 50;

  return {
    matchup: current,
    participants: countQuery.count ?? 0,
    averageA,
    averageB: 100 - averageA,
    rows,
    me: ownQuery.data
      ? { username: ownQuery.data.username, votes: ownQuery.data.votes as VoteMap }
      : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const voterId = await verifyVoterToken(request.cookies.get(VOTER_COOKIE)?.value);
    return NextResponse.json(await snapshot(voterId), { headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { error: 'Could not load the live vote' },
      { status: 502, headers: NO_STORE },
    );
  }
}

export async function POST(request: NextRequest) {
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

  const parsed = parseBallot(body);
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid username or ballot' }, { status: 400, headers: NO_STORE });
  }

  try {
    const current = await matchup();
    const existingId = await verifyVoterToken(request.cookies.get(VOTER_COOKIE)?.value);
    const voterId = existingId ?? crypto.randomUUID();
    const { error } = await getSupabaseAdmin().from('live_votes').upsert(
      {
        matchup_key: current.key,
        voter_id: voterId,
        username: parsed.username,
        votes: parsed.votes,
      },
      { onConflict: 'matchup_key,voter_id' },
    );

    if (error) throw error;
    const response = NextResponse.json(await snapshot(voterId), { headers: NO_STORE });
    if (!existingId) {
      response.cookies.set(
        VOTER_COOKIE,
        await createVoterToken(voterId),
        secureCookieOptions(VOTER_SESSION_MAX_AGE),
      );
    }
    return response;
  } catch {
    return NextResponse.json(
      { error: 'Could not save the live vote' },
      { status: 502, headers: NO_STORE },
    );
  }
}

function parseBallot(value: unknown): { username: string; votes: VoteMap } | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.username !== 'string' || !record.votes || typeof record.votes !== 'object') {
    return null;
  }

  const username = record.username.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ');
  if (username.length < 2 || username.length > 32) return null;

  const entries = Object.entries(record.votes as Record<string, unknown>);
  if (entries.length > VALID_ROW_IDS.size) return null;
  const votes: VoteMap = {};
  for (const [rowId, choice] of entries) {
    if (!VALID_ROW_IDS.has(rowId) || !VALID_CHOICES.has(choice as LiveVoteChoice)) return null;
    votes[rowId] = choice as LiveVoteChoice;
  }
  return { username, votes };
}
