'use client';

import { useScorecard } from '@/lib/store';
import { displayScores, verdict } from '@/lib/scoring';

function fmt(n: number): string {
  return n.toFixed(1);
}

export function FinalScore() {
  const rows = useScorecard((s) => s.rows);
  const athleteA = useScorecard((s) => s.athleteA);
  const athleteB = useScorecard((s) => s.athleteB);

  const scores = displayScores(rows);
  const v = verdict(rows);
  const aWinning = v.kind === 'winner' && v.side === 'A';
  const bWinning = v.kind === 'winner' && v.side === 'B';

  return (
    <div
      data-mosaic-final
      className="border border-[var(--rule)] bg-black p-5 sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between border-b border-white/15 pb-2">
        <span className="eyebrow text-[var(--fg-dim)]">Final Score</span>
        <span className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--fg-mute)]">
          0–100 · sums to 100
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <Row name={athleteA.name} value={fmt(scores.a)} highlight={aWinning} color="var(--side-a)" />
        <div className="border-t border-white/10" />
        <Row name={athleteB.name} value={fmt(scores.b)} highlight={bWinning} color="var(--side-b)" />
      </div>

      <div className="mt-6 border-t border-white/15 pt-4 text-center">
        {v.kind === 'tie' ? (
          <span className="font-display text-3xl uppercase tracking-[0.4em] text-[var(--accent)] sm:text-4xl">
            Dead Heat
          </span>
        ) : (
          <span className="font-display text-2xl uppercase tracking-[0.2em] text-[var(--fg)] sm:text-3xl">
            <span style={{ color: v.side === 'A' ? 'var(--side-a)' : 'var(--side-b)' }}>
              {v.side === 'A' ? athleteA.name : athleteB.name}
            </span>{' '}
            <span className="text-[var(--fg-dim)]">wins by</span>{' '}
            <span className="text-[var(--accent)] tabular">{fmt(v.margin)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function Row({
  name,
  value,
  highlight,
  color,
}: {
  name: string;
  value: string;
  highlight: boolean;
  color: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-4">
      <span
        className="font-display truncate text-2xl uppercase tracking-[0.2em] sm:text-3xl"
        style={{ color: highlight ? color : 'var(--fg)' }}
      >
        {name}
      </span>
      <span
        className="font-display tabular text-6xl leading-none sm:text-7xl"
        style={{ color: highlight ? color : 'var(--fg)' }}
      >
        {value}
      </span>
    </div>
  );
}
