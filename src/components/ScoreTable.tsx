'use client';

import type { Row } from '@/types';
import { useScorecard } from '@/lib/store';
import { totalPoints } from '@/lib/scoring';
import { CellPicker } from './CellPicker';

export function ScoreTable({
  title,
  rows,
  showHeader = true,
}: {
  title: string;
  rows: Row[];
  showHeader?: boolean;
}) {
  const athleteA = useScorecard((s) => s.athleteA.name);
  const athleteB = useScorecard((s) => s.athleteB.name);
  const setName = useScorecard((s) => s.setName);
  const total = totalPoints(rows);

  return (
    <div
      className="flex flex-col"
      data-mosaic-table={title.toLowerCase()}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-2xl uppercase tracking-[0.3em] text-[var(--fg)] sm:text-3xl">
          {title}
        </h2>
        <span className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--fg-mute)]">
          {rows.length} rows
        </span>
      </div>

      <div className="overflow-hidden border border-[var(--rule)]">
        <table className="w-full border-collapse">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[35%]" />
            <col className="w-[35%]" />
          </colgroup>
          {showHeader && (
            <thead>
              <tr className="bg-[var(--strip-bg)] text-[var(--strip-fg)]">
                <th className="border-r border-black/30 px-3 py-2 text-left">
                  <span className="font-display text-sm uppercase tracking-[0.25em] opacity-60">
                    Row
                  </span>
                </th>
                <th className="border-r border-black/30 px-2 py-1.5">
                  <input
                    value={athleteA}
                    onChange={(e) => setName('A', e.target.value)}
                    spellCheck={false}
                    className="w-full bg-transparent text-center font-display text-xl uppercase tracking-[0.15em] text-[var(--strip-fg)] outline-none placeholder:text-black/30 sm:text-2xl"
                    placeholder="Athlete A"
                    aria-label="Athlete A name"
                  />
                </th>
                <th className="px-2 py-1.5">
                  <input
                    value={athleteB}
                    onChange={(e) => setName('B', e.target.value)}
                    spellCheck={false}
                    className="w-full bg-transparent text-center font-display text-xl uppercase tracking-[0.15em] text-[var(--strip-fg)] outline-none placeholder:text-black/30 sm:text-2xl"
                    placeholder="Athlete B"
                    aria-label="Athlete B name"
                  />
                </th>
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--rule)]">
                <th
                  scope="row"
                  className="border-r border-[var(--rule)] px-3 py-3 text-left align-middle"
                >
                  <div className="flex flex-col">
                    <span className="font-display text-xl uppercase tracking-wider text-[var(--fg)]">
                      {r.id}
                    </span>
                    <span className="text-[0.65rem] uppercase tracking-widest text-[var(--fg-dim)]">
                      {r.label}
                    </span>
                  </div>
                </th>
                <td className="border-r border-[var(--rule)] p-0 align-middle">
                  <CellPicker row={r} side="A" />
                </td>
                <td className="p-0 align-middle">
                  <CellPicker row={r} side="B" />
                </td>
              </tr>
            ))}

            <tr className="border-t border-[var(--rule-strong)] bg-[var(--strip-bg)] text-[var(--strip-fg)]">
              <th
                scope="row"
                className="border-r border-black/30 px-3 py-2 text-left font-display text-lg uppercase tracking-[0.3em]"
              >
                Total
              </th>
              <td className="border-r border-black/30 px-3 py-2 text-center font-display text-3xl tabular sm:text-4xl">
                {total.a}
              </td>
              <td className="px-3 py-2 text-center font-display text-3xl tabular sm:text-4xl">
                {total.b}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
