'use client';

import { useLabCard } from '@/lib/storeV2';
import {
  differentialV2,
  rowPointsV2,
  totalPointsV2,
  type RowV2,
} from '@/lib/scoringV2';
import { MarginRuler } from './MarginRuler';

/**
 * The V2 scorecard: one signed ruler per row. Same 8 poses + 4 categories as
 * the live card, scored with a single differential instead of winner + margin.
 */
export function LabCard() {
  const rows = useLabCard((s) => s.rows);
  const nameA = useLabCard((s) => s.nameA);
  const nameB = useLabCard((s) => s.nameB);
  const setName = useLabCard((s) => s.setName);

  const poses = rows.filter((r) => r.type === 'pose');
  const categories = rows.filter((r) => r.type === 'category');

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <input
          value={nameA}
          onChange={(e) => setName('A', e.target.value)}
          spellCheck={false}
          aria-label="Athlete A name"
          className="w-full border-b border-[var(--rule)] bg-transparent pb-1 text-right font-display text-xl uppercase tracking-[0.15em] outline-none focus:border-[var(--side-a)] sm:text-2xl"
          style={{ color: 'var(--side-a)' }}
          placeholder="Athlete A"
        />
        <span className="font-display text-sm uppercase tracking-[0.3em] text-[var(--fg-mute)]">
          vs
        </span>
        <input
          value={nameB}
          onChange={(e) => setName('B', e.target.value)}
          spellCheck={false}
          aria-label="Athlete B name"
          className="w-full border-b border-[var(--rule)] bg-transparent pb-1 font-display text-xl uppercase tracking-[0.15em] outline-none focus:border-[var(--side-b)] sm:text-2xl"
          style={{ color: 'var(--side-b)' }}
          placeholder="Athlete B"
        />
      </div>

      <RulerLegend nameA={nameA} nameB={nameB} />

      <LabTable title="Poses" rows={poses} />
      <LabTable title="Categories" rows={categories} />
    </div>
  );
}

function RulerLegend({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <div className="flex items-center justify-center gap-4 font-mono text-[0.55rem] uppercase tracking-[0.25em] text-[var(--fg-mute)]">
      <span style={{ color: 'var(--side-b)' }}>← {nameB || 'B'}</span>
      <span className="border border-[var(--rule-strong)] px-2 py-0.5 text-[var(--fg-dim)]">
        0 = dead even
      </span>
      <span style={{ color: 'var(--side-a)' }}>{nameA || 'A'} →</span>
    </div>
  );
}

function LabTable({ title, rows }: { title: string; rows: RowV2[] }) {
  const setMargin = useLabCard((s) => s.setMargin);
  const total = totalPointsV2(rows);
  const diff = differentialV2(rows);
  const judged = rows.filter((r) => r.margin !== null).length;

  return (
    <div className="flex flex-col" data-mosaic-table={title.toLowerCase()}>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-2xl uppercase tracking-[0.3em] text-[var(--fg)] sm:text-3xl">
          {title}
        </h2>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.25em] text-[var(--fg-mute)]">
          {judged}/{rows.length} judged
        </span>
      </div>

      <div className="overflow-x-auto border border-[var(--rule)]">
        <table className="w-full min-w-[36rem] border-collapse">
          {/* Fixed columns so the poses and categories tables line up. */}
          <colgroup>
            <col className="w-[12rem]" />
            <col />
            <col className="w-[7rem]" />
          </colgroup>
          <tbody>
            {rows.map((r) => {
              const pts = rowPointsV2(r);
              return (
                <tr key={r.id} className="border-t border-[var(--rule)] first:border-t-0">
                  <th
                    scope="row"
                    className="border-r border-[var(--rule)] px-3 py-2 text-left align-middle"
                  >
                    <div className="flex flex-col">
                      <span className="font-display text-lg uppercase tracking-wider text-[var(--fg)]">
                        {r.id}
                      </span>
                      <span className="text-[0.6rem] uppercase tracking-widest text-[var(--fg-dim)]">
                        {r.label}
                      </span>
                    </div>
                  </th>
                  <td className="px-2 py-2 align-middle">
                    <MarginRuler
                      value={r.margin}
                      label={r.label}
                      onChange={(m) => setMargin(r.id, m)}
                    />
                  </td>
                  <td className="w-24 border-l border-[var(--rule)] px-2 py-2 text-center align-middle">
                    <span className="tabular font-mono text-xs text-[var(--fg-dim)]">
                      {r.margin === null ? (
                        <span className="text-[var(--fg-mute)]">—</span>
                      ) : r.margin === 0 ? (
                        <span className="text-[var(--fg-mute)]">even</span>
                      ) : (
                        <>
                          <span style={{ color: 'var(--side-a)' }}>{pts.a}</span>
                          {' · '}
                          <span style={{ color: 'var(--side-b)' }}>{pts.b}</span>
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}

            <tr className="border-t border-[var(--rule-strong)] bg-[var(--strip-bg)] text-[var(--strip-fg)]">
              <th
                scope="row"
                className="px-3 py-2 text-left font-display text-base uppercase tracking-[0.3em]"
              >
                Total
              </th>
              <td className="px-3 py-2 text-center">
                <span className="tabular font-display text-2xl">
                  {diff > 0 ? `+${diff}` : diff}
                </span>
                <span className="ml-2 font-mono text-[0.55rem] uppercase tracking-[0.2em] opacity-70">
                  differential
                </span>
              </td>
              <td className="tabular px-2 py-2 text-center font-mono text-xs">
                {total.a} · {total.b}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
