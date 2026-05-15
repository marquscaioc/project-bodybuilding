'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { Margin, Row, Side } from '@/types';
import { useScorecard } from '@/lib/store';

const POSE_MARGINS: Margin[] = [1, 2, 3, 4];
const CATEGORY_MARGINS: Margin[] = [2, 3, 4]; // Margin 1 collapses into a tie for categories.

export function CellPicker({ row, side }: { row: Row; side: Side }) {
  const setRow = useScorecard((s) => s.setRow);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const canTie = row.type === 'category';
  const isTie = row.winner === 'tie';
  const isWinnerSide = row.winner === side;
  const otherSideHas = !!row.winner && !isTie && !isWinnerSide;

  // What number to display in this cell
  let displayValue: number | null = null;
  if (isWinnerSide && row.margin) displayValue = row.margin;
  if (isTie && canTie) displayValue = 1;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function commitMargin(m: Margin) {
    setRow(row.id, side, m);
    setOpen(false);
  }
  function commitTie() {
    setRow(row.id, 'tie', null);
    setOpen(false);
  }
  function clear() {
    setRow(row.id, null, null);
    setOpen(false);
  }

  const sideTint = side === 'A' ? 'text-[var(--side-a)]' : 'text-[var(--side-b)]';
  const tieTint = 'text-[var(--accent)]';

  return (
    <div ref={ref} className="relative h-full w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'flex h-full min-h-[4rem] w-full items-center justify-center gap-2 transition',
          'hover:bg-white/[0.04]',
          otherSideHas && 'opacity-30',
        )}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Score for ${row.label}, side ${side}`}
      >
        {displayValue ? (
          <span
            className={clsx(
              'font-display tabular text-5xl leading-none sm:text-6xl',
              isTie ? tieTint : sideTint,
            )}
          >
            {displayValue}
          </span>
        ) : (
          <span className="font-display text-3xl leading-none text-[var(--fg-mute)] opacity-0 transition hover:opacity-100">
            +
          </span>
        )}
        {isTie && (
          <span className="font-display text-[0.65rem] uppercase tracking-[0.3em] text-[var(--accent)] opacity-80">
            Tie
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 rounded-md border border-white/30 bg-[#111] shadow-[0_18px_36px_-8px_rgba(0,0,0,0.7)]">
          <div className="flex">
            {canTie && (
              <button
                type="button"
                onClick={commitTie}
                className={clsx(
                  'flex h-12 w-14 items-center justify-center font-display text-base uppercase tracking-[0.2em] transition hover:bg-[var(--accent)] hover:text-white',
                  isTie ? 'bg-[var(--accent)] text-white' : 'text-[var(--fg)]',
                )}
                title="Tied row (1 point each)"
              >
                Tie
              </button>
            )}
            {(canTie ? CATEGORY_MARGINS : POSE_MARGINS).map((m, i) => {
              const selected = isWinnerSide && row.margin === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => commitMargin(m)}
                  className={clsx(
                    'flex h-12 w-12 items-center justify-center font-display text-2xl text-[var(--fg)] transition hover:bg-[var(--accent)] hover:text-white',
                    (canTie || i > 0) && 'border-l border-white/20',
                    selected && 'bg-[var(--accent)] text-white',
                  )}
                >
                  {m}
                </button>
              );
            })}
            <button
              type="button"
              onClick={clear}
              className="flex h-12 w-10 items-center justify-center border-l border-white/20 text-sm uppercase tracking-widest text-[var(--fg-dim)] transition hover:bg-white/10 hover:text-[var(--fg)]"
              title="Clear"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
