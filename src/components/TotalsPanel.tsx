'use client';

import { useScorecard } from '@/lib/store';
import { splitTotals, totalPoints } from '@/lib/scoring';

function Cell({
  label,
  a,
  b,
  emphasis,
}: {
  label: string;
  a: number;
  b: number;
  emphasis?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 items-center gap-2">
      <span className="text-[0.7rem] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
        {label}
      </span>
      <span
        className={`text-center font-display tabular ${emphasis ? 'text-3xl text-sky-300' : 'text-xl text-[var(--fg)]'}`}
      >
        {a}
      </span>
      <span
        className={`text-right font-display tabular ${emphasis ? 'text-3xl text-rose-300' : 'text-xl text-[var(--fg)]'}`}
      >
        {b}
      </span>
    </div>
  );
}

export function TotalsPanel() {
  const rows = useScorecard((s) => s.rows);
  const split = splitTotals(rows);
  const total = totalPoints(rows);

  return (
    <div className="flex flex-col gap-3 px-1 py-5">
      <div className="grid grid-cols-3 items-baseline gap-2">
        <span className="eyebrow">Points</span>
        <span className="text-center text-[0.7rem] uppercase tracking-[0.3em] text-sky-400">
          A
        </span>
        <span className="text-right text-[0.7rem] uppercase tracking-[0.3em] text-rose-400">
          B
        </span>
      </div>
      <Cell label="Poses ×2" a={split.poses.a} b={split.poses.b} />
      <Cell label="Categories ×1" a={split.categories.a} b={split.categories.b} />
      <div className="hairline" />
      <Cell label="Total" a={total.a} b={total.b} emphasis />
    </div>
  );
}
