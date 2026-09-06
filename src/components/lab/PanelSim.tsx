'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { BUILTIN_JUDGES } from '@/lib/builtinJudges';
import type { JudgeCardRow } from '@/lib/types/db';
import type { Row } from '@/types';
import {
  CONFIDENCE_Z,
  consensusV2,
  diffToDisplay,
  differentialV2,
  isScoredV2,
  v1RowToV2,
  type DeskDiff,
} from '@/lib/scoringV2';

/**
 * Panel simulator — the only way to test the trimmed mean and the error bar
 * before a real show. Seven desks, each carrying a raw signed differential;
 * the readout compares the plain mean against the trimmed one and prints the
 * uncertainty that decides whether a verdict is honest.
 */

const RANGE = 20;

type Desk = { slug: string; name: string; diff: number; scored: boolean };

/** A plausible show: the panel leans one way, one desk mildly dissents. */
const DEFAULT_SEED = [6, 4, 8, 5, 3, 7, -6];
/** One desk 22 points away from a panel that otherwise agrees exactly. */
const ROGUE_SEED = [2, 2, 2, 2, 2, 2, -20];

function seedDesks(seeds: number[] = DEFAULT_SEED): Desk[] {
  return BUILTIN_JUDGES.map((j, i) => ({
    slug: j.slug,
    name: j.name,
    diff: seeds[i] ?? 0,
    scored: true,
  }));
}

function gaussian(): number {
  // Box-Muller, adequate for shaking a panel around.
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clampDiff(n: number): number {
  return Math.max(-RANGE, Math.min(RANGE, Math.round(n)));
}

export function PanelSim() {
  const [desks, setDesks] = useState<Desk[]>(seedDesks);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cons = useMemo(
    () =>
      consensusV2(
        desks.map<DeskDiff>((d) => ({ slug: d.slug, diff: d.diff, scored: d.scored })),
      ),
    [desks],
  );

  const trimmedSet = useMemo(() => new Set(cons.trimmed), [cons.trimmed]);
  const simpleDisplay = diffToDisplay(cons.simpleMeanDiff);

  function setDiff(slug: string, diff: number) {
    setDesks((ds) => ds.map((d) => (d.slug === slug ? { ...d, diff } : d)));
    setStatus(null);
  }

  function toggleScored(slug: string) {
    setDesks((ds) => ds.map((d) => (d.slug === slug ? { ...d, scored: !d.scored } : d)));
    setStatus(null);
  }

  function randomise() {
    const truth = Math.round((Math.random() * 2 - 1) * 8);
    setDesks((ds) =>
      ds.map((d) => ({ ...d, diff: clampDiff(truth + gaussian() * 4), scored: true })),
    );
    setStatus(`Randomised around a true differential of ${truth}.`);
  }

  function rogue() {
    setDesks(seedDesks(ROGUE_SEED));
    setStatus(
      'Six desks agree on A; one is 22 points the other way. The trim saves the mean — but that much disagreement widens the error bar past the lead, so the panel declines the verdict.',
    );
  }

  async function loadLive() {
    setLoading(true);
    setStatus('Reading judge_cards…');
    try {
      const response = await fetch('/api/host/cards', { cache: 'no-store' });
      if (!response.ok) throw new Error(`request failed (${response.status})`);
      const { cards: data } = await response.json() as { cards: JudgeCardRow[] };
      const bySlug = new Map<string, JudgeCardRow>(
        data.map((row) => [row.slug, row]),
      );
      let found = 0;
      setDesks((ds) =>
        ds.map((d) => {
          const v1Rows = (bySlug.get(d.slug)?.rows ?? []) as Row[];
          if (v1Rows.length === 0) return { ...d, diff: 0, scored: false };
          const v2Rows = v1Rows.map(v1RowToV2);
          const scored = isScoredV2(v2Rows);
          if (scored) found += 1;
          return { ...d, diff: differentialV2(v2Rows), scored };
        }),
      );
      setStatus(
        found === 0
          ? 'No desk has scored yet — the live cards are all blank.'
          : `Loaded ${found} live ${found === 1 ? 'desk' : 'desks'}.`,
      );
    } catch (err) {
      setStatus(
        `Could not read the live desks: ${
          err instanceof Error ? err.message : 'unknown error'
        }. The Supabase project may be paused.`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border border-[var(--rule-strong)] p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="bb-stamp text-[var(--mosaic-3,var(--accent))]">
          Panel · trimmed mean + uncertainty
        </span>
        <div className="flex flex-wrap gap-2">
          <SimButton onClick={randomise}>Randomise</SimButton>
          <SimButton onClick={rogue}>Rogue desk</SimButton>
          <SimButton onClick={loadLive} disabled={loading}>
            {loading ? 'Loading…' : 'Load live desks'}
          </SimButton>
        </div>
      </div>

      {status && (
        <p className="mt-3 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[var(--fg-mute)]">
          {status}
        </p>
      )}

      {/* Desk sliders */}
      <div className="mt-5 flex flex-col divide-y divide-[var(--rule-soft)] border border-[var(--rule)]">
        {desks.map((d) => {
          const isTrimmed = trimmedSet.has(d.slug) && d.scored;
          return (
            <div
              key={d.slug}
              className={clsx(
                'grid grid-cols-[9rem_1fr_4rem] items-center gap-3 px-3 py-2 transition',
                !d.scored && 'opacity-35',
                isTrimmed && 'bg-[var(--accent-soft)]',
              )}
            >
              <button
                type="button"
                onClick={() => toggleScored(d.slug)}
                title={d.scored ? 'Mark this desk as not scored' : 'Mark this desk as scored'}
                className="flex items-baseline gap-2 text-left"
              >
                <span className="truncate font-display text-sm uppercase tracking-[0.15em] text-[var(--fg)]">
                  {d.name}
                </span>
                {isTrimmed && (
                  <span className="font-mono text-[0.5rem] uppercase tracking-[0.2em] text-[var(--accent)]">
                    trim
                  </span>
                )}
              </button>

              <input
                type="range"
                min={-RANGE}
                max={RANGE}
                step={1}
                value={d.diff}
                disabled={!d.scored}
                onChange={(e) => setDiff(d.slug, Number(e.target.value))}
                aria-label={`${d.name} differential`}
                className="w-full accent-[var(--mosaic-1,var(--accent))]"
              />

              <span
                className="tabular text-right font-mono text-sm"
                style={{
                  color:
                    d.diff > 0
                      ? 'var(--side-a)'
                      : d.diff < 0
                        ? 'var(--side-b)'
                        : 'var(--fg-mute)',
                }}
              >
                {d.diff > 0 ? `+${d.diff}` : d.diff}
              </span>
            </div>
          );
        })}
      </div>

      {/* Readout */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Stat
          label="Plain mean"
          value={fmt(cons.simpleMeanDiff)}
          sub={`${simpleDisplay.a.toFixed(1)} – ${simpleDisplay.b.toFixed(1)}`}
          dim
        />
        <Stat
          label={cons.trimmed.length > 0 ? 'Trimmed mean' : 'Mean (no trim under 5 desks)'}
          value={fmt(cons.meanDiff)}
          sub={`${cons.consensusA.toFixed(1)} – ${cons.consensusB.toFixed(1)}`}
        />
        <Stat label="Spread (sd)" value={fmt(cons.sd)} sub={`${cons.scoredCount} desks`} dim />
        <Stat
          label="Uncertainty"
          value={`± ${fmt(CONFIDENCE_Z * cons.sem)}`}
          sub={`SEM ${fmt(cons.sem)} × ${CONFIDENCE_Z}`}
          dim
        />
      </div>

      <div className="mt-6 border-t border-[var(--rule-strong)] pt-5 text-center">
        {cons.scoredCount === 0 ? (
          <span className="font-display text-xl uppercase tracking-[0.2em] text-[var(--fg-mute)]">
            No desks scored
          </span>
        ) : cons.tooClose ? (
          <div>
            <span className="font-display text-2xl uppercase tracking-[0.2em] text-[var(--accent)] sm:text-4xl">
              Too close to call
            </span>
            <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[var(--fg-mute)]">
              lead {fmt(Math.abs(cons.meanDiff))} does not clear {fmt(CONFIDENCE_Z * cons.sem)}
            </p>
          </div>
        ) : (
          <div>
            <span className="font-display text-2xl uppercase tracking-[0.2em] text-[var(--fg)] sm:text-4xl">
              {cons.verdict.kind === 'winner'
                ? `Athlete ${cons.verdict.side} by ${cons.verdict.margin.toFixed(1)}`
                : 'Dead heat'}
            </span>
            <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[var(--fg-mute)]">
              lead {fmt(Math.abs(cons.meanDiff))} clears {fmt(CONFIDENCE_Z * cons.sem)}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function SimButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border border-[var(--rule-strong)] px-3 py-1.5 font-display text-[0.62rem] uppercase tracking-[0.22em] text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
  sub,
  dim = false,
}: {
  label: string;
  value: string;
  sub: string;
  dim?: boolean;
}) {
  return (
    <div className="border border-[var(--rule)] px-4 py-3">
      <div className="font-mono text-[0.55rem] uppercase tracking-[0.25em] text-[var(--fg-mute)]">
        {label}
      </div>
      <div
        className={clsx(
          'tabular mt-1 font-display text-3xl',
          dim ? 'text-[var(--fg-dim)]' : 'text-[var(--fg)]',
        )}
      >
        {value}
      </div>
      <div className="tabular font-mono text-[0.6rem] text-[var(--fg-mute)]">{sub}</div>
    </div>
  );
}

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}
