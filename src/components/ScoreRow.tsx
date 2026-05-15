'use client';

import { useScorecard } from '@/lib/store';
import type { Margin, Row, Side } from '@/types';
import { rowPoints } from '@/lib/scoring';
import clsx from 'clsx';

const MARGIN_OPTIONS: Margin[] = [1, 2, 3, 4];

function WinnerButton({
  side,
  selected,
  name,
  onClick,
}: {
  side: Side;
  selected: boolean;
  name: string;
  onClick: () => void;
}) {
  const baseColor =
    side === 'A'
      ? selected
        ? 'border-sky-400 bg-sky-500/15 text-sky-200'
        : 'border-[var(--border-strong)] text-[var(--fg-dim)] hover:border-sky-500/60 hover:text-sky-200'
      : selected
        ? 'border-rose-400 bg-rose-500/15 text-rose-200'
        : 'border-[var(--border-strong)] text-[var(--fg-dim)] hover:border-rose-500/60 hover:text-rose-200';

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group flex h-12 min-w-[7rem] items-center gap-2 rounded-md border px-3 transition',
        baseColor,
      )}
    >
      <span
        className={clsx(
          'font-display text-lg leading-none',
          side === 'A' ? 'text-sky-300' : 'text-rose-300',
        )}
      >
        {side}
      </span>
      <span className="truncate text-left text-sm font-medium uppercase tracking-wide">
        {name}
      </span>
    </button>
  );
}

function MarginSegment({
  values,
  selected,
  enabled,
  onSelect,
}: {
  values: readonly Margin[];
  selected: Margin | null;
  enabled: boolean;
  onSelect: (m: Margin) => void;
}) {
  return (
    <div
      className={clsx(
        'inline-flex h-12 overflow-hidden rounded-md border',
        enabled ? 'border-[var(--border-strong)]' : 'border-[var(--border)]',
      )}
      role="radiogroup"
      aria-label="Margin"
    >
      {values.map((v, i) => {
        const isSel = selected === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={isSel}
            disabled={!enabled}
            onClick={() => onSelect(v)}
            className={clsx(
              'flex h-full w-12 items-center justify-center font-display text-lg transition',
              i > 0 && 'border-l border-[var(--border-strong)]',
              isSel
                ? 'bg-[var(--accent)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]'
                : enabled
                  ? 'text-[var(--fg)] hover:bg-white/5'
                  : 'text-[var(--fg-mute)]',
            )}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

const MARGIN_LABEL: Record<Margin, string> = {
  1: 'Tight',
  2: 'Clear',
  3: 'Decisive',
  4: 'No contest',
};

export function ScoreRow({ row }: { row: Row }) {
  const setRow = useScorecard((s) => s.setRow);
  const athleteA = useScorecard((s) => s.athleteA.name);
  const athleteB = useScorecard((s) => s.athleteB.name);

  const points = rowPoints(row);
  const totalPts = points.a + points.b;
  const winnerName = row.winner === 'A' ? athleteA : row.winner === 'B' ? athleteB : null;
  const winnerSide = row.winner;
  const isComplete = !!row.winner && !!row.margin;

  return (
    <div className="grid grid-cols-1 items-center gap-x-6 gap-y-4 px-1 py-5 md:grid-cols-[200px_minmax(0,1fr)_180px]">
      {/* Label */}
      <div className="flex items-baseline gap-3 md:flex-col md:items-start md:gap-1">
        <span className="font-display text-2xl uppercase leading-none tracking-wider text-[var(--fg)]">
          {row.id}
        </span>
        <span className="text-xs uppercase tracking-widest text-[var(--fg-dim)] md:text-[0.7rem]">
          {row.label}
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <WinnerButton
            side="A"
            name={athleteA}
            selected={row.winner === 'A'}
            onClick={() =>
              setRow(row.id, row.winner === 'A' ? null : 'A', row.margin)
            }
          />
          <WinnerButton
            side="B"
            name={athleteB}
            selected={row.winner === 'B'}
            onClick={() =>
              setRow(row.id, row.winner === 'B' ? null : 'B', row.margin)
            }
          />
        </div>
        <div className="flex flex-col items-start gap-1">
          <MarginSegment
            values={MARGIN_OPTIONS}
            selected={row.margin}
            enabled={!!row.winner}
            onSelect={(m) =>
              setRow(row.id, row.winner, row.margin === m ? null : m)
            }
          />
          {row.margin && (
            <span className="text-[0.65rem] uppercase tracking-widest text-[var(--fg-dim)]">
              {MARGIN_LABEL[row.margin]}
            </span>
          )}
        </div>
      </div>

      {/* Result */}
      <div className="flex items-center justify-start md:justify-end">
        {isComplete && winnerName ? (
          <div
            className={clsx(
              'flex flex-col items-start md:items-end',
              winnerSide === 'A' ? 'text-sky-300' : 'text-rose-300',
            )}
          >
            <span className="font-display tabular text-3xl leading-none">
              +{totalPts}
            </span>
            <span className="mt-1 text-[0.7rem] uppercase tracking-[0.2em] text-[var(--fg-dim)]">
              to {winnerName}
            </span>
          </div>
        ) : (
          <span className="text-xs uppercase tracking-widest text-[var(--fg-mute)]">
            awaiting score
          </span>
        )}
      </div>
    </div>
  );
}
