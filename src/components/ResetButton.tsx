'use client';

import { useScorecard } from '@/lib/store';
import { RotateCcw } from 'lucide-react';

export function ResetButton() {
  const reset = useScorecard((s) => s.reset);
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm('Clear all scores? Athlete names stay.')) reset();
      }}
      className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-[var(--fg)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      <RotateCcw size={14} />
      Reset
    </button>
  );
}
