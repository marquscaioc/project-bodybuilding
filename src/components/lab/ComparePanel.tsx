'use client';

import { useMemo } from 'react';
import { useLabCard } from '@/lib/storeV2';
import { displayScores, totalPoints, verdict, type Verdict } from '@/lib/scoring';
import { MAX_DIFFERENTIAL } from '@/lib/constants';
import {
  MAX_DIFFERENTIAL_V2,
  differentialV2,
  displayScoresV2,
  rangeUsed,
  totalPointsV2,
  v2RowToV1,
  verdictV2,
  type VerdictV2,
} from '@/lib/scoringV2';

/**
 * Both engines, same judge calls. The lab card is V2-native, so it is converted
 * down to V1 rows to produce the live engine's number — which is where V1's
 * blind spot shows up: an even pose has no V1 representation and is dropped.
 */
export function ComparePanel() {
  const rows = useLabCard((s) => s.rows);
  const nameA = useLabCard((s) => s.nameA);
  const nameB = useLabCard((s) => s.nameB);

  const data = useMemo(() => {
    const v1Rows = rows.map(v2RowToV1);
    const v1Pts = totalPoints(v1Rows);
    const v1Disp = displayScores(v1Rows);
    const v2Pts = totalPointsV2(rows);
    const v2Disp = displayScoresV2(rows);

    return {
      v1: {
        pts: v1Pts,
        diff: v1Pts.a - v1Pts.b,
        disp: v1Disp,
        used: rangeUsed(v1Disp),
        verdict: verdict(v1Rows),
      },
      v2: {
        pts: v2Pts,
        diff: differentialV2(rows),
        disp: v2Disp,
        used: rangeUsed(v2Disp),
        verdict: verdictV2(rows),
      },
      evenPoses: rows.filter((r) => r.type === 'pose' && r.margin === 0).length,
      evenCategories: rows.filter((r) => r.type === 'category' && r.margin === 0)
        .length,
    };
  }, [rows]);

  const label = (side: 'A' | 'B') => (side === 'A' ? nameA || 'A' : nameB || 'B');

  return (
    <section
      data-mosaic-final
      className="border border-[var(--rule-strong)] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="bb-stamp text-[var(--mosaic-3,var(--accent))]">
          Same calls · both engines
        </span>
        <span className="font-mono text-[0.55rem] uppercase tracking-[0.25em] text-[var(--fg-mute)]">
          V1 = live show · V2 = this lab
        </span>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--rule-strong)]">
              <th className="py-2 text-left font-mono text-[0.6rem] uppercase tracking-[0.25em] text-[var(--fg-mute)]">
                Measure
              </th>
              <th className="py-2 text-right font-display text-lg uppercase tracking-[0.2em] text-[var(--fg-dim)]">
                V1 · live
              </th>
              <th className="py-2 text-right font-display text-lg uppercase tracking-[0.2em] text-[var(--fg)]">
                V2 · lab
              </th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            <CompareRow
              label="Raw points"
              v1={`${data.v1.pts.a} – ${data.v1.pts.b}`}
              v2={`${data.v2.pts.a} – ${data.v2.pts.b}`}
            />
            <CompareRow
              label="Differential"
              v1={signed(data.v1.diff)}
              v2={signed(data.v2.diff)}
            />
            <CompareRow
              label="Denominator"
              v1={String(MAX_DIFFERENTIAL)}
              v2={String(MAX_DIFFERENTIAL_V2)}
            />
            <CompareRow
              label="Score 0–100"
              v1={`${data.v1.disp.a.toFixed(1)} – ${data.v1.disp.b.toFixed(1)}`}
              v2={`${data.v2.disp.a.toFixed(1)} – ${data.v2.disp.b.toFixed(1)}`}
              emphasis
            />
            <CompareRow
              label="Range used"
              v1={`${data.v1.used.toFixed(1)} pts`}
              v2={`${data.v2.used.toFixed(1)} pts`}
            />
            <CompareRow
              label="Verdict"
              v1={verdictText(data.v1.verdict, label)}
              v2={verdictText(data.v2.verdict, label)}
              emphasis
            />
          </tbody>
        </table>
      </div>

      {data.evenPoses > 0 && (
        <p className="mt-5 border-l-2 border-[var(--accent)] pl-3 text-xs leading-relaxed text-[var(--fg-dim)]">
          <span className="font-display uppercase tracking-[0.2em] text-[var(--fg)]">
            {data.evenPoses} {data.evenPoses === 1 ? 'pose' : 'poses'} called even.
          </span>{' '}
          V1 has no way to record that, so it drops those rows entirely. V2 keeps
          them as a scored zero — the information that used to be thrown away.
        </p>
      )}
      {data.evenCategories > 0 && (
        <p className="mt-3 border-l-2 border-[var(--rule-strong)] pl-3 text-xs leading-relaxed text-[var(--fg-dim)]">
          {data.evenCategories}{' '}
          {data.evenCategories === 1 ? 'category is' : 'categories are'} even. V1
          scores those as 1+1, which cancels out to the same differential — but
          inflates both totals. V2 just scores zero.
        </p>
      )}
    </section>
  );
}

function CompareRow({
  label,
  v1,
  v2,
  emphasis = false,
}: {
  label: string;
  v1: string;
  v2: string;
  emphasis?: boolean;
}) {
  const cell = emphasis
    ? 'py-2 text-right tabular text-base text-[var(--fg)]'
    : 'py-2 text-right tabular text-[var(--fg-dim)]';
  return (
    <tr className="border-b border-[var(--rule-soft)]">
      <td className="py-2 pr-4 uppercase tracking-[0.15em] text-[var(--fg-mute)]">
        {label}
      </td>
      <td className={cell}>{v1}</td>
      <td className={`${cell} pl-4`}>{v2}</td>
    </tr>
  );
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function verdictText(
  v: Verdict | VerdictV2,
  label: (side: 'A' | 'B') => string,
): string {
  if (v.kind === 'tie') return 'Dead heat';
  if (v.kind === 'tooClose') return 'Too close to call';
  return `${label(v.side)} by ${v.margin.toFixed(1)}`;
}
