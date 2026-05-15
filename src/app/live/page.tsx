'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { ProfileRow, ScorecardRow } from '@/lib/types/db';
import { paletteToStyle } from '@/lib/customJudges';
import type { Row } from '@/types';

type JudgeView = {
  profile: ProfileRow;
  scorecard?: ScorecardRow;
};

export default function LivePage() {
  const router = useRouter();
  const [me, setMe] = useState<string | null>(null);
  const [judges, setJudges] = useState<JudgeView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabaseBrowser();
    let cancelled = false;

    async function bootstrap() {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        router.push('/login?next=/live');
        return;
      }
      if (cancelled) return;
      setMe(user.id);

      // Fetch all profiles + their scorecards. RLS hides scorecards of
      // judges who haven't toggled visibility on, so this query naturally
      // returns just the live ones (plus your own row).
      const [profilesRes, scorecardsRes] = await Promise.all([
        sb.from('profiles').select('*').order('display_name'),
        sb.from('scorecards').select('*'),
      ]);
      if (cancelled) return;

      const profiles = (profilesRes.data ?? []) as ProfileRow[];
      const scorecards = (scorecardsRes.data ?? []) as ScorecardRow[];

      const byUser = new Map<string, ScorecardRow>();
      scorecards.forEach((s) => byUser.set(s.user_id, s));

      const merged: JudgeView[] = profiles
        .filter((p) => p.is_visible || p.id === user.id)
        .map((p) => ({ profile: p, scorecard: byUser.get(p.id) }));

      setJudges(merged);
      setLoading(false);
    }

    bootstrap();

    // Realtime: listen for any profile/scorecard change and re-merge.
    const channel = sb
      .channel('live-judges')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => bootstrap(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scorecards' },
        () => bootstrap(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      sb.removeChannel(channel);
    };
  }, [router]);

  return (
    <main className="theme-wrap min-h-dvh px-4 py-6 sm:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-display text-2xl uppercase tracking-[0.3em] text-[var(--fg)] sm:text-3xl">
            Live judges
          </span>
          <span className="text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-dim)]">
            Updated in realtime · only visible scorecards shown
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/me"
            className="border border-[var(--rule-strong)] bg-transparent px-3 py-2 font-display text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            ← My scorecard
          </Link>
        </div>
      </header>

      {loading && (
        <div className="flex h-48 items-center justify-center text-[0.7rem] uppercase tracking-[0.3em] text-[var(--fg-dim)]">
          Loading judges…
        </div>
      )}

      {!loading && judges.length === 0 && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
          <span className="font-display text-xl uppercase tracking-[0.25em] text-[var(--fg-dim)]">
            No visible judges yet
          </span>
          <span className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--fg-mute)]">
            Other judges need to flip their visibility toggle on
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {judges.map(({ profile, scorecard }) => (
          <JudgeCard
            key={profile.id}
            profile={profile}
            scorecard={scorecard}
            isMe={profile.id === me}
          />
        ))}
      </div>
    </main>
  );
}

function JudgeCard({
  profile,
  scorecard,
  isMe,
}: {
  profile: ProfileRow;
  scorecard?: ScorecardRow;
  isMe: boolean;
}) {
  const themeStyle = paletteToStyle({
    id: profile.id,
    name: profile.display_name,
    brandLine1: profile.brand_line_1,
    brandLine2: profile.brand_line_2,
    createdAt: 0,
    bg: profile.bg,
    bgGlow: profile.bg_glow,
    fg: profile.fg,
    mosaic1: profile.mosaic_1,
    mosaic2: profile.mosaic_2,
    mosaic3: profile.mosaic_3,
    mosaic4: profile.mosaic_4,
    mosaic5: profile.mosaic_5,
    logoDataUrl: profile.logo_url ?? undefined,
  });

  const totals = computeTotals(scorecard?.rows ?? []);

  return (
    <article
      className="theme-wrap relative overflow-hidden border border-[var(--rule-strong)] bg-[var(--bg)]"
      style={themeStyle}
    >
      <header
        className="flex items-center justify-between gap-3 border-b border-[var(--rule)] px-4 py-3"
        style={{
          background: `linear-gradient(90deg, ${profile.mosaic_5}, ${profile.bg})`,
        }}
      >
        <div className="flex items-center gap-3">
          {profile.logo_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profile.logo_url}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
              style={{ border: `2px solid ${profile.mosaic_1}` }}
            />
          )}
          <div className="flex flex-col">
            <span className="font-display text-base uppercase tracking-[0.25em] text-[var(--fg)]">
              {profile.display_name || 'Judge'}
            </span>
            <span className="text-[0.55rem] uppercase tracking-[0.3em] text-[var(--fg-dim)]">
              {profile.brand_line_1 || ''} · {profile.brand_line_2 || ''}
            </span>
          </div>
        </div>
        {isMe && (
          <span
            className="border px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-[0.25em]"
            style={{ borderColor: profile.mosaic_3, color: profile.mosaic_3 }}
          >
            you
          </span>
        )}
      </header>

      <div className="grid grid-cols-2 gap-px bg-[var(--rule)]">
        <AthleteSummary
          name={scorecard?.athlete_a?.name ?? 'Athlete A'}
          points={totals.a}
          color={profile.mosaic_1}
        />
        <AthleteSummary
          name={scorecard?.athlete_b?.name ?? 'Athlete B'}
          points={totals.b}
          color={profile.mosaic_2}
        />
      </div>

      <div className="px-4 py-3">
        <RowGrid rows={scorecard?.rows ?? []} />
      </div>
    </article>
  );
}

function AthleteSummary({
  name,
  points,
  color,
}: {
  name: string;
  points: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between bg-black/30 px-4 py-2">
      <span
        className="font-display truncate text-base uppercase tracking-[0.2em]"
        style={{ color }}
      >
        {name}
      </span>
      <span className="font-display text-3xl tabular leading-none" style={{ color }}>
        {points}
      </span>
    </div>
  );
}

function RowGrid({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-center text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-mute)]">
        No rows scored yet
      </div>
    );
  }
  return (
    <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
      {rows.map((r) => (
        <div
          key={r.id}
          className="flex flex-col items-center justify-center border border-[var(--rule)] px-1 py-1.5"
          title={r.label}
        >
          <span className="font-display text-[0.55rem] uppercase tracking-[0.15em] text-[var(--fg-dim)]">
            {r.id}
          </span>
          <span className="font-display text-sm leading-none text-[var(--fg)]">
            {r.winner === 'A' || r.winner === 'B'
              ? `${r.margin ?? '?'}${r.winner === 'A' ? '◀' : '▶'}`
              : r.winner === 'tie'
                ? 'TIE'
                : '·'}
          </span>
        </div>
      ))}
    </div>
  );
}

const POSE_WEIGHT = 2;
const CATEGORY_WEIGHT = 1;
function computeTotals(rows: Row[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const r of rows) {
    if (!r.winner) continue;
    if (r.winner === 'tie') {
      if (r.type === 'category') {
        a += 1;
        b += 1;
      }
      continue;
    }
    if (!r.margin) continue;
    const w = r.type === 'pose' ? POSE_WEIGHT : CATEGORY_WEIGHT;
    const pts = r.margin * w;
    if (r.winner === 'A') a += pts;
    else b += pts;
  }
  return { a, b };
}
