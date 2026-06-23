'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { BUILTIN_JUDGES } from '@/lib/builtinJudges';
import { getJudgeSession, HOST_SLUG } from '@/lib/show';
import { consensus, type JudgeScore } from '@/lib/scoring';
import type { JudgeCardRow } from '@/lib/types/db';
import type { Row } from '@/types';

/**
 * Host console — Project Bodybuilding only. A realtime board of every desk,
 * face-down until the host reveals. Reveal flips each judge's 0–100 call and
 * raw points, then shows the consensus average across the scored desks.
 *
 * Reveal is local theater on the host's screen (no DB write) — the host owns
 * the moment on stream.
 */
export default function HostPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [cards, setCards] = useState<Map<string, JudgeCardRow>>(new Map());
  const [revealed, setRevealed] = useState(false);

  // Gate: host desk only.
  useEffect(() => {
    const s = getJudgeSession();
    if (s !== HOST_SLUG) {
      router.replace('/login?next=/host');
      return;
    }
    setAuthed(true);
  }, [router]);

  // Load + subscribe to every desk in realtime.
  useEffect(() => {
    if (!authed) return;
    const sb = getSupabaseBrowser();
    let cancelled = false;

    async function load() {
      const { data, error } = await sb.from('judge_cards').select('*');
      if (cancelled || error || !data) return;
      setCards(new Map(data.map((r) => [r.slug, r])));
    }
    load();

    const channel = sb
      .channel('host-judge-cards')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'judge_cards' },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      sb.removeChannel(channel);
    };
  }, [authed]);

  // Build the consensus over all desks (unscored desks are excluded inside).
  const cons = useMemo(
    () =>
      consensus(
        BUILTIN_JUDGES.map((j) => ({
          slug: j.slug,
          rows: (cards.get(j.slug)?.rows ?? []) as Row[],
        })),
      ),
    [cards],
  );
  const byJudge = useMemo(() => {
    const m = new Map<string, JudgeScore>();
    cons.perJudge.forEach((p) => m.set(p.slug, p));
    return m;
  }, [cons]);

  // Athlete labels come from the host's own card; fall back to defaults.
  const hostRow = cards.get(HOST_SLUG);
  const labelA = hostRow?.athlete_a?.name?.trim() || 'Athlete A';
  const labelB = hostRow?.athlete_b?.name?.trim() || 'Athlete B';

  if (!authed) return null;

  const total = BUILTIN_JUDGES.length;

  return (
    <main className="theme-wrap theme-project-bodybuilding bb-stage relative flex min-h-dvh flex-col">
      <div aria-hidden className="bb-stage-floor" />
      <span className="bb-corner tl" />
      <span className="bb-corner tr" />
      <span className="bb-corner bl" />
      <span className="bb-corner br" />

      {/* Top bar */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1300px] flex-wrap items-center justify-between gap-3 px-6 pt-6 sm:px-10">
        <div className="flex items-center gap-3">
          <span className="bb-live-dot" />
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.28em] text-[#ff7aa8]">
            ON&nbsp;AIR &middot; Host console
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.25em] text-[#d8a8e8]">
            {cons.scoredCount}/{total} desks scored
          </span>
          <Link
            href="/desk"
            className="border border-[var(--rule-strong)] bg-transparent px-3 py-1.5 font-display text-[0.65rem] uppercase tracking-[0.25em] text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            ← My desk
          </Link>
        </div>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1300px] flex-1 px-6 py-10 sm:px-10">
        {/* Matchup + consensus */}
        <ConsensusPanel
          labelA={labelA}
          labelB={labelB}
          revealed={revealed}
          scoredCount={cons.scoredCount}
          consensusA={cons.consensusA}
          consensusB={cons.consensusB}
          verdict={cons.verdict}
        />

        {/* Reveal control */}
        <div className="mt-8 flex items-center justify-center">
          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              disabled={cons.scoredCount === 0}
              className="group inline-flex items-center gap-3 border border-[#ff2d8c] bg-[#ff2d8c] px-8 py-4 font-display text-xl uppercase tracking-[0.25em] text-[#150318] transition hover:bg-transparent hover:text-[#ff2d8c] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="bb-live-dot" style={{ background: '#150318', width: 7, height: 7 }} />
              {cons.scoredCount === 0 ? 'Waiting for judges' : 'Reveal scores'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setRevealed(false)}
              className="inline-flex items-center gap-2 border border-[var(--rule-strong)] bg-transparent px-6 py-3 font-display text-sm uppercase tracking-[0.25em] text-[var(--fg-dim)] transition hover:text-[var(--fg)]"
            >
              Hide scores
            </button>
          )}
        </div>

        {/* Judge board */}
        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {BUILTIN_JUDGES.map((j) => (
            <HostJudgeCard
              key={j.slug}
              name={j.name}
              logoSrc={j.logoSrc}
              swatch={j.swatch}
              accent={j.accent}
              deep={j.deep}
              score={byJudge.get(j.slug)}
              revealed={revealed}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function ConsensusPanel({
  labelA,
  labelB,
  revealed,
  scoredCount,
  consensusA,
  consensusB,
  verdict,
}: {
  labelA: string;
  labelB: string;
  revealed: boolean;
  scoredCount: number;
  consensusA: number;
  consensusB: number;
  verdict: ReturnType<typeof consensus>['verdict'];
}) {
  const banner =
    scoredCount === 0
      ? 'Awaiting scores'
      : verdict.kind === 'tie'
        ? 'Dead heat'
        : `${verdict.side === 'A' ? labelA : labelB} by ${verdict.margin}`;

  return (
    <section
      data-mosaic-final
      className="relative overflow-hidden border border-[var(--rule-strong)] p-6 sm:p-9"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="bb-stamp text-[#ff2d8c]">
          <span className="bb-live-dot" style={{ background: '#ff2d8c', width: 6, height: 6 }} />
          Consensus
        </span>
        <span className="font-mono text-[0.55rem] uppercase tracking-[0.25em] text-[var(--fg-mute)]">
          Average of {scoredCount} {scoredCount === 1 ? 'desk' : 'desks'}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
        <ConsensusSide label={labelA} value={consensusA} reveal={revealed} align="left" />
        <span className="font-display text-2xl text-[var(--fg-mute)] sm:text-4xl">vs</span>
        <ConsensusSide label={labelB} value={consensusB} reveal={revealed} align="right" />
      </div>

      {/* Split bar */}
      <div className="mt-6 flex h-3 overflow-hidden border border-[var(--rule)]">
        <span
          className="h-full transition-[width] duration-700 ease-out"
          style={{
            width: revealed ? `${consensusA}%` : '50%',
            background: 'var(--mosaic-1)',
          }}
        />
        <span
          className="h-full flex-1 transition-all duration-700"
          style={{ background: 'var(--mosaic-2)' }}
        />
      </div>

      <div className="mt-5 text-center">
        <span
          className="font-display text-xl uppercase tracking-[0.2em] sm:text-2xl"
          style={{ color: revealed ? 'var(--mosaic-3)' : 'var(--fg-mute)' }}
        >
          {revealed ? banner : 'Scores hidden'}
        </span>
      </div>
    </section>
  );
}

function ConsensusSide({
  label,
  value,
  reveal,
  align,
}: {
  label: string;
  value: number;
  reveal: boolean;
  align: 'left' | 'right';
}) {
  return (
    <div className={align === 'right' ? 'text-right' : 'text-left'}>
      <div className="truncate font-display text-lg uppercase tracking-[0.18em] text-[var(--fg)] sm:text-2xl">
        {label}
      </div>
      <div className="font-display tabular text-5xl leading-none text-[var(--fg)] sm:text-7xl">
        {reveal ? value.toFixed(1) : '— —'}
      </div>
    </div>
  );
}

function HostJudgeCard({
  name,
  logoSrc,
  swatch,
  accent,
  deep,
  score,
  revealed,
}: {
  name: string;
  logoSrc?: string;
  swatch: string;
  accent: string;
  deep: string;
  score?: JudgeScore;
  revealed: boolean;
}) {
  const scored = score?.scored ?? false;
  return (
    <div
      className="bb-tile"
      style={
        {
          '--mosaic-1': swatch,
          '--mosaic-3': accent,
          '--mosaic-5': deep,
        } as React.CSSProperties
      }
    >
      <span className="bb-tile-tag">
        {scored ? '● Scored' : '○ Waiting'}
      </span>
      {logoSrc ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={logoSrc}
          alt=""
          className="bb-tile-avatar"
          style={{ filter: revealed ? 'none' : 'grayscale(0.6) brightness(0.7)' }}
        />
      ) : (
        <span
          className="bb-tile-avatar flex items-center justify-center font-display text-lg text-[#0a0a0a]"
          style={{ background: swatch }}
        >
          {name.charAt(0)}
        </span>
      )}
      <span className="bb-tile-name">
        <span className="bb-tile-name-1">{name}</span>
        {revealed && scored ? (
          <span className="bb-tile-name-2 tabular">
            {score!.displayA.toFixed(1)} — {score!.displayB.toFixed(1)}
            <span className="text-[var(--fg-mute)]">
              {'  '}· {score!.pointsA}-{score!.pointsB} pts
            </span>
          </span>
        ) : revealed ? (
          <span className="bb-tile-name-2 text-[var(--fg-mute)]">No score</span>
        ) : (
          <span className="bb-tile-name-2">{scored ? 'Locked in' : 'Scoring…'}</span>
        )}
      </span>
    </div>
  );
}
