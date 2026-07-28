'use client';

import clsx from 'clsx';
import { SIGNED_MARGINS, type SignedMargin } from '@/lib/scoringV2';

/**
 * The V2 picker: one signed ruler per row instead of two winner cells.
 *
 * Negative leans to Athlete B, positive to Athlete A, and the centre 0 is a
 * real call — "these two are even" — available on poses as well as categories.
 * That centre cell is the whole point of the experiment, so it is drawn as a
 * destination rather than as the gap between two halves.
 */
export function MarginRuler({
  value,
  onChange,
  label,
  compact = false,
}: {
  value: SignedMargin | null;
  onChange: (margin: SignedMargin | null) => void;
  /** Row name, for screen readers. */
  label: string;
  compact?: boolean;
}) {
  return (
    <div className="flex items-stretch justify-center">
      <div
        role="radiogroup"
        aria-label={`Margin for ${label}`}
        className="flex items-stretch border border-[var(--rule)]"
      >
        {SIGNED_MARGINS.map((m) => {
          const selected = value === m;
          const isZero = m === 0;
          const tint = m > 0 ? 'var(--side-a)' : m < 0 ? 'var(--side-b)' : 'var(--fg-dim)';

          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(m)}
              title={
                isZero
                  ? 'Dead even'
                  : `${Math.abs(m)} to Athlete ${m > 0 ? 'A' : 'B'}`
              }
              className={clsx(
                'font-display tabular flex items-center justify-center border-l border-[var(--rule)] transition first:border-l-0',
                compact ? 'h-9 w-8 text-lg' : 'h-11 w-9 text-xl sm:w-11 sm:text-2xl',
                isZero && 'border-x-2 border-x-[var(--rule-strong)]',
                selected ? 'text-[var(--strip-fg)]' : 'hover:bg-white/[0.06]',
              )}
              style={{
                background: selected ? tint : 'transparent',
                color: selected ? undefined : tint,
                opacity: selected || value === null ? 1 : 0.45,
              }}
            >
              {m > 0 ? `+${m}` : m < 0 ? `−${Math.abs(m)}` : '0'}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange(null)}
        title="Clear this row"
        aria-label={`Clear ${label}`}
        className={clsx(
          'ml-1 flex items-center justify-center border border-[var(--rule)] text-[var(--fg-mute)] transition hover:border-[var(--rule-strong)] hover:text-[var(--fg)]',
          compact ? 'h-9 w-7 text-xs' : 'h-11 w-8 text-sm',
          value === null && 'opacity-30',
        )}
      >
        ×
      </button>
    </div>
  );
}
